import type { BandAnalysers } from './bands';

export interface AudioGraph {
  context: AudioContext;
  analysers: BandAnalysers & { full: AnalyserNode; vectorL: AnalyserNode; vectorR: AnalyserNode };
  stop(): void;
}
