"use client";

import * as React from "react";
import {
  Eye,
  EyeOff,
  History,
  RotateCcw,
  GitCompare,
} from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  EmptyState,
  Checkbox,
  Switch,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";
import { JsonView } from "@/components/json-view";
import { useToast } from "@/components/toast";
import {
  getVersionsAction,
  diffVersionsAction,
  restoreVersionAction,
} from "@/actions/configs";
import { listActivityAction } from "@/actions/activity";
import type {
  ConfigDetail,
  ConfigurationVersionRow,
  ActivityLogRow,
} from "@/lib/dal/types";
import { ConfirmDialog } from "@/app/app/_components/confirm-dialog";
import { timeAgo } from "@/app/app/_components/notification-bell";
import { SECRET_MASK_KEYS } from "@/app/app/configs/_components/mask-keys";

interface ConfigDetailTabsProps {
  config: ConfigDetail;
  initialVersions: ConfigurationVersionRow[];
  maskSecretsDefault: boolean;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">
        {label}
      </p>
      <div className="mt-1 text-sm text-[var(--aidify-text)]">{children}</div>
    </div>
  );
}

/** Tabs for the configuration detail page. */
export function ConfigDetailTabs({
  config,
  initialVersions,
  maskSecretsDefault,
}: ConfigDetailTabsProps) {
  const { toast } = useToast();
  const [masked, setMasked] = React.useState(maskSecretsDefault);
  const [versions, setVersions] = React.useState(initialVersions);
  const [selected, setSelected] = React.useState<number[]>([]);
  const [diff, setDiff] = React.useState<{
    versionA: number;
    versionB: number;
    entries: { path: string; type: string; oldValue?: unknown; newValue?: unknown }[];
    summary: { added: number; removed: number; changed: number; total: number };
  } | null>(null);
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [restoreTarget, setRestoreTarget] = React.useState<ConfigurationVersionRow | null>(null);
  const [activity, setActivity] = React.useState<ActivityLogRow[] | null>(null);

  const reloadVersions = async () => {
    const res = await getVersionsAction(config.id);
    if (res.ok) setVersions(res.data);
  };

  const toggleVersion = (n: number) =>
    setSelected((prev) => {
      if (prev.includes(n)) return prev.filter((v) => v !== n);
      if (prev.length >= 2) return [prev[1]!, n];
      return [...prev, n];
    });

  const runDiff = async () => {
    if (selected.length !== 2) return;
    const [a, b] = [...selected].sort((x, y) => x - y);
    setDiffLoading(true);
    const res = await diffVersionsAction(config.id, a!, b!);
    setDiffLoading(false);
    if (res.ok) {
      setDiff(res.data);
    } else {
      toast({ title: "Diff failed", description: res.error.message, variant: "error" });
    }
  };

  const doRestore = async () => {
    if (!restoreTarget) return;
    const res = await restoreVersionAction(
      config.id,
      restoreTarget.version_number,
      `Restored from version ${restoreTarget.version_number}`,
    );
    setRestoreTarget(null);
    if (res.ok) {
      toast({
        title: "Version restored",
        description: `Restored as new version ${res.data.version}. History was preserved.`,
        variant: "success",
      });
      await reloadVersions();
    } else {
      toast({ title: "Restore failed", description: res.error.message, variant: "error" });
    }
  };

  const loadActivity = async () => {
    const res = await listActivityAction({ page: 1, pageSize: 100 });
    if (res.ok) {
      setActivity(res.data.items.filter((a) => a.resource_id === config.id));
    } else {
      setActivity([]);
    }
  };

  const renderValue = (v: unknown) => {
    if (v === undefined) return <span className="text-[var(--aidify-secondary)]/50">—</span>;
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return <code className="break-all font-mono text-xs">{s.length > 120 ? `${s.slice(0, 120)}…` : s}</code>;
  };

  return (
    <Tabs defaultValue="overview" onValueChange={(v) => v === "activity" && activity === null && void loadActivity()}>
      <TabsList aria-label="Configuration sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
        <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      {/* ------------------------------- Overview ------------------------------ */}
      <TabsContent value="overview" className="mt-4 space-y-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.description ? (
              <p className="text-sm text-[var(--aidify-text)]">{config.description}</p>
            ) : (
              <p className="text-sm italic text-[var(--aidify-secondary)]">No description.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetaItem label="Type">{config.config_type}</MetaItem>
              <MetaItem label="Environment">{config.environment}</MetaItem>
              <MetaItem label="Project">{config.project?.name ?? "—"}</MetaItem>
              <MetaItem label="Collection">{config.collection?.name ?? "—"}</MetaItem>
              <MetaItem label="Version">v{config.version}</MetaItem>
              <MetaItem label="Status">
                <Badge variant={config.status === "active" ? "success" : config.status === "draft" ? "warning" : "muted"}>
                  {config.status}
                </Badge>
              </MetaItem>
              <MetaItem label="Expires">
                {config.expires_at ? formatDateTime(config.expires_at) : "Never"}
              </MetaItem>
              <MetaItem label="Updated">{formatDateTime(config.updated_at)}</MetaItem>
            </div>
            {config.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.tags.map((t) => (
                  <Badge key={t.id} variant="violet">
                    {t.name}
                  </Badge>
                ))}
              </div>
            )}
            {config.notes && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-[var(--aidify-text)]">{config.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* --------------------------------- Data -------------------------------- */}
      <TabsContent value="data" className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-[var(--aidify-secondary)]">
            Version {config.version} snapshot
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--aidify-secondary)]">
            <Switch checked={masked} onCheckedChange={setMasked} aria-label="Mask secrets" />
            {masked ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            Mask secrets
          </label>
        </div>
        <JsonView data={config.data} maskKeys={masked ? SECRET_MASK_KEYS : undefined} />
      </TabsContent>

      {/* ------------------------------- Versions ------------------------------ */}
      <TabsContent value="versions" className="mt-4 space-y-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-[var(--aidify-secondary)]" aria-hidden="true" />
              Version history
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--aidify-secondary)]">
                {selected.length === 2 ? "2 selected" : "Select two versions to compare"}
              </span>
              <Button size="sm" variant="secondary" disabled={selected.length !== 2 || diffLoading} onClick={runDiff}>
                <GitCompare aria-hidden="true" />
                {diffLoading ? "Comparing…" : "Compare"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <EmptyState title="No versions" description="Version history will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(v.version_number)}
                            onCheckedChange={() => toggleVersion(v.version_number)}
                            aria-label={`Select version ${v.version_number}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.version_number === config.version ? "success" : "muted"}>
                            v{v.version_number}
                            {v.version_number === config.version ? " · current" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[var(--aidify-secondary)]">
                          {v.change_summary ?? "—"}
                        </TableCell>
                        <TableCell className="text-[var(--aidify-secondary)]">
                          {formatDateTime(v.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.version_number !== config.version && (
                            <Button size="sm" variant="ghost" onClick={() => setRestoreTarget(v)}>
                              <RotateCcw aria-hidden="true" />
                              Restore
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {diff && (
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">
                Diff: v{diff.versionA} → v{diff.versionB}
                <span className="ml-3 text-xs font-normal text-[var(--aidify-secondary)]">
                  {diff.summary.added} added · {diff.summary.removed} removed · {diff.summary.changed} changed
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diff.entries.length === 0 ? (
                <EmptyState title="No differences" description="The two versions have identical data." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Path</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>v{diff.versionA}</TableHead>
                        <TableHead>v{diff.versionB}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diff.entries.map((e, i) => (
                        <TableRow key={i} className="align-top">
                          <TableCell className="font-mono text-xs text-[var(--aidify-blue)]">
                            {e.path || "(root)"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                e.type === "added" ? "success" : e.type === "removed" ? "error" : "warning"
                              }
                            >
                              {e.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{renderValue(e.oldValue)}</TableCell>
                          <TableCell>{renderValue(e.newValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <ConfirmDialog
          open={restoreTarget !== null}
          onOpenChange={(open) => !open && setRestoreTarget(null)}
          title="Restore version"
          description={
            restoreTarget && (
              <>
                Restore version <strong className="text-[var(--aidify-text)]">v{restoreTarget.version_number}</strong>?
                This creates a <strong className="text-[var(--aidify-text)]">new version</strong> with that
                data — history is never rewritten.
              </>
            )
          }
          confirmLabel="Restore as new version"
          onConfirm={doRestore}
        />
      </TabsContent>

      {/* ------------------------------- Activity ------------------------------ */}
      <TabsContent value="activity" className="mt-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Activity for this configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {activity === null ? (
              <p className="py-8 text-center text-sm text-[var(--aidify-secondary)]">Loading…</p>
            ) : activity.length === 0 ? (
              <EmptyState title="No activity" description="Actions on this configuration will appear here." />
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--aidify-blue)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[var(--aidify-text)]">
                        {a.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-[var(--aidify-secondary)]">{timeAgo(a.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
