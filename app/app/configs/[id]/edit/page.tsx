import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/app/_components/page-header";
import { getConfig } from "@/lib/dal/configs";
import { listProjects } from "@/lib/dal/projects";
import { listCollections } from "@/lib/dal/collections";
import { listTags } from "@/lib/dal/tags";
import { ConfigFormHost } from "../../_components/config-form-host";

export const metadata: Metadata = { title: "Edit configuration" };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [configRes, projectsRes, collectionsRes, tagsRes] = await Promise.all([
    getConfig(id),
    listProjects({ page: 1, pageSize: 200 }),
    listCollections({ page: 1, pageSize: 200 }),
    listTags({ page: 1, pageSize: 200 }),
  ]);
  if (!configRes.ok) notFound();
  const config = configRes.data;

  return (
    <div>
      <PageHeader
        title={`Edit: ${config.name}`}
        description={`Currently at version ${config.version}. Saving creates a new version snapshot.`}
      />
      <ConfigFormHost
        mode="edit"
        configId={config.id}
        expectedVersion={config.version}
        initial={{
          name: config.name,
          description: config.description ?? "",
          config_type: config.config_type,
          environment: config.environment,
          project_id: config.project_id,
          collection_id: config.collection_id,
          status: config.status,
          expires_at: toLocalInput(config.expires_at),
          notes: config.notes ?? "",
          dataText: JSON.stringify(config.data, null, 2),
          tagIds: config.tags.map((t) => t.id),
        }}
        projects={projectsRes.ok ? projectsRes.data.items.map((p) => ({ id: p.id, name: p.name })) : []}
        collections={
          collectionsRes.ok
            ? collectionsRes.data.items
                .filter((c) => !c.archived_at)
                .map((c) => ({ id: c.id, name: c.name }))
            : []
        }
        initialTags={tagsRes.ok ? tagsRes.data.items.map((t) => ({ id: t.id, name: t.name })) : []}
      />
    </div>
  );
}
