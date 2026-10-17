"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Accessible toggle switch built on a native checkbox input.
 * Keyboard: Space toggles; screen readers announce checked state.
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => (
    <label
      className={cn(
        "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full border border-[var(--aidify-border)] bg-white/[0.06] backdrop-blur-md transition-all duration-200",
          "group-has-checked:border-[var(--aidify-blue)] group-has-checked:bg-gradient-to-r group-has-checked:from-[var(--aidify-blue)] group-has-checked:to-[var(--aidify-violet)] group-has-checked:shadow-[0_0_12px_rgba(67,139,255,0.5)]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--aidify-cyan)]",
          className,
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[3px] top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-[var(--aidify-text)] shadow transition-transform duration-200 group-has-checked:translate-x-5"
      />
    </label>
  ),
);
Switch.displayName = "Switch";
