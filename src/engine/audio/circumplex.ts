/**
 * Heuristic Valence/Arousal (Russell's Circumplex Model) estimate from MIR
 * features, per PRD 2.3.
 *
 * There is no ground-truth model for this mapping — these weights are a
 * documented first pass (loud/percussive/bright -> higher arousal;
 * tonal/harmonically-clear -> higher valence, as a proxy for "consonance"
 * since we don't do real key/mode detection). Expect to retune these
 * constants by ear against real music.
 */

export interface CircumplexFeatures {
  rms: number;
  centroid: number;
  flatness: number;
  flux: number;
  chroma: number[];
}

export interface CircumplexPoint {
  valence: number;
  arousal: number;
}

export const AROUSAL_WEIGHTS = { rms: 0.5, flux: 0.3, centroid: 0.2 };
export const VALENCE_WEIGHTS = { flatnessInv: 0.5, chromaPeakiness: 0.5 };

const CENTROID_NORM_HZ = 4000;
/**
 * `spectralFlux` is already a 0..1 energy fraction. This is the fraction that
 * counts as fully transient for arousal and the shader: a frame where a
 * quarter of the energy is new. A from-silence hit (flux ≈ 1) still clamps.
 */
export const FLUX_NORM = 0.25;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function toBipolar(score01: number): number {
  return Math.min(1, Math.max(-1, score01 * 2 - 1));
}

/** How concentrated the chroma energy is in one pitch class vs. spread evenly. */
function chromaPeakiness(chroma: number[]): number {
  const uniform = 1 / 12;
  const max = Math.max(...chroma, 0);
  return clamp01((max - uniform) / (1 - uniform));
}

export function estimateRaw(features: CircumplexFeatures): CircumplexPoint {
  const normRms = clamp01(features.rms);
  const normFlux = clamp01(features.flux / FLUX_NORM);
  const normCentroid = clamp01(features.centroid / CENTROID_NORM_HZ);
  const arousalScore =
    AROUSAL_WEIGHTS.rms * normRms + AROUSAL_WEIGHTS.flux * normFlux + AROUSAL_WEIGHTS.centroid * normCentroid;

  const flatnessInv = 1 - clamp01(features.flatness);
  const peakiness = chromaPeakiness(features.chroma);
  const valenceScore = VALENCE_WEIGHTS.flatnessInv * flatnessInv + VALENCE_WEIGHTS.chromaPeakiness * peakiness;

  return { arousal: toBipolar(arousalScore), valence: toBipolar(valenceScore) };
}

export interface CircumplexSmoother {
  update(raw: CircumplexPoint, dt: number): CircumplexPoint;
}

/** Exponential moving average with the given time constant (PRD 2.3: 3-5s). */
export function createCircumplexSmoother(timeConstantSec: number): CircumplexSmoother {
  let state: CircumplexPoint | null = null;
  return {
    update(raw, dt) {
      if (!state) {
        state = raw;
        return state;
      }
      const alpha = dt > 0 ? 1 - Math.exp(-dt / timeConstantSec) : 0;
      state = {
        valence: state.valence + alpha * (raw.valence - state.valence),
        arousal: state.arousal + alpha * (raw.arousal - state.arousal),
      };
      return state;
    },
  };
}
