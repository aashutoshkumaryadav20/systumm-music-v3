<script>
  import {
    playAt
  } from '../../stores/player.js';

  import {
    player
  } from '../../stores/player.js';

  import {
    imageOf,
    itemKey,
    subtitleOf,
    titleOf
  } from '../../lib/music.js';

  export let open = false;
  export let onClose = () => {};

  async function selectTrack(index) {
    await playAt(index);
    onClose();
  }
</script>

<div
  class="v3-queue-scrim"
  class:open
  role="presentation"
  onclick={onClose}
></div>

<aside
  class="v3-queue-drawer"
  class:open
  aria-hidden={!open}
  aria-label="Playback queue"
>
  <header class="v3-queue-header">
    <div>
      <span>UP NEXT</span>
      <h2>Playback queue</h2>

      <p>
        {$player.queue.length}
        {$player.queue.length === 1 ? ' song' : ' songs'}
      </p>
    </div>

    <button
      type="button"
      aria-label="Close queue"
      onclick={onClose}
    >
      ×
    </button>
  </header>

  <div class="v3-queue-list">
    {#if !$player.queue.length}
      <div class="v3-empty-queue">
        <strong>The queue is empty</strong>
        <p>Select a song to begin playback.</p>
      </div>
    {:else}
      {#each $player.queue as track, index (itemKey(track, index))}
        <button
          class="v3-queue-item"
          class:current={index === $player.currentIndex}
          type="button"
          onclick={() => selectTrack(index)}
        >
          <span class="v3-queue-number">
            {#if index === $player.currentIndex && $player.playing}
              <span class="v3-playing-bars" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
            {:else}
              {index + 1}
            {/if}
          </span>

          {#if imageOf(track)}
            <img
              src={imageOf(track)}
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
            >
          {:else}
            <span class="v3-queue-placeholder">♪</span>
          {/if}

          <span class="v3-queue-copy">
            <strong>{titleOf(track)}</strong>
            <small>{subtitleOf(track) || 'Systumm Music'}</small>
          </span>

          {#if index === $player.currentIndex}
            <span class="v3-current-label">
              Playing
            </span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</aside>
