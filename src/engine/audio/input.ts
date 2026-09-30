import { createAnalyser } from './bands';
import type { AudioGraph } from './graph';

// PRD 2.2: pseudo-stem band split via BiquadFilterNode.
const LOW_CUTOFF_HZ = 150;
const MID_LOW_CUTOFF_HZ = 300;
const MID_HIGH_CUTOFF_HZ = 3000;
const HIGH_CUTOFF_HZ = 4000;

// PRD 2.3: a wider FFT for usable pitch-class/centroid resolution. No extra
// analyser smoothing here — the 3-5s smoothing happens on the derived
// Circumplex point instead (see engine/audio/circumplex.ts).
const FULL_FFT_SIZE = 4096;

export async function createMicAudioGraph(): Promise<AudioGraph> {
  // PRD 2.1: disable browser correction so we get the raw signal.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2,
    },
  });

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);

  const lowFilter = context.createBiquadFilter();
  lowFilter.type = 'lowpass';
  lowFilter.frequency.value = LOW_CUTOFF_HZ;

  const midHighpass = context.createBiquadFilter();
  midHighpass.type = 'highpass';
  midHighpass.frequency.value = MID_LOW_CUTOFF_HZ;
  const midLowpass = context.createBiquadFilter();
  midLowpass.type = 'lowpass';
  midLowpass.frequency.value = MID_HIGH_CUTOFF_HZ;

  const highFilter = context.createBiquadFilter();
  highFilter.type = 'highpass';
  highFilter.frequency.value = HIGH_CUTOFF_HZ;

  const lowAnalyser = createAnalyser(context);
  const midAnalyser = createAnalyser(context);
  const highAnalyser = createAnalyser(context);
  const fullAnalyser = createAnalyser(context, FULL_FFT_SIZE);
  fullAnalyser.smoothingTimeConstant = 0;

  source.connect(lowFilter).connect(lowAnalyser);
  source.connect(midHighpass).connect(midLowpass).connect(midAnalyser);
  source.connect(highFilter).connect(highAnalyser);
  source.connect(fullAnalyser);

  return {
    context,
    analysers: { low: lowAnalyser, mid: midAnalyser, high: highAnalyser, full: fullAnalyser },
    stop() {
      for (const track of stream.getTracks()) track.stop();
      void context.close();
    },
  };
}
