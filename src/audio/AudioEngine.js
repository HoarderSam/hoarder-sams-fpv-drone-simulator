// All sound is synthesized with WebAudio — no audio files. Motor whine
// (detuned saws + filtered noise) tracks throttle; wind tracks airspeed.

export class AudioEngine {
  constructor(cfg) {
    this.cfg = cfg.audio;
    this.ctx = null;
    this.started = false;
    this.enabled = cfg.audio.enabled;
  }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.cfg.masterGain : 0;
    this.master.connect(ctx.destination);

    // shared looping noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;

    // ---- motor: two detuned saws + bandpassed noise ----
    this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0;
    this.motorGain.connect(this.master);

    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'sawtooth';
    this.osc2.detune.value = 24;
    const oscGain = ctx.createGain(); oscGain.gain.value = 0.32;
    this.motorLP = ctx.createBiquadFilter();
    this.motorLP.type = 'lowpass'; this.motorLP.frequency.value = 800; this.motorLP.Q.value = 2;
    this.osc1.connect(oscGain); this.osc2.connect(oscGain);
    oscGain.connect(this.motorLP); this.motorLP.connect(this.motorGain);
    this.osc1.start(); this.osc2.start();

    const mNoise = ctx.createBufferSource();
    mNoise.buffer = buf; mNoise.loop = true;
    this.motorBP = ctx.createBiquadFilter();
    this.motorBP.type = 'bandpass'; this.motorBP.frequency.value = 1400; this.motorBP.Q.value = 1.4;
    const mnGain = ctx.createGain(); mnGain.gain.value = 0.5;
    mNoise.connect(this.motorBP); this.motorBP.connect(mnGain); mnGain.connect(this.motorGain);
    mNoise.start();

    // ---- wind ----
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windLP = ctx.createBiquadFilter();
    this.windLP.type = 'lowpass'; this.windLP.frequency.value = 300; this.windLP.Q.value = 0.4;
    const wNoise = ctx.createBufferSource();
    wNoise.buffer = buf; wNoise.loop = true;
    wNoise.connect(this.windLP); this.windLP.connect(this.windGain);
    this.windGain.connect(this.master);
    wNoise.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? this.cfg.masterGain : 0, this.ctx.currentTime, 0.05);
    }
  }

  beep(freq = 880, dur = 0.09, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  armBeep(on) { on ? (this.beep(740), this.beep(1180, 0.1, 0.1)) : this.beep(520, 0.12); }

  crash() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.4);
  }

  update(dt, quad, paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = paused ? 0 : quad.motor * (quad.armed ? 1 : 0);
    const wob = 1 + Math.min(0.06, quad.omega.length() * 0.006);
    const f = (120 + m * 680) * wob;
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * 1.008, t, 0.03);
    this.motorLP.frequency.setTargetAtTime(500 + m * 3400, t, 0.05);
    this.motorBP.frequency.setTargetAtTime(900 + m * 3200, t, 0.05);
    this.motorGain.gain.setTargetAtTime(Math.pow(m, 0.85) * 0.5, t, 0.04);

    const sp = paused ? 0 : Math.min(1, quad.speed / 42);
    this.windGain.gain.setTargetAtTime(sp * sp * 0.85, t, 0.15);
    this.windLP.frequency.setTargetAtTime(250 + sp * 1500, t, 0.15);
  }
}
