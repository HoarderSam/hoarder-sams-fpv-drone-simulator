// Assembles terrain, sky, water, vegetation and the bando; owns the collider
// list the physics reads.

import { makeTextures } from './textures.js';
import { Terrain } from './terrain.js';
import { SkyLighting } from './sky.js';
import { Lake } from './water.js';
import { Vegetation } from './vegetation.js';
import { Bando } from './bando.js';

export class World {
  constructor(scene, renderer, cfg) {
    this.cfg = cfg;
    this.colliders = [];

    this.textures = makeTextures(cfg.world.seed);
    this.terrain = new Terrain(cfg, this.textures);
    scene.add(this.terrain.mesh);

    this.sky = new SkyLighting(scene, renderer, cfg);
    this.lake = new Lake(scene, cfg, this.textures, this.sky.sunDir);
    this.bando = new Bando(scene, cfg, this.textures, this.colliders);
    this.vegetation = new Vegetation(scene, cfg, this.textures, this.terrain);

    this.applyQuality(cfg.graphics.presets[cfg.graphics.quality]);
  }

  applyQuality(preset) {
    this.vegetation.applyQuality(preset);
    this.sky.setShadowMapSize(preset.shadowSize, preset.shadows);
    this.lake.build(preset.waterRes);
  }

  update(t, dronePos) {
    this.sky.update(dronePos);
    this.lake.update(t);
    this.vegetation.update(t);
    this.bando.update(t);
  }
}
