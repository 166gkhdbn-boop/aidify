import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { diffJson, diffSummary, type DiffEntry } from "@/lib/diff";
import {
  detectImportConflicts,
  resolveImportAction,
  type ImportConflict,
} from "@/lib/import";
import {
  createConfigSchema,
  updateConfigSchema,
  listConfigsQuerySchema,
  uuidSchema,
  uuidArraySchema,
  expectedVersionSchema,
  importConflictSchema,
  type ImportConflictMode,
} from "@/lib/validators";
import { logActivity } from "./activity";
import { getSystemSetting } from "./settings";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  escapeLike,
  SETUP_MESSAGE,
} from "./helpers";
import type {
  ConfigDetail,
  ConfigSummary,
  ConfigurationRow,
  ConfigurationVersionRow,
  PageResult,
  TagRow,
} from "./types";

/**
 * Configurations data-access layer (brief §07/§08).
 *
 * Identity always comes from the verified session (`requireUser()`); the
 * client never supplies owner_id. All list paths are server-side
 * filtered/sorted/paginated — the table is never loaded whole.
 *
 * Versioning: every successful update goes through the atomic
 * `public.bump_config_version()` Postgres function (migration 0004), which
 * locks the row, checks optimistic-locking version + ownership, inserts the
 * `configuration_versions` snapshot, and bumps the config — all in one
 * transaction. Restores always create a NEW version; history is append-only.
 */

type JoinedRow = ConfigurationRow & {
  collections: { id: string; name: string } | null;
  projects: { id: string; name: string } | null;
};

const DETAIL_SELECT =
  "*, collections(id,name), projects(id,name)";

function toDetail(row: JoinedRow, tags: TagRow[]): ConfigDetail {
  const { collections, projects, ...rest } = row;
  return { ...rest, collection: collections, project: projects, tags };
}

async function tagsForConfigs(
  db: SupabaseClient,
  configIds: string[],
): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (configIds.length === 0) return map;
  const { data, error } = await db
    .from("configuration_tag_assignments")
    .select("configuration_id, configuration_tags(id,owner_id,name,created_at)")
    .in("configuration_id", configIds);
  if (error) {
    console.error("[aidify] tagsForConfigs failed:", error.message);
    return map;
  }
  for (const row of (data ?? []) as unknown as {
    configuration_id: string;
    configuration_tags: TagRow | null;
  }[]) {
    if (!row.configuration_tags) continue;
    const list = map.get(row.configuration_id) ?? [];
    list.push(row.configuration_tags);
    map.set(row.configuration_id, list);
  }
  return map;
}

/** Fetch one owned config row (404 when missing OR not owned: no ID oracle). */
async function fetchOwned(
  db: SupabaseClient,
  user: User,
  id: string,
): Promise<JoinedRow | null> {
  const { data, error } = await db
    .from("configurations")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[aidify] fetchOwned failed:", error.message);
    return null;
  }
  return (data as JoinedRow | null) ?? null;
}

async function getDetail(
  db: SupabaseClient,
  row: JoinedRow,
): Promise<ConfigDetail> {
  const tags = await tagsForConfigs(db, [row.id]);
  return toDetail(row, tags.get(row.id) ?? []);
}

/** Verify an optional project/collection reference belongs to the user. */
async function assertOwnedRef(
  db: SupabaseClient,
  user: User,
  table: "projects" | "collections",
  id: string | null | undefined,
): Promise<ApiResponse<never> | null> {
  if (!id) return null;
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) {
    return err(
      ApiErrorCode.VALIDATION,
      `The selected ${table === "projects" ? "project" : "collection"} does not exist.`,
    );
  }
  return null;
}

/** Verify tag ids all belong to the user; returns the rows. */
async function assertOwnedTags(
  db: SupabaseClient,
  user: User,
  tagIds: string[] | undefined,
): Promise<{ tags: TagRow[] } | { error: ApiResponse<never> }> {
  if (!tagIds || tagIds.length === 0) return { tags: [] };
  const { data, error } = await db
    .from("configuration_tags")
    .select("*")
    .in("id", tagIds)
    .eq("owner_id", user.id);
  if (error) return { error: dbError(error) };
  const rows = (data ?? []) as TagRow[];
  if (rows.length !== tagIds.length) {
    return {
      error: err(ApiErrorCode.VALIDATION, "One or more tags do not exist."),
    };
  }
  return { tags: rows };
}

