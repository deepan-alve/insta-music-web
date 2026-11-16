#!/usr/bin/env node
// End-to-end test of the extension in Chromium against a mocked instagram.com.
// No login and no network: Playwright serves the post page, the feed, the media API,
// the cover image and a generated audio file. It covers the overlay, the popup,
// blocked autoplay, the About page and phone widths.
//
// Needs the playwright package and a Playwright Chromium (branded Chrome cannot load
// unpacked extensions from the command line any more).
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/e2e-chromium.mjs
//   CHROMIUM_PATH=/path/to/chrome   (optional; else Playwright's own Chromium)
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { shortcodeToPk } = require(join(root, 'music.js'));

// ---------- mock Instagram ----------

const SONG = { title: 'Late Light', artist: 'Sunday Static' };
const POSTS = {
  // code: song or null
  TESTPOSTAAA: SONG,
  TESTPOSTBBB: { title: 'Tidelines', artist: 'Marlowe Bay' },
  TESTPOSTCCC: null,
};
const AUDIO_URL = 'https://scontent.cdninstagram.com/mock/song.wav';
const COVER_URL = 'https://scontent.cdninstagram.com/mock/cover.svg';

function wav(seconds = 4, rate = 8000) {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 3000), 44 + i * 2);
  return buf;
}
const AUDIO = wav();

const photo = (hue) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="470" height="587"><rect width="470" height="587" fill="hsl(${hue} 50% 60%)"/></svg>`)}`;

function article(code, hue) {
  return `<article style="width:470px;margin:0 auto 40px;background:#000">
    <header style="height:56px;color:#fff"><a href="/someone/">someone</a> <a href="/p/${code}/">1d</a></header>
    <div style="position:relative"><div style="position:relative;width:470px;height:587px"><img src="${photo(hue)}" width="470" height="587" alt=""></div></div>
    <div style="height:90px"><a href="/p/${code}/liked_by/">likes</a></div>
  </article>`;
}

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><title>Instagram</title></head>
<body style="margin:0;background:#111;font-family:sans-serif">${body}</body></html>`;

const FEED = page(`<main role="main" style="padding-top:40px">
  ${article('TESTPOSTCCC', 200)}${article('TESTPOSTAAA', 20)}${article('TESTPOSTBBB', 300)}
  <div style="height:1400px"></div></main>`);
const POST_PAGE = (code) => page(`<main role="main"><div style="display:flex;gap:0;width:800px;margin:40px auto">
  <div style="position:relative;width:470px;height:587px"><img src="${photo(20)}" width="470" height="587" alt=""></div>
  <div style="width:330px;color:#fff"><a href="/p/${code}/liked_by/">likes</a></div></div></main>`);

function mediaInfo(code) {
  const song = POSTS[code];
  return {
    items: [{
      code,
      media_type: 8,
      music_metadata: song ? {
        music_info: {
          music_asset_info: { title: song.title, display_artist: song.artist, cover_artwork_thumbnail_uri: COVER_URL, progressive_download_url: AUDIO_URL },
          music_consumption_info: { audio_asset_start_time_in_ms: 500, overlap_duration_in_ms: 3000, should_mute_audio: false },
        },
      } : null,
    }],
  };
}
const byPk = Object.fromEntries(Object.keys(POSTS).map((c) => [shortcodeToPk(c), c]));

async function mockInstagram(context) {
  await context.route('https://www.instagram.com/**', (route) => {
    const url = new URL(route.request().url());
    const api = url.pathname.match(/^\/api\/v1\/media\/(\d+)\/info\/$/);
    if (api) {
      const code = byPk[api[1]];
      return code
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mediaInfo(code)) })
        : route.fulfill({ status: 404, body: '' });
    }
    const post = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/$/);
    if (post) return route.fulfill({ status: 200, contentType: 'text/html', body: POST_PAGE(post[1]) });
    if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: FEED });
    return route.fulfill({ status: 404, body: '' });
  });
  await context.route('https://scontent.cdninstagram.com/**', (route) => {
    const u = route.request().url();
    if (u === AUDIO_URL) return route.fulfill({ status: 200, contentType: 'audio/wav', body: AUDIO, headers: { 'accept-ranges': 'none' } });
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#e85"/></svg>' });
  });
}

// ---------- harness ----------

const results = [];
function check(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(autoplay) {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'postsound-e2e-'));
  const context = await chromium.launchPersistentContext(dir, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`, `--autoplay-policy=${autoplay}`],
  });
  await mockInstagram(context);
  const probe = await context.newPage();
  await probe.goto('chrome://extensions');
  const id = await probe.evaluate(async () => (await chrome.management.getAll()).find((e) => e.name.startsWith('Postsound'))?.id);
  await probe.close();
  return { context, id, cleanup: async () => { await context.close(); rmSync(dir, { recursive: true, force: true }); } };
}

