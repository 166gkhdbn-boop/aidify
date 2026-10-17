"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl border border-[var(--aidify-error)]/30 bg-[var(--aidify-error)]/10">
            <AlertTriangle className="size-6 text-[var(--aidify-error)]" aria-hidden="true" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            The admin console hit an error while loading this page. Your data is
            safe — this is a display problem, not a data problem.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <a href="/admin">Back to overview</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
