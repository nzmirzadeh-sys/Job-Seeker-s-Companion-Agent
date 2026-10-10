'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import {
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
} from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function makeExtrudedShape(shape: THREE.Shape, depth = 38) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 6,
    steps: 1,
    bevelSize: 4,
    bevelThickness: 5,
    curveSegments: 12,
  });

  geometry.center();
  return geometry;
}

function StemGlass() {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(64, 0);
    s.lineTo(64, 300);
    s.lineTo(0, 300);
    s.lineTo(0, 0);
    return s;
  }, []);

  const geometry = useMemo(() => makeExtrudedShape(shape, 38), [shape]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <MeshTransmissionMaterial
        samples={6}
        resolution={512}
        thickness={1.8}
        roughness={0.35}
        transmission={0.25}
        ior={1.45}
        chromaticAberration={0.04}
        anisotropicBlur={0.2}
        distortion={0.1}
        temporalDistortion={0.1}
        backside
        color="#0F1535"
        attenuationColor="#4f46e5"
        attenuationDistance={1.4}
        clearcoat={1}
      />
    </mesh>
  );
}

function UpperArrow({ color, position, rotation = [0, 0, 0] }: { color: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(240, 0);
    s.lineTo(188, 32);
    s.lineTo(270, 110);
    s.lineTo(232, 110);
    s.lineTo(124, 34);
    s.lineTo(50, 34);
    s.lineTo(0, 0);
    return s;
  }, []);

  const geometry = useMemo(() => makeExtrudedShape(shape, 24), [shape]);

  return (
    <mesh geometry={geometry} position={position} rotation={rotation} castShadow>
      <MeshTransmissionMaterial
        samples={6}
        resolution={512}
        thickness={2.2}
        roughness={0.05}
        transmission={1}
        ior={1.45}
        chromaticAberration={0.04}
        anisotropicBlur={0.2}
        distortion={0.1}
        temporalDistortion={0.1}
        backside
        color={color}
        attenuationColor="#6B1CD9"
        attenuationDistance={1.2}
        clearcoat={1}
        emissive="#10042a"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

function LowerLeg({ color, position, rotation = [0, 0, 0] }: { color: string; position: [number, number, number]; rotation?: [number, number, number] }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(240, 0);
    s.lineTo(146, 26);
    s.lineTo(285, 128);
    s.lineTo(248, 128);
    s.lineTo(92, 30);
    s.lineTo(0, 0);
    return s;
  }, []);

  const geometry = useMemo(() => makeExtrudedShape(shape, 22), [shape]);

  return (
    <mesh geometry={geometry} position={position} rotation={rotation} castShadow>
      <MeshTransmissionMaterial
        samples={6}
        resolution={512}
        thickness={1.7}
        roughness={0.12}
        transmission={1}
        ior={1.45}
        chromaticAberration={0.04}
        anisotropicBlur={0.2}
        distortion={0.1}
        temporalDistortion={0.1}
        backside
        color={color}
        attenuationColor="#4F46E5"
        attenuationDistance={1.3}
        clearcoat={1}
      />
    </mesh>
  );
}

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        radius: 0.05 + (index % 5) * 0.02,
        speed: 0.3 + (index % 7) * 0.09,
        color: ['#C4B5FD', '#8B5CF6', '#4F46E5'][index % 3],
        angle: (index / 28) * Math.PI * 2,
        offset: (index % 8) * 0.18,
      })),
    []
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = meshRef.current;
    if (!mesh) return;

    const pointer = state.pointer;
    particles.forEach((particle, index) => {
      const orbit = 1.9 + (index % 6) * 0.25;
      const x = Math.cos(t * particle.speed + particle.angle + particle.offset) * orbit;
      const y = Math.sin(t * (particle.speed + 0.35) + particle.angle) * (1.1 + index * 0.03);
      const z = Math.sin(t * particle.speed * 1.2 + particle.angle) * 1.2 + 0.4;
      const dx = pointer.x * 2.2;
      const dy = pointer.y * 1.4;
      const dist = Math.hypot(x - dx, y - dy);
      const repel = dist < 2.2 ? (2.2 - dist) * 0.14 : 0;

      dummy.position.set(
        x + (x - dx) * repel,
        y + (y - dy) * repel,
        z
      );
      dummy.scale.setScalar(particle.radius * (1 + repel * 0.8));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particles.length]} castShadow>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial emissive="#8B5CF6" emissiveIntensity={0.3} color="#C4B5FD" />
    </instancedMesh>
  );
}

function KarviaMark() {
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useFrame((state) => {
    if (!groupRef.current) return;

    const t = state.clock.elapsedTime;
    const targetY = state.pointer.x * 0.35;
    const targetX = -state.pointer.y * 0.2;

    if (reducedMotion) {
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.x = 0;
      groupRef.current.position.y = 0;
      return;
    }

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY + Math.sin(t * 0.35) * 0.55,
      0.06
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX + Math.sin(t * 0.27) * 0.12,
      0.06
    );
    groupRef.current.position.y = Math.sin(t * 0.8) * 0.08;
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, -2.2, 0.03);
  });

  return (
    <group ref={groupRef} scale={0.4} position={[0, 0.2, 0]}>
      <StemGlass />
      <group position={[1.2, 0.2, 0]} rotation={[0, 0, -0.2]}>
        <UpperArrow color="#C4B5FD" position={[-0.1, 0.5, 0.1]} rotation={[0, 0, 0.08]} />
        <UpperArrow color="#8B5CF6" position={[0.35, 0.1, 0.4]} rotation={[0, 0, 0.22]} />
      </group>
      <group position={[0.9, -0.5, 0.1]} rotation={[0, 0, -0.16]}>
        <LowerLeg color="#4F46E5" position={[0, 0, 0.1]} rotation={[0, 0, 0.12]} />
      </group>
      <Particles />
    </group>
  );
}

export default function Karvia3DMark() {
  return (
    <div className="h-[440px] w-full max-w-[520px]">
      <Canvas
        camera={{ position: [0, 0, 9], fov: 35 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <color attach="background" args={['#070614']} />
        <fog attach="fog" args={['#070614', 8, 16]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 3]} intensity={1.6} color="#f5f3ff" />
        <directionalLight position={[-4, 3, -3]} intensity={1.1} color="#6b1cd9" />
        <group position={[0, -0.8, 0]}>
          <Environment resolution={256}>
            <Lightformer intensity={2.5} rotation-x={Math.PI / 2} position={[0, 5, -3]} scale={[8, 2, 1]} color="#ffffff" />
            <Lightformer intensity={1.3} rotation-y={Math.PI / 2} position={[-5, 1, 0]} scale={[2, 4, 1]} color="#8B5CF6" />
            <Lightformer intensity={1.3} rotation-y={-Math.PI / 2} position={[5, 1, 0]} scale={[2, 4, 1]} color="#ff5bd9" />
            <Lightformer intensity={1.3} position={[0, 0, -3]} scale={[6, 3, 1]} color="#f8f7ff" />
          </Environment>
          <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.5}>
            <KarviaMark />
          </Float>
        </group>
      </Canvas>
    </div>
  );
}
