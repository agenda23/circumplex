import type { BandLevels } from '../types';

/**
 * Turns raw per-frame band RMS into something that actually reads as
 * reactive, mirroring `ref/age-vd`'s `BandAnalyzer` pipeline: gain ->
 * adaptive peak normalization -> attack/release smoothing. Settable fields
 * are mutated directly by the settings panel (same pattern as
 * `AutoScaler.enabled`), not through the command bus -- these are live
 * tuning knobs, not app state that needs to be part of `EngineState`.
 */

const PEAK_FLOOR = 0.05;
const PEAK_HALF_LIFE_SEC = 12;

export const SENSITIVITY_RANGE = { min: 0.1, max: 4.0 };
export const ATTACK_MS_RANGE = { min: 1, max: 100 };
export const RELEASE_MS_RANGE = { min: 20, max: 800 };

interface BandState {
  peak: number;
  smooth: number;
}

function createBandState(): BandState {
  return { peak: PEAK_FLOOR, smooth: 0 };
}

export class LevelEnvelope {
  sensitivity = 1.0;
  peakNormalize = true;
  attackMs = 8;
  releaseMs = 160;

  private readonly low = createBandState();
  private readonly mid = createBandState();
  private readonly high = createBandState();

  update(raw: BandLevels, dt: number): BandLevels {
    return {
      low: this.updateBand(this.low, raw.low, dt),
      mid: this.updateBand(this.mid, raw.mid, dt),
      high: this.updateBand(this.high, raw.high, dt),
    };
  }

  private updateBand(state: BandState, rawValue: number, dt: number): number {
    const gained = rawValue * this.sensitivity;

    let target: number;
    if (this.peakNormalize) {
      const decay = Math.pow(0.5, dt / PEAK_HALF_LIFE_SEC);
      state.peak = Math.max(PEAK_FLOOR, state.peak * decay, gained);
      target = gained / state.peak;
    } else {
      target = gained;
    }

    if (dt > 0) {
      const rising = target > state.smooth;
      const timeConstantSec = (rising ? this.attackMs : this.releaseMs) / 1000;
      const alpha = 1 - Math.exp(-dt / timeConstantSec);
      state.smooth += (target - state.smooth) * alpha;
    }

    return state.smooth;
  }
}
