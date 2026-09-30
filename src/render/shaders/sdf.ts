/** GLSL building blocks for the raymarched Uber Shader (PRD §3.2). */

export const SDF_PRIMITIVES = /* glsl */ `
  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  // Polynomial smooth min (iq): blends two SDFs by k instead of a hard min().
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  mat2 rot2(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }
`;

export const NOISE_UTILS = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * valueNoise3(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return sum;
  }
`;

// Oklch -> linear sRGB (Björn Ottosson's published matrices). Chosen over HSL
// per PRD §3.3 ("音色を濁りのない色に変換するため...HSL/Oklch色空間で計算") since
// Oklch stays visually clean/non-muddy across hue at constant lightness,
// unlike HSL. Output is linear; the composer's OutputPass does the final
// sRGB display encoding, so this shader must NOT gamma-correct itself.
export const OKLCH_UTILS = /* glsl */ `
  vec3 oklchToLinearSrgb(float L, float C, float hueRad) {
    float a = C * cos(hueRad);
    float b = C * sin(hueRad);

    float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    float s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;

    vec3 rgb;
    rgb.r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    rgb.g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    rgb.b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
    return max(rgb, vec3(0.0));
  }
`;
