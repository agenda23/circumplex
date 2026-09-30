import { CHROMA_RANGE, TRAIL_RANGE, type FxParam, type VisualFx } from '../state/visualFx';

/**
 * Timer-driven stand-in for ref/age-vd's beat-clock autopilot. This project
 * has no beat detector, and shape is a continuous mood blend rather than a
 * discrete look list, so Autopilot wanders the FX dials a person would turn
 * (trail, chroma, CRT, vector-scope size) and steps the geometry shading
 * mode on its own trigger.
 *
 * Dial changes stay gradual. Shading switches on an arousal-tier change or,
 * if the tier holds, on a 24–50s timer. A manual shading pick is held for
 * MANUAL_HOLD_SEC, same as the other dials.
 */

export const AUTOPILOT_INTERVAL_MIN_SEC = 8;
export const AUTOPILOT_INTERVAL_MAX_SEC = 20;
export const MANUAL_HOLD_SEC = 90;
export const BURST_CHANCE = 0.15;
export const BURST_DURATION_MIN_SEC = 2;
export const BURST_DURATION_MAX_SEC = 8;
export const SHADE_FIRST_SEC = 24;
export const SHADE_INTERVAL_MIN_SEC = 24;
export const SHADE_INTERVAL_MAX_SEC = 50;
const NUDGE_BLEND = 0.55;
const BURST_RISE_SEC = 0.6;

export type EnergyTier = 'calm' | 'drive' | 'peak';

export function tierFromArousal(arousal: number): EnergyTier {
  if (arousal >= 0.35) return 'peak';
  if (arousal <= -0.2) return 'calm';
  return 'drive';
}

interface NumberBand {
  min: number;
  max: number;
}

interface TierBands {
  trail: NumberBand;
  chroma: NumberBand;
  /** Probability of turning CRT on when that dial is the one being nudged. */
  crtOn: number;
  vectorScopeGain: NumberBand;
}

const TIERS: Record<EnergyTier, TierBands> = {
  calm: {
    trail: { min: 0, max: 0.12 },
    chroma: { min: 0, max: 0.1 },
    crtOn: 0.15,
    vectorScopeGain: { min: 0.7, max: 1.15 },
  },
  drive: {
    trail: { min: 0.08, max: 0.4 },
    chroma: { min: 0.1, max: 0.45 },
    crtOn: 0.4,
    vectorScopeGain: { min: 0.85, max: 1.7 },
  },
  peak: {
    trail: { min: 0.2, max: 0.65 },
    chroma: { min: 0.25, max: 0.7 },
    crtOn: 0.6,
    vectorScopeGain: { min: 1.0, max: 2.2 },
  },
};

type DialParam = Exclude<FxParam, 'shade'>;

const PARAMS: readonly DialParam[] = ['trail', 'chroma', 'crt', 'vectorScopeGain'];

/** Shading looks biased by energy. The picker skips the mode already showing. */
const SHADE_BY_TIER: Record<EnergyTier, readonly number[]> = {
  calm: [0, 2],
  drive: [0, 1, 2, 3],
  peak: [1, 3],
};

interface Burst {
  param: 'trail' | 'chroma';
  restore: number;
  peak: number;
  start: number;
  riseEnd: number;
  fallStart: number;
  end: number;
}

export class Autopilot {
  enabled = true;
  private elapsed = 0;
  private nextAt: number;
  private readonly holdUntil: Record<FxParam, number> = {
    trail: 0,
    chroma: 0,
    crt: 0,
    vectorScopeGain: 0,
    shade: 0,
  };
  private burst: Burst | null = null;
  private lastTier: EnergyTier | null = null;
  private nextShadeAt = SHADE_FIRST_SEC;

  constructor(private readonly random: () => number = Math.random) {
    this.nextAt = this.interval();
  }

  get bursting(): boolean {
    return this.burst !== null;
  }

  /** Keep Autopilot off this dial for MANUAL_HOLD_SEC. Cancels a burst on that dial. */
  noteManual(param: FxParam): void {
    this.holdUntil[param] = this.elapsed + MANUAL_HOLD_SEC;
    if (this.burst?.param === param) this.burst = null;
  }

