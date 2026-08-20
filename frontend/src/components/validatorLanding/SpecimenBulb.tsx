'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { findSegment, lerp } from '@/components/landing/utils';
import { GLASS_PROFILE, latheGeometry, filamentCurve } from '@/components/landing/IdeaBulb';
import { BULB_Y_KEYFRAMES, GLOW_KEYFRAMES, lensProximityPulse } from './validatorSceneConfig';

/**
 * The idea under examination — the same bulb silhouette as the founder
 * landing (shared geometry, shared material recipe), arriving from above and
 * settling onto the specimen stage. Its filament pulses as the lens passes:
 * the idea reacting to being examined.
 */
export default function SpecimenBulb({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const filamentMat = useRef<THREE.MeshStandardMaterial>(null);

  const glassGeo = useMemo(() => latheGeometry(GLASS_PROFILE), []);
  const filamentGeo = useMemo(() => new THREE.TubeGeometry(filamentCurve(), 200, 0.028, 10, false), []);

  useFrame(() => {
    const progress = scrollProgressStore.get();

    const ySeg = findSegment(BULB_Y_KEYFRAMES, progress);
    const y = lerp(ySeg.from.y, ySeg.to.y, ySeg.localT);
    if (group.current) group.current.position.y = y;

    const gSeg = findSegment(GLOW_KEYFRAMES, progress);
    const glow = lerp(gSeg.from.glow, gSeg.to.glow, gSeg.localT) + lensProximityPulse(progress);
    if (filamentMat.current) {
      filamentMat.current.emissiveIntensity = 1.5 + glow * 7;
      filamentMat.current.emissive.set(glow > 0.9 ? '#eaf2ff' : '#7db4ff');
    }
  });

  return (
    <group ref={group} position={[0, 2.9, 0]} scale={1.05}>
      <Float speed={reducedMotion ? 0 : 1.1} rotationIntensity={0.08} floatIntensity={0.12}>
        <group>
          {/* glass — same physical recipe as the founder bulb */}
          <mesh geometry={glassGeo}>
            <meshPhysicalMaterial
              color="#f4f7ff"
              transmission={0.9}
              thickness={0.42}
              roughness={0.055}
              ior={1.5}
              transparent
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* filament */}
          <mesh geometry={filamentGeo}>
            <meshStandardMaterial
              ref={filamentMat}
              color="#9cc4ff"
              emissive="#7db4ff"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
          {/* metal base */}
          <mesh position={[0, -0.72, 0]}>
            <cylinderGeometry args={[0.27, 0.24, 0.3, 32]} />
            <meshStandardMaterial color="#84848d" metalness={0.95} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 0.08, 24]} />
            <meshStandardMaterial color="#54545c" metalness={0.9} roughness={0.4} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}