const layer = (p, sel = '.ps-layer') => p.evaluate((s) => {
  const l = document.querySelector(s);
  return l ? { state: l.dataset.state, text: l.querySelector('.ps-marquee')?.textContent, btn: l.querySelector('.ps-btn')?.getAttribute('aria-label') } : null;
}, sel);

async function waitState(p, state, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await layer(p))?.state === state) return true;
    await sleep(150);
  }
  return false;
}

// ---------- run 1: autoplay allowed ----------
{
  const { context, id, cleanup } = await launch('no-user-gesture-required');
  const ig = await context.newPage();
  const errors = [];
  ig.on('pageerror', (e) => errors.push(e.message));
  await ig.goto('https://www.instagram.com/p/TESTPOSTAAA/');
  check('post page shows the song pill', await waitState(ig, 'playing', 8000), JSON.stringify(await layer(ig)));
  check('pill shows title and artist', (await layer(ig))?.text === `${SONG.title} · ${SONG.artist}`);

  // The note icon shows only when a song has no cover, so it is checked only when present.
  const icons = await ig.evaluate(() => ['.ps-btn svg', '.ps-note svg'].map((s, i) => {
    const n = document.querySelector(s);
    if (!n) return i > 0;
    const r = n.getBoundingClientRect();
    return n.children.length > 0 && r.width > 0 && r.height > 0;
  }));
  check('sound button icon draws', icons.every(Boolean), JSON.stringify(icons));

  await ig.click('.ps-btn');
  await sleep(500);
  const muted = await layer(ig);
  check('sound button mutes', muted.state === 'idle' && muted.btn === 'Play music', JSON.stringify(muted));
  await ig.click('.ps-btn');
  check('sound button unmutes', await waitState(ig, 'playing'));

  // Popup page in a second tab. ?tab=any makes it find the Instagram tab.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 400 });
  await popup.goto(`chrome-extension://${id}/popup.html?tab=any`);
  await popup.waitForFunction(() => document.getElementById('now').dataset.mode !== 'off-site', null, { timeout: 5000 }).catch(() => {});
  const card = await popup.evaluate(() => ({ mode: now.dataset.mode, title: document.getElementById('title').textContent }));
  check('popup shows the song that plays', card.mode === 'playing' && card.title === SONG.title, JSON.stringify(card));

  await popup.click('#action');
  check('popup pause stops the song on the page', await waitState(ig, 'idle'));
  await popup.click('#action');
  check('popup play starts it again', await waitState(ig, 'playing'));

  await popup.click('label[for="sound"]');
  check('popup switch turns the sound off', await waitState(ig, 'idle'));
  check('page button follows the switch', (await layer(ig)).btn === 'Play music');
  await popup.click('label[for="sound"]');
  check('popup switch turns it back on', await waitState(ig, 'playing'));

  await popup.evaluate(() => { const v = document.getElementById('volume'); v.value = '40'; v.dispatchEvent(new Event('input')); });
  await sleep(300);
  await popup.reload();
  await sleep(500);
  check('popup keeps the volume', (await popup.inputValue('#volume')) === '40');
  await popup.evaluate(() => { const v = document.getElementById('volume'); v.value = '100'; v.dispatchEvent(new Event('input')); });

  const offsite = await context.newPage();
  await offsite.goto(`chrome-extension://${id}/popup.html`);
  await sleep(500);
  check('popup outside Instagram offers to open it', (await offsite.evaluate(() => now.dataset.mode)) === 'off-site');
  await offsite.close();
  await popup.close();

  // Feed: the post nearest the middle plays, the post without a song gets no pill.
  await ig.goto('https://www.instagram.com/');
  await ig.evaluate(() => document.querySelectorAll('article')[1].scrollIntoView({ block: 'center' }));
  await sleep(2500);
  const feed = await ig.evaluate(() => [...document.querySelectorAll('article')].map((a) => a.querySelector('.ps-layer')?.dataset.state ?? 'none'));
  check('feed plays the centred post only', feed[1] === 'playing' && feed[0] === 'none', JSON.stringify(feed));
  await ig.evaluate(() => document.querySelectorAll('article')[2].scrollIntoView({ block: 'center' }));
  await sleep(2500);
  const feed2 = await ig.evaluate(() => [...document.querySelectorAll('article')].map((a) => a.querySelector('.ps-layer')?.dataset.state ?? 'none'));
  check('scrolling hands the song to the next post', feed2[2] === 'playing' && feed2[1] !== 'playing', JSON.stringify(feed2));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await cleanup();
}