async function replaceTagAssignments(
  db: SupabaseClient,
  configId: string,
  tagIds: string[],
): Promise<void> {
  const { error: delError } = await db
    .from("configuration_tag_assignments")
    .delete()
    .eq("configuration_id", configId);
  if (delError) throw new Error(`tag reset failed: ${delError.message}`);
  if (tagIds.length === 0) return;
  const { error } = await db
    .from("configuration_tag_assignments")
    .insert(tagIds.map((tag_id) => ({ configuration_id: configId, tag_id })));
  if (error) throw new Error(`tag assign failed: ${error.message}`);
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

/** Server-side filtered/sorted/paginated config list. */
export async function listConfigs(
  query: unknown,
): Promise<ApiResponse<PageResult<ConfigSummary>>> {
  const user = await requireUser();
  const parsed = parseOr(listConfigsQuerySchema, query);
  if (!parsed.ok) return parsed.error;
  const q = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  // Tag filter: resolve the tag name to config ids first (bounded queries).
  let tagConfigIds: string[] | null = null;
  if (q.tag) {
    const { data: tagRow } = await db
      .from("configuration_tags")
      .select("id")
      .eq("owner_id", user.id)
      .eq("name", q.tag)
      .maybeSingle();
    if (!tagRow) {
      return ok({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
    }
    const { data: assigns } = await db
      .from("configuration_tag_assignments")
      .select("configuration_id")
      .eq("tag_id", (tagRow as { id: string }).id)
      .limit(5000);
    const ids = ((assigns ?? []) as { configuration_id: string }[]).map(
      (r) => r.configuration_id,
    );
    if (ids.length === 0) {
      return ok({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
    }
    tagConfigIds = ids;
  }

  let builder = db
    .from("configurations")
    .select(DETAIL_SELECT, { count: "exact" })
    .eq("owner_id", user.id);

  if (q.search) {
    const s = escapeLike(q.search);
    builder = builder.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
  }
  if (q.status) builder = builder.eq("status", q.status);
  if (q.type) builder = builder.eq("config_type", q.type);
  if (q.environment) builder = builder.eq("environment", q.environment);
  if (q.collectionId) builder = builder.eq("collection_id", q.collectionId);
  if (tagConfigIds) builder = builder.in("id", tagConfigIds);

  switch (q.sort) {
    case "oldest":
      builder = builder.order("created_at", { ascending: true });
      break;
    case "name":
      builder = builder.order("name", { ascending: true });
      break;
    case "name_desc":
      builder = builder.order("name", { ascending: false });
      break;
    case "updated":
      builder = builder.order("updated_at", { ascending: false });
      break;
    case "newest":
    default:
      builder = builder.order("created_at", { ascending: false });
  }

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as JoinedRow[];
  const tagMap = await tagsForConfigs(
    db,
    rows.map((r) => r.id),
  );
  return ok({
    items: rows.map((r) => toDetail(r, tagMap.get(r.id) ?? [])),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

/** Single config with relations. 404 when missing or not owned (no oracle). */
export async function getConfig(
  id: unknown,
): Promise<ApiResponse<ConfigDetail>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const row = await fetchOwned(db, user, parsed.value);
  if (!row) return notFound("Configuration not found.");
  return ok(await getDetail(db, row));
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export async function createConfig(
  input: unknown,
): Promise<ApiResponse<ConfigDetail>> {
  const user = await requireUser();
  const parsed = parseOr(createConfigSchema, input);
  if (!parsed.ok) return parsed.error;
  const v = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  // Plan limit (honest enforcement of max_configs_per_user).
  const maxRaw = await getSystemSetting("max_configs_per_user");
  const max = typeof maxRaw === "number" && maxRaw > 0 ? maxRaw : 500;
  const { count } = await db
    .from("configurations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) >= max) {
    return err(
      ApiErrorCode.CONFLICT,
      `You have reached the limit of ${max} configurations.`,
    );
  }

  for (const table of ["projects", "collections"] as const) {
    const refErr = await assertOwnedRef(
      db,
      user,
      table,
      table === "projects" ? v.project_id : v.collection_id,
    );
    if (refErr) return refErr;
  }
  const tagCheck = await assertOwnedTags(db, user, v.tag_ids);
  if ("error" in tagCheck) return tagCheck.error;

  const { data, error } = await db
    .from("configurations")
    .insert({
      owner_id: user.id,
      name: v.name,
      description: v.description ?? null,
      config_type: v.config_type,
      environment: v.environment,
      project_id: v.project_id ?? null,
      collection_id: v.collection_id ?? null,
      data: v.data,
      status: v.status,
      expires_at: v.expires_at ?? null,
      notes: v.notes ?? null,
    })
    .select(DETAIL_SELECT)
    .single();
  if (error) return dbError(error);
  const created = data as JoinedRow;

  // Version-1 snapshot: keeps the invariant that every config has a v1 row.
  // On failure we roll back the config rather than leave history broken.
  const { error: vError } = await db.from("configuration_versions").insert({
    configuration_id: created.id,
    version_number: 1,
    data: created.data,
    change_summary: "Created",
    changed_by: user.id,
  });
  if (vError) {
    console.error("[aidify] v1 snapshot failed, rolling back:", vError.message);
    await db.from("configurations").delete().eq("id", created.id);
    return err(ApiErrorCode.INTERNAL, "Could not create the configuration.");
  }

  if (tagCheck.tags.length > 0) {
    try {
      await replaceTagAssignments(
        db,
        created.id,
        tagCheck.tags.map((t) => t.id),
      );
    } catch (caught) {
      console.error("[aidify] createConfig tag assign failed:", caught);
    }
  }

  await logActivity("config_created", "configuration", created.id, {
    name: created.name,
  });
  return ok(await getDetail(db, created));
}

/* ------------------------------------------------------------------ */
/* Update (atomic versioning via bump_config_version)                  */
/* ------------------------------------------------------------------ */

/**
 * Update a config with optimistic locking. `expectedVersion` must match the
 * current row version or a CONFLICT envelope is returned (client should
 * reload and retry). The update + version snapshot are atomic via the
 * `bump_config_version` SECURITY DEFINER function (migration 0004).
 */
export async function updateConfig(
  id: unknown,
  input: unknown,
  expectedVersion: unknown,
): Promise<ApiResponse<ConfigDetail>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const verParsed = parseOr(expectedVersionSchema, expectedVersion);
  if (!verParsed.ok) return verParsed.error;
  const inParsed = parseOr(updateConfigSchema, input);
  if (!inParsed.ok) return inParsed.error;
  const v = inParsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, idParsed.value);
  if (!current) return notFound("Configuration not found.");

  if ("project_id" in v) {
    const refErr = await assertOwnedRef(db, user, "projects", v.project_id);
    if (refErr) return refErr;
  }
  if ("collection_id" in v) {
    const refErr = await assertOwnedRef(db, user, "collections", v.collection_id);
    if (refErr) return refErr;
  }
  let newTagIds: string[] | null = null;
  if ("tag_ids" in v) {
    const tagCheck = await assertOwnedTags(db, user, v.tag_ids);
    if ("error" in tagCheck) return tagCheck.error;
    newTagIds = tagCheck.tags.map((t) => t.id);
  }

  // Only provided keys are sent; the function keeps current values otherwise.
  const fields: Record<string, string | null> = {};
  if ("name" in v && v.name !== undefined) fields.name = v.name;
  if ("description" in v) fields.description = v.description ?? null;
  if ("config_type" in v && v.config_type) fields.config_type = v.config_type;
  if ("environment" in v && v.environment) fields.environment = v.environment;
  if ("status" in v && v.status) fields.status = v.status;
  if ("project_id" in v) fields.project_id = v.project_id ?? null;
  if ("collection_id" in v) fields.collection_id = v.collection_id ?? null;
  if ("expires_at" in v) fields.expires_at = v.expires_at ?? null;
  if ("notes" in v) fields.notes = v.notes ?? null;

  const { data: newVersion, error: rpcError } = await db.rpc(
    "bump_config_version",
    {
      p_config_id: idParsed.value,
      p_actor: user.id,
      p_expected_version: verParsed.value,
      p_data: ("data" in v && v.data !== undefined ? v.data : current.data) as Record<string, unknown>,
      p_summary: v.change_summary ?? null,
      p_fields: fields,
    },
  );

  if (rpcError) {
    if (rpcError.message.includes("VERSION_CONFLICT")) {
      return err(
        ApiErrorCode.CONFLICT,
        "This configuration was modified elsewhere. Reload and try again.",
      );
    }
    if (rpcError.code === "P0002") return notFound("Configuration not found.");
    console.error("[aidify] bump_config_version failed:", rpcError.message);
    return err(ApiErrorCode.INTERNAL, "Could not update the configuration.");
  }

  if (newTagIds !== null) {
    try {
      await replaceTagAssignments(db, idParsed.value, newTagIds);
    } catch (caught) {
      console.error("[aidify] updateConfig tag replace failed:", caught);
    }
  }

  const updated = await fetchOwned(db, user, idParsed.value);
  if (!updated) return notFound("Configuration not found.");

  await logActivity("config_updated", "configuration", updated.id, {
    name: updated.name,
    version: newVersion as number,
  });
  return ok(await getDetail(db, updated));
}

/** Status toggle through the atomic version function (snapshot included). */
async function setStatusViaBump(
  user: User,
  db: SupabaseClient,
  id: string,
  status: "active" | "archived",
  summary: string,
  activityAction: string,
): Promise<ApiResponse<ConfigDetail>> {
  const current = await fetchOwned(db, user, id);
  if (!current) return notFound("Configuration not found.");

  const { error: rpcError } = await db.rpc("bump_config_version", {
    p_config_id: id,
    p_actor: user.id,
    p_expected_version: current.version,
    p_data: current.data as Record<string, unknown>,
    p_summary: summary,
    p_fields: { status },
  });
  if (rpcError) {
    console.error("[aidify] status bump failed:", rpcError.message);
    return err(ApiErrorCode.INTERNAL, "Could not update the configuration.");
  }

  const updated = await fetchOwned(db, user, id);
  if (!updated) return notFound("Configuration not found.");
  await logActivity(activityAction, "configuration", id, { name: updated.name });
  return ok(await getDetail(db, updated));
}

export async function archiveConfig(
  id: unknown,
): Promise<ApiResponse<ConfigDetail>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);
  return setStatusViaBump(
    user, db, parsed.value, "archived", "Archived", "config_archived",
  );
}

/**
 * Restore an archived config. It returns to `active` (the pre-archive status
 * is not tracked — documented choice).
 */
export async function restoreConfig(
  id: unknown,
): Promise<ApiResponse<ConfigDetail>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);
  return setStatusViaBump(
    user, db, parsed.value, "active", "Restored", "config_restored",
  );
}

/** Hard delete. Version rows and tag assignments cascade (FK). */
export async function deleteConfig(
  id: unknown,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, parsed.value);
  if (!current) return notFound("Configuration not found.");

  const { error } = await db
    .from("configurations")
    .delete()
    .eq("id", parsed.value)
    .eq("owner_id", user.id);
  if (error) return dbError(error);

  await logActivity("config_deleted", "configuration", parsed.value, {
    name: current.name,
  });
  return ok({ deleted: true });
}

/** Deep copy as a new draft (version reset to 1, tags carried over). */
export async function duplicateConfig(
  id: unknown,
): Promise<ApiResponse<ConfigDetail>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const source = await fetchOwned(db, user, parsed.value);
  if (!source) return notFound("Configuration not found.");
  const sourceTags = await tagsForConfigs(db, [source.id]);

  const baseName = `${source.name} (copy)`;
  const name =
    baseName.length > 200 ? `${baseName.slice(0, 197)}...` : baseName;

  const { data, error } = await db
    .from("configurations")
    .insert({
      owner_id: user.id,
      name,
      description: source.description,
      config_type: source.config_type,
      environment: source.environment,
      project_id: source.project_id,
      collection_id: source.collection_id,
      data: source.data,
      status: "draft",
      expires_at: source.expires_at,
      notes: source.notes,
    })
    .select(DETAIL_SELECT)
    .single();
  if (error) return dbError(error);
  const created = data as JoinedRow;

  const { error: vError } = await db.from("configuration_versions").insert({
    configuration_id: created.id,
    version_number: 1,
    data: created.data,
    change_summary: `Duplicated from "${source.name}"`,
    changed_by: user.id,
  });
  if (vError) {
    console.error("[aidify] duplicate v1 snapshot failed:", vError.message);
    await db.from("configurations").delete().eq("id", created.id);
    return err(ApiErrorCode.INTERNAL, "Could not duplicate the configuration.");
  }

  const tagIds = (sourceTags.get(source.id) ?? []).map((t) => t.id);
  if (tagIds.length > 0) {
    try {
      await replaceTagAssignments(db, created.id, tagIds);
    } catch (caught) {
      console.error("[aidify] duplicateConfig tag copy failed:", caught);
    }
  }

  await logActivity("config_duplicated", "configuration", created.id, {
    name: created.name,
    source: source.name,
  });
  return ok(await getDetail(db, created));
}

