"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible custom select (no Radix): button + listbox with keyboard
 * navigation (ArrowUp/Down, Enter, Escape), aria-activedescendant omitted
 * in favor of roving highlight + focus on the listbox.
 *
 * Usage:
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">Option A</SelectItem>
 *     </SelectContent>
 *   </Select>
 */

interface SelectContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  listId: string;
  highlighted: number;
  setHighlighted: (i: number) => void;
  registerItem: (value: string, label: string) => void;
  unregisterItem: (value: string) => void;
  itemValues: string[];
  itemLabels: Map<string, string>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select components must be used inside <Select>");
  return ctx;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  className,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const [highlighted, setHighlighted] = React.useState(0);
  const [itemValues, setItemValues] = React.useState<string[]>([]);
  const [itemLabels, setItemLabels] = React.useState<Map<string, string>>(
    () => new Map(),
  );
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listId = React.useId();

  const current = value ?? internal;

  const handleChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  // Items register themselves in an effect (SelectItem), so the trigger can
  // resolve labels and keyboard nav can walk the list. State-based — no
  // ref access during render.
  const registerItem = React.useCallback((itemValue: string, label: string) => {
    setItemValues((prev) => (prev.includes(itemValue) ? prev : [...prev, itemValue]));
    setItemLabels((prev) => {
      if (prev.get(itemValue) === label) return prev;
      const next = new Map(prev);
      next.set(itemValue, label);
      return next;
    });
  }, []);

  const unregisterItem = React.useCallback((itemValue: string) => {
    setItemValues((prev) => prev.filter((v) => v !== itemValue));
    setItemLabels((prev) => {
      if (!prev.has(itemValue)) return prev;
      const next = new Map(prev);
      next.delete(itemValue);
      return next;
    });
  }, []);

  const ctx: SelectContextValue = {
    open: open && !disabled,
    setOpen,
    value: current,
    onValueChange: handleChange,
    triggerRef,
    listId,
    highlighted,
    setHighlighted,
    registerItem,
    unregisterItem,
    itemValues,
    itemLabels,
  };

  return (
    <SelectContext.Provider value={ctx}>
      <div className={cn("relative w-full", className)}>{children}</div>
    </SelectContext.Provider>
  );
}

/* ---------------- Trigger ---------------- */

export type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, triggerRef, listId } = useSelectContext();
    return (
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "glass-input flex h-10 w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-sm",
          className,
        )}
        {...props}
      >
        <span className="truncate">{children}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--aidify-secondary)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

/* ---------------- Value ---------------- */

export function SelectValue({ placeholder = "Select…" }: { placeholder?: string }) {
  const { value, itemLabels } = useSelectContext();
  const label = value ? itemLabels.get(value) : undefined;
  if (!label) {
    return <span className="text-[var(--aidify-secondary)]/70">{placeholder}</span>;
  }
  return <span>{label}</span>;
}

/* ---------------- Content ---------------- */

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const {
    open,
    setOpen,
    listId,
    triggerRef,
    highlighted,
    setHighlighted,
    onValueChange,
    itemValues,
  } = useSelectContext();
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    listRef.current?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-orientation="vertical"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const dir = e.key === "ArrowDown" ? 1 : -1;
          const count = itemValues.length;
          if (count > 0) setHighlighted((highlighted + dir + count) % count);
        } else if (e.key === "Enter") {
          e.preventDefault();
          const item = itemValues[highlighted];
          if (item !== undefined) {
            onValueChange(item);
            setOpen(false);
            triggerRef.current?.focus();
          }
        }
      }}
      className={cn(
        "absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--aidify-border-strong)]",
        "bg-[rgba(8,18,40,0.97)] p-1 shadow-[0_16px_48px_rgba(3,5,13,0.7),0_0_24px_rgba(67,139,255,0.12)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------------- Item ---------------- */

export function SelectItem({
  value,
  children,
  className,
  disabled = false,
  label,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Override for the label shown in the trigger (defaults to children text). */
  label?: string;
}) {
  const {
    value: current,
    onValueChange,
    setOpen,
    triggerRef,
    highlighted,
    setHighlighted,
    registerItem,
    unregisterItem,
    itemValues,
  } = useSelectContext();

  const resolvedLabel = label ?? (typeof children === "string" ? children : value);

  React.useEffect(() => {
    registerItem(value, resolvedLabel);
    return () => unregisterItem(value);
  }, [value, resolvedLabel, registerItem, unregisterItem]);

  const selected = current === value;
  const index = itemValues.indexOf(value);

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        onValueChange(value);
        setOpen(false);
        triggerRef.current?.focus();
      }}
      onMouseEnter={() => {
        if (index >= 0) setHighlighted(index);
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none",
        "text-[var(--aidify-text)] transition-colors",
        highlighted === index && !disabled && "bg-[var(--aidify-blue)]/20",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="w-4 shrink-0">
        {selected && (
          <Check className="size-4 text-[var(--aidify-cyan)]" aria-hidden="true" />
        )}
      </span>
      <span className="truncate">{children}</span>
    </div>
  );
}
