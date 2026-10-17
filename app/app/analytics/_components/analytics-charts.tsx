"use client";

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
import { Card, CardHeader, CardTitle, CardContent, EmptyState } from "@/components/ui";
import type { ConfigAnalytics, ActivityAnalytics } from "@/lib/dal/analytics";

const GRID = "rgba(154,175,206,0.12)";
const TICK = { fill: "#9BAFCE", fontSize: 11 } as const;

const STATUS_COLORS: Record<string, string> = {
  active: "#35D6A0",
  archived: "#9BAFCE",
  draft: "#FFCB70",
};
const TYPE_COLORS = ["#438BFF", "#65DFFF", "#8A5CFF", "#35D6A0", "#FFCB70", "#FF647C", "#9BAFCE"];

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
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface AnalyticsChartsProps {
  configs: ConfigAnalytics;
  activity: ActivityAnalytics;
  rangeLabel: string;
}

/** Analytics charts (client-only recharts). Empty data → honest empty states. */
export function AnalyticsCharts({ configs, activity, rangeLabel }: AnalyticsChartsProps) {
  const createdTotal = configs.perDay.reduce((n, d) => n + d.count, 0);
  const activityTotal = activity.perDay.reduce((n, d) => n + d.count, 0);
  const statusTotal = configs.byStatus.reduce((n, d) => n + d.count, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="glass-panel md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Configurations created
            <span className="ml-2 text-xs font-normal text-[var(--aidify-secondary)]">{rangeLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {createdTotal === 0 ? (
            <EmptyState title="No data in this range" description="No configurations were created in the selected period." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={configs.perDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#438BFF" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#438BFF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tick={TICK} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={32} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="Created" stroke="#438BFF" strokeWidth={2} fill="url(#analyticsCreated)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Activity
            <span className="ml-2 text-xs font-normal text-[var(--aidify-secondary)]">{rangeLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityTotal === 0 ? (
            <EmptyState title="No data in this range" description="No activity was recorded in the selected period." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity.perDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tick={TICK} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={32} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(138,92,255,0.08)" }} />
                  <Bar dataKey="count" name="Events" fill="#8A5CFF" radius={[4, 4, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Status distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {statusTotal === 0 ? (
            <EmptyState title="No data" description="Nothing to break down in this range." />
          ) : (
            <div className="flex h-64 flex-col items-center">
              <ResponsiveContainer width="100%" height="75%">
                <PieChart>
                  <Pie data={configs.byStatus} dataKey="count" nameKey="status" innerRadius="62%" outerRadius="92%" paddingAngle={3} strokeWidth={0}>
                    {configs.byStatus.map((e) => (
                      <Cell key={e.status} fill={STATUS_COLORS[e.status] ?? "#9BAFCE"} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center justify-center gap-4">
                {configs.byStatus.map((e) => (
                  <span key={e.status} className="flex items-center gap-1.5 text-xs text-[var(--aidify-secondary)]">
                    <span className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[e.status] ?? "#9BAFCE" }} aria-hidden="true" />
                    <span className="capitalize">{e.status}</span>
                    <span className="font-semibold text-[var(--aidify-text)]">{e.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Type distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {configs.byType.length === 0 ? (
            <EmptyState title="No data" description="Nothing to break down in this range." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={configs.byType.map((t, i) => ({ ...t, fill: TYPE_COLORS[i % TYPE_COLORS.length] }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="type" tick={{ ...TICK, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(67,139,255,0.08)" }} />
                  <Bar dataKey="count" name="Configs" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {configs.byType.map((t, i) => (
                      <Cell key={t.type} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Top actions</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.byAction.length === 0 ? (
            <EmptyState title="No data" description="No actions recorded in this range." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...activity.byAction].sort((a, b) => b.count - a.count).slice(0, 12).map((a) => (
                <li
                  key={a.action}
                  className="flex items-center justify-between rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] px-4 py-2.5 text-sm"
                >
                  <span className="text-[var(--aidify-secondary)]">{a.action.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-[var(--aidify-text)]">{a.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
