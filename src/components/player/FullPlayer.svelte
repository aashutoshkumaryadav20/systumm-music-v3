<script>
  import { tick } from 'svelte';

  import {
    changeVolume,
    cycleRepeat,
    nextTrack,
    playAt,
    seekTo,
    togglePlayback,
    toggleShuffle
  } from '../../stores/player.js';

  import {
    player
  } from '../../stores/player.js';

  import {
    formatTime,
    imageOf,
    subtitleOf,
    titleOf
  } from '../../lib/music.js';

  import {
    retryPlayback
  } from '../../services/playbackRecovery.js';

  export let open = false;
  export let onClose = () => {};
  export let onQueue = () => {};

  let dragging = false;
  let gestureAxis = '';
  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let dragY = 0;
  let pointerId = null;

  let trackStage = null;
  let switchingTrack = false;

  const visualizerBars = Array.from(
    { length: 12 },
    (_, index) => ({
      delay: `${(index % 7) * -0.08}s`,
      peak: 0.35 + ((index * 17) % 60) / 100
    })
  );

  $: track = $player.currentTrack;

  $: progress = $player.duration > 0
    ? Math.min(
        100,
        ($player.currentTime / $player.duration) * 100
      )
    : 0;

  $: repeatLabel = $player.repeat === 'one'
    ? 'Repeat one'
    : $player.repeat === 'all'
      ? 'Repeat all'
      : 'Repeat off';

  $: dragTransform = dragging
    ? `translate3d(${dragX}px, ${Math.max(0, dragY)}px, 0)`
    : 'translate3d(0, 0, 0)';

  $: dragOpacity = dragging && dragY > 0
    ? Math.max(0.45, 1 - dragY / 450)
    : 1;

  $: horizontalOpacity =
    dragging &&
    gestureAxis === 'horizontal'
      ? Math.max(
          0.55,
          1 - Math.abs(dragX) / 520
        )
      : 1;

  function reducedMotion() {
    return window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }

  async function animateTrackReturn(fromX) {
    if (
      !trackStage ||
      typeof trackStage.animate !==
        'function' ||
      reducedMotion()
    ) {
      return;
    }

    const animation =
      trackStage.animate(
        [
          {
            transform:
              `translate3d(${fromX}px,0,0)`,
            opacity: 0.8
          },
          {
            transform:
              'translate3d(0,0,0)',
            opacity: 1
          }
        ],
        {
          duration: 210,
          easing:
            'cubic-bezier(.2,.8,.2,1)',
          fill: 'both'
        }
      );

    try {
      await animation.finished;
    } catch {
      // Animation can be interrupted.
    } finally {
      animation.cancel();
    }
  }

  async function switchTrack(
    direction,
    fromX = 0
  ) {
    if (switchingTrack) {
      return;
    }

    switchingTrack = true;

    const movingNext =
      direction === 'next';

    const outgoingDirection =
      movingNext ? -1 : 1;

    if (
      trackStage &&
      typeof trackStage.animate ===
        'function' &&
      !reducedMotion()
    ) {
      const outgoing =
        trackStage.animate(
          [
            {
              transform:
                `translate3d(${fromX}px,0,0)`,
              opacity: 1
            },
            {
              transform:
                `translate3d(${outgoingDirection * 28}%,0,0) scale(.97)`,
              opacity: 0
            }
          ],
          {
            duration: 175,
            easing:
              'cubic-bezier(.4,0,1,1)',
            fill: 'forwards'
          }
        );

      try {
        await outgoing.finished;
      } catch {
        // Continue with the track change.
      }

      if (movingNext) {
        await nextTrack(false);
      } else {
        await playAt(
          $player.currentIndex - 1
        );
      }

      await tick();
      outgoing.cancel();

      const incoming =
        trackStage.animate(
          [
            {
              transform:
                `translate3d(${-outgoingDirection * 24}%,0,0) scale(.97)`,
              opacity: 0
            },
            {
              transform:
                'translate3d(0,0,0) scale(1)',
              opacity: 1
            }
          ],
          {
            duration: 275,
            easing:
              'cubic-bezier(.16,.82,.24,1)',
            fill: 'both'
          }
        );

      try {
        await incoming.finished;
      } catch {
        // Animation can be interrupted.
      } finally {
        incoming.cancel();
      }
    } else {
      if (movingNext) {
        await nextTrack(false);
      } else {
        await playAt(
          $player.currentIndex - 1
        );
      }
    }

    switchingTrack = false;
  }

  function startGesture(event) {
    if (
      switchingTrack ||
      event.target.closest(
        'button, input, a, [data-no-gesture]'
      )
    ) {
      return;
    }

    dragging = true;
    gestureAxis = '';

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;

    dragX = 0;
    dragY = 0;

    event.currentTarget.setPointerCapture?.(
      event.pointerId
    );
  }

  function moveGesture(event) {
    if (
      !dragging ||
      event.pointerId !== pointerId
    ) {
      return;
    }

    const differenceX = event.clientX - startX;
    const differenceY = event.clientY - startY;

    if (!gestureAxis) {
      if (
        Math.abs(differenceX) < 8 &&
        Math.abs(differenceY) < 8
      ) {
        return;
      }

      gestureAxis =
        Math.abs(differenceX) >
        Math.abs(differenceY)
          ? 'horizontal'
          : 'vertical';
    }

    if (gestureAxis === 'horizontal') {
      dragX = differenceX * 0.86;
      dragY = 0;
    } else if (differenceY > 0) {
      dragY = differenceY;
      dragX = 0;
    }
  }

  async function finishGesture(event) {
    if (!dragging) {
      return;
    }

    try {
      event.currentTarget.releasePointerCapture?.(
        pointerId
      );
    } catch {
      // Pointer capture may already have ended.
    }

    const finalX = dragX;
    const finalY = dragY;
    const finalAxis = gestureAxis;

    dragging = false;
    pointerId = null;
    gestureAxis = '';

    dragX = 0;
    dragY = 0;

    if (
      finalAxis === 'vertical' &&
      finalY > 85
    ) {
      onClose();
      return;
    }

    if (
      finalAxis === 'horizontal'
    ) {
      if (Math.abs(finalX) > 70) {
        await switchTrack(
          finalX < 0
            ? 'next'
            : 'previous',
          finalX
        );
      } else {
        await animateTrackReturn(
          finalX
        );
      }
    }
  }

  async function cancelGesture() {
    const finalX = dragX;
    const finalAxis = gestureAxis;

    dragging = false;
    pointerId = null;
    gestureAxis = '';

    dragX = 0;
    dragY = 0;

    if (
      finalAxis === 'horizontal' &&
      Math.abs(finalX) > 1
    ) {
      await animateTrackReturn(
        finalX
      );
    }
  }

  function handleKeydown(event) {
    if (!open) {
      return;
    }

    if (event.key === 'Escape') {
      onClose();
    }

    if (
      event.key === 'ArrowRight' &&
      !event.target.closest('input')
    ) {
      switchTrack('next');
    }

    if (
      event.key === 'ArrowLeft' &&
      !event.target.closest('input')
    ) {
      switchTrack('previous');
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<section
  class="v3-full-player"
  class:open
  class:dragging
  aria-hidden={!open}
  aria-label="Maximized music player"
  style={
    dragging &&
    gestureAxis === 'vertical'
      ? `transform:${dragTransform};opacity:${dragOpacity}`
      : ''
  }
>
  {#if track}
    <div class="v3-full-background">
      {#if imageOf(track)}
        <img
          src={imageOf(track)}
          alt=""
          referrerpolicy="no-referrer"
        >
      {/if}
    </div>

    <header class="v3-full-header">
      <button
        class="v3-minimize-button"
        type="button"
        aria-label="Minimize player"
        onclick={onClose}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m5 8 7 7 7-7"></path>
        </svg>
      </button>

      <div>
        <span class="v3-live-dot"></span>
        <strong>Now playing</strong>
      </div>

      <button
        class="v3-full-queue-button"
        type="button"
        aria-label="Open queue"
        onclick={onQueue}
      >
        ☷
      </button>
    </header>

    <main
      bind:this={trackStage}
      class="v3-full-content"
      style={
        dragging &&
        gestureAxis === 'horizontal'
          ? `transform:translate3d(${dragX}px,0,0);opacity:${horizontalOpacity}`
          : ''
      }
    >
      <div
        class="v3-full-gesture-zone"
        role="presentation"
        onpointerdown={startGesture}
        onpointermove={moveGesture}
        onpointerup={finishGesture}
        onpointercancel={cancelGesture}
      >
        <div class="v3-full-art-shell">
          {#if imageOf(track)}
            <img
              class="v3-full-art"
              src={imageOf(track)}
              alt=""
              referrerpolicy="no-referrer"
            >
          {:else}
            <div class="v3-full-art-placeholder">
              ♪
            </div>
          {/if}
        </div>

        <div class="v3-swipe-hint">
          <span>← Previous</span>
          <span>Swipe down to minimize</span>
          <span>Next →</span>
        </div>
      </div>

      <section class="v3-full-details">
        <span class="v3-full-label">
          TRACK {$player.currentIndex + 1}
          OF {$player.queue.length}
        </span>

        <h2>{titleOf(track)}</h2>

        <p>
          {subtitleOf(track) || 'Systumm Music'}
        </p>

        <div
          class="v3-visualizer"
          class:active={$player.playing && !$player.buffering}
          aria-hidden="true"
        >
          {#each visualizerBars as bar}
            <i
              style={`--delay:${bar.delay};--peak:${bar.peak}`}
            ></i>
          {/each}
        </div>

        <div class="v3-full-progress">
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

        <div class="v3-full-controls">
          <button
            type="button"
            aria-label="Previous song"
            onclick={() => switchTrack('previous')}
          >
            ⏮
          </button>

          <button
            class="v3-full-play"
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
            type="button"
            aria-label="Next song"
            onclick={() => switchTrack('next')}
          >
            ⏭
          </button>
        </div>

        <div class="v3-full-tools">
          <button
            class:active={$player.shuffle}
            type="button"
            aria-pressed={$player.shuffle}
            onclick={toggleShuffle}
          >
            ⇄ Shuffle
          </button>

          <button
            class:active={$player.repeat !== 'off'}
            type="button"
            aria-label={repeatLabel}
            onclick={cycleRepeat}
          >
            {$player.repeat === 'one'
              ? '↻¹ Repeat'
              : '↻ Repeat'}
          </button>

          <button
            type="button"
            onclick={onQueue}
          >
            ☷ Queue
          </button>

        </div>

        <div class="v3-full-volume">
          <span aria-hidden="true">
            {$player.volume === 0 ? '🔇' : '🔊'}
          </span>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={$player.volume}
            aria-label="Volume"
            oninput={(event) => {
              changeVolume(
                Number(event.currentTarget.value)
              );
            }}
          >

          <small>
            {Math.round($player.volume * 100)}%
          </small>
        </div>

        {#if $player.error}
          <div class="v3-full-error">
            <span>{$player.error}</span>

            <button
              type="button"
              onclick={retryPlayback}
            >
              Retry playback
            </button>
          </div>
        {/if}
      </section>
    </main>
  {/if}
</section>
