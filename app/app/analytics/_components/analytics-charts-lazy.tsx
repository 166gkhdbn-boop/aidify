"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui";
import type { AnalyticsCharts } from "./analytics-charts";

/**
 * Client wrapper for the lazy analytics charts.
 *
 * `next/dynamic` with `ssr: false` is not allowed in Server Components, so
 * the lazy recharts bundle lives in this client component instead of
 * page.tsx. Props mirror AnalyticsCharts exactly.
 */
const AnalyticsChartsInner = dynamic(
  () =>
    import("./analytics-charts").then((m) => ({
      default: m.AnalyticsCharts,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-72 md:col-span-2" />
        ))}
      </div>
    ),
  },
);

export function AnalyticsChartsLazy(
  props: ComponentProps<typeof AnalyticsCharts>,
) {
  return <AnalyticsChartsInner {...props} />;
}
