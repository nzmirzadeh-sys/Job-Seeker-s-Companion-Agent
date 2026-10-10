'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_URL = '/models/karvia-k.glb';

export type LogoPhase = 'intro' | 'main';

interface KarviaLogoModelProps {
  phase: LogoPhase;
  isCompact: boolean;
  /** Written every frame with the model's current world position/scale so sibling
   *  effects (ambient particles) can stay anchored to it without duplicating the tween. */
  anchorRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
}

export function KarviaLogoModel({ phase, isCompact, anchorRef }: KarviaLogoModelProps) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    let found: THREE.BufferGeometry | null = null;
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!found && mesh.isMesh) {
        found = mesh.geometry;
      }
    });
    if (found) {
      (found as THREE.BufferGeometry).computeVertexNormals();
      (found as THREE.BufferGeometry).computeBoundingSphere();
    }
    return found as THREE.BufferGeometry | null;
  }, [scene]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  useFrame((state, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    const delta = Math.min(rawDelta, 0.05);
    const t = state.clock.elapsedTime;

    group.rotation.y += delta * (phase === 'intro' ? 0.32 : 0.14);

    // Beside the login card: position/size follow the visible world width, so the logo
    // stays next to the card (never under it) on any screen wider than the compact breakpoint.
    const vw = state.viewport.width;
    const targetX = phase === 'intro' || isCompact ? 0 : -vw * 0.25;
    const targetY = phase === 'intro' ? 0.1 : isCompact ? 0.95 : 0.1;
    const targetScale =
      phase === 'intro' ? 2.55 : isCompact ? 1.35 : Math.min(1.5, vw * 0.2);

    const pointerTiltX = phase === 'main' ? state.pointer.y * -0.14 : 0;
    const pointerTiltZ = phase === 'main' ? state.pointer.x * 0.1 : 0;

    group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 3.4, delta);
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      targetY + Math.sin(t * 0.6) * 0.055,
      3.4,
      delta
    );
    group.scale.x = THREE.MathUtils.damp(group.scale.x, targetScale, 3.4, delta);
    group.scale.y = group.scale.z = group.scale.x;

    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, 0.18 + pointerTiltX, 4.2, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, pointerTiltZ, 4.2, delta);

    anchorRef.current.x = group.position.x;
    anchorRef.current.y = group.position.y;
    anchorRef.current.scale = group.scale.x;
  });

  if (!geometry) return null;

  return (
    <group ref={groupRef} rotation={[0.18, 0, 0]}>
      <mesh geometry={geometry}>
        <MeshTransmissionMaterial
          samples={4}
          resolution={256}
          thickness={1.1}
          roughness={0.04}
          transmission={0.97}
          ior={1.46}
          chromaticAberration={0.02}
          anisotropicBlur={0.1}
          distortion={0.08}
          temporalDistortion={0.05}
          backside
          color="#FFFFFF"
          attenuationColor="#FFFFFF"
          attenuationDistance={3}
          clearcoat={1}
          clearcoatRoughness={0.03}
          envMapIntensity={1.6}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
