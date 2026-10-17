import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Admin stat card: label, big value, honest subtitle (e.g. the rule behind
 * the metric). Renders "Not available" when value is null.
 */
export function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  tone?: "default" | "success" | "warning" | "error" | "info";
}) {
  const Icon = icon;
  const toneRing: Record<string, string> = {
    default: "text-[var(--aidify-cyan)] bg-[var(--aidify-blue)]/15 border-[var(--aidify-blue)]/30",
    success: "text-[var(--aidify-success)] bg-[var(--aidify-success)]/15 border-[var(--aidify-success)]/30",
    warning: "text-[var(--aidify-warning)] bg-[var(--aidify-warning)]/15 border-[var(--aidify-warning)]/30",
    error: "text-[var(--aidify-error)] bg-[var(--aidify-error)]/15 border-[var(--aidify-error)]/30",
    info: "text-[var(--aidify-blue)] bg-[var(--aidify-blue)]/15 border-[var(--aidify-blue)]/30",
  };
  return (
    <Card className="glass-panel-hover">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aidify-secondary)]">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 truncate text-3xl font-bold tracking-tight text-[var(--aidify-text)]",
              value === null && "text-xl font-medium text-[var(--aidify-secondary)]",
            )}
          >
            {value === null ? "Not available" : value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--aidify-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl border",
              toneRing[tone],
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
