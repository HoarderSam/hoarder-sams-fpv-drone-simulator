# Hoarder Sam's FPV Drone Simulator

Browser-based FPV drone simulator built with three.js. One integrated world:
an abandoned industrial compound (fly-through warehouses, container stacks,
tanks, a lattice mast) set in procedural hills with a lake. Everything —
terrain, textures, sound — is generated at boot; there are no binary assets.

## Run
Go to https://hoardersam.github.io/hoarder-sams-fpv-drone-simulator/

Run locally:
```
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
```

## Flying

Three flight modes (cycle with `M` or pick in the menu):

- **Acro** — Betaflight-style rates. Stick deflection = angular velocity, no
  self-leveling. The real FPV feel; tune rcRate/superRate/expo in the menu.
- **Angle** — self-leveling, tilt limited (~55°). Yaw is still rate-based.
- **Hover** — angle + altitude assist: throttle stick around center holds
  altitude. Easiest for keyboard.

**Keyboard**: `W/S` throttle (latches like a real throttle stick) · `A/D` yaw
· arrow keys pitch/roll · `F` arm/disarm · `R` reset to pad · `C` cycle
FPV / chase / line-of-sight camera · `Esc` settings menu.

Arming requires throttle near zero — if the OSD says `THROTTLE HIGH`, pull
throttle down first. Hard impacts crash the quad; press `R` to respawn.

**USB RC transmitters** (RadioMaster, Taranis, etc. in joystick mode) work via the
Gamepad API and are by far the best way to fly. The sim auto-selects a mapping
preset per device: known gamepads (`mapping: "standard"`) use the Xbox-style
preset, everything else uses the EdgeTX/OpenTX AETR preset (`input.gamepadRC`
in `src/config.js`). The HUD's bottom-left readout shows raw axes plus the
mapped roll/pitch/yaw/throttle — if your radio has reversed channels, flip the
matching `*Invert` flag (also exposed as checkboxes in the Esc menu).
**Arming is on channel 5, flight mode on channel 6**: channels 1-8 arrive as
axes 0-7, so mix a switch to ch5 to arm (axis 4 above +0.5 = armed) and one
to ch6 for mode (-1 = acro, +1 = angle; flipping it also exits hover). EdgeTX
exposes channels 9-16 as buttons 0-7 — either switch can be moved to a ch9+
button by setting `armButton`/`modeButton` (and removing the matching
`*Axis`) in `input.gamepadRC`. Xbox-style throttle sticks spring to center —
pull fully down to arm; in flight, stick center = 50% throttle.

## Graphics

Golden-hour PBR scene: physically-based sky with matched sun + PMREM
environment, follow-the-drone 4k shadow maps, planar-reflection lake,
instanced pines/bushes/wind-swayed grass, and an FPV-camera post stack
(HDR bloom → fisheye distortion + chromatic aberration + vignette + sensor
noise, MSAA). Quality presets Low → Ultra in the menu scale pixel ratio,
shadows, vegetation density, water reflection resolution, and bloom.

## Architecture (src/)

- `config.js` — every tunable: physics constants, rates, input presets,
  camera, graphics presets, world seed. Menu changes persist to localStorage.
- `main.js` — game loop: 240 Hz fixed-timestep physics accumulator + render.
- `physics/Quad.js` — rigid-body flight model (Betaflight rates math, tilt
  controller, motor spool, body-frame quadratic drag, prop wash);
  `physics/collision.js` — sphere vs heightfield + yaw-rotated boxes.
- `input/` — keyboard virtual sticks, gamepad/RC presets, arming logic.
- `world/` — seeded simplex heightfield + splat-shader terrain, Sky/sun/fog,
  Water-addon lake, instanced vegetation, the bando (every visual primitive
  registers its collider), canvas-generated textures.
- `render/` — composer + custom FPV lens pass; `cameras/` — FPV/chase/LOS;
- `ui/` — Betaflight-style OSD + settings menu; `audio/` — WebAudio-synthesized
  motors, wind, and crash sounds.

Debug hook: `window.__sim` exposes quad/input/world/config for poking around
in the console.
