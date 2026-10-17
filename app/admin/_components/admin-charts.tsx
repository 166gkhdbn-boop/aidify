"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from "@/components/ui";

/**
 * Admin charts (recharts). Imported with next/dynamic ssr:false from pages —
 * never import this module in a server component directly.
 */

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

const CHART_COLORS = {
  blue: "var(--aidify-blue)",
  cyan: "var(--aidify-cyan)",
  violet: "var(--aidify-violet)",
  success: "var(--aidify-success)",
  warning: "var(--aidify-warning)",
  error: "var(--aidify-error)",
};

const PIE_COLORS = [
  CHART_COLORS.blue,
  CHART_COLORS.cyan,
  CHART_COLORS.violet,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
];

function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg px-3 py-2 text-xs">
      {label && (
        <p className="mb-1 font-semibold text-[var(--aidify-text)]">{formatDay(label)}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--aidify-secondary)]">
          {p.name ? `${p.name}: ` : ""}
          <span className="font-semibold text-[var(--aidify-text)]">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center">
      <EmptyState title="No data yet" description={message} />
    </div>
  );
}

export function TrendChart({
  data,
  color = CHART_COLORS.blue,
  id,
}: {
  data: TrendPoint[];
  color?: string;
  id: string;
}) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return <ChartEmptyState message="Nothing recorded in this period." />;
  }
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={`trend-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(155,175,206,0.12)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fill: "var(--aidify-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--aidify-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            name="Count"
            stroke={color}
            strokeWidth={2}
            fill={`url(#trend-${id})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionBars({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <ChartEmptyState message="No configurations recorded yet." />;
  }
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="rgba(155,175,206,0.12)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: "var(--aidify-secondary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: "var(--aidify-text)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              if (!p) return null;
              const entry = p.payload as { name?: string } | undefined;
              return (
                <div className="glass-panel rounded-lg px-3 py-2 text-xs">
                  <p className="text-[var(--aidify-secondary)]">
                    {String(entry?.name ?? "")}:{" "}
                    <span className="font-semibold text-[var(--aidify-text)]">{p.value}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionPie({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <ChartEmptyState message="No configurations recorded yet." />;
  }
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={56}
            outerRadius={92}
            paddingAngle={3}
            stroke="rgba(3,5,13,0.8)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0];
              if (!p) return null;
              return (
                <div className="glass-panel rounded-lg px-3 py-2 text-xs">
                  <p className="text-[var(--aidify-secondary)]">
                    {String(p.name ?? "")}:{" "}
                    <span className="font-semibold text-[var(--aidify-text)]">{p.value}</span>
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-1.5 text-xs text-[var(--aidify-secondary)]">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              aria-hidden="true"
            />
            {d.name} ({d.value})
          </li>
        ))}
      </ul>
    </div>
  );
}
