import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { SetupRequired } from "@/components/setup-required";
import { CosmicCssBackground } from "@/components/cosmic-css-background";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your Aidify account.",
};

export default function ForgotPasswordPage() {
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
      icon={KeyRound}
      title="Reset your password"
      subtitle="Enter the email address for your account and we'll send you a secure, single-use reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--aidify-cyan)] hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
