"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Avatar,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { signOutAction } from "@/actions/auth";

interface AccountMenuProps {
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Account menu: profile / security links + sign out via actions/auth.ts.
 */
export function AccountMenu({ email, displayName, avatarUrl }: AccountMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = React.useState(false);

  const label = displayName ?? email ?? "Account";
  const initial = (displayName ?? email ?? "A").trim().charAt(0).toUpperCase();

  const signOut = async () => {
    setSigningOut(true);
    const res = await signOutAction();
    if (res.ok) {
      router.push("/login");
      router.refresh();
    } else {
      toast({
        title: "Sign out failed",
        description: res.error.message,
        variant: "error",
      });
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full transition-shadow hover:shadow-[0_0_16px_rgba(67,139,255,0.35)] focus-visible:outline-2 focus-visible:outline-[var(--aidify-blue)]"
      >
        <Avatar
          src={avatarUrl ?? undefined}
          alt={label}
          fallback={initial}
          className="size-8"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="max-w-full">
          <span className="block truncate text-sm font-semibold text-[var(--aidify-text)]">
            {label}
          </span>
          {email && (
            <span className="block truncate text-xs font-normal text-[var(--aidify-secondary)]">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/app/profile")}>
          <User aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/app/security")}>
          <ShieldCheck aria-hidden="true" />
          Security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger disabled={signingOut} onClick={signOut}>
          <LogOut aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
