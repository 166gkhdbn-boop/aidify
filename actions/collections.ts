"use server";

import * as dal from "@/lib/dal/collections";
import type {
  CollectionInput,
  UpdateCollectionInput,
} from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/** Collection server actions (thin wrappers over lib/dal/collections). */

export async function listCollectionsAction(query: unknown) {
  return runAction(() => dal.listCollections(query));
}

export async function getCollectionAction(id: string) {
  return runAction(() => dal.getCollection(id));
}

export async function createCollectionAction(input: CollectionInput) {
  const limited = await writeLimit("collections:create");
  if (limited) return limited;
  return runAction(() => dal.createCollection(input));
}

export async function updateCollectionAction(
  id: string,
  input: UpdateCollectionInput,
) {
  const limited = await writeLimit("collections:update");
  if (limited) return limited;
  return runAction(() => dal.updateCollection(id, input));
}

export async function archiveCollectionAction(id: string) {
  const limited = await writeLimit("collections:archive");
  if (limited) return limited;
  return runAction(() => dal.archiveCollection(id));
}

export async function restoreCollectionAction(id: string) {
  const limited = await writeLimit("collections:restore");
  if (limited) return limited;
  return runAction(() => dal.restoreCollection(id));
}

export async function deleteCollectionAction(id: string) {
  const limited = await writeLimit("collections:delete");
  if (limited) return limited;
  return runAction(() => dal.deleteCollection(id));
}

/** Move configs into a collection, or null to unassign them. */
export async function moveConfigsAction(
  collectionId: string | null,
  configIds: string[],
) {
  const limited = await writeLimit("collections:move");
  if (limited) return limited;
  return runAction(() => dal.moveConfigs(collectionId, configIds));
}
