'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { scrollProgressStore } from './useScrollProgress';
import { BULB_TIMELINE, BULB_POSITION_KEYFRAMES, BULB_SCALE_KEYFRAMES, FRAMEWORKS_RANGE } from './sceneConfig';
import { findSegment, lerp, lerpVec3, clamp } from './utils';
import { VALIDATION_NODES, VALIDATION_EDGES, nodeActivation, networkActivation } from './validationNetwork';
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

// Deliberately oversized for a real filament — it fills most of the glass, the
// way the tall blue LED-style coil does in the reference hero.
function filamentCurve() {
  const pts: THREE.Vector3[] = [];
  const turns = 5;
  const height = 0.82;
  const baseY = -0.36;
  const radius = 0.2;
  const segments = 96;
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

/**
 * Validation-network palette. Reuses the exact inactive -> validated pair the
 * framework nodes already use in OrbitNodes, so the two systems read as the
 * same visual language. On a white page saturation (not luminance) is what
 * reads as "lit" — a pale node is effectively invisible, a blue one is not.
 */
const NODE_DIM = new THREE.Color('#cbd5e1');
const NODE_LIT = new THREE.Color('#3b82f6');
const EDGE_DIM = new THREE.Color('#e2e8f0');
const EDGE_LIT = new THREE.Color('#93c5fd');

const SIGNAL_COUNT = 3;

interface Props {
  reducedMotion: boolean;
}

const tmpColorA = new THREE.Color();
const tmpColorB = new THREE.Color();
const tmpNodeColor = new THREE.Color();

export default function IdeaBulb({ reducedMotion }: Props) {
  const glassGeo = useMemo(() => latheGeometry(GLASS_PROFILE), []);
  const filamentGeo = useMemo(() => new THREE.TubeGeometry(filamentCurve(), 140, 0.023, 8, false), []);
  // glass stem + the two wires that carry the coil — the interior anatomy that
  // separates "a light bulb" from "an empty glass shell"
  const stemGeo = useMemo(() => new THREE.CylinderGeometry(0.035, 0.075, 0.34, 20), []);
  const supportGeo = useMemo(() => new THREE.CylinderGeometry(0.009, 0.009, 0.36, 8), []);
  const nodeGeo = useMemo(() => new THREE.SphereGeometry(0.028, 10, 10), []);
  const signalGeo = useMemo(() => new THREE.SphereGeometry(0.017, 8, 8), []);
  // Built as a THREE object + <primitive> rather than the <lineSegments>
  // intrinsic, matching how crackLines already sidesteps the JSX line typing.
  const networkLines = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    VALIDATION_EDGES.forEach(([a, b]) => {
      pts.push(new THREE.Vector3(...VALIDATION_NODES[a]));
      pts.push(new THREE.Vector3(...VALIDATION_NODES[b]));
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    // Opaque, like the filament: a transparent material here would join the
    // glass shell's sorted queue and get washed out. Intensity rides on colour.
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: EDGE_DIM.clone(), toneMapped: false }));
  }, []);
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
  const nodeRefs = useRef<THREE.Mesh[]>([]);
  const signalRefs = useRef<THREE.Mesh[]>([]);
  const coreGlowRef = useRef<THREE.Sprite>(null);

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
      // Brightness rides on COLOUR, never opacity. As a transparent material the
      // filament joined the same sorted transparent queue as the glass shell and
      // got drawn over/washed out — which is why the opaque support wires were
      // visible in the hero but the coil was not. Opaque = always behind glass.
      filamentMat.current.color.copy(tint).multiplyScalar(0.9 + brightness * 0.55 + flicker);
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

    // ---- validation network -------------------------------------------------
    // The idea's journey lighting up from the inside. Nodes illuminate in order,
    // the mesh between them firms up, and signals start moving once enough of
    // the journey has happened for movement between points to mean anything.
    const net = networkActivation(progress);

    nodeRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      // risk stage knocks the whole network back a little — the moment the
      // validation finds something wrong, before it recovers
      const act = nodeActivation(i, progress) * (1 - instability * 0.35);
      tmpNodeColor.copy(NODE_DIM).lerp(NODE_LIT, act);
      // final beat only: a touch brighter once the score is landing
      tmpNodeColor.multiplyScalar(1 + Math.max(0, brightness - 0.7) * 0.55);
      (mesh.material as THREE.MeshBasicMaterial).color.copy(tmpNodeColor);
      // a lit node also breathes very slightly, so the network feels alive
      // rather than switched-on
      const breathe = reducedMotion ? 0 : Math.sin(t * 1.6 + i * 1.1) * 0.05 * act;
      mesh.scale.setScalar(0.72 + act * 0.48 + breathe);
    });

    (networkLines.material as THREE.LineBasicMaterial).color.copy(EDGE_DIM).lerp(EDGE_LIT, net);

    signalRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const show = net > 0.2 && !reducedMotion;
      mesh.visible = show;
      if (!show) return;
      // each signal walks edge to edge; the offset desyncs the three of them
      const phase = t * 0.26 + i * 1.37;
      const travel = phase % 1;
      const [a, b] = VALIDATION_EDGES[Math.floor(phase) % VALIDATION_EDGES.length];
      const from = VALIDATION_NODES[a];
      const to = VALIDATION_NODES[b];
      mesh.position.set(lerp(from[0], to[0], travel), lerp(from[1], to[1], travel), lerp(from[2], to[2], travel));
      (mesh.material as THREE.MeshBasicMaterial).color.copy(EDGE_LIT).lerp(NODE_LIT, net);
    });

    if (coreGlowRef.current) {
      const mat = coreGlowRef.current.material as THREE.SpriteMaterial;
      // deliberately capped low — this is a hint of light gathering at the
      // centre of the network, not a second hotspot competing with the filament
      mat.opacity = clamp(net * 0.3);
      coreGlowRef.current.scale.setScalar(0.75 + net * 0.5);
    }

    if (groupRef.current) {
      groupRef.current.position.set(pos[0], pos[1], pos[2]);
      const scaleSeg = findSegment(BULB_SCALE_KEYFRAMES, progress);
      groupRef.current.scale.setScalar(lerp(scaleSeg.from.scale, scaleSeg.to.scale, scaleSeg.localT));
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
            transmission={0.9}
            thickness={0.42}
            roughness={0.055}
            ior={1.5}
            emissive="#1e3a5f"
            emissiveIntensity={0.035}
            clearcoat={1}
            clearcoatRoughness={0.08}
            // 2.1 blew the lightformers out into a milky white shell you
            // couldn't see through — this keeps the reflections but lets the
            // filament read as the contents of the glass
            envMapIntensity={1.3}
            transparent
          />
        </mesh>

        {/* thin back-face rim shell — cheap fresnel-edge glow without a
            custom shader: only the silhouette edge reads, the object
            stays otherwise clear */}
        <mesh geometry={glassGeo} scale={1.045}>
          <meshBasicMaterial ref={rimMat} color="#1e3a5f" transparent opacity={0.22} side={THREE.BackSide} toneMapped={false} />
        </mesh>

        {/* frosted glass stem rising out of the screw base */}
        <mesh geometry={stemGeo} position={[0, -0.41, 0]}>
          <meshPhysicalMaterial color="#dfe5f2" roughness={0.35} transmission={0.5} thickness={0.2} transparent opacity={0.9} />
        </mesh>

        {/* the two support wires the coil sits on */}
        {[-0.115, 0.115].map((x) => (
          <mesh key={x} geometry={supportGeo} position={[x, -0.32, 0]}>
            <meshStandardMaterial color="#8d95a6" metalness={0.75} roughness={0.35} />
          </mesh>
        ))}

        <mesh geometry={filamentGeo}>
          <meshBasicMaterial ref={filamentMat} color="#1e3a5f" toneMapped={false} />
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

        {/* blue light spilling out around the screw cap, as in the reference */}
        {halo && (
          <sprite position={[0, -0.86, 0]} scale={[1.15, 0.62, 1]}>
            <spriteMaterial map={halo} color="#3b82f6" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        )}

        {/* ---- validation network, inside the glass ----------------------
            The idea and the checks it passes through. Renders behind the glass
            because every material here is opaque; anything transparent would
            sort against the shell and disappear. */}
        <primitive object={networkLines} />

        {VALIDATION_NODES.map((p, i) => (
          <mesh
            key={i}
            position={p}
            geometry={nodeGeo}
            ref={(el: THREE.Mesh | null) => {
              if (el) nodeRefs.current[i] = el;
            }}
          >
            <meshBasicMaterial color="#cbd5e1" toneMapped={false} />
          </mesh>
        ))}

        {/* signals in transit between checks */}
        {Array.from({ length: SIGNAL_COUNT }, (_, i) => (
          <mesh
            key={i}
            geometry={signalGeo}
            visible={false}
            ref={(el: THREE.Mesh | null) => {
              if (el) signalRefs.current[i] = el;
            }}
          >
            <meshBasicMaterial color="#93c5fd" toneMapped={false} />
          </mesh>
        ))}

        {/* light gathering at the centre of the network as it completes */}
        {halo && (
          <sprite ref={coreGlowRef} position={[0, 0.12, 0]}>
            <spriteMaterial map={halo} color="#60a5fa" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
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
