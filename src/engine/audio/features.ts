/**
 * Pure MIR feature extraction (PRD 2.3). Operates on dB-scale frequency data
 * as produced by `AnalyserNode.getFloatFrequencyData`, so it's testable
 * without a real AudioContext.
 */

const A4_HZ = 440;
const A4_MIDI = 69;
const MIN_CHROMA_HZ = 60;
const MAX_CHROMA_HZ = 5000;
const EPS = 1e-9;

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function binFrequencyHz(binIndex: number, sampleRate: number, fftSize: number): number {
  return (binIndex * sampleRate) / fftSize;
}

export function spectralCentroid(freqDb: Float32Array<ArrayBufferLike>, sampleRate: number, fftSize: number): number {
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < freqDb.length; i++) {
    const mag = dbToLinear(freqDb[i]!);
    weighted += binFrequencyHz(i, sampleRate, fftSize) * mag;
    total += mag;
  }
  return total > EPS ? weighted / total : 0;
}

/** Wiener entropy: geometric mean / arithmetic mean of the magnitude spectrum, in 0..1. */
export function spectralFlatness(freqDb: Float32Array<ArrayBufferLike>): number {
  let logSum = 0;
  let linSum = 0;
  const n = freqDb.length;
  for (let i = 0; i < n; i++) {
    const mag = dbToLinear(freqDb[i]!) + EPS;
    logSum += Math.log(mag);
    linSum += mag;
  }
  const geometricMean = Math.exp(logSum / n);
  const arithmeticMean = linSum / n;
  return arithmeticMean > EPS ? geometricMean / arithmeticMean : 0;
}

/** Half-wave-rectified frame-to-frame energy increase, normalized by bin count. */
export function spectralFlux(freqDb: Float32Array<ArrayBufferLike>, prevFreqDb: Float32Array<ArrayBufferLike> | null): number {
  if (!prevFreqDb || prevFreqDb.length !== freqDb.length) return 0;
  let sum = 0;
  for (let i = 0; i < freqDb.length; i++) {
    const diff = dbToLinear(freqDb[i]!) - dbToLinear(prevFreqDb[i]!);
    if (diff > 0) sum += diff;
  }
  return sum / freqDb.length;
}

function pitchClass(freqHz: number): number {
  const midi = A4_MIDI + 12 * Math.log2(freqHz / A4_HZ);
  const rounded = Math.round(midi);
  return ((rounded % 12) + 12) % 12;
}

/** 12-bin pitch-class energy, normalized to sum to 1 (all-zero if silent). */
export function chromagram(freqDb: Float32Array<ArrayBufferLike>, sampleRate: number, fftSize: number): number[] {
  const chroma = new Array<number>(12).fill(0);
  for (let i = 0; i < freqDb.length; i++) {
    const freqHz = binFrequencyHz(i, sampleRate, fftSize);
    if (freqHz < MIN_CHROMA_HZ || freqHz > MAX_CHROMA_HZ) continue;
    chroma[pitchClass(freqHz)]! += dbToLinear(freqDb[i]!);
  }
  const total = chroma.reduce((a, b) => a + b, 0);
  return total > EPS ? chroma.map((v) => v / total) : chroma;
}
