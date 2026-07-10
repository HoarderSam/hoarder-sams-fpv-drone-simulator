// The flight model. One rigid body integrated at 240 Hz:
// - acro: Betaflight-style rates -> target body angular velocity
// - angle: tilt controller on top of the same rate loop
// - hover: angle + vertical-velocity throttle assist
// Body frame: +X right, +Y up, -Z forward (camera convention).

import * as THREE from 'three';
import { clamp } from '../world/noise.js';
import { collideSphere } from './collision.js';

const D2R = Math.PI / 180;

export class Quad {
  constructor(cfg, terrain, colliders) {
    this.cfg = cfg;
    this.terrain = terrain;
    this.colliders = colliders;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.omega = new THREE.Vector3();   // body-frame rad/s
    this.motor = 0;                     // 0..1 spooled thrust fraction
    this.armed = false;
    this.crashed = false;
    this.mode = 'angle';
    this.flightTime = 0;
    this.onGround = true;
    this.justCrashed = false;           // one-shot event flag (audio/HUD)
    this.time = 0;

    this._qi = new THREE.Quaternion();
    this._dq = new THREE.Quaternion();
    this._up = new THREE.Vector3();
    this._f = new THREE.Vector3();
    this._vB = new THREE.Vector3();
    this._force = new THREE.Vector3();
    this._wT = new THREE.Vector3();
    this._upD = new THREE.Vector3();
    this._e = new THREE.Euler();
  }

  reset(spawnX, spawnZ, groundY, yawDeg) {
    this.pos.set(spawnX, groundY + 0.12, spawnZ);
    this.vel.set(0, 0, 0);
    this.quat.setFromEuler(this._e.set(0, yawDeg * D2R, 0));
    this.omega.set(0, 0, 0);
    this.motor = 0;
    this.armed = false;
    this.crashed = false;
    this.flightTime = 0;
    this.onGround = true;
  }

  disarm() { this.armed = false; }
  arm() {
    if (this.crashed) return false;
    this.armed = true;
    return true;
  }

  get speed() { return this.vel.length(); }
  get altitude() { return this.pos.y - this.terrain.getHeight(this.pos.x, this.pos.z); }

  _bfRate(x, r) {
    const ax = Math.abs(x);
    const cmd = x * ax * ax * ax * r.expo + x * (1 - r.expo);
    let rate = 200 * r.rcRate * cmd;
    if (r.superRate > 0) rate /= clamp(1 - Math.abs(cmd) * r.superRate, 0.01, 1);
    return rate * D2R;
  }

