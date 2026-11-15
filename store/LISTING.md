# Store listing

Copy and settings for the Chrome Web Store and Firefox Add-ons (AMO).
Paste the blocks as they are. Every limit below was checked against the text.

## Name

`Postsound: Music for Instagram Photos` (37 characters. Chrome allows 75, AMO 50.)

Why this name: "Insta" and "Gram" in a product name break Meta's brand rules, and stores reject them.
"for Instagram" is the allowed way to say what it works with. "Music" and "Photos" are the words people search.

## Summary

Chrome "summary" and AMO "summary" (115 characters. Chrome allows 132, AMO 250):

```
Hear the music on Instagram photo and carousel posts in your browser. See the song and play its clip, like the app.
```

## Description

```
On the Instagram app, photo posts play their song. On instagram.com they stay silent. Postsound fixes that.

What it does
• Plays the song on photo and carousel posts, from the same part of the track the poster picked
• Shows the song and artist on the photo, with a sound button in the corner
• Works in the home feed, on profiles, on post pages and in the post popup
• Plays one song at a time: the post you are looking at
• Stops when you scroll away, close the post or switch tabs
• Steps aside when a video with sound is playing
• Remembers if you turned the sound off

Good to know
• Reels already have sound, so Postsound leaves them alone
• Your browser may wait for one click on the page before it allows sound
• Turn it on or off any time from the toolbar button

Support
Postsound stays free. The people who keep it going sign a guestbook by hand at guestbook.deepanalve.dev.

Private by design
Postsound has no servers and collects nothing. It asks instagram.com for the song of the post on your screen, the same way the Instagram website asks for post details. The only thing it saves is your sound on or off choice, in your own browser.

Postsound is not affiliated with, endorsed by or sponsored by Instagram or Meta. Instagram is a trademark of Meta Platforms, Inc.
```

## Category

- Chrome: **Social Networking** (Lifestyle).
- AMO: **Photos, Music & Videos** and **Social & Communication**.

## Search terms to keep in the copy

instagram music, instagram song, photo post music, carousel music, instagram web sound, instagram desktop audio.
They are already in the name, summary and description. Do not add a keyword list. Both stores penalize keyword stuffing.

## Images

| File | Size | Use |
|---|---|---|
| `icons/icon-128.png` | 128 x 128, 96 x 96 art with 16 px padding | Chrome store icon and AMO icon (both read the package) |
| `store/screenshot-1.png` | 1280 x 800 | Chrome and AMO screenshot 1: a post playing |
| `store/screenshot-2.png` | 1280 x 800 | Chrome and AMO screenshot 2: one song at a time |
| `store/screenshot-3.png` | 1280 x 800 | Chrome and AMO screenshot 3: the toolbar popup |
| `store/promo-small.png` | 440 x 280 | Chrome small promo tile (required) |
| `store/promo-marquee.png` | 1400 x 560 | Chrome marquee tile (optional) |

Make them again with `node scripts/store-assets.mjs`.

## Chrome privacy tab

Single purpose:

```
Plays the music that is attached to Instagram photo and carousel posts when you view them on instagram.com.
```

Permission justifications:

- `storage`: `Saves one setting in the browser: whether the user turned the sound on or off.`
- Host access to `https://www.instagram.com/*` (content script): `The content script runs only on instagram.com. It reads the post on screen, asks instagram.com for that post's song, and shows a play button on the photo.`

Remote code: **No, I am not using remote code.** All code ships in the package. The audio files are media, not code.

Data usage: check nothing. Postsound collects no user data.
Then certify all three statements: no selling of data, no use unrelated to the single purpose, no use for credit decisions.

Privacy policy URL: `https://postsound.deepanalve.dev/privacy`.

## AMO settings

- Distribution: **On this site** (listed).
- Firefox for Android: compatible. The package sets `gecko_android`.
- License: pick one in the form. See "Still needed".
- Source code upload: **not needed**. The package has no build step, minifier or bundler. The files are the source.
- Data collection: the manifest declares `data_collection_permissions: none`.

Notes to reviewer:

```
Postsound runs one content script on https://www.instagram.com/*. It has no background script and no remote code.

For each post on screen it calls https://www.instagram.com/api/v1/media/<id>/info/, the same endpoint the Instagram website uses for post details. In Firefox it uses content.fetch so the request goes out as the page with the user's own Instagram session. It reads music_metadata from the answer and plays the audio URL in an <audio> element. Nothing leaves the browser except that request to instagram.com.

To test: log in to Instagram, then open https://www.instagram.com/p/DdoVXZ0kYVE/ (a public carousel with a song). A song pill shows at the top left of the photo. Click the sound button at the bottom right if Firefox blocked autoplay.
```

## Still needed before upload

1. A license choice for AMO, for example MIT or All Rights Reserved.
2. A Chrome Web Store developer account. Google charges a one-time US$5 fee.
3. A Firefox Add-ons account. It is free.
