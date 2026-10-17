"use client";

import * as React from "react";
import { Braces, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui";
import { FormError } from "@/components/ui";

/**
 * JSON editor: textarea with live validation and inline error messages.
 * react-hook-form friendly — forward value/onChange/onBlur + name.
 */

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  /** When set, the parsed value is validated against this zod schema. */
  schema?: { safeParse: (data: unknown) => { success: boolean; error?: { message: string } } };
  /** Extra error from the parent form (e.g. submit-time validation). */
  externalError?: string | null;
  onValidChange?: (parsed: unknown | null, valid: boolean) => void;
  className?: string;
}

function formatParseError(message: string, text: string): string {
  // V8 JSON errors look like: "Unexpected token } in JSON at position 42".
  // Translate the position into a line number for a friendlier message.
  const match = /at position (\d+)/.exec(message);
  if (!match?.[1]) return message;
  const pos = Number(match[1]);
  const line = text.slice(0, pos).split("\n").length;
  return `${message.replace(/ at position \d+/, "")} (line ${line})`;
}

export function JsonEditor({
  value,
  onChange,
  onBlur,
  name,
  label,
  placeholder = '{\n  "key": "value"\n}',
  rows = 14,
  disabled = false,
  schema,
  externalError,
  onValidChange,
  className,
}: JsonEditorProps) {
  const [touched, setTouched] = React.useState(false);
  const errorId = React.useId();

  const validation = React.useMemo(() => {
    if (value.trim() === "") {
      return { valid: false, error: "JSON cannot be empty.", parsed: null as unknown };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid JSON";
      return { valid: false, error: formatParseError(message, value), parsed: null as unknown };
    }
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        return { valid: false, error: result.error?.message ?? "Schema validation failed.", parsed: null as unknown };
      }
    }
    return { valid: true, error: null as string | null, parsed };
  }, [value, schema]);

  React.useEffect(() => {
    onValidChange?.(validation.valid ? validation.parsed : null, validation.valid);
    // Only re-run when the validation outcome changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.valid]);

  const showError = touched && (validation.error ?? externalError);
  const showValid = touched && validation.valid && !externalError;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1.5 flex items-center gap-2">
          <Braces className="size-4 text-[var(--aidify-secondary)]" aria-hidden="true" />
          <label
            htmlFor={name ?? errorId}
            className="text-sm font-medium text-[var(--aidify-secondary)]"
          >
            {label}
          </label>
          {showValid && (
            <span className="flex items-center gap-1 text-xs text-[var(--aidify-success)]">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Valid JSON
            </span>
          )}
        </div>
      )}
      <Textarea
        id={name ?? errorId}
        name={name}
        value={value}
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
        onBlur={() => {
          setTouched(true);
          onBlur?.();
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-invalid={Boolean(showError) || undefined}
        aria-describedby={showError ? `${errorId}-error` : undefined}
        className="font-mono text-[13px] leading-relaxed"
      />
      {showError && (
        <div className="mt-1.5">
          <FormError id={`${errorId}-error`} message={showError} />
        </div>
      )}
    </div>
  );
}
