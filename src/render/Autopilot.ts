import { CHROMA_RANGE, TRAIL_RANGE, type FxParam, type VisualFx } from '../state/visualFx';

/**
 * Timer-driven stand-in for ref/age-vd's beat-clock autopilot. This project
 * has no beat detector, and shape is a continuous mood blend rather than a
 * discrete look list, so Autopilot wanders the FX dials a person would turn
 * (trail, chroma, CRT, vector-scope size) and steps the geometry shading
 * mode on its own trigger.
 *
 * Trail, chroma, CRT, and scope size snap off or to a strong value so the
 * change reads. Shading switches on an arousal-tier change or, if the tier
 * holds, on a 24–50s timer. A manual pick is held for MANUAL_HOLD_SEC.
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
const BURST_RISE_SEC = 0.6;

/** Chance trail or scope size snaps on. Chroma is stricter and lives on its own table. */
const FX_ON_CHANCE: Record<EnergyTier, number> = {
  calm: 0.1,
  drive: 0.32,
  peak: 0.8,
};

/** Chroma stays off in calm, a light touch in drive, and strong only at peak. */
const CHROMA_ON_CHANCE: Record<EnergyTier, number> = {
  calm: 0,
  drive: 0.1,
  peak: 0.75,
};

const TRAIL_ON = { min: 0.78, max: TRAIL_RANGE.max };
const CHROMA_MILD = { min: 0.18, max: 0.38 };
const CHROMA_ON = { min: 0.72, max: CHROMA_RANGE.max };
const SCOPE_OFF = { min: 0.35, max: 0.55 };
const SCOPE_ON = { min: 1.6, max: 2.5 };

export type EnergyTier = 'calm' | 'drive' | 'peak';

export function tierFromArousal(arousal: number): EnergyTier {
  if (arousal >= 0.35) return 'peak';
  if (arousal <= -0.2) return 'calm';
  return 'drive';
}

interface TierBands {
  /** Probability of turning CRT on when that dial is the one being nudged. */
  crtOn: number;
}

const TIERS: Record<EnergyTier, TierBands> = {
  calm: { crtOn: 0.08 },
  drive: { crtOn: 0.25 },
  peak: { crtOn: 0.72 },
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
    if (tierChanged && tier !== 'peak' && !this.held('chroma')) {
      fx.chroma = 0;
      if (this.burst?.param === 'chroma') this.burst = null;
    }
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
      const burstParams = (['trail', 'chroma'] as const).filter((param) => {
        if (this.held(param)) return false;
        return param === 'trail' || tier === 'peak';
      });
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
    if (param === 'crt') {
      fx.crt = this.random() < TIERS[tier].crtOn;
      return;
    }
    const on = this.random() < (param === 'chroma' ? CHROMA_ON_CHANCE[tier] : FX_ON_CHANCE[tier]);
    if (param === 'vectorScopeGain') {
      const range = on ? SCOPE_ON : SCOPE_OFF;
      fx.vectorScopeGain = range.min + this.random() * (range.max - range.min);
      fx.clamp();
      return;
    }
    if (!on) {
      fx[param] = 0;
    } else if (param === 'chroma') {
      const range = tier === 'peak' ? CHROMA_ON : CHROMA_MILD;
      fx.chroma = range.min + this.random() * (range.max - range.min);
    } else {
      const range = TRAIL_ON;
      fx.trail = range.min + this.random() * (range.max - range.min);
    }
    fx.clamp();
  }

  private startBurst(param: 'trail' | 'chroma', fx: VisualFx): void {
    const duration =
      BURST_DURATION_MIN_SEC + this.random() * (BURST_DURATION_MAX_SEC - BURST_DURATION_MIN_SEC);
    const peak = param === 'trail' ? TRAIL_ON.max : CHROMA_ON.max;
    const restore = fx[param];
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
