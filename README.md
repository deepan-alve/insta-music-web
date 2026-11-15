# Insta Music Web

An extension for Chrome and Firefox. It plays the song on Instagram photo and carousel posts on instagram.com, as the mobile app does.

## Why the web has no music

- The web feed data has no song fields for photo posts.
- The media info API, `/api/v1/media/<pk>/info/`, returns `music_metadata` for the same post.
- That data holds the title, the artist, the cover, an audio URL, the clip start and the clip length.

## What it does

- It finds posts in the feed, on post pages and in the post popup.
- It fetches the media info for each post that comes on screen. It sends one request at a time.
- It shows a song pill at the top left and a sound button at the bottom right of the photo.
- It plays the clip of the post that fills most of the screen. The clip loops.
- It stops the song when you scroll away, close the popup or hide the tab.
- It gives way to a video that plays with sound on screen.
- It remembers the sound on or off choice.

Reels are skipped. They have their own audio.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** at the top right.
3. Click **Load unpacked** and select this folder.
4. Reload instagram.com.

After a code change, click the reload icon on the extension card.

## Install in Firefox

1. Run `node scripts/build.mjs`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `dist/insta-music-web-firefox-<version>.xpi`.
4. Reload instagram.com.

Firefox removes a temporary add-on when it closes. Release Firefox keeps only add-ons that Mozilla signed.
To keep it, sign the `.xpi` as an unlisted add-on on addons.mozilla.org.

The browser can block sound until your first click on the page. The sound button pulses until then.

## Build and test

- `node scripts/build.mjs` writes `dist/chrome/`, `dist/firefox/` and a zip for each.
- `node scripts/test-firefox.mjs` starts a headless Firefox with an empty profile and installs the `.xpi`.
  It opens a post and prints the media info requests that the extension sends.
  The profile is not logged in, so Instagram answers with a redirect to the login page.

## Files

- `manifest.json`: Manifest V3 for Chrome. It needs only the `storage` permission.
- `content.js`: finds posts, fetches the song data and plays it.
- `content.css`: the pill and the sound button.
- `icons/`: `icon.svg` is the source for the PNG files.
- `scripts/build.mjs`: adds the Firefox manifest keys and writes the packages.
- `scripts/test-firefox.mjs`: the Firefox smoke test.

## Limits

- It uses a private Instagram API. Instagram can change it without notice.
- Instagram can rate limit the requests. On HTTP 429 the script waits 30 seconds.
- A failed request is not sent again for 15 seconds. A redirect or a bad answer is not sent again in that tab.
