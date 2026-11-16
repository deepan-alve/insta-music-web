// Concept A: the demo feed. It copies the extension's rules:
// the post nearest the middle plays, Reels are skipped, sound waits for one click,
// and the popup can pause, switch off and set the volume.
(() => {
  const A = window.DemoAudio;
  const feed = document.getElementById('feed');
  const posts = [...feed.querySelectorAll('.post')];
  const popup = document.querySelector('.popup iframe');
  const count = document.getElementById('count');

  // Lucide volume-2 and volume-x, the same icons the extension uses.
  const SPEAKER = '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>';
  const svg = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICON_ON = svg(`${SPEAKER}<path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>`);
  const ICON_OFF = svg(`${SPEAKER}<line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>`);

  let unlocked = false, soundOn = true, paused = false, current = 0;

  // Build the overlay with the same classes and structure as content.js.
  for (const post of posts) {
    const img = post.querySelector('.media img');
    post.querySelector('.av').style.backgroundImage = `url("${img.currentSrc || img.src}")`;
    if (post.dataset.tune === undefined) continue;
    const tune = A.TUNES[post.dataset.tune];
    const label = `${tune.title} · ${tune.artist}`;
    const layer = document.createElement('div');
    layer.className = 'ps-layer';
    layer.dataset.state = 'idle';
    layer.innerHTML = `<button class="ps-pill" type="button"><img class="ps-cover" alt="" src="${img.getAttribute('src')}"><span class="ps-text"><span class="ps-marquee"></span></span><span class="ps-eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="ps-hint">Click to play</span></button><button class="ps-btn" type="button"></button>`;
    layer.querySelector('.ps-marquee').textContent = label;
    layer.querySelector('.ps-pill').setAttribute('aria-label', `${label}. Turn music on or off`);
    for (const b of layer.querySelectorAll('button')) b.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    post.querySelector('.media').append(layer);
    post.layer = layer;
    post.tune = tune;
  }

  function stateFor(i) {
    if (i !== current || !posts[i].layer) return 'idle';
    if (!soundOn || paused) return 'idle';
    return unlocked ? 'playing' : 'blocked';
  }

  function render() {
    posts.forEach((p, i) => {
      p.classList.toggle('is-current', i === current);
      if (!p.layer) return;
      const st = stateFor(i);
      p.layer.dataset.state = st;
      const btn = p.layer.querySelector('.ps-btn');
      const on = st === 'playing' || st === 'blocked';
      btn.innerHTML = on ? ICON_ON : ICON_OFF;
      btn.setAttribute('aria-label', on ? 'Mute music' : 'Play music');
    });
    const p = posts[current];
    const st = stateFor(current);
    if (st === 'playing') A.start(Number(p.dataset.tune)); else A.stop();
    count.textContent = `${current + 1} / ${posts.length}`;
    tell(p, st);
  }

  function tell(p, st) {
    const mode = !p.layer ? 'empty' : st === 'idle' ? 'ready' : st;
    popup.contentWindow?.postMessage({ src: 'ps-page', mode, title: p.tune?.title, artist: p.tune?.artist, cover: p.layer ? new URL(p.querySelector('.media img').getAttribute('src'), location.href).href : '' }, location.origin);
  }

  function toggle() {
    if (!unlocked) return unlock();
    if (!soundOn) { soundOn = true; paused = false; } else paused = !paused;
    render();
  }

  function unlock() {
    if (unlocked) return;
    A.unlock().then(() => { unlocked = true; render(); });
  }

  // Like a browser, the first click anywhere on the stage allows sound.
  document.getElementById('stage').addEventListener('pointerdown', (e) => { if (!e.target.closest('iframe')) unlock(); });
  feed.addEventListener('keydown', unlock, { once: true });

  // The post nearest the middle of the feed is the current one.
  let raf = 0;
  feed.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const mid = feed.scrollTop + feed.clientHeight / 2;
      let best = 0, dist = Infinity;
      posts.forEach((p, i) => {
        const d = Math.abs(p.offsetTop + p.offsetHeight / 2 - mid);
        if (d < dist) { dist = d; best = i; }
      });
      if (best !== current) { current = best; paused = false; render(); }
    });
  }, { passive: true });

  const go = (i) => {
    const p = posts[Math.max(0, Math.min(posts.length - 1, i))];
    feed.scrollTo({ top: p.offsetTop + p.offsetHeight / 2 - feed.clientHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  document.getElementById('prev').addEventListener('click', () => go(current - 1));
  document.getElementById('next').addEventListener('click', () => go(current + 1));

  // Messages from the popup frame.
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.src !== 'ps-popup') return;
    const m = e.data;
    if (m.type === 'ready') render();
    if (m.type === 'toggle') { unlock(); if (unlocked) { paused = !paused; render(); } }
    if (m.type === 'sound') { soundOn = m.on; paused = false; render(); }
    if (m.type === 'volume') A.setVolume(m.value);
    if (m.type === 'goto') document.querySelector(m.hash)?.scrollIntoView();
  });

  // Stop the music when the tab is hidden, like the extension.
  document.addEventListener('visibilitychange', () => { if (document.hidden) A.stop(); else render(); });

  // Start with the first post centred.
  addEventListener('load', () => { go(0); render(); });
})();
