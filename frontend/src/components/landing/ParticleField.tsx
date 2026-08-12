'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollProgressStore } from './useScrollProgress';
import { BULB_TIMELINE } from './sceneConfig';
import { findSegment, lerp } from './utils';

interface Props {
  count: number;
  animate: boolean;
}

/**
 * Minimal ambient particle field — plain THREE.Points, no extra library.
 * Kept sparse and dim on purpose: it should read as depth/atmosphere
 * around the bulb, never compete with it for attention.
 */
export default function ParticleField({ count, animate }: Props) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 6 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = radius * Math.cos(phi) * 0.6;
      arr[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (points.current && animate) {
      points.current.rotation.y = state.clock.elapsedTime * 0.008;
    }
    if (mat.current) {
      const progress = scrollProgressStore.get();
      const { from, to, localT } = findSegment(BULB_TIMELINE, progress);
      const brightness = lerp(from.brightness, to.brightness, localT);
      // particles catch a faint bit of the bulb's light as it brightens
      mat.current.opacity = 0.28 + brightness * 0.25;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} size={0.035} color="#60a5fa" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}
