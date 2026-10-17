"use server";

import * as dal from "@/lib/dal/tags";
import type { TagInput } from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/** Tag server actions (thin wrappers over lib/dal/tags). */

export async function listTagsAction(query: unknown) {
  return runAction(() => dal.listTags(query));
}

export async function createTagAction(input: TagInput) {
  const limited = await writeLimit("tags:create");
  if (limited) return limited;
  return runAction(() => dal.createTag(input));
}
