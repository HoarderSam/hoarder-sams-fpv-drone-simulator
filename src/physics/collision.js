// Sphere vs heightfield + sphere vs (yaw-rotated) boxes. Returns contact
// list; the Quad resolves them. Collider format comes from world/bando.js:
// { x,y,z, hx,hy,hz, yaw, c, s } with c/s = cos/sin(yaw).

const _contacts = [];

export function collideSphere(pos, r, terrain, colliders) {
  _contacts.length = 0;

  // terrain heightfield
  const h = terrain.getHeight(pos.x, pos.z);
  if (pos.y - r < h) {
    const n = terrain.getNormal(pos.x, pos.z);
    _contacts.push({ nx: n.x, ny: n.y, nz: n.z, pen: (h - (pos.y - r)) * n.y });
  }

  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (b.rb === undefined) b.rb = Math.hypot(b.hx, b.hy, b.hz) + 0.5;
    const dx = pos.x - b.x, dy = pos.y - b.y, dz = pos.z - b.z;
    if (dx * dx + dy * dy + dz * dz > (b.rb + r) * (b.rb + r)) continue;

    // world -> box local (rotate by -yaw around Y)
    const lx = b.c * dx - b.s * dz;
    const lz = b.s * dx + b.c * dz;
    const ly = dy;

    const cx = Math.max(-b.hx, Math.min(b.hx, lx));
    const cy = Math.max(-b.hy, Math.min(b.hy, ly));
    const cz = Math.max(-b.hz, Math.min(b.hz, lz));
    let ex = lx - cx, ey = ly - cy, ez = lz - cz;
    const d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > r * r) continue;

    let pen, nlx, nly, nlz;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      pen = r - d;
      nlx = ex / d; nly = ey / d; nlz = ez / d;
    } else {
      // center inside the box: push out along the shallowest face
      const px = b.hx - Math.abs(lx), py = b.hy - Math.abs(ly), pz = b.hz - Math.abs(lz);
      if (px < py && px < pz) { nlx = Math.sign(lx) || 1; nly = 0; nlz = 0; pen = px + r; }
      else if (py < pz) { nlx = 0; nly = Math.sign(ly) || 1; nlz = 0; pen = py + r; }
      else { nlx = 0; nly = 0; nlz = Math.sign(lz) || 1; pen = pz + r; }
    }
    // local -> world normal (rotate by +yaw)
    _contacts.push({
      nx: b.c * nlx + b.s * nlz,
      ny: nly,
      nz: -b.s * nlx + b.c * nlz,
      pen,
    });
  }
  return _contacts;
}
