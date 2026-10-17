"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible tabs (no Radix): roving tabindex, ArrowLeft/Right/Home/End,
 * automatic activation, aria tablist/tab/tabpanel wiring.
 */

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  baseId: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>");
  return ctx;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const baseId = React.useId();

  const current = value ?? internal;
  const handleChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: handleChange, baseId }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([aria-disabled="true"])') ?? [],
    );
    const current = tabs.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={props["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-[var(--aidify-border)] bg-white/[0.03] p-1 backdrop-blur-md",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  disabled = false,
  className,
  children,
  ...props
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value">) {
  const { value: current, onValueChange, baseId } = useTabsContext();
  const selected = current === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      tabIndex={selected ? 0 : -1}
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
        "text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected &&
          "bg-gradient-to-br from-[var(--aidify-blue)]/30 to-[var(--aidify-violet)]/30 text-[var(--aidify-text)] shadow-[0_2px_12px_rgba(67,139,255,0.25)] border border-[var(--aidify-border-strong)]",
        !selected && "border border-transparent",
        "[&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { value: current, baseId } = useTabsContext();
  if (current !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn("mt-4 outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
