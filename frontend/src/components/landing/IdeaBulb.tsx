'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { scrollProgressStore } from './useScrollProgress';
import { BULB_TIMELINE, BULB_POSITION_KEYFRAMES, FRAMEWORKS_RANGE } from './sceneConfig';
import { findSegment, lerp, lerpVec3 } from './utils';
import { activeFrameworkIndex } from './frameworkLayout';

// Smooth, recognisable bulb silhouette: narrow neck, wide round glass dome.
const GLASS_PROFILE: [number, number][] = [
  [0.0, -0.58],
  [0.26, -0.56],
  [0.34, -0.48],
  [0.42, -0.32],
  [0.52, -0.1],
  [0.58, 0.12],
  [0.6, 0.32],
  [0.55, 0.52],
  [0.44, 0.67],
  [0.28, 0.76],
  [0.1, 0.8],
  [0.0, 0.81],
];

function latheGeometry(points: [number, number][], segments = 64) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments
  );
}

function filamentCurve() {
  const pts: THREE.Vector3[] = [];
  const turns = 3.2;
  const height = 0.5;
  const baseY = -0.2;
  const radius = 0.11;
  const segments = 56;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    const y = baseY + t * height;
    const r = radius * (1 - 0.2 * Math.sin(t * Math.PI));
    pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

// A handful of short jagged polylines across the glass surface — the
// "crack" read, without decal textures or fracture geometry. Built as
// plain THREE.Line objects (via <primitive>) rather than the JSX <line>
// intrinsic, which collides with the SVG <line> element's TS typing.
function crackLines(): THREE.Line[] {
  const seeds: { origin: THREE.Vector3; dir: THREE.Vector3 }[] = [
    { origin: new THREE.Vector3(0.35, 0.25, 0.42), dir: new THREE.Vector3(-0.3, 0.5, -0.1) },
    { origin: new THREE.Vector3(-0.4, 0.05, 0.38), dir: new THREE.Vector3(0.2, -0.4, 0.1) },
    { origin: new THREE.Vector3(0.1, 0.55, -0.35), dir: new THREE.Vector3(0.35, -0.2, 0.2) },
    { origin: new THREE.Vector3(-0.3, -0.15, -0.4), dir: new THREE.Vector3(0.15, 0.45, 0.15) },
  ];

  return seeds.map(({ origin, dir }) => {
    const pts: THREE.Vector3[] = [origin.clone()];
    let cur = origin.clone();
    for (let i = 0; i < 3; i++) {
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.15
      );
      cur = cur.clone().add(dir.clone().multiplyScalar(0.18)).add(jitter);
      pts.push(cur);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    // restrained amber, not red — "needs attention," not "failure"
    const mat = new THREE.LineBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0, toneMapped: false });
    return new THREE.Line(geo, mat);
  });
}

