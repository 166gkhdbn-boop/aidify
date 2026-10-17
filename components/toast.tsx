"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight toast system — no external dependency.
 *
 * Wrap the app once: <ToastProvider>…</ToastProvider>
 * Use anywhere: const { toast } = useToast();
 *   toast({ title: "Saved", description: "…", variant: "success" });
 */

export type ToastVariant = "default" | "success" | "error" | "warning" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss. 0 = sticky. Default 4500. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastInput, "description">> {
  id: number;
  description?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const variantStyles: Record<ToastVariant, { icon: typeof Info; ring: string }> = {
  default: { icon: Info, ring: "text-[var(--aidify-cyan)]" },
  success: { icon: CheckCircle2, ring: "text-[var(--aidify-success)]" },
  error: { icon: AlertCircle, ring: "text-[var(--aidify-error)]" },
  warning: { icon: AlertTriangle, ring: "text-[var(--aidify-warning)]" },
  info: { icon: Info, ring: "text-[var(--aidify-blue)]" },
};

let nextId = 1;
const DEFAULT_DURATION = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
  }, []);

  const toast = React.useCallback(
    (input: ToastInput): number => {
      const id = nextId++;
      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "default",
        duration: input.duration ?? DEFAULT_DURATION,
      };
      setToasts((prev) => [...prev.slice(-4), record]);
      if (record.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), record.duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({ toast, dismiss, dismissAll }),
    [toast, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(92vw,380px)] flex-col gap-2"
      >
        {toasts.map((t) => {
          const { icon: Icon, ring } = variantStyles[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className="glass-panel pointer-events-auto flex items-start gap-3 !rounded-xl p-4 shadow-[0_16px_48px_rgba(3,5,13,0.7)]"
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", ring)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--aidify-text)]">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-sm text-[var(--aidify-secondary)]">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 text-[var(--aidify-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
