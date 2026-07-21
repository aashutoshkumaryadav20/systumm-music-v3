<script>
  import {
    onMount
  } from 'svelte';

  import {
    isStandaloneApp
  } from '../services/pwa.js';

  let installEvent = null;
  let installed = false;
  let dismissed = false;

  onMount(() => {
    installed =
      isStandaloneApp();

    function handleInstallPrompt(event) {
      event.preventDefault();

      installEvent = event;
      dismissed = false;
    }

    function handleInstalled() {
      installed = true;
      installEvent = null;
    }

    window.addEventListener(
      'beforeinstallprompt',
      handleInstallPrompt
    );

    window.addEventListener(
      'appinstalled',
      handleInstalled
    );

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleInstallPrompt
      );

      window.removeEventListener(
        'appinstalled',
        handleInstalled
      );
    };
  });

  async function installApp() {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();

    const result =
      await installEvent.userChoice;

    if (result.outcome === 'accepted') {
      installed = true;
    }

    installEvent = null;
  }
</script>

{#if installEvent && !installed && !dismissed}
  <aside
    class="pwa-install-card"
    aria-label="Install Systumm Music"
  >
    <img
      src="/icons/icon-192.png"
      alt=""
    >

    <div>
      <strong>
        Install Systumm Music
      </strong>

      <small>
        Open it like an Android app.
      </small>
    </div>

    <button
      class="pwa-install-action"
      type="button"
      onclick={installApp}
    >
      Install
    </button>

    <button
      class="pwa-install-close"
      type="button"
      aria-label="Dismiss install message"
      onclick={() => {
        dismissed = true;
      }}
    >
      ×
    </button>
  </aside>
{/if}
