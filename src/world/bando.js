// The industrial compound. Every visible primitive registers a matching
// collider box, so collision always agrees with what you see. Openings are
// sized generously for fly-throughs (doors ~10m, roof holes 6m, clerestory).

import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// tile box UVs so `texScale` meters of surface = one texture repeat
function scaleBoxUVs(geo, w, h, d, s) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = f * 4; v < f * 4 + 4; v++) {
      uv.setXY(v, uv.getX(v) * (dims[f][0] / s), uv.getY(v) * (dims[f][1] / s));
    }
  }
}

export class Bando {
  constructor(scene, cfg, textures, colliders) {
    this.group = new THREE.Group();
    this.colliders = colliders;
    const rand = mulberry32(cfg.world.seed + 300);

    const gy = cfg.world.plateauHeight; // ground level on the plateau

    const mats = {
      concrete: new THREE.MeshStandardMaterial({ map: textures.concrete, roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ map: textures.concreteFloor, roughness: 0.97 }),
      corrugated: new THREE.MeshStandardMaterial({ map: textures.corrugated, roughness: 0.6, metalness: 0.45 }),
      roof: new THREE.MeshStandardMaterial({ map: textures.metalRoof, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide }),
      rust: new THREE.MeshStandardMaterial({ map: textures.rust, roughness: 0.85, metalness: 0.35 }),
      asphalt: new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 1.0 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.9 }),
    };
    this.mats = mats;

    const box = (w, h, d, x, y, z, mat, { yaw = 0, collide = true, cast = true, texScale = 4 } = {}) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (mat.map) scaleBoxUVs(geo, w, h, d, texScale);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.y = yaw;
      m.castShadow = cast;
      m.receiveShadow = true;
      this.group.add(m);
      if (collide) {
        colliders.push({ x, y, z, hx: w / 2, hy: h / 2, hz: d / 2, yaw, c: Math.cos(yaw), s: Math.sin(yaw) });
      }
      return m;
    };
    // convenience: base sits on given ground height
    const boxOn = (w, h, d, x, z, base, mat, opts) => box(w, h, d, x, base + h / 2, z, mat, opts);

    const cyl = (r, h, x, y, z, mat, { horizontal = false, axis = 'x', collide = true, seg = 14, texScale = 4 } = {}) => {
      const geo = new THREE.CylinderGeometry(r, r, h, seg);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * ((2 * Math.PI * r) / texScale), uv.getY(i) * (h / texScale));
      }
      const m = new THREE.Mesh(geo, mat);
      if (horizontal) m.rotation.z = axis === 'x' ? Math.PI / 2 : 0, axis === 'z' && (m.rotation.x = Math.PI / 2);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      if (collide) {
        const hx = horizontal && axis === 'x' ? h / 2 : r;
        const hz = horizontal && axis === 'z' ? h / 2 : r;
        const hy = horizontal ? r : h / 2;
        colliders.push({ x, y, z, hx, hy, hz, yaw: 0, c: 1, s: 0 });
      }
      return m;
    };

    // ================= ground slab =================
    boxOn(130, 1.2, 100, 60, -40, gy - 1.14, mats.floor, { cast: false, texScale: 10 });
    // helipad-style launch pad on the grass south of the compound
    boxOn(5.4, 0.14, 5.4, 60, 35, gy - 0.02, mats.asphalt, { cast: false });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.05, 6, 40),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x888888, emissiveIntensity: 0.3 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(60, gy + 0.15, 35);
    this.group.add(ring);

    // ================= warehouse A =================
    // 42(x) x 24(z), H=11 at (35, -55). Door gaps, clerestory strip, roof holes.
    {
      const wx = 35, wz = -55, W = 42, D = 24, t = 0.4;
      const x0 = wx - W / 2; // 14
      const zf = wz - D / 2; // front  (-67)
      const zb = wz + D / 2; // back   (-43)

      const wall = (cx, cz, w, h, yBase) => boxOn(w, h, t, cx, cz, gy + yBase, mats.corrugated);
      // front wall: piers 14-22, 32-39, 48-56 (door gaps 10m and 9m)
      wall(18, zf, 8, 6, 0); wall(35.5, zf, 7, 6, 0); wall(52, zf, 8, 6, 0);
      // back wall: piers 14-24, 32-38, 46-56 (two 8m gaps)
      wall(19, zb, 10, 6, 0); wall(35, zb, 6, 6, 0); wall(51, zb, 10, 6, 0);
      // header + top bands (clerestory strip 8.5-9.8 stays open)
      for (const z of [zf, zb]) {
        boxOn(W, 2.5, t, wx, z, gy + 6, mats.corrugated);
        boxOn(W, 1.2, t, wx, z, gy + 9.8, mats.corrugated);
        for (const px of [21, 30.5, 40, 49.5]) boxOn(0.28, 1.3, t, px, z, gy + 8.5, mats.rust);
      }
      // end walls with a full-height 6m gap each
      const endWall = (cx) => {
        boxOn(t, 8.5, 7, cx, zf + 3.5, gy, mats.corrugated);       // z: -67..-60
        boxOn(t, 8.5, 11, cx, zb - 5.5, gy, mats.corrugated);      // z: -54..-43
        boxOn(t, 4, 6, cx, zf + 10, gy + 7, mats.corrugated);      // header over gap
        boxOn(t, 1.2, D, cx, wz, gy + 9.8, mats.corrugated);       // top band
      };
      endWall(x0); endWall(wx + W / 2);
      // roof: 7 panels of 6m, panels at x-centers 29 and 47 missing (holes)
      for (const px of [17, 23, 35, 41, 53]) {
        boxOn(6, 0.25, D, px, wz, gy + 10.9, mats.roof, { texScale: 6 });
      }
      // interior columns
      for (const px of [22, 32, 42, 52]) {
        for (const pz of [wz - 4, wz + 4]) boxOn(0.45, 10.9, 0.45, px, pz, gy, mats.concrete);
      }
      // catwalk along the back wall
      boxOn(36, 0.15, 1.4, wx, zb - 1.6, gy + 5, mats.rust);
      boxOn(36, 0.1, 0.08, wx, zb - 2.32, gy + 6.05, mats.rust); // rail
      for (const px of [20, 35, 50]) boxOn(0.15, 5, 0.15, px, zb - 1.6, gy, mats.rust);
      // clutter
      for (let i = 0; i < 7; i++) {
        const s = 1 + rand() * 1.4;
        boxOn(s, s, s, x0 + 4 + rand() * (W - 8), wz - 8 + rand() * 16, gy, mats.rust, { yaw: rand() * 3 });
      }
    }

    // ================= building B: concrete skeleton =================
    {
      const bx = 95, bz = -75;
      for (const px of [-9.5, 0, 9.5]) {
        for (const pz of [-6.5, 0, 6.5]) {
          boxOn(0.55, 9, 0.55, bx + px, bz + pz, gy, mats.concrete);
        }
      }
      boxOn(21, 0.4, 15, bx, bz, gy + 4.5, mats.floor, { texScale: 7 });
      boxOn(21, 0.4, 15, bx, bz, gy + 9.0, mats.floor, { texScale: 7 });
      // half-height parapet on the roof, one side
      boxOn(21, 0.9, 0.3, bx, bz - 7.35, gy + 9.4, mats.concrete);
      boxOn(21, 0.9, 0.3, bx, bz + 7.35, gy + 9.4, mats.concrete);
    }

    // ================= containers =================
    {
      const colors = [0x8a3325, 0x2e4a7a, 0x3f6b3a, 0x9a5a22, 0x2f6b66, 0x555a5e];
      const place = [
        [78, -16, 0, 0.15], [78, -11.3, 0, 0.08], [78, -16, 1, 0.15],
        [95, -18, 0, 1.2], [95, -18, 1, 1.28],
        [99, -6, 0, -0.5], [88, 3, 0, 2.3],
      ];
      place.forEach(([x, z, lvl, yaw], i) => {
        const mat = new THREE.MeshStandardMaterial({
          map: textures.container, roughness: 0.62, metalness: 0.4,
          color: new THREE.Color(colors[i % colors.length]),
        });
        boxOn(12.2, 2.6, 2.44, x, z, gy + lvl * 2.6, mat, { yaw, texScale: 3 });
      });
    }

    // ================= tanks + pipe rack =================
    {
      cyl(3, 9, 14, gy + 4.5, -12, mats.rust, { seg: 20 });
      cyl(3, 9, 22, gy + 4.5, -4, mats.rust, { seg: 20 });
      cyl(0.35, 20, 34, gy + 2.2, -8, mats.rust, { horizontal: true, axis: 'x' });
      cyl(0.35, 20, 34, gy + 3.2, -8, mats.rust, { horizontal: true, axis: 'x' });
      for (const px of [27, 41]) {
        boxOn(0.22, 3.5, 0.22, px, -8.8, gy, mats.rust);
        boxOn(0.22, 3.5, 0.22, px, -7.2, gy, mats.rust);
        box(1.8, 0.22, 0.22, px, gy + 3.6, -8, mats.rust, { yaw: Math.PI / 2 });
      }
    }

    // ================= lattice mast =================
    {
      const mx = 12, mz = -70, mh = 26;
      for (const [ox, oz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
        boxOn(0.18, mh, 0.18, mx + ox, mz + oz, gy, mats.rust, { collide: false });
      }
      for (let y = 5; y <= 25; y += 5) {
        box(2.38, 0.14, 0.14, mx, gy + y, mz - 1.1, mats.rust, { collide: false });
        box(2.38, 0.14, 0.14, mx, gy + y, mz + 1.1, mats.rust, { collide: false });
        box(0.14, 0.14, 2.38, mx - 1.1, gy + y, mz, mats.rust, { collide: false });
        box(0.14, 0.14, 2.38, mx + 1.1, gy + y, mz, mats.rust, { collide: false });
      }
      boxOn(1.8, 0.15, 1.8, mx, mz, gy + mh, mats.rust, { collide: false });
      // single collider for the whole mast
      colliders.push({ x: mx, y: gy + mh / 2, z: mz, hx: 1.25, hy: mh / 2, hz: 1.25, yaw: 0, c: 1, s: 0 });
      this.beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 5 })
      );
      this.beacon.position.set(mx, gy + mh + 0.4, mz);
      this.group.add(this.beacon);
    }

    // ================= scattered debris on the pad =================
    for (let i = 0; i < 9; i++) {
      const s = 0.6 + rand() * 1.2;
      const x = 10 + rand() * 100, z = -85 + rand() * 88;
      // keep the warehouse interior-ish clear
      if (x > 12 && x < 58 && z > -69 && z < -41) continue;
      if (rand() < 0.5) boxOn(s, s * 0.8, s, x, z, gy, mats.rust, { yaw: rand() * 3 });
      else cyl(0.4, 1.1, x, gy + 0.55, z, mats.rust, { seg: 10 });
    }

    scene.add(this.group);
  }

  update(t) {
    // slow pulse on the mast beacon
    this.beacon.material.emissiveIntensity = 3.2 + 2.5 * Math.max(0, Math.sin(t * 2.2));
  }
}
