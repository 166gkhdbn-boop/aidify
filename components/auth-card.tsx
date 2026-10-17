import type { LucideIcon } from "lucide-react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { CosmicCssBackground } from "@/components/cosmic-css-background";

/**
 * Centered glass-card layout shared by /login, /register, /forgot-password
 * and /reset-password: Aidify logo mark, title, subtitle, then the form.
 */

export function AidifyLogoMark({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-10" : "size-14";
  const icon = size === "sm" ? "size-5" : "size-7";
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-2xl border border-[var(--aidify-border-strong)]",
        "bg-gradient-to-br from-[var(--aidify-blue)]/25 via-[var(--aidify-violet)]/20 to-[var(--aidify-cyan)]/15",
        "shadow-[0_0_32px_rgba(67,139,255,0.35)]",
        dims,
      )}
      aria-hidden="true"
    >
      <Layers className={cn("text-[var(--aidify-cyan)]", icon)} />
    </div>
  );
}

export interface AuthCardProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Small text/links rendered under the card (e.g. "New here? Sign up"). */
  footer?: React.ReactNode;
  className?: string;
}

export function AuthCard({
  icon: Icon,
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <CosmicCssBackground variant="subtle" />
      <div className="relative z-10 w-full max-w-md">
        <div className={cn("glass-panel p-8 sm:p-9", className)}>
          <div className="mb-6 flex flex-col items-center text-center">
            <AidifyLogoMark />
            <div className="mt-5 flex items-center gap-2.5">
              {Icon && (
                <Icon
                  className="size-5 text-[var(--aidify-cyan)]"
                  aria-hidden="true"
                />
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--aidify-text)]">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--aidify-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
          {children}
        </div>
        {footer && (
          <div className="mt-5 text-center text-sm text-[var(--aidify-secondary)]">
            {footer}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-[var(--aidify-secondary)]/60">
          <a href="/privacy" className="hover:text-[var(--aidify-secondary)] hover:underline">
            Privacy
          </a>
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          <a href="/terms" className="hover:text-[var(--aidify-secondary)] hover:underline">
            Terms
          </a>
        </p>
      </div>
    </div>
  );
}
