'use client';

import { Component, type ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import { isWebGLAvailable } from '@/lib/webgl';
import type { LogoPhase } from './karvia-logo-model';
import { KarviaStaticMark } from './karvia-static-mark';

// Keep the 3D scene (three.js / @react-three/fiber) out of the initial
// bundle entirely — it's only fetched once KarviaSceneGate actually decides
// to mount it, separating first paint of the login page from 3D init.
const KarviaLoginScene = dynamic(() => import('./karvia-login-scene'), {
  ssr: false,
});

interface SceneErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches runtime failures from the 3D scene — most notably
 * "WebGLRenderer: A WebGL context could not be created", which some
 * browsers only throw once @react-three/fiber actually tries to initialize
 * the renderer, even after a context-creation probe succeeded.
 */
class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[karvia] 3D login scene failed to initialize, using static fallback.', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface KarviaSceneGateProps {
  phase: LogoPhase;
}

/**
 * Decides whether the login page gets the full 3D glass logo or the
 * lightweight CSS fallback, and makes sure the heavy scene never blocks the
 * page's first paint.
 */
export default function KarviaSceneGate({ phase }: KarviaSceneGateProps) {
  const [webglOk, setWebglOk] = useState(true);
  const [readyFor3D, setReadyFor3D] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());

    // Defer mounting the 3D scene until the browser is idle (or a short
    // timeout elapses) so the login form itself paints and becomes
    // interactive immediately, instead of waiting on the three.js chunk and
    // WebGL/scene setup.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback;
    const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;

    let handle: number;
    if (ric) {
      handle = ric(() => setReadyFor3D(true), { timeout: 400 });
      return () => cic?.(handle);
    }
    handle = window.setTimeout(() => setReadyFor3D(true), 50);
    return () => window.clearTimeout(handle);
  }, []);

  if (!webglOk || !readyFor3D) {
    return <KarviaStaticMark phase={phase} />;
  }

  return (
    <SceneErrorBoundary fallback={<KarviaStaticMark phase={phase} />}>
      <KarviaLoginScene phase={phase} />
    </SceneErrorBoundary>
  );
}
