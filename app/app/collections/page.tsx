import type { Metadata } from "next";
import { PageHeader } from "@/app/app/_components/page-header";
import { CollectionsGrid } from "./_components/collections-grid";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const params = await searchParams;
  const autoNew = params.new === "1";

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Group related configurations. Deleting a collection never deletes configurations — they are simply unassigned."
      />
      <CollectionsGrid autoNew={autoNew} />
    </div>
  );
}
