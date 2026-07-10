import * as THREE from 'three';
import './style.css';
import { config } from './config.js';
import { World } from './world/World.js';
import { Quad } from './physics/Quad.js';
import { InputManager } from './input/InputManager.js';
import { DroneModel } from './drone/DroneModel.js';
import { CameraRig } from './cameras/CameraRig.js';
import { Rendering } from './render/Renderer.js';
import { HUD } from './ui/HUD.js';
import { Menu, loadSettings } from './ui/Menu.js';
import { AudioEngine } from './audio/AudioEngine.js';

loadSettings(config);

const canvas = document.getElementById('view');
const scene = new THREE.Scene();
const rendering = new Rendering(canvas, scene, config);
const world = new World(scene, rendering.renderer, config);
const quad = new Quad(config, world.terrain, world.colliders);
quad.mode = config.defaultMode || 'angle';
const input = new InputManager(config, quad);
const model = new DroneModel(world.textures);
scene.add(model.group);
const rig = new CameraRig(config, model.group, world.terrain);
rendering.setCamera(rig.active);
const hud = new HUD();
const audio = new AudioEngine(config);

const spawnGroundY = config.world.plateauHeight + 0.12; // launch pad top
function resetDrone() {
  quad.reset(config.spawn.x, config.spawn.z, spawnGroundY, config.spawn.yaw);
  rig.setLosPosition(config.spawn.x + 5, spawnGroundY + 1.75, config.spawn.z + 6);
}
resetDrone();

const menu = new Menu(config, {
  quad, input, rig, audio,
  onQuality: (preset) => {
    world.applyQuality(preset);
    rendering.applyQuality(preset);
  },
  onReset: resetDrone,
});

document.getElementById('btn-start').addEventListener('click', () => {
  document.getElementById('start-overlay').classList.add('hidden');
  audio.start();
  hud.show();
});

function onResize() { rig.resize(window.innerWidth / window.innerHeight); }
window.addEventListener('resize', onResize);
onResize();

let prevArmed = false;
const PDT = config.physics.dt;
let acc = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  input.update(dt);
  if (input.takeReset()) resetDrone();
  if (input.takeCameraCycle()) {
    rig.cycle();
    rendering.setCamera(rig.active);
  }

  if (!menu.open) {
    acc += dt;
    let steps = 0;
    while (acc >= PDT && steps < config.physics.maxSubsteps) {
      quad.step(PDT, input.sticks);
      acc -= PDT;
      steps++;
    }
    if (steps === config.physics.maxSubsteps) acc = 0; // don't spiral after tab-switch
  }

  if (quad.armed !== prevArmed) {
    audio.armBeep(quad.armed);
    prevArmed = quad.armed;
  }
  if (quad.justCrashed) {
    audio.crash();
    quad.justCrashed = false;
  }

  model.update(quad, dt);
  model.group.visible = rig.mode !== 'fpv' || quad.crashed;
  world.update(now / 1000, quad.pos);
  rig.update(dt, quad);
  rendering.update(now / 1000, quad.speed, rig.mode === 'fpv');
  hud.update(dt, quad, input, rig.mode);
  audio.update(dt, quad, menu.open);

  rendering.render();
}
requestAnimationFrame(frame);

// dev/debug hook (used by automated tests too)
window.__sim = { quad, input, config, world, rig, rendering, resetDrone };
