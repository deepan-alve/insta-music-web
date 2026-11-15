// Toolbar popup: what plays now, the on/off switch, the volume, and links to the About page.
const ext = globalThis.browser ?? globalThis.chrome;
const config = globalThis.POSTSOUND_CONFIG;
const $ = (id) => document.getElementById(id);

const now = $('now');
const sound = $('sound');
const volume = $('volume');
const volumeOut = $('volume-out');
const action = $('action');

$('version').textContent = `v${ext.runtime.getManifest().version}`;

// ---------- settings ----------

function showVolume(v) {
  const pct = Math.round(v * 100);
  volume.value = String(pct);
  volume.style.setProperty('--fill', `${pct}%`);
  volumeOut.textContent = `${pct}%`;
}

ext.storage.local.get({ soundOn: true, volume: 1 }).then((v) => {
  sound.checked = v.soundOn !== false;
  showVolume(Number.isFinite(v.volume) ? v.volume : 1);
  volume.disabled = !sound.checked;
});

sound.addEventListener('change', () => {
  ext.storage.local.set({ soundOn: sound.checked });
  volume.disabled = !sound.checked;
  setTimeout(refresh, 150);
});

volume.addEventListener('input', () => {
  const v = Number(volume.value) / 100;
  showVolume(v);
  ext.storage.local.set({ volume: v });
});

// ---------- now playing ----------

let tabId = null;
let mode = 'off-site';

async function activeTab() {
  // Tests open the popup as a page with ?tab=any. Then it uses the first tab that answers.
  if (new URLSearchParams(location.search).get('tab') === 'any') {
    for (const tab of await ext.tabs.query({ currentWindow: true })) {
      try {
        if (await ext.tabs.sendMessage(tab.id, { type: 'postsound:status' })) return tab;
      } catch { /* not an Instagram tab */ }
    }
  }
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// The content script answers only on instagram.com, so no answer means another site.
async function askTab(type) {
  if (tabId == null) return null;
  try {
    return await ext.tabs.sendMessage(tabId, { type });
  } catch {
    return null;
  }
}

function render(st) {
  const art = $('art');
  if (!st) {
    mode = 'off-site';
    $('label').textContent = 'Not on Instagram';
    $('title').textContent = 'Open Instagram';
    $('artist').textContent = 'Songs play on photo posts';
    action.setAttribute('aria-label', 'Open Instagram');
  } else if (!st.song) {
    mode = 'empty';
    $('label').textContent = st.soundOn ? 'Listening' : 'Sound is off';
    $('title').textContent = 'No song on screen';
    $('artist').textContent = 'Scroll to a photo post with music';
    action.setAttribute('aria-label', 'No song to play');
  } else {
    mode = st.blocked ? 'blocked' : st.playing ? 'playing' : 'ready';
    $('label').textContent = st.blocked ? 'Click the page once to allow sound'
      : st.playing ? 'Now playing' : 'Paused';
    $('title').textContent = st.song.title;
    $('artist').textContent = st.song.artist;
    action.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
  }
  now.dataset.mode = mode;
  action.disabled = mode === 'empty';
  const cover = st?.song?.cover;
  art.classList.toggle('has-cover', Boolean(cover));
  art.style.backgroundImage = cover ? `url("${cover.replace(/"/g, '%22')}")` : '';
}

async function refresh() {
  render(await askTab('postsound:status'));
}

action.addEventListener('click', async () => {
  if (mode === 'off-site') {
    await ext.tabs.create({ url: config.instagram });
    window.close();
    return;
  }
  const st = await askTab('postsound:toggle');
  if (st) {
    sound.checked = st.soundOn;
    volume.disabled = !st.soundOn;
  }
  render(st);
});

(async () => {
  tabId = (await activeTab())?.id ?? null;
  await refresh();
  // Keep the card current while the popup is open, for example when the song changes.
  setInterval(refresh, 1000);
})();

// ---------- links ----------

for (const a of document.querySelectorAll('[data-page]')) {
  a.addEventListener('click', (ev) => {
    ev.preventDefault();
    ext.tabs.create({ url: ext.runtime.getURL(a.dataset.page) });
    window.close();
  });
}
