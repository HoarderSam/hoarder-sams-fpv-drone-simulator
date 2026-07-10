// All textures are generated on canvas at boot — the sim ships zero binary
// assets. Each generator gets its own deterministic PRNG stream.

import * as THREE from 'three';
import { mulberry32, Simplex2D } from './noise.js';

function canvasTexture(size, draw, { srgb = true, repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function speckle(ctx, size, rand, count, colors, minR = 1, maxR = 3, alpha = 0.2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(rand() * colors.length) | 0];
    ctx.globalAlpha = alpha * (0.4 + rand() * 0.6);
    const r = minR + rand() * (maxR - minR);
    ctx.fillRect(rand() * size, rand() * size, r, r);
  }
  ctx.globalAlpha = 1;
}

function stains(ctx, size, rand, count, color, maxR = 60, alpha = 0.14) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size, y = rand() * size, r = 10 + rand() * maxR;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * (0.4 + rand() * 0.6);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

export function makeTextures(seed) {
  const T = {};

  T.grass = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 1);
    ctx.fillStyle = '#4a5c2a'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 9000, ['#5a7031', '#3d4f22', '#6b7d3a', '#42552b', '#77864a'], 1, 4, 0.5);
    // blade streaks
    for (let i = 0; i < 1600; i++) {
      ctx.strokeStyle = ['#5f7434', '#465a27', '#71833f'][(rand() * 3) | 0];
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      const x = rand() * s, y = rand() * s, l = 3 + rand() * 7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 3, y - l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    stains(ctx, s, rand, 24, '#2e3d1c', 90, 0.22);
  });

  T.rock = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 2);
    const nz = new Simplex2D(seed + 2);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const n = nz.fbm(x / 60, y / 60, 5) * 0.5 + 0.5;
      const crack = Math.abs(nz.noise(x / 34, y / 34));
      let v = 92 + n * 70 - (crack < 0.06 ? 38 : 0);
      const i = (y * s + x) * 4;
      img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.92; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    speckle(ctx, s, rand, 2500, ['#8a8a84', '#5c5c56', '#a3a29a'], 1, 3, 0.3);
  });

  T.dirt = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 3);
    ctx.fillStyle = '#6b5537'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 8000, ['#7a6340', '#5a4630', '#8a7048', '#4e3d29'], 1, 4, 0.5);
    stains(ctx, s, rand, 30, '#3f3222', 70, 0.25);
  });

  // grayscale fBm — splat macro-variation, also reused as generic detail
  T.macro = canvasTexture(512, (ctx, s) => {
    const nz = new Simplex2D(seed + 4);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      // periodic-ish tiling: blend two mirrored samples
      const fx = x / s, fy = y / s;
      const a = nz.fbm(fx * 6, fy * 6, 4);
      const b = nz.fbm((1 - fx) * 6 + 9, (1 - fy) * 6 + 9, 4);
      const w = Math.min(fx, 1 - fx) * Math.min(fy, 1 - fy) * 4;
      const v = ((a * w + b * (1 - w)) * 0.5 + 0.5) * 255;
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false });

  T.concrete = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 5);
    ctx.fillStyle = '#8f8d86'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 12000, ['#9a988f', '#7f7d76', '#a8a69d', '#6e6c66'], 1, 3, 0.4);
    stains(ctx, s, rand, 40, '#4a4842', 80, 0.20);
    stains(ctx, s, rand, 12, '#3a5a3a', 50, 0.10); // moss
    // cracks
    ctx.strokeStyle = '#55534d'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.35 + rand() * 0.3;
      let x = rand() * s, y = rand() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rand() - 0.5) * 46; y += (rand() - 0.5) * 46; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  T.concreteFloor = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 6);
    ctx.fillStyle = '#83817b'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 10000, ['#8e8c85', '#75736d', '#999790'], 1, 3, 0.4);
    // expansion-joint grid
    ctx.strokeStyle = '#5c5a55'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo((i * s) / 4, 0); ctx.lineTo((i * s) / 4, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * s) / 4); ctx.lineTo(s, (i * s) / 4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    stains(ctx, s, rand, 50, '#45433e', 70, 0.22);
    stains(ctx, s, rand, 10, '#2b2b33', 40, 0.30); // oil
  });

  // corrugated metal wall, rusted
  T.corrugated = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 7);
    ctx.fillStyle = '#5d646b'; ctx.fillRect(0, 0, s, s);
    // vertical corrugation shading
    for (let x = 0; x < s; x++) {
      const ph = (x / s) * Math.PI * 2 * 24;
      const v = Math.sin(ph) * 26;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
      ctx.fillRect(x, 0, 1, s);
    }
    // rust streaks running down
    for (let i = 0; i < 46; i++) {
      const x = rand() * s, y = rand() * s * 0.7, l = 30 + rand() * 160, w = 2 + rand() * 9;
      const g = ctx.createLinearGradient(x, y, x, y + l);
      g.addColorStop(0, 'rgba(122, 66, 30, 0.55)');
      g.addColorStop(1, 'rgba(122, 66, 30, 0)');
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w, l);
    }
    stains(ctx, s, rand, 26, '#6b3a1a', 40, 0.25);
    speckle(ctx, s, rand, 2500, ['#8a4a22', '#5f3317', '#96552b'], 1, 3, 0.25);
  });

  T.rust = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 8);
    ctx.fillStyle = '#4f3d2b'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 12000, ['#5a4630', '#3e3026', '#6b5138', '#37281c', '#5f554a'], 1, 3, 0.5);
    stains(ctx, s, rand, 46, '#2b2015', 60, 0.32);
  });

  // shipping-container side: ribbed, painted, weathered (tinted per instance)
  T.container = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 9);
    ctx.fillStyle = '#b8b8b8'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x++) {
      const tri = Math.abs((((x / s) * 14) % 1) - 0.5) * 2; // triangle wave ribs
      const v = (tri - 0.5) * 60;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
      ctx.fillRect(x, 0, 1, s);
    }
    for (let i = 0; i < 30; i++) {
      const x = rand() * s, y = rand() * s * 0.6, l = 20 + rand() * 120, w = 2 + rand() * 6;
      const g = ctx.createLinearGradient(x, y, x, y + l);
      g.addColorStop(0, 'rgba(90, 50, 25, 0.5)'); g.addColorStop(1, 'rgba(90,50,25,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w, l);
    }
    stains(ctx, s, rand, 20, '#41403c', 50, 0.22);
  });

  T.metalRoof = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 10);
    ctx.fillStyle = '#6a6e72'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const v = Math.sin((y / s) * Math.PI * 2 * 16) * 20;
      ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
      ctx.fillRect(0, y, s, 1);
    }
    stains(ctx, s, rand, 40, '#54341c', 60, 0.30);
    speckle(ctx, s, rand, 3000, ['#7a4a26', '#4f4f52', '#8a8e92'], 1, 3, 0.3);
  });

  T.asphalt = canvasTexture(512, (ctx, s) => {
    const rand = mulberry32(seed + 11);
    ctx.fillStyle = '#4a4a4c'; ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rand, 14000, ['#565658', '#3e3e40', '#606063', '#333335'], 1, 2, 0.5);
    stains(ctx, s, rand, 30, '#2c2c2e', 60, 0.25);
  });

  // billboard foliage (alpha-tested)
  T.bush = canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(seed + 12);
    ctx.clearRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const cx = s / 2 + (rand() - 0.5) * s * 0.8;
      const cy = s * 0.62 + (rand() - 0.5) * s * 0.62;
      const d = Math.hypot(cx - s / 2, cy - s * 0.6) / (s * 0.48);
      if (d > 1) continue;
      ctx.fillStyle = ['#3d5225', '#4c6330', '#2f421d', '#5a7239'][(rand() * 4) | 0];
      ctx.globalAlpha = 0.9;
      const r = 2 + rand() * 6;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, { repeat: false });

  // prop-disc blur (radial streaks)
  T.propDisc = canvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const c = s / 2;
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      ctx.strokeStyle = `rgba(30,30,34,${0.25 + 0.35 * Math.abs(Math.sin(rad * 1.5))})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c + Math.cos(rad) * 8, c + Math.sin(rad) * 8);
      ctx.lineTo(c + Math.cos(rad) * (c - 2), c + Math.sin(rad) * (c - 2)); ctx.stroke();
    }
  }, { repeat: false });

  // tileable water normal map from summed periodic waves
  T.waterNormals = canvasTexture(256, (ctx, s) => {
    const rand = mulberry32(seed + 13);
    const waves = [];
    for (let i = 0; i < 26; i++) {
      const k = i < 10 ? 8 : 26; // mix of broad swell and fine chop
      waves.push({
        kx: Math.round((rand() - 0.5) * k) || 1,
        ky: Math.round((rand() - 0.5) * k) || 1,
        ph: rand() * Math.PI * 2,
        amp: (i < 10 ? 0.5 : 0.22) + rand() * 0.4,
      });
    }
    const h = (x, y) => {
      let v = 0;
      for (const w of waves) v += w.amp * Math.sin(2 * Math.PI * (w.kx * x + w.ky * y) + w.ph);
      return v;
    };
    const img = ctx.createImageData(s, s);
    const e = 1 / s;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const fx = x / s, fy = y / s;
      const dx = (h(fx + e, fy) - h(fx - e, fy)) * 2.2;
      const dy = (h(fx, fy + e) - h(fx, fy - e)) * 2.2;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * s + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false });

  return T;
}
