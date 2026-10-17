import type { Metadata } from "next";
import { PageHeader } from "@/app/app/_components/page-header";
import { listProjects } from "@/lib/dal/projects";
import { listCollections } from "@/lib/dal/collections";
import { listTags } from "@/lib/dal/tags";
import { getPreferences } from "@/lib/dal/profile";
import { ConfigFormHost } from "../_components/config-form-host";

export const metadata: Metadata = { title: "New configuration" };

export default async function NewConfigPage() {
  const [projectsRes, collectionsRes, tagsRes, prefsRes] = await Promise.all([
    listProjects({ page: 1, pageSize: 200 }),
    listCollections({ page: 1, pageSize: 200 }),
    listTags({ page: 1, pageSize: 200 }),
    getPreferences(),
  ]);

  const projects = projectsRes.ok
    ? projectsRes.data.items.map((p) => ({ id: p.id, name: p.name }))
    : [];
  const collections = collectionsRes.ok
    ? collectionsRes.data.items
        .filter((c) => !c.archived_at)
        .map((c) => ({ id: c.id, name: c.name }))
    : [];
  const tags = tagsRes.ok
    ? tagsRes.data.items.map((t) => ({ id: t.id, name: t.name }))
    : [];
  const defaultEnvironment = prefsRes.ok ? prefsRes.data.defaultEnvironment : "development";

  return (
    <div>
      <PageHeader
        title="New configuration"
        description="Describe the configuration, then author its JSON data. A version-1 snapshot is created automatically."
      />
      <ConfigFormHost
        mode="create"
        projects={projects}
        collections={collections}
        initialTags={tags}
        initial={{
          name: "",
          description: "",
          config_type: "application",
          environment: defaultEnvironment,
          project_id: null,
          collection_id: null,
          status: "draft",
          expires_at: "",
          notes: "",
          dataText: "{\n  \n}",
          tagIds: [],
        }}
      />
    </div>
  );
}
