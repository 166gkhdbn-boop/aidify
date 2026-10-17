"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui";
import type { DashboardCharts } from "./dashboard-charts";

/**
 * Client wrapper for the lazy dashboard charts.
 *
 * `next/dynamic` with `ssr: false` is not allowed in Server Components, so
 * the lazy recharts bundle lives in this client component instead of
 * page.tsx. Props mirror DashboardCharts exactly.
 */
const DashboardChartsInner = dynamic(
  () =>
    import("./dashboard-charts").then((m) => ({
      default: m.DashboardCharts,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 md:col-span-2 xl:col-span-2" />
        ))}
      </div>
    ),
  },
);

export function DashboardChartsLazy(
  props: ComponentProps<typeof DashboardCharts>,
) {
  return <DashboardChartsInner {...props} />;
}
