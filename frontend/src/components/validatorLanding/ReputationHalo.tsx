'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { clamp, easeInOutCubic } from '@/components/landing/utils';
import { HALO_RANGE } from './validatorSceneConfig';

const RINGS = [
  { radius: 1.35, tilt: 1.32, speed: 0.22 },
  { radius: 1.75, tilt: 1.42, speed: -0.16 },
  { radius: 2.15, tilt: 1.36, speed: 0.11 },
];

/**
 * The reputation act: rings of light accrue around the examined idea, one per
 * beat of the copy — every helpful review adds standing. They fade with the
 * final push-in so the closing CTA gets a clean frame.
 */
export default function ReputationHalo() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame((state) => {
    const progress = scrollProgressStore.get();
    const [start, end] = HALO_RANGE;
    const span = end - start;
    const time = state.clock.elapsedTime;
    // gentle global fade-out after the halo act so the final CTA is clean
    const exit = 1 - clamp((progress - end) / 0.045);

    RINGS.forEach((ring, i) => {
      const g = groups.current[i];
      const m = mats.current[i];
      // each ring earns its place sequentially across the act
      const act = easeInOutCubic(clamp((progress - (start + (i * span) / 4)) / (span / 3))) * exit;
      if (g) {
        g.visible = act > 0.01;
        g.rotation.y = time * ring.speed;
        const s = 0.85 + act * 0.15;
        g.scale.setScalar(s);
      }
      if (m) m.opacity = act * 0.75;
    });
  });

  return (
    <group position={[0, -0.1, 0]}>
      {RINGS.map((ring, i) => (
        <group key={i} ref={(g) => { groups.current[i] = g; }} rotation={[ring.tilt, 0, 0.12 * (i - 1)]} visible={false}>
          <mesh>
            <torusGeometry args={[ring.radius, 0.016, 12, 96]} />
            <meshStandardMaterial
              ref={(m) => { mats.current[i] = m; }}
              color="#60a5fa"
              emissive="#3b82f6"
              emissiveIntensity={1.5}
              transparent
              opacity={0}
              toneMapped={false}
            />
          </mesh>
          {/* two bright beads per ring — reviews riding the orbit */}
          {[0, Math.PI].map((phase, j) => (
            <mesh key={j} position={[Math.cos(phase + i) * ring.radius, 0, Math.sin(phase + i) * ring.radius]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={2.2} transparent opacity={0.9} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
