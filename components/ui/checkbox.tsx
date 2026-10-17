"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Accessible checkbox built on a native input. Supports an indeterminate
 * (partial) state for "select all" patterns.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, checked, indeterminate = false, onCheckedChange, disabled, ...props },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
      <label
        className={cn(
          "group relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          ref={(node) => {
            innerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none flex size-5 items-center justify-center rounded-md border border-[var(--aidify-border)] bg-white/[0.06] backdrop-blur-md transition-all duration-150",
            "group-has-checked:border-[var(--aidify-blue)] group-has-checked:bg-gradient-to-br group-has-checked:from-[var(--aidify-blue)] group-has-checked:to-[var(--aidify-violet)] group-has-checked:shadow-[0_0_10px_rgba(67,139,255,0.45)]",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--aidify-cyan)]",
            className,
          )}
        >
          {indeterminate ? (
            <Minus className="size-3.5 text-white" strokeWidth={3} />
          ) : (
            <Check
              className="size-3.5 text-white opacity-0 transition-opacity group-has-checked:opacity-100"
              strokeWidth={3}
            />
          )}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
