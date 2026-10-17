"use server";

import * as dal from "@/lib/dal/notifications";
import { runAction, writeLimit } from "./_shared";

/** Notification server actions (thin wrappers over lib/dal/notifications). */

export async function listNotificationsAction(query: unknown) {
  return runAction(() => dal.listNotifications(query));
}

export async function unreadCountAction() {
  return runAction(() => dal.unreadCount());
}

export async function markReadAction(id: string) {
  const limited = await writeLimit("notifications:mark-read");
  if (limited) return limited;
  return runAction(() => dal.markRead(id));
}

export async function markAllReadAction() {
  const limited = await writeLimit("notifications:mark-all-read");
  if (limited) return limited;
  return runAction(() => dal.markAllRead());
}

export async function deleteNotificationAction(id: string) {
  const limited = await writeLimit("notifications:delete");
  if (limited) return limited;
  return runAction(() => dal.deleteNotification(id));
}
