// The site's copy of the popup. It talks to the page around it with postMessage,
// the way the real popup talks to the Instagram tab.
(() => {
  const $ = (id) => document.getElementById(id);
  const now = $('now'), sound = $('sound'), volume = $('volume'), out = $('volume-out');
  const LABEL = { playing: 'Now playing', ready: 'Paused', blocked: 'Click the page to play', empty: 'No song on this post' };
  const send = (msg) => parent.postMessage({ src: 'ps-popup', ...msg }, location.origin);

  function fill(v) {
    volume.style.setProperty('--fill', `${v}%`);
    out.textContent = `${v}%`;
  }
  fill(volume.value);

  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.src !== 'ps-page') return;
    const { mode, title, artist, cover } = e.data;
    now.dataset.mode = mode;
    $('label').textContent = LABEL[mode] || '';
    $('title').textContent = title || 'Reel';
    $('artist').textContent = artist || 'Reels have their own sound';
    const art = $('art');
    art.style.backgroundImage = cover ? `url("${cover}")` : '';
    art.classList.toggle('has-cover', !!cover);
    $('action').setAttribute('aria-label', mode === 'playing' ? 'Pause' : 'Play');
    $('action').disabled = mode === 'empty';
    size();
  });

  $('action').addEventListener('click', () => send({ type: 'toggle' }));
  sound.addEventListener('change', () => { send({ type: 'sound', on: sound.checked }); volume.disabled = !sound.checked; });
  volume.addEventListener('input', () => { fill(volume.value); send({ type: 'volume', value: volume.value / 100 }); });
  document.querySelectorAll('[data-top]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); send({ type: 'goto', hash: a.getAttribute('href') }); }));
  // The frame takes the popup's height, so the site never shows a scrollbar inside it.
  function size() { send({ type: 'size', h: document.body.offsetHeight }); }
  addEventListener('load', size);
  send({ type: 'ready' });
  size();
})();
