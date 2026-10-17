"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  RotateCcw,
  Copy,
  Check,
  QrCode,
} from "lucide-react";
import type { ProxyUserRow } from "@/lib/dal/proxy-users";
import {
  createProxyUserAction,
  updateProxyUserAction,
  deleteProxyUserAction,
  resetProxyUsageAction,
} from "@/actions/proxy-users";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  EmptyState,
  Alert,
  FormError,
} from "@/components/ui";
import { useToast } from "@/components/toast";

const GB = 1073741824;

function formatBytes(bytes: number): string {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function usedOf(u: ProxyUserRow): number {
  return Number(u.total_up || 0) + Number(u.total_down || 0);
}

type Status = "active" | "disabled" | "expired" | "quota_exceeded";

function statusOf(u: ProxyUserRow): Status {
  if (!u.enabled) return "disabled";
  if (u.expires_at && new Date(u.expires_at).getTime() < Date.now())
    return "expired";
  if (u.data_limit != null && usedOf(u) >= Number(u.data_limit))
    return "quota_exceeded";
  return "active";
}

const STATUS_META: Record<Status, { variant: "success" | "muted" | "warning" | "error"; label: string }> = {
  active: { variant: "success", label: "Active" },
  disabled: { variant: "muted", label: "Disabled" },
  expired: { variant: "error", label: "Expired" },
  quota_exceeded: { variant: "warning", label: "Quota used" },
};

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function UsageBar({ user }: { user: ProxyUserRow }) {
  const used = usedOf(user);
  if (user.data_limit == null) {
    return (
      <div>
        <div className="font-mono text-xs">{formatBytes(used)}</div>
        <div className="text-[11px] text-[var(--aidify-secondary)]">Unlimited</div>
      </div>
    );
  }
  const limit = Number(user.data_limit);
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color =
    pct >= 100
      ? "bg-[var(--aidify-error)]"
      : pct >= 80
        ? "bg-[var(--aidify-warning)]"
        : "bg-[var(--aidify-success)]";
  return (
    <div className="min-w-28">
      <div className="font-mono text-xs">
        {formatBytes(used)}{" "}
        <span className="text-[var(--aidify-secondary)]">
          / {formatBytes(limit)}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ExpiryCell({ user }: { user: ProxyUserRow }) {
  const d = daysLeft(user.expires_at);
  if (d === null)
    return <span className="text-[var(--aidify-secondary)]">Never</span>;
  const date = new Date(user.expires_at!).toLocaleDateString();
  if (d < 0) return <Badge variant="error">Expired</Badge>;
  return (
    <div>
      <div className="text-xs">{date}</div>
      <Badge variant={d <= 7 ? "warning" : "info"} className="mt-1">
        {d === 0 ? "Ends today" : `${d}d left`}
      </Badge>
    </div>
  );
}

interface FormState {
  name: string;
  limitGb: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = { name: "", limitGb: "", expiresAt: "" };

function UserForm({
  initial,
  onSubmit,
  submitting,
  error,
}: {
  initial: FormState;
  onSubmit: (f: FormState) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = React.useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <Label htmlFor="pu-name">Name</Label>
        <Input
          id="pu-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Ava's phone"
          required
          maxLength={120}
        />
      </div>
      <div>
        <Label htmlFor="pu-limit">Data limit (GB — empty = unlimited)</Label>
        <Input
          id="pu-limit"
          value={form.limitGb}
          onChange={(e) => setForm({ ...form, limitGb: e.target.value })}
          placeholder="e.g. 50"
          inputMode="decimal"
        />
      </div>
      <div>
        <Label htmlFor="pu-exp">Expiry date (empty = never)</Label>
        <Input
          id="pu-exp"
          type="date"
          value={form.expiresAt}
          onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
        />
      </div>
      {error && <FormError message={error} />}
      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UsersClient({ initial }: { initial: ProxyUserRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = React.useState(initial);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<ProxyUserRow | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  async function refresh() {
    router.refresh();
  }

  function parseLimit(v: string): number | null | "invalid" {
    const t = v.trim();
    if (t === "") return null;
    const n = parseFloat(t);
    if (isNaN(n) || n <= 0) return "invalid";
    return Math.round(n * GB);
  }

  async function handleCreate(f: FormState) {
    const limit = parseLimit(f.limitGb);
    if (limit === "invalid") {
      setFormError("Data limit must be a positive number.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await createProxyUserAction({
      name: f.name.trim(),
      data_limit_gb:
        limit == null ? null : limit / GB,
      expires_at: f.expiresAt
        ? new Date(f.expiresAt + "T00:00:00").toISOString()
        : null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setUsers([res.data, ...users]);
    setCreateOpen(false);
    toast({ title: "User created" });
    refresh();
  }

  async function handleEdit(f: FormState) {
    if (!editUser) return;
    const limit = parseLimit(f.limitGb);
    if (limit === "invalid") {
      setFormError("Data limit must be a positive number.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const res = await updateProxyUserAction(editUser.id, {
      name: f.name.trim(),
      data_limit_gb: limit == null ? null : limit / GB,
      expires_at: f.expiresAt
        ? new Date(f.expiresAt + "T00:00:00").toISOString()
        : null,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setUsers(users.map((u) => (u.id === res.data.id ? res.data : u)));
    setEditUser(null);
    toast({ title: "User updated" });
    refresh();
  }

  async function handleToggle(u: ProxyUserRow) {
    const res = await updateProxyUserAction(u.id, { enabled: !u.enabled });
    if (!res.ok) {
      toast({ title: res.error.message, variant: "error" });
      return;
    }
    setUsers(users.map((x) => (x.id === u.id ? res.data : u)));
    toast({ title: u.enabled ? "User disabled" : "User enabled" });
    refresh();
  }

  async function handleReset(u: ProxyUserRow) {
    if (!confirm(`Reset data usage for "${u.name}"?`)) return;
    const res = await resetProxyUsageAction(u.id);
    if (!res.ok) {
      toast({ title: res.error.message, variant: "error" });
      return;
    }
    setUsers(users.map((x) => (x.id === u.id ? res.data : u)));
    toast({ title: "Usage reset" });
    refresh();
  }

  async function handleDelete(u: ProxyUserRow) {
    if (!confirm(`Delete "${u.name}"? Their configs will stop working.`))
      return;
    const res = await deleteProxyUserAction(u.id);
    if (!res.ok) {
      toast({ title: res.error.message, variant: "error" });
      return;
    }
    setUsers(users.filter((x) => x.id !== u.id));
    toast({ title: "User deleted" });
    refresh();
  }

  function copyUuid(uuid: string) {
    navigator.clipboard.writeText(uuid).then(() => {
      setCopied(uuid);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setFormError(null); setCreateOpen(true); }}>
          <Plus className="size-4" /> New user
        </Button>
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>
              A UUID and Trojan password are generated automatically.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            submitting={submitting}
            error={formError}
          />
        </DialogContent>
      </Dialog>

      {users.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No users yet"
              description="Create your first proxy user to get started."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Data usage</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const s = statusOf(u);
                  const meta = STATUS_META[s];
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Link
                          href={`/app/users/${u.id}`}
                          className="font-medium hover:underline"
                        >
                          {u.name}
                        </Link>
                        <button
                          onClick={() => copyUuid(u.uuid)}
                          className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]"
                          title="Copy full UUID"
                        >
                          {u.uuid.slice(0, 13)}…
                          {copied === u.uuid ? (
                            <Check className="size-3" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <UsageBar user={u} />
                      </TableCell>
                      <TableCell>
                        <ExpiryCell user={u} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Link href={`/app/users/${u.id}`}>
                            <Button variant="ghost" size="icon" title="Configs">
                              <QrCode className="size-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => {
                              setFormError(null);
                              setEditUser(u);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={u.enabled ? "Disable" : "Enable"}
                            onClick={() => handleToggle(u)}
                          >
                            <Power className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reset usage"
                            onClick={() => handleReset(u)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => handleDelete(u)}
                          >
                            <Trash2 className="size-4 text-[var(--aidify-error)]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={editUser != null} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              {editUser && (
                <>
                  Usage so far: {formatBytes(usedOf(editUser))}
                  {editUser.data_limit != null &&
                    ` of ${formatBytes(Number(editUser.data_limit))}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <UserForm
              key={editUser.id}
              initial={{
                name: editUser.name,
                limitGb:
                  editUser.data_limit != null
                    ? String(Number(editUser.data_limit) / GB)
                    : "",
                expiresAt: editUser.expires_at
                  ? editUser.expires_at.slice(0, 10)
                  : "",
              }}
              onSubmit={handleEdit}
              submitting={submitting}
              error={formError}
            />
          )}
        </DialogContent>
      </Dialog>

      {(users.some((u) => statusOf(u) === "expired") ||
        users.some((u) => statusOf(u) === "quota_exceeded")) && (
        <Alert variant="warning" className="mt-4">
          Some users are expired or out of data — their configs and
          subscriptions are blocked automatically.
        </Alert>
      )}
    </div>
  );
}
