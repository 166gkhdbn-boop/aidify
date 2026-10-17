import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap backdrop-blur-md [&_svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-[var(--aidify-border)] bg-white/[0.06] text-[var(--aidify-text)]",
        info: "border-[var(--aidify-blue)]/30 bg-[var(--aidify-blue)]/15 text-[#9ec2ff]",
        success:
          "border-[var(--aidify-success)]/30 bg-[var(--aidify-success)]/15 text-[var(--aidify-success)]",
        warning:
          "border-[var(--aidify-warning)]/30 bg-[var(--aidify-warning)]/15 text-[var(--aidify-warning)]",
        error:
          "border-[var(--aidify-error)]/30 bg-[var(--aidify-error)]/15 text-[var(--aidify-error)]",
        violet:
          "border-[var(--aidify-violet)]/30 bg-[var(--aidify-violet)]/15 text-[#c3aaff]",
        cyan: "border-[var(--aidify-cyan)]/30 bg-[var(--aidify-cyan)]/15 text-[var(--aidify-cyan)]",
        muted:
          "border-transparent bg-white/[0.04] text-[var(--aidify-secondary)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
