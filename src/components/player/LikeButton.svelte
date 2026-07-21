<script>
  import {
    favourites,
    isFavourite,
    toggleFavourite
  } from '../../stores/library.js';

  export let track;
  export let large = false;

  $: liked =
    isFavourite(
      track,
      $favourites
    );

  function toggle(event) {
    event.stopPropagation();
    toggleFavourite(track);
  }
</script>

<button
  class="v3-like-button"
  class:liked
  class:large
  type="button"
  aria-pressed={liked}
  aria-label={liked
    ? 'Remove from favourites'
    : 'Add to favourites'}
  onclick={toggle}
>
  {liked ? '♥' : '♡'}
</button>
