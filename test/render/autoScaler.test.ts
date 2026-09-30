import { describe, expect, it } from 'vitest';
import { AutoScaler, type AutoScalerConfig } from '../../src/render/AutoScaler';

const CONFIG: AutoScalerConfig = {
  maxLevel: 3,
  downFps: 50,
  upFps: 57,
  downHoldSec: 2,
  upHoldSec: 4,
  cooldownSec: 2,
};

function run(scaler: AutoScaler, fps: number, totalSec: number, stepSec = 0.5): number {
  let level = scaler.getLevel();
  for (let t = 0; t < totalSec; t += stepSec) {
    level = scaler.update(fps, stepSec);
  }
  return level;
}

describe('AutoScaler', () => {
  it('starts at level 0', () => {
    expect(new AutoScaler(CONFIG).getLevel()).toBe(0);
  });

  it('does not react to a brief dip below downFps', () => {
    const scaler = new AutoScaler(CONFIG);
    const level = run(scaler, 30, 1); // below downHoldSec(2s)
    expect(level).toBe(0);
  });

  it('steps down after fps stays below downFps for downHoldSec', () => {
    const scaler = new AutoScaler(CONFIG);
    const level = run(scaler, 30, 2.5);
    expect(level).toBe(1);
  });

  it('stays in the middle band (between downFps and upFps) without changing level', () => {
    const scaler = new AutoScaler(CONFIG);
    const level = run(scaler, 53, 10);
    expect(level).toBe(0);
  });

  it('clamps at maxLevel even under continued sustained low fps', () => {
    const scaler = new AutoScaler(CONFIG);
    // Each down-step costs downHoldSec + cooldownSec; run long enough to hit the ceiling.
    const level = run(scaler, 10, 30);
    expect(level).toBe(CONFIG.maxLevel);
  });

  it('recovers (steps down in level number) after sustained fps above upFps', () => {
    const scaler = new AutoScaler(CONFIG);
    run(scaler, 10, 30); // drive to maxLevel
    expect(scaler.getLevel()).toBe(CONFIG.maxLevel);

    const recovered = run(scaler, 60, 10);
    expect(recovered).toBeLessThan(CONFIG.maxLevel);
  });

  it('never goes below level 0', () => {
    const scaler = new AutoScaler(CONFIG);
    const level = run(scaler, 60, 20);
    expect(level).toBe(0);
  });

  it('ignores fps during the post-change cooldown', () => {
    const scaler = new AutoScaler(CONFIG);
    // Cross the down threshold to trigger a level change + cooldown.
    scaler.update(30, 1);
    const beforeCooldownEnds = scaler.update(30, 1); // total 2s low -> steps down to 1, cooldown starts
    expect(beforeCooldownEnds).toBe(1);

    // Even sustained high fps during cooldown must not immediately reverse it.
    const duringCooldown = scaler.update(100, 1);
    expect(duringCooldown).toBe(1);
  });

  it('does nothing when disabled', () => {
    const scaler = new AutoScaler(CONFIG);
    scaler.enabled = false;
    const level = run(scaler, 10, 30);
    expect(level).toBe(0);
  });
});
