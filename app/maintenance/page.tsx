import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Maintenance",
  description: "Aidify is temporarily under maintenance.",
  robots: { index: false, follow: false },
};

/**
 * Shown when maintenance mode is on (proxy.ts redirects here).
 * Honest and calm: no fake countdown, no fake progress — just the facts
 * and a way back home once maintenance ends.
 */
export default function MaintenancePage() {
  return (
    <AuthCard
      icon={Wrench}
      title="Under maintenance"
      subtitle="We're performing scheduled work on Aidify. The platform is temporarily unavailable for non-administrators."
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4 text-sm leading-relaxed text-[var(--aidify-secondary)]">
          <p>
            Your configurations and data are safe — nothing is being changed
            or deleted. Access will return automatically as soon as maintenance
            is complete.
          </p>
          <p className="mt-2">
            If you are an administrator, sign in to continue working during
            maintenance.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button className="flex-1" size="lg" asChild>
            <Link href="/">Check again</Link>
          </Button>
          <Button variant="secondary" className="flex-1" size="lg" asChild>
            <Link href="/login">Administrator sign in</Link>
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
