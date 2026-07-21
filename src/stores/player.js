import {
  get,
  writable
} from 'svelte/store';

import {
  attachAudioElement,
  audio,
  listenToAudio,
  pauseAudio,
  playAudio,
  seekAudio,
  setAudioSource,
  setAudioVolume,
  stopAudio
} from '../services/audioEngine.js';

import {
  clearMediaSession,
  configureMediaSession,
  setMediaMetadata,
  setMediaPlaybackState,
  updateMediaPosition
} from '../services/mediaSession.js';

const initialState = {
  queue: [],
  currentIndex: -1,
  currentTrack: null,

  playing: false,
  buffering: false,

  currentTime: 0,
  duration: 0,
  volume: 1,

  shuffle: false,
  repeat: 'off',

  error: ''
};

export const player = writable(
  initialState
);

let initialized = false;
let removeListeners = [];
let lastPositionUpdate = 0;
let lastUiUpdate = 0;
let firstPlaybackPrepared = false;

function patch(values) {
  player.update((state) => ({
    ...state,
    ...values
  }));
}

function isPlayableSong(song) {
  return Boolean(
    song &&
    typeof song.url === 'string' &&
    song.url.startsWith('https://')
  );
}

function readSavedVolume() {
  try {
    const rawValue =
      localStorage.getItem(
        'systumm-volume-v3'
      );

    /*
     * Number(null) is zero, so the missing-key
     * case must be checked before conversion.
     */
    if (rawValue === null) {
      return 1;
    }

    const saved = Number(rawValue);

    if (
      Number.isFinite(saved) &&
      saved > 0
    ) {
      return Math.max(
        0,
        Math.min(1, saved)
      );
    }
  } catch {
    // Local storage may be blocked.
  }

  return 1;
}

function saveVolume(volume) {
  try {
    localStorage.setItem(
      'systumm-volume-v3',
      String(volume)
    );
  } catch {
    // Ignore storage restrictions.
  }
}

function prepareFirstPlaybackVolume() {
  if (firstPlaybackPrepared) {
    return;
  }

  firstPlaybackPrepared = true;

  /*
   * Maximum HTML audio volume.
   * Android media volume remains controlled
   * by the phone's physical/system controls.
   */
  setAudioVolume(1);
  saveVolume(1);

  patch({
    volume: 1
  });
}

export function initializePlayer() {
  if (initialized) {
    return;
  }

  initialized = true;

  attachAudioElement();

  const savedVolume =
    readSavedVolume();

  setAudioVolume(savedVolume);

  patch({
    volume: savedVolume
  });

  removeListeners = [
    listenToAudio(
      'loadstart',
      () => {
        patch({
          buffering: true,
          error: ''
        });
      }
    ),

    listenToAudio(
      'waiting',
      () => {
        patch({
          buffering: true
        });
      }
    ),

    listenToAudio(
      'canplay',
      () => {
        patch({
          buffering: false
        });
      }
    ),

    listenToAudio(
      'playing',
      () => {
        patch({
          playing: true,
          buffering: false,
          error: ''
        });

        setMediaPlaybackState(
          'playing'
        );
      }
    ),

    listenToAudio(
      'pause',
      () => {
        patch({
          playing: false,
          buffering: false
        });

        setMediaPlaybackState(
          'paused'
        );
      }
    ),

    listenToAudio(
      'loadedmetadata',
      () => {
        patch({
          duration:
            Number.isFinite(audio.duration)
              ? audio.duration
              : 0
        });

        updateMediaPosition(audio);
      }
    ),

    listenToAudio(
      'durationchange',
      () => {
        patch({
          duration:
            Number.isFinite(audio.duration)
              ? audio.duration
              : 0
        });
      }
    ),

    listenToAudio(
      'timeupdate',
      () => {
        const now =
          performance.now();

        /*
         * Avoid updating every subscribed Svelte
         * component on every native timeupdate event.
         */
        if (
          now - lastUiUpdate >= 250 ||
          audio.ended
        ) {
          lastUiUpdate = now;

          patch({
            currentTime:
              audio.currentTime || 0,

            duration:
              Number.isFinite(audio.duration)
                ? audio.duration
                : 0
          });
        }

        if (
          now - lastPositionUpdate >=
          1000
        ) {
          lastPositionUpdate = now;
          updateMediaPosition(audio);
        }
      }
    ),

    listenToAudio(
      'volumechange',
      () => {
        patch({
          volume: audio.muted
            ? 0
            : audio.volume
        });
      }
    ),

    listenToAudio(
      'ended',
      () => {
        nextTrack(true).catch(
          console.error
        );
      }
    ),

    listenToAudio(
      'error',
      () => {
        patch({
          playing: false,
          buffering: false,
          error:
            'This song could not be played.'
        });

        setMediaPlaybackState(
          'none'
        );
      }
    )
  ];

  configureMediaSession({
    play: () => {
      playAudio().catch(() => {
        patch({
          error:
            'Playback could not start.'
        });
      });
    },

    pause: pauseAudio,

    stop: stopPlayer,

    previous: previousTrack,

    next: () => {
      nextTrack(false);
    },

    seekBy: (seconds) => {
      seekAudio(
        audio.currentTime + seconds
      );
    },

    seekTo: (seconds, fastSeek) => {
      if (
        fastSeek &&
        typeof audio.fastSeek ===
          'function'
      ) {
        audio.fastSeek(seconds);
      } else {
        seekAudio(seconds);
      }
    }
  });
}

