let registrationPromise = null;

export function isStandaloneApp() {
  return Boolean(
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches ||
    window.navigator.standalone === true
  );
}

export async function registerPwa() {
  if (
    !('serviceWorker' in navigator)
  ) {
    return null;
  }

  if (!import.meta.env.PROD) {
    return null;
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  registrationPromise =
    navigator.serviceWorker
      .register(
        '/sw.js',
        {
          scope: '/',
          updateViaCache: 'none'
        }
      )
      .then((registration) => {
        registration.update().catch(
          () => {}
        );

        return registration;
      })
      .catch((error) => {
        registrationPromise = null;

        console.warn(
          'Service worker registration failed:',
          error
        );

        return null;
      });

  return registrationPromise;
}

export async function applyPwaUpdate() {
  const registration =
    await registerPwa();

  if (!registration?.waiting) {
    return false;
  }

  registration.waiting.postMessage({
    type: 'SKIP_WAITING'
  });

  return true;
}
