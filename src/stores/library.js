import {
  get,
  writable
} from 'svelte/store';

import {
  readJson,
  writeJson
} from '../services/storage.js';

const FAVOURITES_KEY =
  'systumm-music-favourites-v1';

function trackKey(track) {
  return String(
    track?.id ||
    track?.songid ||
    track?.url ||
    track?.title ||
    track?.name ||
    ''
  );
}

function loadFavourites() {
  const stored = readJson(
    FAVOURITES_KEY,
    []
  );

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.filter((track) => {
    return (
      track &&
      typeof track === 'object' &&
      typeof track.url === 'string'
    );
  });
}

export const favourites = writable(
  loadFavourites()
);

favourites.subscribe((tracks) => {
  writeJson(
    FAVOURITES_KEY,
    tracks
  );
});

export function isFavourite(
  track,
  list = get(favourites)
) {
  const key = trackKey(track);

  if (!key) {
    return false;
  }

  return list.some((item) => {
    return trackKey(item) === key;
  });
}

export function toggleFavourite(track) {
  if (!track || !trackKey(track)) {
    return false;
  }

  let nowFavourite = false;

  favourites.update((tracks) => {
    const key = trackKey(track);

    const existingIndex =
      tracks.findIndex((item) => {
        return trackKey(item) === key;
      });

    if (existingIndex >= 0) {
      nowFavourite = false;

      return tracks.filter(
        (_, index) => index !== existingIndex
      );
    }

    nowFavourite = true;

    return [
      track,
      ...tracks
    ];
  });

  return nowFavourite;
}

export function removeFavourite(track) {
  const key = trackKey(track);

  favourites.update((tracks) => {
    return tracks.filter((item) => {
      return trackKey(item) !== key;
    });
  });
}

export function clearFavourites() {
  favourites.set([]);
}
