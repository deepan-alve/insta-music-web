#!/usr/bin/env node
// Renders the store images from store/src/frame.html with headless Chrome.
// Output: store/screenshot-1..3.png, store/promo-small.png, store/promo-marquee.png
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frame = pathToFileURL(join(root, 'store/src/frame.html')).href;
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find((c) => {
  try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; }
});
if (!chrome) throw new Error('needs google-chrome or chromium');
for (const p of ['photo-rooftop.jpg', 'photo-beach.jpg']) {
  if (!existsSync(join(root, 'store/src', p))) throw new Error(`missing store/src/${p}`);
}

const shots = [
  ['shot1', 1280, 800, 'screenshot-1.png'],
  ['shot2', 1280, 800, 'screenshot-2.png'],
  ['shot3', 1280, 800, 'screenshot-3.png'],
  ['promo', 440, 280, 'promo-small.png'],
  ['marquee', 1400, 560, 'promo-marquee.png'],
];

// A throwaway profile keeps this away from the user's own Chrome profile.
const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'postsound-shot-'));
try {
  for (const [scene, w, h, file] of shots) {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--allow-file-access-from-files', `--user-data-dir=${profile}`,
      `--window-size=${w},${h}`, '--virtual-time-budget=3000',
      `--screenshot=${join(root, 'store', file)}`, `${frame}#${scene}`,
    ], { stdio: 'ignore' });
    console.log(`store/${file} (${w} x ${h})`);
  }
} finally {
  rmSync(profile, { recursive: true, force: true });
}
