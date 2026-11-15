#!/usr/bin/env node
// End-to-end test of the Firefox build over WebDriver BiDi. Needs Firefox and Node 22 or later.
//
//   node scripts/firefox-smoke.mjs                 headless, empty profile, logged out
//   node scripts/firefox-smoke.mjs --login DIR     visible window, profile kept in DIR.
//                                                  Log in to Instagram in that window once.
//   add --block-autoplay                           Firefox blocks autoplay. The test then expects
//                                                  the pulsing button and plays after a click.
//
// Logged out, it checks that the add-on installs and sends one media info request per post.
// Logged in, it also checks the song pill, real clicks on the sound button, and the feed.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const xpi = join(root, 'dist', `postsound-firefox-${version}.xpi`);
const POST = 'https://www.instagram.com/p/DdoVXZ0kYVE/'; // carousel with "Oh, What A World"
const SONG = 'Oh, What A World';
const port = 9339;

const blockAutoplay = process.argv.includes('--block-autoplay');
const loginIdx = process.argv.indexOf('--login');
const loginDir = loginIdx > 0 ? resolve(process.argv[loginIdx + 1] || '') : null;
const profile = loginDir || mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'postsound-ff-'));
mkdirSync(profile, { recursive: true });
// A killed test window can leave a pending cache reset. Firefox then restarts itself and
// drops the remote debugging flag, so clear it before every start.
try {
  const compat = join(profile, 'compatibility.ini');
  writeFileSync(compat, readFileSync(compat, 'utf8').replace(/^InvalidateCaches=1\n?/m, ''));
} catch { /* new profile */ }
writeFileSync(join(profile, 'user.js'), [
  'user_pref("browser.shell.checkDefaultBrowser", false);',
  'user_pref("browser.aboutwelcome.enabled", false);',
  'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
  'user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);',
  'user_pref("browser.startup.homepage_override.mstone", "ignore");',
  // A killed test window counts as a startup crash. After a few, Firefox restarts into a
  // Troubleshoot Mode prompt and drops the remote debugging flag. Turn that check off.
  'user_pref("toolkit.startup.max_resumed_crashes", -1);',
  'user_pref("toolkit.startup.recent_crashes", 0);',
  'user_pref("browser.sessionstore.resume_from_crash", false);',
  // --block-autoplay: Firefox blocks all autoplay, as on a fresh visit before any click.
  `user_pref("media.autoplay.default", ${blockAutoplay ? 5 : 1});`,
].join('\n'));

const args = ['--no-remote', '--new-instance', '--profile', profile, '--remote-debugging-port', String(port)];
if (!loginDir) args.unshift('--headless');
const ff = spawn('firefox', args, { stdio: ['ignore', 'pipe', 'pipe'] });
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
process.on('exit', () => {
  // Firefox can ignore SIGTERM while it starts. SIGKILL makes sure no test window is left.
  try { ff.kill('SIGKILL'); } catch { /* already gone */ }
  if (!loginDir) rmSync(profile, { recursive: true, force: true });
});

await new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('Firefox did not start BiDi in 30 s')), 30000);
  const onOutput = (d) => {
    const text = String(d);
    if (text.includes('WebDriver BiDi listening')) { clearTimeout(timer); res(); }
    if (text.includes('already running')) {
      clearTimeout(timer);
      rej(new Error(`Another Firefox uses the profile ${profile}. Close that window and run again.`));
    }
    if (process.env.FF_DEBUG) process.stderr.write(`[firefox] ${text}`);
  };
  // Firefox writes the BiDi line to stderr or stdout, depending on how it starts.
  ff.stdout.on('data', onOutput);
  ff.stderr.on('data', onOutput);
});

