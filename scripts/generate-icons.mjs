// Generador del logo de la app (AutoTest Conducción): silueta de un carro dentro de un velocímetro.
// Uso: npm run icons
// Dibuja todo con campos de distancia (SDF) y antialias analítico, y escribe los PNG en assets/images/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

const MINT = [0, 245, 160];
const CYAN = [0, 217, 245];
const NAVY_DEEP = [5, 10, 20];
const NAVY_MID = [18, 34, 61];
const WHITE = [255, 255, 255];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---- Distancias con signo (negativo = dentro) ----
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const sdEllipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
function sdPolygon(x, y, pts) {
  let d = (x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i++) {
    const ex = pts[j][0] - pts[i][0];
    const ey = pts[j][1] - pts[i][1];
    const wx = x - pts[i][0];
    const wy = y - pts[i][1];
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey));
    const bx = wx - ex * t;
    const by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = y >= pts[i][1];
    const c2 = y < pts[j][1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}
function sdBox(x, y, cx, cy, hw, hh, angle) {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  const px = (x - cx) * c - (y - cy) * s;
  const py = (x - cx) * s + (y - cy) * c;
  const qx = Math.abs(px) - hw;
  const qy = Math.abs(py) - hh;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

// ---- Geometría del logo (espacio de diseño 1024 x 1024) ----
const RING_R = 410;
const RING_W = 36;
const CAR_S = 2.2;
const carX = (cx) => 512 + (cx - 181) * CAR_S;
const carY = (cy) => 585 + (cy - 62) * CAR_S;
const carPoly = (pts) => pts.map(([cx, cy]) => [carX(cx), carY(cy)]);

const BODY = carPoly([
  [28, 84], [28, 70], [34, 63], [46, 60], [98, 54], [128, 31], [134, 27], [142, 27],
  [222, 27], [234, 27], [242, 35], [264, 54], [316, 60], [330, 64], [334, 74], [334, 84],
  [330, 90], [36, 90],
]);
const WINDOWS = [
  carPoly([[134, 37], [166, 37], [166, 54], [112, 54]]),
  carPoly([[174, 37], [220, 37], [238, 54], [174, 54]]),
];
const WHEELS = [82, 276].map((wx) => [carX(wx), carY(90)]);
const ARCH_R = 24 * CAR_S;
const TIRE_R = 17 * CAR_S;
const HUB_R = 7 * CAR_S;

function renderLogo(size, { bg = false, mono = false, scale = 1, glow = true } = {}) {
  const png = new PNG({ width: size, height: size });
  const k = 1024 / size; // tamaño de un píxel en unidades de diseño
  const aa = Math.max(k, 1) * 1.0;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const ux = ((px + 0.5) * 1024) / size;
      const uy = ((py + 0.5) * 1024) / size;
      const x = (ux - 512) / scale + 512;
      const y = (uy - 512) / scale + 512;
      const pxw = aa / scale; // ancho de antialias en el espacio del diseño

      // Acumulador premultiplicado
      let r = 0, g = 0, b = 0, a = 0;
      const over = (col, cov, alpha = 1) => {
        const ca = clamp(cov) * alpha;
        if (ca <= 0) return;
        r = col[0] * ca + r * (1 - ca);
        g = col[1] * ca + g * (1 - ca);
        b = col[2] * ca + b * (1 - ca);
        a = ca + a * (1 - ca);
      };
      const cov = (d) => clamp(0.5 - d / pxw);

      // 1. Fondo
      if (bg) {
        const t = clamp(Math.hypot(ux - 512, uy - 400) / 780);
        over(mix(NAVY_MID, NAVY_DEEP, t), 1);
      }

      // 2. Halo suave detrás del carro
      if (glow && !mono) {
        const t = clamp(1 - Math.hypot(x - 512, y - 560) / 460);
        over(CYAN, t * t, 0.16);
      }

      const gradT = clamp((x + y - 250) / 1000);
      const grad = mono ? WHITE : mix(MINT, CYAN, gradT);

      // 3. Arco del velocímetro (abierto abajo) con extremos redondeados
      const dx = x - 512;
      const dy = y - 560;
      const theta = Math.atan2(dx, -dy); // 0 arriba, positivo hacia la derecha
      const maxA = (135 * Math.PI) / 180;
      const radial = Math.abs(Math.hypot(dx, dy) - RING_R) - RING_W / 2;
      let ringD = radial;
      if (Math.abs(theta) > maxA) {
        ringD = Math.min(
          sdCircle(x, y, 512 + RING_R * Math.sin(maxA), 560 - RING_R * Math.cos(maxA), RING_W / 2),
          sdCircle(x, y, 512 - RING_R * Math.sin(maxA), 560 - RING_R * Math.cos(maxA), RING_W / 2)
        );
      }
      over(grad, cov(ringD));

      // 4. Marcas de escala sobre el borde interior del arco
      for (let i = 0; i <= 12; i++) {
        const ang = -maxA + (i * (2 * maxA)) / 12;
        const rr = RING_R - RING_W / 2 - 24;
        const major = i % 3 === 0;
        const tx = 512 + rr * Math.sin(ang);
        const ty = 560 - rr * Math.cos(ang);
        const d = sdBox(x, y, tx, ty, major ? 5 : 3.5, major ? 20 : 12, ang);
        if (d < pxw * 2) over(grad, cov(d), major ? 0.95 : 0.55);
      }

      // 5. Sombra de contacto del carro
      if (!mono) over(NAVY_DEEP, cov(sdEllipse(x, y, 512, carY(104), 340, 14)), 0.45);

      // 6. Carrocería con recortes de ventanas y pasos de rueda
      let bodyD = sdPolygon(x, y, BODY) - 4; // -4 redondea las esquinas vivas
      for (const w of WINDOWS) bodyD = Math.max(bodyD, -(sdPolygon(x, y, w) - 3));
      for (const [wx, wy] of WHEELS) bodyD = Math.max(bodyD, -sdCircle(x, y, wx, wy, ARCH_R));
      over(grad, cov(bodyD));

      // 7. Ruedas
      for (const [wx, wy] of WHEELS) {
        const tire = sdCircle(x, y, wx, wy, TIRE_R);
        if (mono) {
          over(WHITE, cov(Math.max(tire, -(sdCircle(x, y, wx, wy, TIRE_R - 14)))));
          over(WHITE, cov(sdCircle(x, y, wx, wy, HUB_R)));
        } else {
          over([8, 14, 28], cov(tire));
          over(grad, cov(Math.abs(tire + 6) - 6)); // aro exterior
          over(grad, cov(sdCircle(x, y, wx, wy, HUB_R)));
        }
      }

      // 8. Faro y calavera
      if (!mono) {
        over([254, 249, 195], cov(sdEllipse(x, y, carX(35), carY(69), 15, 12)));
        over([239, 68, 68], cov(sdBox(x, y, carX(330), carY(69), 8, 14, 0)));
      }

      const o = (py * size + px) * 4;
      if (a <= 0) {
        png.data[o] = png.data[o + 1] = png.data[o + 2] = png.data[o + 3] = 0;
      } else {
        png.data[o] = Math.round(clamp(r / a, 0, 255));
        png.data[o + 1] = Math.round(clamp(g / a, 0, 255));
        png.data[o + 2] = Math.round(clamp(b / a, 0, 255));
        png.data[o + 3] = Math.round(clamp(a) * 255);
      }
    }
  }
  return png;
}

