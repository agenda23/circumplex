import type { BandLevels } from '../types';

/**
 * Subset of AnalyserNode used here, so pure logic can be tested against a
 * fake without spinning up a real AudioContext.
 */
export interface AnalyserLike {
  fftSize: number;
  getByteTimeDomainData(array: Uint8Array): void;
}

export interface BandAnalysers {
  low: AnalyserLike;
  mid: AnalyserLike;
  high: AnalyserLike;
}

export function createAnalyser(context: AudioContext, fftSize = 1024): AnalyserNode {
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.8;
  return analyser;
}

/** RMS of the time-domain signal, normalized to roughly 0..1. */
function rmsLevel(node: AnalyserLike, scratch: Uint8Array): number {
  node.getByteTimeDomainData(scratch);
  let sum = 0;
  for (let i = 0; i < scratch.length; i++) {
    const v = (scratch[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / scratch.length);
}

const scratchBuffers = new WeakMap<AnalyserLike, Uint8Array>();

function scratchFor(node: AnalyserLike): Uint8Array {
  let buf = scratchBuffers.get(node);
  if (!buf || buf.length !== node.fftSize) {
    buf = new Uint8Array(node.fftSize);
    scratchBuffers.set(node, buf);
  }
  return buf;
}

export function readBandLevels(analysers: BandAnalysers): BandLevels {
  return {
    low: rmsLevel(analysers.low, scratchFor(analysers.low)),
    mid: rmsLevel(analysers.mid, scratchFor(analysers.mid)),
    high: rmsLevel(analysers.high, scratchFor(analysers.high)),
  };
}

/** Same RMS level calc as `readBandLevels`, for a single analyser (e.g. a full-spectrum one). */
export function readAnalyserLevel(node: AnalyserLike): number {
  return rmsLevel(node, scratchFor(node));
}
