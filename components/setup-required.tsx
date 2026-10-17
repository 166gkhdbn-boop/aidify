import { CloudOff, KeyRound, TerminalSquare, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@/components/ui";

/**
 * Honest "Supabase not configured" page. Feature agents MUST render this
 * (instead of faking auth/data) whenever the Supabase env vars are missing.
 *
 * Usage in a Server Component:
 *   if (!isSupabaseConfigured()) return <SetupRequired feature="configurations" />;
 */

const STEPS = [
  {
    icon: KeyRound,
    title: "Create a Supabase project",
    body: "Go to supabase.com/dashboard, create a project, then open Project Settings → API.",
  },
  {
    icon: TerminalSquare,
    title: "Copy the keys into your env file",
    body: "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
  },
  {
    icon: RotateCcw,
    title: "Restart the app",
    body: "Env vars load at startup — restart `npm run dev` (or redeploy) and this page disappears.",
  },
] as const;

export function SetupRequired({
  feature,
  backHref = "/",
}: {
  /** Human name of the feature that needs Supabase, e.g. "sign in". */
  feature?: string;
  backHref?: string;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="glass-panel-hover w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl border border-[var(--aidify-warning)]/30 bg-[var(--aidify-warning)]/10">
            <CloudOff className="size-7 text-[var(--aidify-warning)]" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Supabase is not configured</CardTitle>
          <CardDescription className="text-base">
            {feature
              ? `To ${feature}, Aidify needs a connected Supabase project. Nothing is broken — the keys just aren't set yet.`
              : "Aidify needs a connected Supabase project. Nothing is broken — the keys just aren't set yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="flex gap-4 rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--aidify-blue)]/15 text-[var(--aidify-cyan)]">
                <step.icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--aidify-text)]">
                  <span className="mr-2 text-[var(--aidify-secondary)]">{i + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-[var(--aidify-secondary)]">{step.body}</p>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-[var(--aidify-border)] bg-[#03050d]/60 p-4 font-mono text-xs leading-relaxed text-[var(--aidify-secondary)]">
            <p className="text-[var(--aidify-cyan)]"># .env.local</p>
            <p>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</p>
            <p>SUPABASE_SERVICE_ROLE_KEY=your-service-role-key</p>
          </div>
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={backHref}>
                <ArrowLeft aria-hidden="true" />
                Go back
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
