"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Alert, Button, Checkbox, FormError, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { setUserRolesAction } from "@/actions/admin";
import type { RoleRow } from "@/app/admin/_lib/queries";

/**
 * Role assignment for one user. Every change requires a reason and is
 * audit-logged server-side. Changing your own roles is hard-blocked both
 * here (disabled UI with an explanation) and in the DAL (rejects it).
 */
export function RoleManager({
  userId,
  username,
  currentRoleNames,
  allRoles,
  isSelf,
}: {
  userId: string;
  username: string;
  currentRoleNames: string[];
  allRoles: RoleRow[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initial = React.useMemo(
    () => new Set(allRoles.filter((r) => currentRoleNames.includes(r.name)).map((r) => r.id)),
    [allRoles, currentRoleNames],
  );
  const [selected, setSelected] = React.useState<Set<string>>(initial);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reasonTouched, setReasonTouched] = React.useState(false);

  const dirty =
    selected.size !== initial.size || [...selected].some((id) => !initial.has(id));

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    setReasonTouched(true);
    if (reason.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const result = await setUserRolesAction(userId, [...selected], reason.trim());
    setBusy(false);
    if (result.ok) {
      toast({
        title: "Roles updated",
        description: `${username} now has: ${result.data.roles.join(", ") || "no roles"}.`,
        variant: "success",
      });
      setReason("");
      setReasonTouched(false);
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  if (isSelf) {
    return (
      <Alert variant="warning" title="You cannot change your own roles">
        <span className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Role changes on your own account are blocked — including here and in
          the data layer — to prevent accidental lockout or self-escalation.
          Ask another administrator to change your roles.
        </span>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {allRoles.map((role) => (
          <label
            key={role.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-3 transition-colors hover:border-[var(--aidify-border-strong)]"
          >
            <Checkbox
              checked={selected.has(role.id)}
              onCheckedChange={(checked) => toggle(role.id, checked)}
              aria-label={`Grant ${role.name} role`}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--aidify-text)]">
                {role.name}
              </span>
              {role.description && (
                <span className="mt-0.5 block text-xs text-[var(--aidify-secondary)]">
                  {role.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role-reason">Reason (recorded in the audit log)</Label>
        <Textarea
          id="role-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are these roles changing?"
          rows={2}
          maxLength={500}
        />
        <FormError message={reasonTouched && reason.trim().length === 0 ? "A reason is required." : null} />
      </div>

      <FormError message={error} />

      <Button onClick={save} loading={busy} disabled={!dirty}>
        Save roles
      </Button>
    </div>
  );
}
