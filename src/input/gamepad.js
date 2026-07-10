// Gamepad API input. Two presets, auto-selected per device:
// - `mapping: "standard"` (Xbox-style pads) -> gamepadStandard: springy sticks,
//   center = 50% throttle, pull fully down to arm; buttons are edge-triggered.
// - anything else (USB RC transmitters in joystick mode, EdgeTX/OpenTX)
//   -> gamepadRC: AETR axes; EdgeTX maps channels 9-16 to buttons 0-7, so the
//   arm/mode switches are level-triggered.

import { clamp } from '../world/noise.js';

function deadband(v, db) {
  if (Math.abs(v) < db) return 0;
  return (v - Math.sign(v) * db) / (1 - db);
}

export class GamepadInput {
  constructor(cfg) {
    this.cfg = cfg.input;
    this.connected = false;
    this.name = '';
    this.presetName = null;   // 'gamepadStandard' | 'gamepadRC'
    this.rawAxes = [];
    this.roll = 0; this.pitch = 0; this.yaw = 0; this.throttle = 0;
    this.armLevel = null;     // RC switch state (null = not RC)
    this.modeLevel = null;
    this.edges = { arm: false, mode: false, reset: false, camera: false };
    this._prevButtons = [];
  }

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) {
      if (p && p.connected && p.axes.length >= 4) { gp = p; break; }
    }
    if (!gp) {
      this.connected = false;
      this.armLevel = this.modeLevel = null;
      return;
    }
    this.connected = true;
    this.name = gp.id;
    const isStandard = gp.mapping === 'standard';
    this.presetName = isStandard ? 'gamepadStandard' : 'gamepadRC';
    const P = this.cfg[this.presetName];
    this.rawAxes = Array.from(gp.axes);

    const ax = (i, invert) => {
      let v = gp.axes[i] ?? 0;
      if (invert) v = -v;
      return clamp(deadband(v, P.deadband), -1, 1);
    };
    this.roll = ax(P.rollAxis, P.rollInvert);
    this.pitch = ax(P.pitchAxis, P.pitchInvert);
    this.yaw = ax(P.yawAxis, P.yawInvert);
    // throttle: raw [-1,1] -> [0,1] (springy sticks land at 0.5 = neutral)
    let t = gp.axes[P.throttleAxis] ?? 0;
    if (P.throttleInvert) t = -t;
    this.throttle = clamp((t + 1) / 2, 0, 1);

    // buttons
    const pressed = gp.buttons.map((b) => b.pressed);
    const edge = (i) => i !== undefined && pressed[i] && !this._prevButtons[i];
    if (isStandard) {
      this.armLevel = this.modeLevel = null;
      if (edge(P.armButton)) this.edges.arm = true;
      if (edge(P.modeButton)) this.edges.mode = true;
      if (edge(P.resetButton)) this.edges.reset = true;
      if (edge(P.cameraButton)) this.edges.camera = true;
    } else {
      // RC switches are level-triggered; arm/mode can live on a channel axis
      // (EdgeTX ch1-8 -> axes 0-7) or on a ch9+ button
      this.armLevel = P.armAxis !== undefined
        ? (gp.axes[P.armAxis] ?? -1) > (P.armThreshold ?? 0.5)
        : !!pressed[P.armButton];
      this.modeLevel = P.modeAxis !== undefined
        ? (gp.axes[P.modeAxis] ?? -1) > (P.modeThreshold ?? 0.5)
        : !!pressed[P.modeButton];
    }
    this._prevButtons = pressed;
  }

  takeEdges() {
    const e = { ...this.edges };
    this.edges.arm = this.edges.mode = this.edges.reset = this.edges.camera = false;
    return e;
  }
}
