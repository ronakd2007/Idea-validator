'use client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import ScrollController from './ScrollController';
import CameraRig from './CameraRig';
import LightingRig from './LightingRig';
import SceneEnvironment from './SceneEnvironment';
import IdeaBulb from './IdeaBulb';
import OrbitNodes from './OrbitNodes';
import ParticleField from './ParticleField';
import SceneText from './SceneText';
import ScoreReveal from './ScoreReveal';
import InsightDashboard from './InsightDashboard';
import FinalMoment from './FinalMoment';
import StageIndicator from './StageIndicator';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { TOTAL_SCROLL_VH } from './sceneConfig';

export default function IdeaValidatorLanding() {
  const { reducedMotion, isMobile } = useDeviceCapabilities();
  const particleCount = isMobile ? 60 : reducedMotion ? 80 : 260;

  return (
    <div className="relative bg-[#f8fafc]" style={{ minHeight: `${TOTAL_SCROLL_VH}vh` }}>
      <div className="fixed inset-0">
        <Canvas
          camera={{ position: [0, 0.3, 9.5], fov: 42 }}
          dpr={[1, isMobile ? 1.5 : 2]}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        >
          <color attach="background" args={['#f8fafc']} />
          <fog attach="fog" args={['#f8fafc', 6, 19]} />
          <SceneEnvironment />
          <CameraRig reducedMotion={reducedMotion} isMobile={isMobile} />
          <LightingRig />
          <IdeaBulb reducedMotion={reducedMotion} />
          <OrbitNodes />
          <ParticleField count={particleCount} animate={!reducedMotion} />
        </Canvas>
      </div>

      {/* extremely subtle blue atmosphere so a plain white canvas doesn't
          feel flat — cheap CSS, no render cost */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 8,
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(59,130,246,0.05), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(37,99,235,0.04), transparent 55%)',
        }}
      />

      <SceneText />
      <ScoreReveal />
      <InsightDashboard />
      <FinalMoment />
      <StageIndicator />

      <ScrollController />
    </div>
  );
}
