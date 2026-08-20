'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { windowActivation } from '@/components/landing/utils';
import { LENS_RANGE, lensX } from './validatorSceneConfig';

/**
 * The analysis lens — a slowly spinning instrument ring that travels across
 * the specimen bulb once, left to right, during the lens act. The bulb's
 * pulse as it passes is driven from the shared config (lensProximityPulse),
 * so ring and reaction can never drift apart.
 */
export default function LensSweep() {
  const group = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const discMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const progress = scrollProgressStore.get();
    const act = windowActivation(progress, LENS_RANGE, 0.02, 0.025);
    if (group.current) {
      group.current.visible = act > 0.01;
      group.current.position.x = lensX(progress);
      group.current.rotation.z = state.clock.elapsedTime * 0.3;
    }
    if (ringMat.current) ringMat.current.opacity = act;
    if (discMat.current) discMat.current.opacity = act * 0.13;
  });

  return (
    <group ref={group} position={[-3.6, 0.05, 1.2]} rotation={[0.05, -0.2, 0]} visible={false}>
      <mesh>
        <torusGeometry args={[1.35, 0.045, 16, 80]} />
        <meshStandardMaterial ref={ringMat} color="#2563eb" metalness={0.85} roughness={0.22} transparent opacity={0} />
      </mesh>
      <mesh>
        <circleGeometry args={[1.31, 56]} />
        <meshBasicMaterial ref={discMat} color="#60a5fa" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* instrument ticks at the quarters */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[Math.cos((i * Math.PI) / 2) * 1.35, Math.sin((i * Math.PI) / 2) * 1.35, 0]}
          rotation={[0, 0, (i * Math.PI) / 2]}
        >
          <boxGeometry args={[0.2, 0.025, 0.025]} />
          <meshStandardMaterial color="#1d4ed8" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
