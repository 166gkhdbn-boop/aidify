import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SetupRequired } from "@/components/setup-required";
import { CosmicCssBackground } from "@/components/cosmic-css-background";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Aidify account.",
};

export default function ResetPasswordPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="relative min-h-screen">
        <CosmicCssBackground variant="subtle" />
        <div className="relative z-10">
          <SetupRequired feature="reset your password" backHref="/" />
        </div>
      </div>
    );
  }

  return (
    <AuthCard
      icon={LockKeyhole}
      title="Choose a new password"
      subtitle="Pick a strong password — at least 8 characters."
      footer={
        <>
          Link not working?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--aidify-cyan)] hover:underline"
          >
            Request a new one
          </Link>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
