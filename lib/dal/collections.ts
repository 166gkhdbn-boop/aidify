import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  collectionSchema,
  updateCollectionSchema,
  listQuerySchema,
  uuidSchema,
  uuidArraySchema,
  type CollectionInput,
  type UpdateCollectionInput,
} from "@/lib/validators";
import { logActivity } from "./activity";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  escapeLike,
  SETUP_MESSAGE,
} from "./helpers";
import type { CollectionRow, PageResult } from "./types";

/**
 * Collections data-access layer (brief §07/§08).
 *
 * SAFE DELETE: deleting a collection never deletes configs — their
 * `collection_id` is set to NULL first (unassigned), then the collection
 * row is removed. This is deliberate: collections are groupings, not owners.
 */

export interface CollectionWithCount extends CollectionRow {
  config_count: number;
}

async function configCounts(
  db: SupabaseClient,
  user: User,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const { data } = await db
    .from("configurations")
    .select("collection_id")
    .eq("owner_id", user.id)
    .not("collection_id", "is", null)
    .limit(5000);
  for (const row of (data ?? []) as { collection_id: string | null }[]) {
    if (!row.collection_id) continue;
    counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
  }
  return counts;
}

async function fetchOwned(
  db: SupabaseClient,
  user: User,
  id: string,
): Promise<CollectionRow | null> {
  const { data, error } = await db
    .from("collections")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[aidify] collection fetchOwned failed:", error.message);
    return null;
  }
  return (data as CollectionRow | null) ?? null;
}

export async function listCollections(
  query: unknown,
): Promise<ApiResponse<PageResult<CollectionWithCount>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;
  const q = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  let builder = db
    .from("collections")
    .select("*", { count: "exact" })
    .eq("owner_id", user.id);
  if (q.search) {
    builder = builder.ilike("name", `%${escapeLike(q.search)}%`);
  }
  builder = builder.order("name", { ascending: true });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as CollectionRow[];
  const counts = await configCounts(db, user);
  return ok({
    items: rows.map((r) => ({
      ...r,
      config_count: counts.get(r.id) ?? 0,
    })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function getCollection(
  id: unknown,
): Promise<ApiResponse<CollectionWithCount>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const row = await fetchOwned(db, user, parsed.value);
  if (!row) return notFound("Collection not found.");
  const counts = await configCounts(db, user);
  return ok({ ...row, config_count: counts.get(row.id) ?? 0 });
}

export async function createCollection(
  input: CollectionInput,
): Promise<ApiResponse<CollectionRow>> {
  const user = await requireUser();
  const parsed = parseOr(collectionSchema, input);
  if (!parsed.ok) return parsed.error;
  const v = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  if (v.project_id) {
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", v.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!project) {
      return err(ApiErrorCode.VALIDATION, "The selected project does not exist.");
    }
  }

  const { data, error } = await db
    .from("collections")
    .insert({
      owner_id: user.id,
      name: v.name,
      description: v.description ?? null,
      project_id: v.project_id ?? null,
      color: v.color ?? null,
      icon: v.icon ?? null,
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  const created = data as CollectionRow;
  await logActivity("collection_created", "collection", created.id, {
    name: created.name,
  });
  return ok(created);
}

export async function updateCollection(
  id: unknown,
  input: UpdateCollectionInput,
): Promise<ApiResponse<CollectionRow>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const inParsed = parseOr(updateCollectionSchema, input);
  if (!inParsed.ok) return inParsed.error;
  const v = inParsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, idParsed.value);
  if (!current) return notFound("Collection not found.");

  if ("project_id" in v && v.project_id) {
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", v.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!project) {
      return err(ApiErrorCode.VALIDATION, "The selected project does not exist.");
    }
  }

  const patch: Record<string, string | null> = {};
  if ("name" in v && v.name !== undefined) patch.name = v.name;
  if ("description" in v) patch.description = v.description ?? null;
  if ("project_id" in v) patch.project_id = v.project_id ?? null;
  if ("color" in v) patch.color = v.color ?? null;
  if ("icon" in v) patch.icon = v.icon ?? null;

  const { data, error } = await db
    .from("collections")
    .update(patch)
    .eq("id", idParsed.value)
    .eq("owner_id", user.id)
    .select("*")
    .single();
  if (error) return dbError(error);

  const updated = data as CollectionRow;
  await logActivity("collection_updated", "collection", updated.id, {
    name: updated.name,
  });
  return ok(updated);
}

