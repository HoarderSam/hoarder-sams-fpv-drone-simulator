// Keyboard as virtual sticks: held keys ramp deflection, releasing re-centers
// (throttle latches like a real throttle stick). Mode-2 layout:
// W/S throttle, A/D yaw, arrow keys pitch/roll.

import { clamp } from '../world/noise.js';

export class KeyboardInput {
  constructor(cfg) {
    this.cfg = cfg.input.keyboard;
    this.keys = new Set();
    this.roll = 0; this.pitch = 0; this.yaw = 0; this.throttle = 0;
    this.edges = { arm: false, mode: false, reset: false, camera: false };

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyF': this.edges.arm = true; break;
        case 'KeyM': this.edges.mode = true; break;
        case 'KeyR': this.edges.reset = true; break;
        case 'KeyC': this.edges.camera = true; break;
      }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _ramp(value, dir, dt, attack, release) {
    if (dir !== 0) return clamp(value + dir * attack * dt, -1, 1);
    const d = release * dt;
    if (Math.abs(value) <= d) return 0;
    return value - Math.sign(value) * d;
  }

  update(dt) {
    const k = this.keys, c = this.cfg;
    const rollDir = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
    const pitchDir = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0);
    const yawDir = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const thrDir = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);

    this.roll = this._ramp(this.roll, rollDir, dt, c.attackRate, c.releaseRate);
    this.pitch = this._ramp(this.pitch, pitchDir, dt, c.attackRate, c.releaseRate);
    this.yaw = this._ramp(this.yaw, yawDir, dt, c.yawRate, c.releaseRate);
    this.throttle = clamp(this.throttle + thrDir * c.throttleRate * dt, 0, 1);
  }

  takeEdges() {
    const e = { ...this.edges };
    this.edges.arm = this.edges.mode = this.edges.reset = this.edges.camera = false;
    return e;
  }
}
