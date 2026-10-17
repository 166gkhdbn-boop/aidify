import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Generic empty state: icon, title, description, optional action.
 * Used everywhere a list/query has no data — never fake numbers.
 */

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
      role="status"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--aidify-border)] bg-white/[0.03] backdrop-blur-md">
        <Icon className="size-6 text-[var(--aidify-secondary)]" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-[var(--aidify-text)]">{title}</p>
        {description && (
          <p className="max-w-sm text-sm text-[var(--aidify-secondary)]">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-1">
          {ActionIcon && <ActionIcon aria-hidden="true" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
