/**
 * Re-encode the handful of LOCAL images the site ships, at the size they are
 * actually painted at, as WebP.
 *
 * Why this exists: Lighthouse on the live homepage (2026-09-15, simulated slow
 * 4G) reported LCP 6.3s and named `img.hero-logo` as the LCP element. That
 * element was a 900x250 PNG, 155 KB on disk, painted into a 249x69 box. The
 * hero collage was a 3200x2000 WebP, 156 KB, painted into 478x299. The pfp was
 * a 200x200 PNG, 80 KB, painted into 88x88.
 *
 * Targets are 2x the largest box each asset is painted in, which covers retina
 * and nothing more.
 *
 * `npm run logo` still owns logo.png as the SOURCE. This reads that source and
 * writes the optimized variant beside it, so regenerating the logo does not
 * silently undo this; re-run `npm run optimize:assets` after `npm run logo`.
 *
 * Needs cwebp (brew install webp).
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ASSETS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'app',
  'assets',
);

/** source, output, target width, quality. Height follows the aspect ratio. */
const JOBS = [
  // Painted at 249x69 in the hero, 173x48 in the header, 158x44 in the footer.
  {from: 'logo.png', to: 'logo.webp', width: 560, q: 90},
  // Painted at 478x299 in the hero stream frame.
  {from: 'hero-widgets.webp', to: 'hero-widgets-opt.webp', width: 1200, q: 80},
  // Painted at 88x88.
  {from: 'pfp.png', to: 'pfp.webp', width: 176, q: 88},
];

let before = 0;
let after = 0;

for (const job of JOBS) {
  const src = path.join(ASSETS, job.from);
  const out = path.join(ASSETS, job.to);
  if (!fs.existsSync(src)) {
    console.error(`missing source: ${job.from}`);
    process.exitCode = 1;
    continue;
  }
  execFileSync('cwebp', [
    '-q',
    String(job.q),
    '-resize',
    String(job.width),
    '0', // 0 height = keep the aspect ratio, never crop
    src,
    '-o',
    out,
  ]);
  const b = fs.statSync(src).size;
  const a = fs.statSync(out).size;
  before += b;
  after += a;
  const pct = Math.round((1 - a / b) * 100);
  console.log(
    `${job.from.padEnd(20)} ${String(b).padStart(7)} -> ${String(a).padStart(6)} bytes  (${pct}% smaller, ${job.width}px wide)  ${job.to}`,
  );
}

console.log(
  `\nTOTAL ${before} -> ${after} bytes, ${Math.round((1 - after / before) * 100)}% smaller, ${before - after} bytes saved on every first visit.`,
);