/* ------------------------------------------------------------------ */
/* Bulk                                                                */
/* ------------------------------------------------------------------ */

export async function bulkArchive(
  ids: unknown,
): Promise<
  ApiResponse<{ archived: number; failed: { id: string; message: string }[] }>
> {
  const user = await requireUser();
  const parsed = parseOr(uuidArraySchema, ids);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  let archived = 0;
  const failed: { id: string; message: string }[] = [];
  // Sequential: each archive is an atomic version bump; bulk volume is small.
  for (const id of parsed.value) {
    const result = await setStatusViaBump(
      user, db, id, "archived", "Bulk archived", "config_archived",
    );
    if (result.ok) archived += 1;
    else failed.push({ id, message: result.error.message });
  }
  return ok({ archived, failed });
}

export async function bulkDelete(
  ids: unknown,
): Promise<ApiResponse<{ deleted: number }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidArraySchema, ids);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("configurations")
    .delete()
    .in("id", parsed.value)
    .eq("owner_id", user.id)
    .select("id");
  if (error) return dbError(error);

  const deleted = (data ?? []).length;
  await logActivity("configs_bulk_deleted", "configuration", null, {
    count: deleted,
  });
  return ok({ deleted });
}

export interface ExportedConfig {
  name: string;
  description: string | null;
  config_type: string;
  environment: string;
  status: string;
  expires_at: string | null;
  notes: string | null;
  data: Record<string, unknown>;
  tags: string[];
  versions: {
    version_number: number;
    data: Record<string, unknown>;
    change_summary: string | null;
    created_at: string;
  }[];
}

