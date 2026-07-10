// Betaflight-OSD-style overlay. Text fields update at ~12 Hz to avoid layout
// thrash; the input bars update every frame (they're transform-only).

export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'),
      arm: $('osd-arm'), mode: $('osd-mode'), warn: $('osd-warn'),
      speed: $('osd-speed'), alt: $('osd-alt'),
      batt: $('osd-batt'), timer: $('osd-timer'), cam: $('osd-cam'),
      device: $('input-device'), raw: $('input-raw'),
      barRoll: $('bar-roll'), barPitch: $('bar-pitch'),
      barYaw: $('bar-yaw'), barThr: $('bar-thr'),
    };
    this._acc = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }

  update(dt, quad, input, camMode) {
    // every-frame: stick bars
    const s = input.sticks;
    this.el.barRoll.style.transform = `scaleX(${s.roll.toFixed(3)})`;
    this.el.barPitch.style.transform = `scaleX(${s.pitch.toFixed(3)})`;
    this.el.barYaw.style.transform = `scaleX(${s.yaw.toFixed(3)})`;
    this.el.barThr.style.transform = `scaleX(${s.throttle.toFixed(3)})`;

    this._acc += dt;
    if (this._acc < 0.083) return;
    this._acc = 0;

    const e = this.el;
    if (quad.crashed) {
      e.arm.textContent = 'CRASHED — R TO RESET';
      e.arm.className = 'crashed';
    } else if (quad.armed) {
      e.arm.textContent = 'ARMED';
      e.arm.className = 'armed';
    } else {
      e.arm.textContent = 'DISARMED';
      e.arm.className = '';
    }
    e.mode.textContent = quad.mode.toUpperCase();
    e.warn.textContent = input.warn;

    e.speed.textContent = Math.round(quad.speed * 3.6);
    e.alt.textContent = Math.max(0, quad.altitude).toFixed(1);

    // cosmetic 4S battery: droop over flight time + sag with throttle
    const v = Math.max(13.6, 16.8 - (quad.flightTime / 240) * 2.2 - quad.motor * 0.9);
    e.batt.textContent = v.toFixed(1) + 'V';

    const t = Math.floor(quad.flightTime);
    e.timer.textContent =
      String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    e.cam.textContent = camMode.toUpperCase();

    e.device.textContent = input.activeDevice;
    const gp = input.gamepad;
    e.raw.textContent = gp.connected
      ? 'raw: ' + gp.rawAxes.map((a) => a.toFixed(2)).join(' ')
      : 'raw: — (W/S thr · A/D yaw · arrows)';
  }
}
