'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { scrollProgressStore } from './useScrollProgress';
import {
  BULB_POSITION_KEYFRAMES,
  FRAMEWORKS,
  FRAMEWORKS_RANGE,
  WEAKNESS_RANGE,
  IMPROVEMENT_RANGE,
  SCORE_RANGE,
  COMPONENTS_APPEAR_RANGE,
  COMPONENTS_CONVERGE_RANGE,
  EXPERTS_RANGE,
} from './sceneConfig';
import { findSegment, lerpVec3, clamp, lerp, windowActivation, type Vec3 } from './utils';
import { frameworkNodePosition, fanLayout, activeFrameworkIndex, frameworkActivation } from './frameworkLayout';

const IDEA_COMPONENTS = ['Problem', 'Solution', 'Target Customer', 'Market', 'Business Model', 'Revenue'];
const EXPERTS = ['Industry Expert', 'Market Expert', 'Finance Expert', 'Technology Expert', 'Customer Expert', 'Entrepreneur'];

function getBulbPos(progress: number): Vec3 {
  const seg = findSegment(BULB_POSITION_KEYFRAMES, progress);
  return lerpVec3(seg.from.pos, seg.to.pos, seg.localT);
}

// ---------------------------------------------------------------------------
// Shared presentational shard + connector — the one node primitive reused
// (with small geometry variation) across idea components, experts, and
// framework indicators.
// ---------------------------------------------------------------------------
function useShardRefs() {
  const shard = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  // plain THREE.Line via <primitive> — the JSX <line> intrinsic collides
  // with the SVG <line> element's TS typing in this project's setup.
  const connector = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0, toneMapped: false });
    return new THREE.Line(geo, mat);
  }, []);
  const labelEl = useRef<HTMLDivElement>(null);
  return { shard, mat, connector, labelEl };
}

function applyShard(
  refs: ReturnType<typeof useShardRefs>,
  worldPos: Vec3,
  bulbPos: Vec3,
  activation: number,
  color: string,
  baseScale: number,
  lineColor: string = color
) {
  if (refs.shard.current) {
    refs.shard.current.position.set(worldPos[0], worldPos[1], worldPos[2]);
    refs.shard.current.scale.setScalar(baseScale * (0.7 + activation * 0.5));
  }
  if (refs.mat.current) {
    refs.mat.current.color.set(color);
    refs.mat.current.emissive.set(color);
    refs.mat.current.emissiveIntensity = 0.4 + activation * 1.8;
    refs.mat.current.opacity = clamp(activation * 1.3);
  }
  refs.connector.geometry.setFromPoints([new THREE.Vector3(...bulbPos), new THREE.Vector3(...worldPos)]);
  const connectorMat = refs.connector.material as THREE.LineBasicMaterial;
  connectorMat.color.set(lineColor);
  // a firm floor once a node starts appearing — on a light page, thin
  // lines under ~0.3 opacity read as "barely there"
  connectorMat.opacity = activation > 0.04 ? Math.min(0.85, 0.3 + activation * 0.55) : 0;
  if (refs.labelEl.current) {
    refs.labelEl.current.style.opacity = String(clamp((activation - 0.5) * 2));
  }
}

function ComponentNode({ index, isMobile }: { index: number; isMobile: boolean }) {
  const refs = useShardRefs();
  const total = IDEA_COMPONENTS.length;

  useFrame(() => {
    const progress = scrollProgressStore.get();
    const bulbPos = getBulbPos(progress);

    // slight per-node stagger so labels cascade in rather than popping
    // together, on top of the fan layout's own vertical separation
    const [appearStart, appearEnd] = COMPONENTS_APPEAR_RANGE;
    const staggeredStart = appearStart + index * 0.008;
    const appear = windowActivation(progress, [staggeredStart, appearEnd], 0.025, 0.015);

    const settle = fanLayout(index, total, 1.05, 2.3, 0.5);
    const from: Vec3 = [settle[0] * 2.4, settle[1] * 2.4, settle[2] * 2.4];
    let rel = lerpVec3(from, settle, clamp(appear * 1.4));
    let activation = appear;

    // Scene 03 — components converge into the bulb as the idea is submitted
    const [convergeStart, convergeEnd] = COMPONENTS_CONVERGE_RANGE;
    if (progress >= convergeStart) {
      const c = clamp((progress - convergeStart) / (convergeEnd - convergeStart));
      rel = lerpVec3(settle, [0, 0, 0], c);
      activation = lerp(1, 0, c);
    }

    const worldPos: Vec3 = [bulbPos[0] + rel[0], bulbPos[1] + rel[1], bulbPos[2] + rel[2]];
    // muted slate shard, small blue accent on the connector only — these
    // are structure, not validation, so blue stays a small accent
    applyShard(refs, worldPos, bulbPos, activation, '#64748b', 0.07, '#3b82f6');
  });

  return (
    <group>
      <mesh ref={refs.shard}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={refs.mat} transparent opacity={0} roughness={0.35} metalness={0.15} />
        {/* World-space labels are tuned for a wide desktop viewport — on a
            narrow phone screen the same positions project into the headline
            column and sit on top of it. Below md, the shard + connector line
            still read as a live ring; only the DOM label caption drops. */}
        {!isMobile && (
          <Html center distanceFactor={9} style={{ pointerEvents: 'none' }}>
            <div ref={refs.labelEl} style={{ opacity: 0 }} className="bg-white/85 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide text-slate-700 uppercase whitespace-nowrap transition-opacity">
              {IDEA_COMPONENTS[index]}
            </div>
          </Html>
        )}
      </mesh>
      <primitive object={refs.connector} />
    </group>
  );
}

