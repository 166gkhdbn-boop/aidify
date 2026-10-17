"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="w-full max-w-md">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description={
            error.message || "This section could not be loaded. Please try again."
          }
        />
        <div className="mt-2 flex justify-center">
          <Button variant="secondary" onClick={reset}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
