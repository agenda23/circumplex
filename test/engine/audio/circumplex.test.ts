import { describe, expect, it } from 'vitest';
import {
  createCircumplexSmoother,
  estimateRaw,
  FLUX_NORM,
  type CircumplexFeatures,
} from '../../../src/engine/audio/circumplex';

const quiet: CircumplexFeatures = { rms: 0, centroid: 0, flatness: 1, flux: 0, chroma: new Array(12).fill(1 / 12) };
const loudNoisy: CircumplexFeatures = {
  rms: 1,
  centroid: 8000,
  flatness: 1,
  flux: 1,
  chroma: new Array(12).fill(1 / 12),
};
const loudTonal: CircumplexFeatures = {
  rms: 1,
  centroid: 8000,
  flatness: 0,
  flux: 1,
  chroma: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

describe('estimateRaw', () => {
  it('stays within [-1, 1] for extreme inputs', () => {
    for (const f of [quiet, loudNoisy, loudTonal]) {
      const { valence, arousal } = estimateRaw(f);
      expect(valence).toBeGreaterThanOrEqual(-1);
      expect(valence).toBeLessThanOrEqual(1);
      expect(arousal).toBeGreaterThanOrEqual(-1);
      expect(arousal).toBeLessThanOrEqual(1);
    }
  });

  it('gives quiet/silent input low arousal', () => {
    expect(estimateRaw(quiet).arousal).toBeLessThan(-0.5);
  });

  it('gives loud/bright/changing input high arousal', () => {
    expect(estimateRaw(loudNoisy).arousal).toBeGreaterThan(0.5);
  });

  it('gives a tonal, concentrated chroma higher valence than a flat/noisy one', () => {
    expect(estimateRaw(loudTonal).valence).toBeGreaterThan(estimateRaw(loudNoisy).valence);
  });

  it('raises arousal with flux and saturates at FLUX_NORM', () => {
    const base: CircumplexFeatures = { ...quiet, rms: 0.5, centroid: 2000, flatness: 0.5 };
    const still = estimateRaw({ ...base, flux: 0 }).arousal;
    const partial = estimateRaw({ ...base, flux: FLUX_NORM / 2 }).arousal;
    const full = estimateRaw({ ...base, flux: FLUX_NORM }).arousal;
    const beyond = estimateRaw({ ...base, flux: FLUX_NORM * 8 }).arousal;
    expect(partial).toBeGreaterThan(still);
    expect(full).toBeGreaterThan(partial);
    expect(beyond).toBeCloseTo(full, 5);
  });
});

describe('createCircumplexSmoother', () => {
  it('jumps straight to the first sample (no startup lag)', () => {
    const smoother = createCircumplexSmoother(4);
    const result = smoother.update({ valence: 0.8, arousal: -0.3 }, 1 / 60);
    expect(result).toEqual({ valence: 0.8, arousal: -0.3 });
  });

  it('damps a step change instead of jumping instantly', () => {
    const smoother = createCircumplexSmoother(4);
    smoother.update({ valence: 0, arousal: 0 }, 1 / 60);
    const oneFrameLater = smoother.update({ valence: 1, arousal: 1 }, 1 / 60);
    expect(oneFrameLater.valence).toBeGreaterThan(0);
    expect(oneFrameLater.valence).toBeLessThan(0.1);
  });

  it('converges close to the target after several time constants', () => {
    const smoother = createCircumplexSmoother(4);
    smoother.update({ valence: 0, arousal: 0 }, 1 / 60);
    let result = { valence: 0, arousal: 0 };
    for (let t = 0; t < 20; t += 1) {
      result = smoother.update({ valence: 1, arousal: -1 }, 1);
    }
    expect(result.valence).toBeGreaterThan(0.95);
    expect(result.arousal).toBeLessThan(-0.95);
  });
});