  step(dt, sticks) {
    const P = this.cfg.physics;
    this.time += dt;
    const mg = P.mass * P.gravity;
    const maxThrust = P.thrustToWeight * mg;

    // body up in world
    const up = this._up.set(0, 1, 0).applyQuaternion(this.quat);

    // ---------- throttle -> motor target ----------
    let motorTarget = 0;
    if (this.armed && !this.crashed) {
      if (this.mode === 'hover') {
        const H = this.cfg.hover;
        const st = sticks.throttle - 0.5;
        const vzT = Math.abs(st) < H.deadband
          ? 0
          : ((st - Math.sign(st) * H.deadband) / (0.5 - H.deadband)) * H.maxClimb;
        const hoverFrac = (mg / maxThrust) / clamp(up.y, 0.35, 1);
        motorTarget = clamp(hoverFrac + (vzT - this.vel.y) * H.velP * (mg / maxThrust), 0, 1);
      } else {
        const e = P.throttleExpo;
        const t = sticks.throttle;
        motorTarget = clamp(t * (1 - e) + t * t * t * e, 0, 1);
        motorTarget = Math.max(motorTarget, 0.04); // idle
      }
    }
    this.motor += (motorTarget - this.motor) * (dt / (P.motorTau + dt));
    const thrust = this.motor * maxThrust * (this.armed && !this.crashed ? 1 : 0);

    // ---------- target body rates ----------
    const wT = this._wT;
    if (this.armed && !this.crashed) {
      const R = this.cfg.rates;
      if (this.mode === 'acro') {
        wT.set(
          -this._bfRate(sticks.pitch, R.pitch),
          -this._bfRate(sticks.yaw, R.yaw),
          -this._bfRate(sticks.roll, R.roll)
        );
      } else {
        // tilt controller: build desired up vector in the heading frame
        const A = this.cfg.angle;
        const maxT = A.maxTilt * D2R;
        const tp = sticks.pitch * maxT;
        const tr = sticks.roll * maxT;
        const upD = this._upD.set(
          Math.sin(tr),
          Math.cos(tp) * Math.cos(tr),
          -Math.sin(tp) * Math.cos(tr)
        ).normalize();
        // heading yaw
        const f = this._f.set(0, 0, -1).applyQuaternion(this.quat);
        const psi = Math.atan2(-f.x, -f.z);
        const c = Math.cos(psi), s = Math.sin(psi);
        const wx = c * upD.x + s * upD.z;
        const wz = -s * upD.x + c * upD.z;
        upD.set(wx, upD.y, wz);
        // world -> body
        upD.applyQuaternion(this._qi.copy(this.quat).invert());
        // error axis = bodyUp x desiredUp = (upD.z, 0, -upD.x) (small-angle)
        wT.set(
          upD.z * A.strength,
          -this._bfRate(sticks.yaw, this.cfg.rates.yaw),
          -upD.x * A.strength
        );
      }

      // prop-wash wobble: descending into your own wash at throttle
      const vUp = this.vel.dot(up);
      const wash = this.motor * clamp((-vUp - 1.8) / 4.5, 0, 1) * P.propwash;
      if (wash > 0) {
        const t = this.time;
        wT.x += wash * (Math.sin(t * 41.3) + Math.sin(t * 23.7)) * 1.4;
        wT.z += wash * (Math.sin(t * 37.1 + 1.7) + Math.sin(t * 19.3)) * 1.4;
      }

      this.omega.lerp(wT, dt / (P.rateTau + dt));
    } else {
      this.omega.multiplyScalar(Math.exp(-1.6 * dt));
    }

    // ---------- integrate orientation ----------
    const h = dt / 2;
    this._dq.set(this.omega.x * h, this.omega.y * h, this.omega.z * h, 1).normalize();
    this.quat.multiply(this._dq).normalize();

    // ---------- forces ----------
    up.set(0, 1, 0).applyQuaternion(this.quat);
    const F = this._force.set(0, -mg, 0).addScaledVector(up, thrust);
    // body-frame aerodynamic drag
    const vB = this._vB.copy(this.vel).applyQuaternion(this._qi.copy(this.quat).invert());
    const D = P.dragQuad;
    vB.set(
      -D.x * vB.x * Math.abs(vB.x) - P.dragLinear * vB.x,
      -D.y * vB.y * Math.abs(vB.y) - P.dragLinear * vB.y,
      -D.z * vB.z * Math.abs(vB.z) - P.dragLinear * vB.z
    );
    F.add(vB.applyQuaternion(this.quat));

    this.vel.addScaledVector(F, dt / P.mass);
    this.pos.addScaledVector(this.vel, dt);

    // ---------- collision ----------
    this.onGround = false;
    const contacts = collideSphere(this.pos, P.colliderRadius, this.terrain, this.colliders);
    for (let i = 0; i < contacts.length; i++) {
      const ct = contacts[i];
      if (ct.pen <= 0) continue;
      this.pos.x += ct.nx * ct.pen;
      this.pos.y += ct.ny * ct.pen;
      this.pos.z += ct.nz * ct.pen;
      const vn = this.vel.x * ct.nx + this.vel.y * ct.ny + this.vel.z * ct.nz;
      if (vn < 0) {
        const impact = -vn;
        if (impact > P.crashSpeed && this.armed && !this.crashed) {
          this.crashed = true;
          this.armed = false;
          this.justCrashed = true;
          this.omega.x += Math.sin(this.time * 999) * 14;
          this.omega.z += Math.cos(this.time * 777) * 14;
        }
        const rest = P.restitution * clamp((impact - 0.6) / 2.5, 0, 1);
        // remove normal velocity (+ bounce), damp tangential (friction)
        this.vel.x -= ct.nx * vn * (1 + rest);
        this.vel.y -= ct.ny * vn * (1 + rest);
        this.vel.z -= ct.nz * vn * (1 + rest);
        const f = Math.exp(-P.friction * 14 * dt);
        const vn2 = this.vel.x * ct.nx + this.vel.y * ct.ny + this.vel.z * ct.nz;
        this.vel.x = (this.vel.x - ct.nx * vn2) * f + ct.nx * vn2;
        this.vel.y = (this.vel.y - ct.ny * vn2) * f + ct.ny * vn2;
        this.vel.z = (this.vel.z - ct.nz * vn2) * f + ct.nz * vn2;
        // scrape torque
        this.omega.multiplyScalar(Math.exp(-4 * dt));
      }
      this.onGround = true;
    }

    // rest / sleep
    if (this.onGround && this.motor < 0.06 &&
        this.vel.lengthSq() < 0.09 && this.omega.lengthSq() < 0.5) {
      this.vel.set(0, 0, 0);
      this.omega.set(0, 0, 0);
    }

    if (this.armed) this.flightTime += dt;
  }
}
