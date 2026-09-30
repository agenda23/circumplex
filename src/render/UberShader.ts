import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { EngineState } from '../engine/types';
import { NOISE_UTILS, OKLCH_UTILS, SDF_PRIMITIVES } from './shaders/sdf';

type AudioState = Pick<EngineState, 'levels' | 'circumplex' | 'features'>;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// PRD §4.1: a very-low-frequency LFO so color/noise seeds keep drifting
// over a long (1hr+) set instead of settling into a visibly repeating loop.
const LFO_HZ = 0.01;
const TURNTABLE_RAD_PER_SEC = 0.15;
const TAU = 6.28318530718;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uLow;
  uniform float uMid;
  uniform float uHigh;
  uniform float uValence;
  uniform float uArousal;
  uniform float uHarmonicRichness;
  uniform float uCentroidNorm;
  uniform float uRms;

  ${SDF_PRIMITIVES}
  ${NOISE_UTILS}
  ${OKLCH_UTILS}

  float map(vec3 p) {
    p.xz *= rot2(uTime * ${TURNTABLE_RAD_PER_SEC.toFixed(4)});

    float lfoPhase = uTime * ${LFO_HZ.toFixed(4)} * ${TAU.toFixed(8)};
    vec3 seedOffset = vec3(sin(lfoPhase), cos(lfoPhase * 0.7), sin(lfoPhase * 1.3)) * 0.6;

    float scale = 1.0 + uLow * 0.35;
    float blobDisp = fbm(p * 1.8 + seedOffset) * (0.25 + uMid * 0.6);
    float blob = sdSphere(p / scale, 1.0) * scale - blobDisp;

    vec3 pt = p;
    pt.xy *= rot2(0.6);
    float torus = sdTorus(pt, vec2(1.15, 0.32));

    float morph = 0.5 + 0.5 * sin(lfoPhase * 0.5);
    float d = smin(blob, torus, 0.5 + morph * 0.4);

    // High band: subtle surface ripple, a stand-in for "edge glow/particle
    // detail" per PRD §2.2 until a real particle system exists.
    d += sin(p.x * 14.0 + p.y * 11.0 + p.z * 9.0 + uTime * 3.0) * uHigh * 0.015;

    return d;
  }

  vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(0.0015, 0.0);
    return normalize(vec3(
      map(p + e.xyy) - map(p - e.xyy),
      map(p + e.yxy) - map(p - e.yxy),
      map(p + e.yyx) - map(p - e.yyx)
    ));
  }

  const int MAX_STEPS = 90;
  const float MAX_DIST = 20.0;
  const float SURF_DIST = 0.0015;

  float raymarch(vec3 ro, vec3 rd, out bool hit) {
    float t = 0.0;
    hit = false;
    for (int i = 0; i < MAX_STEPS; i++) {
      vec3 p = ro + rd * t;
      float d = map(p);
      if (d < SURF_DIST) { hit = true; break; }
      t += d;
      if (t > MAX_DIST) break;
    }
    return t;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec3 ro = vec3(0.0, 0.0, 9.0);
    vec3 rd = normalize(vec3(uv, -2.6));

    bool hit;
    float t = raymarch(ro, rd, hit);

    vec3 color = vec3(0.0);

    if (hit) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);
      vec3 lightDir = normalize(vec3(0.5, 0.7, 0.5));
      float diffuse = max(dot(n, lightDir), 0.0);
      float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);

      // Hue: Circumplex polar angle (primary) + a centroid-derived offset as
      // a stand-in for "mid-band dominant pitch" (PRD §3.3) -- real pitch
      // detection isn't built yet, centroid is the closest feature we have.
      float hue = atan(uArousal, uValence) / ${TAU.toFixed(8)} + 0.5;
      hue += uCentroidNorm * 0.15;
      hue = fract(hue + uTime * ${LFO_HZ.toFixed(4)} * 0.3);

      float radius = clamp(length(vec2(uValence, uArousal)), 0.0, 1.0);
      float oChroma = clamp(0.06 + radius * 0.10 + uHarmonicRichness * 0.08, 0.0, 0.16);
      float lightness = clamp(0.35 + uRms * 0.5, 0.0, 0.9);

      vec3 base = oklchToLinearSrgb(lightness, oChroma, hue * ${TAU.toFixed(8)});
      color = base * (0.25 + diffuse * 0.75);
      color += base * fresnel * (0.6 + uHigh * 1.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const CENTROID_NORM_HZ = 4000;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export class UberShader {
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly material: THREE.ShaderMaterial;
  private readonly startTime = performance.now();

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uLow: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uValence: { value: 0 },
        uArousal: { value: 0 },
        uHarmonicRichness: { value: 0 },
        uCentroidNorm: { value: 0 },
        uRms: { value: 0 },
      },
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.65);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  setAudio(state: AudioState): void {
    const u = this.material.uniforms;
    u.uLow!.value = state.levels.low;
    u.uMid!.value = state.levels.mid;
    u.uHigh!.value = state.levels.high;
    u.uValence!.value = state.circumplex.valence;
    u.uArousal!.value = state.circumplex.arousal;
    u.uHarmonicRichness!.value = clamp01(1 - state.features.flatness);
    u.uCentroidNorm!.value = clamp01(state.features.centroid / CENTROID_NORM_HZ);
    u.uRms!.value = clamp01(state.features.rms);
    u.uTime!.value = (performance.now() - this.startTime) / 1000;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.material.uniforms.uResolution!.value.set(width, height);
  }

  render(): void {
    this.composer.render();
  }
}
