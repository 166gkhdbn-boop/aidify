import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aidify-cyan)] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-[var(--aidify-blue)] to-[var(--aidify-violet)] text-white shadow-[0_4px_20px_rgba(67,139,255,0.35)] hover:shadow-[0_4px_28px_rgba(67,139,255,0.5)] hover:brightness-110",
        secondary:
          "bg-white/[0.06] text-[var(--aidify-text)] border border-[var(--aidify-border)] backdrop-blur-md hover:bg-white/[0.1] hover:border-[var(--aidify-border-strong)]",
        ghost: "text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)] hover:bg-white/[0.06]",
        outline:
          "border border-[var(--aidify-border-strong)] bg-transparent text-[var(--aidify-text)] hover:bg-white/[0.05] hover:border-[var(--aidify-blue)]",
        destructive:
          "bg-[var(--aidify-error)]/15 text-[var(--aidify-error)] border border-[var(--aidify-error)]/30 hover:bg-[var(--aidify-error)]/25",
        success:
          "bg-[var(--aidify-success)]/15 text-[var(--aidify-success)] border border-[var(--aidify-success)]/30 hover:bg-[var(--aidify-success)]/25",
        link: "text-[var(--aidify-cyan)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-12 px-7 text-base rounded-xl",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /**
   * Render the single child element instead of a <button>, merging props
   * (shadcn-style Slot without a dependency). Use for <Link> wrappers.
   */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading = false, disabled, asChild = false, children, ...props },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      return React.cloneElement(child, {
        ...props,
        ref,
        className: cn(classes, child.props.className as string | undefined),
        "aria-busy": loading || undefined,
      });
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
