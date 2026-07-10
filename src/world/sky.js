// Physically-based sky + sun light with a shadow frustum that follows the
// drone (texel-snapped to avoid shimmer) + PMREM environment for PBR.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class SkyLighting {
  constructor(scene, renderer, cfg) {
    const w = cfg.world;

    this.sunDir = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - w.sunElevation),
      THREE.MathUtils.degToRad(w.sunAzimuth)
    );

    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.5;
    u.rayleigh.value = 1.8;
    u.mieCoefficient.value = 0.0028;
    u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(this.sunDir);

    // environment map from the sky (before adding it to the main scene)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(this.sky);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 0.35;
    envScene.remove(this.sky);
    pmrem.dispose();
    scene.add(this.sky);

    // sun
    this.sun = new THREE.DirectionalLight(0xffe0b8, 3.4);
    this.sun.castShadow = true;
    this.shadowRadius = w.shadowRadius;
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowRadius; cam.right = this.shadowRadius;
    cam.top = this.shadowRadius; cam.bottom = -this.shadowRadius;
    cam.near = 1; cam.far = 900;
    cam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0001;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xa8c4e0, 0x4a4432, 0.5);
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xcfb89a, w.fogDensity);

    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    // light-space basis for texel snapping
    this._right.crossVectors(new THREE.Vector3(0, 1, 0), this.sunDir).normalize();
    this._up.crossVectors(this.sunDir, this._right).normalize();
  }

  setShadowMapSize(size, enabled) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.mapSize.set(size, size);
  }

  // keep the shadow frustum centered on the drone, snapped to shadow texels
  update(focus) {
    const texel = (this.shadowRadius * 2) / this.sun.shadow.mapSize.x;
    const a = this._right.dot(focus);
    const b = this._up.dot(focus);
    const sa = Math.round(a / texel) * texel;
    const sb = Math.round(b / texel) * texel;
    this._tmp.copy(focus)
      .addScaledVector(this._right, sa - a)
      .addScaledVector(this._up, sb - b);
    this.sun.target.position.copy(this._tmp);
    this.sun.position.copy(this._tmp).addScaledVector(this.sunDir, 400);
  }
}
