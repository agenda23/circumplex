import { describe, expect, it } from 'vitest';
import { chromagram, spectralCentroid, spectralFlatness, spectralFlux } from '../../../src/engine/audio/features';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 4096;
const BIN_COUNT = FFT_SIZE / 2;
const SILENCE_DB = -Infinity;

function silentSpectrum(): Float32Array {
  return new Float32Array(BIN_COUNT).fill(SILENCE_DB);
}

/** A spectrum with a single loud bin near `hz`, everything else silent. */
function toneSpectrum(hz: number, db = -10): Float32Array {
  const spectrum = silentSpectrum();
  const bin = Math.round((hz * FFT_SIZE) / SAMPLE_RATE);
  spectrum[bin] = db;
  return spectrum;
}

/** Every bin at the same level: flat/noise-like. */
function flatSpectrum(db = -20): Float32Array {
  return new Float32Array(BIN_COUNT).fill(db);
}

describe('spectralCentroid', () => {
  it('is ~0 for silence', () => {
    expect(spectralCentroid(silentSpectrum(), SAMPLE_RATE, FFT_SIZE)).toBeCloseTo(0, 0);
  });

  it('tracks the frequency of a single loud tone', () => {
    const centroid = spectralCentroid(toneSpectrum(1000), SAMPLE_RATE, FFT_SIZE);
    expect(centroid).toBeGreaterThan(900);
    expect(centroid).toBeLessThan(1100);
  });
});

describe('spectralFlatness', () => {
  it('is high (close to 1) for a flat/noise-like spectrum', () => {
    expect(spectralFlatness(flatSpectrum())).toBeGreaterThan(0.9);
  });

  it('is low for a spectrum dominated by a single tone', () => {
    expect(spectralFlatness(toneSpectrum(1000, 20))).toBeLessThan(0.5);
  });
});

describe('spectralFlux', () => {
  it('is 0 when there is no previous frame', () => {
    expect(spectralFlux(toneSpectrum(1000), null)).toBe(0);
  });

  it('is 0 for two identical frames', () => {
    const spectrum = toneSpectrum(1000);
    expect(spectralFlux(spectrum, spectrum)).toBe(0);
  });

  it('is positive when energy increases frame-to-frame', () => {
    const flux = spectralFlux(toneSpectrum(1000, 0), toneSpectrum(1000, -40));
    expect(flux).toBeGreaterThan(0);
  });
});

describe('chromagram', () => {
  it('sums to 1 when there is energy', () => {
    const chroma = chromagram(toneSpectrum(440), SAMPLE_RATE, FFT_SIZE);
    const sum = chroma.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('is all-zero for silence', () => {
    const chroma = chromagram(silentSpectrum(), SAMPLE_RATE, FFT_SIZE);
    expect(chroma.every((v) => v === 0)).toBe(true);
  });

  it('puts most energy at pitch class 9 (A) for a 440Hz tone', () => {
    const chroma = chromagram(toneSpectrum(440), SAMPLE_RATE, FFT_SIZE);
    const maxIndex = chroma.indexOf(Math.max(...chroma));
    expect(maxIndex).toBe(9);
  });
});
