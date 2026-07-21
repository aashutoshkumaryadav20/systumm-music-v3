<script>
  export let active = 'trending';
  export let onChange = () => {};

  const views = [
    {
      id: 'trending',
      label: '🔥 Trending'
    },
    {
      id: 'new-releases',
      label: '✨ New Releases'
    },
    {
      id: 'playlists',
      label: '▤ Playlists'
    }
  ];
</script>

<nav
  class="tabs"
  aria-label="Browse music"
>
  {#each views as view}
    <button
      class:active={active === view.id}
      type="button"
      aria-current={active === view.id
        ? 'page'
        : undefined}
      onclick={() => onChange(view.id)}
    >
      {view.label}
    </button>
  {/each}
</nav>
