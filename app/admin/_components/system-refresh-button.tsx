"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

/** Re-runs the server-side health probes by revalidating the page. */
export function SystemRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  return (
    <Button
      variant="secondary"
      onClick={() => {
        setBusy(true);
        router.refresh();
        // router.refresh() is synchronous in effect; clear the spinner shortly after.
        setTimeout(() => setBusy(false), 1200);
      }}
      loading={busy}
    >
      <RefreshCw aria-hidden="true" />
      Refresh health
    </Button>
  );
}
