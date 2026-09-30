import type { BandAnalysers } from './bands';

export interface AudioGraph {
  context: AudioContext;
  analysers: BandAnalysers & { full: AnalyserNode };
  stop(): void;
}
