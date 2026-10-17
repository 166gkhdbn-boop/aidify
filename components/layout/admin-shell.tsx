"use client";

import { ShieldCheck } from "lucide-react";
import { AppShell, type NavEntry } from "./app-shell";
import { Badge } from "@/components/ui";

/**
 * Admin shell: distinct admin navigation built on AppShell, with an
 * "ADMIN" marker in the brand row and a violet-tinted active state.
 *
 * IMPORTANT: the shell is layout only. Every admin page AND every admin
 * action must still call requireRole("administrator") server-side —
 * never trust that the user reached this shell.
 */

export interface AdminShellProps {
  nav: NavEntry[];
  children: React.ReactNode;
  topbar?: {
    search?: React.ReactNode;
    notifications?: React.ReactNode;
    account?: React.ReactNode;
  };
  /** Brand label in the sidebar header; defaults to "Aidify". */
  brandName?: string;
  className?: string;
}

export function AdminShell({ nav, children, topbar, brandName = "Aidify", className }: AdminShellProps) {
  return (
    <AppShell
      nav={nav}
      topbar={topbar}
      brandName={brandName}
      className={className}
    >
      <AdminBanner />
      {children}
    </AppShell>
  );
}

function AdminBanner() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Badge variant="violet" className="gap-1.5 px-3 py-1">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Admin console
      </Badge>
      <p className="text-sm text-[var(--aidify-secondary)]">
        Every action here is audited and requires the administrator role.
      </p>
    </div>
  );
}
