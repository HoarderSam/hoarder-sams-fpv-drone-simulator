// Pause menu: rates, camera, input inversion, graphics quality. Settings are
// deep-merged over config defaults from localStorage at boot and saved on
// every change.

const STORE_KEY = 'fpvsim.settings.v1';

export function loadSettings(cfg) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.rates) {
      for (const ax of ['roll', 'pitch', 'yaw']) Object.assign(cfg.rates[ax], s.rates[ax] || {});
    }
    if (s.camera) Object.assign(cfg.camera, s.camera);
    if (s.quality) cfg.graphics.quality = s.quality;
    if (s.audio !== undefined) cfg.audio.enabled = s.audio;
    if (s.mode) cfg.defaultMode = s.mode;
    if (s.gamepadRC) Object.assign(cfg.input.gamepadRC, s.gamepadRC);
    if (s.gamepadStandard) Object.assign(cfg.input.gamepadStandard, s.gamepadStandard);
  } catch (e) {
    console.warn('settings load failed', e);
  }
}

export class Menu {
  constructor(cfg, { quad, input, rig, onQuality, onReset, audio }) {
    this.cfg = cfg;
    this.quad = quad;
    this.input = input;
    this.open = false;
    const $ = (id) => document.getElementById(id);
    this.root = $('menu');

    const save = () => {
      const invFlags = (p) => ({
        rollInvert: p.rollInvert, pitchInvert: p.pitchInvert,
        yawInvert: p.yawInvert, throttleInvert: p.throttleInvert,
      });
      localStorage.setItem(STORE_KEY, JSON.stringify({
        rates: cfg.rates,
        camera: { fpvTilt: cfg.camera.fpvTilt, fpvFov: cfg.camera.fpvFov },
        quality: cfg.graphics.quality,
        audio: cfg.audio.enabled,
        mode: quad.mode,
        gamepadRC: invFlags(cfg.input.gamepadRC),
        gamepadStandard: invFlags(cfg.input.gamepadStandard),
      }));
    };

    const bindRange = (id, get, set) => {
      const el = $(id), lab = el.nextElementSibling;
      el.value = get();
      if (lab) lab.textContent = get();
      el.addEventListener('input', () => {
        set(parseFloat(el.value));
        if (lab) lab.textContent = el.value;
        save();
      });
      return el;
    };

    this.modeSel = $('set-mode');
    this.modeSel.value = quad.mode;
    this.modeSel.addEventListener('change', () => { quad.mode = this.modeSel.value; save(); });

    bindRange('set-rcrate', () => cfg.rates.roll.rcRate, (v) => {
      cfg.rates.roll.rcRate = cfg.rates.pitch.rcRate = cfg.rates.yaw.rcRate = v;
    });
    bindRange('set-super', () => cfg.rates.roll.superRate, (v) => {
      cfg.rates.roll.superRate = cfg.rates.pitch.superRate = v;
      cfg.rates.yaw.superRate = Math.max(0, v - 0.07);
    });
    bindRange('set-expo', () => cfg.rates.roll.expo, (v) => {
      cfg.rates.roll.expo = cfg.rates.pitch.expo = cfg.rates.yaw.expo = v;
    });
    bindRange('set-tilt', () => cfg.camera.fpvTilt, (v) => { cfg.camera.fpvTilt = v; rig.applySettings(); });
    bindRange('set-fov', () => cfg.camera.fpvFov, (v) => { cfg.camera.fpvFov = v; });

    // invert checkboxes apply to the preset of whatever device is active
    const invIds = { 'inv-roll': 'rollInvert', 'inv-pitch': 'pitchInvert', 'inv-yaw': 'yawInvert', 'inv-thr': 'throttleInvert' };
    this.invEls = {};
    for (const [id, key] of Object.entries(invIds)) {
      const el = $(id);
      this.invEls[key] = el;
      el.addEventListener('change', () => {
        const preset = this._activePreset();
        if (preset) { preset[key] = el.checked; save(); }
      });
    }

    const qSel = $('set-quality');
    qSel.value = cfg.graphics.quality;
    qSel.addEventListener('change', () => {
      cfg.graphics.quality = qSel.value;
      onQuality(cfg.graphics.presets[qSel.value]);
      save();
    });

    const aChk = $('set-audio');
    aChk.checked = cfg.audio.enabled;
    aChk.addEventListener('change', () => {
      cfg.audio.enabled = aChk.checked;
      audio.setEnabled(aChk.checked);
      save();
    });

    $('btn-resume').addEventListener('click', () => this.hide());
    $('btn-reset').addEventListener('click', () => { onReset(); this.hide(); });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.toggle();
    });
  }

  _activePreset() {
    const name = this.input.activePresetName;
    return name === 'keyboard' ? this.cfg.input.gamepadRC : this.cfg.input[name];
  }

  _syncDevice() {
    document.getElementById('set-device').textContent =
      this.input.gamepad.connected
        ? `${this.input.gamepad.name} [${this.input.activePresetName}]`
        : 'no gamepad detected (inverts apply to RC preset)';
    const p = this._activePreset();
    for (const [key, el] of Object.entries(this.invEls)) el.checked = !!p[key];
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() {
    this.open = true;
    this.modeSel.value = this.quad.mode;
    this._syncDevice();
    this.root.classList.remove('hidden');
  }
  hide() {
    this.open = false;
    this.root.classList.add('hidden');
  }
}
