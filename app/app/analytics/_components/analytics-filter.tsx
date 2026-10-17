"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

const PRESETS = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
] as const;

/** Date-range filter: 7/30/90d presets + custom range. Drives URL params. */
export function AnalyticsFilter({
  preset,
  from,
  to,
}: {
  preset: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = React.useState(from.slice(0, 10));
  const [customTo, setCustomTo] = React.useState(to.slice(0, 10));

  const apply = (params: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) next.set(k, v);
    if (!("preset" in params)) next.delete("preset");
    router.push(`/app/analytics?${next.toString()}`);
  };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    apply({
      from: new Date(`${customFrom}T00:00:00Z`).toISOString(),
      to: new Date(`${customTo}T23:59:59Z`).toISOString(),
    });
  };

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex rounded-xl border border-[var(--aidify-border)] bg-white/[0.03] p-1" role="group" aria-label="Date range presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => apply({ preset: p.key })}
            aria-pressed={preset === p.key}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              preset === p.key
                ? "bg-[var(--aidify-blue)]/25 text-[var(--aidify-text)]"
                : "text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => applyCustom()}
          aria-pressed={preset === "custom"}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            preset === "custom"
              ? "bg-[var(--aidify-blue)]/25 text-[var(--aidify-text)]"
              : "text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]",
          )}
        >
          Custom
        </button>
      </div>
      <div className="flex items-end gap-2">
        <div>
          <Label htmlFor="analytics-from" className="text-xs">From</Label>
          <Input
            id="analytics-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="mt-1"
            max={customTo}
          />
        </div>
        <div>
          <Label htmlFor="analytics-to" className="text-xs">To</Label>
          <Input
            id="analytics-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="mt-1"
            min={customFrom}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={applyCustom} disabled={!customFrom || !customTo}>
          Apply
        </Button>
      </div>
    </div>
  );
}
