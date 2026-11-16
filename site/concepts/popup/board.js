// Renders the real popup.html markup with each stylesheet, in the states people see.
(async () => {
  const src = await (await fetch('/popup.html')).text();
  const COVER = new URL('/site/concepts/img/photo-rooftop.webp', location.href).href;
  const STATES = [
    { name: 'Playing', mode: 'playing', label: 'Now playing', title: 'Late Light', artist: 'Sunday Static', cover: COVER },
    { name: 'Sound blocked', mode: 'blocked', label: 'Click the page to play', title: 'Late Light', artist: 'Sunday Static', cover: COVER },
    { name: 'Not on Instagram', mode: 'off-site' },
  ];

  for (const row of document.querySelectorAll('.row')) {
    const schemes = row.hasAttribute('data-only-light') ? ['light'] : ['light', 'dark'];
    for (const scheme of schemes) for (const st of STATES) {
      const doc = new DOMParser().parseFromString(src, 'text/html');
      doc.querySelectorAll('script').forEach((s) => s.remove());
      doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => l.remove());
      doc.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="${row.dataset.css}"><style>@font-face{font-family:"Geist";src:url("/fonts/Geist-Variable.woff2") format("woff2");font-weight:100 900}</style>`);
      doc.querySelector('.logo').src = '/icons/icon-32.png';
      doc.getElementById('version').textContent = 'v1.0.1';
      const now = doc.getElementById('now');
      now.dataset.mode = st.mode;
      if (st.title) {
        doc.getElementById('label').textContent = st.label;
        doc.getElementById('title').textContent = st.title;
        doc.getElementById('artist').textContent = st.artist;
        const art = doc.getElementById('art');
        art.classList.add('has-cover');
        art.setAttribute('style', `background-image:url("${st.cover}")`);
      }
      const fig = document.createElement('figure');
      const frame = document.createElement('iframe');
      frame.style.colorScheme = scheme;
      frame.srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
      frame.addEventListener('load', () => { frame.style.height = frame.contentDocument.documentElement.scrollHeight + 'px'; });
      fig.append(frame);
      fig.insertAdjacentHTML('beforeend', `<figcaption>${st.name}${schemes.length > 1 ? ` · ${scheme}` : ''}</figcaption>`);
      row.append(fig);
    }
  }
})();
