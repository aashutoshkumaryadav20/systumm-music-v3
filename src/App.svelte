<script>
  import { onMount } from 'svelte';

  import Header from './components/Header.svelte';
  import InstallApp from './components/InstallApp.svelte';
  import HomeTabs from './components/HomeTabs.svelte';
  import HomeSwipe from './components/HomeSwipe.svelte';
  import MusicGrid from './components/MusicGrid.svelte';
  import PlayerShell from './components/player/PlayerShell.svelte';

  import {
    getAlbumSongs,
    getNewReleases,
    getPlaylistSongs,
    getPlaylists,
    getTrending,
    searchMusic
  } from './services/api.js';

  import {
    changeVolume,
    destroyPlayer,
    initializePlayer,
    nextTrack,
    playQueue,
    playSong,
    previousTrack,
    seekTo,
    togglePlayback
  } from './stores/player.js';

  import {
    formatTime,
    imageOf,
    isSong,
    subtitleOf,
    titleOf,
    typeOf
  } from './lib/music.js';

  import {
    player
  } from './stores/player.js';

  const homeViews = [
    'trending',
    'new-releases',
    'playlists'
  ];

  let activeView = 'trending';
  let browseView = 'trending';

  let pageTitle = 'Now Trending';
  let pageDescription =
    'Popular songs people are enjoying right now.';

  let items = [];
  let loading = true;
  let pageError = '';

  let searchQuery = '';
  let online = true;

  let requestController = null;

  const viewCache = new Map();

  let homeSwipe = null;
  let suppressOpenUntil = 0;

  $: isHomeView =
    homeViews.includes(activeView);

  $: playableItems =
    items.filter(isSong);

  $: itemCountText =
    `${items.length} ${
      items.length === 1
        ? 'item'
        : 'items'
    }`;

  onMount(() => {
    initializePlayer();

    online = navigator.onLine;

    const updateConnection = () => {
      online = navigator.onLine;
    };

    window.addEventListener(
      'online',
      updateConnection
    );

    window.addEventListener(
      'offline',
      updateConnection
    );

    loadView('trending')
      .then(prefetchHomeViews)
      .catch(() => {});

    return () => {
      requestController?.abort();

      window.removeEventListener(
        'online',
        updateConnection
      );

      window.removeEventListener(
        'offline',
        updateConnection
      );

      destroyPlayer();
    };
  });

  function createRequest() {
    requestController?.abort();

    requestController =
      new AbortController();

    return requestController.signal;
  }

  function setLoadingState() {
    loading = true;
    pageError = '';
    items = [];
  }

  async function prefetchHomeViews() {
    const definitions = [
      {
        view: 'new-releases',
        pageTitle: 'Fresh Releases',
        pageDescription:
          'Recently released albums and songs.',
        loader: getNewReleases
      },
      {
        view: 'playlists',
        pageTitle: 'Hindi Playlists',
        pageDescription:
          'Collections selected for every mood.',
        loader: getPlaylists
      }
    ];

    await Promise.allSettled(
      definitions.map(
        async (definition) => {
          if (
            viewCache.has(
              definition.view
            )
          ) {
            return;
          }

          const loadedItems =
            await definition.loader();

          viewCache.set(
            definition.view,
            {
              pageTitle:
                definition.pageTitle,

              pageDescription:
                definition.pageDescription,

              items:
                Array.isArray(loadedItems)
                  ? [...loadedItems]
                  : []
            }
          );
        }
      )
    );
  }

  function showCachedView(view) {
    const cached =
      viewCache.get(view);

    if (!cached) {
      return false;
    }

    pageTitle =
      cached.pageTitle;

    pageDescription =
      cached.pageDescription;

    items = [...cached.items];
    loading = false;
    pageError = '';

    return true;
  }

  async function loadView(view) {
    if (!homeViews.includes(view)) {
      view = 'trending';
    }

    activeView = view;
    browseView = view;
    searchQuery = '';

    /*
     * A cached view must also cancel a previous
     * request so stale results cannot overwrite it.
     */
    requestController?.abort();
    requestController = null;

    if (showCachedView(view)) {
      return;
    }

    setLoadingState();

    const signal = createRequest();

    try {
      if (view === 'trending') {
        pageTitle = 'Now Trending';

        pageDescription =
          'Popular songs people are enjoying right now.';

        items = await getTrending(signal);
      } else if (
        view === 'new-releases'
      ) {
        pageTitle = 'Fresh Releases';

        pageDescription =
          'Recently released albums and songs.';

        items =
          await getNewReleases(signal);
      } else {
        pageTitle = 'Hindi Playlists';

        pageDescription =
          'Collections selected for every mood.';

        items =
          await getPlaylists(signal);
      }

      viewCache.set(
        view,
        {
          pageTitle,
          pageDescription,
          items: [...items]
        }
      );
    } catch (error) {
      if (error?.name !== 'AbortError') {
        pageError =
          error?.message ||
          'Music could not be loaded.';
      }
    } finally {
      loading = false;
    }
  }

  function navigateHomeIndex(index) {
    const view =
      homeViews[index];

    if (!view) {
      return;
    }

    return loadView(view);
  }

  function changeHomeView(view) {
    const targetIndex =
      homeViews.indexOf(view);

    if (targetIndex < 0) {
      return;
    }

    if (
      homeSwipe &&
      typeof homeSwipe.navigateTo ===
        'function'
    ) {
      return homeSwipe.navigateTo(
        targetIndex
      );
    }

    return loadView(view);
  }

  async function submitSearch(value) {
    const query = String(
      value || searchQuery
    ).trim();

    if (!query) {
      return;
    }

    searchQuery = query;
    activeView = 'search';

    pageTitle = `Results for “${query}”`;

    pageDescription =
      'Songs, albums and playlists matching your search.';

    setLoadingState();

    const signal = createRequest();

    try {
      items = await searchMusic(
        query,
        signal
      );
    } catch (error) {
      if (error?.name !== 'AbortError') {
        pageError =
          error?.message ||
          'The search could not be completed.';
      }
    } finally {
      loading = false;
    }
  }

  async function openItem(item) {
    if (
      performance.now() <
      suppressOpenUntil
    ) {
      return;
    }

    if (isSong(item)) {
      const surroundingSongs =
        items.filter(isSong);

      await playSong(
        item,
        surroundingSongs
      );

      return;
    }

    setLoadingState();

    const signal = createRequest();

    try {
      const itemType = typeOf(item);

      const result =
        itemType === 'playlist'
          ? await getPlaylistSongs(
              item,
              signal
            )
          : await getAlbumSongs(
              item,
              signal
            );

      activeView = 'collection';

      pageTitle = titleOf(
        result.collection || item
      );

      pageDescription =
        subtitleOf(
          result.collection || item
        ) ||
        (
          itemType === 'playlist'
            ? 'Playlist'
            : 'Album'
        );

      items = Array.isArray(result.songs)
        ? result.songs
        : [];
    } catch (error) {
      if (error?.name !== 'AbortError') {
        pageError =
          error?.message ||
          'This collection could not be opened.';
      }
    } finally {
      loading = false;
    }
  }

  async function playAll() {
    if (!playableItems.length) {
      return;
    }

    await playQueue(
      playableItems,
      0
    );
  }

  function goBack() {
    loadView(browseView);
  }

  function retryCurrentView() {
    if (activeView === 'search') {
      submitSearch(searchQuery);
      return;
    }

    loadView(browseView);
  }
