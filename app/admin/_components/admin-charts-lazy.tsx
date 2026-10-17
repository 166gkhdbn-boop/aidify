"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui";
import type { TrendChart, ChartCard } from "./admin-charts";

/**
 * Client wrappers for the lazy admin charts.
 *
 * `next/dynamic` with `ssr: false` is not allowed in Server Components, so
 * the lazy recharts bundle lives in this client component instead of
 * page.tsx. Props mirror TrendChart / ChartCard exactly.
 */
const TrendChartInner = dynamic(
  () => import("./admin-charts").then((m) => m.TrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> },
);

const ChartCardInner = dynamic(
  () => import("./admin-charts").then((m) => m.ChartCard),
  { ssr: false, loading: () => <Skeleton className="h-[320px] w-full" /> },
);

export function TrendChartLazy(props: ComponentProps<typeof TrendChart>) {
  return <TrendChartInner {...props} />;
}

export function ChartCardLazy(props: ComponentProps<typeof ChartCard>) {
  return <ChartCardInner {...props} />;
}
