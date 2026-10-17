'use client';

/**
 * CosmicBackground — Aidify's deep-space 3D backdrop.
 *
 * Real WebGL scene (react-three-fiber + custom GLSL, no image backdrops):
 * digital planet, twinkling starfield, drifting nebulae, crystalline
 * asteroids, glowing orbital routes, satellites, rising data particles and a
 * fake-reflection liquid foreground. Pure-CSS gradient fallback when WebGL
 * is unavailable so the app never crashes.
 *
 * Usage (client-only, lazy):
 *   const CosmicBackground = dynamic(() => import('@/components/cosmic-background'), { ssr: false });
 *   <CosmicBackground variant="full" />
 */

import {
  Component,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Types & palette                                                     */
/* ------------------------------------------------------------------ */

export interface CosmicBackgroundProps {
  /** 'full' for landing/auth pages, 'subtle' (dimmer, fewer elements) behind dense dashboards */
  variant?: 'full' | 'subtle';
  className?: string;
}

interface Quality {
  stars: number;
  asteroids: number;
  nebulae: number;
  particles: number;
  satellites: boolean;
  rings: number;
  drift: boolean; // nebula drift (disabled on mobile)
  dpr: [number, number];
  dim: number; // global glow multiplier (subtle variant is dimmer)
}

interface Env {
  mobile: boolean;
  reducedMotion: boolean;
}

// Brand tokens (must match PROJECT_BRIEF design tokens)
const BG = '#03050D';
const BLUE = new THREE.Color('#438BFF');
const CYAN = new THREE.Color('#65DFFF');
const VIOLET = new THREE.Color('#8A5CFF');

// Planet placement — right of center so page content keeps the left side
const PLANET_POS: [number, number, number] = [3.4, 0.9, -1.5];
const PLANET_R = 2.3;

/** Shared per-frame context: reduced-motion freezes every animation at t=0. */
const MotionContext = createContext<{ reducedMotion: boolean; dim: number }>({
  reducedMotion: false,
  dim: 1,
});

/**
 * Type-safe uniform setter. `noUncheckedIndexedAccess` makes
 * `material.uniforms[name]` possibly undefined, so every write goes through here.
 */
function setUniform(material: THREE.ShaderMaterial, name: string, value: number): void {
  const uniform = material.uniforms[name];
  if (uniform) uniform.value = value;
}

/**
 * Deterministic PRNG (mulberry32). Scene layouts must be pure — React 19's
 * purity lint forbids Math.random() during render — and a fixed seed keeps
 * the starfield/asteroids stable across remounts.
 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Environment detection                                               */
/* ------------------------------------------------------------------ */

function readEnv(): Env {
  if (typeof window === 'undefined') return { mobile: false, reducedMotion: false };
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 8) : 8;
  return {
    mobile: window.innerWidth < 768 || cores <= 4,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    // Release the probe context immediately.
    const lose = gl?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null;
    lose?.loseContext?.();
    return gl !== null;
  } catch {
    return false;
  }
}

function resolveQuality(variant: 'full' | 'subtle', mobile: boolean): Quality {
  if (mobile) {
    return {
      stars: 600,
      asteroids: 8,
      nebulae: 3,
      particles: variant === 'full' ? 80 : 40,
      satellites: false,
      rings: 2,
      drift: false,
      dpr: [1, 1],
      dim: variant === 'full' ? 0.85 : 0.5,
    };
  }
  if (variant === 'subtle') {
    return {
      stars: 1200,
      asteroids: 12,
      nebulae: 3,
      particles: 60,
      satellites: false,
      rings: 2,
      drift: true,
      dpr: [1, 1.5],
      dim: 0.55,
    };
  }
  return {
    stars: 4000,
    asteroids: 40,
    nebulae: 5,
    particles: 200,
    satellites: true,
    rings: 3,
    drift: true,
    dpr: [1, 1.75],
    dim: 1,
  };
}