const EXPERT_INACTIVE = new THREE.Color('#64748b');
const EXPERT_ACTIVE = new THREE.Color('#3b82f6');
const expertColorTmp = new THREE.Color();

function ExpertNode({ index, isMobile }: { index: number; isMobile: boolean }) {
  const refs = useShardRefs();
  const total = EXPERTS.length;

  useFrame(() => {
    const progress = scrollProgressStore.get();
    const [start, end] = EXPERTS_RANGE;
    const staggeredStart = start + index * 0.007;
    const activation = windowActivation(progress, [staggeredStart, end], 0.02, 0.03);
    const bulbPos = getBulbPos(progress);
    // fan out on the opposite side from where components appeared, reading
    // as a validation network converging on the bulb from the right
    const settle = fanLayout(index, total, 1.35, 2.3, 0.55);
    settle[0] = -settle[0];
    const from: Vec3 = [settle[0] * 1.6, settle[1], settle[2] - 0.6];
    const rel = lerpVec3(from, settle, clamp(activation * 1.4));
    const worldPos: Vec3 = [bulbPos[0] + rel[0], bulbPos[1] + rel[1], bulbPos[2] + rel[2]];
    // white/gray when inactive, blue once this expert has engaged —
    // the connecting line itself always reads as elegant electric blue
    expertColorTmp.copy(EXPERT_INACTIVE).lerp(EXPERT_ACTIVE, clamp(activation * 1.3));
    applyShard(refs, worldPos, bulbPos, activation, `#${expertColorTmp.getHexString()}`, 0.08, '#3b82f6');
  });

  return (
    <group>
      <mesh ref={refs.shard}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={refs.mat} transparent opacity={0} roughness={0.3} metalness={0.2} />
        {!isMobile && (
          <Html center distanceFactor={9} style={{ pointerEvents: 'none' }}>
            <div ref={refs.labelEl} style={{ opacity: 0 }} className="bg-white/85 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide text-blue-700 uppercase whitespace-nowrap transition-opacity">
              {EXPERTS[index]}
            </div>
          </Html>
        )}
      </mesh>
      <primitive object={refs.connector} />
    </group>
  );
}

// Framework node color states: inactive (not yet reached, light gray) ->
// evaluating (currently spotlit, soft blue) -> validated (settled,
// electric blue, deepening toward a richer saturated blue as the score
// approaches — on a light page "more saturated" reads as "more confident,"
// the inverse of the old dark-theme "trending toward white" treatment).
// Weak areas get restrained amber instead of red, recovering to electric
// blue during improvement.
const FW_INACTIVE = new THREE.Color('#cbd5e1');
const FW_EVALUATING = new THREE.Color('#60a5fa');
const FW_VALIDATED = new THREE.Color('#3b82f6');
const FW_VALIDATED_BRIGHT = new THREE.Color('#1d4ed8');
const HEALTHY_COLOR = new THREE.Color('#3b82f6');
const WEAK_COLOR = new THREE.Color('#f59e0b');
const tmpColor = new THREE.Color();

