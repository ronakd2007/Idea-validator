'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { findSegment, lerp } from '@/components/landing/utils';
import { GLOW_KEYFRAMES, lensProximityPulse } from './validatorSceneConfig';

/**
 * Cooler than the founder rig on purpose — this is the examination room, not
 * the workshop. The key light lives at the bulb and follows its glow curve,
 * spiking when the lens passes over the specimen.
 */
export default function ValidatorLightingRig() {
  const key = useRef<THREE.PointLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);

  useFrame(() => {
    const progress = scrollProgressStore.get();
    const { from, to, localT } = findSegment(GLOW_KEYFRAMES, progress);
    const glow = lerp(from.glow, to.glow, localT) + lensProximityPulse(progress) * 0.5;

    if (key.current) key.current.intensity = 1.0 + glow * 8;
    if (ambient.current) ambient.current.intensity = 0.42 + glow * 0.1;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.42} color="#dce6f5" />
      <pointLight ref={key} position={[0, 0.1, 0]} color="#9cc4ff" intensity={1.5} distance={12} decay={2} />
      {/* cool rim from the left, faint white bounce from below the stage */}
      <pointLight position={[-4, 2, -2.5]} intensity={0.4} color="#bfdbfe" distance={14} decay={2} />
      <pointLight position={[0, -2.2, 1.5]} intensity={0.3} color="#ffffff" distance={8} decay={2} />
    </>
  );
}
