"use server";

import * as dal from "@/lib/dal/analytics";
import type { DateRangeInput } from "@/lib/validators";
import { runAction } from "./_shared";

/** Analytics server actions (thin wrappers over lib/dal/analytics). */

export async function getConfigAnalyticsAction(range: DateRangeInput) {
  return runAction(() => dal.getConfigAnalytics(range));
}

export async function getActivityAnalyticsAction(range: DateRangeInput) {
  return runAction(() => dal.getActivityAnalytics(range));
}
