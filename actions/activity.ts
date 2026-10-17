"use server";

import * as dal from "@/lib/dal/activity";
import { runAction } from "./_shared";

/** Activity server actions (thin wrappers over lib/dal/activity). */

export async function listActivityAction(query: unknown) {
  return runAction(() => dal.listActivity(query));
}
