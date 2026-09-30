import type { BandAnalysers } from './bands';

export interface AudioGraph {
  context: AudioContext;
  analysers: BandAnalysers;
  stop(): void;
}
