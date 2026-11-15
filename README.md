# Postsound

A browser extension for Chrome and Firefox. It plays the music on Instagram photo and carousel posts on instagram.com, as the mobile app does.

## Why the web has no music

- The web feed data has no song fields for photo posts.
- The media info API, `/api/v1/media/<pk>/info/`, returns `music_metadata` for the same post.
- That data holds the title, the artist, the cover, an audio URL, the clip start and the clip length.

## What it does

- It finds posts in the feed, on profiles, on post pages and in the post popup.
- It fetches the media info for each post that comes on screen. It sends one request at a time.
- It shows a song pill at the top left and a sound button at the bottom right of the photo.
- It plays the clip of the post that fills most of the screen. The clip loops.
- It stops the song when you scroll away, close the popup or hide the tab.
- It gives way to a video that plays with sound on screen.
- The toolbar popup and the sound button share one setting. The extension remembers it.

Reels are skipped. They have their own audio.

## Install for development

Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. After a code change, click the reload icon on the Postsound card.

Firefox:

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `dist/postsound-firefox-<version>.xpi`.

Firefox removes a temporary add-on when it closes. Release Firefox keeps only add-ons that Mozilla signed.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests for `music.js` |
| `npm run build` | Writes `dist/postsound-chrome-<v>.zip` and `dist/postsound-firefox-<v>.xpi` |
| `npm run test:firefox` | Headless Firefox, logged out: install, one request per post, no retries |
| `node scripts/firefox-smoke.mjs --login DIR` | Visible Firefox with a kept profile. Log in once, then it tests the pill, clicks and the feed |
| `node scripts/store-assets.mjs` | Renders the store images into `store/` |

No npm packages are needed. Node 22 or later, `zip`, Firefox and Chrome are enough.

## Publish

`store/LISTING.md` holds the name, the store copy, the privacy answers and the reviewer notes.
`PRIVACY.md` is the privacy policy text.

## Files

- `manifest.json`: Manifest V3 for Chrome. `scripts/build.mjs` adds the Firefox keys.
- `music.js`: pure data helpers. The unit tests cover them.
- `content.js`: finds posts, fetches the song data and plays it.
- `content.css`: the pill and the sound button. Every class starts with `ps-`.
- `popup.html`, `popup.css`, `popup.js`: the toolbar popup.
- `icons/`: rendered from `brand/icon.svg`. `brand/alt-icon-record*.svg` is an unused alternative.
- `store/`: store images and listing copy. `store/src/` holds their sources.

## Limits

- It uses a private Instagram API. Instagram can change it without notice.
- Instagram can rate limit the requests. On HTTP 429 the script waits 30 seconds.
- A failed request is not sent again for 15 seconds. A redirect or a bad answer is not sent again in that tab.
