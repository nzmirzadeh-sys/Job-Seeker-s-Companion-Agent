/**
 * Cheap, synchronous WebGL capability check.
 *
 * Browsers can report the WebGLRenderingContext constructor while still
 * failing to actually create a context (driver blocklists, exhausted
 * contexts, headless/sandboxed environments, etc.), which is what triggers
 * three.js's "WebGLRenderer: A WebGL context could not be created" error.
 * This probes a throwaway canvas up front so the caller can skip mounting
 * the 3D scene entirely instead of crashing it.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}
