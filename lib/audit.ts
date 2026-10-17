import "server-only";

import { createAdminClient } from "./supabase/admin";
import { getSessionUser } from "./auth";
import { maskSensitive } from "./mask";

/**
 * Admin audit trail writer (brief §10/§11).
 *
 * `audit_logs` is append-only (a DB trigger rejects UPDATE/DELETE for every
 * role) and has no user write policies, so all writes go through the
 * service-role client. The actor is derived from the verified session unless
 * an explicit actorId is passed (e.g. account deletion flows). Metadata is
 * masked for secrets and must never contain full config `data` — log ids and
 * names only. Best-effort: never throws.
 */

export interface AuditLogOptions {
  reason?: string | null;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}

export async function auditLog(
  action: string,
  targetType: string,
  targetId: string | null,
  options: AuditLogOptions = {},
): Promise<void> {
  try {
    const sessionUser = options.actorId ?? (await getSessionUser())?.id ?? null;
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: sessionUser,
      action,
      target_type: targetType,
      target_id: targetId,
      reason: options.reason ?? null,
      metadata: maskSensitive(options.metadata ?? {}),
    });
    if (error) {
      console.error("[aidify] auditLog failed:", error.message);
    }
  } catch (caught) {
    console.error("[aidify] auditLog failed:", caught);
  }
}
