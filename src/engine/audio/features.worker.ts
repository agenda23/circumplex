/// <reference lib="webworker" />
export {};
declare const self: DedicatedWorkerGlobalScope;

import { chromagram, spectralCentroid, spectralFlatness, spectralFlux } from './features';
import { createCircumplexSmoother, estimateRaw, type CircumplexFeatures } from './circumplex';

// PRD 2.3: 3-5s moving average; 4s picked as the midpoint.
const SMOOTHING_TIME_CONSTANT_SEC = 4;

export interface FeatureRequest {
  freqDb: Float32Array<ArrayBufferLike>;
  sampleRate: number;
  fftSize: number;
  rms: number;
  dt: number;
}

export interface FeatureResult {
  features: CircumplexFeatures;
  circumplex: ReturnType<typeof estimateRaw>;
}

let prevFreqDb: Float32Array<ArrayBufferLike> | null = null;
const smoother = createCircumplexSmoother(SMOOTHING_TIME_CONSTANT_SEC);

self.onmessage = (event: MessageEvent<FeatureRequest>) => {
  const { freqDb, sampleRate, fftSize, rms, dt } = event.data;

  const features: CircumplexFeatures = {
    rms,
    centroid: spectralCentroid(freqDb, sampleRate, fftSize),
    flatness: spectralFlatness(freqDb),
    flux: spectralFlux(freqDb, prevFreqDb),
    chroma: chromagram(freqDb, sampleRate, fftSize),
  };
  prevFreqDb = freqDb;

  const circumplex = smoother.update(estimateRaw(features), dt);

  const result: FeatureResult = { features, circumplex };
  self.postMessage(result);
};
