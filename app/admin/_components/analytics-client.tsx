"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Alert, Button, Card, CardContent, Input, Label, Skeleton } from "@/components/ui";
import { getPlatformAnalyticsAction } from "@/actions/admin";
import type { PlatformAnalytics } from "@/app/admin/_lib/queries";

const TrendChart = dynamic(
  () => import("./admin-charts").then((m) => m.TrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> },
);
const DistributionBars = dynamic(
  () => import("./admin-charts").then((m) => m.DistributionBars),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> },
);
const DistributionPie = dynamic(
  () => import("./admin-charts").then((m) => m.DistributionPie),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> },
);
const ChartCard = dynamic(
  () => import("./admin-charts").then((m) => m.ChartCard),
  { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> },
);

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Platform analytics with a date-range filter. All series come from live
 * database queries; empty ranges render honest empty states, never zeros
 * dressed up as data.
 */
export function AnalyticsClient({
  initial,
  initialFrom,
  initialTo,
}: {
  initial: PlatformAnalytics;
  initialFrom: string;
  initialTo: string;
}) {
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [preset, setPreset] = React.useState<number | null>(30);
  const [data, setData] = React.useState<PlatformAnalytics>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function apply(nextFrom: string, nextTo: string) {
    setLoading(true);
    setError(null);
    const result = await getPlatformAnalyticsAction({ from: nextFrom, to: nextTo });
    setLoading(false);
    if (result.ok) {
      setData(result.data);
    } else {
      setError(result.error.message);
    }
  }

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const f = toISODate(start);
    const t = toISODate(end);
    setPreset(days);
    setFrom(f);
    setTo(t);
    void apply(f, t);
  }

  function applyCustom() {
    if (!from || !to || from > to) {
      setError("Pick a valid date range (start on or before end).");
      return;
    }
    setPreset(null);
    void apply(from, to);
  }

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex gap-2" role="group" aria-label="Date range presets">
            {PRESETS.map((p) => (
              <Button
                key={p.days}
                variant={preset === p.days ? "default" : "secondary"}
                size="sm"
                onClick={() => applyPreset(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="analytics-from">From</Label>
              <Input
                id="analytics-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="analytics-to">To</Label>
              <Input
                id="analytics-to"
                type="date"
                value={to}
                min={from}
                max={toISODate(new Date())}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button variant="secondary" size="sm" onClick={applyCustom} loading={loading}>
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="error" title="Could not load analytics" className="mb-6">
          {error}
        </Alert>
      )}

      <div aria-busy={loading} className={loading ? "pointer-events-none opacity-60" : undefined}>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="New users" description={`${from} → ${to}`}>
            <TrendChart data={data.newUsersPerDay} id="analytics-users" color="var(--aidify-blue)" />
          </ChartCard>
          <ChartCard title="Configurations created" description={`${from} → ${to}`}>
            <TrendChart data={data.configsPerDay} id="analytics-configs" color="var(--aidify-cyan)" />
          </ChartCard>
          <ChartCard title="Activity events" description="activity_logs entries per day">
            <TrendChart data={data.activityPerDay} id="analytics-activity" color="var(--aidify-violet)" />
          </ChartCard>
          <ChartCard title="Configurations by status" description="Platform-wide distribution">
            <DistributionPie data={data.configsByStatus} />
          </ChartCard>
        </div>
        <div className="mt-4">
          <ChartCard title="Configurations by type" description="Platform-wide distribution">
            <DistributionBars data={data.configsByType} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
