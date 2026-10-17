"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui";

/**
 * Global topbar search: submits to the configurations list with `?search=`.
 */
export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/app/configs?search=${encodeURIComponent(q)}` : "/app/configs");
  };

  // Clear when navigating away from the configs list (React's "adjust state
  // during render" pattern — the shell uses the same approach).
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (!pathname.startsWith("/app/configs")) setValue("");
  }

  return (
    <form onSubmit={submit} role="search" className="w-full max-w-md">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--aidify-secondary)]"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search configurations…"
          aria-label="Search configurations"
          className="pl-9"
        />
      </div>
    </form>
  );
}
