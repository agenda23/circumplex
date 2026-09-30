import { describe, expect, it } from 'vitest';
import {
  Autopilot,
  MANUAL_HOLD_SEC,
  SHADE_FIRST_SEC,
  tierFromArousal,
} from '../../src/render/Autopilot';
import { VisualFx } from '../../src/state/visualFx';

/** Math.random()-style values in [0, 1). Each call consumes the next entry, then 0. */
function scripted(values: number[]): () => number {
  let i = 0;
  return () => values[i++] ?? 0;
}

describe('tierFromArousal', () => {
  it('splits calm / drive / peak', () => {
    expect(tierFromArousal(-0.2)).toBe('calm');
    expect(tierFromArousal(-0.19)).toBe('drive');
    expect(tierFromArousal(0)).toBe('drive');
    expect(tierFromArousal(0.35)).toBe('peak');
  });
});

describe('Autopilot', () => {
  it('does not touch FX before the first interval', () => {
    const ap = new Autopilot(scripted([0]));
    const fx = new VisualFx();
    expect(ap.update(7.9, 0.5, fx)).toBeNull();
    expect(fx.trail).toBe(0);
    expect(fx.chroma).toBe(0);
  });

  it('nudges one dial once the interval elapses, including while calm (no burst)', () => {
    const ap = new Autopilot(scripted([0, 0, 0, 0.99]));
    const fx = new VisualFx();
    expect(ap.update(8, -1, fx)).toBe('trail');
    expect(ap.bursting).toBe(false);
    expect(fx.trail).toBeGreaterThan(0);
    expect(fx.trail).toBeLessThan(0.12);
  });

  it('skips a dial the operator just moved', () => {
    const ap = new Autopilot(scripted([0, 0, 0, 0.99]));
    const fx = new VisualFx();
    ap.noteManual('trail');
    expect(ap.update(8, -1, fx)).toBe('chroma');
    expect(fx.trail).toBe(0);
    expect(fx.chroma).toBeGreaterThan(0);
  });

  it('releases a manual hold after 90 seconds', () => {
    // One step lands exactly on the hold expiry, so the scheduled action
    // sees trail as available again and picks it (index 0, calm).
    // Two extra zeros are the shading pick and its reschedule, which fire
    // inside this same step because 90s passes the shading timer.
    const ap = new Autopilot(scripted([0, 0, 0, 0, 0, 0.99]));
    const fx = new VisualFx();
    ap.noteManual('trail');
    expect(ap.update(MANUAL_HOLD_SEC, -1, fx)).toBe('trail');
    expect(fx.trail).toBeGreaterThan(0);
  });

  it('bursts trail above calm and restores it afterwards', () => {
    const ap = new Autopilot(scripted([0, 0, 0, 0, 0]));
    const fx = new VisualFx();
    expect(ap.update(8, 0.8, fx)).toBe('trail');
    expect(ap.bursting).toBe(true);
    expect(fx.trail).toBe(0);

    ap.update(0.3, 0.8, fx);
    expect(fx.trail).toBeGreaterThan(0.15);
    expect(fx.trail).toBeLessThan(0.35);

    ap.update(1.8, 0.8, fx);
    expect(ap.bursting).toBe(false);
    expect(fx.trail).toBe(0);
  });

  it('does nothing while disabled', () => {
    const ap = new Autopilot(scripted([0]));
    ap.enabled = false;
    const fx = new VisualFx();
    fx.trail = 0.4;
    expect(ap.update(30, 0.8, fx)).toBeNull();
    expect(fx.trail).toBe(0.4);
    expect(ap.bursting).toBe(false);
  });

  it('switches shading when the arousal tier changes', () => {
    const ap = new Autopilot(scripted([0, 0, 0]));
    const fx = new VisualFx();
    ap.update(1, -1, fx);
    expect(fx.shadeMode).toBe(0);
    ap.update(1, 0.8, fx);
    expect(fx.shadeMode).toBe(1);
  });

  it('switches shading on its timer when the tier stays put', () => {
    const ap = new Autopilot(scripted([0, 0, 0]));
    const fx = new VisualFx();
    ap.update(SHADE_FIRST_SEC - 1, -1, fx);
    expect(fx.shadeMode).toBe(0);
    ap.update(1, -1, fx);
    expect(fx.shadeMode).toBe(2);
  });

  it('keeps a manual shading pick through tier changes and the timer', () => {
    const ap = new Autopilot(scripted([0]));
    const fx = new VisualFx();
    ap.noteManual('shade');
    ap.update(1, -1, fx);
    ap.update(1, 0.8, fx);
    ap.update(SHADE_FIRST_SEC, -1, fx);
    expect(fx.shadeMode).toBe(0);
  });

  it('returns null when every dial is on manual hold', () => {
    const ap = new Autopilot(scripted([0]));
    const fx = new VisualFx();
    ap.noteManual('trail');
    ap.noteManual('chroma');
    ap.noteManual('crt');
    ap.noteManual('vectorScopeGain');
    expect(ap.update(8, 0.5, fx)).toBeNull();
    expect(fx.trail).toBe(0);
    expect(fx.crt).toBe(false);
  });
});
