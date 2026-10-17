import "server-only";

import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  notificationSchema,
  listQuerySchema,
  uuidSchema,
} from "@/lib/validators";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  getAdminClient,
  SETUP_MESSAGE,
} from "./helpers";
import type { NotificationRow, PageResult } from "./types";

/**
 * Notifications data-access layer.
 *
 * Users read and dismiss their own notifications (RLS owner policies).
 * Creation is service-role only — there is no user INSERT policy — so
 * `createNotification` takes an explicit userId and is used by system events
 * (admin moderation, ticket replies, announcements). It requires no session.
 */

export async function listNotifications(
  query: unknown,
): Promise<ApiResponse<PageResult<NotificationRow>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { from, to } = pageWindow(parsed.value.page, parsed.value.pageSize);
  const { data, error, count } = await db
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return dbError(error);

  return ok({
    items: (data ?? []) as NotificationRow[],
    total: count ?? 0,
    page: parsed.value.page,
    pageSize: parsed.value.pageSize,
  });
}

export async function unreadCount(): Promise<ApiResponse<{ count: number }>> {
  const user = await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return dbError(error);
  return ok({ count: count ?? 0 });
}

export async function markRead(
  id: unknown,
): Promise<ApiResponse<NotificationRow>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.value)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return notFound("Notification not found.");
  return ok(data as NotificationRow);
}

export async function markAllRead(): Promise<
  ApiResponse<{ marked: number }>
> {
  const user = await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
    .select("id");
  if (error) return dbError(error);
  return ok({ marked: (data ?? []).length });
}

/**
 * Create a notification for any user (system use). Service-role insert;
 * input validated, no session required.
 */
export async function createNotification(
  userId: string,
  title: string,
  body?: string | null,
  link?: string | null,
): Promise<ApiResponse<NotificationRow>> {
  const parsed = parseOr(notificationSchema, { title, body, link });
  if (!parsed.ok) return parsed.error;
  const idParsed = parseOr(uuidSchema, userId);
  if (!idParsed.ok) return idParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("notifications")
    .insert({
      user_id: idParsed.value,
      title: parsed.value.title,
      body: parsed.value.body ?? null,
      link: parsed.value.link ?? null,
    })
    .select("*")
    .single();
  if (error) return dbError(error);
  return ok(data as NotificationRow);
}

/** Remove one notification (owner). */
export async function deleteNotification(
  id: unknown,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("notifications")
    .delete()
    .eq("id", parsed.value)
    .eq("user_id", user.id)
    .select("id");
  if (error) return dbError(error);
  if ((data ?? []).length === 0) return notFound("Notification not found.");
  return ok({ deleted: true });
}
