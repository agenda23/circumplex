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
  uniform float uFlux;
  uniform int uMaxSteps;
  uniform int uFbmOctaves;

  ${SDF_PRIMITIVES}
  ${NOISE_UTILS}
  ${OKLCH_UTILS}

  float map(vec3 p) {
    p.xz *= rot2(uTime * ${TURNTABLE_RAD_PER_SEC.toFixed(4)});

    float lfoPhase = uTime * ${LFO_HZ.toFixed(4)} * ${TAU.toFixed(8)};
    vec3 seedOffset = vec3(sin(lfoPhase), cos(lfoPhase * 0.7), sin(lfoPhase * 1.3)) * 0.6;

    float scale = 1.0 + uLow * 0.5;

    // Four base forms, one per Circumplex mood corner, bilinear-blended by
    // (valence, arousal) so the SILHOUETTE itself changes with the music's
    // mood, not just a size pulse: calm(+V-A)=organic blob, excited(+V+A)
    // =torus, tense(-V+A)=spiky octahedron, sad(-V-A)=heavy rounded box.
    // A weighted sum of SDFs isn't a mathematically exact distance field,
    // but at each pure corner it reduces to the exact primitive, and the
    // blend zones in between are smooth enough for raymarching -- a common
    // trade-off for stylized "field morphing" over correctness.
    float wArousal = clamp(uArousal * 0.5 + 0.5, 0.0, 1.0);
    float wValence = clamp(uValence * 0.5 + 0.5, 0.0, 1.0);
    float wExcited = wValence * wArousal;
    float wTense = (1.0 - wValence) * wArousal;
    float wCalm = wValence * (1.0 - wArousal);
    float wSad = (1.0 - wValence) * (1.0 - wArousal);

    // Mid drives both how deep the "organic" pair (blob/torus) warps AND how
    // busy the noise texture is (frequency), so louder mid reads as more
    // detail, not just a deeper dent. The geometric pair (octa/box) stays
    // clean by contrast -- gives each mood a distinct character.
    float warpFreq = 1.4 + uMid * 1.4;
    float blobDisp = fbm(p * warpFreq + seedOffset, uFbmOctaves) * (0.15 + uMid * 0.9);

    float blob = sdSphere(p / scale, 1.0) * scale - blobDisp;

    vec3 pt = p;
    pt.xy *= rot2(0.6);
    float torus = sdTorus(pt, vec2(1.15, 0.32)) - blobDisp * 0.6;

    vec3 po = p;
    po.xy *= rot2(uTime * 0.3);
    float octa = sdOctahedron(po / scale, 1.25) * scale;

    vec3 pb = p;
    pb.xz *= rot2(0.5);
    float box = sdRoundBox(pb / scale, vec3(0.8), 0.22) * scale;

    float d = blob * wCalm + torus * wExcited + octa * wTense + box * wSad;

    // High band + flux: visible surface ripple/glitch detail, per PRD §2.2's
    // "edge glow/particle" role for the high band (stand-in until a real
    // particle system exists) -- amplitude was previously far too subtle
    // (0.015) to read at this object scale.
    float rippleAmp = uHigh * 0.06 + uFlux * 0.08;
    d += sin(p.x * 14.0 + p.y * 11.0 + p.z * 9.0 + uTime * 3.0) * rippleAmp;

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

  const int MAX_STEPS_BOUND = 90;
  const float MAX_DIST = 20.0;
  const float SURF_DIST = 0.0015;

  float raymarch(vec3 ro, vec3 rd, out bool hit) {
    float t = 0.0;
    hit = false;
    for (int i = 0; i < MAX_STEPS_BOUND; i++) {
      if (i >= uMaxSteps) break;
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
      float baseHue = atan(uArousal, uValence) / ${TAU.toFixed(8)} + 0.5;
      baseHue += uCentroidNorm * 0.15;
      baseHue = fract(baseHue + uTime * ${LFO_HZ.toFixed(4)} * 0.3);

      // Small position-based hue jitter so the surface reads as organic
      // color variation instead of one flat tint across the whole shape.
      float hueJitter = (fbm(p * 3.0 + vec3(7.3, 1.1, 4.2), 2) - 0.5) * 0.08;
      float hue = fract(baseHue + hueJitter);

      float radius = clamp(length(vec2(uValence, uArousal)), 0.0, 1.0);
      float oChroma = clamp(0.05 + radius * 0.20 + uHarmonicRichness * 0.16, 0.0, 0.32);
      float lightness = clamp(0.35 + uRms * 0.5, 0.0, 0.9);

      vec3 base = oklchToLinearSrgb(lightness, oChroma, hue * ${TAU.toFixed(8)});
      color = base * (0.25 + diffuse * 0.75);

      // Rim/fresnel gets its own hue offset so edges read as a distinct
      // shade from the core -- a "two-tone" look without a literal second
      // color parameter.
      float rimHue = fract(hue + 0.08 + uHigh * 0.1);
      vec3 rim = oklchToLinearSrgb(clamp(lightness + 0.15, 0.0, 0.95), oChroma, rimHue * ${TAU.toFixed(8)});
      color += rim * fresnel * (0.6 + uHigh * 1.5);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const CENTROID_NORM_HZ = 4000;
const FLUX_NORM = 0.05;
// PRD §3.2 vector synthesis: must match the vector analysers' fftSize
// (engine/audio/{input,synth}.ts) since samples map 1:1 to line vertices.
const VECTOR_SAMPLE_COUNT = 512;
const VECTOR_SCALE_MIN = 0.35;
const VECTOR_SCALE_GAIN = 0.9;
// Z uses the left channel again, phase-shifted by this many samples, so the
// trace becomes a genuine 3D curve (not flat) instead of duplicating X or Y.
const VECTOR_Z_SHIFT = VECTOR_SAMPLE_COUNT / 4;
const VECTOR_SPIN_RAD_PER_SEC = 0.25;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// PRD §4.2: resolution drops first (levels 0-3 only touch pixelRatio, down
// to a 0.5 floor); only once that floor is reached do further levels also
// cut raymarch step count / noise octaves.
interface RenderQuality {
  pixelRatio: number | 'device';
  maxSteps: number;
  fbmOctaves: number;
}

const RENDER_QUALITY: RenderQuality[] = [
  { pixelRatio: 'device', maxSteps: 90, fbmOctaves: 4 },
  { pixelRatio: 1, maxSteps: 90, fbmOctaves: 4 },
  { pixelRatio: 0.75, maxSteps: 90, fbmOctaves: 4 },
  { pixelRatio: 0.5, maxSteps: 90, fbmOctaves: 4 },
  { pixelRatio: 0.5, maxSteps: 60, fbmOctaves: 3 },
  { pixelRatio: 0.5, maxSteps: 45, fbmOctaves: 2 },
  { pixelRatio: 0.5, maxSteps: 30, fbmOctaves: 2 },
];

export class UberShader {
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly material: THREE.ShaderMaterial;
  private readonly camera: THREE.OrthographicCamera;
  private readonly vectorGeometry: THREE.BufferGeometry;
  private readonly vectorPositions: Float32Array<ArrayBuffer>;
  private readonly vectorLine: THREE.Line;
  private vectorScale = VECTOR_SCALE_MIN;
  private readonly startTime = performance.now();
  private readonly devicePixelRatioCap = Math.min(window.devicePixelRatio || 1, 2);
  private width = 1;
  private height = 1;

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
        uFlux: { value: 0 },
        uMaxSteps: { value: RENDER_QUALITY[0]!.maxSteps },
        uFbmOctaves: { value: RENDER_QUALITY[0]!.fbmOctaves },
      },
    });

    const scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));

    this.vectorPositions = new Float32Array(VECTOR_SAMPLE_COUNT * 3);
    this.vectorGeometry = new THREE.BufferGeometry();
    this.vectorGeometry.setAttribute('position', new THREE.BufferAttribute(this.vectorPositions, 3));
    const vectorMaterial = new THREE.LineBasicMaterial({
      color: 0x8fffe0,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.vectorLine = new THREE.Line(this.vectorGeometry, vectorMaterial);
    this.vectorLine.frustumCulled = false;
    scene.add(this.vectorLine);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
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
    u.uFlux!.value = clamp01(state.features.flux / FLUX_NORM);
    const time = (performance.now() - this.startTime) / 1000;
    u.uTime!.value = time;

    // Vector scope: size follows overall loudness (was a fixed constant),
    // and the whole trace spins in 3D -- a slow constant-speed spin plus a
    // Circumplex-driven tilt, so its motion isn't just "L/R amplitude" on a
    // flat plane (a second, independent axis of change per user feedback).
    this.vectorScale = VECTOR_SCALE_MIN + clamp01(state.features.rms) * VECTOR_SCALE_GAIN;
    this.vectorLine.rotation.y = time * VECTOR_SPIN_RAD_PER_SEC;
    this.vectorLine.rotation.x = state.circumplex.arousal * 0.6;
    this.vectorLine.rotation.z = state.circumplex.valence * 0.3;
  }

  /** Vector synthesis (PRD §3.2): L/R time-domain samples as a 3D scope trace. */
  setVectorScope(left: Float32Array, right: Float32Array): void {
    const n = Math.min(left.length, right.length, VECTOR_SAMPLE_COUNT);
    for (let i = 0; i < n; i++) {
      // Z reuses the left channel from VECTOR_Z_SHIFT samples away instead
      // of duplicating X or Y -- without a third independent audio channel,
      // this is what turns a flat XY trace into a real 3D curve.
      const zSample = left[(i + VECTOR_Z_SHIFT) % n]!;
      this.vectorPositions[i * 3] = left[i]! * this.vectorScale;
      this.vectorPositions[i * 3 + 1] = right[i]! * this.vectorScale;
      this.vectorPositions[i * 3 + 2] = zSample * this.vectorScale;
    }
    const position = this.vectorGeometry.getAttribute('position') as THREE.BufferAttribute;
    position.needsUpdate = true;
    this.vectorGeometry.setDrawRange(0, n);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.applySize();
  }

  /** Applies a PRD §4.2 auto-scaling level (0 = best quality). */
  setQuality(level: number): { pixelRatio: number } {
    const clamped = Math.min(Math.max(level, 0), RENDER_QUALITY.length - 1);
    const quality = RENDER_QUALITY[clamped]!;
    const pixelRatio = quality.pixelRatio === 'device' ? this.devicePixelRatioCap : quality.pixelRatio;

    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    this.material.uniforms.uMaxSteps!.value = quality.maxSteps;
    this.material.uniforms.uFbmOctaves!.value = quality.fbmOctaves;
    this.applySize();

    return { pixelRatio };
  }

  private applySize(): void {
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.bloomPass.setSize(this.width, this.height);
    this.material.uniforms.uResolution!.value.set(this.width, this.height);

    // The fullscreen quad's vertex shader bypasses the camera entirely (its
    // `gl_Position` is already clip-space), so this only affects the vector
    // scope Line, which uses the normal Three.js transform pipeline.
    const aspect = this.width / this.height;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.composer.render();
  }
}
