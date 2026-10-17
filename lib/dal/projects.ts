import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  projectSchema,
  updateProjectSchema,
  listQuerySchema,
  uuidSchema,
  type ProjectInput,
  type UpdateProjectInput,
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
import type { PageResult, ProjectRow } from "./types";

/**
 * Projects data-access layer.
 *
 * Projects are simple owner-scoped groupings. Deleting a project never
 * deletes configs or collections — their `project_id` is set to NULL by the
 * database foreign keys (ON DELETE SET NULL).
 */

export interface ProjectWithCount extends ProjectRow {
  config_count: number;
}

async function fetchOwned(
  db: SupabaseClient,
  user: User,
  id: string,
): Promise<ProjectRow | null> {
  const { data, error } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[aidify] project fetchOwned failed:", error.message);
    return null;
  }
  return (data as ProjectRow | null) ?? null;
}

export async function listProjects(
  query: unknown,
): Promise<ApiResponse<PageResult<ProjectWithCount>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;
  const q = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  let builder = db
    .from("projects")
    .select("*", { count: "exact" })
    .eq("owner_id", user.id);
  if (q.search) {
    builder = builder.ilike("name", `%${escapeLike(q.search)}%`);
  }
  builder = builder.order("name", { ascending: true });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as ProjectRow[];
  const counts = new Map<string, number>();
  if (rows.length > 0) {
    const { data: configs } = await db
      .from("configurations")
      .select("project_id")
      .eq("owner_id", user.id)
      .not("project_id", "is", null)
      .limit(5000);
    for (const row of (configs ?? []) as { project_id: string | null }[]) {
      if (!row.project_id) continue;
      counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
    }
  }

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

export async function getProject(
  id: unknown,
): Promise<ApiResponse<ProjectWithCount>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const row = await fetchOwned(db, user, parsed.value);
  if (!row) return notFound("Project not found.");

  const { count } = await db
    .from("configurations")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("project_id", row.id);

  return ok({ ...row, config_count: count ?? 0 });
}

export async function createProject(
  input: ProjectInput,
): Promise<ApiResponse<ProjectRow>> {
  const user = await requireUser();
  const parsed = parseOr(projectSchema, input);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("projects")
    .insert({
      owner_id: user.id,
      name: parsed.value.name,
      description: parsed.value.description ?? null,
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  const created = data as ProjectRow;
  await logActivity("project_created", "project", created.id, {
    name: created.name,
  });
  return ok(created);
}

export async function updateProject(
  id: unknown,
  input: UpdateProjectInput,
): Promise<ApiResponse<ProjectRow>> {
  const user = await requireUser();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const inParsed = parseOr(updateProjectSchema, input);
  if (!inParsed.ok) return inParsed.error;
  const v = inParsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, idParsed.value);
  if (!current) return notFound("Project not found.");

  const patch: Record<string, string | null> = {};
  if ("name" in v && v.name !== undefined) patch.name = v.name;
  if ("description" in v) patch.description = v.description ?? null;

  const { data, error } = await db
    .from("projects")
    .update(patch)
    .eq("id", idParsed.value)
    .eq("owner_id", user.id)
    .select("*")
    .single();
  if (error) return dbError(error);

  const updated = data as ProjectRow;
  await logActivity("project_updated", "project", updated.id, {
    name: updated.name,
  });
  return ok(updated);
}

/**
 * Delete a project. Configs and collections keep existing — their
 * `project_id` becomes NULL via ON DELETE SET NULL foreign keys.
 */
export async function deleteProject(
  id: unknown,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const user = await requireUser();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const current = await fetchOwned(db, user, parsed.value);
  if (!current) return notFound("Project not found.");

  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", parsed.value)
    .eq("owner_id", user.id);
  if (error) return dbError(error);

  await logActivity("project_deleted", "project", parsed.value, {
    name: current.name,
  });
  return ok({ deleted: true });
}
