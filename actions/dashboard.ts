"use server";

import * as dal from "@/lib/dal/dashboard";
import { runAction } from "./_shared";

/** Dashboard server actions (thin wrappers over lib/dal/dashboard). */

export async function getDashboardStatsAction() {
  return runAction(() => dal.getDashboardStats());
}

export async function getPublishedAnnouncementsAction() {
  return runAction(() => dal.getPublishedAnnouncements());
}
