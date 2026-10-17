"use server";

import * as dal from "@/lib/dal/support";
import type { TicketInput } from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/** Support server actions — user side (thin wrappers over lib/dal/support). */

export async function createTicketAction(input: TicketInput) {
  const limited = await writeLimit("support:create-ticket");
  if (limited) return limited;
  return runAction(() => dal.createTicket(input));
}

export async function listMyTicketsAction(query: unknown) {
  return runAction(() => dal.listMyTickets(query));
}

export async function getTicketAction(id: string) {
  return runAction(() => dal.getTicket(id));
}

export async function replyToTicketAction(id: string, body: string) {
  const limited = await writeLimit("support:reply");
  if (limited) return limited;
  return runAction(() => dal.replyToTicket(id, body));
}
