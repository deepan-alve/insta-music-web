# State

<!-- state-facts:begin -->
Run `state-facts` to fill this block. Do not edit it by hand.
<!-- state-facts:end -->

status: in_progress

## Goal
Postsound plays the song of Instagram photo posts on instagram.com in Chrome and Firefox, and is ready for both stores.

## Done
- The media info API returns `music_metadata` for photo and carousel posts. Evidence: tested in Chrome on 2026-11-16.
- Version 0.1 played songs in Deepan's Chrome on a post page, in the popup and in the feed. Evidence: Chrome checks on 2026-11-16.
- The product is renamed Postsound. Meta's brand rules forbid "Insta" in product names.
- Deepan chose the gradient tile with a white note as the icon. Evidence: his message on 2026-11-16. See project memory `icon-choice`.
- `music.js` holds the pure helpers. Evidence: `npm test`, 11 passed on 2026-11-16.
- The 1.0.0 packages build. Evidence: `npm run build` on 2026-11-16.
- The Firefox 1.0.0 package installs and sends one request per post, logged out. Evidence: `npm run test:firefox`, 4 passed on 2026-11-16.
- Firefox 1.0.0 works logged in: post page, clicks, mute, carousel, feed, stop on scroll. Evidence: `firefox-smoke.mjs --login`, 14 passed on 2026-11-16.
- Blocked autoplay in Firefox now shows the pulsing button, and one click plays. Evidence: the same run with `--block-autoplay`, 14 passed.
- The store images and listing copy exist. Evidence: `store/`, rendered by `scripts/store-assets.mjs`.
- The popup shows what plays, with play/pause, the switch and a volume slider. The About page has support, report and contact. Evidence: `npm run test:e2e`, 25 passed twice on 2026-11-16.
- The UI follows `design.md` (hallmark, modern-minimal, Coral). Contrast of every text pair is at least 4.5:1, measured from the tokens.
- A fade could set the volume above 1, throw, and leave the song playing. The fade is clamped now. Evidence: the e2e run caught it, then passed.
- The product site exists in `site/` and builds with `site.Dockerfile` (nginx). Evidence: docker build and curl of every page on 2026-11-16, and a browser check at desktop and phone widths.
- The Support button opens guestbook.deepanalve.dev/sign with Postsound picked. The guestbook lives in `~/code/guestbook`.
- Live at https://postsound.deepanalve.dev on Dokploy: project `postsound`, compose id `WUy9JVTzl4sh9U93-uBFH`, file `deploy/docker-compose.yml`. Evidence: on 2026-11-16 /, /privacy and /terms returned 200 with a Let's Encrypt origin cert.

- v1.0.1: support is "Buy me a sticker" in the popup, the About page and the website, linking to the sticker wall at guestbook.deepanalve.dev/sign?product=postsound. Store packages built in dist/ (postsound-chrome-1.0.1.zip, postsound-firefox-1.0.1.xpi). Not uploaded to the stores yet. The website is deployed.
- v1.1.0 redesign, "Live feed", chosen by Deepan on 2026-11-16 over "Record deck".
  - The site home (site/index.html) is a working demo feed. The middle post plays a demo tune made by Web Audio. It uses the real overlay and the real popup in a frame.
  - The old home page is at /classic, with noindex.
  - The popup is the "Live card" (popup.css). The old style is in design/popup-v1.css. The popup prefers the full-size cover_artwork_uri.
  - The About page has the sticker on the support card, and a heavier title.
  - The site CSP now allows its own scripts and frames.
  - Evidence on 2026-11-16: `npm test` 11 passed, `npm run test:e2e` 25 passed, and the Docker image served every page. Claude checked the built site at 320 to 1440 px: no sideways scroll, no console errors, and the feed and popup controls worked in Chrome.
  - Packages postsound-chrome-1.1.0.zip and postsound-firefox-1.1.0.xpi are built, not uploaded. Store images are re-rendered.
  - The B concept (record deck) stays in site/concepts/record.html. The Docker image leaves it out.
  - Live on 2026-11-16 (commit 7d59c1d, Dokploy deployment done). Evidence: /, /classic, /popup-demo, /privacy and /terms returned 200 with the new CSP, /concepts returned 404, and in Chrome one click on the feed played the demo tune and the framed popup showed Now playing, with no console errors.
