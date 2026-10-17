"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, Badge, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { signOutAction } from "@/actions/auth";

/**
 * Admin topbar: identity (avatar + email + admin badge), "View site" link,
 * and a working sign-out button.
 */
export function AdminTopbar({
  email,
  roles,
}: {
  email: string;
  roles: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = React.useState(false);

  const initial = (email.charAt(0) || "?").toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const result = await signOutAction();
      if (result.ok) {
        router.push("/login");
        router.refresh();
      } else {
        toast({
          title: "Sign out failed",
          description: result.error.message,
          variant: "error",
        });
      }
    } catch {
      toast({
        title: "Sign out failed",
        description: "Something went wrong. Please try again.",
        variant: "error",
      });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/">
          <ExternalLink aria-hidden="true" />
          View site
        </Link>
      </Button>

      <div className="hidden items-center gap-2.5 sm:flex">
        <Avatar alt={email} fallback={initial} size="sm" />
        <div className="leading-tight">
          <p className="max-w-[180px] truncate text-sm font-medium text-[var(--aidify-text)]">
            {email}
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            <Badge variant="violet" className="px-1.5 py-0 text-[10px]">
              <ShieldCheck className="size-3" aria-hidden="true" />
              {roles.includes("administrator") ? "Administrator" : roles.join(", ")}
            </Badge>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        loading={signingOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut aria-hidden="true" />
        <span className="hidden md:inline">Sign out</span>
      </Button>
    </div>
  );
}
