// Merges keyboard + gamepad into one stick state and owns the arm/mode
// logic (throttle-low arming safety, RC level-triggered switches, warnings).

import { KeyboardInput } from './keyboard.js';
import { GamepadInput } from './gamepad.js';

export class InputManager {
  constructor(cfg, quad) {
    this.cfg = cfg;
    this.quad = quad;
    this.keyboard = new KeyboardInput(cfg);
    this.gamepad = new GamepadInput(cfg);
    this.sticks = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    this.warn = '';
    this.resetRequested = false;
    this.cameraCycle = false;
    this._rcArmPending = false;
    this._prevArmLevel = false;
    this._prevModeLevel = null;
  }

  get activeDevice() {
    return this.gamepad.connected ? this.gamepad.name : 'no gamepad — keyboard';
  }
  get activePresetName() {
    return this.gamepad.connected ? this.gamepad.presetName : 'keyboard';
  }

  _tryArm() {
    if (this.quad.crashed) { this.warn = 'RESET FIRST (R)'; return false; }
    if (this.sticks.throttle > this.cfg.input.armThrottleMax) {
      this.warn = 'THROTTLE HIGH';
      return false;
    }
    this.warn = '';
    return this.quad.arm();
  }

  _cycleMode() {
    const order = ['acro', 'angle', 'hover'];
    this.quad.mode = order[(order.indexOf(this.quad.mode) + 1) % order.length];
  }

  update(dt) {
    this.keyboard.update(dt);
    this.gamepad.poll();

    const gp = this.gamepad;
    if (gp.connected) {
      this.sticks.roll = gp.roll;
      this.sticks.pitch = gp.pitch;
      this.sticks.yaw = gp.yaw;
      this.sticks.throttle = gp.throttle;
    } else {
      this.sticks.roll = this.keyboard.roll;
      this.sticks.pitch = this.keyboard.pitch;
      this.sticks.yaw = this.keyboard.yaw;
      this.sticks.throttle = this.keyboard.throttle;
    }

    // ---- edge-triggered actions (keyboard + standard pads) ----
    const ke = this.keyboard.takeEdges();
    const ge = gp.takeEdges();
    if (ke.arm || ge.arm) {
      if (this.quad.armed) this.quad.disarm();
      else this._tryArm();
    }
    if (ke.mode || ge.mode) this._cycleMode();
    if (ke.reset || ge.reset) this.resetRequested = true;
    if (ke.camera || ge.camera) this.cameraCycle = true;

    // ---- RC transmitter switches (level-triggered) ----
    if (gp.connected && gp.armLevel !== null) {
      if (gp.armLevel && !this._prevArmLevel) {
        // switch flipped on: arm if safe, else latch until throttle drops
        if (!this._tryArm()) this._rcArmPending = true;
      }
      if (!gp.armLevel) {
        if (this.quad.armed) this.quad.disarm();
        this._rcArmPending = false;
        if (this.warn === 'THROTTLE HIGH') this.warn = '';
      }
      if (this._rcArmPending && gp.armLevel && !this.quad.armed) {
        if (this._tryArm()) this._rcArmPending = false;
      }
      this._prevArmLevel = gp.armLevel;

      // mode follows the switch on every flip; a menu-selected mode (e.g.
      // hover) sticks around only until the next flip
      if (gp.modeLevel !== this._prevModeLevel) {
        this.quad.mode = gp.modeLevel ? 'angle' : 'acro';
        this._prevModeLevel = gp.modeLevel;
      }
    }

    if (this.quad.armed && this.warn === 'THROTTLE HIGH') this.warn = '';
  }

  takeReset() { const r = this.resetRequested; this.resetRequested = false; return r; }
  takeCameraCycle() { const c = this.cameraCycle; this.cameraCycle = false; return c; }
}
