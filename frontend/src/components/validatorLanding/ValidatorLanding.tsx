'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SceneEnvironment from '@/components/landing/SceneEnvironment';
import ParticleField from '@/components/landing/ParticleField';
import ScrollController from '@/components/landing/ScrollController';
import { scrollProgressStore } from '@/components/landing/useScrollProgress';
import { useDeviceCapabilities } from '@/components/landing/useDeviceCapabilities';
import ValidatorCameraRig from './ValidatorCameraRig';
import ValidatorLightingRig from './ValidatorLightingRig';
import SpecimenStage from './SpecimenStage';
import SpecimenBulb from './SpecimenBulb';
import LensSweep from './LensSweep';
import FacetRing from './FacetRing';
import ReputationHalo from './ReputationHalo';
import ValidatorSceneText from './ValidatorSceneText';
import ScorecardPanel from './ScorecardPanel';
import { TOTAL_VALIDATOR_SCROLL_VH } from './validatorSceneConfig';

/**
 * "Under the Lens" — the validator-facing scroll story. Same architecture as
 * the founder landing (fixed Canvas + keyframed camera + winner-take-all DOM
 * overlays driven by one scroll store), same palette and bulb, opposite gaze:
 * this page is about examining ideas, not having them.
 */
export default function ValidatorLanding() {
  const { reducedMotion, isMobile } = useDeviceCapabilities();
  const particleCount = isMobile ? 50 : reducedMotion ? 70 : 200;

  useEffect(() => {
    // the store is a module singleton — arriving from a scrolled page must
    // not start this story mid-timeline
    scrollProgressStore.set(0);
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="relative bg-[#f8fafc]" style={{ minHeight: `${TOTAL_VALIDATOR_SCROLL_VH}vh` }}>
      <div className="fixed inset-0">
        <Canvas
          camera={{ position: [0, 0.6, 9.6], fov: 42 }}
          dpr={[1, isMobile ? 1.5 : 2]}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        >
          <color attach="background" args={['#f8fafc']} />
          <fog attach="fog" args={['#f8fafc', 6, 19]} />
          <SceneEnvironment />
          <ValidatorCameraRig reducedMotion={reducedMotion} isMobile={isMobile} />
          <ValidatorLightingRig />
          <SpecimenStage reducedMotion={reducedMotion} />
          <SpecimenBulb reducedMotion={reducedMotion} />
          <LensSweep />
          <FacetRing />
          <ReputationHalo />
          <ParticleField count={particleCount} animate={!reducedMotion} />
        </Canvas>
      </div>

      {/* the founder landing's subtle blue atmosphere, mirrored */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 8,
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(59,130,246,0.05), transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(37,99,235,0.04), transparent 55%)',
        }}
      />

      {/* minimal fixed nav */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-5" style={{ zIndex: 30 }}>
        <Link href="/" className="text-sm font-bold tracking-tight text-slate-900">
          Idea<span className="text-blue-600">Validator</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/founders" className="text-xs bg-white/80 backdrop-blur border border-slate-200 text-slate-600 px-3.5 py-1.5 rounded-full hover:border-slate-300">
            I&apos;m a founder →
          </Link>
          <Link href="/auth/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5">
            Sign in
          </Link>
        </div>
      </div>

      <ValidatorSceneText />
      <ScorecardPanel />

      <ScrollController totalVh={TOTAL_VALIDATOR_SCROLL_VH} />
    </div>
  );
}
