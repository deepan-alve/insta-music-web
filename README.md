# Insta Music Web

A Chrome extension. It plays the song on Instagram photo and carousel posts on instagram.com, as the mobile app does.

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

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** at the top right.
3. Click **Load unpacked** and select this folder.
4. Reload instagram.com.

Chrome can block sound until your first click on the page. The sound button pulses until then.

## Files

- `manifest.json`: Manifest V3. It needs only the `storage` permission.
- `content.js`: finds posts, fetches the song data and plays it.
- `content.css`: the pill and the sound button.
- `icons/`: `icon.svg` is the source for the PNG files.

## Limits

- It uses a private Instagram API. Instagram can change it without notice.
- Instagram can rate limit the requests. On HTTP 429 the script waits 30 seconds.
