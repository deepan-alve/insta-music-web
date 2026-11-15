// Insta Music Web: plays the song attached to Instagram photo and carousel posts.
// The web feed data has no song info for photos. The media info API has it,
// so we fetch it per visible post and play the clip with one shared <audio>.
(() => {
  if (window.__imwLoaded) return;
  window.__imwLoaded = true;

  const APP_ID = '936619743392459'; // Instagram web app id, sent by instagram.com itself.
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const MIN_MEDIA = 200; // px. Smaller images are avatars or thumbnails.
  const ACTIVE_RATIO = 0.5; // share of the media that must be on screen to play.
  const FADE_MS = 250;

  const ext = globalThis.browser ?? globalThis.chrome;
  const store = ext?.storage?.local;
  // Firefox runs content script fetches as the extension. content.fetch runs them as the page,
  // so Instagram gets its own origin and cookies. Chrome already does that with plain fetch.
  const pageFetch = typeof globalThis.content?.fetch === 'function'
    ? globalThis.content.fetch.bind(globalThis.content)
    : globalThis.fetch.bind(globalThis);
  const musicCache = new Map(); // shortcode -> Promise<music | null>
  const posts = new Map(); // root element -> post state
  const fetchQueue = [];
  let fetching = false;

  let soundOn = true;
  let blocked = false; // browser refused autoplay until the user interacts
  let active = null; // post state that owns the audio
  let fadeRaf = 0;

  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0;

  // ---------- data ----------

  function shortcodeToPk(code) {
    let n = 0n;
    for (const ch of code.slice(0, 11)) n = n * 64n + BigInt(ALPHABET.indexOf(ch));
    return n.toString();
  }

  function parseMusic(item) {
    if (!item || item.media_type === 2) return null; // videos and reels carry their own audio
    const mm = item.music_metadata;
    const info = mm?.music_info;
    const asset = info?.music_asset_info;
    const use = info?.music_consumption_info;
    if (asset) {
      if (use?.should_mute_audio) return null;
      const url = asset.progressive_download_url || asset.fast_start_progressive_download_url || asset.web_30s_preview_download_url;
      if (!url) return null;
      const start = (use?.audio_asset_start_time_in_ms || 0) / 1000;
      const length = (use?.overlap_duration_in_ms || 30000) / 1000;
      return {
        title: asset.title || 'Unknown song',
        artist: asset.display_artist || '',
        cover: asset.cover_artwork_thumbnail_uri || '',
        url,
        start,
        end: start + length,
      };
    }
    const orig = mm?.original_sound_info;
    if (orig?.progressive_download_url) {
      const start = (orig.audio_asset_start_time_in_ms || 0) / 1000;
      const length = (orig.overlap_duration_in_ms || orig.duration_in_ms || 30000) / 1000;
      return {
        title: orig.original_audio_title || 'Original audio',
        artist: orig.ig_artist?.username || '',
        cover: orig.ig_artist?.profile_pic_url || '',
        url: orig.progressive_download_url,
        start,
        end: start + length,
      };
    }
    return null;
  }

  function getMusic(code) {
    if (!musicCache.has(code)) {
      musicCache.set(code, new Promise((resolve) => {
        fetchQueue.push({ code, resolve });
        pumpQueue();
      }));
    }
    return musicCache.get(code);
  }

  async function pumpQueue() {
    if (fetching) return;
    fetching = true;
    while (fetchQueue.length) {
      const { code, resolve } = fetchQueue.shift();
      try {
        const res = await pageFetch(`${location.origin}/api/v1/media/${shortcodeToPk(code)}/info/`, {
          credentials: 'include',
          // A logged out session gets a redirect to the login page. Do not follow it.
          redirect: 'manual',
          headers: { 'X-IG-App-ID': APP_ID, 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (res.status === 429) {
          // Rate limited. Wait, and let a later scan try this post again.
          resolve(null);
          forgetLater(code, 60000);
          await sleep(30000);
          continue;
        }
        // Parse the text here. Firefox wraps objects that come from the page.
        // A bad answer caches null, so the post is not asked for again in this tab.
        let json = null;
        if (res.ok) {
          try { json = JSON.parse(await res.text()); } catch { json = null; }
        }
        resolve(parseMusic(json?.items?.[0]));
      } catch {
        // Network error. Let a later scan try again after a pause.
        resolve(null);
        forgetLater(code, 15000);
      }
      await sleep(150);
    }
    fetching = false;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const forgetLater = (code, ms) => setTimeout(() => musicCache.delete(code), ms);

  // ---------- finding posts ----------

  const CODE_RE = /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{6,})/;

  function codeFromRoot(root) {
    const counts = new Map();
    for (const a of root.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      const m = (a.getAttribute('href') || '').match(CODE_RE);
      if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    }
    let best = null;
    let bestN = 0;
    for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
    return best;
  }

  function openDialog() {
    const dialogs = [...document.querySelectorAll('div[role="dialog"]')].filter((d) => {
      const r = d.getBoundingClientRect();
      if (r.width <= 300 || r.height <= 300) return false;
      // Only a post popup counts. Login, share and menu popups have no large media.
      return [...d.querySelectorAll('img, video')].some((m) => m.getBoundingClientRect().width >= MIN_MEDIA);
    });
    return dialogs[dialogs.length - 1] || null;
  }

  function findRoots() {
    const found = [];
    const dialog = openDialog();
    const pageMatch = location.pathname.match(CODE_RE);
    if (pageMatch) {
      // A post page, or a post opened as a modal over the feed or a profile.
      const root = dialog || document.querySelector('main');
      if (root) found.push({ root, code: pageMatch[1] });
    }
    for (const art of document.querySelectorAll('article')) {
      if (found.some((f) => f.root.contains(art))) continue;
      const code = codeFromRoot(art);
      if (code) found.push({ root: art, code });
    }
    return found;
  }

  function near(a, b) {
    return Math.abs(a.left - b.left) < 3 && Math.abs(a.top - b.top) < 3 &&
      Math.abs(a.width - b.width) < 3 && Math.abs(a.height - b.height) < 3;
  }

  // The media frame: the outermost element that has the same box as the first image.
  function findMediaBox(root) {
    const rootRect = root.getBoundingClientRect();
    const media = [...root.querySelectorAll('img, video')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width >= MIN_MEDIA && r.height >= 150 &&
        r.left >= rootRect.left - 2 && r.right <= rootRect.right + 2)
      .sort((a, b) => (a.r.top - b.r.top) || (a.r.left - b.r.left));
    if (!media.length) return null;
    const first = media[0];
    let box = first.el;
    let positioned = null;
    for (let e = first.el.parentElement; e && e !== root.parentElement; e = e.parentElement) {
      const r = e.getBoundingClientRect();
      if (r.width > first.r.width + 3 || r.height > first.r.height + 3) break;
      if (near(r, first.r)) {
        box = e;
        if (getComputedStyle(e).position !== 'static') positioned = e;
      }
    }
    return positioned || box;
  }

  // ---------- UI ----------

  const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L12 18.6V5.4L7.2 9.5H4Z" fill="currentColor"/><path d="M15.5 8.6a4.6 4.6 0 0 1 0 6.8M18.2 6a8.3 8.3 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L12 18.6V5.4L7.2 9.5H4Z" fill="currentColor"/><path d="m15.6 9.4 5.2 5.2m0-5.2-5.2 5.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  function stop(ev) { ev.stopPropagation(); }

  function buildUi(post) {
    const { music } = post;
    const ui = document.createElement('div');
    ui.className = 'imw-layer';
    ui.innerHTML = `
      <button type="button" class="imw-pill" aria-label="Song: ${escapeHtml(music.title)}">
        ${music.cover ? `<img class="imw-cover" alt="" src="${escapeHtml(music.cover)}">` : '<span class="imw-note">&#9835;</span>'}
        <span class="imw-text"><span class="imw-marquee"></span></span>
        <span class="imw-eq" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
      <button type="button" class="imw-btn" aria-label="Toggle music"></button>`;
    ui.querySelector('.imw-marquee').textContent = music.artist ? `${music.title} · ${music.artist}` : music.title;
    for (const btn of ui.querySelectorAll('button')) {
      for (const type of ['pointerdown', 'mousedown', 'dblclick', 'touchstart']) btn.addEventListener(type, stop);
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleSound(post);
      });
    }
    return ui;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function mountUi(post) {
    if (!post.music) return;
    if (!post.box || !post.box.isConnected) post.box = findMediaBox(post.root);
    if (!post.box) return;
    if (!post.ui) post.ui = buildUi(post);
    if (post.ui.parentElement !== post.box) {
      if (getComputedStyle(post.box).position === 'static') post.box.style.position = 'relative';
      post.box.appendChild(post.ui);
      requestAnimationFrame(() => fitMarquee(post.ui));
    }
    paint(post);
  }

  function fitMarquee(ui) {
    const box = ui.querySelector('.imw-text');
    const inner = ui.querySelector('.imw-marquee');
    const overflow = inner.scrollWidth - box.clientWidth;
    ui.classList.toggle('imw-long', overflow > 4);
    ui.style.setProperty('--imw-shift', `${-Math.max(overflow + 12, 0)}px`);
  }

  function paint(post) {
    if (!post.ui) return;
    const isActive = post === active;
    const playing = isActive && soundOn && !blocked && !audio.paused;
    post.ui.dataset.state = playing ? 'playing' : (isActive && blocked && soundOn ? 'blocked' : 'idle');
    const btn = post.ui.querySelector('.imw-btn');
    const wantOn = soundOn && !(isActive && blocked);
    if (btn.dataset.on !== String(wantOn)) {
      btn.dataset.on = String(wantOn);
      btn.innerHTML = wantOn ? ICON_ON : ICON_OFF;
      btn.setAttribute('aria-label', wantOn ? 'Mute music' : 'Play music');
    }
  }

  function paintAll() { for (const p of posts.values()) paint(p); }

  // ---------- playback ----------

  function fadeTo(target, then) {
    cancelAnimationFrame(fadeRaf);
    const from = audio.volume;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / FADE_MS);
      audio.volume = from + (target - from) * k;
      if (k < 1) fadeRaf = requestAnimationFrame(step);
      else if (then) then();
    };
    fadeRaf = requestAnimationFrame(step);
  }

  async function startAudio() {
    if (!active || !soundOn || document.hidden) return;
    const m = active.music;
    if (audio.dataset.src !== m.url) {
      audio.dataset.src = m.url;
      audio.src = m.url;
      audio.currentTime = m.start;
    }
    audio.volume = 0;
    try {
      await audio.play();
      blocked = false;
      fadeTo(1);
    } catch (err) {
      if (err?.name === 'NotAllowedError') blocked = true;
    }
    paintAll();
  }

  function stopAudio() {
    if (audio.paused) return paintAll();
    fadeTo(0, () => { audio.pause(); paintAll(); });
  }

  audio.addEventListener('timeupdate', () => {
    const m = active?.music;
    if (m && audio.currentTime >= m.end) audio.currentTime = m.start;
  });
  audio.addEventListener('ended', () => {
    if (active?.music) { audio.currentTime = active.music.start; audio.play().catch(() => {}); }
  });
  audio.addEventListener('play', paintAll);
  audio.addEventListener('pause', paintAll);

  function setActive(post) {
    if (post === active) return;
    const prev = active;
    active = post;
    if (prev) paint(prev);
    if (!post) { stopAudio(); return; }
    // New song: restart at the post's clip start, like the app does.
    audio.dataset.src = '';
    if (soundOn) {
      cancelAnimationFrame(fadeRaf);
      audio.pause();
      startAudio();
    } else {
      paint(post);
    }
  }

  function toggleSound(post) {
    if (blocked && soundOn && post === active) {
      // The click is a user gesture, so play is allowed now.
      startAudio();
      return;
    }
    soundOn = !soundOn;
    store?.set({ soundOn });
    if (soundOn) {
      if (active !== post) setActive(post);
      else startAudio();
    } else {
      stopAudio();
    }
    paintAll();
  }

  // ---------- scanning ----------

  function visibleRatio(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 ? (w * h) / (r.width * r.height) : 0;
  }

  function scan() {
    const seen = new Set();
    for (const { root, code } of findRoots()) {
      seen.add(root);
      let post = posts.get(root);
      if (post && post.code !== code) {
        // The element was reused for another post.
        post.ui?.remove();
        if (active === post) setActive(null);
        post = null;
      }
      if (!post) {
        post = { root, code, box: null, music: undefined, ui: null };
        posts.set(root, post);
      }
      if (!post.box || !post.box.isConnected) post.box = findMediaBox(root);
      // null with no cache entry: the last request failed and its pause is over.
      if (post.music === null && !musicCache.has(code)) post.music = undefined;
      if (post.music === undefined && post.box && visibleRatio(post.box) > 0) {
        post.music = null;
        getMusic(code).then((music) => {
          if (posts.get(root) !== post) return;
          post.music = music;
          if (music) { mountUi(post); pickActive(); }
        });
      } else if (post.music) {
        mountUi(post);
      }
    }
    for (const [root, post] of posts) {
      if (!seen.has(root) || !root.isConnected) {
        post.ui?.remove();
        posts.delete(root);
        if (active === post) setActive(null);
      }
    }
    pickActive();
  }

  // A video playing with sound on screen, such as an unmuted reel, wins over the song.
  function loudVideoOnScreen() {
    for (const v of document.querySelectorAll('video')) {
      if (!v.paused && !v.muted && v.volume > 0 && visibleRatio(v) >= ACTIVE_RATIO) return true;
    }
    return false;
  }

  function pickActive() {
    if (loudVideoOnScreen()) { setActive(null); return; }
    const dialog = openDialog();
    let best = null;
    let bestScore = 0;
    for (const post of posts.values()) {
      if (!post.music || !post.box?.isConnected) continue;
      if (dialog && !dialog.contains(post.root)) continue;
      const ratio = visibleRatio(post.box);
      if (ratio < ACTIVE_RATIO) continue;
      const r = post.box.getBoundingClientRect();
      const centerGap = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) / innerHeight;
      const score = ratio - centerGap * 0.5;
      if (score > bestScore) { best = post; bestScore = score; }
    }
    setActive(best);
  }

  let scanTimer = 0;
  function scheduleScan(delay = 200) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  let rafPending = false;
  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      pickActive();
      scheduleScan(300);
    });
  }

  new MutationObserver(() => scheduleScan()).observe(document.body, { childList: true, subtree: true });
  addEventListener('scroll', onScroll, { passive: true, capture: true });
  addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { audio.pause(); paintAll(); } else startAudio();
  });
  // Autoplay is blocked until the first click or key press on the page.
  for (const type of ['pointerdown', 'keydown']) {
    addEventListener(type, () => { if (blocked) startAudio(); }, { capture: true });
  }
  setInterval(scan, 1500);

  if (store) {
    // Promise form: Firefox's browser.* API takes no callbacks. Chrome MV3 supports both.
    store.get({ soundOn: true })
      .then((v) => { soundOn = v.soundOn !== false; })
      .catch(() => {})
      .finally(() => { paintAll(); scan(); });
    ext.storage.onChanged?.addListener((changes) => {
      if (changes.soundOn) {
        soundOn = changes.soundOn.newValue !== false;
        if (soundOn) startAudio(); else stopAudio();
      }
    });
  } else {
    scan();
  }

  window.__imw = { posts, audio, scan, getMusic, parseMusic };
})();
