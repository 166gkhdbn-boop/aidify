import * as React from "react";
import { cn } from "@/lib/utils";

export const Separator = React.forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement> & { orientation?: "horizontal" | "vertical" }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <hr
    ref={ref}
    aria-orientation={orientation}
    className={cn(
      "aidify-divider",
      orientation === "vertical" &&
        "h-auto w-px self-stretch bg-[linear-gradient(180deg,transparent,var(--aidify-border-strong),transparent)]",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";
