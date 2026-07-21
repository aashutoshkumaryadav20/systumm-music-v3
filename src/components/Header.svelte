<script>
  export let query = '';
  export let online = true;

  export let onHome = () => {};
  export let onSearch = () => {};

  function submitSearch(event) {
    event.preventDefault();
    onSearch(query);
  }
</script>

<header class="topbar">
  <button
    class="brand"
    type="button"
    aria-label="Go to Systumm Music home"
    onclick={onHome}
  >
    <span
      class="brand-icon"
      aria-hidden="true"
    >
      ♪
    </span>

    <span class="brand-copy">
      <strong>Systumm Music</strong>

      <small>
        Made with
        <b>♥</b>
        by Ajay Yadav
      </small>
    </span>
  </button>

  <form
    class="search"
    onsubmit={submitSearch}
  >
    <span
      class="search-symbol"
      aria-hidden="true"
    >
      ⌕
    </span>

    <input
      bind:value={query}
      type="search"
      placeholder="Search songs, albums and artists"
      autocomplete="off"
      enterkeyhint="search"
      aria-label="Search music"
    >

    <button type="submit">
      Search
    </button>
  </form>

  <div
    class="connection-status"
    class:online
    role="status"
    aria-live="polite"
    aria-label={online
      ? 'Music server connected'
      : 'Device is offline'}
  >
    <span class="connection-dot"></span>

    <span class="connection-text">
      {online ? 'Online' : 'Offline'}
    </span>
  </div>
</header>
