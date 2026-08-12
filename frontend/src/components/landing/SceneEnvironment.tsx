'use client';
import { Environment, Lightformer } from '@react-three/drei';

/**
 * Procedural reflections for the glass bulb — a tiny synthetic "softbox"
 * set (a few colored panels), baked into a low-res PMREM environment.
 * No HDRI download, no external asset: this is what gives the glass its
 * premium reflective read instead of looking like a flat grey sphere.
 */
export default function SceneEnvironment() {
  return (
    <Environment resolution={48} background={false}>
      <Lightformer form="rect" intensity={3.2} color="#dbe7ff" position={[2, 2, 3]} scale={[3, 3, 1]} />
      <Lightformer form="rect" intensity={2.0} color="#3b82f6" position={[-3, 1, -2]} scale={[3, 2, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, -3, 2]} scale={[4, 2, 1]} />
      <Lightformer form="ring" intensity={1.2} color="#2563eb" position={[0, 4, 0]} scale={4} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[1.2, 0.4, 2.6]} scale={[1.2, 1.2, 1]} />
    </Environment>
  );
}
