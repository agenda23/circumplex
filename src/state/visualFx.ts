/**
 * User-facing visual FX dials (milestone 12). Plain mutable fields, same
 * pattern as `AutoScaler.enabled`: the settings panel and the autopilot
 * both write them, and the renderer reads them once per frame.
 */

export const TRAIL_RANGE = { min: 0, max: 0.9 } as const;
export const CHROMA_RANGE = { min: 0, max: 1 } as const;
export const VECTOR_SCOPE_GAIN_RANGE = { min: 0.2, max: 2.5 } as const;

/** Geometry shading looks. Autopilot steps the index; the shader branches on it. */
export const SHADE_MODES = [
  { id: 0, label: 'Soft' },
  { id: 1, label: 'Cel' },
  { id: 2, label: 'Rim' },
  { id: 3, label: 'Glow' },
] as const;

export const SHADE_MODE_MAX = SHADE_MODES.length - 1;

export type FxParam = 'trail' | 'chroma' | 'crt' | 'vectorScopeGain' | 'shade';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class VisualFx {
  /** AfterimagePass damp. 0 disables the pass. */
  trail = 0;
  /** Master chromatic-aberration amount, further scaled by high-band/flux in the renderer. */
  chroma = 0;
  /** CRT scanlines + vignette. Off by default. */
  crt = false;
  /** Multiplier on the vector-scope trace size. */
  vectorScopeGain = 1;
  /** Index into SHADE_MODES. */
  shadeMode = 0;

  clamp(): void {
    this.trail = clamp(this.trail, TRAIL_RANGE.min, TRAIL_RANGE.max);
    this.chroma = clamp(this.chroma, CHROMA_RANGE.min, CHROMA_RANGE.max);
    this.vectorScopeGain = clamp(this.vectorScopeGain, VECTOR_SCOPE_GAIN_RANGE.min, VECTOR_SCOPE_GAIN_RANGE.max);
    this.shadeMode = clamp(Math.round(this.shadeMode), 0, SHADE_MODE_MAX);
  }
}
