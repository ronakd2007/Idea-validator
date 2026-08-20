'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { windowActivation } from '@/components/landing/utils';

/**
 * The examination stage: a slowly rotating glass disc with a lit rim that the
 * idea bulb descends onto. It stays for the whole story — the constant that
 * says "this is a place where ideas get examined."
 */
export default function SpecimenStage({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const discMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const rimMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    const progress = scrollProgressStore.get();
    // fades in with the hero, never leaves
    const act = windowActivation(progress, [0.02, 1.0], 0.03, 0);
    if (group.current && !reducedMotion) group.current.rotation.y = state.clock.elapsedTime * 0.15;
    if (discMat.current) discMat.current.opacity = act * 0.85;
    if (rimMat.current) rimMat.current.opacity = act;
  });

  return (
    <group ref={group} position={[0, -1.16, 0]}>
      <mesh>
        <cylinderGeometry args={[1.55, 1.55, 0.07, 64]} />
        <meshPhysicalMaterial
          ref={discMat}
          color="#eaf2ff"
          transmission={0.55}
          thickness={0.3}
          roughness={0.18}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <torusGeometry args={[1.55, 0.02, 12, 96]} />
        <meshStandardMaterial ref={rimMat} color="#3b82f6" emissive="#3b82f6" emissiveIntensity={1.4} transparent opacity={0} toneMapped={false} />
      </mesh>
      {/* four small feet so it doesn't float unexplained */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 2 + 0.4) * 1.2, -0.14, Math.sin((i * Math.PI) / 2 + 0.4) * 1.2]}>
          <cylinderGeometry args={[0.035, 0.05, 0.16, 12]} />
          <meshStandardMaterial color="#8d95a6" metalness={0.75} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}
