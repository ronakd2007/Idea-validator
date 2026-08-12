'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollProgressStore } from './useScrollProgress';
import { BULB_TIMELINE, BULB_POSITION_KEYFRAMES } from './sceneConfig';
import { findSegment, lerp, lerpVec3 } from './utils';

/**
 * On the light page, ambient stays high so every object reads clearly
 * from the very first frame (a near-black ambient made sense on the old
 * dark scene where "the environment brightens" was the whole point — on
 * white, ambient just needs to be present so nothing renders as a dark
 * silhouette). The bulb's own key light still ramps up with brightness
 * for "the idea itself gets brighter" and follows its position keyframes
 * since the bulb relocates across the story instead of staying at the origin.
 */
export default function LightingRig() {
  const key = useRef<THREE.PointLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);

  useFrame(() => {
    const progress = scrollProgressStore.get();
    const { from, to, localT } = findSegment(BULB_TIMELINE, progress);
    const brightness = lerp(from.brightness, to.brightness, localT);
    const tint = localT < 0.5 ? from.tint : to.tint;

    const posSeg = findSegment(BULB_POSITION_KEYFRAMES, progress);
    const pos = lerpVec3(posSeg.from.pos, posSeg.to.pos, posSeg.localT);

    if (key.current) {
      key.current.intensity = 1.2 + brightness * 9;
      key.current.color.set(tint);
      key.current.position.set(pos[0], pos[1], pos[2]);
    }
    if (ambient.current) {
      // slightly less flat than before — too much ambient washes out the
      // glass's own shading/form, which read as "pale/heavy" against white
      ambient.current.intensity = 0.4 + brightness * 0.12;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.4} color="#dce6f5" />
      <pointLight ref={key} position={[0, 0, 0]} intensity={1.5} distance={12} decay={2} />
      <pointLight position={[-4, 2, -3]} intensity={0.35} color="#bfdbfe" distance={14} decay={2} />
    </>
  );
}