export interface ExportPayload {
  format: "aidify-config-export";
  version: 1;
  exported_at: string;
  configs: ExportedConfig[];
}

/** JSON download payload for the selected configs (owner-scoped). */
export async function bulkExport(
  ids: unknown,
): Promise<ApiResponse<{ filename: string; payload: ExportPayload }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidArraySchema, ids);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("configurations")
    .select("*")
    .in("id", parsed.value)
    .eq("owner_id", user.id);
  if (error) return dbError(error);

  const rows = (data ?? []) as ConfigurationRow[];
  const tagMap = await tagsForConfigs(
    db,
    rows.map((r) => r.id),
  );
  const { data: versionRows } = await db
    .from("configuration_versions")
    .select("configuration_id, version_number, data, change_summary, created_at")
    .in(
      "configuration_id",
      rows.map((r) => r.id),
    )
    .order("version_number", { ascending: true })
    .limit(5000);

  const versionsByConfig = new Map<string, ExportedConfig["versions"]>();
  for (const vr of (versionRows ?? []) as {
    configuration_id: string;
    version_number: number;
    data: Record<string, unknown>;
    change_summary: string | null;
    created_at: string;
  }[]) {
    const list = versionsByConfig.get(vr.configuration_id) ?? [];
    list.push({
      version_number: vr.version_number,
      data: vr.data,
      change_summary: vr.change_summary,
      created_at: vr.created_at,
    });
    versionsByConfig.set(vr.configuration_id, list);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return ok({
    filename: `aidify-export-${stamp}.json`,
    payload: {
      format: "aidify-config-export",
      version: 1,
      exported_at: new Date().toISOString(),
      configs: rows.map((r) => ({
        name: r.name,
        description: r.description,
        config_type: r.config_type,
        environment: r.environment,
        status: r.status,
        expires_at: r.expires_at,
        notes: r.notes,
        data: r.data,
        tags: (tagMap.get(r.id) ?? []).map((t) => t.name),
        versions: versionsByConfig.get(r.id) ?? [],
      })),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Import (validated, never silent overwrite)                          */
/* ------------------------------------------------------------------ */

export interface ImportValidation {
  valid: boolean;
  errors: { index: number; message: string }[];
  conflicts: ImportConflict[];
}

/**
 * Validate an import payload WITHOUT writing anything.
 * `conflicts` lists names that collide with the user's existing configs —
 * the UI must show a conflict dialog (rename / skip / replace); the import
 * never silently overwrites.
 */
export async function validateImport(
  json: unknown,
): Promise<ApiResponse<ImportValidation>> {
  const user = await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const rawItems = Array.isArray(json)
    ? json
    : (json as { configs?: unknown } | null)?.configs;
  if (!Array.isArray(rawItems)) {
    return ok({
      valid: false,
      errors: [
        {
          index: -1,
          message: "Import must be a JSON array or an object with a configs array.",
        },
      ],
      conflicts: [],
    });
  }

  const { data: existing } = await db
    .from("configurations")
    .select("id, name")
    .eq("owner_id", user.id)
    .limit(5000);
  const existingByName = new Map<string, string>();
  for (const row of (existing ?? []) as { id: string; name: string }[]) {
    existingByName.set(row.name.toLowerCase(), row.id);
  }

  const detection = detectImportConflicts(rawItems, existingByName);

  return ok({
    valid: detection.valid,
    errors: detection.errors,
    conflicts: detection.conflicts,
  });
}

export interface ImportResult {
  imported: number;
  skipped: number;
  renamed: number;
  replaced: number;
  errors: { index: number; message: string }[];
}

export async function importConfigs(
  items: unknown,
  options: unknown,
): Promise<ApiResponse<ImportResult>> {
  const user = await requireUser();
  const conflictParsed = parseOr(importConflictSchema, options);
  if (!conflictParsed.ok) return conflictParsed.error;
  const onConflict: ImportConflictMode = conflictParsed.value;

  if (!Array.isArray(items)) {
    return err(ApiErrorCode.VALIDATION, "Import items must be an array.");
  }
  if (items.length > 200) {
    return err(ApiErrorCode.VALIDATION, "Cannot import more than 200 configs at once.");
  }

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data: existing } = await db
    .from("configurations")
    .select("id, name")
    .eq("owner_id", user.id)
    .limit(5000);
  const byName = new Map<string, string>();
  for (const row of (existing ?? []) as { id: string; name: string }[]) {
    byName.set(row.name.toLowerCase(), row.id);
  }

  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    renamed: 0,
    replaced: 0,
    errors: [],
  };

  for (let index = 0; index < items.length; index++) {
    const parsed = createConfigSchema.safeParse(items[index]);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      result.errors.push({
        index,
        message: first?.message ?? "Invalid configuration.",
      });
      continue;
    }
    const v = parsed.data;
    const action = resolveImportAction(v.name, onConflict, byName);

    let finalName = v.name;
    if (action.kind === "skip") {
      result.skipped += 1;
      continue;
    }
    if (action.kind === "replace") {
      const { error: delError } = await db
        .from("configurations")
        .delete()
        .eq("id", action.existingId)
        .eq("owner_id", user.id);
      if (delError) {
        result.errors.push({
          index,
          message: "Could not replace the existing config.",
        });
        continue;
      }
      byName.delete(v.name.toLowerCase());
      result.replaced += 1;
    } else if (action.kind === "rename") {
      finalName = action.name;
      byName.set(finalName.toLowerCase(), "pending");
      result.renamed += 1;
    }

    const { data, error } = await db
      .from("configurations")
      .insert({
        owner_id: user.id,
        name: finalName,
        description: v.description ?? null,
        config_type: v.config_type,
        environment: v.environment,
        project_id: null,
        collection_id: null,
        data: v.data,
        status: v.status,
        expires_at: v.expires_at ?? null,
        notes: v.notes ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      let message = "Insert failed.";
      if (error) {
        const mapped = dbError(error);
        if (!mapped.ok) message = mapped.error.message;
      }
      result.errors.push({ index, message });
      continue;
    }

    const newId = (data as { id: string }).id;
    byName.set(finalName.toLowerCase(), newId);
    await db.from("configuration_versions").insert({
      configuration_id: newId,
      version_number: 1,
      data: v.data,
      change_summary: "Imported",
      changed_by: user.id,
    });
    result.imported += 1;
  }

  await logActivity("configs_imported", "configuration", null, {
    imported: result.imported,
    skipped: result.skipped,
  });
  return ok(result);
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

/** Version history for one config, newest first (owner-checked). */
export async function getVersions(
  configId: unknown,
): Promise<ApiResponse<ConfigurationVersionRow[]>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, configId);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const owned = await fetchOwned(db, user, parsed.value);
  if (!owned) return notFound("Configuration not found.");

  const { data, error } = await db
    .from("configuration_versions")
    .select("*")
    .eq("configuration_id", parsed.value)
    .order("version_number", { ascending: false });
  if (error) return dbError(error);
  return ok((data ?? []) as ConfigurationVersionRow[]);
}

/** A single version snapshot (owner-checked). */
export async function getVersion(
  configId: unknown,
  versionNumber: unknown,
): Promise<ApiResponse<ConfigurationVersionRow>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, configId);
  if (!idParsed.ok) return idParsed.error;
  const numParsed = parseOr(z.coerce.number().int().min(1), versionNumber);
  if (!numParsed.ok) return numParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const owned = await fetchOwned(db, user, idParsed.value);
  if (!owned) return notFound("Configuration not found.");

  const { data, error } = await db
    .from("configuration_versions")
    .select("*")
    .eq("configuration_id", idParsed.value)
    .eq("version_number", numParsed.value)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return notFound("Version not found.");
  return ok(data as ConfigurationVersionRow);
}

