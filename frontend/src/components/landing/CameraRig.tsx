'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { scrollProgressStore } from './useScrollProgress';
import { CAMERA_KEYFRAMES } from './sceneConfig';
import { findSegment, lerpVec3 } from './utils';
import { activeFrameworkIndex, frameworkNodePosition } from './frameworkLayout';

interface Props {
  reducedMotion: boolean;
  isMobile: boolean;
}

/**
 * Moves the camera along CAMERA_KEYFRAMES as scroll progress advances.
 * Consecutive keyframes with identical pos/look create a "hold" for free
 * (localT interpolates between two equal points -> nothing visibly moves).
 * A small mouse-parallax offset is layered on top on desktop only.
 */
export default function CameraRig({ reducedMotion, isMobile }: Props) {
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

    const strength = parallaxEnabled ? 0.25 : 0;

    // small nudge toward whichever framework is currently spotlighted —
    // the camera leans in, it never jumps or reframes hard.
    let nudgeX = 0;
    let nudgeY = 0;
    const { index, localT: focusT } = activeFrameworkIndex(progress);
    if (index >= 0 && !reducedMotion) {
      const [nx, ny] = frameworkNodePosition(index);
      const lean = Math.sin(focusT * Math.PI) * 0.22;
      nudgeX = nx * 0.12 * lean;
      nudgeY = ny * 0.12 * lean;
    }

    camera.position.set(
      pos[0] + parallax.current.x * strength + nudgeX,
      pos[1] + parallax.current.y * strength + nudgeY,
      pos[2]
    );
    camera.lookAt(look[0] + nudgeX * 0.6, look[1] + nudgeY * 0.6, look[2]);
  });

  return null;
}
