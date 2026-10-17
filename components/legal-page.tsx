import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { CosmicCssBackground } from "@/components/cosmic-css-background";
import { AidifyLogoMark } from "@/components/auth-card";
import { Reveal } from "@/components/landing/reveal";

/**
 * Designed wrapper for legal content pages (privacy, terms): glass hero
 * with the Aidify mark, then structured sections — not a raw text dump.
 */

export interface LegalSection {
  icon: LucideIcon;
  title: string;
  body: React.ReactNode;
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="relative min-h-screen">
      <CosmicCssBackground variant="subtle" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>

        <Reveal className="mt-8">
          <div className="glass-panel p-8 sm:p-10">
            <div className="flex items-center gap-4">
              <AidifyLogoMark size="sm" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aidify-cyan)]">
                  {eyebrow}
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--aidify-text)]">
                  {title}
                </h1>
              </div>
            </div>
            <p className="mt-5 leading-relaxed text-[var(--aidify-secondary)]">
              {intro}
            </p>
            <p className="mt-3 text-xs text-[var(--aidify-secondary)]/70">
              Last updated: {updated}
            </p>
          </div>
        </Reveal>

        <div className="mt-6 space-y-5">
          {sections.map((section, i) => (
            <Reveal key={section.title} delay={Math.min(i * 0.06, 0.3)}>
              <section className="glass-panel p-7 sm:p-8" aria-labelledby={`legal-${i}`}>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--aidify-border)] bg-gradient-to-br from-[var(--aidify-blue)]/20 to-[var(--aidify-violet)]/15">
                    <section.icon
                      className="size-5 text-[var(--aidify-cyan)]"
                      aria-hidden="true"
                    />
                  </div>
                  <h2
                    id={`legal-${i}`}
                    className="text-lg font-semibold text-[var(--aidify-text)]"
                  >
                    {section.title}
                  </h2>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--aidify-secondary)] [&>ul]:list-disc [&>ul]:space-y-1.5 [&>ul]:pl-5 [&_strong]:text-[var(--aidify-text)] [&_strong]:font-medium">
                  {section.body}
                </div>
              </section>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-[var(--aidify-secondary)]/60">
          Questions about this document? Contact the workspace administrator.
        </p>
      </div>
    </div>
  );
}
