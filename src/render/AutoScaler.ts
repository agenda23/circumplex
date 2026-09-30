/**
 * PRD §4.2 auto-scaling governor. Watches fps and steps a discrete "quality
 * level" (0 = best) up under sustained load and back down once stable,
 * with hysteresis so it doesn't flap between levels every frame.
 *
 * Deviation from the PRD's literal "~120 frame moving average": the caller
 * already feeds an EMA-smoothed fps (see `main.ts`), so this class adds
 * time-based (not frame-count-based) hysteresis on top of that -- a frame
 * count is a different amount of wall-clock time depending on the current
 * fps, so seconds are the more robust unit here.
 */

export interface AutoScalerConfig {
  /** Highest allowed level (inclusive). What each level maps to is the caller's concern. */
  maxLevel: number;
  /** Step down (worse quality) once fps stays below this. */
  downFps: number;
  /** Step up (better quality) once fps stays above this. Must exceed downFps to avoid flapping. */
  upFps: number;
  downHoldSec: number;
  upHoldSec: number;
  /** After any level change, ignore fps for this long before judging again. */
  cooldownSec: number;
}

export const DEFAULT_AUTO_SCALER_CONFIG: AutoScalerConfig = {
  maxLevel: 6,
  downFps: 50,
  upFps: 57,
  downHoldSec: 2,
  upHoldSec: 4,
  cooldownSec: 2,
};

export class AutoScaler {
  private level = 0;
  private belowSec = 0;
  private aboveSec = 0;
  private cooldownRemaining = 0;
  enabled = true;

  constructor(private readonly config: AutoScalerConfig = DEFAULT_AUTO_SCALER_CONFIG) {}

  getLevel(): number {
    return this.level;
  }

  update(fps: number, dt: number): number {
    if (!this.enabled) return this.level;

    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
      this.belowSec = 0;
      this.aboveSec = 0;
      return this.level;
    }

    if (fps < this.config.downFps) {
      this.belowSec += dt;
      this.aboveSec = 0;
    } else if (fps > this.config.upFps) {
      this.aboveSec += dt;
      this.belowSec = 0;
    } else {
      this.belowSec = 0;
      this.aboveSec = 0;
    }

    if (this.belowSec >= this.config.downHoldSec && this.level < this.config.maxLevel) {
      this.level += 1;
      this.belowSec = 0;
      this.cooldownRemaining = this.config.cooldownSec;
    } else if (this.aboveSec >= this.config.upHoldSec && this.level > 0) {
      this.level -= 1;
      this.aboveSec = 0;
      this.cooldownRemaining = this.config.cooldownSec;
    }

    return this.level;
  }
}
