import {
  get
} from 'svelte/store';

import {
  player
} from '../stores/player.js';

import {
  audio,
  playAudio,
  reloadAudioSource
} from './audioEngine.js';

import {
  setMediaMetadata
} from './mediaSession.js';

let started = false;
let recovering = false;
let attempts = 0;

let stalledTimer = null;
let cleanupFunctions = [];

const MAX_ATTEMPTS = 2;

function patch(values) {
  player.update((state) => ({
    ...state,
    ...values
  }));
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function waitForMetadata(timeout = 6000) {
  return new Promise((resolve) => {
    if (audio.readyState >= 1) {
      resolve();
      return;
    }

    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timer);

      audio.removeEventListener(
        'loadedmetadata',
        finish
      );

      audio.removeEventListener(
        'canplay',
        finish
      );

      resolve();
    };

    const timer = setTimeout(
      finish,
      timeout
    );

    audio.addEventListener(
      'loadedmetadata',
      finish
    );

    audio.addEventListener(
      'canplay',
      finish
    );
  });
}

async function recoverPlayback(
  reason = 'network'
) {
  if (recovering) {
    return;
  }

  const state = get(player);
  const track = state.currentTrack;

  if (
    !track ||
    typeof track.url !== 'string'
  ) {
    return;
  }

  if (!navigator.onLine) {
    patch({
      buffering: false,
      playing: false,
      error:
        'You are offline. Playback will retry when the connection returns.'
    });

    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    patch({
      buffering: false,
      playing: false,
      error:
        'Playback was interrupted. Tap Retry to reconnect.'
    });

    return;
  }

  recovering = true;
  attempts += 1;

  const resumePosition =
    Number(audio.currentTime) ||
    Number(state.currentTime) ||
    0;

  const shouldResume =
    state.playing ||
    !audio.paused;

  patch({
    buffering: true,
    error:
      `Reconnecting… attempt ${attempts} of ${MAX_ATTEMPTS}`
  });

  try {
    await wait(
      reason === 'manual'
        ? 100
        : attempts * 650
    );

    reloadAudioSource(track.url);
    setMediaMetadata(track);

    await waitForMetadata();

    if (resumePosition > 0) {
      try {
        const maximum =
          Number.isFinite(audio.duration)
            ? Math.max(
                0,
                audio.duration - 0.5
              )
            : resumePosition;

        audio.currentTime = Math.min(
          resumePosition,
          maximum
        );
      } catch {
        // Seeking can fail until metadata settles.
      }
    }

    if (shouldResume || reason === 'manual') {
      await playAudio();
    }

    patch({
      buffering: false,
      error: ''
    });
  } catch (error) {
    console.error(
      'Playback recovery failed:',
      error
    );

    patch({
      buffering: false,
      playing: false,
      error:
        attempts >= MAX_ATTEMPTS
          ? 'Playback could not reconnect. Tap Retry.'
          : 'Playback connection was interrupted.'
    });
  } finally {
    recovering = false;
  }
}

export async function retryPlayback() {
  attempts = 0;

  await recoverPlayback('manual');
}

export function startPlaybackRecovery() {
  if (started) {
    return stopPlaybackRecovery;
  }

  started = true;

  const handlePlaying = () => {
    clearTimeout(stalledTimer);

    attempts = 0;
    recovering = false;

    patch({
      buffering: false,
      error: ''
    });
  };

  const handleError = () => {
    recoverPlayback('error');
  };

  const handleStalled = () => {
    clearTimeout(stalledTimer);

    if (audio.paused) {
      return;
    }

    stalledTimer = setTimeout(() => {
      recoverPlayback('stalled');
    }, 4500);
  };

  const handleWaiting = () => {
    if (!audio.paused) {
      patch({
        buffering: true
      });
    }
  };

  const handleOffline = () => {
    if (!audio.paused) {
      patch({
        buffering: true,
        error:
          'Internet connection lost. Waiting to reconnect…'
      });
    }
  };

  const handleOnline = () => {
    const state = get(player);

    if (
      state.currentTrack &&
      state.error
    ) {
      attempts = 0;
      recoverPlayback('online');
    }
  };

  audio.addEventListener(
    'playing',
    handlePlaying
  );

  audio.addEventListener(
    'error',
    handleError
  );

  audio.addEventListener(
    'stalled',
    handleStalled
  );

  audio.addEventListener(
    'waiting',
    handleWaiting
  );

  window.addEventListener(
    'offline',
    handleOffline
  );

  window.addEventListener(
    'online',
    handleOnline
  );

  cleanupFunctions = [
    () => audio.removeEventListener(
      'playing',
      handlePlaying
    ),

    () => audio.removeEventListener(
      'error',
      handleError
    ),

    () => audio.removeEventListener(
      'stalled',
      handleStalled
    ),

    () => audio.removeEventListener(
      'waiting',
      handleWaiting
    ),

    () => window.removeEventListener(
      'offline',
      handleOffline
    ),

    () => window.removeEventListener(
      'online',
      handleOnline
    )
  ];

  return stopPlaybackRecovery;
}

export function stopPlaybackRecovery() {
  clearTimeout(stalledTimer);

  for (
    const cleanup
    of cleanupFunctions
  ) {
    cleanup();
  }

  cleanupFunctions = [];

  started = false;
  recovering = false;
  attempts = 0;
}
