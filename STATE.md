# State

<!-- state-facts:begin -->
Run `state-facts` to fill this block. Do not edit it by hand.
<!-- state-facts:end -->

status: in_progress

## Goal
Instagram photo posts play their song on instagram.com in Chrome and Firefox, as on the mobile app.

## Done
- The media info API returns `music_metadata` for photo and carousel posts. Evidence: tested in Chrome on 2026-11-16.
- The script plays the song on a post page, in the post popup and in the home feed. Evidence: injected into a logged-in tab on 2026-11-16.
- The mute button, carousel swipes, popup next and back, and popup close work. Evidence: same test.
- The unpacked extension plays the song in Deepan's Chrome. Evidence: Deepan loaded it, and a check found the pill playing on 2026-11-16.
- The Firefox `.xpi` installs and sends one media info request per post. Evidence: `node scripts/test-firefox.mjs` on 2026-11-16, logged out.
- A login popup no longer counts as a post popup. Evidence: the same Firefox test sent the request only after this fix.

## Tried and failed
- `/api/v1/users/web_profile_info/` returns 404 now. Do not use it.
- `/api/v1/feed/user/<name>/username/` returns 404 now. Do not use it.

## Uncertain
- Firefox is not tested while logged in to Instagram. The test profile is empty.
- The latest content.js changes are not tested in Chrome. They are the Firefox fetch, the popup filter and the retry pause.
- The video guard in `pickActive` is not tested in a browser.
- The autoplay block path is not tested.

## Next
1. Load the `.xpi` in Firefox with **Load Temporary Add-on** and open a post with music while logged in.
2. Reload the Chrome extension card and check a post with music again.
3. Ask Deepan if he wants an AMO unlisted signature so Firefox keeps the add-on after a restart.

## Rollback
Remove the extension at `chrome://extensions` or `about:addons`. No other state exists.

## More
Transcript: `recall "insta music extension" --project insta-music-web`.
