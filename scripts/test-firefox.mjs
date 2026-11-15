#!/usr/bin/env node
// Smoke test for the Firefox build. Needs Firefox and Node 22 or later (global WebSocket).
// It starts a headless Firefox with a new, empty profile, installs the .xpi as a temporary
// add-on over WebDriver BiDi, opens a post, and reports the media info requests that the
// content script sends. The profile is not logged in, so Instagram may refuse the API call.
// Usage: node scripts/test-firefox.mjs [post URL]
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const xpi = join(root, 'dist', `insta-music-web-firefox-${version}.xpi`);
const url = process.argv[2] || 'https://www.instagram.com/p/DdoVXZ0kYVE/';
const port = 9339;

const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'imw-ff-'));
writeFileSync(join(profile, 'user.js'), [
  'user_pref("browser.shell.checkDefaultBrowser", false);',
  'user_pref("browser.aboutwelcome.enabled", false);',
  'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
  'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
].join('\n'));

const ff = spawn('firefox', ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port)], { stdio: ['ignore', 'ignore', 'pipe'] });
const cleanup = () => { ff.kill(); rmSync(profile, { recursive: true, force: true }); };
process.on('exit', cleanup);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Firefox did not start BiDi in 30 s')), 30000);
  ff.stderr.on('data', (d) => { if (String(d).includes('WebDriver BiDi listening')) { clearTimeout(timer); resolve(); } });
});

const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.type === 'error') reject(new Error(`${msg.error}: ${msg.message}`)); else resolve(msg.result);
  } else if (msg.type === 'event') {
    events.push(msg);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('session.new', { capabilities: {} });
const ext = await send('webExtension.install', { extensionData: { type: 'archivePath', path: xpi } });
console.log('installed:', ext.extension);
await send('session.subscribe', { events: ['network.beforeRequestSent', 'network.responseCompleted'] });
const { contexts } = await send('browsingContext.getTree', {});
const context = contexts[0].context;
await send('browsingContext.navigate', { context, url, wait: 'complete' });
await sleep(10000);

const evalResult = await send('script.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    path: location.pathname,
    bigImages: [...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width >= 200).length,
    layers: [...document.querySelectorAll('.imw-layer')].map((l) => l.textContent.trim() + ' | ' + l.dataset.state),
    // content.css applies only when Firefox injected the content scripts.
    cssInjected: (() => { const d = document.createElement('div'); d.className = 'imw-layer'; document.body.append(d); const p = getComputedStyle(d).position; d.remove(); return p === 'absolute'; })(),
    mains: document.querySelectorAll('main').length,
    articles: document.querySelectorAll('article').length,
    dialogs: document.querySelectorAll('[role=dialog]').length,
    viewport: innerWidth + 'x' + innerHeight,
  })`,
  target: { context },
  awaitPromise: false,
});
console.log('page:', evalResult.result?.value);

const header = (req, name) => req.headers.find((h) => h.name.toLowerCase() === name)?.value?.value;
const apiEvents = events.filter((e) => e.params?.request?.url?.includes('/api/v1/media/'));
for (const e of apiEvents) {
  const req = e.params.request;
  const path = new URL(req.url).pathname;
  if (e.method === 'network.beforeRequestSent') {
    console.log('request:', path, 'origin=', header(req, 'origin') ?? '(none)', 'app-id=', header(req, 'x-ig-app-id') ?? '(none)');
  } else {
    console.log('response:', path, 'status=', e.params.response.status);
  }
}
if (!apiEvents.length) console.log('no media info requests seen');

await send('browser.close').catch(() => {});
ws.close();
process.exit(apiEvents.length ? 0 : 1);
