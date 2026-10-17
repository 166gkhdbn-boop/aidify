"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertStyles = {
  info: {
    icon: Info,
    classes: "border-[var(--aidify-blue)]/30 bg-[var(--aidify-blue)]/10 text-[#9ec2ff]",
  },
  success: {
    icon: CheckCircle2,
    classes:
      "border-[var(--aidify-success)]/30 bg-[var(--aidify-success)]/10 text-[var(--aidify-success)]",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "border-[var(--aidify-warning)]/30 bg-[var(--aidify-warning)]/10 text-[var(--aidify-warning)]",
  },
  error: {
    icon: AlertCircle,
    classes:
      "border-[var(--aidify-error)]/30 bg-[var(--aidify-error)]/10 text-[var(--aidify-error)]",
  },
} as const;

export type AlertVariant = keyof typeof alertStyles;

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
}

export function Alert({
  variant = "info",
  title,
  className,
  children,
  role,
  ...props
}: AlertProps) {
  const { icon: Icon, classes } = alertStyles[variant];
  return (
    <div
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={cn(
        "flex gap-3 rounded-xl border p-4 text-sm backdrop-blur-md",
        classes,
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold text-[var(--aidify-text)]">{title}</p>}
        <div className="text-[var(--aidify-secondary)] [&>p]:leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
