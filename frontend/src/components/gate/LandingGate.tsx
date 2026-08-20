'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SceneEnvironment from '@/components/landing/SceneEnvironment';
import IdeaBulb from '@/components/landing/IdeaBulb';
import ParticleField from '@/components/landing/ParticleField';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { useDeviceCapabilities } from '@/components/landing/useDeviceCapabilities';

export type LandingRole = 'founder' | 'validator';
const ROLE_KEY = 'iv_landing_role';

/**
 * "One idea, two gazes" — the entry gate at /. A single idea bulb floats
 * centre-screen; hovering the founder half warms the scene and sketches
 * blueprint fragments around the bulb, hovering the validator half cools it
 * and swings an analysis lens in. Clicking commits: the camera dives through
 * the bulb and the visitor lands on /founders or /validators.
 *
 * Mutable singleton (not React state) so the R3F frame loop reads the lean
 * without re-rendering — same pattern as scrollProgressStore.
 */
const leanStore = { target: 0, value: 0, dive: 0, diving: false };

function GateCameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state, delta) => {
    // Spring the lean toward its target; advance the dive once committed.
    leanStore.value += (leanStore.target - leanStore.value) * Math.min(1, delta * 5);
    if (leanStore.diving && !reducedMotion) {
      leanStore.dive = Math.min(1, leanStore.dive + delta * 1.9);
    }
    const lean = reducedMotion ? 0 : leanStore.value;
    const dive = leanStore.dive;
    const z = 8.4 - dive * dive * 6.6; // accelerates as it approaches the glass
    state.camera.position.set(lean * 0.55, 0.25 + dive * 0.1, z);
    state.camera.lookAt(lean * 0.9, 0.15, 0);
  });
  return null;
}

// Warm founder key on the left, cool validator key on the right — each fades
// with the lean so the bulb is literally lit by the visitor's choice.
function GateLights() {
  const warm = useRef<THREE.PointLight>(null);
  const cool = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const founder = Math.max(0, -leanStore.value);
    const validator = Math.max(0, leanStore.value);
    if (warm.current) warm.current.intensity = 0.4 + founder * 5;
    if (cool.current) cool.current.intensity = 0.4 + validator * 5;
  });
  return (
    <>
      <ambientLight intensity={0.5} color="#dce6f5" />
      <pointLight position={[0, 0.3, 1.5]} intensity={2.4} color="#9cc4ff" distance={10} decay={2} />
      <pointLight ref={warm} position={[-3.4, 1.2, 2.2]} color="#ffc97a" distance={12} decay={2} intensity={0.4} />
      <pointLight ref={cool} position={[3.4, 1.2, 2.2]} color="#60a5fa" distance={12} decay={2} intensity={0.4} />
    </>
  );
}

// Founder gaze: blueprint fragments sketching themselves around the bulb.
function SketchFragments() {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  useFrame((state) => {
    const founder = Math.max(0, -leanStore.value) * (1 - leanStore.dive);
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.12;
      group.current.visible = founder > 0.02;
    }
    mats.current.forEach((m) => { if (m) m.opacity = founder * 0.65; });
  });
  const setMat = (i: number) => (m: THREE.MeshBasicMaterial) => { if (m) mats.current[i] = m; };
  return (
    <group ref={group} position={[-2.4, 0.2, -0.4]}>
      <mesh position={[0, 0.7, 0]} rotation={[0.4, 0.6, 0]}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial ref={setMat(0)} color="#f59e0b" wireframe transparent opacity={0} />
      </mesh>
      <mesh position={[-0.6, -0.5, 0.3]} rotation={[0.2, 0.3, 0.5]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshBasicMaterial ref={setMat(1)} color="#fbbf24" wireframe transparent opacity={0} />
      </mesh>
      <mesh position={[0.7, -0.2, -0.2]} rotation={[1.2, 0, 0.4]}>
        <torusGeometry args={[0.4, 0.02, 8, 40]} />
        <meshBasicMaterial ref={setMat(2)} color="#f59e0b" wireframe transparent opacity={0} />
      </mesh>
    </group>
  );
}

