<script>
  import {
    onDestroy,
    tick
  } from 'svelte';

  export let enabled = true;
  export let activeIndex = 0;
  export let pageCount = 3;

  export let onNavigate = () => {};
  export let onSwipeDetected = () => {};

  let viewport = null;
  let stage = null;

  let dragging = false;
  let navigating = false;

  let pointerId = null;
  let axis = '';

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  let rawX = 0;
  let visibleX = 0;

  let pendingX = 0;
  let renderFrame = 0;

  let direction = '';
  let removeClickBlock = null;

  $: safeActiveIndex = Math.max(
    0,
    Math.min(
      pageCount - 1,
      activeIndex
    )
  );

  function reducedMotion() {
    return window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }

  function stopRenderFrame() {
    if (!renderFrame) {
      return;
    }

    cancelAnimationFrame(
      renderFrame
    );

    renderFrame = 0;
  }

  function clearStageStyles() {
    stopRenderFrame();

    if (!stage) {
      return;
    }

    stage.style.removeProperty(
      'transform'
    );

    stage.style.removeProperty(
      'opacity'
    );
  }

  function applyPosition(x) {
    if (!stage) {
      return;
    }

    const width =
      viewport?.clientWidth ||
      window.innerWidth ||
      360;

    const progress = Math.min(
      1,
      Math.abs(x) / width
    );

    stage.style.transform =
      `translate3d(${x}px,0,0) scale(${1 - progress * 0.012})`;

    stage.style.opacity =
      String(
        1 - progress * 0.18
      );
  }

  function schedulePosition(x) {
    pendingX = x;

    if (renderFrame) {
      return;
    }

    renderFrame =
      requestAnimationFrame(() => {
        renderFrame = 0;

        applyPosition(
          pendingX
        );
      });
  }

  async function animateStage(
    keyframes,
    duration,
    easing
  ) {
    stopRenderFrame();

    if (
      !stage ||
      typeof stage.animate !==
        'function' ||
      reducedMotion()
    ) {
      clearStageStyles();
      return;
    }

    const animation =
      stage.animate(
        keyframes,
        {
          duration,
          easing,
          fill: 'both'
        }
      );

    try {
      await animation.finished;
    } catch {
      // A new interaction may cancel it.
    } finally {
      animation.cancel();
    }
  }

  async function returnToCentre(
    fromX
  ) {
    await animateStage(
      [
        {
          transform:
            `translate3d(${fromX}px,0,0) scale(.99)`,
          opacity: 0.9
        },
        {
          transform:
            'translate3d(0,0,0) scale(1)',
          opacity: 1
        }
      ],
      105,
      'cubic-bezier(.2,.8,.2,1)'
    );

    clearStageStyles();
  }

  function blockGestureClick() {
    removeClickBlock?.();

    let timeoutId = null;

    const blockClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener(
        'click',
        blockClick,
        true
      );

      clearTimeout(timeoutId);

      if (
        removeClickBlock === cleanup
      ) {
        removeClickBlock = null;
      }
    };

    window.addEventListener(
      'click',
      blockClick,
      true
    );

    timeoutId = setTimeout(
      cleanup,
      420
    );

    removeClickBlock = cleanup;
  }

  export async function navigateTo(
    targetIndex,
    fromX = 0
  ) {
    if (
      !enabled ||
      navigating ||
      targetIndex === activeIndex ||
      targetIndex < 0 ||
      targetIndex >= pageCount
    ) {
      if (Math.abs(fromX) > 1) {
        await returnToCentre(
          fromX
        );
      }

      return;
    }

    navigating = true;
    onSwipeDetected();

    const movingForward =
      targetIndex > activeIndex;

    const exitDirection =
      movingForward ? -1 : 1;

    direction =
      movingForward
        ? 'next'
        : 'previous';

    const width =
      viewport?.clientWidth ||
      window.innerWidth ||
      360;

    const distance = Math.min(
      105,
      width * 0.25
    );

    /*
     * This is the earlier simple animation
     * with its duration approximately halved.
     */
    await animateStage(
      [
        {
          transform:
            `translate3d(${fromX}px,0,0) scale(1)`,
          opacity: 1
        },
        {
          transform:
            `translate3d(${exitDirection * distance}px,0,0) scale(.985)`,
          opacity: 0
        }
      ],
      85,
      'cubic-bezier(.45,0,1,1)'
    );

    const navigationResult =
      onNavigate(targetIndex);

    await tick();

    await animateStage(
      [
        {
          transform:
            `translate3d(${-exitDirection * distance * 0.82}px,0,0) scale(.985)`,
          opacity: 0
        },
        {
          transform:
            'translate3d(0,0,0) scale(1)',
          opacity: 1
        }
      ],
      140,
      'cubic-bezier(.16,.82,.24,1)'
    );

    clearStageStyles();

    Promise
      .resolve(navigationResult)
      .catch(() => {});

    navigating = false;
    direction = '';
  }

  function startGesture(event) {
    if (
      !enabled ||
      navigating ||
      event.button !== 0 ||
      event.target.closest(
        'input, textarea, select, a, .section-actions, [data-no-home-swipe]'
      )
    ) {
      return;
    }

    dragging = true;

    pointerId =
      event.pointerId;

    axis = '';

    rawX = 0;
    visibleX = 0;

    startX =
      event.clientX;

    startY =
      event.clientY;

    startTime =
      performance.now();

    /*
     * Pointer capture is intentionally not
     * started here. Normal taps remain clicks.
     */
  }

  function moveGesture(event) {
    if (
      !dragging ||
      event.pointerId !== pointerId
    ) {
      return;
    }

    const differenceX =
      event.clientX - startX;

    const differenceY =
      event.clientY - startY;

    rawX = differenceX;

    if (!axis) {
      if (
        Math.abs(differenceX) < 6 &&
        Math.abs(differenceY) < 6
      ) {
        return;
      }

      axis =
        Math.abs(differenceX) >
        Math.abs(differenceY) * 1.08
          ? 'horizontal'
          : 'vertical';

      if (axis === 'horizontal') {
        try {
          event.currentTarget
            .setPointerCapture?.(
              event.pointerId
            );
        } catch {
          // Pointer capture is optional.
        }

        blockGestureClick();
        onSwipeDetected();
      }
    }

    if (axis !== 'horizontal') {
      return;
    }

    event.preventDefault();

    direction =
      differenceX < 0
        ? 'next'
        : 'previous';

    const beforeFirst =
      activeIndex === 0 &&
      differenceX > 0;

    const afterLast =
      activeIndex === pageCount - 1 &&
      differenceX < 0;

    const resistance =
      beforeFirst || afterLast
        ? 0.24
        : 0.95;

    visibleX =
      differenceX * resistance;

    schedulePosition(
      visibleX
    );
  }

  async function finishGesture(event) {
    if (
      !dragging ||
      event.pointerId !== pointerId
    ) {
      return;
    }

    try {
      event.currentTarget
        .releasePointerCapture?.(
          pointerId
        );
    } catch {
      // It may not have been captured.
    }

    const finalRawX =
      rawX;

    const finalVisibleX =
      visibleX;

    const finalAxis =
      axis;

    const elapsed = Math.max(
      1,
      performance.now() - startTime
    );

    const velocity =
      finalRawX / elapsed;

    dragging = false;
    pointerId = null;
    axis = '';

    rawX = 0;
    visibleX = 0;

    if (
      finalAxis !== 'horizontal'
    ) {
      clearStageStyles();
      direction = '';
      return;
    }

    const qualifies =
      Math.abs(finalRawX) >= 40 ||
      Math.abs(velocity) >= 0.24;

    if (!qualifies) {
      await returnToCentre(
        finalVisibleX
      );

      direction = '';
      return;
    }

    const targetIndex =
      finalRawX < 0
        ? activeIndex + 1
        : activeIndex - 1;

    await navigateTo(
      targetIndex,
      finalVisibleX
    );
  }

  async function cancelGesture() {
    const finalX =
      visibleX;

    const wasHorizontal =
      axis === 'horizontal';

    dragging = false;
    pointerId = null;
    axis = '';

    rawX = 0;
    visibleX = 0;

    if (
      wasHorizontal &&
      Math.abs(finalX) > 1
    ) {
      await returnToCentre(
        finalX
      );
    } else {
      clearStageStyles();
    }

    direction = '';
  }

  onDestroy(() => {
    removeClickBlock?.();
    stopRenderFrame();
  });
</script>

<div
  class="home-swipe-shell"
  class:dragging
  class:navigating
  class:direction-next={
    direction === 'next'
  }
  class:direction-previous={
    direction === 'previous'
  }
>
  <div
    class="home-page-indicator"
    aria-hidden="true"
  >
    {#each Array(pageCount) as _, index}
      <span
        class:active={
          index === safeActiveIndex
        }
      ></span>
    {/each}
  </div>

  <div
    bind:this={viewport}
    class="home-swipe-viewport"
    onpointerdown={startGesture}
    onpointermove={moveGesture}
    onpointerup={finishGesture}
    onpointercancel={cancelGesture}
  >
    <div
      bind:this={stage}
      class="home-swipe-stage"
    >
      <slot></slot>
    </div>
  </div>
</div>
