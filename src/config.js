// Central tunables. Runtime settings changed in the menu are persisted to
// localStorage and deep-merged over these defaults at boot (see ui/Menu.js).

export const config = {
  physics: {
    dt: 1 / 240,          // fixed physics step (s)
    maxSubsteps: 20,
    gravity: 9.81,
    mass: 0.62,           // kg — 5" freestyle quad w/ battery
    thrustToWeight: 5.4,  // max total thrust = TWR * m * g
    throttleExpo: 0.35,   // fattens low-throttle resolution like a real curve
    motorTau: 0.05,       // motor spool-up time constant (s)
    rateTau: 0.045,       // angular-velocity response time constant (s)
    // body-frame quadratic drag (N per (m/s)^2): x = sideways, y = flat-plate
    // vertical (what makes a quad "hang" in a dive), z = forward
    dragQuad: { x: 0.016, y: 0.020, z: 0.012 },
    dragLinear: 0.06,
    propwash: 0.55,       // turbulence torque at high throttle + high AoA
    colliderRadius: 0.16, // m
    crashSpeed: 10.0,     // impact speed along normal (m/s) that counts as a crash
    restitution: 0.32,
    friction: 0.75,
  },

  rates: {
    // Betaflight-style: deg/s = 200*rcRate*x * 1/(1 - |x|*superRate), expo on x
    roll:  { rcRate: 1.0, superRate: 0.72, expo: 0.25 },
    pitch: { rcRate: 1.0, superRate: 0.72, expo: 0.25 },
    yaw:   { rcRate: 1.0, superRate: 0.65, expo: 0.25 },
  },

  angle: {
    maxTilt: 55,          // deg
    strength: 7.0,        // attitude P gain (error rad -> rate rad/s)
  },

  hover: {
    maxClimb: 6.0,        // m/s at full stick
    deadband: 0.08,       // throttle stick band around center that means "hold"
    velP: 1.2,            // vertical-velocity P gain -> throttle
  },

  input: {
    keyboard: {
      attackRate: 5.0,    // stick ramp toward deflection (1/s)
      releaseRate: 7.0,   // stick return to center (1/s)
      throttleRate: 1.6,  // throttle ramp (1/s)
      yawRate: 4.0,
    },
    // Xbox-style pads (Gamepad API `mapping: "standard"`), Mode 2 layout:
    // left stick yaw/throttle (springs to center = 50% throttle in flight,
    // pull fully down to arm), right stick roll/pitch.
    gamepadStandard: {
      yawAxis: 0, throttleAxis: 1, rollAxis: 2, pitchAxis: 3,
      rollInvert: false, pitchInvert: true, yawInvert: false, throttleInvert: true,
      deadband: 0.09,
      armButton: 0,       // A — toggle
      resetButton: 1,     // B
      modeButton: 3,      // Y
      cameraButton: 2,    // X
    },
    // USB RC transmitters in joystick mode (EdgeTX/OpenTX), AETR channel order.
    // Channels 1-8 arrive as axes 0-7; channels 9-16 as buttons 0-7.
    // Arming reads channel 5 (axis 4) as a level-triggered switch; set
    // armButton instead (and remove armAxis) to arm from ch9+.
    gamepadRC: {
      rollAxis: 0, pitchAxis: 1, throttleAxis: 2, yawAxis: 3,
      rollInvert: false, pitchInvert: false, yawInvert: false, throttleInvert: false,
      deadband: 0.02,
      armAxis: 4,         // ch5 — switch, armed while axis > armThreshold
      armThreshold: 0.5,
      modeAxis: 5,        // ch6 — switch: -1 = acro, +1 = angle
      modeThreshold: 0.5, // (set modeButton instead for a ch9+ button)
    },
    armThrottleMax: 0.06, // throttle must be below this to arm
  },

  camera: {
    fpvTilt: 25,          // deg uptilt
    fpvFov: 105,          // deg, pre-distortion
    speedFov: 10,         // extra deg at high speed
    chaseDistance: 3.4,
    chaseHeight: 1.1,
  },

  graphics: {
    quality: 'high',
    presets: {
      low:    { pixelRatio: 1.0, shadowSize: 1024, shadows: true,  trees: 400,  grass: 0,     bushes: 150, waterRes: 128, bloom: false, msaa: 0 },
      medium: { pixelRatio: 1.0, shadowSize: 2048, shadows: true,  trees: 900,  grass: 6000,  bushes: 350, waterRes: 256, bloom: true,  msaa: 2 },
      high:   { pixelRatio: 1.0, shadowSize: 4096, shadows: true,  trees: 1600, grass: 14000, bushes: 600, waterRes: 512, bloom: true,  msaa: 4 },
      ultra:  { pixelRatio: 1.5, shadowSize: 4096, shadows: true,  trees: 2400, grass: 24000, bushes: 900, waterRes: 1024, bloom: true, msaa: 4 },
    },
    fpvPass: {
      distortion: 0.14,   // barrel/fisheye strength
      speedDistortion: 0.07,
      chromatic: 0.22,
      vignette: 0.42,
      noise: 0.025,
    },
    exposure: 0.85,
  },

  world: {
    seed: 1337,
    size: 2048,           // m, square
    gridRes: 384,         // heightfield resolution (verts per side)
    waterLevel: 3.0,
    // bando compound sits on a flattened plateau
    bandoCenter: { x: 60, z: -40 },
    bandoRadius: 150,
    plateauHeight: 8,
    lakeCenter: { x: -430, z: 310 },
    lakeRadius: 270,
    sunElevation: 16,     // deg — golden hour
    sunAzimuth: 60,       // deg — behind the launch pad, raking the compound
    fogDensity: 0.00085,
    shadowRadius: 150,    // m half-extent of the follow shadow frustum
  },

  audio: {
    enabled: true,
    masterGain: 0.5,
  },

  spawn: {
    // launch pad on the plateau, south of the compound
    x: 60, z: 35,
    yaw: 0,               // deg — facing the warehouses (-z)
  },
};
