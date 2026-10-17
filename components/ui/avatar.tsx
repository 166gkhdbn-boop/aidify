"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image URL. When absent, the fallback (initials) renders. */
  src?: string | null;
  alt?: string;
  /** Fallback initials, shown when src is missing. */
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
} as const;

export function Avatar({
  src,
  alt = "",
  fallback = "?",
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-[var(--aidify-border-strong)]",
        "bg-gradient-to-br from-[var(--aidify-blue)]/40 to-[var(--aidify-violet)]/40",
        "font-semibold text-[var(--aidify-text)]",
        sizeClasses[size],
        className,
      )}
      role="img"
      aria-label={alt || fallback}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{fallback.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
