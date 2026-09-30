import { createAnalyser } from './bands';
import type { AudioGraph } from './graph';

interface PulsingTone {
  output: GainNode;
  stop(): void;
}

/** A tone whose amplitude pulses via an LFO, to fake a "beat" without a mic. */
function createPulsingTone(
  context: AudioContext,
  toneFreqHz: number,
  lfoFreqHz: number,
  baseGain: number,
  depth: number,
): PulsingTone {
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = toneFreqHz;

  const gain = context.createGain();
  gain.gain.value = 0; // driven entirely by the constant + LFO sources below

  const base = context.createConstantSource();
  base.offset.value = baseGain;

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = lfoFreqHz;
  const lfoDepth = context.createGain();
  lfoDepth.gain.value = depth;

  osc.connect(gain);
  base.connect(gain.gain);
  lfo.connect(lfoDepth).connect(gain.gain);

  osc.start();
  base.start();
  lfo.start();

  return {
    output: gain,
    stop() {
      osc.stop();
      base.stop();
      lfo.stop();
    },
  };
}

export function createDemoAudioGraph(): AudioGraph {
  const context = new AudioContext();

  // Rough "kick" pulse at 2Hz (~120bpm quarter notes), a mid tone, and a
  // faster hat-like flutter — just enough variation to exercise the pipeline.
  const low = createPulsingTone(context, 55, 2, 0.5, 0.4);
  const mid = createPulsingTone(context, 440, 3.7, 0.3, 0.2);
  const high = createPulsingTone(context, 5000, 6.3, 0.15, 0.12);

  const lowAnalyser = createAnalyser(context);
  const midAnalyser = createAnalyser(context);
  const highAnalyser = createAnalyser(context);

  // Intentionally not connected to `context.destination` — silent by design.
  low.output.connect(lowAnalyser);
  mid.output.connect(midAnalyser);
  high.output.connect(highAnalyser);

  return {
    context,
    analysers: { low: lowAnalyser, mid: midAnalyser, high: highAnalyser },
    stop() {
      low.stop();
      mid.stop();
      high.stop();
      void context.close();
    },
  };
}
