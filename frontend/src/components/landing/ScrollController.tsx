'use client';
import { useEffect } from 'react';
import { scrollProgressStore } from './useScrollProgress';
import { TOTAL_SCROLL_VH } from './sceneConfig';
import { useDeviceCapabilities } from './useDeviceCapabilities';

/**
 * Drives scrollProgressStore from real scroll position and renders the
 * tall spacer that creates scroll distance for the whole experience.
 * Uses Lenis for smooth/cinematic easing normally; falls back to plain
 * native scroll tracking under prefers-reduced-motion (no smoothing).
 * `totalVh` lets other scroll scenes (the validator landing) reuse this
 * with their own timeline length; the founder landing passes nothing.
 */
export default function ScrollController({ totalVh = TOTAL_SCROLL_VH }: { totalVh?: number } = {}) {
  const { reducedMotion } = useDeviceCapabilities();

  useEffect(() => {
    let rafId: number;
    let cleanup = () => {};
    let cancelled = false;

    const computeNativeProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgressStore.set(max > 0 ? window.scrollY / max : 0);
    };

    if (reducedMotion) {
      computeNativeProgress();
      window.addEventListener('scroll', computeNativeProgress, { passive: true });
      window.addEventListener('resize', computeNativeProgress);
      cleanup = () => {
        window.removeEventListener('scroll', computeNativeProgress);
        window.removeEventListener('resize', computeNativeProgress);
      };
    } else {
      (async () => {
        const { default: Lenis } = await import('lenis');
        if (cancelled) return;
        const lenis = new Lenis({ duration: 1.15, smoothWheel: true });

        lenis.on('scroll', ({ scroll, limit }: { scroll: number; limit: number }) => {
          scrollProgressStore.set(limit > 0 ? scroll / limit : 0);
        });

        const raf = (time: number) => {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);

        cleanup = () => {
          cancelAnimationFrame(rafId);
          lenis.destroy();
        };
      })();
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reducedMotion]);

  return <div style={{ height: `${totalVh}vh` }} aria-hidden />;
}
