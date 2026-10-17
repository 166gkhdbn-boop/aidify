import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { JsonView } from "@/components/json-view";
import { getConfigAdminDetail } from "@/app/admin/_lib/queries";
import { PageHeader } from "../../_components/page-header";
import { ConfigModeration } from "../../_components/config-moderation";
import { formatDateTime } from "../../_lib/format";

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-[var(--aidify-secondary)]">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-[var(--aidify-text)]">
        {children}
      </dd>
    </div>
  );
}

export default async function AdminConfigDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="inspect configurations" backHref="/admin/configs" />;
  }
  await requireRole("moderator");
  const { id } = await params;

  const result = await getConfigAdminDetail(id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION") {
      notFound();
    }
    return (
      <div>
        <PageHeader title="Configuration" />
        <Alert variant="error" title="Could not load configuration">
          {result.error.message}
        </Alert>
      </div>
    );
  }
  const config = result.data;

  return (
    <div>
      <Link
        href="/admin/configs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to configurations
      </Link>
      <PageHeader
        title={config.name}
        description={`Owned by ${config.owner_username ? `@${config.owner_username}` : config.owner_id}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-[var(--aidify-border)]">
              <MetaRow label="Status">
                <Badge
                  variant={config.status === "active" ? "success" : config.status === "archived" ? "muted" : "info"}
                >
                  {config.status}
                </Badge>
              </MetaRow>
              <MetaRow label="Type">{config.config_type}</MetaRow>
              <MetaRow label="Environment">{config.environment}</MetaRow>
              <MetaRow label="Version">
                <span className="font-mono">v{config.version}</span>
                <span className="ml-2 font-normal text-[var(--aidify-secondary)]">
                  ({config.version_count} snapshot{config.version_count === 1 ? "" : "s"})
                </span>
              </MetaRow>
              <MetaRow label="Created">{formatDateTime(config.created_at)}</MetaRow>
              <MetaRow label="Updated">{formatDateTime(config.updated_at)}</MetaRow>
              <MetaRow label="Expires">
                {config.expires_at ? formatDateTime(config.expires_at) : "—"}
              </MetaRow>
              {config.description && <MetaRow label="Description">{config.description}</MetaRow>}
              {config.notes && <MetaRow label="Notes">{config.notes}</MetaRow>}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data (secrets redacted)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-[var(--aidify-secondary)]">
              Values under sensitive keys are redacted server-side before display.
            </p>
            <JsonView data={config.data} maxHeight="420px" />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Moderation</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigModeration
            configId={config.id}
            configName={config.name}
            status={config.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
