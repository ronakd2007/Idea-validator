'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { clamp, easeInOutCubic, lerp } from '@/components/landing/utils';
import { FRAMEWORKS } from '@/components/landing/sceneConfig';
import { FACETS_BURST_RANGE, STACK_RANGE, STACK_FADE_RANGE } from './validatorSceneConfig';

const RING_RADIUS = 2.35;
const RING_Y = 0.15;
// where the cards stack for the verdict act — left of centre, in front
const STACK_POS: [number, number, number] = [-1.35, -0.66, 0.9];
const STACK_STEP = 0.082;

/**
 * The 12 validation dimensions as orbiting facet chips. They burst out of the
 * bulb as the lens finishes its sweep (the idea fracturing into its scoreable
 * parts), orbit while the copy explains them, then swirl into a stack — the
 * validator's scorecard — and hand off to the DOM panel.
 *
 * Chips are glowing anchors + Html labels (the founder landing's OrbitNodes
 * technique) — crisp text at every zoom, no font-atlas loading.
 */
export default function FacetRing() {
  const anchors = useRef<(THREE.Group | null)[]>([]);
  const dotMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);

  useFrame((state) => {
    const progress = scrollProgressStore.get();
    const time = state.clock.elapsedTime;
    const [burstStart] = FACETS_BURST_RANGE;
    const [stackStart, stackEnd] = STACK_RANGE;
    const [fadeStart, fadeEnd] = STACK_FADE_RANGE;

    for (let i = 0; i < FRAMEWORKS.length; i++) {
      const g = anchors.current[i];
      if (!g) continue;

      const burstT = easeInOutCubic(clamp((progress - (burstStart + i * 0.005)) / 0.08));
      const stackT = easeInOutCubic(clamp((progress - (stackStart + i * 0.006)) / (stackEnd - stackStart)));
      const fadeT = clamp((progress - fadeStart) / (fadeEnd - fadeStart));
      const opacity = burstT * (1 - fadeT);

      g.visible = opacity > 0.01;
      if (!g.visible) continue;

      // orbit slows to a halt as the stack pulls the chips in
      const angle = (i / FRAMEWORKS.length) * Math.PI * 2 + time * 0.14 * (1 - stackT);
      const ringX = Math.cos(angle) * RING_RADIUS;
      const ringZ = Math.sin(angle) * RING_RADIUS;
      const bob = Math.sin(time * 0.8 + i) * 0.06 * (1 - stackT);

      // origin (inside the bulb) -> ring -> stack
      const x = lerp(lerp(0, ringX, burstT), STACK_POS[0], stackT);
      const y = lerp(lerp(-0.1, RING_Y + bob, burstT), STACK_POS[1] + i * STACK_STEP, stackT);
      const z = lerp(lerp(0, ringZ, burstT), STACK_POS[2], stackT);
      g.position.set(x, y, z);

      const mat = dotMats.current[i];
      if (mat) mat.opacity = opacity;
      const el = labels.current[i];
      if (el) el.style.opacity = String(opacity);
    }
  });

  return (
    <>
      {FRAMEWORKS.map((f, i) => (
        <group key={f.name} ref={(g) => { anchors.current[i] = g; }} visible={false}>
          <mesh>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial
              ref={(m) => { dotMats.current[i] = m; }}
              color="#60a5fa"
              emissive="#3b82f6"
              emissiveIntensity={1.6}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
          <Html center distanceFactor={9} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
            <div
              ref={(el) => { labels.current[i] = el; }}
              style={{ opacity: 0, transform: 'translateY(-18px)' }}
              className="whitespace-nowrap text-[10px] font-medium text-slate-700 bg-white/85 backdrop-blur-sm border border-slate-200 rounded-full px-2.5 py-1 shadow-sm"
            >
              {f.name}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}
