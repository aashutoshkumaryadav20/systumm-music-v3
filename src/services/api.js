const API_BASE = (
  import.meta.env.VITE_API_BASE ||
  'https://songs.systumm-bot.workers.dev'
).replace(/\/+$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    signal: options.signal
  });

  const text = await response.text();

  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `The music server returned invalid JSON (${response.status}).`
    );
  }

  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.error ||
      payload?.message ||
      `Music request failed (${response.status}).`
    );
  }

  return payload;
}

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of [
    'songs',
    'results',
    'albums',
    'playlists',
    'data'
  ]) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

export async function getTrending(signal) {
  const token = encodeURIComponent(
    'now-trending/BECHl0fsh08_'
  );

  const payload = await request(
    `/api/playlist-songs?token=${token}&limit=50`,
    { signal }
  );

  return extractItems(payload);
}

export async function getNewReleases(signal) {
  const payload = await request(
    '/api/new-releases',
    { signal }
  );

  return extractItems(payload);
}

export async function getPlaylists(signal) {
  const payload = await request(
    '/api/playlists',
    { signal }
  );

  return extractItems(payload);
}

export async function searchMusic(query, signal) {
  const payload = await request(
    `/api/search?q=${encodeURIComponent(query)}`,
    { signal }
  );

  const combined = [
    ...(Array.isArray(payload?.results)
      ? payload.results
      : []),

    ...(Array.isArray(payload?.songs)
      ? payload.songs
      : []),

    ...(Array.isArray(payload?.albums)
      ? payload.albums
      : []),

    ...(Array.isArray(payload?.playlists)
      ? payload.playlists
      : [])
  ];

  const uniqueItems = [];
  const seen = new Set();

  for (const item of combined) {
    const key = [
      item?.type || 'item',
      item?.id ||
      item?.token ||
      item?.url ||
      item?.title ||
      item?.name
    ].join(':');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

export async function getAlbumSongs(album, signal) {
  const id = encodeURIComponent(
    album?.id ||
    album?.album_id ||
    ''
  );

  const token = encodeURIComponent(
    album?.token || ''
  );

  const payload = await request(
    `/api/album-songs?id=${id}&token=${token}`,
    { signal }
  );

  return {
    collection: payload?.album || album,
    songs: Array.isArray(payload?.songs)
      ? payload.songs
      : extractItems(payload)
  };
}

export async function getPlaylistSongs(
  playlist,
  signal
) {
  const token = encodeURIComponent(
    playlist?.token ||
    playlist?.id ||
    ''
  );

  const payload = await request(
    `/api/playlist-songs?token=${token}&limit=100`,
    { signal }
  );

  return {
    collection: payload?.playlist || playlist,
    songs: Array.isArray(payload?.songs)
      ? payload.songs
      : extractItems(payload)
  };
}
