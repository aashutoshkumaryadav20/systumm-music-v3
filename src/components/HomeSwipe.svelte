<script>
  import {
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
  let animationFrame = 0;

  let swipeDirection = '';

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

  function cancelRenderFrame() {
    if (animationFrame) {
      cancelAnimationFrame(
        animationFrame
      );

      animationFrame = 0;
    }
  }

  function applyStagePosition(x) {
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

    const scale =
      1 - progress * 0.018;

    const opacity =
      1 - progress * 0.24;

    stage.style.transform =
      `translate3d(${x}px,0,0) scale(${scale})`;

    stage.style.opacity =
      String(opacity);
  }

  function scheduleStagePosition(x) {
    pendingX = x;

    if (animationFrame) {
      return;
    }

    animationFrame =
      requestAnimationFrame(() => {
        animationFrame = 0;
        applyStagePosition(
          pendingX
        );
      });
  }

  function clearStageStyle() {
    cancelRenderFrame();

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

  async function animateStage(
    keyframes,
    duration,
    easing
  ) {
    cancelRenderFrame();

    if (
      !stage ||
      typeof stage.animate !==
        'function' ||
      reducedMotion()
    ) {
      clearStageStyle();
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
      // A new gesture may interrupt it.
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
      120,
      'cubic-bezier(.2,.8,.2,1)'
    );

    clearStageStyle();
  }

  function vibrateLightly() {
    try {
      navigator.vibrate?.(5);
    } catch {
      // Vibration is optional.
    }
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

    const direction =
      movingForward ? -1 : 1;

    swipeDirection =
      movingForward
        ? 'left'
        : 'right';

    const width =
      viewport?.clientWidth ||
      window.innerWidth ||
      360;

    const exitDistance = Math.min(
      105,
      width * 0.25
    );

    /*
     * Quick outgoing movement.
     * We hide only enough to change the page
     * without a visible content jump.
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
            `translate3d(${direction * exitDistance}px,0,0) scale(.985)`,
          opacity: 0.08
        }
      ],
      85,
      'cubic-bezier(.45,0,1,1)'
    );

    /*
     * loadView updates cached content or the
     * loading skeleton synchronously before its
     * network request finishes.
     */
    const navigationResult =
      onNavigate(targetIndex);

    await tick();

    await animateStage(
      [
        {
          transform:
            `translate3d(${-direction * exitDistance * 0.82}px,0,0) scale(.985)`,
          opacity: 0.08
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

    clearStageStyle();
    vibrateLightly();

    Promise
      .resolve(navigationResult)
      .catch(() => {});

    navigating = false;
    swipeDirection = '';
  }

  function startGesture(event) {
    if (
      !enabled ||
      navigating ||
      event.button !== 0 ||
      event.target.closest(
        'input, a, .section-actions'
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

    event.currentTarget
      .setPointerCapture?.(
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
        onSwipeDetected();
      }
    }

    if (axis !== 'horizontal') {
      return;
    }

    swipeDirection =
      differenceX < 0
        ? 'left'
        : 'right';

    const beforeFirst =
      activeIndex === 0 &&
      differenceX > 0;

    const afterLast =
      activeIndex === pageCount - 1 &&
      differenceX < 0;

    const resistance =
      beforeFirst || afterLast
        ? 0.22
        : 0.96;

    visibleX =
      differenceX * resistance;

    scheduleStagePosition(
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
      // Capture may already be released.
    }

    const finalRawX = rawX;
    const finalVisibleX =
      visibleX;

    const finalAxis = axis;

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
      clearStageStyle();
      swipeDirection = '';
      return;
    }

    /*
     * Short, quick gestures now work.
     */
    const qualifies =
      Math.abs(finalRawX) >= 42 ||
      Math.abs(velocity) >= 0.26;

    if (!qualifies) {
      await returnToCentre(
        finalVisibleX
      );

      swipeDirection = '';
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
      clearStageStyle();
    }

    swipeDirection = '';
  }
</script>

<div
  class="home-swipe-shell"
  class:navigating
  class:swiping-left={
    swipeDirection === 'left'
  }
  class:swiping-right={
    swipeDirection === 'right'
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
      class:dragging
    >
      <slot></slot>
    </div>
  </div>
</div>