// ---------- run 2: autoplay blocked until a click ----------
{
  const { context, cleanup } = await launch('user-gesture-required');
  const ig = await context.newPage();
  await ig.goto('https://www.instagram.com/p/TESTPOSTAAA/');
  const first = (await waitState(ig, 'blocked', 6000)) ? 'blocked' : (await layer(ig))?.state;
  if (first === 'blocked') {
    check('blocked autoplay shows click to play', true);
    check('hint text is visible', await ig.isVisible('.ps-hint'));
    await ig.mouse.click(5, 5);
    check('one click anywhere on the page starts the song', await waitState(ig, 'playing'));
  } else {
    // Some Chromium builds let extensions start audio without a click. Firefox covers this path:
    // node scripts/firefox-smoke.mjs --login DIR --block-autoplay
    console.log(`SKIP  blocked autoplay: this Chromium allowed playback (${first})`);
  }
  await cleanup();
}

// ---------- run 3: About page and phone widths ----------
{
  const { context, id, cleanup } = await launch('no-user-gesture-required');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const about = await context.newPage();
  await about.goto(`chrome-extension://${id}/about.html`);
  const info = await about.evaluate(() => ({
    support: !document.getElementById('support-btn').hidden,
    soon: !document.getElementById('support-soon').hidden,
    mail: document.getElementById('mail-link').textContent,
    ver: document.getElementById('version').textContent,
  }));
  check('about page fills version and contact', info.ver.startsWith('v') && info.mail.includes('@'), JSON.stringify(info));
  check('support button follows config', info.support !== info.soon);

  await about.click('#copy');
  // The label changes after the clipboard write resolves, so wait for it.
  const copied = await about.waitForFunction(() => document.getElementById('copy-label').textContent === 'Copied', null, { timeout: 3000 }).then(() => true, () => false);
  check('copy button confirms', copied, await about.textContent('#copy-label'));

  await about.fill('#post', 'https://example.com/x');
  await about.click('#report-form button[type="submit"]');
  check('bad post link shows an error', await about.isVisible('#post-error'));
  await about.fill('#post', 'https://www.instagram.com/p/TESTPOSTAAA/');
  check('fixing the link clears the error', !(await about.isVisible('#post-error')));

  for (const width of [320, 375, 414, 768]) {
    await about.setViewportSize({ width, height: 900 });
    const overflow = await about.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`about page has no sideways scroll at ${width}px`, overflow <= 0, `${overflow}px`);
  }
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 320, height: 400 });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  const wraps = await popup.evaluate(() => [...document.querySelectorAll('.links a')].filter((a) => a.getClientRects().length > 1 || a.scrollWidth > a.clientWidth).map((a) => a.textContent));
  check('popup links stay on one line', wraps.length === 0, wraps.join(', '));
  await cleanup();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
