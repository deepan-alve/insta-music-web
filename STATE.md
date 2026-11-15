# State

<!-- state-facts:begin -->
Run `state-facts` to fill this block. Do not edit it by hand.
<!-- state-facts:end -->

status: in_progress

## Goal
Instagram photo posts play their song on instagram.com in Chrome, as on the mobile app.

## Done
- The media info API returns `music_metadata` for photo and carousel posts. Evidence: tested in Chrome on 2026-11-16.
- The script plays the song on a post page, in the post popup and in the home feed. Evidence: injected into a logged-in tab on 2026-11-16.
- The mute button, carousel swipes, popup next and back, and popup close work. Evidence: same test.

## Tried and failed
- `/api/v1/users/web_profile_info/` returns 404 now. Do not use it.
- `/api/v1/feed/user/<name>/username/` returns 404 now. Do not use it.

## Uncertain
- The extension is not yet tested as an installed extension. The test injected the same code into the page.
- The video guard in `pickActive` is not tested in a browser.
- The autoplay block path is not tested. The test tab already had a user click.

## Next
1. Load the folder at `chrome://extensions` with **Load unpacked**.
2. Open a photo post with music and check that `.imw-layer` shows.

## Rollback
Remove the extension at `chrome://extensions`. No other state exists.

## More
Transcript: `recall "insta music extension" --project insta-music-web`.