// Validator gaze: an analysis lens ring swinging in beside the bulb.
function AnalysisLens() {
  const group = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const discMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    const validator = Math.max(0, leanStore.value) * (1 - leanStore.dive);
    if (group.current) {
      group.current.visible = validator > 0.02;
      group.current.rotation.z = state.clock.elapsedTime * 0.25;
      // slides in from off-right as the visitor leans validator
      group.current.position.x = 3.4 - validator * 1.1;
      const s = 0.6 + validator * 0.4;
      group.current.scale.setScalar(s);
    }
    if (ringMat.current) ringMat.current.opacity = validator;
    if (discMat.current) discMat.current.opacity = validator * 0.14;
  });
  return (
    <group ref={group} position={[2.5, 0.3, 0.6]} rotation={[0.15, -0.5, 0]}>
      <mesh>
        <torusGeometry args={[1.05, 0.045, 16, 72]} />
        <meshStandardMaterial ref={ringMat} color="#2563eb" metalness={0.85} roughness={0.25} transparent opacity={0} />
      </mesh>
      <mesh>
        <circleGeometry args={[1.02, 48]} />
        <meshBasicMaterial ref={discMat} color="#60a5fa" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* tick marks — the "instrument" read */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2) * 1.05, Math.sin((i * Math.PI) / 2) * 1.05, 0]} rotation={[0, 0, (i * Math.PI) / 2]}>
          <boxGeometry args={[0.16, 0.02, 0.02]} />
          <meshStandardMaterial color="#1d4ed8" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// The hero bulb reused verbatim. At scroll progress 0 it renders its hero
// state at [1.5, -0.05, 0] scaled 1.75; the wrapper group re-centres it.
function CenteredBulb({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group position={[-1.5, 0.05, 0]}>
      <IdeaBulb reducedMotion={reducedMotion} />
    </group>
  );
}

const ROLE_COPY: Record<LandingRole, { title: string; body: string; cta: string; accent: string }> = {
  founder: {
    title: 'I have an idea',
    body: 'Validate it with experts and real customers — before you build.',
    cta: 'Enter as Founder',
    accent: 'group-hover:border-amber-300',
  },
  validator: {
    title: 'I evaluate ideas',
    body: 'Score real startup ideas. Lend your judgment, build your reputation.',
    cta: 'Enter as Validator',
    accent: 'group-hover:border-blue-400',
  },
};

