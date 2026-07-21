<script>
  import {
    nextTrack,
    previousTrack,
    seekTo,
    togglePlayback
  } from '../../stores/player.js';

  import { player } from '../../stores/player.js';

  import {
    formatTime,
    imageOf,
    subtitleOf,
    titleOf
  } from '../../lib/music.js';

  import {
    retryPlayback
  } from '../../services/playbackRecovery.js';

  export let onExpand = () => {};
  export let onQueue = () => {};

  $: track = $player.currentTrack;

  $: progress = $player.duration > 0
    ? Math.min(
        100,
        ($player.currentTime / $player.duration) * 100
      )
    : 0;
</script>

{#if track}
  <aside
    class="v3-mini-player"
    aria-label="Current music player"
  >
    <button
      class="v3-mini-info"
      type="button"
      aria-label={`Open player for ${titleOf(track)}`}
      onclick={onExpand}
    >
      {#if imageOf(track)}
        <img
          src={imageOf(track)}
          alt=""
          referrerpolicy="no-referrer"
        >
      {:else}
        <span class="v3-mini-placeholder">♪</span>
      {/if}

      <span class="v3-mini-copy">
        <strong>{titleOf(track)}</strong>
        <small>{subtitleOf(track) || 'Systumm Music'}</small>

        <span class="v3-track-position">
          {$player.currentIndex + 1}
          of
          {$player.queue.length}
        </span>
      </span>
    </button>

    <div class="v3-mini-controls">
      <button
        class="v3-mini-previous"
        type="button"
        aria-label="Previous song"
        onclick={previousTrack}
      >
        ⏮
      </button>

      <button
        class="v3-mini-main-play"
        type="button"
        aria-label={$player.playing ? 'Pause' : 'Play'}
        onclick={togglePlayback}
      >
        {#if $player.buffering}
          <span class="v3-control-spinner"></span>
        {:else if $player.playing}
          ❚❚
        {:else}
          ▶
        {/if}
      </button>

      <button
        class="v3-mini-next"
        type="button"
        aria-label="Next song"
        onclick={() => nextTrack(false)}
      >
        ⏭
      </button>
    </div>

    <div class="v3-mini-time">
      <span>{formatTime($player.currentTime)}</span>

      <input
        type="range"
        min="0"
        max={$player.duration || 0}
        step="0.1"
        value={$player.currentTime}
        style={`--player-progress:${progress}%`}
        aria-label="Song position"
        oninput={(event) => {
          seekTo(Number(event.currentTarget.value));
        }}
      >

      <span>{formatTime($player.duration)}</span>
    </div>

    <button
      class="v3-mini-queue"
      type="button"
      aria-label={`Open queue with ${$player.queue.length} songs`}
      onclick={onQueue}
    >
      <span aria-hidden="true">☷</span>
      <small>{$player.queue.length}</small>
    </button>

    {#if $player.error}
      <div class="v3-player-error">
        <span>{$player.error}</span>

        <button
          type="button"
          onclick={retryPlayback}
        >
          Retry
        </button>
      </div>
    {/if}
  </aside>
{/if}
