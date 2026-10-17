"use client";

import dynamic from "next/dynamic";
import { CosmicBackgroundFallback } from "@/components/cosmic-background";

/**
 * AppBackground — the shared 3D cosmic backdrop for the user app.
 *
 * Lazy-loads the WebGL scene (`ssr: false`) in the `subtle` variant so it
 * stays dim behind dense dashboard UI, fixed behind everything. A pure-CSS
 * gradient fallback renders while the bundle loads or when WebGL is
 * unavailable.
 *
 * Other layouts (e.g. admin) may reuse this component.
 */
const CosmicBackground = dynamic(
  () => import("@/components/cosmic-background"),
  { ssr: false, loading: () => <CosmicBackgroundFallback dim={0.5} /> },
);

export function AppBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <CosmicBackground variant="subtle" />
    </div>
  );
}
