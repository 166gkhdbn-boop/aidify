import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getConfig, getVersions } from "@/lib/dal/configs";
import { getProfile, getPreferences } from "@/lib/dal/profile";
import { Badge } from "@/components/ui";
import { ConfigDetailActions } from "./_components/config-detail-actions";
import { ConfigDetailTabs } from "./_components/config-detail-tabs";

export const metadata: Metadata = { title: "Configuration" };

const STATUS_VARIANT: Record<string, "success" | "muted" | "warning"> = {
  active: "success",
  archived: "muted",
  draft: "warning",
};

export default async function ConfigDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [configRes, profileRes, prefsRes] = await Promise.all([
    getConfig(id),
    getProfile(),
    getPreferences(),
  ]);
  if (!configRes.ok) notFound();
  const config = configRes.data;
  const versionsRes = await getVersions(id);
  const versions = versionsRes.ok ? versionsRes.data : [];

  const ownerName = profileRes.ok
    ? (profileRes.data.display_name ?? profileRes.data.username)
    : "You";

  return (
    <div>
      <Link
        href="/app/configs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to configurations
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-[var(--aidify-text)]">
            {config.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[config.status] ?? "muted"}>{config.status}</Badge>
            <Badge variant="info">{config.config_type}</Badge>
            <Badge variant="violet">{config.environment}</Badge>
            <Badge variant="muted">v{config.version}</Badge>
          </div>
          <p className="mt-2 text-sm text-[var(--aidify-secondary)]">
            Owned by {ownerName} · Created{" "}
            {new Date(config.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}Updated{" "}
            {new Date(config.updated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <ConfigDetailActions config={config} />
      </div>

      <ConfigDetailTabs
        config={config}
        initialVersions={versions}
        maskSecretsDefault={prefsRes.ok ? prefsRes.data.maskSecrets : true}
      />
    </div>
  );
}