export default function LandingGate() {
  const router = useRouter();
  const { reducedMotion, isMobile } = useDeviceCapabilities();
  const [hover, setHover] = useState<LandingRole | null>(null);
  const [committing, setCommitting] = useState<LandingRole | null>(null);
  const [remembered, setRemembered] = useState<LandingRole | null>(null);

  useEffect(() => {
    // The lean/scroll singletons persist across client-side navigation —
    // reset them so returning from a scrolled landing doesn't start mid-state.
    scrollProgressStore.set(0);
    leanStore.target = 0;
    leanStore.value = 0;
    leanStore.dive = 0;
    leanStore.diving = false;
    try {
      const r = localStorage.getItem(ROLE_KEY);
      if (r === 'founder' || r === 'validator') setRemembered(r);
    } catch { /* private mode */ }
  }, []);

  const lean = (side: LandingRole | null) => {
    setHover(side);
    leanStore.target = side === 'founder' ? -1 : side === 'validator' ? 1 : 0;
  };

  const commit = (role: LandingRole) => {
    if (committing) return;
    setCommitting(role);
    try { localStorage.setItem(ROLE_KEY, role); } catch { /* private mode */ }
    leanStore.target = role === 'founder' ? -1 : 1;
    leanStore.diving = true;
    const dest = role === 'founder' ? '/founders' : '/validators';
    // The white-out overlay and the camera dive share this timing.
    window.setTimeout(() => router.push(dest), reducedMotion ? 120 : 560);
  };

  const particleCount = isMobile ? 50 : 160;

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#f8fafc]">
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0, 0.25, 8.4], fov: 42 }}
          dpr={[1, isMobile ? 1.5 : 2]}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        >
          <color attach="background" args={['#f8fafc']} />
          <fog attach="fog" args={['#f8fafc', 7, 18]} />
          <SceneEnvironment />
          <GateCameraRig reducedMotion={reducedMotion} />
          <GateLights />
          <CenteredBulb reducedMotion={reducedMotion} />
          {!isMobile && <SketchFragments />}
          {!isMobile && <AnalysisLens />}
          <ParticleField count={particleCount} animate={!reducedMotion} />
        </Canvas>
      </div>

      {/* soft atmosphere, matching the landings */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(59,130,246,0.05), transparent 60%), linear-gradient(to bottom, rgba(255,255,255,0.35), transparent 30%, transparent 70%, rgba(255,255,255,0.5))',
        }}
      />

      {/* hover halves — desktop only; on mobile the cards themselves are the targets */}
      {!isMobile && !committing && (
        <>
          <button
            aria-label="Enter as Founder"
            className="absolute left-0 top-0 h-full w-1/2 cursor-pointer focus:outline-none"
            onMouseEnter={() => lean('founder')}
            onMouseLeave={() => lean(null)}
            onFocus={() => lean('founder')}
            onBlur={() => lean(null)}
            onClick={() => commit('founder')}
          />
          <button
            aria-label="Enter as Validator"
            className="absolute right-0 top-0 h-full w-1/2 cursor-pointer focus:outline-none"
            onMouseEnter={() => lean('validator')}
            onMouseLeave={() => lean(null)}
            onFocus={() => lean('validator')}
            onBlur={() => lean(null)}
            onClick={() => commit('validator')}
          />
        </>
      )}

      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-5 pointer-events-none" style={{ zIndex: 30 }}>
        <span className="text-sm font-bold tracking-tight text-slate-900">
          Idea<span className="text-blue-600">Validator</span>
        </span>
        <div className="flex items-center gap-3 pointer-events-auto">
          {remembered && !committing && (
            <Link
              href={remembered === 'founder' ? '/founders' : '/validators'}
              className="text-xs bg-white/80 backdrop-blur border border-slate-200 text-slate-600 px-3.5 py-1.5 rounded-full hover:border-slate-300"
            >
              Continue as {remembered === 'founder' ? 'Founder' : 'Validator'} →
            </Link>
          )}
          <Link href="/auth/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5">
            Sign in
          </Link>
        </div>
      </div>

      {/* headline */}
      <div className="absolute top-[16%] sm:top-[13%] left-0 right-0 text-center px-6 pointer-events-none" style={{ zIndex: 20 }}>
        <p className="text-[11px] font-semibold tracking-[0.3em] text-blue-600 mb-3">IDEAVALIDATOR</p>
        <h1 className="text-4xl sm:text-6xl font-semibold text-slate-900 tracking-tight leading-[1.05]">
          Every idea has two sides.
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-500">Which one are you?</p>
      </div>

      {/* side flavour chips — appear with each gaze (desktop) */}
      {!isMobile && (
        <>
          <div
            className="absolute left-10 top-[38%] space-y-2 pointer-events-none transition-opacity duration-300"
            style={{ zIndex: 20, opacity: hover === 'founder' ? 1 : 0 }}
          >
            {['Problem worth solving?', 'Would customers pay?', 'Can you build it?'].map((t) => (
              <p key={t} className="text-xs text-amber-700/80 bg-amber-50/80 backdrop-blur border border-amber-200/70 rounded-full px-3 py-1.5 w-fit">{t}</p>
            ))}
          </div>
          <div
            className="absolute right-10 top-[38%] space-y-2 pointer-events-none transition-opacity duration-300 text-right"
            style={{ zIndex: 20, opacity: hover === 'validator' ? 1 : 0 }}
          >
            {['Market Opportunity · 8/10', 'Feasibility · 7/10', 'Verdict: promising'].map((t) => (
              <p key={t} className="text-xs text-blue-700/80 bg-blue-50/80 backdrop-blur border border-blue-200/70 rounded-full px-3 py-1.5 w-fit ml-auto">{t}</p>
            ))}
          </div>
        </>
      )}

      {/* role cards */}
      <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-12 pb-6 sm:pb-10 grid sm:grid-cols-2 gap-3 sm:gap-6 pointer-events-none" style={{ zIndex: 25 }}>
        {(['founder', 'validator'] as LandingRole[]).map((role) => {
          const c = ROLE_COPY[role];
          const active = hover === role;
          return (
            <button
              key={role}
              onClick={() => commit(role)}
              onMouseEnter={() => !isMobile && lean(role)}
              onMouseLeave={() => !isMobile && lean(null)}
              disabled={!!committing}
              className={`group pointer-events-auto text-left bg-white/75 backdrop-blur-md border rounded-2xl px-6 py-5 transition-all duration-300 ${
                active ? 'border-slate-300 shadow-lg -translate-y-1' : 'border-slate-200 shadow-sm'
              } ${role === 'validator' ? 'sm:text-right' : ''} ${c.accent}`}
            >
              <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-400 mb-1">
                {role === 'founder' ? 'FOR FOUNDERS' : 'FOR EXPERTS'}
              </p>
              <p className="text-xl sm:text-2xl font-semibold text-slate-900">{c.title}</p>
              <p className="text-sm text-slate-500 mt-1.5 mb-4">{c.body}</p>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-5 py-2.5 transition-colors ${
                  role === 'founder'
                    ? 'bg-slate-900 text-white group-hover:bg-slate-800'
                    : 'bg-blue-600 text-white group-hover:bg-blue-700'
                }`}
              >
                {c.cta} →
              </span>
            </button>
          );
        })}
      </div>

      {/* commit white-out — the camera dives, this catches the landing */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          zIndex: 40,
          opacity: committing ? 1 : 0,
          background: 'radial-gradient(ellipse 70% 60% at 50% 45%, #ffffff 30%, #eff6ff 70%, #dbeafe 100%)',
        }}
      />
    </div>
  );
}
