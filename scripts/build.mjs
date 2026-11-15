#!/usr/bin/env node
// Builds dist/chrome and dist/firefox from the files in the repo root, then zips each one.
// The root folder stays loadable in Chrome as it is. Firefox needs extra manifest keys.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const files = ['content.js', 'content.css', 'icons/icon48.png', 'icons/icon128.png'];
const base = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

const targets = {
  chrome: { manifest: base, archive: `insta-music-web-chrome-${base.version}.zip` },
  firefox: {
    manifest: {
      ...base,
      browser_specific_settings: {
        gecko: {
          id: 'insta-music-web@deepanalve.dev',
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    },
    archive: `insta-music-web-firefox-${base.version}.xpi`,
  },
};

rmSync(dist, { recursive: true, force: true });
for (const [name, { manifest, archive }] of Object.entries(targets)) {
  const out = join(dist, name);
  mkdirSync(join(out, 'icons'), { recursive: true });
  for (const f of files) cpSync(join(root, f), join(out, f));
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // -X drops extra file attributes. Paths in the archive start at the extension root.
  execFileSync('zip', ['-qrX', join(dist, archive), '.'], { cwd: out });
  console.log(`${name}: dist/${name}/ and dist/${archive}`);
}
