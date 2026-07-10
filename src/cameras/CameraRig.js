// FPV (rigid-mounted, uptilted), chase (smoothed follow) and LOS (fixed
// pilot position) cameras. C cycles through them.

import * as THREE from 'three';
import { clamp, lerp } from '../world/noise.js';

export class CameraRig {
  constructor(cfg, droneGroup, terrain) {
    this.cfg = cfg;
    this.terrain = terrain;
    this.modes = ['fpv', 'chase', 'los'];
    this.mode = 'fpv';

    this.fpv = new THREE.PerspectiveCamera(cfg.camera.fpvFov, 1, 0.05, 6000);
    this.fpv.rotation.x = THREE.MathUtils.degToRad(cfg.camera.fpvTilt);
    droneGroup.add(this.fpv);

    this.ext = new THREE.PerspectiveCamera(70, 1, 0.05, 6000);
    this.losPos = new THREE.Vector3();
    this._chasePos = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._chaseInit = false;
  }

  get active() { return this.mode === 'fpv' ? this.fpv : this.ext; }

  setLosPosition(x, y, z) { this.losPos.set(x, y, z); }

  applySettings() {
    this.fpv.rotation.x = THREE.MathUtils.degToRad(this.cfg.camera.fpvTilt);
  }

  cycle() {
    this.mode = this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length];
    this._chaseInit = false;
  }

  resize(aspect) {
    this.fpv.aspect = aspect; this.fpv.updateProjectionMatrix();
    this.ext.aspect = aspect; this.ext.updateProjectionMatrix();
  }

  update(dt, quad) {
    const C = this.cfg.camera;
    if (this.mode === 'fpv') {
      const targetFov = C.fpvFov + C.speedFov * clamp(quad.speed / 38, 0, 1);
      this.fpv.fov = lerp(this.fpv.fov, targetFov, 1 - Math.exp(-6 * dt));
      this.fpv.updateProjectionMatrix();
      return;
    }
    if (this.mode === 'chase') {
      // follow behind the drone's horizontal velocity (or heading when slow)
      const v = quad.vel;
      const hSpeed = Math.hypot(v.x, v.z);
      let bx, bz;
      if (hSpeed > 2) { bx = -v.x / hSpeed; bz = -v.z / hSpeed; }
      else {
        const f = this._target.set(0, 0, -1).applyQuaternion(quad.quat);
        const fl = Math.hypot(f.x, f.z) || 1;
        bx = -f.x / fl; bz = -f.z / fl;
      }
      const want = this._target.set(
        quad.pos.x + bx * C.chaseDistance,
        quad.pos.y + C.chaseHeight,
        quad.pos.z + bz * C.chaseDistance
      );
      if (!this._chaseInit) { this._chasePos.copy(want); this._chaseInit = true; }
      this._chasePos.lerp(want, 1 - Math.exp(-5 * dt));
      const minY = this.terrain.getHeight(this._chasePos.x, this._chasePos.z) + 0.35;
      if (this._chasePos.y < minY) this._chasePos.y = minY;
      this.ext.position.copy(this._chasePos);
      this.ext.lookAt(quad.pos);
      return;
    }
    // LOS: stand at the pad and watch it fly
    this.ext.position.copy(this.losPos);
    this.ext.lookAt(quad.pos);
  }
}
