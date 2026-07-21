import { mount } from 'svelte';

import App from './App.svelte';

import './app.css';
import './phase2.css';
import './phase3.css';
import './phase3b.css';

const target =
  document.getElementById('app');

if (!target) {
  throw new Error(
    'Application root element was not found.'
  );
}

mount(App, {
  target
});
