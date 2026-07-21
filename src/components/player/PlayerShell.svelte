<script>
  import {
    onDestroy
  } from 'svelte';

  import MiniPlayer from './MiniPlayer.svelte';
  import FullPlayer from './FullPlayer.svelte';
  import QueueDrawer from './QueueDrawer.svelte';

  import {
    player
  } from '../../stores/player.js';

  let expanded = false;
  let queueOpen = false;

  function openPlayer() {
    expanded = true;
    queueOpen = false;
  }

  function closePlayer() {
    expanded = false;
  }

  function openQueue() {
    queueOpen = true;
  }

  function closeQueue() {
    queueOpen = false;
  }

  $: {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle(
        'player-overlay-open',
        expanded || queueOpen
      );
    }
  }

  onDestroy(() => {
    document.body.classList.remove(
      'player-overlay-open'
    );
  });
</script>

{#if $player.currentTrack}
  <MiniPlayer
    onExpand={openPlayer}
    onQueue={openQueue}
  />

  <FullPlayer
    open={expanded}
    onClose={closePlayer}
    onQueue={openQueue}
  />

  <QueueDrawer
    open={queueOpen}
    onClose={closeQueue}
  />
{/if}
