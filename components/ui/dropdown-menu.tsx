"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible dropdown menu (no Radix): button + menu with keyboard
 * navigation (ArrowUp/Down, Home/End, Enter, Escape, type-ahead omitted).
 * Closes on outside pointer-down and on Escape; focus returns to trigger.
 */

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenu components must be used inside <DropdownMenu>");
  return ctx;
}

export function DropdownMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </DropdownContext.Provider>
  );
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useDropdownContext();
  return (
    <button
      ref={(node) => {
        triggerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => {
        if (["ArrowDown", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export function DropdownMenuContent({
  className,
  children,
  align = "start",
}: {
  className?: string;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const { open, setOpen, triggerRef } = useDropdownContext();
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
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
    // Focus the first item on open for keyboard users.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen, triggerRef]);

  if (!open) return null;

  const items = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [],
    );

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      onKeyDown={(e) => {
        const list = items();
        const current = list.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          list[(current + 1) % list.length]?.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          list[(current - 1 + list.length) % list.length]?.focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          list[0]?.focus();
        } else if (e.key === "End") {
          e.preventDefault();
          list[list.length - 1]?.focus();
        }
      }}
      className={cn(
        "absolute z-50 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--aidify-border-strong)]",
        "bg-[rgba(8,18,40,0.97)] p-1.5 shadow-[0_16px_48px_rgba(3,5,13,0.7),0_0_24px_rgba(67,139,255,0.12)] backdrop-blur-xl",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Destructive styling (red). */
  danger?: boolean;
}

export function DropdownMenuItem({
  className,
  danger = false,
  disabled,
  onClick,
  children,
  ...props
}: DropdownMenuItemProps) {
  const { setOpen } = useDropdownContext();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        setOpen(false);
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
        "text-[var(--aidify-text)] hover:bg-[var(--aidify-blue)]/20 focus-visible:bg-[var(--aidify-blue)]/20",
        danger && "text-[var(--aidify-error)] hover:bg-[var(--aidify-error)]/15 focus-visible:bg-[var(--aidify-error)]/15",
        disabled && "cursor-not-allowed opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
  className,
  ...props
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <DropdownMenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={className}
      {...props}
    >
      <span className="w-4 shrink-0">
        {checked && <Check className="size-4 text-[var(--aidify-cyan)]" aria-hidden="true" />}
      </span>
      {children}
    </DropdownMenuItem>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      className={cn("aidify-divider my-1.5", className)}
    />
  );
}

export function DropdownMenuLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]", className)}>
      {children}
    </div>
  );
}
