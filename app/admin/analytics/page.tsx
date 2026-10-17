import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { getPlatformAnalytics } from "@/app/admin/_lib/queries";
import { PageHeader } from "../_components/page-header";
import { AnalyticsClient } from "../_components/analytics-client";

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export default async function AdminAnalyticsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view platform analytics" backHref="/admin" />;
  }
  await requireRole("administrator");

  const from = isoDaysAgo(29);
  const to = isoDaysAgo(0);
  const initial = await getPlatformAnalytics({ from, to });

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform-wide trends and distributions, computed from live data. Pick a range up to 365 days."
      />
      {!initial.ok ? (
        <Alert variant="error" title="Could not load analytics">
          {initial.error.message}
        </Alert>
      ) : (
        <AnalyticsClient initial={initial.data} initialFrom={from} initialTo={to} />
      )}
    </div>
  );
}
