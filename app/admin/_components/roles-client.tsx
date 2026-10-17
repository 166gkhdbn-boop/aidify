"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, UserMinus } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { getUserDetailAction, setUserRolesAction } from "@/actions/admin";
import type { RoleWithMembers } from "@/app/admin/_lib/queries";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Role cards with member counts and member management. Removing a member's
 * role replaces their role set (minus that role) via setUserRoles — which
 * requires a reason, is audit-logged, and hard-blocks self-targeting.
 */
export function RolesClient({ roles }: { roles: RoleWithMembers[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<{
    roleId: string;
    roleName: string;
    userId: string;
    username: string;
    remainingRoleIds: string[] | null;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const roleIdByName = React.useMemo(
    () => new Map(roles.map((r) => [r.name, r.id])),
    [roles],
  );

  async function openRemove(roleId: string, roleName: string, userId: string, username: string) {
    setError(null);
    setBusy(true);
    // Load the member's current roles so we can remove just this one.
    const detail = await getUserDetailAction(userId);
    setBusy(false);
    if (!detail.ok) {
      toast({ title: "Could not load user", description: detail.error.message, variant: "error" });
      return;
    }
    const remaining = detail.data.roles
      .filter((name) => name !== roleName)
      .map((name) => roleIdByName.get(name))
      .filter((id): id is string => !!id);
    setRemoving({ roleId, roleName, userId, username, remainingRoleIds: remaining });
  }

  async function confirmRemove(reason: string | null) {
    if (!removing || !reason) return;
    setBusy(true);
    setError(null);
    const result = await setUserRolesAction(
      removing.userId,
      removing.remainingRoleIds ?? [],
      reason,
    );
    setBusy(false);
    if (result.ok) {
      setRemoving(null);
      toast({
        title: "Role removed",
        description: `@${removing.username} no longer has the ${removing.roleName} role.`,
        variant: "success",
      });
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Audited role changes">
        Every grant and removal requires a reason and is written to the audit
        log. You cannot change your own roles — manage them from another
        administrator&apos;s account.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        {roles.map((role) => {
          const isOpen = expanded === role.id;
          return (
            <Card key={role.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--aidify-violet)]/30 bg-[var(--aidify-violet)]/15">
                    <KeyRound className="size-5 text-[var(--aidify-violet)]" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    <CardDescription>
                      {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                </div>
                {role.description && (
                  <p className="mt-2 text-sm text-[var(--aidify-secondary)]">{role.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(isOpen ? null : role.id)}
                  aria-expanded={isOpen}
                  className="mb-2"
                >
                  {isOpen ? "Hide members" : "Show members"}
                  <ChevronDown
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </Button>
                {isOpen && (
                  role.members.length === 0 ? (
                    <p className="py-2 text-sm text-[var(--aidify-secondary)]">
                      No members hold this role.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--aidify-border)]">
                      {role.members.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 py-2">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/admin/users/${m.id}`}
                              className="truncate text-sm font-medium text-[var(--aidify-cyan)] hover:underline"
                            >
                              @{m.username}
                            </Link>
                            {m.display_name && (
                              <p className="truncate text-xs text-[var(--aidify-secondary)]">
                                {m.display_name}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openRemove(role.id, role.name, m.id, m.username)}
                            aria-label={`Remove ${role.name} role from ${m.username}`}
                            title={`Remove ${role.name} role`}
                          >
                            <UserMinus aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setRemoving(null);
              setError(null);
            }
          }}
          title={`Remove ${removing.roleName} from @${removing.username}?`}
          description="The user's remaining roles stay untouched. This change is audit-logged."
          confirmLabel="Remove role"
          destructive
          requireReason
          busy={busy}
          error={error}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}
