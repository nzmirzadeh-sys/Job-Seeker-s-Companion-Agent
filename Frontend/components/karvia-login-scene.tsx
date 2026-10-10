'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { KarviaLogoModel, type LogoPhase } from './karvia-logo-model';
import { KarviaAmbientField } from './karvia-ambient-field';

interface KarviaLoginSceneProps {
  phase: LogoPhase;
}

export default function KarviaLoginScene({ phase }: KarviaLoginSceneProps) {
  const anchorRef = useRef({ x: 0, y: 0, scale: 1 });
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const update = () => setIsCompact(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 36 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      className="h-full w-full"
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} color="#f5f3ff" />
      <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#6b1cd9" />

      <Environment resolution={256}>
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 5, -3]} scale={[8, 2, 1]} color="#ffffff" />
        <Lightformer intensity={1.4} rotation-y={Math.PI / 2} position={[-5, 1, 0]} scale={[2, 4, 1]} color="#8B5CF6" />
        <Lightformer intensity={1.2} rotation-y={-Math.PI / 2} position={[5, 1, 0]} scale={[2, 4, 1]} color="#C4B5FD" />
        <Lightformer intensity={1.2} position={[0, 0, -3]} scale={[6, 3, 1]} color="#f8f7ff" />
      </Environment>

      <Suspense fallback={null}>
        <KarviaLogoModel phase={phase} isCompact={isCompact} anchorRef={anchorRef} />
      </Suspense>
      <KarviaAmbientField phase={phase} anchorRef={anchorRef} />
    </Canvas>
  );
}
