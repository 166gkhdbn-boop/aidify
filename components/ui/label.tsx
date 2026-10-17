import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a red asterisk after the label text. */
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required = false, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-[var(--aidify-secondary)]",
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-[var(--aidify-error)]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  ),
);
Label.displayName = "Label";
