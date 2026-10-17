import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Field-level form error message. Wire with aria-describedby on the input:
 *   <Input aria-invalid={!!error} aria-describedby={errorId} />
 *   <FormError id={errorId} message={error} />
 */
export function FormError({
  id,
  message,
  className,
}: {
  id?: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-xs text-[var(--aidify-error)]",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
