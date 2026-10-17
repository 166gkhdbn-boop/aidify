import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getConfigAnalytics, getActivityAnalytics } from "@/lib/dal/analytics";
import { Skeleton } from "@/components/ui";
import { PageHeader } from "@/app/app/_components/page-header";
import { RefreshButton } from "@/app/app/_components/refresh-button";
import { AnalyticsFilter } from "./_components/analytics-filter";
import { AnalyticsChartsLazy } from "./_components/analytics-charts-lazy";

export const metadata: Metadata = { title: "Analytics" };

const PRESET_DAYS = ["7", "30", "90"] as const;

function resolveRange(params: Record<string, string | string[] | undefined>): {
  from: string;
  to: string;
  preset: string;
  label: string;
} {
  const now = new Date();
  const presetParam = typeof params.preset === "string" ? params.preset : "30";
  if (PRESET_DAYS.includes(presetParam as (typeof PRESET_DAYS)[number])) {
    const days = Number(presetParam);
    const from = new Date(now.getTime() - days * 86_400_000);
    return {
      from: from.toISOString(),
      to: now.toISOString(),
      preset: presetParam,
      label: `last ${days} days`,
    };
  }
  const fromRaw = typeof params.from === "string" ? params.from : "";
  const toRaw = typeof params.to === "string" ? params.to : "";
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    const fallbackFrom = new Date(now.getTime() - 30 * 86_400_000);
    return {
      from: fallbackFrom.toISOString(),
      to: now.toISOString(),
      preset: "30",
      label: "last 30 days",
    };
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    preset: "custom",
    label: `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`,
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { from, to, preset, label } = resolveRange(params);
  const range = { from, to };

  const [configsRes, activityRes] = await Promise.all([
    getConfigAnalytics(range),
    getActivityAnalytics(range),
  ]);
  if (!configsRes.ok || !activityRes.ok) notFound();

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Real usage data for your account — creation trends, activity and distributions."
        actions={<RefreshButton />}
      />
      <Suspense fallback={<Skeleton className="mb-6 h-12 w-full" />}>
        <AnalyticsFilter preset={preset} from={from} to={to} />
      </Suspense>
      <AnalyticsChartsLazy
        configs={configsRes.data}
        activity={activityRes.data}
        rangeLabel={label}
      />
    </div>
  );
}
