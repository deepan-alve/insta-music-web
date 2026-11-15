// Toolbar popup: one switch for the soundOn setting. content.js listens for the change.
const ext = globalThis.browser ?? globalThis.chrome;
const input = document.getElementById('sound');

ext.storage.local.get({ soundOn: true }).then((v) => {
  input.checked = v.soundOn !== false;
});

input.addEventListener('change', () => {
  ext.storage.local.set({ soundOn: input.checked });
});