- Site logo fix (7c43bb8) and MIT licence (f47c5dd) are live on 2026-11-16. Evidence: the live HTML uses /img/mark-96.png at 28 px, and the file returns 200. The 1.1.0 packages now ship LICENSE.
- Store submission started on 2026-11-16. Deepan chose MIT and both stores. The Chrome dashboard asks Deepan to verify his Google sign-in. AMO shows a CAPTCHA first. Deepan does both, then creates the accounts and pays Google's US$5 fee. Claude fills the listings from store/LISTING.md and stops before each Submit.
- AMO: Postsound 1.1.0 submitted on 2026-11-16 at addons.mozilla.org/.../addon/postsound. Status: Awaiting Review. Evidence: the Status & Versions page shows 1.1.0 Awaiting Review with 0 errors and 0 warnings. Listing has the icon, three captioned screenshots, MIT, categories Photos, Music & Videos and Social & Communication, the privacy policy text and reviewer notes. Slug is `postsound`, because AMO allows 30 characters.
- AMO validation flagged two innerHTML assignments in content.js. Fixed in d156753: the icons are built with DOM calls. The listing copy now says Postsound saves sound and volume (0fa9431).
- 2026-11-16: README has badges, store screenshots, the sticker link and a table of the three tools. Deepan made the repo public on 2026-11-16, after gitleaks found no leaks in 22 commits.
- 2026-11-16: the site sends `Cache-Control: no-transform`, so Cloudflare no longer injects its analytics beacon (commit 89d3856). Evidence: a browser user agent gets no beacon, and Chromium shows no console errors.
- 2026-11-17: launch trailer done; Deepan said "Perfect". store/promo-trailer.mp4 (26 s, 1920x1080, -13.9 LUFS, music drops on the click at 4.5 s) and its poster store/promo-trailer.jpg. Made with the brag plugin (~/.claude/plugins/cache/brag) and Hyperframes. The source is in brag-output-launch/ (git-ignored, has bundled music): composition/, audio/build_mix.py, audio/sfx-timeline.txt. The calmer first cut is brag-output/brag.mp4. For the Chrome listing, upload it to YouTube as Unlisted and paste the link.
## Tried and failed
- Firefox play() can stay pending with no error when autoplay is blocked. Ask `navigator.getAutoplayPolicy` first.
- A killed test Firefox counts as a startup crash. After a few, Firefox restarts into Troubleshoot Mode and drops the BiDi flag. The test profile turns that check off.
- With Deepan's Firefox open, a visible test Firefox needs `--new-instance`.
- `/api/v1/users/web_profile_info/` returns 404 now. Do not use it.
- `/api/v1/feed/user/<name>/username/` returns 404 now. Do not use it.
- Claude in Chrome cannot open `chrome://` pages, and no desktop control tool exists on Ullam. Deepan must click in `chrome://extensions`.
- `/usr/bin/orca` is the GNOME screen reader, not a desktop control tool. Do not run it.
- An illustrated icon (photo print and record) lost to the gradient note icon.

## Uncertain
- The redesigned build is not seen in Deepan's own Chrome yet. He must reload the extension card first.
- AMO review is pending. The gradient icon looks like Instagram's colours, so review may object.

## Next
1. Reload Postsound in `chrome://extensions`, then check the popup and the About page in his Chrome.
2. Chrome: Deepan paid the US$5 fee on 2026-11-17 and chose a non-trader account. Chrome blocks automation on the Web Store dashboard: Claude in Chrome gets "The extensions gallery cannot be scripted", and the built-in browser cannot load chrome.google.com. So Deepan fills the listing by hand from `store/LISTING.md`, with dist/postsound-chrome-1.1.0.zip (checked on 2026-11-17: the zip matches the source files). Support email on the listing: contact@deepanalve.dev. contact@ is now a Zoho alias of ghost@ (2026-11-17): Claude deleted the leftover contact@ account under Users > Other Zoho Users, as Zoho support advised, then added the alias. Evidence: the alias list shows it, and Zoho Mail compose offers contact@ as a From address. The catch-all to ghost@ stays on.
4. Money: Deepan decided on 2026-11-17 that Postsound stays free, tips only. Tips are the sticker wall at guestbook.deepanalve.dev (Dodo checkout, test mode, signing paused). Nothing to build in Postsound. When Dodo approves the live account, the switch happens in `~/code/guestbook`: live key, live products by `scripts/dodo-setup.ts`, then unpause signing. Dodo bans donations, so keep the "buy a sticker" framing. The Chrome account stays non-trader.
5. config.js now links GitHub issues (the About page's issue button). The 1.1.0 packages predate it. Ship it in the next version.
3. Watch for Mozilla's review email. If a reviewer asks something, answer from `store/LISTING.md` reviewer notes.

## Rollback
Remove the extension at `chrome://extensions` or `about:addons`. No other state exists.

## More
Transcript: `recall "postsound instagram music" --project insta-music-web`.
- SEO (2026-11-16): robots.txt names this site's sitemap and https://www.deepanalve.dev/sitemap.xml, which lists every tool (cross-host sitemap). The page has SoftwareApplication JSON-LD and a "More tools" footer line linking the other tools. The portfolio shows the tools as P6 to P8.
- Search engines (2026-11-16): Google Search Console (domain property), Bing Webmaster (imported from Google) and Yandex Webmaster all have this site. Yandex verifies by the `yandex-verification` meta tag in the page head. Do not remove it. Yandex sitemap upload was read-only during an outage; robots.txt names the sitemap, so Yandex finds it anyway.
