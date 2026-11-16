// Demo tunes for the Postsound site. Made in the browser with Web Audio, so no song files
// and no licences. Each tune is a short loop: soft chords, a plucked line and a light beat.
// window.DemoAudio = { TUNES, start(i), stop(), setVolume(v), unlock(), playing() }
(() => {
  const TUNES = [
    { title: 'Late Light', artist: 'Sunday Static', bpm: 84, root: 57, prog: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], line: [12, 16, 19, 16, 14, 12, 11, 7] },
    { title: 'Tidelines', artist: 'Marlowe Bay', bpm: 96, root: 55, prog: [[0, 4, 7, 12], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 19]], line: [19, 16, 12, 16, 21, 19, 16, 14] },
    { title: 'Iced Over', artist: 'June Theory', bpm: 102, root: 60, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [10, 14, 17, 20]], line: [15, 12, 10, 12, 15, 17, 15, 12] },
    { title: 'Night Bus', artist: 'Low Tide Club', bpm: 76, root: 50, prog: [[0, 3, 7, 10], [8, 12, 15, 19], [5, 8, 12, 15], [7, 10, 14, 17]], line: [12, 10, 7, 10, 15, 14, 12, 10] },
  ];

  let ctx = null, master = null, bus = null, timer = null, current = -1, volume = 0.8;

  const hz = (m) => 440 * 2 ** ((m - 69) / 12);

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // A warm low-pass and a short echo make plain oscillators sound like a record, not a test tone.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 2600; tone.Q.value = 0.4;
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    bus = ctx.createGain(); bus.gain.value = 0.9;
    bus.connect(tone); tone.connect(master);
    tone.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  }

  function note(t, m, dur, type, level, attack = 0.01) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }

  function kick(t) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
  }

  function hat(t, level) {
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = level;
    s.connect(f); f.connect(g); g.connect(bus); s.start(t);
  }

  // One bar = 8 eighth notes. The scheduler looks 0.2 s ahead, the usual Web Audio pattern.
  function play(i) {
    const tune = TUNES[i];
    const step = 60 / tune.bpm / 2;
    let n = 0, next = ctx.currentTime + 0.06;
    const tick = () => {
      while (next < ctx.currentTime + 0.2) {
        const bar = Math.floor(n / 8) % tune.prog.length, s = n % 8;
        const chord = tune.prog[bar];
        if (s === 0) chord.forEach((c) => note(next, tune.root + c, step * 8, 'sine', 0.06, 0.12));
        if (s % 2 === 0) note(next, tune.root - 12 + chord[0], step * 1.6, 'triangle', s === 0 ? 0.16 : 0.08);
        note(next, tune.root + tune.line[(s + bar * 3) % 8], step * 1.4, 'triangle', 0.07);
        if (s === 0 || s === 4) kick(next);
        hat(next, s % 2 ? 0.05 : 0.025);
        next += step; n++;
      }
    };
    tick();
    timer = setInterval(tick, 50);
  }

  function fade(to, secs) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + secs);
  }

  window.DemoAudio = {
    TUNES,
    unlock() { init(); return ctx.resume(); },
    start(i) {
      init();
      if (current === i) return;
      clearInterval(timer); timer = null;
      current = i;
      master.gain.setValueAtTime(0, ctx.currentTime);
      play(i);
      fade(volume * 0.7, 0.35);
    },
    stop() {
      if (!ctx || current < 0) return;
      current = -1;
      fade(0, 0.25);
      const t = timer; timer = null;
      setTimeout(() => clearInterval(t), 260);
    },
    setVolume(v) {
      volume = v;
      if (ctx && current >= 0) fade(volume * 0.7, 0.08);
    },
    playing() { return current; },
  };
})();
