import {
  player
} from '../stores/player.js';

import {
  audio,
  setAudioSource,
  setAudioVolume
} from './audioEngine.js';

import {
  setMediaMetadata,
  setMediaPlaybackState
} from './mediaSession.js';

import {
  readJson,
  writeJson
} from './storage.js';

const PLAYER_STATE_KEY =
  'systumm-music-player-state-v2';

let unsubscribe = null;
let saveTimer = null;
let restored = false;

function validTrack(track) {
  return Boolean(
    track &&
    typeof track === 'object' &&
    typeof track.url === 'string' &&
    track.url.startsWith('https://')
  );
}

function saveSnapshot(state) {
  const queue = Array.isArray(state.queue)
    ? state.queue.filter(validTrack)
    : [];

  const snapshot = {
    queue,
    currentIndex:
      Number.isInteger(state.currentIndex)
        ? state.currentIndex
        : -1,

    currentTime:
      Number.isFinite(state.currentTime)
        ? state.currentTime
        : 0,

    volume:
      Number.isFinite(state.volume)
        ? state.volume
        : 1,

    shuffle: Boolean(state.shuffle),

    repeat: [
      'off',
      'all',
      'one'
    ].includes(state.repeat)
      ? state.repeat
      : 'off'
  };

  writeJson(
    PLAYER_STATE_KEY,
    snapshot
  );
}

function restorePosition(seconds) {
  const position = Number(seconds);

  if (
    !Number.isFinite(position) ||
    position <= 0
  ) {
    return;
  }

  const applyPosition = () => {
    try {
      const maximum =
        Number.isFinite(audio.duration)
          ? Math.max(0, audio.duration - 0.5)
          : position;

      audio.currentTime = Math.min(
        position,
        maximum
      );
    } catch {
      // Metadata may not be ready yet.
    }
  };

  if (audio.readyState >= 1) {
    applyPosition();
  } else {
    audio.addEventListener(
      'loadedmetadata',
      applyPosition,
      {
        once: true
      }
    );
  }
}

export function restorePlayerState() {
  if (restored) {
    return;
  }

  restored = true;

  const snapshot = readJson(
    PLAYER_STATE_KEY,
    null
  );

  if (
    !snapshot ||
    !Array.isArray(snapshot.queue)
  ) {
    return;
  }

  const queue =
    snapshot.queue.filter(validTrack);

  if (!queue.length) {
    return;
  }

  let currentIndex = Number(
    snapshot.currentIndex
  );

  if (
    !Number.isInteger(currentIndex) ||
    currentIndex < 0 ||
    currentIndex >= queue.length
  ) {
    currentIndex = 0;
  }

  const currentTrack =
    queue[currentIndex];

  const storedVolume =
    Number(snapshot.volume);

  const volume =
    Number.isFinite(storedVolume)
      ? Math.max(
          0,
          Math.min(1, storedVolume)
        )
      : 1;

  setAudioVolume(volume);
  setAudioSource(currentTrack.url);
  setMediaMetadata(currentTrack);
  setMediaPlaybackState('paused');

  player.update((state) => ({
    ...state,

    queue,
    currentIndex,
    currentTrack,

    playing: false,
    buffering: false,

    currentTime:
      Number(snapshot.currentTime) || 0,

    duration:
      Number(currentTrack.duration) || 0,

    volume,
    shuffle:
      Boolean(snapshot.shuffle),

    repeat: [
      'off',
      'all',
      'one'
    ].includes(snapshot.repeat)
      ? snapshot.repeat
      : 'off',

    error: ''
  }));

  restorePosition(
    snapshot.currentTime
  );
}

export function startPlayerPersistence() {
  restorePlayerState();

  if (unsubscribe) {
    return stopPlayerPersistence;
  }

  unsubscribe = player.subscribe(
    (state) => {
      clearTimeout(saveTimer);

      saveTimer = setTimeout(() => {
        saveSnapshot(state);
      }, 700);
    }
  );

  return stopPlayerPersistence;
}

export function stopPlayerPersistence() {
  clearTimeout(saveTimer);
  saveTimer = null;

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
