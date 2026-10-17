import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { PageHeader } from "../_components/page-header";
import { ReportsClient } from "../_components/reports-client";

export default async function AdminReportsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="generate reports" backHref="/admin" />;
  }
  await requireRole("administrator");

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Downloadable CSV exports built from live database queries. Each button generates a real file — the row count is confirmed before download."
      />
      <ReportsClient />
    </div>
  );
}