export interface VersionDiff {
  configId: string;
  versionA: number;
  versionB: number;
  entries: DiffEntry[];
  summary: { added: number; removed: number; changed: number; total: number };
}

/** Structural diff between two version snapshots (owner-checked). */
export async function diffVersions(
  configId: unknown,
  versionA: unknown,
  versionB: unknown,
): Promise<ApiResponse<VersionDiff>> {
  const aRes = await getVersion(configId, versionA);
  if (!aRes.ok) return aRes;
  const bRes = await getVersion(configId, versionB);
  if (!bRes.ok) return bRes;

  const entries = diffJson(
    aRes.data.data as Parameters<typeof diffJson>[0],
    bRes.data.data as Parameters<typeof diffJson>[1],
  );
  const idParsed = parseOr(uuidSchema, configId);
  const configIdStr = idParsed.ok ? idParsed.value : "";
  return ok({
    configId: configIdStr,
    versionA: aRes.data.version_number,
    versionB: bRes.data.version_number,
    entries,
    summary: diffSummary(entries),
  });
}

/**
 * Restore a prior version. ALWAYS creates a NEW version via the atomic
 * `restore_config_version` function — history is never rewritten or
 * destroyed.
 */
export async function restoreVersion(
  configId: unknown,
  versionNumber: unknown,
  summary: unknown,
): Promise<ApiResponse<{ version: number }>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, configId);
  if (!idParsed.ok) return idParsed.error;
  const numParsed = parseOr(z.coerce.number().int().min(1), versionNumber);
  if (!numParsed.ok) return numParsed.error;
  const summaryParsed = parseOr(
    z.string().trim().max(500).nullable().optional(),
    summary,
  );
  if (!summaryParsed.ok) return summaryParsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const owned = await fetchOwned(db, user, idParsed.value);
  if (!owned) return notFound("Configuration not found.");

  const { data: newVersion, error: rpcError } = await db.rpc(
    "restore_config_version",
    {
      p_config_id: idParsed.value,
      p_actor: user.id,
      p_version_number: numParsed.value,
      p_summary: summaryParsed.value ?? null,
    },
  );
  if (rpcError) {
    if (rpcError.code === "P0002") return notFound("Version not found.");
    console.error("[aidify] restore_config_version failed:", rpcError.message);
    return err(ApiErrorCode.INTERNAL, "Could not restore the version.");
  }

  await logActivity("config_version_restored", "configuration", idParsed.value, {
    name: owned.name,
    from_version: numParsed.value,
    new_version: newVersion as number,
  });
  return ok({ version: newVersion as number });
}