function FrameworkNode({ index, isMobile }: { index: number; isMobile: boolean }) {
  const refs = useShardRefs();
  const scoreEl = useRef<HTMLSpanElement>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null);
  const fw = FRAMEWORKS[index];

  useFrame(() => {
    const progress = scrollProgressStore.get();
    const activation = frameworkActivation(index, progress);
    const bulbPos = getBulbPos(progress);
    const { index: spotlightIndex, localT: focusT } = activeFrameworkIndex(progress);
    const isSpotlit = spotlightIndex === index;

    let rel = frameworkNodePosition(index);

    // converge toward the bulb during the score-reveal push-in
    const [scoreStart, scoreEnd] = SCORE_RANGE;
    if (progress >= scoreStart) {
      const c = clamp((progress - scoreStart) / (scoreEnd - scoreStart));
      rel = lerpVec3(rel, [0, 0, 0], c * 0.92);
    }

    const worldPos: Vec3 = [bulbPos[0] + rel[0], bulbPos[1] + rel[1], bulbPos[2] + rel[2]];

    // color state: dark gray (inactive) -> soft blue (being evaluated) ->
    // electric blue settling toward blue-white (validated, near the score)
    let colorHex: string;
    if (isSpotlit) {
      colorHex = `#${FW_EVALUATING.getHexString()}`;
    } else if (activation < 0.15) {
      colorHex = `#${FW_INACTIVE.getHexString()}`;
    } else {
      const nearScore = clamp((progress - FRAMEWORKS_RANGE[1]) / (SCORE_RANGE[0] - FRAMEWORKS_RANGE[1] + 0.001));
      tmpColor.copy(FW_VALIDATED).lerp(FW_VALIDATED_BRIGHT, nearScore * 0.6);
      colorHex = `#${tmpColor.getHexString()}`;
    }

    // weak nodes go amber/unstable during the weakness window instead,
    // recovering to electric blue during improvement
    if (fw.weak) {
      const [wStart, wEnd] = WEAKNESS_RANGE;
      const [, iEnd] = IMPROVEMENT_RANGE;
      if (progress >= wStart && progress < wEnd) {
        colorHex = `#${WEAK_COLOR.getHexString()}`;
      } else if (progress >= wEnd && progress < iEnd) {
        const recover = clamp((progress - wEnd) / (iEnd - wEnd));
        tmpColor.copy(WEAK_COLOR).lerp(HEALTHY_COLOR, recover);
        colorHex = `#${tmpColor.getHexString()}`;
      }
    }

    applyShard(refs, worldPos, bulbPos, Math.max(activation, isSpotlit ? 1 : activation), colorHex, 0.075);

    // a small pulse of light travels node -> bulb as this framework
    // activates, then the bulb gets a brief brightness bump (in IdeaBulb)
    if (pulse.current && pulseMat.current) {
      const travel = clamp(focusT / 0.45);
      const show = isSpotlit && focusT < 0.45;
      pulse.current.visible = show;
      if (show) {
        const p = lerpVec3(worldPos, bulbPos, travel);
        pulse.current.position.set(p[0], p[1], p[2]);
        pulseMat.current.opacity = 1 - travel;
      }
    }

    if (refs.labelEl.current) {
      const showScore =
        isSpotlit || (fw.weak && progress >= WEAKNESS_RANGE[0] && progress < IMPROVEMENT_RANGE[1]);
      refs.labelEl.current.style.opacity = showScore ? String(clamp(activation * 1.5)) : '0';
    }

    if (scoreEl.current && fw.weak && fw.improvedScore != null) {
      const [, wEnd] = WEAKNESS_RANGE;
      const [, iEnd] = IMPROVEMENT_RANGE;
      if (progress >= wEnd && progress < iEnd) {
        const recover = clamp((progress - wEnd) / (iEnd - wEnd));
        const shown = Math.round(lerp(fw.score, fw.improvedScore, recover));
        scoreEl.current.textContent = `${shown}/100`;
      } else if (progress >= iEnd) {
        scoreEl.current.textContent = `${fw.improvedScore}/100`;
      } else {
        scoreEl.current.textContent = `${fw.score}/100`;
      }
    }
  });

  return (
    <group>
      <mesh ref={refs.shard}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={refs.mat} transparent opacity={0} roughness={0.25} metalness={0.25} />
        {/* distanceFactor 7 (was 9) — these labels rendered large enough to
            reach into the headline column even after the ring was tightened.
            Below md they're dropped entirely — see the isMobile note above. */}
        {!isMobile && (
          <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
            <div ref={refs.labelEl} style={{ opacity: 0 }} className="bg-white/85 px-2 py-1 rounded-md text-center transition-opacity">
              <div className="text-[10px] font-semibold tracking-wide text-slate-800 uppercase whitespace-nowrap">{fw.name}</div>
              <span ref={scoreEl} className="text-[9px] text-slate-500">
                {fw.score}/100
              </span>
            </div>
          </Html>
        )}
      </mesh>
      <primitive object={refs.connector} />
      <mesh ref={pulse} visible={false}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial ref={pulseMat} color="#2563eb" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

const SCAN_RANGE: [number, number] = [0.34, 0.63];

function ScanRing() {
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    const progress = scrollProgressStore.get();
    const activation = windowActivation(progress, SCAN_RANGE, 0.02, 0.02);
    const bulbPos = getBulbPos(progress);
    if (ring.current) {
      ring.current.position.set(bulbPos[0], bulbPos[1], bulbPos[2]);
      ring.current.rotation.x = Math.PI / 2.4;
      ring.current.rotation.y = state.clock.elapsedTime * 0.6;
      const scale = 0.92 + Math.sin(state.clock.elapsedTime * 1.4) * 0.04;
      ring.current.scale.setScalar(scale);
    }
    if (mat.current) mat.current.opacity = activation * 0.5;
  });

  return (
    <mesh ref={ring}>
      <torusGeometry args={[0.95, 0.006, 8, 96]} />
      <meshBasicMaterial ref={mat} color="#60a5fa" transparent opacity={0} toneMapped={false} />
    </mesh>
  );
}

export default function OrbitNodes({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <>
      {IDEA_COMPONENTS.map((_, i) => (
        <ComponentNode key={`c${i}`} index={i} isMobile={isMobile} />
      ))}
      {EXPERTS.map((_, i) => (
        <ExpertNode key={`e${i}`} index={i} isMobile={isMobile} />
      ))}
      {FRAMEWORKS.map((_, i) => (
        <FrameworkNode key={`f${i}`} index={i} isMobile={isMobile} />
      ))}
      <ScanRing />
    </>
  );
}
