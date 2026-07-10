// Instanced vegetation: low-poly pines, billboard bushes, wind-swaying grass.
// Everything is built once at Ultra counts; quality presets just lower the
// InstancedMesh.count, so switching quality is free.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise.js';

function paintVertexColors(geo, color) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function makePineGeometry() {
  const trunkCol = new THREE.Color(0x5a4630);
  const leafCol = new THREE.Color(0x2f4a24);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.14, 0.26, 2.4, 6);
  trunk.translate(0, 1.2, 0);
  parts.push(paintVertexColors(trunk, trunkCol));
  const tiers = [
    [1.85, 2.8, 3.1],
    [1.4, 2.4, 4.6],
    [0.95, 2.0, 6.0],
  ];
  for (const [r, h, y] of tiers) {
    const cone = new THREE.ConeGeometry(r, h, 7);
    cone.translate(0, y, 0);
    parts.push(paintVertexColors(cone, leafCol));
  }
  return mergeGeometries(parts);
}

function makeGrassGeometry() {
  // three narrow crossed blades, dark at base -> lighter at tip
  const quad = () => {
    const g = new THREE.PlaneGeometry(0.3, 0.7, 1, 2);
    g.translate(0, 0.35, 0);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = g.attributes.position.getY(i) / 0.7;
      // taper toward the tip
      g.attributes.position.setX(i, g.attributes.position.getX(i) * (1 - t * 0.7));
      c.setHSL(0.26 - t * 0.03, 0.45, 0.07 + t * 0.17);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const a = quad();
  const b = quad(); b.rotateY(Math.PI / 3);
  const c = quad(); c.rotateY((2 * Math.PI) / 3);
  return mergeGeometries([a, b, c]);
}

function makeBushGeometry() {
  const a = new THREE.PlaneGeometry(2.2, 1.9); a.translate(0, 0.85, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const c = a.clone(); c.rotateY(Math.PI / 4);
  return mergeGeometries([a, b, c]);
}

function windMaterial(base, amp) {
  base.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindAmp = { value: amp };
    base.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uWindAmp;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float swayPh = uTime * 1.6 + mvPosition.x * 0.14 + mvPosition.z * 0.17;
        float sway = uWindAmp * position.y * (sin(swayPh) + 0.6 * sin(swayPh * 2.33 + 1.3));
        mvPosition.x += sway;
        mvPosition.z += sway * 0.62;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  base.customProgramCacheKey = () => 'wind-sway-' + amp;
  return base;
}

export class Vegetation {
  constructor(scene, cfg, textures, terrain) {
    const w = cfg.world;
    const ultra = cfg.graphics.presets.ultra;
    const rand = mulberry32(w.seed + 77);
    this.materials = [];

    const excluded = (x, z, margin) => {
      if (Math.hypot(x - w.bandoCenter.x, z - w.bandoCenter.z) < margin) return true;
      if (Math.hypot(x - w.lakeCenter.x, z - w.lakeCenter.z) < w.lakeRadius * 1.05) return true;
      return false;
    };

    const scatter = (mesh, count, place) => {
      const m = new THREE.Matrix4();
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      const e = new THREE.Euler();
      let placed = 0, guard = 0;
      while (placed < count && guard++ < count * 30) {
        const spec = place();
        if (!spec) continue;
        p.set(spec.x, spec.y, spec.z);
        e.set((rand() - 0.5) * spec.tilt, rand() * Math.PI * 2, (rand() - 0.5) * spec.tilt);
        q.setFromEuler(e);
        s.setScalar(spec.scale);
        m.compose(p, q, s);
        mesh.setMatrixAt(placed, m);
        if (spec.color) mesh.setColorAt(placed, spec.color);
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return placed;
    };

    // ---- pines ----
    const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    this.trees = new THREE.InstancedMesh(makePineGeometry(), pineMat, ultra.trees);
    this.trees.castShadow = true;
    this.trees.receiveShadow = true;
    const tint = new THREE.Color();
    scatter(this.trees, ultra.trees, () => {
      const x = (rand() - 0.5) * w.size * 0.92;
      const z = (rand() - 0.5) * w.size * 0.92;
      if (excluded(x, z, w.bandoRadius * 1.15)) return null;
      const h = terrain.getHeight(x, z);
      if (h < w.waterLevel + 1.5) return null;
      if (terrain.getNormal(x, z).y < 0.72) return null;
      tint.setHSL(0.28 + rand() * 0.06, 0.4, 0.5 + rand() * 0.3);
      return { x, y: h - 0.15, z, scale: 0.75 + rand() * 0.85, tilt: 0.07, color: tint.clone() };
    });
    scene.add(this.trees);

    // ---- bushes ----
    const bushMat = windMaterial(new THREE.MeshStandardMaterial({
      map: textures.bush, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1,
    }), 0.035);
    this.materials.push(bushMat);
    this.bushes = new THREE.InstancedMesh(makeBushGeometry(), bushMat, ultra.bushes);
    this.bushes.receiveShadow = true;
    scatter(this.bushes, ultra.bushes, () => {
      const x = (rand() - 0.5) * w.size * 0.85;
      const z = (rand() - 0.5) * w.size * 0.85;
      if (excluded(x, z, w.bandoRadius * 0.75)) return null;
      const h = terrain.getHeight(x, z);
      if (h < w.waterLevel + 0.8) return null;
      if (terrain.getNormal(x, z).y < 0.6) return null;
      return { x, y: h - 0.05, z, scale: 0.6 + rand() * 1.0, tilt: 0.12 };
    });
    scene.add(this.bushes);

    // ---- grass (dense ring around the flight area) ----
    const grassMat = windMaterial(new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 1,
    }), 0.11);
    this.materials.push(grassMat);
    this.grass = new THREE.InstancedMesh(makeGrassGeometry(), grassMat, Math.max(ultra.grass, 1));
    this.grass.receiveShadow = true;
    scatter(this.grass, ultra.grass, () => {
      const ang = rand() * Math.PI * 2;
      const rr = 40 + Math.sqrt(rand()) * 320;
      const x = w.bandoCenter.x + Math.cos(ang) * rr;
      const z = w.bandoCenter.z + Math.sin(ang) * rr;
      if (excluded(x, z, 62)) return null;
      const h = terrain.getHeight(x, z);
      if (h < w.waterLevel + 0.6) return null;
      if (terrain.getNormal(x, z).y < 0.62) return null;
      tint.setHSL(0.26 + rand() * 0.05, 0.4, 0.45 + rand() * 0.45);
      return { x, y: h, z, scale: 0.55 + rand() * 0.8, tilt: 0.2, color: tint.clone() };
    });
    scene.add(this.grass);

    this._ultraCounts = { trees: this.trees.count, bushes: this.bushes.count, grass: this.grass.count };
  }

  applyQuality(preset) {
    const u = this._ultraCounts;
    const cfgU = { trees: u.trees, bushes: u.bushes, grass: u.grass };
    this.trees.count = Math.min(preset.trees, cfgU.trees);
    this.bushes.count = Math.min(preset.bushes, cfgU.bushes);
    this.grass.count = Math.min(preset.grass, cfgU.grass);
    this.grass.visible = preset.grass > 0;
  }

  update(t) {
    for (const m of this.materials) {
      if (m.userData.shader) m.userData.shader.uniforms.uTime.value = t;
    }
  }
}