// ---------- BiDi client ----------
const ws = new WebSocket(`ws://127.0.0.1:${port}/session`);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
const events = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.type === 'error') rej(new Error(`${msg.error}: ${msg.message}`)); else res(msg.result);
  } else if (msg.type === 'event') {
    events.push(msg);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('session.new', { capabilities: {} });
const installed = await send('webExtension.install', { extensionData: { type: 'archivePath', path: xpi } });
await send('session.subscribe', { events: ['network.beforeRequestSent', 'network.responseCompleted'] });
const { contexts } = await send('browsingContext.getTree', {});
const context = contexts[0].context;

async function evaluate(expression) {
  const r = await send('script.evaluate', { expression, target: { context }, awaitPromise: true });
  if (r.type === 'exception') throw new Error(r.exceptionDetails?.text || 'script error');
  return r.result?.value;
}
const json = async (expression) => JSON.parse(await evaluate(`JSON.stringify(${expression})`));
// Postsound pauses in hidden tabs on purpose. A test window behind other windows counts as
// hidden, so bring the tab to the front after every page load.
async function go(url) {
  await send('browsingContext.navigate', { context, url, wait: 'complete' });
  await send('browsingContext.activate', { context }).catch(() => {});
}

async function waitFor(expression, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return true;
    await sleep(500);
  }
  return false;
}

