// WebGL renderer + post stack: HDR MSAA target -> bloom -> FPV lens pass ->
// tone mapping/output. Quality presets rescale everything live.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FPVShader } from './FPVPass.js';
import { clamp } from '../world/noise.js';

export class Rendering {
  constructor(canvas, scene, cfg) {
    this.cfg = cfg;
    this.scene = scene;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = cfg.graphics.exposure;

    this.camera = null; // set via setCamera

    const preset = cfg.graphics.presets[cfg.graphics.quality];
    this._buildComposer(preset);
    window.addEventListener('resize', () => this._resize());
  }

  _buildComposer(preset) {
    const w = window.innerWidth, h = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, preset.pixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);

    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
    }
    const target = new THREE.WebGLRenderTarget(
      Math.floor(w * this.pixelRatio), Math.floor(h * this.pixelRatio),
      { type: THREE.HalfFloatType, samples: preset.msaa }
    );
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.25, 0.55, 1.0);
    this.bloomPass.enabled = preset.bloom;
    this.composer.addPass(this.bloomPass);

    this.fpvPass = new ShaderPass(FPVShader);
    const fp = this.cfg.graphics.fpvPass;
    this.fpvPass.uniforms.uChromatic.value = fp.chromatic;
    this.fpvPass.uniforms.uVignette.value = fp.vignette;
    this.fpvPass.uniforms.uNoise.value = fp.noise;
    this.composer.addPass(this.fpvPass);

    this.composer.addPass(new OutputPass());
  }

  setCamera(camera) {
    this.camera = camera;
    this.renderPass.camera = camera;
  }

  applyQuality(preset) {
    this._buildComposer(preset);
    this.renderPass.camera = this.camera;
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  update(t, speed, isFpv) {
    const fp = this.cfg.graphics.fpvPass;
    this.fpvPass.uniforms.uTime.value = t;
    if (isFpv) {
      this.fpvPass.uniforms.uDistortion.value =
        fp.distortion + fp.speedDistortion * clamp(speed / 40, 0, 1);
      this.fpvPass.uniforms.uVignette.value = fp.vignette;
      this.fpvPass.uniforms.uChromatic.value = fp.chromatic;
    } else {
      // external cameras: clean lens
      this.fpvPass.uniforms.uDistortion.value = 0.02;
      this.fpvPass.uniforms.uVignette.value = 0.18;
      this.fpvPass.uniforms.uChromatic.value = 0.08;
    }
  }

  render() { this.composer.render(); }
}
