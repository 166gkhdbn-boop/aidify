"use client";

import dynamic from "next/dynamic";
import { CosmicBackgroundFallback } from "@/components/cosmic-background";

/**
 * LandingBackground — the full 3D cosmic scene for the public landing page.
 *
 * Lazy-loads the WebGL scene (`ssr: false`) in the `full` variant behind the
 * hero and page content. A pure-CSS gradient fallback renders while the
 * bundle loads or when WebGL is unavailable.
 */
const CosmicBackground = dynamic(
  () => import("@/components/cosmic-background"),
  { ssr: false, loading: () => <CosmicBackgroundFallback /> },
);

export function LandingBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <CosmicBackground variant="full" />
    </div>
  );
}