/* ------------------------------------------------------------------ */
/* CSS fallback (also exported for reuse)                              */
/* ------------------------------------------------------------------ */

export function CosmicBackgroundFallback({
  className = '',
  dim = 1,
}: {
  className?: string;
  dim?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: BG,
        opacity: dim,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            // violet nebula, top-left
            'radial-gradient(900px 620px at 12% 6%, rgba(138,92,255,0.24), transparent 60%)',
            // blue nebula, top-right
            'radial-gradient(1100px 700px at 88% 10%, rgba(67,139,255,0.26), transparent 62%)',
            // cyan wisp, top-center
            'radial-gradient(700px 480px at 55% 0%, rgba(101,223,255,0.12), transparent 60%)',
            // luminous planet glow, right-center
            'radial-gradient(760px 760px at 72% 44%, rgba(67,139,255,0.30), rgba(101,223,255,0.08) 45%, transparent 68%)',
            // dark liquid foreground at the bottom
            'linear-gradient(to bottom, transparent 52%, rgba(7,17,38,0.85) 80%, #02040a 100%)',
            // planet reflection smear in the liquid
            'radial-gradient(560px 200px at 72% 96%, rgba(67,139,255,0.20), transparent 70%)',
          ].join(','),
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error boundary — Canvas creation failures must never crash the app  */
/* ------------------------------------------------------------------ */

class CosmicErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Swallowed intentionally: the fallback renders instead.
  }

  render(): ReactNode {
    return this.state.failed ? <CosmicBackgroundFallback /> : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Shared GLSL noise (hash + value noise + fbm, 3D)                    */
/* ------------------------------------------------------------------ */

const NOISE_GLSL = /* glsl */ `
  // Integer-free hash: maps a 3D cell to a stable pseudo-random 0..1 value.
  float hash13(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  // Trilinear value noise.
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }
  // 5-octave fractal Brownian motion for clouds, continents, caustics.
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

/* ------------------------------------------------------------------ */
/* Planet — digital Earth: procedural marble, dot-matrix continents,   */
/* night-side city lights, fresnel atmosphere rim                     */
/* ------------------------------------------------------------------ */

const PLANET_VERT = /* glsl */ `
  varying vec3 vNormalW;   // world-space normal (for fresnel + day/night)
  varying vec3 vPos;       // object-space position (stable noise lookup)
  varying vec3 vWorldPos;  // world-space position (view vector)
  varying vec2 vUv;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vPos = position;
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform float uTime;    // frozen at 0 under prefers-reduced-motion
  uniform float uDim;     // global glow multiplier (subtle variant)
  uniform vec3 uSunDir;   // key-light direction for the day/night terminator
  varying vec3 vNormalW;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 p = normalize(vPos) * 2.0;

    // --- Marble base: deep-blue oceans, lighter "data continents"
    float cont = fbm(p * 1.6 + vec3(0.0, uTime * 0.008, 0.0));
    float detail = vnoise(p * 7.0);
    vec3 ocean = mix(vec3(0.012, 0.030, 0.090), vec3(0.020, 0.080, 0.220), cont);
    vec3 land = mix(vec3(0.050, 0.160, 0.380), vec3(0.120, 0.350, 0.650), detail);
    vec3 col = mix(ocean, land, smoothstep(0.42, 0.58, cont));

    // --- Dot-matrix overlay: quantised detail noise reads as a digital grid
    float dots = smoothstep(0.60, 0.72, detail) * smoothstep(0.44, 0.60, cont);
    col += vec3(0.25, 0.55, 1.0) * dots * 0.35;

    // --- Day/night terminator
    float dayMix = smoothstep(-0.15, 0.35, dot(n, uSunDir));
    col *= mix(0.10, 1.0, dayMix);

    // --- City lights: procedural specks, only on the night side over land
    float night = 1.0 - dayMix;
    float specks = step(0.986, hash13(floor(p * 220.0))) * smoothstep(0.45, 0.60, cont);
    col += vec3(0.45, 0.75, 1.0) * specks * night * 1.7 * uDim;

    // --- Slow cloud bands on the day side
    float clouds = smoothstep(0.55, 0.80, fbm(p * 2.5 + vec3(uTime * 0.015, 0.0, 0.0)));
    col = mix(col, vec3(0.35, 0.55, 0.85), clouds * 0.22 * dayMix);

    // --- Sweeping data arcs: thin bright latitude lines drifting over time
    float arc = smoothstep(0.965, 1.0, sin(vUv.y * 44.0 - uTime * 0.5) * 0.5 + 0.5);
    col += vec3(0.30, 0.80, 1.0) * arc * 0.10 * uDim;

    // --- Fresnel atmosphere rim (cyan -> electric blue)
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    col += mix(vec3(0.25, 0.60, 1.0), vec3(0.40, 0.90, 1.0), fres) * fres * 1.5 * uDim;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNv;  // view-space normal
  varying vec3 vVp;  // view-space position
  void main() {
    vNv = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vVp = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = /* glsl */ `
  // Additive halo shell (BackSide): silhouette glow around the planet limb.
  uniform float uDim;
  varying vec3 vNv;
  varying vec3 vVp;
  void main() {
    vec3 V = normalize(-vVp);
    float rim = pow(1.0 - abs(dot(normalize(vNv), V)), 2.5);
    vec3 col = mix(vec3(0.26, 0.55, 1.0), vec3(0.40, 0.88, 1.0), rim);
    gl_FragColor = vec4(col * rim * 0.85 * uDim, rim * 0.9);
  }
`;

function Planet() {
  const { reducedMotion, dim } = useContext(MotionContext);
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDim: { value: dim },
          uSunDir: { value: new THREE.Vector3(-0.6, 0.35, 0.7).normalize() },
        },
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
      }),
    [dim],
  );
  const atmoMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uDim: { value: dim } },
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [dim],
  );

  // Dispose GPU programs on unmount (uDim is baked in via the useMemo deps above).
  useEffect(() => {
    return () => {
      material.dispose();
      atmoMaterial.dispose();
    };
  }, [material, atmoMaterial]);

  useFrame((state, delta) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    setUniform(material, 'uTime', t);
    if (meshRef.current && !reducedMotion) {
      meshRef.current.rotation.y += delta * 0.03; // slow planetary spin
    }
  });

  return (
    <group position={PLANET_POS}>
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[PLANET_R, 96, 96]} />
      </mesh>
      {/* Atmosphere halo, slightly larger than the surface */}
      <mesh material={atmoMaterial} scale={1.07}>
        <sphereGeometry args={[PLANET_R, 64, 64]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Starfield — buffered THREE.Points with shader twinkle               */
/* ------------------------------------------------------------------ */

const STARS_VERT = /* glsl */ `
  attribute float aSize;   // per-star point size
  attribute float aPhase;  // per-star twinkle phase
  attribute float aTint;   // 0 = white, 1 = cyan, 2 = violet
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vTint;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase);  // subtle twinkle
    vAlpha = tw;
    vTint = aTint;
    gl_PointSize = aSize * uPixelRatio * (170.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const STARS_FRAG = /* glsl */ `
  uniform float uDim;
  varying float vAlpha;
  varying float vTint;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float mask = smoothstep(0.5, 0.05, d);  // soft round sprite
    vec3 col = vec3(1.0);
    col = mix(col, vec3(0.55, 0.85, 1.0), step(0.5, vTint) * step(vTint, 1.5));
    col = mix(col, vec3(0.70, 0.55, 1.0), step(1.5, vTint));
    gl_FragColor = vec4(col, mask * vAlpha * uDim);
  }