export async function archiveCollection(
  id: unknown,
): Promise<ApiResponse<CollectionRow>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, parsed.value);
  if (!current) return notFound("Collection not found.");

  const { data, error } = await db
    .from("collections")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.value)
    .eq("owner_id", user.id)
    .select("*")
    .single();
  if (error) return dbError(error);
  await logActivity("collection_archived", "collection", parsed.value, {
    name: current.name,
  });
  return ok(data as CollectionRow);
}

export async function restoreCollection(
  id: unknown,
): Promise<ApiResponse<CollectionRow>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, parsed.value);
  if (!current) return notFound("Collection not found.");

  const { data, error } = await db
    .from("collections")
    .update({ archived_at: null })
    .eq("id", parsed.value)
    .eq("owner_id", user.id)
    .select("*")
    .single();
  if (error) return dbError(error);
  await logActivity("collection_restored", "collection", parsed.value, {
    name: current.name,
  });
  return ok(data as CollectionRow);
}

/**
 * SAFE DELETE: member configs are NOT deleted — they are unassigned
 * (`collection_id = NULL`) first, then the collection row is removed.
 */
export async function deleteCollection(
  id: unknown,
): Promise<ApiResponse<{ deleted: boolean; unassigned: number }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, parsed.value);
  if (!current) return notFound("Collection not found.");

  // Unassign configs first — they survive the collection deletion.
  const { data: unassignedRows, error: unassignError } = await db
    .from("configurations")
    .update({ collection_id: null })
    .eq("collection_id", parsed.value)
    .eq("owner_id", user.id)
    .select("id");
  if (unassignError) return dbError(unassignError);

  const { error } = await db
    .from("collections")
    .delete()
    .eq("id", parsed.value)
    .eq("owner_id", user.id);
  if (error) return dbError(error);

  const unassigned = (unassignedRows ?? []).length;
  await logActivity("collection_deleted", "collection", parsed.value, {
    name: current.name,
    configs_unassigned: unassigned,
  });
  return ok({ deleted: true, unassigned });
}

/**
 * Move configs into a collection, or pass `collectionId: null` to unassign
 * them (move to "no collection"). Every config must be owned by the user.
 */
export async function moveConfigs(
  collectionId: unknown,
  configIds: unknown,
): Promise<ApiResponse<{ moved: number }>> {
  const user = await requireUser();
  const colParsed = parseOr(uuidSchema.nullable(), collectionId);
  if (!colParsed.ok) return colParsed.error;
  const idsParsed = parseOr(uuidArraySchema, configIds);
  if (!idsParsed.ok) return idsParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  if (colParsed.value) {
    const target = await fetchOwned(db, user, colParsed.value);
    if (!target) return notFound("Collection not found.");
  }

  const { data: owned, error: ownError } = await db
    .from("configurations")
    .select("id")
    .in("id", idsParsed.value)
    .eq("owner_id", user.id);
  if (ownError) return dbError(ownError);
  if ((owned ?? []).length !== idsParsed.value.length) {
    return err(
      ApiErrorCode.VALIDATION,
      "One or more configurations do not exist.",
    );
  }

  const { error } = await db
    .from("configurations")
    .update({ collection_id: colParsed.value })
    .in("id", idsParsed.value)
    .eq("owner_id", user.id);
  if (error) return dbError(error);

  await logActivity("configs_moved", "collection", colParsed.value, {
    count: idsParsed.value.length,
  });
  return ok({ moved: idsParsed.value.length });
}
