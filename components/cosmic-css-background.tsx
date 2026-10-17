/**
 * Pure-CSS deep-space background — NO WebGL dependency.
 *
 * Layered radial gradients (blue/violet nebulae over deep space), a
 * deterministic starfield (seeded PRNG so SSR and hydration match), and two
 * slowly drifting glow orbs. Used by public/auth pages. The 3D
 * CosmicBackground (R3F) is being built in parallel and will be wired in by
 * the coordinator; this component keeps every page rendering without it.
 */

/** Deterministic PRNG (mulberry32) — stable stars across SSR/hydration. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  left: number;
  top: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
}

function buildStars(count: number, seed: number): Star[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100,
    top: rand() * 100,
    size: rand() < 0.85 ? 1 : 2,
    opacity: 0.25 + rand() * 0.65,
    delay: rand() * 6,
    duration: 3 + rand() * 5,
  }));
}

const STARS = buildStars(110, 42);

export function CosmicCssBackground({ variant = "full" }: { variant?: "full" | "subtle" }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base deep-space gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(1200px 800px at 15% -5%, rgba(67,139,255,0.16), transparent 60%)",
            "radial-gradient(1000px 700px at 90% 110%, rgba(138,92,255,0.14), transparent 60%)",
            "radial-gradient(700px 500px at 80% 10%, rgba(101,223,255,0.08), transparent 60%)",
            "radial-gradient(900px 900px at 50% 120%, rgba(7,17,38,0.9), transparent 70%)",
            "linear-gradient(180deg, #03050d 0%, #050a1c 55%, #03050d 100%)",
          ].join(","),
        }}
      />

      {/* Starfield */}
      {STARS.map((star, i) => (
        <span
          key={i}
          className="aidify-star absolute rounded-full bg-white"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: star.size,
            height: star.size,
            opacity: variant === "subtle" ? star.opacity * 0.5 : star.opacity,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}

      {/* Drifting nebula orbs */}
      <div
        className="aidify-orb absolute -left-40 top-1/4 size-[480px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(67,139,255,0.14) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="aidify-orb aidify-orb-delayed absolute -right-40 bottom-1/4 size-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(138,92,255,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Vignette to keep text legible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(3,5,13,0.75) 100%)",
        }}
      />

      <style>{`
        .aidify-star { animation: aidify-twinkle 5s ease-in-out infinite; }
        .aidify-orb { animation: aidify-drift 26s ease-in-out infinite alternate; }
        .aidify-orb-delayed { animation-delay: -13s; animation-duration: 32s; }
        @keyframes aidify-twinkle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.6); }
        }
        @keyframes aidify-drift {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(60px, -40px, 0); }
        }
      `}</style>
    </div>
  );
}
