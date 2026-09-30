import { describe, expect, it } from 'vitest';
import { LevelEnvelope } from '../../../src/engine/audio/levelEnvelope';

function run(envelope: LevelEnvelope, low: number, totalSec: number, stepSec = 0.02): number {
  let out = 0;
  for (let t = 0; t < totalSec; t += stepSec) {
    out = envelope.update({ low, mid: 0, high: 0 }, stepSec).low;
  }
  return out;
}

describe('LevelEnvelope', () => {
  it('starts at 0', () => {
    const envelope = new LevelEnvelope();
    expect(envelope.update({ low: 0, mid: 0, high: 0 }, 0).low).toBe(0);
  });

  it('sensitivity scales the output once settled (peak normalize off)', () => {
    const base = new LevelEnvelope();
    base.peakNormalize = false;
    const boosted = new LevelEnvelope();
    boosted.peakNormalize = false;
    boosted.sensitivity = 2.0;

    const baseOut = run(base, 0.2, 5);
    const boostedOut = run(boosted, 0.2, 5);
    expect(boostedOut).toBeCloseTo(baseOut * 2, 3);
  });

  it('attack reacts faster than release to the same step size', () => {
    // Attack: starting at 0, one step toward target 1.
    const attackEnvelope = new LevelEnvelope();
    attackEnvelope.peakNormalize = false;
    attackEnvelope.attackMs = 8;
    const afterAttackStep = attackEnvelope.update({ low: 1, mid: 0, high: 0 }, 0.02).low;
    const attackFraction = afterAttackStep / 1; // fraction of the 0->1 gap covered

    // Release: starting near 1 (settled), one step toward target 0.
    const releaseEnvelope = new LevelEnvelope();
    releaseEnvelope.peakNormalize = false;
    releaseEnvelope.releaseMs = 160;
    releaseEnvelope.attackMs = 1; // settle to ~1 quickly so the drop starts from a known baseline
    const settled = releaseEnvelope.update({ low: 1, mid: 0, high: 0 }, 5).low; // effectively fully settled
    const afterReleaseStep = releaseEnvelope.update({ low: 0, mid: 0, high: 0 }, 0.02).low;
    const releaseFraction = (settled - afterReleaseStep) / settled; // fraction of the gap covered back toward 0

    expect(attackFraction).toBeGreaterThan(releaseFraction);
    expect(attackFraction).toBeGreaterThan(0.5);
  });

  it('peak-normalizes a quiet-but-steady signal up toward full scale over time', () => {
    const envelope = new LevelEnvelope();
    envelope.peakNormalize = true;
    const out = run(envelope, 0.1, 30);
    expect(out).toBeGreaterThan(0.9);
  });

  it('does not auto-boost when peak normalize is disabled', () => {
    const envelope = new LevelEnvelope();
    envelope.peakNormalize = false;
    const out = run(envelope, 0.1, 30);
    expect(out).toBeCloseTo(0.1, 2);
  });

  it('processes low/mid/high independently', () => {
    const envelope = new LevelEnvelope();
    envelope.peakNormalize = false;
    const out = envelope.update({ low: 1, mid: 0, high: 0.5 }, 0.02);
    expect(out.low).toBeGreaterThan(0);
    expect(out.mid).toBe(0);
    expect(out.high).toBeGreaterThan(0);
    expect(out.high).toBeLessThan(out.low);
  });
});
