"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Revalidates the current route (dashboard "refresh data" control). */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [spinning, setSpinning] = React.useState(false);

  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={() => {
        setSpinning(true);
        router.refresh();
        setTimeout(() => setSpinning(false), 800);
      }}
      aria-label="Refresh data"
    >
      <RefreshCw className={cn(spinning && "animate-spin")} aria-hidden="true" />
      Refresh
    </Button>
  );
}
