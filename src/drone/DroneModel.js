// Visual 5" freestyle quad built from primitives. Mostly seen in chase/LOS
// views; spinning prop discs + LEDs sell the state.

import * as THREE from 'three';

export class DroneModel {
  constructor(textures) {
    this.group = new THREE.Group();

    const carbon = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.55, metalness: 0.3 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xc84a10, roughness: 0.4, metalness: 0.1 });
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.35, metalness: 0.85 });
    const battMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.7 });
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x00ff88, emissiveIntensity: 0 });

    const add = (geo, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = true;
      this.group.add(m);
      return m;
    };

    // frame plates
    add(new THREE.BoxGeometry(0.09, 0.012, 0.16), carbon, 0, 0, 0);
    add(new THREE.BoxGeometry(0.09, 0.012, 0.16), carbon, 0, 0.032, 0);
    // canopy
    add(new THREE.BoxGeometry(0.07, 0.035, 0.13), canopyMat, 0, 0.055, -0.005);
    // battery on top
    add(new THREE.BoxGeometry(0.055, 0.035, 0.11), battMat, 0, 0.095, 0.01);
    // FPV cam block
    add(new THREE.BoxGeometry(0.03, 0.03, 0.03), carbon, 0, 0.055, -0.075);

    // arms + motors + props (X layout)
    this.props = [];
    this.blades = [];
    const armLen = 0.16;
    const positions = [
      [1, -1], [-1, -1], [1, 1], [-1, 1], // FR, FL, BR, BL (z- = front)
    ];
    for (const [sx, sz] of positions) {
      const ang = Math.atan2(sx, sz);
      const arm = add(new THREE.BoxGeometry(0.028, 0.012, armLen), carbon,
        (sx * armLen * 0.5) / 1.41, 0.016, (sz * armLen * 0.5) / 1.41, ang);
      arm.castShadow = false;
      const mx = (sx * armLen) / 1.41, mz = (sz * armLen) / 1.41;
      add(new THREE.CylinderGeometry(0.014, 0.016, 0.02, 10), motorMat, mx, 0.045, mz);
      // spinning prop disc (armed)
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.064, 24),
        new THREE.MeshBasicMaterial({
          map: textures.propDisc, transparent: true, opacity: 0.55,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(mx, 0.058, mz);
      disc.visible = false;
      this.group.add(disc);
      this.props.push(disc);
      // static blades (disarmed)
      const bladeGroup = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.06), carbon);
        blade.rotation.y = (b / 3) * Math.PI * 2;
        blade.position.set(
          Math.sin((b / 3) * Math.PI * 2) * 0.032, 0,
          Math.cos((b / 3) * Math.PI * 2) * 0.032
        );
        bladeGroup.add(blade);
      }
      bladeGroup.position.set(mx, 0.058, mz);
      bladeGroup.userData.phase = Math.random() * 3;
      this.group.add(bladeGroup);
      this.blades.push(bladeGroup);
    }

    // rear LEDs
    for (const sx of [-1, 1]) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.006), this.ledMat);
      led.position.set(sx * 0.03, 0.02, 0.082);
      this.group.add(led);
    }
  }

  update(quad, dt) {
    this.group.position.copy(quad.pos);
    this.group.quaternion.copy(quad.quat);
    const spinning = quad.armed && quad.motor > 0.02;
    for (let i = 0; i < 4; i++) {
      this.props[i].visible = spinning;
      this.blades[i].visible = !spinning;
      if (spinning) this.props[i].rotation.z += (i % 2 ? 1 : -1) * (30 + quad.motor * 160) * dt;
    }
    this.ledMat.emissiveIntensity = quad.armed ? 3.5 : (quad.crashed ? 1.5 : 0.4);
    this.ledMat.emissive.setHex(quad.crashed ? 0xff2020 : 0x00ff88);
  }
}
