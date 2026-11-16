#!/usr/bin/env node
// Builds the store packages from the files in the repo root.
// Output: dist/chrome/, dist/firefox/, dist/postsound-chrome-<v>.zip, dist/postsound-firefox-<v>.xpi
// The repo root stays loadable in Chrome as it is. Firefox needs extra manifest keys.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const base = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

// Every file the extension uses, and nothing else.
const files = [
  'music.js', 'content.js', 'content.css',
  'config.js', 'tokens.css',
  'popup.html', 'popup.css', 'popup.js',
  'about.html', 'about.css', 'about.js',
  'fonts/Geist-Variable.woff2', 'fonts/OFL-Geist.txt', 'icons/LICENSE-lucide.txt', 'brand/sticker.webp',
  ...Object.values(base.icons),
];

const targets = {
  chrome: { manifest: base, archive: `postsound-chrome-${base.version}.zip` },
  firefox: {
    manifest: {
      ...base,
      browser_specific_settings: {
        gecko: {
          id: 'postsound@deepanalve.dev',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    },
    archive: `postsound-firefox-${base.version}.xpi`,
  },
};

for (const f of files) {
  if (!existsSync(join(root, f))) throw new Error(`missing file: ${f}`);
}
// Every file that the manifest or popup names must ship.
const refs = [
  ...base.content_scripts.flatMap((c) => [...c.js, ...c.css]),
  base.action.default_popup,
  base.options_ui.page,
  ...Object.values(base.action.default_icon),
];
// Local files that the HTML pages load with src or href.
for (const page of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(join(root, page), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) refs.push(ref);
}
// Files that the stylesheets load with url().
for (const sheet of files.filter((f) => f.endsWith('.css'))) {
  const css = readFileSync(join(root, sheet), 'utf8');
  for (const [, ref] of css.matchAll(/url\("?([^")#:]+)"?\)/g)) refs.push(ref);
}
for (const ref of refs) {
  if (!files.includes(ref)) throw new Error(`${ref} is used but the build does not ship it`);
}

rmSync(dist, { recursive: true, force: true });
for (const [name, { manifest, archive }] of Object.entries(targets)) {
  const out = join(dist, name);
  for (const f of files) {
    mkdirSync(dirname(join(out, f)), { recursive: true });
    cpSync(join(root, f), join(out, f));
  }
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // -X drops extra file attributes. Paths in the archive start at the extension root.
  execFileSync('zip', ['-qrX', join(dist, archive), '.'], { cwd: out });
  const kb = (statSync(join(dist, archive)).size / 1024).toFixed(1);
  console.log(`${name}: dist/${archive} (${kb} KB)`);
}