function save(name, png) {
  fs.writeFileSync(path.join(OUT, name), PNG.sync.write(png));
  console.log(`✓ ${name} (${png.width}x${png.height})`);
}

// Icono principal (iOS / Expo): fondo completo, sin transparencia
save('icon.png', renderLogo(1024, { bg: true }));

// Android adaptativo: la zona segura es ~66 % central, por eso el logo va reducido
save('android-icon-foreground.png', renderLogo(512, { scale: 0.64, glow: false }));
save('android-icon-monochrome.png', renderLogo(432, { scale: 0.64, mono: true }));
{
  const bgPng = new PNG({ width: 512, height: 512 });
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const t = clamp(Math.hypot(x - 256, y - 200) / 380);
      const c = mix(NAVY_MID, NAVY_DEEP, t);
      const o = (y * 512 + x) * 4;
      bgPng.data[o] = c[0];
      bgPng.data[o + 1] = c[1];
      bgPng.data[o + 2] = c[2];
      bgPng.data[o + 3] = 255;
    }
  }
  save('android-icon-background.png', bgPng);
}

// Pantalla de carga (se muestra sobre fondo #050A14 definido en app.json)
save('splash-icon.png', renderLogo(1024, { scale: 1 }));

// Favicon web
save('favicon.png', renderLogo(96, { bg: true }));

