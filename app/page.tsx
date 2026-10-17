import Link from "next/link";
import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileJson,
  GitBranch,
  History,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui";
import { LandingBackground } from "@/components/landing-background";
import { AidifyLogoMark } from "@/components/auth-card";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Aidify — Advanced Configuration Management",
  description:
    "Aidify is the advanced configuration management platform: store, version, and govern your application configs in one secure cosmic console.",
};

const FEATURES: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Database,
    title: "Configuration management",
    body: "Store application configs, API endpoints, feature flags, and environment variables as structured JSON — searchable, tagged, and organized into collections.",
  },
  {
    icon: History,
    title: "Versioning & history",
    body: "Every update snapshots a new version with its author and timestamp. Compare versions, see exactly what changed, and restore any previous state — restores create a new version, never rewrite history.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "User, moderator, and administrator roles with granular permissions. Authorization is enforced server-side on every page and every action — never in the browser.",
  },
  {
    icon: BarChart3,
    title: "Real analytics",
    body: "Charts built from your actual data: creation trends, status and type distribution, activity over time. When there is nothing to show yet, you get an honest empty state — never invented numbers.",
  },
];

const STEPS: {
  icon: LucideIcon;
  step: string;
  title: string;
  body: string;
}[] = [
  {
    icon: FileJson,
    step: "01",
    title: "Define",
    body: "Model your configuration as structured JSON — application settings, API endpoints, feature flags, or a custom schema. Validate it before it ever reaches production.",
  },
  {
    icon: Layers,
    step: "02",
    title: "Organize",
    body: "Group configs into projects and collections, tag them, and separate development, staging, and production environments.",
  },
  {
    icon: GitBranch,
    step: "03",
    title: "Evolve safely",
    body: "Edit with confidence. Each change is versioned, diffable, and restorable, and every action lands in an append-only audit trail.",
  },
];

function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--aidify-border)] bg-[#03050d]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="Aidify home">
          <AidifyLogoMark size="sm" />
          <span className="text-lg font-semibold tracking-tight text-[var(--aidify-text)]">
            Aidify
          </span>
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm text-[var(--aidify-secondary)] md:flex"
          aria-label="Primary"
        >
          <a href="#features" className="transition-colors hover:text-[var(--aidify-text)]">
            Features
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-[var(--aidify-text)]">
            How it works
          </a>
          <a href="#security" className="transition-colors hover:text-[var(--aidify-text)]">
            Security
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">
              Get started
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-36 sm:px-6 sm:pt-44">
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--aidify-border-strong)] bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-[var(--aidify-cyan)] backdrop-blur-md">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Advanced configuration management platform
        </div>
        <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-[var(--aidify-text)] sm:text-6xl">
          Every configuration.
          <br />
          <span className="text-gradient-cosmic">One cosmic console.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--aidify-secondary)] sm:text-lg">
          Aidify gives your team a single, secure home for application configs,
          API endpoints, and feature flags — versioned, audited, and organized
          the way your systems actually work.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/register">
              Create free account
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--aidify-secondary)]"
          aria-label="Highlights"
        >
          {["Version history", "Role-based access", "Audit trails", "JSON-native"].map(
            (pill) => (
              <span
                key={pill}
                className="rounded-full border border-[var(--aidify-border)] bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md"
              >
                {pill}
              </span>
            ),
          )}
        </div>
      </Reveal>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aidify-cyan)]">
          Capabilities
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--aidify-text)] sm:text-4xl">
          Built for configuration at scale
        </h2>
        <p className="mt-4 text-[var(--aidify-secondary)]">
          Everything a platform team needs to keep configuration correct,
          traceable, and under control.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={i * 0.08}>
            <div className="glass-panel glass-panel-hover h-full p-7">
              <div className="flex size-11 items-center justify-center rounded-xl border border-[var(--aidify-border)] bg-gradient-to-br from-[var(--aidify-blue)]/20 to-[var(--aidify-violet)]/15">
                <feature.icon
                  className="size-5 text-[var(--aidify-cyan)]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--aidify-text)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--aidify-secondary)]">
                {feature.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6"
    >
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--aidify-cyan)]">
          Workflow
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--aidify-text)] sm:text-4xl">
          From scattered files to a single source of truth
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.step} delay={i * 0.1}>
            <div className="glass-panel relative h-full p-7">
              <span
                className="text-gradient-cosmic font-mono text-sm font-semibold"
                aria-hidden="true"
              >
                {step.step}
              </span>
              <div className="mt-3 flex size-11 items-center justify-center rounded-xl border border-[var(--aidify-border)] bg-white/[0.04]">
                <step.icon
                  className="size-5 text-[var(--aidify-cyan)]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--aidify-text)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--aidify-secondary)]">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function SecurityStrip() {
  const points = [
    "Server-side authorization on every page and action",
    "Rate-limited authentication with security event logging",
    "Append-only audit logs for sensitive operations",
    "No credentials ever stored in source code or client bundles",
  ];
  return (
    <section id="security" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <Reveal>
        <div className="glass-panel relative overflow-hidden p-8 sm:p-12">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 size-72 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(67,139,255,0.18) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
            <div className="md:max-w-sm">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-[var(--aidify-border-strong)] bg-[var(--aidify-success)]/10">
                <ShieldCheck
                  className="size-6 text-[var(--aidify-success)]"
                  aria-hidden="true"
                />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-[var(--aidify-text)] sm:text-3xl">
                Security is the architecture, not a feature
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--aidify-secondary)]">
                Aidify is built on real Supabase Auth with verified server-side
                sessions — identity is derived from the session, never from
                client-supplied claims.
              </p>
            </div>
            <ul className="grid flex-1 gap-3 sm:grid-cols-2">
              {points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4 text-sm text-[var(--aidify-secondary)]"
                >
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-[var(--aidify-success)]"
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <Reveal>
        <div className="glass-panel px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight text-[var(--aidify-text)] sm:text-4xl">
            Bring order to your configuration chaos
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[var(--aidify-secondary)]">
            Create an account, verify your email, and start managing your first
            configuration in minutes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Create free account
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="relative border-t border-[var(--aidify-border)] bg-[#03050d]/60 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-3">
              <AidifyLogoMark size="sm" />
              <span className="text-lg font-semibold text-[var(--aidify-text)]">
                Aidify
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--aidify-secondary)]">
              The advanced configuration management platform — versioned,
              audited, and built for teams.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-10 sm:grid-cols-3" aria-label="Footer">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--aidify-secondary)]">
                Product
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="#features" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    How it works
                  </a>
                </li>
                <li>
                  <Link href="/register" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--aidify-secondary)]">
                Account
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/login" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/forgot-password" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    Reset password
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--aidify-secondary)]">
                Legal
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/privacy" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-10 border-t border-[var(--aidify-border)] pt-6 text-center text-xs text-[var(--aidify-secondary)]/70">
          © 2026 Aidify. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <LandingBackground />
      <div className="relative z-10">
        <SiteHeader />
        <main>
          <Hero />
          <FeatureGrid />
          <HowItWorks />
          <SecurityStrip />
          <CtaBand />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
