"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Simple tooltip: shows a glass label on hover/focus of the wrapped child.
 * CSS-only positioning; keyboard accessible via focus-visible.
 */

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  const sideClasses = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  } as const;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <span
        role="tooltip"
        aria-hidden={!visible}
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-[var(--aidify-border-strong)]",
          "bg-[rgba(8,18,40,0.97)] px-2.5 py-1.5 text-xs text-[var(--aidify-text)] shadow-lg backdrop-blur-xl",
          "transition-opacity duration-150",
          sideClasses[side],
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
