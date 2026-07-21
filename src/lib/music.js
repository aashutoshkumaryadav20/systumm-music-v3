/**
 * Helpers for normalising song, album and playlist data returned
 * by different Systumm Music Worker endpoints.
 */

export function cleanText(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return cleanText(
      value.text ||
      value.title ||
      value.name ||
      value.value ||
      ''
    );
  }

  if (Array.isArray(value)) {
    return value
      .map(cleanText)
      .filter(Boolean)
      .join(', ');
  }

  return String(value)
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .trim();
}

export function titleOf(item) {
  return cleanText(
    item?.title ||
    item?.name ||
    item?.song ||
    item?.album ||
    'Untitled'
  );
}

export function subtitleOf(item) {
  const subtitle = item?.subtitle;

  if (Array.isArray(subtitle)) {
    const combined = subtitle
      .map((part) => {
        return cleanText(
          part?.text ||
          part?.name ||
          part
        );
      })
      .filter(Boolean)
      .join(', ');

    if (combined) {
      return combined;
    }
  }

  return cleanText(
    subtitle ||
    item?.artist ||
    item?.artists ||
    item?.primary_artists ||
    item?.primaryArtists ||
    item?.description ||
    item?.music ||
    ''
  );
}

export function imageOf(item) {
  let image =
    item?.image ||
    item?.artwork ||
    item?.thumbnail ||
    '';

  if (Array.isArray(image)) {
    image = image.at(-1);
  }

  if (image && typeof image === 'object') {
    image =
      image.url ||
      image.link ||
      image.src ||
      '';
  }

  if (typeof image !== 'string') {
    return '';
  }

  return image
    .replace(/\b50x50\b/g, '500x500')
    .replace(/\b150x150\b/g, '500x500')
    .replace(/\b250x250\b/g, '500x500');
}

export function typeOf(item) {
  const suppliedType = String(
    item?.type ||
    item?.content_type ||
    item?.contentType ||
    ''
  ).toLowerCase();

  if (suppliedType.includes('playlist')) {
    return 'playlist';
  }

  if (suppliedType.includes('album')) {
    return 'album';
  }

  if (suppliedType.includes('song')) {
    return 'song';
  }

  if (isPlayableUrl(item?.url)) {
    return 'song';
  }

  if (
    item?.song_count != null ||
    item?.list_count != null ||
    item?.playlist_id != null
  ) {
    return 'playlist';
  }

  return 'album';
}

export function isPlayableUrl(url) {
  if (typeof url !== 'string') {
    return false;
  }

  if (!url.startsWith('https://')) {
    return false;
  }

  return (
    url.includes('saavncdn.com') ||
    /\.(mp4|m4a|aac|mp3)(?:[?#]|$)/i.test(url)
  );
}

export function isSong(item) {
  return (
    typeOf(item) === 'song' &&
    isPlayableUrl(item?.url)
  );
}

export function durationOf(item) {
  const duration = Number(
    item?.duration ||
    item?.duration_seconds ||
    item?.durationSeconds ||
    0
  );

  return Number.isFinite(duration)
    ? Math.max(0, duration)
    : 0;
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

  const minutes = Math.floor(
    safeSeconds / 60
  );

  const remainingSeconds =
    safeSeconds % 60;

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

export function itemKey(item, index = 0) {
  return [
    typeOf(item),
    item?.id ||
      item?.songid ||
      item?.album_id ||
      item?.playlist_id ||
      item?.token ||
      item?.url ||
      titleOf(item),
    index
  ].join(':');
}
