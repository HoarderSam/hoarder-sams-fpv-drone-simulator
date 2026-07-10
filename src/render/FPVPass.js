// The "FPV camera" look in one pass: barrel/fisheye distortion, edge
// chromatic aberration, vignette and faint sensor noise. Distortion scales
// slightly with speed for a sense of acceleration.

export const FPVShader = {
  name: 'FPVShader',
  uniforms: {
    tDiffuse: { value: null },
    uDistortion: { value: 0.14 },
    uChromatic: { value: 0.35 },
    uVignette: { value: 0.42 },
    uNoise: { value: 0.025 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uDistortion;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uNoise;
    uniform float uTime;
    varying vec2 vUv;

    vec2 barrel(vec2 uv, float k) {
      vec2 d = uv - 0.5;
      // pre-shrink so the distorted corners still land inside the frame
      d /= (1.0 + k * 0.5);
      float r2 = dot(d, d);
      return 0.5 + d * (1.0 + k * r2);
    }

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 61.7) * 43758.5453);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      float ca = uChromatic * r2;
      vec3 col;
      col.r = texture2D(tDiffuse, barrel(vUv, uDistortion * (1.0 + ca))).r;
      col.g = texture2D(tDiffuse, barrel(vUv, uDistortion)).g;
      col.b = texture2D(tDiffuse, barrel(vUv, uDistortion * (1.0 - ca))).b;
      col *= 1.0 - uVignette * smoothstep(0.12, 0.62, r2);
      col += (hash(vUv) - 0.5) * uNoise;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