</script>

<svelte:head>
  <title>
    {pageTitle} · Systumm Music
  </title>

  <meta
    name="description"
    content={pageDescription}
  >
</svelte:head>

<Header
  bind:query={searchQuery}
  {online}
  onHome={() => loadView('trending')}
  onSearch={submitSearch}
/>

<InstallApp />

<main>
  <HomeSwipe
    bind:this={homeSwipe}
    enabled={isHomeView}
    activeIndex={
      homeViews.indexOf(activeView)
    }
    pageCount={homeViews.length}
    onNavigate={navigateHomeIndex}
    onSwipeDetected={() => {
      suppressOpenUntil =
        performance.now() + 500;
    }}
  >
  {#if isHomeView}
    <section class="hero">
      <span>
        SYSTUMM MUSIC V3
      </span>

      <h1>
        Discover songs you’ll want on repeat.
      </h1>

      <p>
        Trending tracks, new releases and
        hand-picked Hindi playlists with fast
        direct playback.
      </p>

      <div class="hero-features">
        <small>♪ High-quality playback</small>
        <small>✦ Fresh music</small>
        <small>♡ No sign-in needed</small>
      </div>
    </section>

    <HomeTabs
      active={activeView}
      onChange={changeHomeView}
    />
  {/if}

  <header class="section-header">
    <div class="section-copy">
      <span class="section-kicker">
        {#if activeView === 'search'}
          SEARCH
        {:else if activeView === 'collection'}
          COLLECTION
        {:else}
          DISCOVER
        {/if}
      </span>

      <h2>{pageTitle}</h2>

      <p>
        {pageDescription}
        ·
        {itemCountText}
      </p>
    </div>

    <div class="section-actions">
      {#if activeView === 'collection' && playableItems.length}
        <button
          class="primary-action"
          type="button"
          onclick={playAll}
        >
          ▶ Play all
        </button>
      {/if}

      {#if activeView === 'search' || activeView === 'collection'}
        <button
          class="secondary-button"
          type="button"
          onclick={goBack}
        >
          ← Back
        </button>
      {/if}
    </div>
  </header>

  {#if loading}
    <section
      class="skeleton-grid"
      aria-label="Loading music"
      aria-busy="true"
    >
      {#each Array(8) as _}
        <article class="skeleton-card">
          <div class="skeleton-art"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </article>
      {/each}
    </section>

  {:else if pageError}
    <section class="message error">
      <div>
        <strong>
          Could not load music
        </strong>

        <p>{pageError}</p>

        <button
          type="button"
          onclick={retryCurrentView}
        >
          Try again
        </button>
      </div>
    </section>

  {:else if !items.length}
    <section class="message">
      <div>
        <strong>No music found</strong>

        <p>
          Try another search or browse a
          different section.
        </p>

        <button
          type="button"
          onclick={goBack}
        >
          Return home
        </button>
      </div>
    </section>

  {:else}
    <MusicGrid
      {items}
      currentTrack={$player.currentTrack}
      onOpen={openItem}
    />
  {/if}
  </HomeSwipe>
</main>

<PlayerShell />
