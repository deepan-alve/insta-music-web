// Postsound: plays the song attached to Instagram photo and carousel posts on the web.
// The web feed data has no song fields for photos. The media info API has them, so this
// script fetches them for each visible post and plays the clip with one shared <audio>.
(() => {
  if (globalThis.__postsoundLoaded) return;
  globalThis.__postsoundLoaded = true;

  const { shortcodeToPk, codeFromPath, parseMusic } = globalThis.PostsoundData;

  const APP_ID = '936619743392459'; // Instagram web app id. instagram.com sends the same one.
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
  let volume = 1; // 0 to 1, from the popup slider
  let blocked = false; // the browser refused autoplay until the user interacts
  let active = null; // post state that owns the audio
  let fadeRaf = 0;
  let lastPlayError = ''; // shown as data-error on the active overlay, for debugging

  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const forgetLater = (code, ms) => setTimeout(() => musicCache.delete(code), ms);

  function saveSetting(value) {
    // After an extension update, the old script loses its storage access. Ignore that.
    try { store?.set(value)?.catch?.(() => {}); } catch { /* context invalidated */ }
  }

  // ---------- data ----------

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
      const pk = shortcodeToPk(code);
      if (!pk) { resolve(null); continue; }
      try {
        const res = await pageFetch(`${location.origin}/api/v1/media/${pk}/info/`, {
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

  // ---------- finding posts ----------

  function codeFromRoot(root) {
    const counts = new Map();
    for (const a of root.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')) {
      const c = codeFromPath(a.getAttribute('href'));
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    }
    let best = null;
    let bestN = 0;
    for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n; }
    return best;
  }

  function hasLargeMedia(el) {
    return [...el.querySelectorAll('img, video')].some((m) => m.getBoundingClientRect().width >= MIN_MEDIA);
  }

  function openPostDialog() {
    // A post popup always puts the post in the URL. Other popups, such as the
    // notifications prompt, can hold large images but leave the URL alone.
    if (!codeFromPath(location.pathname)) return null;
    const dialogs = [...document.querySelectorAll('div[role="dialog"]')].filter((d) => {
      const r = d.getBoundingClientRect();
      // Only a post popup counts. Login, share and menu popups have no large media.
      return r.width > 300 && r.height > 300 && hasLargeMedia(d);
    });
    return dialogs[dialogs.length - 1] || null;
  }

  function findRoots() {
    const found = [];
    const pageCode = codeFromPath(location.pathname);
    if (pageCode) {
      // A post page, or a post opened as a popup over the feed or a profile.
      const root = openPostDialog() || document.querySelector('main');
      if (root) found.push({ root, code: pageCode });
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

  // The media frame: the outermost element with the same box as the first image.
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

  // Lucide volume-2 and volume-x (ISC licence, see icons/LICENSE-lucide.txt).
  // Icons are built with DOM calls, so the content script never assigns markup.
  const NS = 'http://www.w3.org/2000/svg';
  const SPEAKER = ['path', { d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' }];
  const ICON_ON = [SPEAKER, ['path', { d: 'M16 9a5 5 0 0 1 0 6' }], ['path', { d: 'M19.364 18.364a9 9 0 0 0 0-12.728' }]];
  const ICON_OFF = [SPEAKER, ['line', { x1: 22, x2: 16, y1: 9, y2: 15 }], ['line', { x1: 16, x2: 22, y1: 9, y2: 15 }]];
  const ICON_NOTE = [['path', { d: 'M9 18V5l12-2v13' }], ['circle', { cx: 6, cy: 18, r: 3 }], ['circle', { cx: 18, cy: 16, r: 3 }]];

  function svg(shapes) {
    const node = document.createElementNS(NS, 'svg');
    const attrs = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    for (const [tag, a] of shapes) {
      const shape = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(a)) shape.setAttribute(k, v);
      node.append(shape);
    }
    return node;
  }

  const swallow = (ev) => ev.stopPropagation();

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  // Built with DOM calls, not innerHTML, so song titles can never become markup.
  function buildUi(post) {
    const { music } = post;
    const label = music.artist ? `${music.title} · ${music.artist}` : music.title;
    const ui = el('div', 'ps-layer');

    const pill = el('button', 'ps-pill');
    pill.type = 'button';
    pill.title = label;
    pill.setAttribute('aria-label', `${label}. Turn music on or off`);
    if (music.cover) {
      const cover = el('img', 'ps-cover');
      cover.alt = '';
      cover.src = music.cover;
      cover.addEventListener('error', () => cover.replaceWith(noteIcon()), { once: true });
      pill.append(cover);
    } else {
      pill.append(noteIcon());
    }
    const text = el('span', 'ps-text');
    const marquee = el('span', 'ps-marquee');
    marquee.textContent = label;
    text.append(marquee);
    const eq = el('span', 'ps-eq');
    eq.setAttribute('aria-hidden', 'true');
    eq.append(el('i'), el('i'), el('i'));
    // Shown only while the browser blocks sound, so people know one click starts it.
    const hint = el('span', 'ps-hint');
    hint.textContent = 'Click to play';
    pill.append(text, eq, hint);

    const btn = el('button', 'ps-btn');
    btn.type = 'button';

    for (const b of [pill, btn]) {
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'touchstart']) {
        b.addEventListener(type, swallow);
      }
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleSound(post);
      });
    }
    ui.append(pill, btn);
    return ui;
  }

  function noteIcon() {
    const span = el('span', 'ps-note');
    span.setAttribute('aria-hidden', 'true');
    span.append(svg(ICON_NOTE));
    return span;
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
    const box = ui.querySelector('.ps-text');
    const inner = ui.querySelector('.ps-marquee');
    const overflow = inner.scrollWidth - box.clientWidth;
    ui.classList.toggle('ps-long', overflow > 4);
    ui.style.setProperty('--ps-shift', `${-Math.max(overflow + 12, 0)}px`);
  }

  function paint(post) {
    if (!post.ui) return;
    const isActive = post === active;
    const playing = isActive && soundOn && !blocked && !audio.paused;
    post.ui.dataset.state = playing ? 'playing' : (isActive && blocked && soundOn ? 'blocked' : 'idle');
    post.ui.dataset.active = String(isActive);
    if (isActive && lastPlayError) post.ui.dataset.error = lastPlayError;
    else delete post.ui.dataset.error;
    const btn = post.ui.querySelector('.ps-btn');
    const showOn = soundOn && !(isActive && blocked);
    if (btn.dataset.on !== String(showOn)) {
      btn.dataset.on = String(showOn);
      btn.replaceChildren(svg(showOn ? ICON_ON : ICON_OFF));
      btn.setAttribute('aria-label', showOn ? 'Mute music' : 'Play music');
    }
  }

  function paintAll() { for (const p of posts.values()) paint(p); }

  // ---------- playback ----------

  function fadeTo(target, then) {
    cancelAnimationFrame(fadeRaf);
    const from = audio.volume;
    const t0 = performance.now();
    const step = (now) => {
      // The frame timestamp can be a little older than t0, so clamp both ends. An out-of-range
      // volume throws, which would stop the fade and leave the song playing.
      const k = Math.min(1, Math.max(0, (now - t0) / FADE_MS));
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k < 1) fadeRaf = requestAnimationFrame(step);
      else if (then) then();
    };
    fadeRaf = requestAnimationFrame(step);
  }

  // Firefox blocks audible autoplay until the user clicks the page. There, play() can stay
  // pending with no error, so ask the browser first where it can tell us (Firefox 112+).
  function autoplayDisallowed() {
    try { return navigator.getAutoplayPolicy?.(audio) === 'disallowed'; } catch { return false; }
  }

  let playTry = 0;
  async function startAudio() {
    if (!active || !soundOn || document.hidden) return;
    const m = active.music;
    if (audio.dataset.src !== m.url) {
      audio.dataset.src = m.url;
      audio.src = m.url;
      audio.currentTime = m.start;
    }
    if (autoplayDisallowed()) {
      blocked = true;
      lastPlayError = 'autoplay-disallowed';
      paintAll();
      return;
    }
    audio.volume = 0;
    const thisTry = ++playTry;
    // Safety net: if the song has not started after 1.5 s, show the click-to-play state.
    setTimeout(() => {
      if (thisTry === playTry && active && soundOn && !document.hidden && audio.paused && !blocked) {
        blocked = true;
        lastPlayError = 'no-start';
        paintAll();
      }
    }, 1500);
    try {
      await audio.play();
      if (thisTry !== playTry) return;
      blocked = false;
      lastPlayError = '';
      fadeTo(volume);
    } catch (err) {
      if (thisTry !== playTry) return;
      // NotAllowedError means autoplay is blocked until a click. Firefox can hide the error
      // name from content scripts, so any failure except a normal abort waits for a click.
      lastPlayError = String(err?.name || err || 'error');
      if (lastPlayError !== 'AbortError') blocked = true;
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
    // New song: restart at the post's clip start, as the app does.
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
      // The click is a user gesture, so the browser allows play now.
      startAudio();
      return;
    }
    soundOn = !soundOn;
    saveSetting({ soundOn });
    if (soundOn) {
      if (active !== post) setActive(post);
      else startAudio();
    } else {
      stopAudio();
    }
    paintAll();
  }

  // ---------- scanning ----------

  function visibleRatio(node) {
    const r = node.getBoundingClientRect();
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
        // Instagram reused the element for another post.
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

  // A video that plays with sound on screen, such as an unmuted reel, wins over the song.
  function loudVideoOnScreen() {
    for (const v of document.querySelectorAll('video')) {
      if (!v.paused && !v.muted && v.volume > 0 && visibleRatio(v) >= ACTIVE_RATIO) return true;
    }
    return false;
  }

  function pickActive() {
    if (loudVideoOnScreen()) { setActive(null); return; }
    const dialog = openPostDialog();
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
  // Videos start and stop without DOM changes, so listen for their play events too.
  document.addEventListener('play', (ev) => { if (ev.target !== audio) pickActive(); }, true);
  document.addEventListener('volumechange', (ev) => { if (ev.target !== audio) pickActive(); }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { audio.pause(); paintAll(); } else startAudio();
  });
  // Browsers block autoplay until the first click or key press on the page.
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'click']) {
    addEventListener(type, () => { if (blocked) startAudio(); }, { capture: true });
  }
  setInterval(scan, 1500);

  function clampVolume(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
  }

  // ---------- popup messages ----------

  function status() {
    const m = active?.music;
    return {
      soundOn,
      blocked: Boolean(active && blocked && soundOn),
      playing: Boolean(active && soundOn && !blocked && !audio.paused),
      song: m ? { title: m.title, artist: m.artist, cover: m.art || m.cover } : null,
    };
  }

  ext?.runtime?.onMessage?.addListener((msg, _sender, reply) => {
    if (msg?.type === 'postsound:status') {
      reply(status());
    } else if (msg?.type === 'postsound:toggle') {
      // From the popup: play or pause the song on screen. A popup click is not a click on
      // the page, so a blocked tab still needs one click on the page itself.
      if (active) toggleSound(active);
      else { soundOn = !soundOn; saveSetting({ soundOn }); paintAll(); }
      reply(status());
    }
    return false;
  });

  if (store) {
    // Promise form: Firefox's browser.* API takes no callbacks. Chrome MV3 supports both.
    store.get({ soundOn: true, volume: 1 })
      .then((v) => { soundOn = v.soundOn !== false; volume = clampVolume(v.volume); })
      .catch(() => {})
      .finally(() => { paintAll(); scan(); });
    ext.storage.onChanged?.addListener((changes) => {
      if (changes.volume) {
        volume = clampVolume(changes.volume.newValue);
        if (!audio.paused) { cancelAnimationFrame(fadeRaf); audio.volume = volume; }
      }
      if (!changes.soundOn) return;
      soundOn = changes.soundOn.newValue !== false;
      if (soundOn) startAudio(); else stopAudio();
      paintAll();
    });
  } else {
    scan();
  }
})();
