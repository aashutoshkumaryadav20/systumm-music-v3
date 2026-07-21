import {
  mount
} from 'svelte';

import App from './App.svelte';

import {
  registerPwa
} from './services/pwa.js';

import './app.css';
import './phase2.css';
import './phase3.css';
import './phase3b.css';
import './phase4.css';
import './phase5.css';

try {
  localStorage.removeItem(
    'systumm-music-favourites-v1'
  );

  localStorage.removeItem(
    'systumm-volume'
  );

  localStorage.removeItem(
    'systumm-music-player-state-v1'
  );
} catch {
  // Storage may be blocked.
}

const target =
  document.getElementById('app');

if (!target) {
  throw new Error(
    'Application root element was not found.'
  );
}

mount(
  App,
  {
    target
  }
);

registerPwa().catch((error) => {
  console.warn(
    'PWA registration failed:',
    error
  );
});
