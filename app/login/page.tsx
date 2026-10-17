import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionUser } from "@/lib/auth";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { SetupRequired } from "@/components/setup-required";
import { CosmicCssBackground } from "@/components/cosmic-css-background";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Aidify workspace.",
};

// Reads searchParams (?next=) and the session at request time —
// can never prerender (cacheComponents blocking route).
export const instant = false;

interface LoginPageProps {
  searchParams: Promise<{ next?: string; auth_error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="relative min-h-screen">
        <CosmicCssBackground variant="subtle" />
        <div className="relative z-10">
          <SetupRequired feature="sign in" backHref="/" />
        </div>
      </div>
    );
  }

  const { next, auth_error } = await searchParams;

  // Already signed in — bounce to the app instead of showing the form.
  const user = await getSessionUser();
  if (user) {
    redirect(getSafeRedirect(next, "/app"));
  }

  return (
    <AuthCard
      icon={LogIn}
      title="Welcome back"
      subtitle="Sign in to your Aidify workspace to manage your configurations."
      footer={
        <>
          New to Aidify?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--aidify-cyan)] hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} authError={auth_error} />
    </AuthCard>
  );
}