// A real mouse click, so the browser counts it as a user gesture.
async function click(selector) {
  const box = await json(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();
    return r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null; })()`);
  if (!box) throw new Error(`nothing to click at ${selector}`);
  await send('input.performActions', {
    context,
    actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
      { type: 'pointerMove', x: box.x, y: box.y, origin: 'viewport' },
      { type: 'pointerDown', button: 0 },
      { type: 'pointerUp', button: 0 },
    ] }],
  });
}

const results = [];
// One line of overlay state, for the log: data-state and the sound button label.
async function snap(tag) {
  const v = await json('[...document.querySelectorAll(".ps-layer")].map((l) => l.dataset.state + "/" + l.querySelector(".ps-btn")?.getAttribute("aria-label") + (l.dataset.active === "true" ? "/active" : "") + (l.dataset.error ? "/" + l.dataset.error : ""))');
  const vis = await evaluate('document.visibilityState');
  console.log(`      ${tag}: ${v.join(', ') || 'no overlay'} [tab ${vis}]`);
}
function check(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

console.log(`installed ${installed.extension} from ${xpi.replace(root + '/', '')}`);

// ---------- login ----------
let loggedIn = false;
if (loginDir) {
  await go('https://www.instagram.com/');
  loggedIn = await evaluate('document.cookie.includes("ds_user_id")');
  if (!loggedIn) {
    console.log('Log in to Instagram in the Firefox window. Waiting up to 15 minutes.');
    loggedIn = await waitFor('document.cookie.includes("ds_user_id")', 15 * 60 * 1000);
  }
  check('logged in to Instagram', loggedIn);
}

// ---------- post page ----------
events.length = 0;
await go(POST);
await sleep(loggedIn ? 2000 : 8000);
if (loggedIn) {
  const shown = await waitFor('document.querySelector(".ps-layer")', 15000);
  const pill = await json('document.querySelector(".ps-pill")?.textContent.trim() ?? null');
  check('post page shows the song pill', shown && pill?.includes(SONG), pill ?? 'no pill');

  // A navigation is not a user gesture, so the browser may block sound until a click.
  await snap('loaded');
  if (await evaluate('document.hidden')) {
    console.log('The test tab is hidden, so Postsound stays silent on purpose. Bring the Firefox window to the front and run again.');
  }
  // The add-on remembers the sound setting, also across test runs. Start from sound on.
  const startOff = await json('(() => { const l = document.querySelector(".ps-layer"); return l?.dataset.state === "idle" && l.querySelector(".ps-btn").getAttribute("aria-label") === "Play music"; })()');
  if (startOff) {
    await click('.ps-btn');
    await sleep(1500);
    await snap('turned the saved setting back on');
  }
  const first = await json('document.querySelector(".ps-layer")?.dataset.state');
  if (blockAutoplay) check('first state waits for a click when autoplay is blocked', first === 'blocked', first);
  else check('first state is playing or waiting for a click', ['playing', 'blocked'].includes(first), first);
  if (first === 'blocked') {
    await click('.ps-btn');
    await sleep(1500);
  }
  check('plays after a click', await waitFor('document.querySelector(".ps-layer")?.dataset.state === "playing"', 5000));

  await click('.ps-btn');
  await sleep(800);
  const muted = await json('({ s: document.querySelector(".ps-layer").dataset.state, l: document.querySelector(".ps-btn").getAttribute("aria-label") })');
  check('sound button mutes', muted.s === 'idle' && muted.l === 'Play music', JSON.stringify(muted));
  check('mute does not open or change the post', (await evaluate('location.pathname')) === new URL(POST).pathname);

  await click('.ps-btn');
  check('sound button unmutes', await waitFor('document.querySelector(".ps-layer")?.dataset.state === "playing"', 5000));

  // The carousel arrow must keep the overlay on screen.
  const next = await evaluate('Boolean(document.querySelector("button[aria-label=Next]"))');
  if (next) {
    await snap('before carousel Next');
    await click('button[aria-label=Next]');
    await sleep(1200);
    await snap('after carousel Next');
    check('overlay stays after a carousel swipe', await evaluate('Boolean(document.querySelector(".ps-layer"))'));
  }
}
const apiCalls = events.filter((e) => e.method === 'network.beforeRequestSent' && e.params.request.url.includes('/api/v1/media/'));
check('sends media info requests', apiCalls.length > 0, `${apiCalls.length} request(s)`);
const appIdSent = apiCalls.every((e) => e.params.request.headers.some((h) => h.name.toLowerCase() === 'x-ig-app-id'));
check('requests carry the app id header', apiCalls.length > 0 && appIdSent);
if (!loggedIn) {
  const loginHits = events.filter((e) => e.method === 'network.beforeRequestSent' && e.params.request.url.includes('/accounts/login/') &&
    e.params.request.headers.some((h) => h.name.toLowerCase() === 'x-ig-app-id'));
  check('does not follow the login redirect', loginHits.length === 0);
  await sleep(4000);
  const again = events.filter((e) => e.method === 'network.beforeRequestSent' && e.params.request.url.includes('/api/v1/media/')).length;
  check('does not retry a refused post', again === apiCalls.length, `${again} request(s) after 4 s more`);
}

// ---------- feed ----------
if (loggedIn) {
  await go('https://www.instagram.com/');
  await sleep(3000);
  // Scroll until a post with a song shows up.
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    await evaluate('window.scrollBy(0, 600)');
    await sleep(1300);
    found = await evaluate('Boolean(document.querySelector(".ps-layer"))');
  }
  const song = found ? await json('document.querySelector(".ps-layer .ps-marquee").textContent') : null;
  check('feed shows a song pill', found, song ?? 'none in 30 scrolls');
  if (found) {
    await evaluate('document.querySelector(".ps-layer").parentElement.scrollIntoView({ block: "center" })');
    await sleep(2500);
    await snap('feed post centered');
    console.log('      diag:', await evaluate(`JSON.stringify({
      viewport: innerWidth + 'x' + innerHeight,
      dialogs: [...document.querySelectorAll('div[role=dialog]')].map((d) => d.innerText.slice(0, 40)),
      box: (() => { const r = document.querySelector('.ps-layer').parentElement.getBoundingClientRect(); return [r.top, r.height].map(Math.round); })(),
      videos: [...document.querySelectorAll('video')].map((v) => { const r = v.getBoundingClientRect(); return { paused: v.paused, muted: v.muted, vol: v.volume, top: Math.round(r.top), h: Math.round(r.height) }; }).filter((v) => v.top < innerHeight && v.top + v.h > 0),
    })`));
    const state = await json('document.querySelector(".ps-layer").dataset.state');
    if (blockAutoplay) check('centered feed post waits for a click when autoplay is blocked', state === 'blocked', state);
    else check('centered feed post plays or waits for a click', ['playing', 'blocked'].includes(state), state);
    if (state === 'blocked') await click('.ps-layer .ps-btn');
    check('centered feed post plays', await waitFor('document.querySelector(".ps-layer")?.dataset.state === "playing"', 5000));
    await snap('feed post after click');
    await evaluate('window.scrollBy(0, innerHeight * 1.5)');
    await sleep(1500);
    await snap('scrolled away');
    const after = await json('[...document.querySelectorAll(".ps-layer")].filter((l) => { const r = l.getBoundingClientRect(); return r.bottom < 0 || r.top > innerHeight; }).map((l) => l.dataset.state)');
    check('song stops after scrolling away', after.every((s) => s !== 'playing'), JSON.stringify(after));
  }
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
await send('browser.close').catch(() => {});
ws.close();
process.exit(failed ? 1 : 0);
