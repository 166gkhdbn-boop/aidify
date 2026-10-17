import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getUserRoles, requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  ticketSchema,
  ticketReplySchema,
  listQuerySchema,
  uuidSchema,
  type TicketInput,
} from "@/lib/validators";
import { logActivity } from "./activity";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  SETUP_MESSAGE,
} from "./helpers";
import type { PageResult, TicketReplyRow, TicketRow } from "./types";

/**
 * Support tickets — user side (brief §10/§11 support queue).
 *
 * `getTicket` is readable by the ticket owner OR staff (moderator /
 * administrator); anything else returns 404 (no oracle). `replyToTicket`
 * sets `is_staff` from a server-side role check — never from the client.
 * A user reply on a resolved/closed ticket reopens it.
 */

async function isStaff(userId: string): Promise<boolean> {
  const roles = await getUserRoles({ id: userId } as User);
  return roles.includes("moderator") || roles.includes("administrator");
}

export interface TicketDetail {
  ticket: TicketRow;
  replies: TicketReplyRow[];
}

/** Load a ticket with replies when the user may see it (owner or staff). */
async function loadTicket(
  db: SupabaseClient,
  userId: string,
  ticketId: string,
  staff: boolean,
): Promise<TicketDetail | null> {
  const { data: ticket, error } = await db
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (error || !ticket) return null;
  const row = ticket as TicketRow;
  if (!staff && row.user_id !== userId) return null;

  const { data: replies, error: rError } = await db
    .from("support_ticket_replies")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (rError) {
    console.error("[aidify] ticket replies failed:", rError.message);
    return null;
  }
  return { ticket: row, replies: (replies ?? []) as TicketReplyRow[] };
}

export async function createTicket(
  input: TicketInput,
): Promise<ApiResponse<TicketRow>> {
  const user = await requireUser();
  const parsed = parseOr(ticketSchema, input);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: parsed.value.subject,
      description: parsed.value.description ?? null,
      priority: parsed.value.priority,
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  const created = data as TicketRow;
  await logActivity("ticket_created", "support_ticket", created.id, {
    subject: created.subject,
  });
  return ok(created);
}

export async function listMyTickets(
  query: unknown,
): Promise<ApiResponse<PageResult<TicketRow>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { from, to } = pageWindow(parsed.value.page, parsed.value.pageSize);
  const { data, error, count } = await db
    .from("support_tickets")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (error) return dbError(error);

  return ok({
    items: (data ?? []) as TicketRow[],
    total: count ?? 0,
    page: parsed.value.page,
    pageSize: parsed.value.pageSize,
  });
}

export async function getTicket(
  id: unknown,
): Promise<ApiResponse<TicketDetail>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const staff = await isStaff(user.id);
  const detail = await loadTicket(db, user.id, parsed.value, staff);
  if (!detail) return notFound("Ticket not found.");
  return ok(detail);
}

export async function replyToTicket(
  id: unknown,
  body: unknown,
): Promise<ApiResponse<TicketReplyRow>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const bodyParsed = parseOr(ticketReplySchema, { body });
  if (!bodyParsed.ok) return bodyParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const staff = await isStaff(user.id);
  const detail = await loadTicket(db, user.id, idParsed.value, staff);
  if (!detail) return notFound("Ticket not found.");

  const { data, error } = await db
    .from("support_ticket_replies")
    .insert({
      ticket_id: idParsed.value,
      author_id: user.id,
      body: bodyParsed.value.body,
      is_staff: staff,
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  // A user reply on a resolved/closed ticket reopens it.
  if (
    !staff &&
    (detail.ticket.status === "resolved" || detail.ticket.status === "closed")
  ) {
    await db
      .from("support_tickets")
      .update({ status: "open" })
      .eq("id", idParsed.value);
  }

  await logActivity("ticket_replied", "support_ticket", idParsed.value, {
    subject: detail.ticket.subject,
    is_staff: staff,
  });
  return ok(data as TicketReplyRow);
}
