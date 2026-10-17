import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("glass-input min-h-[96px] w-full px-3.5 py-2.5 text-sm", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
