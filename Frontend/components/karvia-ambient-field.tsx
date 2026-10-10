'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LogoPhase } from './karvia-logo-model';

interface KarviaAmbientFieldProps {
  phase: LogoPhase;
  anchorRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
}

const DUST_COUNT = 42;
const ORB_COUNT = 7;

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function KarviaAmbientField({ phase, anchorRef }: KarviaAmbientFieldProps) {
  const dustRef = useRef<THREE.InstancedMesh>(null);
  const orbRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const dust = useMemo(
    () =>
      Array.from({ length: DUST_COUNT }, (_, i) => ({
        core: i < 14,
        angle: (i / DUST_COUNT) * Math.PI * 2 + seededRandom(i, 1) * 0.6,
        radius: 1.3 + seededRandom(i, 2) * 2.6,
        speed: 0.06 + seededRandom(i, 3) * 0.1,
        height: (seededRandom(i, 4) - 0.5) * 2.6,
        size: 0.012 + seededRandom(i, 5) * 0.018,
        bobSpeed: 0.3 + seededRandom(i, 6) * 0.5,
        bobOffset: seededRandom(i, 7) * Math.PI * 2,
      })),
    []
  );

  // 6-8 small, pale, slow-orbiting glass satellite spheres around the mark.
  const orbs = useMemo(
    () =>
      Array.from({ length: ORB_COUNT }, (_, i) => ({
        angle: (i / ORB_COUNT) * Math.PI * 2,
        radius: 1.55 + (i % 3) * 0.42,
        speed: 0.07 + (i % 4) * 0.02,
        tiltY: (seededRandom(i, 8) - 0.5) * 1.3,
        size: 0.065 + seededRandom(i, 9) * 0.05,
      })),
    []
  );

  useFrame((state, rawDelta) => {
    const t = state.clock.elapsedTime;
    const delta = Math.min(rawDelta, 0.05);
    const anchor = anchorRef.current;
    const calm = phase === 'main' ? 0.45 : 1; // slower, fewer visible once settled

    const dustMesh = dustRef.current;
    if (dustMesh) {
      dust.forEach((p, i) => {
        const active = p.core || phase === 'intro';
        const targetVisible = active ? 1 : 0;
        const angle = p.angle + t * p.speed * calm;
        const x = anchor.x + Math.cos(angle) * p.radius * anchor.scale * 0.42;
        const y =
          anchor.y +
          p.height * anchor.scale * 0.42 +
          Math.sin(t * p.bobSpeed + p.bobOffset) * 0.12;
        const z = Math.sin(angle) * p.radius * 0.3;

        dummy.position.set(x, y, z);
        const scaleBoost = THREE.MathUtils.lerp(0, p.size, targetVisible);
        dummy.scale.setScalar(scaleBoost);
        dummy.updateMatrix();
        dustMesh.setMatrixAt(i, dummy.matrix);
      });
      dustMesh.instanceMatrix.needsUpdate = true;
    }

    const orbMesh = orbRef.current;
    if (orbMesh) {
      orbs.forEach((o, i) => {
        const angle = o.angle + t * o.speed;
        const x = anchor.x + Math.cos(angle) * o.radius * anchor.scale * 0.5;
        const z = Math.sin(angle) * o.radius * anchor.scale * 0.5;
        const y = anchor.y + Math.sin(angle * 0.6 + o.tiltY) * 0.55 * anchor.scale * 0.5;

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(o.size * anchor.scale * 0.55);
        dummy.updateMatrix();
        orbMesh.setMatrixAt(i, dummy.matrix);
      });
      orbMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={dustRef} args={[undefined, undefined, DUST_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          color="#C9B8FF"
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh ref={orbRef} args={[undefined, undefined, ORB_COUNT]}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshPhysicalMaterial
          color="#E7DFFF"
          roughness={0.08}
          metalness={0}
          transmission={0.9}
          thickness={0.6}
          ior={1.3}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationColor="#8B5CF6"
          attenuationDistance={0.6}
          transparent
          opacity={0.9}
        />
      </instancedMesh>
    </group>
  );
}