`;

function Starfield({ count }: { count: number }) {
  const { reducedMotion, dim } = useContext(MotionContext);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const tint = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Seeded layout: stable across remounts, pure for the React 19 purity lint.
      const rand = makeRng(1337);
      const r = 26 + rand() * 34;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      size[i] = 0.5 + rand() * 1.9;
      phase[i] = rand() * Math.PI * 2;
      tint[i] = rand() < 0.55 ? 0 : rand() < 0.75 ? 1 : 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDim: { value: 1 }, // synced every frame from MotionContext (see useFrame),
          uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
        },
        vertexShader: STARS_VERT,
        fragmentShader: STARS_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    setUniform(material, 'uTime', reducedMotion ? 0 : state.clock.elapsedTime);
    setUniform(material, 'uDim', dim);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Nebulae — soft additive sprites from canvas radial gradients        */
/* ------------------------------------------------------------------ */

interface NebulaSpec {
  position: [number, number, number];
  scale: [number, number];
  color: THREE.Color;
  opacity: number;
  driftAmp: number;
  driftSpeed: number;
  phase: number;
}

const NEBULA_SPECS: NebulaSpec[] = [
  { position: [-11, 7.5, -14], scale: [26, 17], color: VIOLET, opacity: 0.20, driftAmp: 1.4, driftSpeed: 0.05, phase: 0.0 },
  { position: [10, 8.5, -16], scale: [30, 19], color: BLUE, opacity: 0.22, driftAmp: 1.2, driftSpeed: 0.04, phase: 2.1 },
  { position: [1, 9.5, -18], scale: [20, 13], color: CYAN, opacity: 0.12, driftAmp: 1.0, driftSpeed: 0.06, phase: 4.2 },
  { position: [-9, -5, -12], scale: [22, 14], color: BLUE, opacity: 0.14, driftAmp: 1.1, driftSpeed: 0.045, phase: 1.3 },
  { position: [12, -4, -13], scale: [18, 12], color: VIOLET, opacity: 0.13, driftAmp: 1.3, driftSpeed: 0.055, phase: 3.4 },
];

/** Soft round sprite texture generated once per color. */
function makeNebulaTexture(color: THREE.Color): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Two-stop radial gradient with a slightly denser core for depth.
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const c = `#${color.getHexString()}`;
    g.addColorStop(0, c);
    g.addColorStop(0.35, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // A second, smaller bright core sells the "glowing gas" look.
    const core = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 3);
    core.addColorStop(0, 'rgba(255,255,255,0.55)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Nebulae({ count, drift }: { count: number; drift: boolean }) {
  const { reducedMotion, dim } = useContext(MotionContext);
  const groupRef = useRef<THREE.Group>(null);

  const textures = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    for (const spec of NEBULA_SPECS.slice(0, count)) {
      const key = spec.color.getHexString();
      if (!map.has(key)) map.set(key, makeNebulaTexture(spec.color));
    }
    return map;
  }, [count]);

  useEffect(() => {
    return () => {
      textures.forEach((t) => t.dispose());
    };
  }, [textures]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group || !drift || reducedMotion) return;
    const t = state.clock.elapsedTime;
    // Slow positional drift — each sprite keeps its own base position.
    group.children.forEach((child, i) => {
      const spec = NEBULA_SPECS[i];
      if (!spec) return;
      child.position.set(
        spec.position[0] + Math.sin(t * spec.driftSpeed + spec.phase) * spec.driftAmp,
        spec.position[1] + Math.cos(t * spec.driftSpeed * 0.8 + spec.phase) * spec.driftAmp * 0.6,
        spec.position[2],
      );
    });
  });

  return (
    <group ref={groupRef}>
      {NEBULA_SPECS.slice(0, count).map((spec, i) => (
        <sprite key={i} position={spec.position} scale={[spec.scale[0], spec.scale[1], 1]}>
          <spriteMaterial
            map={textures.get(spec.color.getHexString())}
            color={spec.color}
            transparent
            opacity={spec.opacity * dim}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Asteroids — instanced crystalline shards (tumble + drift)           */
/* ------------------------------------------------------------------ */

interface AsteroidDatum {
  base: THREE.Vector3;
  scale: number;
  color: THREE.Color;
  rotSpeed: number;
  bobSpeed: number;
  phase: number;
}

function makeAsteroidData(count: number): AsteroidDatum[] {
  const rand = makeRng(4242);
  const tints = [new THREE.Color('#7fb2ff'), new THREE.Color('#a78bff'), new THREE.Color('#65dfff')];
  const data: AsteroidDatum[] = [];
  for (let i = 0; i < count; i++) {
    // Scatter in a wide band around the planet, never too close to the camera path.
    const angle = rand() * Math.PI * 2;
    const radius = 6.5 + rand() * 9;
    const tint = tints[i % tints.length] ?? new THREE.Color('#7fb2ff');
    data.push({
      base: new THREE.Vector3(
        PLANET_POS[0] + Math.cos(angle) * radius,
        -3.5 + rand() * 8.5,
        PLANET_POS[2] + Math.sin(angle) * radius * 0.7,
      ),
      scale: 0.08 + rand() * 0.3,
      color: tint.clone().multiplyScalar(0.55 + rand() * 0.45),
      rotSpeed: 0.15 + rand() * 0.5,
      bobSpeed: 0.2 + rand() * 0.5,
      phase: rand() * Math.PI * 2,
    });
  }
  return data;
}

function Asteroids({ count }: { count: number }) {
  const { reducedMotion } = useContext(MotionContext);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => makeAsteroidData(count), [count]);

  // Per-instance tint (crystalline blue/violet/cyan variation).
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    data.forEach((d, i) => mesh.setColorAt(i, d.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [data]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Frozen at t=0 under prefers-reduced-motion: a single static frame.
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    data.forEach((d, i) => {
      dummy.position.copy(d.base);
      dummy.position.y += Math.sin(t * d.bobSpeed + d.phase) * 0.28;
      dummy.rotation.set(d.phase + t * d.rotSpeed, d.phase * 1.7 + t * d.rotSpeed * 0.8, 0);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      {/* Crystalline: dark blue body, strong emissive tint, flat facets */}
      <meshStandardMaterial
        color="#16204a"
        emissive="#5a6cff"
        emissiveIntensity={0.55}
        metalness={0.85}
        roughness={0.28}
        flatShading
      />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/* Orbital routes — glowing elliptical rings with traveling pulses     */
/* ------------------------------------------------------------------ */

interface RingConfig {
  rx: number; // ellipse x radius
  rz: number; // ellipse z radius
  tilt: number; // radians, rotation about the x axis
  speed: number; // pulse travel speed
  color: THREE.Color;
}

const RING_CONFIGS: RingConfig[] = [
  { rx: 3.3, rz: 2.7, tilt: 0.38, speed: 0.22, color: CYAN },
  { rx: 3.9, rz: 3.3, tilt: -0.30, speed: 0.15, color: VIOLET },
  { rx: 2.9, rz: 4.1, tilt: 1.15, speed: 0.28, color: BLUE },
];

function ellipsePoint(cfg: RingConfig, u: number, out: THREE.Vector3): THREE.Vector3 {
  // Point on the tilted ellipse for parameter u in [0,1).
  const a = u * Math.PI * 2;
  const x = Math.cos(a) * cfg.rx;
  const z0 = Math.sin(a) * cfg.rz;
  const y = -Math.sin(cfg.tilt) * z0;
  const z = Math.cos(cfg.tilt) * z0;
  return out.set(x, y, z);
}

const RING_VERT = /* glsl */ `
  varying vec2 vUv;  // uv.x runs along the tube length
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  // Additive glowing route: faint base line + two bright pulses traveling along it.
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uDim;
  varying vec2 vUv;
  void main() {
    float base = 0.20;
    float p1 = fract(vUv.x - uTime * uSpeed);
    float dash1 = smoothstep(0.0, 0.025, p1) * smoothstep(0.085, 0.025, p1);
    float p2 = fract(vUv.x - uTime * uSpeed + 0.5);
    float dash2 = smoothstep(0.0, 0.025, p2) * smoothstep(0.085, 0.025, p2);
    float a = base + (dash1 + dash2) * 0.95;
    gl_FragColor = vec4(uColor, a * uDim);
  }
`;

function OrbitalRings({ count }: { count: number }) {
  const { reducedMotion, dim } = useContext(MotionContext);

  const rings = useMemo(() => {
    return RING_CONFIGS.slice(0, count).map((cfg) => {
      const pts: THREE.Vector3[] = [];
      const tmp = new THREE.Vector3();
      for (let i = 0; i < 200; i++) {
        pts.push(ellipsePoint(cfg, i / 200, tmp).clone());
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      // TubeGeometry maps uv.x along the tube: the shader's pulse coordinate.
      const geometry = new THREE.TubeGeometry(curve, 220, 0.014, 8, true);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: cfg.color },
          uSpeed: { value: cfg.speed },
          uDim: { value: 1 }, // synced every frame from MotionContext (see useFrame),
        },
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return { geometry, material };
    });
  }, [count]);

  useEffect(() => {
    return () => {
      rings.forEach((r) => {
        r.geometry.dispose();
        r.material.dispose();
      });
    };
  }, [rings]);

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    rings.forEach((r) => {
      setUniform(r.material, 'uTime', t);
      setUniform(r.material, 'uDim', dim);
    });
  });

  return (
    <group position={PLANET_POS}>
      {rings.map((r, i) => (
        <mesh key={i} geometry={r.geometry} material={r.material} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Satellites — tiny orbiters riding the first two rings               */
/* ------------------------------------------------------------------ */

function Satellite({ ringIndex, offset, blinkPhase }: { ringIndex: number; offset: number; blinkPhase: number }) {
  const { reducedMotion } = useContext(MotionContext);
  const groupRef = useRef<THREE.Group>(null);
  const lightMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const cfg = RING_CONFIGS[ringIndex] ?? RING_CONFIGS[0];
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const u = (t * (cfg?.speed ?? 0.2) * 0.55 + offset) % 1;
    if (cfg) ellipsePoint(cfg, u, pos);
    groupRef.current?.position.set(
      PLANET_POS[0] + pos.x,
      PLANET_POS[1] + pos.y,
      PLANET_POS[2] + pos.z,
    );
    // Navigation strobe.
    if (lightMatRef.current) {
      lightMatRef.current.emissiveIntensity = Math.sin(t * 6 + blinkPhase) > 0.4 ? 3.2 : 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Bus */}
      <mesh>
        <boxGeometry args={[0.16, 0.16, 0.22]} />
        <meshStandardMaterial color="#2a3a6e" metalness={0.9} roughness={0.35} />
      </mesh>
      {/* Solar wings */}
      <mesh position={[0.26, 0, 0]}>
        <boxGeometry args={[0.34, 0.02, 0.14]} />
        <meshStandardMaterial color="#1c2c5e" emissive="#438bff" emissiveIntensity={0.7} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[-0.26, 0, 0]}>
        <boxGeometry args={[0.34, 0.02, 0.14]} />
        <meshStandardMaterial color="#1c2c5e" emissive="#438bff" emissiveIntensity={0.7} metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Strobe */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial ref={lightMatRef} color="#bfe9ff" emissive="#65dfff" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Data particles — cyan motes rising through the scene                */
/* ------------------------------------------------------------------ */

const PARTICLES_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    // Rise and loop: y wraps from -3 to 5.
    p.y = mod(p.y + uTime * 0.55, 8.0) - 3.0;
    p.x += sin(uTime * 0.6 + aPhase) * 0.25;  // gentle lateral sway
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.0 + aPhase));
    gl_PointSize = aSize * uPixelRatio * (120.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLES_FRAG = /* glsl */ `
  uniform float uDim;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float mask = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(vec3(0.40, 0.87, 1.0), mask * vAlpha * 0.75 * uDim);
  }
`;

function DataParticles({ count }: { count: number }) {
  const { reducedMotion, dim } = useContext(MotionContext);

  const geometry = useMemo(() => {
    const rand = makeRng(9001);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -9 + rand() * 18;
      pos[i * 3 + 1] = -3 + rand() * 8;
      pos[i * 3 + 2] = -7 + rand() * 8;
      size[i] = 0.5 + rand() * 1.3;
      phase[i] = rand() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDim: { value: 1 }, // synced every frame from MotionContext (see useFrame),
          uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio : 1 },
        },
        vertexShader: PARTICLES_VERT,
        fragmentShader: PARTICLES_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    setUniform(material, 'uTime', reducedMotion ? 0 : state.clock.elapsedTime);
    setUniform(material, 'uDim', dim);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Liquid foreground — fake reflective dark water at the bottom        */
/* ------------------------------------------------------------------ */

const LIQUID_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LIQUID_FRAG = /* glsl */ `
  // Fake reflection: mirrored planet-glow smear + animated caustics over a
  // dark base. No real reflector — a single full-screen-ish quad, O(1).
  uniform float uTime;
  uniform float uDim;
  uniform vec3 uPlanet;  // planet world position (for the reflection smear)
  varying vec2 vUv;
  varying vec3 vWorld;
  ${NOISE_GLSL}
  void main() {
    vec2 p = vWorld.xz * 0.32;

    // Ripple field: two fbm layers, the fine one perturbed by the coarse one.
    float n1 = fbm(vec3(p * 1.4, uTime * 0.10));
    float n2 = fbm(vec3(p * 3.6 + n1 * 1.8, uTime * 0.18));

    vec3 deep = vec3(0.008, 0.015, 0.045);
    vec3 lift = vec3(0.030, 0.090, 0.220);
    vec3 col = mix(deep, lift, n2 * 0.55);

    // Planet-glow reflection: horizontal gaussian smear under the planet,
    // shimmering with the ripple field.
    float dx = (vWorld.x - uPlanet.x) / 7.0;
    float smear = exp(-dx * dx) * exp(-abs(vWorld.z - uPlanet.z) * 0.10);
    float shimmer = 0.6 + 0.4 * sin(vWorld.x * 5.0 + n1 * 9.0 + uTime * 1.1);
    vec3 glowCol = mix(vec3(0.20, 0.50, 1.0), vec3(0.35, 0.85, 1.0), shimmer);
    col += glowCol * smear * (0.30 + 0.70 * n2) * 0.9 * uDim;

    // Caustic sparkle bands drifting across the surface.
    float ca = pow(1.0 - abs(sin((n1 + n2) * 11.0 + uTime * 0.35)), 8.0);
    col += vec3(0.25, 0.60, 1.0) * ca * 0.16 * uDim;

    // Dissolve into space toward the horizon (far edge of the plane).
    float fade = 1.0 - smoothstep(0.55, 1.0, vUv.y);
    gl_FragColor = vec4(col, fade);
  }
`;

function LiquidForeground() {
  const { reducedMotion, dim } = useContext(MotionContext);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDim: { value: 1 }, // synced every frame from MotionContext (see useFrame),
          uPlanet: { value: new THREE.Vector3(...PLANET_POS) },
        },
        vertexShader: LIQUID_VERT,
        fragmentShader: LIQUID_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((state) => {
    setUniform(material, 'uTime', reducedMotion ? 0 : state.clock.elapsedTime);
    setUniform(material, 'uDim', dim);
  });

  return (
    <mesh
      material={material}
      position={[0, -4.6, -1]}
      rotation={[-Math.PI * 0.42, 0, 0]}
    >
      <planeGeometry args={[52, 14]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* CameraRig — smooth mouse parallax (off under reduced motion)        */
/* ------------------------------------------------------------------ */

const CAM_HOME: [number, number, number] = [0, 0.6, 13];

function CameraRig() {
  const { reducedMotion } = useContext(MotionContext);
  const pointer = useThree((s) => s.pointer);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    // Small, heavily damped parallax toward the pointer.
    const k = Math.min(1, delta * 2.2);
    const cam = _.camera;
    cam.position.x += (pointer.x * 0.8 - cam.position.x) * k;
    cam.position.y += (CAM_HOME[1] + pointer.y * 0.45 - cam.position.y) * k;
    cam.position.z += (CAM_HOME[2] - cam.position.z) * k;
    cam.lookAt(1.0, 0.2, 0);
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Context-loss watcher — swap to the CSS fallback if the GPU dies      */
/* ------------------------------------------------------------------ */

function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const handler = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    canvas.addEventListener('webglcontextlost', handler);
    return () => canvas.removeEventListener('webglcontextlost', handler);
  }, [gl, onLost]);
  return null;
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function CosmicBackground({ variant = 'full', className = '' }: CosmicBackgroundProps) {
  const [webglOk, setWebglOk] = useState<boolean>(() =>
    typeof window !== 'undefined' ? checkWebGL() : false,
  );
  const [env, setEnv] = useState<Env>(() => readEnv());

  // Track viewport / motion-preference changes (mobile tiering + reduced motion).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compute = () => setEnv(readEnv());
    compute();
    window.addEventListener('resize', compute);
    mq.addEventListener('change', compute);
    return () => {
      window.removeEventListener('resize', compute);
      mq.removeEventListener('change', compute);
    };
  }, []);

  const quality = useMemo(() => resolveQuality(variant, env.mobile), [variant, env.mobile]);
  const motion = useMemo(
    () => ({ reducedMotion: env.reducedMotion, dim: quality.dim }),
    [env.reducedMotion, quality.dim],
  );

  if (!webglOk) {
    return <CosmicBackgroundFallback className={className} dim={quality.dim} />;
  }

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <CosmicErrorBoundary>
        <MotionContext.Provider value={motion}>
          <Canvas
            dpr={quality.dpr}
            frameloop="always"
            camera={{ position: CAM_HOME, fov: 55, near: 0.1, far: 120 }}
            gl={{
              antialias: true,
              alpha: false,
              stencil: false,
              depth: true,
              powerPreference: 'high-performance',
            }}
            onCreated={({ gl }) => gl.setClearColor(BG)}
            style={{ width: '100%', height: '100%' }}
          >
            <color attach="background" args={[BG]} />
            <ContextLossWatcher onLost={() => setWebglOk(false)} />

            {/* Cinematic lighting: cool-blue key, violet rim, very low ambient */}
            <ambientLight intensity={0.12} color="#8a9bff" />
            <directionalLight position={[-6, 4, 6]} intensity={1.6} color="#7fb2ff" />
            <directionalLight position={[6, -2, -5]} intensity={1.1} color="#8a5cff" />
            <pointLight position={[PLANET_POS[0], PLANET_POS[1], PLANET_POS[2] + 4]} intensity={24} distance={14} color="#65dfff" />

            <Starfield count={quality.stars} />
            <Nebulae count={quality.nebulae} drift={quality.drift} />
            <Planet />
            <OrbitalRings count={quality.rings} />
            <Asteroids count={quality.asteroids} />
            {quality.satellites && (
              <>
                <Satellite ringIndex={0} offset={0.1} blinkPhase={0} />
                <Satellite ringIndex={1} offset={0.65} blinkPhase={2.4} />
              </>
            )}
            <DataParticles count={quality.particles} />
            <LiquidForeground />
            <CameraRig />
          </Canvas>
        </MotionContext.Provider>
      </CosmicErrorBoundary>
    </div>
  );
}
