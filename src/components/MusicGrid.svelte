<script>
  import MusicCard from './MusicCard.svelte';

  import {
    itemKey
  } from '../lib/music.js';

  export let items = [];
  export let currentTrack = null;
  export let onOpen = () => {};
</script>

<section
  class="music-grid"
  aria-label="Music results"
>
  {#each items as item, index (itemKey(item, index))}
    <MusicCard
      {item}
      {currentTrack}
      {onOpen}
    />
  {/each}
</section>
