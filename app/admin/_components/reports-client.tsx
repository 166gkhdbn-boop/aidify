"use client";

import * as React from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  getUsersReportAction,
  getConfigsReportAction,
  getActivityReportAction,
  getAuditReportAction,
} from "@/actions/admin";
import type { ApiResponse } from "@/lib/api-response";

type ReportKey = "users" | "configs" | "activity" | "audit";

const REPORTS: {
  key: ReportKey;
  title: string;
  description: string;
  fetch: () => Promise<ApiResponse<unknown[]>>;
}[] = [
  {
    key: "users",
    title: "Users",
    description: "Every registered user: id, username, display name, email, roles, signup date.",
    fetch: getUsersReportAction,
  },
  {
    key: "configs",
    title: "Configurations",
    description: "Every configuration: id, name, owner, type, environment, status, version, timestamps.",
    fetch: getConfigsReportAction,
  },
  {
    key: "activity",
    title: "Activity (last 30 days)",
    description: "activity_logs entries from the last 30 days: actor, action, resource, timestamp.",
    fetch: getActivityReportAction,
  },
  {
    key: "audit",
    title: "Audit logs (last 30 days)",
    description: "audit_logs entries from the last 30 days: actor, action, target, reason, timestamp.",
    fetch: getAuditReportAction,
  },
];

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return "";
  const headers = Object.keys(first);
  const lines = [headers.map(toCsvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => toCsvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

/**
 * Real downloadable CSV reports. Each button fetches live rows from the
 * server and builds a CSV file client-side — every button produces a real
 * file, never an empty promise.
 */
export function ReportsClient() {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<ReportKey | null>(null);

  async function download(report: (typeof REPORTS)[number]) {
    setBusy(report.key);
    try {
      const result = await report.fetch();
      if (!result.ok) {
        toast({ title: "Report failed", description: result.error.message, variant: "error" });
        return;
      }
      const rows = result.data as Record<string, unknown>[];
      if (rows.length === 0) {
        toast({
          title: "No data",
          description: `The ${report.title.toLowerCase()} report has no rows to export.`,
          variant: "warning",
        });
        return;
      }
      const csv = rowsToCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `aidify-${report.key}-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Report downloaded",
        description: `${rows.length.toLocaleString()} rows exported to aidify-${report.key}-${stamp}.csv.`,
        variant: "success",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {REPORTS.map((report) => (
        <Card key={report.key}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--aidify-blue)]/30 bg-[var(--aidify-blue)]/15">
                <FileSpreadsheet className="size-5 text-[var(--aidify-cyan)]" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
              onClick={() => void download(report)}
              loading={busy === report.key}
              disabled={busy !== null}
            >
              <Download aria-hidden="true" />
              Download CSV
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
