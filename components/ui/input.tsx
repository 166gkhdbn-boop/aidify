import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "glass-input flex h-10 w-full px-3.5 py-2 text-sm",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
