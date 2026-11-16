// Concept B: the record deck. Pick a sleeve, press play, the photo spins as the label.
(() => {
  const A = window.DemoAudio;
  const deck = document.getElementById('deck');
  const label = document.getElementById('label');
  const lcd = document.getElementById('lcd');
  const sleeves = [...document.querySelectorAll('.sleeve')];
  let tune = 0, playing = false;

  function show() {
    const t = A.TUNES[tune];
    const text = `${t.title} · ${t.artist}`.toUpperCase();
    // Twice, so the scroll loops without a gap.
    lcd.textContent = playing ? `${text}   ·   ${text}   ·   ` : `${text} · READY`;
    deck.classList.toggle('is-playing', playing);
    document.getElementById('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  function load(i) {
    tune = i;
    sleeves.forEach((s, j) => s.setAttribute('aria-checked', String(j === i)));
    label.classList.add('swap');
    setTimeout(() => {
      label.style.backgroundImage = `url("${sleeves[i].dataset.img}")`;
      label.classList.remove('swap');
    }, 180);
    if (playing) A.start(tune);
    show();
  }

  async function toggle() {
    await A.unlock();
    playing = !playing;
    if (playing) A.start(tune); else A.stop();
    show();
  }

  document.getElementById('play').addEventListener('click', toggle);
  document.getElementById('record').addEventListener('click', toggle);
  sleeves.forEach((s, i) => s.addEventListener('click', async () => {
    if (i === tune && playing) return;
    if (!playing) { await A.unlock(); playing = true; }
    load(i);
    A.start(i);
    show();
  }));
  document.getElementById('vol').addEventListener('input', (e) => A.setVolume(e.target.value / 100));
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) { playing = false; A.stop(); show(); } });

  label.style.backgroundImage = `url("${sleeves[0].dataset.img}")`;
  show();
})();
