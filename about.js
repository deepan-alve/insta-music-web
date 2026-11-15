// About page: support link, problem report as a prefilled email, and contact.
const ext = globalThis.browser ?? globalThis.chrome;
const config = globalThis.POSTSOUND_CONFIG;
const $ = (id) => document.getElementById(id);

const version = ext?.runtime?.getManifest?.().version ?? 'dev';
$('version').textContent = `v${version}`;
$('creator').textContent = config.creator.name;
$('creator').href = config.creator.url;

// ---------- support ----------

if (config.support.url) {
  $('support-btn').href = config.support.url;
  $('support-label').textContent = config.support.label;
  $('support-soon').hidden = true;
} else {
  $('support-btn').hidden = true;
}

// ---------- contact ----------

const mailto = `mailto:${config.contactEmail}`;
for (const a of [$('mail-link'), $('sent-mail')]) {
  a.textContent = config.contactEmail;
  a.href = mailto;
}

let copyTimer = 0;
$('copy').addEventListener('click', async () => {
  const btn = $('copy');
  try {
    await navigator.clipboard.writeText(config.contactEmail);
    btn.dataset.state = 'done';
    $('copy-label').textContent = 'Copied';
  } catch {
    $('copy-label').textContent = 'Select it';
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    delete btn.dataset.state;
    $('copy-label').textContent = 'Copy';
  }, 1600);
});

// ---------- report ----------

if (config.issues.url) {
  $('issues-btn').href = config.issues.url;
  $('issues-btn').textContent = config.issues.label;
} else {
  $('issues-btn').hidden = true;
}

function browserName() {
  const ua = navigator.userAgent;
  const pick = (re, name) => { const m = ua.match(re); return m ? `${name} ${m[1]}` : null; };
  return pick(/Firefox\/([\d.]+)/, 'Firefox') || pick(/Edg\/([\d.]+)/, 'Edge') ||
    pick(/Chrome\/([\d.]+)/, 'Chrome') || 'Unknown browser';
}

const post = $('post');
function postIsValid() {
  const v = post.value.trim();
  return !v || /^https:\/\/(www\.)?instagram\.com\//i.test(v);
}

post.addEventListener('input', () => {
  // Clear the error as soon as the link is fixed. Do not nag while typing.
  if (postIsValid()) {
    post.removeAttribute('aria-invalid');
    $('post-error').hidden = true;
  }
});

$('report-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!postIsValid()) {
    post.setAttribute('aria-invalid', 'true');
    $('post-error').hidden = false;
    post.focus();
    return;
  }
  const kind = document.querySelector('input[name="kind"]:checked')?.value ?? 'Problem';
  const lines = [$('details').value.trim() || '(no details)'];
  if (post.value.trim()) lines.push('', `Post: ${post.value.trim()}`);
  if ($('diag').checked) lines.push('', '---', `Postsound ${version}`, browserName());
  const subject = `Postsound: ${kind}`;
  window.location.href = `${mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  $('sent').hidden = false;
});
