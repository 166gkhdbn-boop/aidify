"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { BarChart3, PieChart as PieIcon, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, EmptyState } from "@/components/ui";

/**
 * Dashboard charts (client-only, recharts). Rendered via next/dynamic with
 * ssr:false from the dashboard page. Empty datasets render honest empty
 * states — never fabricated numbers.
 */

const GRID = "rgba(154,175,206,0.12)";
const TICK = { fill: "#9BAFCE", fontSize: 11 } as const;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--aidify-border-strong)] bg-[rgba(8,18,40,0.95)] px-3 py-2 text-xs backdrop-blur-md">
      {label && <p className="mb-1 font-semibold text-[var(--aidify-text)]">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--aidify-secondary)]">
          {p.name ? `${p.name}: ` : ""}
          <span className="font-semibold text-[var(--aidify-text)]">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  active: "#35D6A0",
  archived: "#9BAFCE",
  draft: "#FFCB70",
};

const TYPE_COLORS = ["#438BFF", "#65DFFF", "#8A5CFF", "#35D6A0", "#FFCB70", "#FF647C", "#9BAFCE"];

export interface DashboardChartsProps {
  createdPerDay: { date: string; count: number }[];
  activityPerDay: { date: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
}

export function DashboardCharts({
  createdPerDay,
  activityPerDay,
  byStatus,
  byType,
}: DashboardChartsProps) {
  const createdTotal = createdPerDay.reduce((n, d) => n + d.count, 0);
  const activityTotal = activityPerDay.reduce((n, d) => n + d.count, 0);
  const statusTotal = byStatus.reduce((n, d) => n + d.count, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Configs created / day */}
      <Card className="glass-panel md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-[var(--aidify-cyan)]" aria-hidden="true" />
            Configurations created
            <span className="ml-auto text-xs font-normal text-[var(--aidify-secondary)]">
              last 30 days
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {createdTotal === 0 ? (
            <EmptyState
              title="No configurations yet"
              description="Create your first configuration to see the trend here."
            />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={createdPerDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="createdFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#438BFF" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#438BFF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={TICK}
                    tickFormatter={shortDate}
                    interval={6}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Created"
                    stroke="#438BFF"
                    strokeWidth={2}
                    fill="url(#createdFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity / day */}
      <Card className="glass-panel md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-[var(--aidify-violet)]" aria-hidden="true" />
            Activity
            <span className="ml-auto text-xs font-normal text-[var(--aidify-secondary)]">
              last 14 days
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityTotal === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Actions like creating or editing configurations will appear here."
            />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityPerDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={TICK}
                    tickFormatter={shortDate}
                    interval={2}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(138,92,255,0.08)" }} />
                  <Bar dataKey="count" name="Events" fill="#8A5CFF" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status donut */}
      <Card className="glass-panel md:col-span-1 xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PieIcon className="size-4 text-[var(--aidify-success)]" aria-hidden="true" />
            By status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusTotal === 0 ? (
            <EmptyState title="Nothing to show" description="Status breakdown appears once you have configurations." />
          ) : (
            <div className="flex h-56 flex-col items-center">
              <ResponsiveContainer width="100%" height="75%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {byStatus.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? "#9BAFCE"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {byStatus.map((entry) => (
                  <span key={entry.status} className="flex items-center gap-1.5 text-xs text-[var(--aidify-secondary)]">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[entry.status] ?? "#9BAFCE" }}
                      aria-hidden="true"
                    />
                    <span className="capitalize">{entry.status}</span>
                    <span className="font-semibold text-[var(--aidify-text)]">{entry.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Type bars */}
      <Card className="glass-panel md:col-span-1 xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-[var(--aidify-blue)]" aria-hidden="true" />
            By type
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byType.length === 0 ? (
            <EmptyState title="Nothing to show" description="Type breakdown appears once you have configurations." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byType.map((t, i) => ({ ...t, fill: TYPE_COLORS[i % TYPE_COLORS.length] }))}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ ...TICK, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(67,139,255,0.08)" }} />
                  <Bar dataKey="count" name="Configs" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {byType.map((t, i) => (
                      <Cell key={t.type} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
