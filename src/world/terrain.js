// Heightfield terrain: one CPU Float32Array drives both the mesh and physics
// collision, so what you see is exactly what you hit.

import * as THREE from 'three';
import { Simplex2D, smoothstep, lerp, clamp } from './noise.js';

export class Terrain {
  constructor(cfg, textures) {
    const w = cfg.world;
    this.size = w.size;
    this.res = w.gridRes;
    this.step = this.size / (this.res - 1);
    this.half = this.size / 2;
    this.heights = new Float32Array(this.res * this.res);

    const nz = new Simplex2D(w.seed);
    const nz2 = new Simplex2D(w.seed + 100);

    const heightAt = (x, z) => {
      // rolling base + ridged hills
      let h = 12
        + nz.fbm(x / 640, z / 640, 5) * 20
        + nz.ridged(x / 420, z / 420, 4) * 26;
      // ring of mountains toward the map edge hides the horizon
      const r = Math.max(Math.abs(x), Math.abs(z));
      const mf = smoothstep(620, 960, r);
      h += mf * (nz2.ridged(x / 290, z / 290, 5) * 110 + 20);
      // lake basin
      const dl = Math.hypot(x - w.lakeCenter.x, z - w.lakeCenter.z);
      const lakeMask = smoothstep(w.lakeRadius, w.lakeRadius * 0.3, dl);
      h = lerp(h, w.waterLevel - 9, lakeMask * 0.99);
      // flattened plateau for the bando compound
      const db = Math.hypot(x - w.bandoCenter.x, z - w.bandoCenter.z);
      const plateauMask = smoothstep(w.bandoRadius, w.bandoRadius * 0.6, db);
      h = lerp(h, w.plateauHeight, plateauMask);
      return h;
    };

    for (let iz = 0; iz < this.res; iz++) {
      for (let ix = 0; ix < this.res; ix++) {
        const x = -this.half + ix * this.step;
        const z = -this.half + iz * this.step;
        this.heights[iz * this.res + ix] = heightAt(x, z);
      }
    }

    // geometry — PlaneGeometry rotated to XZ keeps vertex order row-major in z
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.res - 1, this.res - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, this.heights[i]);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: textures.grass,
      roughness: 1.0,
      metalness: 0.0,
    });
    const uniforms = {
      uRock: { value: textures.rock },
      uDirt: { value: textures.dirt },
      uMacro: { value: textures.macro },
      uUvScale: { value: this.size / 9 },
      uWaterLevel: { value: w.waterLevel },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vTWorldPos;
          varying vec3 vTWorldNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vTWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          vTWorldNormal = normalize(mat3(modelMatrix) * normal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vTWorldPos;
          varying vec3 vTWorldNormal;
          uniform sampler2D uRock;
          uniform sampler2D uDirt;
          uniform sampler2D uMacro;
          uniform float uUvScale;
          uniform float uWaterLevel;`)
        .replace('#include <map_fragment>', `
          vec2 tuv = vMapUv * uUvScale;
          vec3 gcol = texture2D(map, tuv).rgb;
          vec3 rcol = texture2D(uRock, tuv * 0.61).rgb;
          vec3 dcol = texture2D(uDirt, tuv * 1.27).rgb;
          float macro = texture2D(uMacro, vMapUv * 7.0).r;
          float slope = clamp(1.0 - vTWorldNormal.y, 0.0, 1.0);
          float rockW = smoothstep(0.16, 0.34, slope + (macro - 0.5) * 0.14);
          float beach = smoothstep(uWaterLevel + 3.5, uWaterLevel + 0.6, vTWorldPos.y);
          float dirtW = max(beach, smoothstep(0.62, 0.85, macro) * 0.65) * (1.0 - rockW);
          vec3 splat = mix(mix(gcol, dcol, dirtW), rcol, rockW);
          // hide tiling with a large-scale brightness ripple + fine detail
          splat *= 0.82 + 0.36 * texture2D(uMacro, vMapUv * 3.1).r;
          splat *= 0.88 + 0.24 * texture2D(uMacro, tuv * 0.35).g;
          diffuseColor.rgb *= splat;
        `);
    };
    mat.customProgramCacheKey = () => 'terrain-splat';

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
  }

  // bilinear height lookup in world space
  getHeight(x, z) {
    const fx = clamp((x + this.half) / this.step, 0, this.res - 1.001);
    const fz = clamp((z + this.half) / this.step, 0, this.res - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const H = this.heights, R = this.res;
    const h00 = H[iz * R + ix], h10 = H[iz * R + ix + 1];
    const h01 = H[(iz + 1) * R + ix], h11 = H[(iz + 1) * R + ix + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  getNormal(x, z, out = new THREE.Vector3()) {
    const e = this.step;
    const hx = this.getHeight(x + e, z) - this.getHeight(x - e, z);
    const hz = this.getHeight(x, z + e) - this.getHeight(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
}