export async function playAt(index) {
  const state = get(player);

  if (!state.queue.length) {
    return;
  }

  const safeIndex =
    (
      index +
      state.queue.length
    ) % state.queue.length;

  const track =
    state.queue[safeIndex];

  if (!isPlayableSong(track)) {
    patch({
      error:
        'This song has no playable URL.'
    });

    return;
  }

  patch({
    currentIndex: safeIndex,
    currentTrack: track,

    currentTime: 0,
    duration:
      Number(track.duration) || 0,

    buffering: true,
    error: ''
  });

  prepareFirstPlaybackVolume();

  setMediaMetadata(track);

  const sourceChanged =
    setAudioSource(track.url);

  if (!sourceChanged) {
    seekAudio(0);
  }

  try {
    await playAudio();
  } catch (error) {
    console.error(
      'Playback failed:',
      error
    );

    patch({
      playing: false,
      buffering: false,
      error:
        'Tap play to start this song.'
    });
  }
}

export async function playSong(
  song,
  contextSongs = []
) {
  let queue = contextSongs.filter(
    isPlayableSong
  );

  if (!queue.length) {
    queue = isPlayableSong(song)
      ? [song]
      : [];
  }

  if (!queue.length) {
    patch({
      error:
        'No playable songs were found.'
    });

    return;
  }

  let selectedIndex =
    queue.findIndex((item) => {
      return (
        item === song ||
        (
          item?.id &&
          item.id === song?.id
        ) ||
        item?.url === song?.url
      );
    });

  if (selectedIndex < 0) {
    selectedIndex = 0;
  }

  player.update((state) => ({
    ...state,
    queue
  }));

  await playAt(selectedIndex);
}

export async function playQueue(
  songs,
  startIndex = 0
) {
  const queue = songs.filter(
    isPlayableSong
  );

  if (!queue.length) {
    patch({
      error:
        'No playable songs were found.'
    });

    return;
  }

  player.update((state) => ({
    ...state,
    queue
  }));

  await playAt(startIndex);
}

export async function togglePlayback() {
  if (!audio.src) {
    return;
  }

  if (audio.paused) {
    prepareFirstPlaybackVolume();

    try {
      await playAudio();
    } catch {
      patch({
        error:
          'Playback could not start.'
      });
    }
  } else {
    pauseAudio();
  }
}

export async function nextTrack(
  fromEnded = false
) {
  const state = get(player);

  if (!state.queue.length) {
    return;
  }

  if (
    fromEnded &&
    state.repeat === 'one'
  ) {
    seekAudio(0);
    await playAudio();
    return;
  }

  let nextIndex;

  if (
    state.shuffle &&
    state.queue.length > 1
  ) {
    do {
      nextIndex = Math.floor(
        Math.random() *
        state.queue.length
      );
    } while (
      nextIndex ===
      state.currentIndex
    );
  } else {
    nextIndex =
      state.currentIndex + 1;
  }

  if (
    nextIndex >=
    state.queue.length
  ) {
    if (
      state.repeat === 'all' ||
      !fromEnded
    ) {
      nextIndex = 0;
    } else {
      patch({
        playing: false,
        buffering: false
      });

      setMediaPlaybackState(
        'paused'
      );

      return;
    }
  }

  await playAt(nextIndex);
}

export async function previousTrack() {
  const state = get(player);

  if (!state.queue.length) {
    return;
  }

  if (audio.currentTime > 4) {
    seekAudio(0);
    return;
  }

  await playAt(
    state.currentIndex - 1
  );
}

export function seekTo(seconds) {
  seekAudio(seconds);
  updateMediaPosition(audio);
}

export function changeVolume(volume) {
  const safeVolume = Math.max(
    0,
    Math.min(1, Number(volume))
  );

  setAudioVolume(safeVolume);
  saveVolume(safeVolume);
}

export function toggleShuffle() {
  player.update((state) => ({
    ...state,
    shuffle: !state.shuffle
  }));
}

export function cycleRepeat() {
  const modes = [
    'off',
    'all',
    'one'
  ];

  player.update((state) => {
    const currentModeIndex =
      modes.indexOf(state.repeat);

    return {
      ...state,
      repeat:
        modes[
          (
            currentModeIndex + 1
          ) % modes.length
        ]
    };
  });
}

export function stopPlayer() {
  stopAudio();
  clearMediaSession();

  patch({
    playing: false,
    buffering: false,
    currentTime: 0
  });
}

export function destroyPlayer() {
  for (
    const removeListener
    of removeListeners
  ) {
    removeListener();
  }

  removeListeners = [];
  initialized = false;
  firstPlaybackPrepared = false;
}
