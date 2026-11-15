// Postsound data helpers. Pure functions with no DOM access, so Node can unit test them.
// The browser loads this file before content.js. Both share the content script global.
(function (root) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const DEFAULT_CLIP_MS = 30000;
  const VIDEO = 2; // media_type of videos and reels. They carry their own audio.

  // An Instagram shortcode is the media id in base 64. Private posts add more characters
  // after the first 11. Those extra characters are not part of the id.
  function shortcodeToPk(code) {
    let n = 0n;
    for (const ch of String(code).slice(0, 11)) {
      const v = ALPHABET.indexOf(ch);
      if (v < 0) return null;
      n = n * 64n + BigInt(v);
    }
    return n > 0n ? n.toString() : null;
  }

  // Path of the post in a URL, such as /p/<code>/ or /<user>/p/<code>/.
  const CODE_RE = /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{6,})/;

  function codeFromPath(path) {
    const m = String(path || '').match(CODE_RE);
    return m ? m[1] : null;
  }

  function clip(startMs, lengthMs) {
    const start = Math.max(0, Number(startMs) || 0) / 1000;
    const length = (Number(lengthMs) > 0 ? Number(lengthMs) : DEFAULT_CLIP_MS) / 1000;
    return { start, end: start + length };
  }

  // Reads the song of one item from /api/v1/media/<pk>/info/. Returns null when the
  // post has no song that the web should play.
  function parseMusic(item) {
    if (!item || typeof item !== 'object' || item.media_type === VIDEO) return null;
    const meta = item.music_metadata;
    const asset = meta?.music_info?.music_asset_info;
    const use = meta?.music_info?.music_consumption_info;
    if (asset) {
      if (use?.should_mute_audio) return null;
      const url = asset.progressive_download_url || asset.fast_start_progressive_download_url ||
        asset.web_30s_preview_download_url;
      if (!url) return null;
      return {
        title: asset.title || 'Unknown song',
        artist: asset.display_artist || '',
        cover: asset.cover_artwork_thumbnail_uri || '',
        url,
        ...clip(use?.audio_asset_start_time_in_ms, use?.overlap_duration_in_ms),
      };
    }
    const orig = meta?.original_sound_info;
    if (orig?.progressive_download_url) {
      return {
        title: orig.original_audio_title || 'Original audio',
        artist: orig.ig_artist?.username || '',
        cover: orig.ig_artist?.profile_pic_url || '',
        url: orig.progressive_download_url,
        ...clip(orig.audio_asset_start_time_in_ms, orig.overlap_duration_in_ms || orig.duration_in_ms),
      };
    }
    return null;
  }

  const api = { shortcodeToPk, codeFromPath, parseMusic, CODE_RE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PostsoundData = api;
})(globalThis);
