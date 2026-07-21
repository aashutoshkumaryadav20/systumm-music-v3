<script>
  import {
    imageOf,
    isSong,
    subtitleOf,
    titleOf,
    typeOf
  } from '../lib/music.js';

  export let item;
  export let currentTrack = null;
  export let onOpen = () => {};

  $: itemType = typeOf(item);

  $: playing = (
    isSong(item) &&
    currentTrack &&
    (
      currentTrack === item ||
      currentTrack?.id === item?.id ||
      currentTrack?.url === item?.url
    )
  );
</script>

<button
  class="music-card"
  class:playing
  type="button"
  aria-label={
    isSong(item)
      ? `Play ${titleOf(item)}`
      : `Open ${titleOf(item)}`
  }
  onclick={() => onOpen(item)}
>
  <div class="artwork">
    {#if imageOf(item)}
      <img
        src={imageOf(item)}
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      >
    {:else}
      <span
        class="artwork-placeholder"
        aria-hidden="true"
      >
        ♪
      </span>
    {/if}

    <span class="type-badge">
      {itemType}
    </span>

    <span
      class="play-badge"
      aria-hidden="true"
    >
      {#if playing}
        ❚❚
      {:else if isSong(item)}
        ▶
      {:else}
        →
      {/if}
    </span>
  </div>

  <strong title={titleOf(item)}>
    {titleOf(item)}
  </strong>

  <small title={subtitleOf(item)}>
    {subtitleOf(item) || 'Systumm Music'}
  </small>
</button>
