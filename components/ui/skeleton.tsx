import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-white/[0.04] via-white/[0.09] to-white/[0.04]",
        className,
      )}
      {...props}
    />
  );
}
