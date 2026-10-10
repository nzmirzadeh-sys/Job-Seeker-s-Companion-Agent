'use client';

import type { LogoPhase } from './karvia-logo-model';

interface KarviaStaticMarkProps {
  phase: LogoPhase;
}

/**
 * Lightweight, WebGL-free stand-in for the 3D glass "K" mark.
 *
 * Shown when WebGL isn't available (or the 3D context fails to initialize)
 * and briefly while the real scene is still being deferred, so the login
 * page always has a usable, on-brand logo and never depends on WebGL to be
 * functional. Mirrors the same white-glass identity as the 3D version.
 */
export function KarviaStaticMark({ phase }: KarviaStaticMarkProps) {
  const isIntro = phase === 'intro';
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className={`flex items-center justify-center rounded-[2rem] border border-white/30 bg-[linear-gradient(135deg,_rgba(255,255,255,0.55),_rgba(196,181,253,0.18))] shadow-[0_30px_90px_rgba(99,102,241,0.35),inset_0_1.5px_3px_rgba(255,255,255,0.6)] backdrop-blur-2xl transition-all duration-700 ease-out ${
          isIntro
            ? 'h-40 w-40 md:h-56 md:w-56'
            : 'h-24 w-24 -translate-x-[20vw] -translate-y-[8vh] md:h-28 md:w-28'
        }`}
      >
        <span className="text-6xl font-black text-white md:text-7xl">K</span>
      </div>
    </div>
  );
}
