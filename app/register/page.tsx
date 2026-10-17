import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, UserX } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSessionUser } from "@/lib/auth";
import { isRegistrationOpen } from "@/lib/system-settings";
import { AuthCard } from "@/components/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { SetupRequired } from "@/components/setup-required";
import { CosmicCssBackground } from "@/components/cosmic-css-background";
import { Alert, Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Aidify account.",
};

export default async function RegisterPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="relative min-h-screen">
        <CosmicCssBackground variant="subtle" />
        <div className="relative z-10">
          <SetupRequired feature="create an account" backHref="/" />
        </div>
      </div>
    );
  }

  // Already signed in — no reason to register again.
  const user = await getSessionUser();
  if (user) {
    redirect("/app");
  }

  // Honest closed-registration state: no fake form, read from system_settings.
  const open = await isRegistrationOpen();
  if (!open) {
    return (
      <AuthCard
        icon={UserX}
        title="Registration is currently closed"
        subtitle="New account creation has been disabled by the workspace administrators."
      >
        <Alert variant="info" title="What you can do">
          <p>
            If you already have an account, sign in below. If you need access,
            contact the workspace administrator.
          </p>
        </Alert>
        <Button className="mt-6 w-full" size="lg" asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={UserPlus}
      title="Create your account"
      subtitle="Join Aidify and bring your configurations under control."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--aidify-cyan)] hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
