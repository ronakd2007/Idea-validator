'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { findSegment, lerpVec3 } from '@/components/landing/utils';
import { CAMERA_KEYFRAMES } from './validatorSceneConfig';

/**
 * Same contract as the founder landing's CameraRig — keyframed dolly with
 * identical-stop holds and a soft mouse parallax on desktop — minus the
 * framework-node nudge, which has no equivalent here.
 */
export default function ValidatorCameraRig({ reducedMotion, isMobile }: { reducedMotion: boolean; isMobile: boolean }) {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const parallax = useRef({ x: 0, y: 0 });
  const parallaxEnabled = !reducedMotion && !isMobile;

  useEffect(() => {
    if (!parallaxEnabled) return;
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [parallaxEnabled]);

  useFrame(() => {
    const progress = scrollProgressStore.get();
    const { from, to, localT } = findSegment(CAMERA_KEYFRAMES, progress);
    const pos = lerpVec3(from.pos, to.pos, localT);
    const look = lerpVec3(from.look, to.look, localT);

    parallax.current.x += (mouse.current.x - parallax.current.x) * 0.04;
    parallax.current.y += (mouse.current.y - parallax.current.y) * 0.04;
    const strength = parallaxEnabled ? 0.22 : 0;

    camera.position.set(pos[0] + parallax.current.x * strength, pos[1] + parallax.current.y * strength, pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
  });

  return null;
}
