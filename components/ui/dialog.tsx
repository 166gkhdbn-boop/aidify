"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal dialog (no Radix):
 * - focus moves into the dialog on open, returns to the trigger on close
 * - Escape closes; overlay click closes (unless persistent)
 * - focus is trapped while open; body scroll is locked
 * - aria-modal + role="dialog" with labelledby title
 */

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog components must be used inside <Dialog>");
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const isOpen = open ?? internal;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternal(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDialogContext();
  return (
    <button type="button" className={className} onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
}

export function DialogContent({
  className,
  children,
  persistent = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { persistent?: boolean }) {
  const { open, setOpen, titleId, descriptionId } = useDialogContext();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocus = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !persistent) {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Focus trap
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    // Move focus into the dialog (close button first for discoverability).
    const closeBtn = panelRef.current?.querySelector<HTMLElement>("[data-dialog-close]");
    (closeBtn ?? panelRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus();
      }
    };
  }, [open, setOpen, persistent]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#03050d]/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (!persistent) setOpen(false);
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "glass-panel relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 outline-none",
          "shadow-[0_24px_80px_rgba(3,5,13,0.8),0_0_60px_rgba(67,139,255,0.12)]",
          className,
        )}
        {...props}
      >
        {!persistent && (
          <button
            type="button"
            data-dialog-close
            onClick={() => setOpen(false)}
            aria-label="Close dialog"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--aidify-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 flex flex-col gap-1.5 pr-8", className)} {...props} />
  );
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialogContext();
  return (
    <h2
      id={titleId}
      className={cn("text-lg font-semibold tracking-tight text-[var(--aidify-text)]", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDialogContext();
  return (
    <p id={descriptionId} className={cn("text-sm text-[var(--aidify-secondary)]", className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
  );
}
