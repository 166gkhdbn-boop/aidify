import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  tagSchema,
  listQuerySchema,
  uuidSchema,
  type TagInput,
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
import type { PageResult, TagRow } from "./types";

/**
 * Configuration tags data-access layer (brief §07/§08).
 *
 * Tags are owner-scoped (`UNIQUE(owner_id, name)`). Deleting a tag removes
 * only the tag row and its assignments — configs are never deleted by tag
 * operations.
 */

export interface TagWithUsage extends TagRow {
  usage_count: number;
}

async function fetchOwned(
  db: SupabaseClient,
  user: User,
  id: string,
): Promise<TagRow | null> {
  const { data, error } = await db
    .from("configuration_tags")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[aidify] tag fetchOwned failed:", error.message);
    return null;
  }
  return (data as TagRow | null) ?? null;
}

/** Tag list with usage counts (assignments across the user's own configs). */
export async function listTags(
  query: unknown,
): Promise<ApiResponse<PageResult<TagWithUsage>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;
  const q = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  let builder = db
    .from("configuration_tags")
    .select("*", { count: "exact" })
    .eq("owner_id", user.id);
  if (q.search) {
    builder = builder.ilike("name", `%${escapeLike(q.search)}%`);
  }
  builder = builder.order("name", { ascending: true });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as TagRow[];
  const usage = new Map<string, number>();
  if (rows.length > 0) {
    const { data: assigns } = await db
      .from("configuration_tag_assignments")
      .select("tag_id, configurations!inner(owner_id)")
      .in(
        "tag_id",
        rows.map((r) => r.id),
      )
      .eq("configurations.owner_id", user.id)
      .limit(5000);
    for (const row of (assigns ?? []) as { tag_id: string }[]) {
      usage.set(row.tag_id, (usage.get(row.tag_id) ?? 0) + 1);
    }
  }

  return ok({
    items: rows.map((r) => ({ ...r, usage_count: usage.get(r.id) ?? 0 })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function createTag(
  input: TagInput,
): Promise<ApiResponse<TagRow>> {
  const user = await requireUser();
  const parsed = parseOr(tagSchema, input);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("configuration_tags")
    .insert({ owner_id: user.id, name: parsed.value.name })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return err(ApiErrorCode.CONFLICT, "A tag with this name already exists.");
    }
    return dbError(error);
  }
  const created = data as TagRow;
  await logActivity("tag_created", "tag", created.id, { name: created.name });
  return ok(created);
}

export async function renameTag(
  id: unknown,
  input: TagInput,
): Promise<ApiResponse<TagRow>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const inParsed = parseOr(tagSchema, input);
  if (!inParsed.ok) return inParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, idParsed.value);
  if (!current) return notFound("Tag not found.");

  const { data, error } = await db
    .from("configuration_tags")
    .update({ name: inParsed.value.name })
    .eq("id", idParsed.value)
    .eq("owner_id", user.id)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return err(ApiErrorCode.CONFLICT, "A tag with this name already exists.");
    }
    return dbError(error);
  }
  const updated = data as TagRow;
  await logActivity("tag_renamed", "tag", updated.id, {
    from: current.name,
    to: updated.name,
  });
  return ok(updated);
}

/**
 * Delete a tag. Only the tag row and its assignments are removed
 * (assignments cascade via FK) — configs are never deleted.
 */
export async function deleteTag(
  id: unknown,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, parsed.value);
  if (!current) return notFound("Tag not found.");

  const { error } = await db
    .from("configuration_tags")
    .delete()
    .eq("id", parsed.value)
    .eq("owner_id", user.id);
  if (error) return dbError(error);

  await logActivity("tag_deleted", "tag", parsed.value, {
    name: current.name,
  });
  return ok({ deleted: true });
}

/** Assign a tag to a config (idempotent). Both must be owned by the user. */
export async function assignTag(
  configId: unknown,
  tagId: unknown,
): Promise<ApiResponse<{ assigned: boolean }>> {
  const user = await requireUser();
  const configParsed = parseOr(uuidSchema, configId);
  if (!configParsed.ok) return configParsed.error;
  const tagParsed = parseOr(uuidSchema, tagId);
  if (!tagParsed.ok) return tagParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const [{ data: config }, { data: tag }] = await Promise.all([
    db
      .from("configurations")
      .select("id")
      .eq("id", configParsed.value)
      .eq("owner_id", user.id)
      .maybeSingle(),
    db
      .from("configuration_tags")
      .select("id")
      .eq("id", tagParsed.value)
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);
  if (!config || !tag) return notFound("Configuration or tag not found.");

  const { error } = await db.from("configuration_tag_assignments").insert({
    configuration_id: configParsed.value,
    tag_id: tagParsed.value,
  });
  if (error && error.code !== "23505") return dbError(error);
  return ok({ assigned: true });
}

/** Remove a tag from a config. */
export async function unassignTag(
  configId: unknown,
  tagId: unknown,
): Promise<ApiResponse<{ unassigned: boolean }>> {
  const user = await requireUser();
  const configParsed = parseOr(uuidSchema, configId);
  if (!configParsed.ok) return configParsed.error;
  const tagParsed = parseOr(uuidSchema, tagId);
  if (!tagParsed.ok) return tagParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data: config } = await db
    .from("configurations")
    .select("id")
    .eq("id", configParsed.value)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!config) return notFound("Configuration not found.");

  // RLS delete policy checks config ownership, so this is safe.
  const { error } = await db
    .from("configuration_tag_assignments")
    .delete()
    .eq("configuration_id", configParsed.value)
    .eq("tag_id", tagParsed.value);
  if (error) return dbError(error);
  return ok({ unassigned: true });
}