  /**
   * Advance by `dt` seconds. Mutates `fx` when a nudge or an in-progress
   * burst is due. Returns the dial touched by a scheduled action this call,
   * or null when the timer has not fired.
   */
  update(dt: number, arousal: number, fx: VisualFx): FxParam | null {
    if (dt < 0) dt = 0;
    this.elapsed += dt;

    if (!this.enabled) {
      this.burst = null;
      return null;
    }

    this.applyBurst(fx);
    this.maybeSwitchShade(arousal, fx);

    if (this.elapsed < this.nextAt) return null;
    this.nextAt = this.elapsed + this.interval();
    return this.act(arousal, fx);
  }

  private maybeSwitchShade(arousal: number, fx: VisualFx): void {
    const tier = tierFromArousal(arousal);
    const tierChanged = this.lastTier !== null && this.lastTier !== tier;
    this.lastTier = tier;
    if (this.held('shade')) return;
    if (!tierChanged && this.elapsed < this.nextShadeAt) return;
    this.assignShade(tier, fx);
    const span = SHADE_INTERVAL_MAX_SEC - SHADE_INTERVAL_MIN_SEC;
    this.nextShadeAt = this.elapsed + SHADE_INTERVAL_MIN_SEC + this.random() * span;
  }

  private assignShade(tier: EnergyTier, fx: VisualFx): void {
    const preferred = SHADE_BY_TIER[tier];
    const others = preferred.filter((mode) => mode !== fx.shadeMode);
    const pool = others.length > 0 ? others : preferred;
    fx.shadeMode = pool[Math.floor(this.random() * pool.length)]!;
  }

  private interval(): number {
    return (
      AUTOPILOT_INTERVAL_MIN_SEC +
      this.random() * (AUTOPILOT_INTERVAL_MAX_SEC - AUTOPILOT_INTERVAL_MIN_SEC)
    );
  }

  private held(param: FxParam): boolean {
    return this.holdUntil[param] > this.elapsed;
  }

  private act(arousal: number, fx: VisualFx): FxParam | null {
    const tier = tierFromArousal(arousal);

    if (tier !== 'calm' && !this.burst && this.random() < BURST_CHANCE) {
      const burstParams = (['trail', 'chroma'] as const).filter((param) => !this.held(param));
      if (burstParams.length > 0) {
        const param = burstParams[Math.floor(this.random() * burstParams.length)]!;
        this.startBurst(param, fx);
        return param;
      }
    }

    const open = PARAMS.filter((param) => !this.held(param) && param !== this.burst?.param);
    if (open.length === 0) return null;
    const param = open[Math.floor(this.random() * open.length)]!;
    this.nudge(param, tier, fx);
    return param;
  }

  private nudge(param: DialParam, tier: EnergyTier, fx: VisualFx): void {
    const band = TIERS[tier];
    if (param === 'crt') {
      fx.crt = this.random() < band.crtOn;
      return;
    }
    const range = band[param];
    const target = range.min + this.random() * (range.max - range.min);
    const current = fx[param];
    fx[param] = current + (target - current) * NUDGE_BLEND;
    fx.clamp();
  }

  private startBurst(param: 'trail' | 'chroma', fx: VisualFx): void {
    const duration =
      BURST_DURATION_MIN_SEC + this.random() * (BURST_DURATION_MAX_SEC - BURST_DURATION_MIN_SEC);
    const ceiling = param === 'trail' ? Math.min(0.75, TRAIL_RANGE.max) : Math.min(0.65, CHROMA_RANGE.max);
    const restore = fx[param];
    const peak = Math.min(ceiling, restore + 0.35);
    const rise = Math.min(BURST_RISE_SEC, duration * 0.25);
    this.burst = {
      param,
      restore,
      peak,
      start: this.elapsed,
      riseEnd: this.elapsed + rise,
      fallStart: this.elapsed + duration * 0.65,
      end: this.elapsed + duration,
    };
  }

  private applyBurst(fx: VisualFx): void {
    const burst = this.burst;
    if (!burst) return;

    if (this.elapsed >= burst.end) {
      fx[burst.param] = burst.restore;
      fx.clamp();
      this.burst = null;
      return;
    }

    let value: number;
    if (this.elapsed < burst.riseEnd) {
      const t = (this.elapsed - burst.start) / (burst.riseEnd - burst.start);
      value = burst.restore + (burst.peak - burst.restore) * t;
    } else if (this.elapsed < burst.fallStart) {
      value = burst.peak;
    } else {
      const t = (this.elapsed - burst.fallStart) / (burst.end - burst.fallStart);
      value = burst.peak + (burst.restore - burst.peak) * t;
    }
    fx[burst.param] = value;
    fx.clamp();
  }
}
