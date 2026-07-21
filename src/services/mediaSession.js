let handlersConfigured = false;
let metadataKey = '';

function cleanText(value) {
  if (value == null) {
    return '';
  }

  if (Array.isArray(value)) {
    return value
      .map(cleanText)
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    return cleanText(
      value.text ||
      value.name ||
      value.title ||
      ''
    );
  }

  return String(value)
    .replace(/<[^>]*>/g, '')
    .replaceAll('&amp;', '&')
    .trim();
}

function titleOf(song) {
  return cleanText(
    song?.title ||
    song?.name ||
    'Untitled'
  );
}

function artistOf(song) {
  return cleanText(
    song?.subtitle ||
    song?.artist ||
    song?.artists ||
    song?.primary_artists ||
    'Systumm Music'
  );
}

function albumOf(song) {
  return cleanText(
    song?.album ||
    song?.album_name ||
    'Systumm Music'
  );
}

function imageOf(song) {
  let image =
    song?.image ||
    song?.artwork ||
    '';

  if (Array.isArray(image)) {
    image = image.at(-1);
  }

  if (
    image &&
    typeof image === 'object'
  ) {
    image =
      image.url ||
      image.link ||
      image.src ||
      '';
  }

  return typeof image === 'string'
    ? image
    : '';
}

function artworkOf(song) {
  const image = imageOf(song);

  if (!image.startsWith('https://')) {
    return [];
  }

  return [
    {
      src: image,
      sizes: '500x500'
    }
  ];
}

export function configureMediaSession(
  actions
) {
  if (
    handlersConfigured ||
    !('mediaSession' in navigator)
  ) {
    return;
  }

  handlersConfigured = true;

  function register(name, handler) {
    try {
      navigator.mediaSession.setActionHandler(
        name,
        handler
      );
    } catch (error) {
      console.debug(
        `Unsupported Media Session action: ${name}`,
        error
      );
    }
  }

  register('play', actions.play);
  register('pause', actions.pause);
  register('stop', actions.stop);

  register(
    'previoustrack',
    actions.previous
  );

  register(
    'nexttrack',
    actions.next
  );

  register('seekbackward', (details) => {
    actions.seekBy(
      -(details.seekOffset || 10)
    );
  });

  register('seekforward', (details) => {
    actions.seekBy(
      details.seekOffset || 10
    );
  });

  register('seekto', (details) => {
    if (details.seekTime == null) {
      return;
    }

    actions.seekTo(
      details.seekTime,
      Boolean(details.fastSeek)
    );
  });
}

export function setMediaMetadata(song) {
  if (
    !song ||
    !('mediaSession' in navigator) ||
    typeof MediaMetadata === 'undefined'
  ) {
    return;
  }

  const nextKey = String(
    song?.id ||
    song?.url ||
    titleOf(song)
  );

  if (nextKey === metadataKey) {
    return;
  }

  metadataKey = nextKey;

  try {
    navigator.mediaSession.metadata =
      new MediaMetadata({
        title: titleOf(song),
        artist: artistOf(song),
        album: albumOf(song),
        artwork: artworkOf(song)
      });
  } catch (error) {
    console.warn(
      'Media Session metadata failed:',
      error
    );
  }
}

export function setMediaPlaybackState(
  state
) {
  if (!('mediaSession' in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.playbackState =
      state;
  } catch {
    // Ignore partially supported browsers.
  }
}

export function updateMediaPosition(
  audioElement
) {
  if (
    !('mediaSession' in navigator) ||
    typeof navigator.mediaSession
      .setPositionState !== 'function'
  ) {
    return;
  }

  const duration = Number(
    audioElement.duration
  );

  const position = Number(
    audioElement.currentTime
  );

  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(position)
  ) {
    return;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate:
        audioElement.playbackRate || 1,
      position: Math.max(
        0,
        Math.min(position, duration)
      )
    });
  } catch {
    // Ignore temporary position-state errors.
  }
}

export function clearMediaSession() {
  metadataKey = '';

  if (!('mediaSession' in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState =
      'none';
  } catch {
    // Ignore unsupported browser behavior.
  }
}
