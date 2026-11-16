// Unit tests for music.js. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { shortcodeToPk, codeFromPath, parseMusic } = require('../music.js');

test('shortcodeToPk matches the id Instagram uses', () => {
  // Seen in a real request on 2026-11-16: /p/DdoVXZ0kYVE/ -> /api/v1/media/3992535036914140484/info/
  assert.equal(shortcodeToPk('DdoVXZ0kYVE'), '3992535036914140484');
});

test('shortcodeToPk ignores the extra characters of private post codes', () => {
  assert.equal(
    shortcodeToPk('DfuUhS1I-xN9bjfcKJjgUSYFzjCcGQ9g0FW1lQ0'),
    shortcodeToPk('DfuUhS1I-xN'),
  );
});

test('shortcodeToPk rejects characters outside base 64', () => {
  assert.equal(shortcodeToPk('abc$def'), null);
  assert.equal(shortcodeToPk(''), null);
});

test('codeFromPath reads post, reel and user-prefixed paths', () => {
  assert.equal(codeFromPath('/p/DdoVXZ0kYVE/'), 'DdoVXZ0kYVE');
  assert.equal(codeFromPath('/selenagomez/p/DdoVXZ0kYVE/?img_index=3'), 'DdoVXZ0kYVE');
  assert.equal(codeFromPath('/reel/Dfw3S-OJe9z/'), 'Dfw3S-OJe9z');
  assert.equal(codeFromPath('/selenagomez/'), null);
  assert.equal(codeFromPath(undefined), null);
});

const licensed = (overrides = {}) => ({
  media_type: 8,
  music_metadata: {
    audio_type: 'licensed_music',
    music_info: {
      music_asset_info: {
        title: 'Oh, What A World',
        display_artist: 'Kacey Musgraves',
        cover_artwork_thumbnail_uri: 'https://cdn.example/cover.jpg',
        progressive_download_url: 'https://cdn.example/song.mp4',
        fast_start_progressive_download_url: 'https://cdn.example/fast.mp4',
        ...overrides.asset,
      },
      music_consumption_info: {
        audio_asset_start_time_in_ms: 36050,
        overlap_duration_in_ms: 50000,
        should_mute_audio: false,
        ...overrides.use,
      },
    },
    original_sound_info: null,
  },
});

test('parseMusic reads a licensed song with its clip window', () => {
  assert.deepEqual(parseMusic(licensed()), {
    title: 'Oh, What A World',
    artist: 'Kacey Musgraves',
    cover: 'https://cdn.example/cover.jpg',
    art: 'https://cdn.example/cover.jpg',
    url: 'https://cdn.example/song.mp4',
    start: 36.05,
    end: 86.05,
  });
});

test('parseMusic falls back to the other audio URLs', () => {
  const m = parseMusic(licensed({ asset: { progressive_download_url: null } }));
  assert.equal(m.url, 'https://cdn.example/fast.mp4');
});

test('parseMusic uses a 30 second clip when the length is missing', () => {
  const m = parseMusic(licensed({ use: { audio_asset_start_time_in_ms: 0, overlap_duration_in_ms: 0 } }));
  assert.equal(m.start, 0);
  assert.equal(m.end, 30);
});

test('parseMusic respects should_mute_audio', () => {
  assert.equal(parseMusic(licensed({ use: { should_mute_audio: true } })), null);
});

test('parseMusic skips videos and reels', () => {
  assert.equal(parseMusic({ ...licensed(), media_type: 2 }), null);
});

test('parseMusic returns null for posts without music', () => {
  assert.equal(parseMusic({ media_type: 1, music_metadata: null }), null);
  assert.equal(parseMusic({ media_type: 8, music_metadata: { music_info: null, original_sound_info: null } }), null);
  assert.equal(parseMusic(null), null);
  assert.equal(parseMusic('nope'), null);
});

test('parseMusic reads original audio', () => {
  const m = parseMusic({
    media_type: 1,
    music_metadata: {
      music_info: null,
      original_sound_info: {
        original_audio_title: 'Original audio',
        progressive_download_url: 'https://cdn.example/orig.mp4',
        duration_in_ms: 12000,
        ig_artist: { username: 'someone', profile_pic_url: 'https://cdn.example/p.jpg' },
      },
    },
  });
  assert.equal(m.artist, 'someone');
  assert.equal(m.url, 'https://cdn.example/orig.mp4');
  assert.equal(m.end, 12);
});
