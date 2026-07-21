export const audio = new Audio();

audio.id = 'systumm-main-audio';
audio.preload = 'auto';
audio.playsInline = true;
audio.crossOrigin = 'anonymous';

audio.setAttribute('playsinline', '');
audio.setAttribute('webkit-playsinline', '');
audio.setAttribute('disablepictureinpicture', '');
audio.hidden = true;

export function attachAudioElement() {
  if (!audio.isConnected) {
    document.body.appendChild(audio);
  }
}

export function setAudioSource(url) {
  if (
    typeof url !== 'string' ||
    !url.startsWith('https://')
  ) {
    throw new Error(
      'This song does not contain a valid HTTPS audio URL.'
    );
  }

  const absoluteUrl = new URL(
    url,
    window.location.href
  ).href;

  const changed = audio.src !== absoluteUrl;

  if (changed) {
    audio.src = absoluteUrl;
  }

  return changed;
}

export async function playAudio() {
  await audio.play();
}

export function pauseAudio() {
  audio.pause();
}

export function stopAudio() {
  audio.pause();

  try {
    audio.currentTime = 0;
  } catch {
    // Audio metadata may not be available yet.
  }
}

export function seekAudio(seconds) {
  const requestedTime = Number(seconds);

  if (!Number.isFinite(requestedTime)) {
    return;
  }

  const maximum = Number.isFinite(audio.duration)
    ? audio.duration
    : requestedTime;

  audio.currentTime = Math.max(
    0,
    Math.min(requestedTime, maximum)
  );
}

export function setAudioVolume(volume) {
  const safeVolume = Math.max(
    0,
    Math.min(1, Number(volume))
  );

  audio.muted = false;
  audio.volume = safeVolume;
}

export function listenToAudio(
  eventName,
  handler
) {
  audio.addEventListener(
    eventName,
    handler
  );

  return () => {
    audio.removeEventListener(
      eventName,
      handler
    );
  };
}

export function reloadAudioSource(url) {
  if (
    typeof url !== 'string' ||
    !url.startsWith('https://')
  ) {
    throw new Error(
      'A valid HTTPS audio URL is required.'
    );
  }

  const absoluteUrl = new URL(
    url,
    window.location.href
  ).href;

  audio.pause();
  audio.src = absoluteUrl;
  audio.load();
}