// On a white page, an additive white-on-white glow is invisible — these
// need real color saturation baked in so the glow visibly tints the
// background blue rather than trying (and failing) to brighten it.
function glowTexture(sharp: boolean) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (sharp) {
    gradient.addColorStop(0, 'rgba(59,130,246,0.95)');
    gradient.addColorStop(0.2, 'rgba(96,165,250,0.55)');
    gradient.addColorStop(1, 'rgba(96,165,250,0)');
  } else {
    gradient.addColorStop(0, 'rgba(147,197,253,0.5)');
    gradient.addColorStop(0.35, 'rgba(191,219,254,0.22)');
    gradient.addColorStop(1, 'rgba(191,219,254,0)');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function shadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(15,23,42,0.32)');
  gradient.addColorStop(0.6, 'rgba(15,23,42,0.13)');
  gradient.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface Props {
  reducedMotion: boolean;
}

const tmpColorA = new THREE.Color();
const tmpColorB = new THREE.Color();

export default function IdeaBulb({ reducedMotion }: Props) {
  const glassGeo = useMemo(() => latheGeometry(GLASS_PROFILE), []);
  const filamentGeo = useMemo(() => new THREE.TubeGeometry(filamentCurve(), 120, 0.011, 8, false), []);
  const cracks = useMemo(() => (typeof document !== 'undefined' ? crackLines() : []), []);
  const hotspot = useMemo(() => (typeof document !== 'undefined' ? glowTexture(true) : null), []);
  const halo = useMemo(() => (typeof document !== 'undefined' ? glowTexture(false) : null), []);
  const shadow = useMemo(() => (typeof document !== 'undefined' ? shadowTexture() : null), []);

  const glassMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const rimMat = useRef<THREE.MeshBasicMaterial>(null);
  const filamentMat = useRef<THREE.MeshBasicMaterial>(null);
  const hotspotRef = useRef<THREE.Sprite>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const progress = scrollProgressStore.get();

    const bulbSeg = findSegment(BULB_TIMELINE, progress);
    let brightness = lerp(bulbSeg.from.brightness, bulbSeg.to.brightness, bulbSeg.localT);
    const instability = lerp(bulbSeg.from.instability, bulbSeg.to.instability, bulbSeg.localT);

    // a brief brightness bump each time a framework's validation pulse
    // reaches the bulb — a visible "reaction," not just a steady ramp
    if (progress >= FRAMEWORKS_RANGE[0] && progress <= FRAMEWORKS_RANGE[1]) {
      const { localT: focusT } = activeFrameworkIndex(progress);
      if (focusT >= 0.4 && focusT <= 0.6) {
        brightness += Math.sin(((focusT - 0.4) / 0.2) * Math.PI) * 0.12;
      }
    }
    tmpColorA.set(bulbSeg.from.tint);
    tmpColorB.set(bulbSeg.to.tint);
    const tint = tmpColorA.clone().lerp(tmpColorB, bulbSeg.localT);

    const posSeg = findSegment(BULB_POSITION_KEYFRAMES, progress);
    const pos = lerpVec3(posSeg.from.pos, posSeg.to.pos, posSeg.localT);

    const t = state.clock.elapsedTime;
    const flicker = instability > 0.05 && !reducedMotion ? (Math.random() - 0.5) * instability * 0.25 : 0;

    if (filamentMat.current) {
      filamentMat.current.color.copy(tint);
      filamentMat.current.opacity = Math.min(1, 0.3 + brightness * 1.7 + flicker);
    }
    if (glassMat.current) {
      glassMat.current.emissive.copy(tint);
      // kept deliberately low relative to transmission/reflections — the
      // glass should read as clear glass with light inside it, not as a
      // solid tinted ball
      glassMat.current.emissiveIntensity = 0.035 + brightness * 0.55 + flicker * 0.3;
    }
    if (rimMat.current) {
      rimMat.current.color.copy(tint);
      // stronger floor so the silhouette reads clearly even at the dim
      // start of the story, not just once the story-brightness ramps up
      rimMat.current.opacity = 0.22 + brightness * 0.3;
    }

    const glowScale = 0.9 + brightness * 1.5;
    if (hotspotRef.current) {
      hotspotRef.current.scale.setScalar(glowScale * 0.55);
      (hotspotRef.current.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.35 + brightness * 0.75 + flicker);
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(glowScale * 1.6);
      (haloRef.current.material as THREE.SpriteMaterial).opacity = 0.18 + brightness * 0.4;
      (haloRef.current.material as THREE.SpriteMaterial).color.copy(tint);
    }

    cracks.forEach((line) => {
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = instability * (0.55 + (reducedMotion ? 0 : Math.sin(t * 6 + Math.random()) * 0.15));
    });

    if (groupRef.current) {
      groupRef.current.position.set(pos[0], pos[1], pos[2]);
      if (!reducedMotion) {
        groupRef.current.rotation.y = t * 0.05 + (instability > 0.05 ? Math.sin(t * 9) * instability * 0.02 : 0);
        groupRef.current.rotation.z = instability > 0.05 ? Math.sin(t * 7) * instability * 0.015 : 0;
      }
    }
  });

  return (
    <Float speed={reducedMotion ? 0 : 1.1} rotationIntensity={0} floatIntensity={reducedMotion ? 0 : 0.35}>
      <group ref={groupRef}>
        {/* metal screw base: several stacked rings instead of one cylinder */}
        <group position={[0, -0.78, 0]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, -i * 0.045, 0]}>
              <cylinderGeometry args={[0.24 - (i % 2) * 0.015, 0.24, 0.03, 32]} />
              <meshStandardMaterial color="#84848d" metalness={0.95} roughness={0.28} />
            </mesh>
          ))}
          <mesh position={[0, -0.24, 0]}>
            <cylinderGeometry args={[0.21, 0.21, 0.05, 32]} />
            <meshStandardMaterial color="#54545c" metalness={0.9} roughness={0.4} />
          </mesh>
        </group>

        {/* fixed key light, local to the bulb — always gives the glass a
            consistent specular highlight/reflection regardless of where
            the bulb currently sits or how bright the story-brightness is,
            the classic product-photography rim light trick */}
        <pointLight position={[0.7, 0.55, 1.3]} intensity={1.1} color="#eef1ff" distance={4} decay={2} />

        <mesh geometry={glassGeo}>
          <meshPhysicalMaterial
            ref={glassMat}
            color="#eef1fb"
            transmission={0.86}
            thickness={0.55}
            roughness={0.065}
            ior={1.5}
            emissive="#1e3a5f"
            emissiveIntensity={0.035}
            clearcoat={1}
            clearcoatRoughness={0.08}
            envMapIntensity={2.1}
            transparent
          />
        </mesh>

        {/* thin back-face rim shell — cheap fresnel-edge glow without a
            custom shader: only the silhouette edge reads, the object
            stays otherwise clear */}
        <mesh geometry={glassGeo} scale={1.045}>
          <meshBasicMaterial ref={rimMat} color="#1e3a5f" transparent opacity={0.22} side={THREE.BackSide} toneMapped={false} />
        </mesh>

        <mesh geometry={filamentGeo}>
          <meshBasicMaterial ref={filamentMat} color="#1e3a5f" transparent opacity={0.3} toneMapped={false} />
        </mesh>

        {cracks.map((line, i) => (
          <primitive key={i} object={line} />
        ))}

        {/* soft grounding shadow beneath the bulb — cheap depth cue on a
            light page, not real shadow-mapping */}
        {shadow && (
          <sprite position={[0, -1.05, 0]} scale={[1.25, 0.4, 1]}>
            <spriteMaterial map={shadow} transparent depthWrite={false} />
          </sprite>
        )}

        {hotspot && (
          <sprite ref={hotspotRef} position={[0, 0.08, 0]}>
            <spriteMaterial map={hotspot} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )}
        {halo && (
          <sprite ref={haloRef} position={[0, 0.08, 0]}>
            <spriteMaterial map={halo} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )}
      </group>
    </Float>
  );
}
