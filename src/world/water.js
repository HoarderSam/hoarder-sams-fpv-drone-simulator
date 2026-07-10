// Lake with planar reflections (three.js Water addon) using a procedurally
// generated tileable normal map.

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export class Lake {
  constructor(scene, cfg, textures, sunDir) {
    this.scene = scene;
    this.cfg = cfg;
    this.textures = textures;
    this.sunDir = sunDir;
    this.water = null;
    this.build(cfg.graphics.presets[cfg.graphics.quality].waterRes);
  }

  build(res) {
    const w = this.cfg.world;
    if (this.water) {
      this.scene.remove(this.water);
      this.water.geometry.dispose();
      this.water.material.dispose();
    }
    const geo = new THREE.PlaneGeometry(w.lakeRadius * 2.6, w.lakeRadius * 2.6);
    this.water = new Water(geo, {
      textureWidth: res,
      textureHeight: res,
      waterNormals: this.textures.waterNormals,
      sunDirection: this.sunDir.clone(),
      sunColor: 0xfff0dd,
      waterColor: 0x0d2f24,
      distortionScale: 3.8,
      fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(w.lakeCenter.x, w.waterLevel, w.lakeCenter.z);
    this.scene.add(this.water);
  }

  update(t) {
    if (this.water) this.water.material.uniforms.time.value = t * 0.55;
  }
}
