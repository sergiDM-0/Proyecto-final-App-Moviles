// Prueba de rendimiento del motor 3D del simulador (proyección, recorte y construcción de polígonos).
// Uso: npm run bench
// Simula una conducción de 12 s por cada nivel (60 FPS) y mide cuánto tarda en calcular cada cuadro.
// Presupuesto de un cuadro a 60 FPS = 16.6 ms (en el celular el cómputo debe ocupar una fracción pequeña).
import { buildWorld3D, SCENARIOS } from '../src/lib/maneuvers-world.ts';

const FRAMES = 720;
const DT = 1 / 60;

function percentile(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

let totalAvg = 0;
console.log('Benchmark de buildWorld3D (cálculo del mundo 3D por cuadro)\n');
console.log('Nivel'.padEnd(26), 'media'.padStart(8), 'p95'.padStart(8), 'máx'.padStart(8), 'polígonos'.padStart(11));

for (const sc of SCENARIOS) {
  let x = sc.startX;
  let y = sc.startY;
  let angle = (sc.startAngleDeg * Math.PI) / 180;
  const tracks: { x: number; y: number; angleRad: number }[] = [];
  const times: number[] = [];
  let polys = 0;

  // Calentamiento del JIT
  for (let i = 0; i < 120; i++) {
    buildWorld3D({ x, y, angleRad: angle, camBobY: 0, camPitch: 0, camYawOff: 0 }, sc, tracks, []);
  }

  for (let f = 0; f < FRAMES; f++) {
    const speed = 70;
    angle += Math.sin(f * 0.02) * 0.9 * DT;
    x = Math.max(120, Math.min(1080, x + Math.cos(angle) * speed * DT));
    y = Math.max(120, Math.min(800, y + Math.sin(angle) * speed * DT));
    if (f % 10 === 0) tracks.push({ x, y, angleRad: angle });
    if (tracks.length > 29) tracks.shift();

    const t0 = performance.now();
    const w = buildWorld3D(
      { x, y, angleRad: angle, camBobY: Math.sin(f * 0.3) * 0.4, camPitch: Math.sin(f * 0.05) * 2, camYawOff: 0.01 },
      sc,
      tracks,
      []
    );
    times.push(performance.now() - t0);
    polys =
      w.groundTiles.length +
      w.curbBoxes.length +
      w.whiteLaneDashes.length +
      w.yellowArrows.length +
      w.projectedTracks.length +
      w.headlightBeams.length +
      w.renderItems.reduce((n, it) => n + (it.faces ? it.faces.length : 1), 0);
  }

  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  totalAvg += avg;
  console.log(
    sc.shortLabel.padEnd(26),
    `${avg.toFixed(3)} ms`.padStart(8),
    `${percentile(sorted, 95).toFixed(3)}`.padStart(8),
    `${sorted[sorted.length - 1].toFixed(3)}`.padStart(8),
    String(polys).padStart(11)
  );
}

const overall = totalAvg / SCENARIOS.length;
console.log(`\nMedia global: ${overall.toFixed(3)} ms por cuadro (${((overall / 16.6) * 100).toFixed(1)}% del presupuesto de 60 FPS)`);

