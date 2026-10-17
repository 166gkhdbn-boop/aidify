import type { Metadata } from "next";
import { PageHeader } from "@/app/app/_components/page-header";
import { ConfigsExplorer } from "./_components/configs-explorer";

export const metadata: Metadata = { title: "Configurations" };

const STATUSES = ["active", "draft", "archived"];

export default async function ConfigsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; import?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : "";
  const statusParam = typeof params.status === "string" ? params.status : "";
  const autoImport = params.import === "1";

  return (
    <div>
      <PageHeader
        title="Configurations"
        description="Search, filter, version and export your configurations. Everything runs server-side — the table never loads more than one page at a time."
      />
      <ConfigsExplorer
        initialSearch={search}
        initialStatus={STATUSES.includes(statusParam) ? statusParam : ""}
        autoImport={autoImport}
      />
    </div>
  );
}
