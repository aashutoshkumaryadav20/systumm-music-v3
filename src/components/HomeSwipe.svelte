<script>
  import {
    tick
  } from 'svelte';

  export let enabled = true;
  export let activeIndex = 0;
  export let pageCount = 3;

  export let onNavigate = () => {};
  export let onSwipeDetected = () => {};

  let stage = null;

  let dragging = false;
  let navigating = false;

  let pointerId = null;
  let axis = '';

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  let dragX = 0;

  $: stageStyle =
    dragging &&
    axis === 'horizontal'
      ? [
          `transform:translate3d(${dragX}px,0,0)`,
          `opacity:${Math.max(
            0.64,
            1 - Math.abs(dragX) / 700
          )}`
        ].join(';')
      : '';

  function reducedMotion() {
    return window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }

  async function animateStage(
    keyframes,
    duration
  ) {
    if (
      !stage ||
      typeof stage.animate !== 'function' ||
      reducedMotion()
    ) {
      return;
    }

    const animation = stage.animate(
      keyframes,
      {
        duration,
        easing:
          'cubic-bezier(.2,.8,.2,1)',
        fill: 'both'
      }
    );

    try {
      await animation.finished;
    } catch {
      // An interrupted gesture can cancel it.
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
            `translate3d(${fromX}px,0,0)`,
          opacity: 0.8
        },
        {
          transform:
            'translate3d(0,0,0)',
          opacity: 1
        }
      ],
      220
    );
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
        await returnToCentre(fromX);
      }

      return;
    }

    navigating = true;
    onSwipeDetected();

    const movingForward =
      targetIndex > activeIndex;

    const exitDirection =
      movingForward ? -1 : 1;

    await animateStage(
      [
        {
          transform:
            `translate3d(${fromX}px,0,0)`,
          opacity: 1
        },
        {
          transform:
            `translate3d(${exitDirection * 24}%,0,0)`,
          opacity: 0
        }
      ],
      170
    );

    /*
     * loadView changes to the skeleton immediately,
     * while its API request can continue separately.
     */
    const navigationResult =
      onNavigate(targetIndex);

    await tick();

    await animateStage(
      [
        {
          transform:
            `translate3d(${-exitDirection * 20}%,0,0)`,
          opacity: 0
        },
        {
          transform:
            'translate3d(0,0,0)',
          opacity: 1
        }
      ],
      280
    );

    Promise
      .resolve(navigationResult)
      .catch(() => {});

    navigating = false;
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
    pointerId = event.pointerId;

    axis = '';
    dragX = 0;

    startX = event.clientX;
    startY = event.clientY;
    startTime = performance.now();

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

    if (!axis) {
      if (
        Math.abs(differenceX) < 9 &&
        Math.abs(differenceY) < 9
      ) {
        return;
      }

      axis =
        Math.abs(differenceX) >
        Math.abs(differenceY)
          ? 'horizontal'
          : 'vertical';

      if (axis === 'horizontal') {
        onSwipeDetected();
      }
    }

    if (axis !== 'horizontal') {
      return;
    }

    const movingBeforeFirst =
      activeIndex === 0 &&
      differenceX > 0;

    const movingAfterLast =
      activeIndex === pageCount - 1 &&
      differenceX < 0;

    const resistance =
      movingBeforeFirst ||
      movingAfterLast
        ? 0.28
        : 0.84;

    dragX =
      differenceX * resistance;
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

    const finalX = dragX;
    const finalAxis = axis;

    const elapsed = Math.max(
      1,
      performance.now() - startTime
    );

    const velocity =
      finalX / elapsed;

    dragging = false;
    pointerId = null;
    axis = '';
    dragX = 0;

    if (finalAxis !== 'horizontal') {
      return;
    }

    const qualifies =
      Math.abs(finalX) >= 64 ||
      Math.abs(velocity) >= 0.42;

    if (!qualifies) {
      await returnToCentre(finalX);
      return;
    }

    const targetIndex =
      finalX < 0
        ? activeIndex + 1
        : activeIndex - 1;

    await navigateTo(
      targetIndex,
      finalX
    );
  }

  async function cancelGesture() {
    const finalX = dragX;
    const finalAxis = axis;

    dragging = false;
    pointerId = null;
    axis = '';
    dragX = 0;

    if (
      finalAxis === 'horizontal' &&
      Math.abs(finalX) > 1
    ) {
      await returnToCentre(finalX);
    }
  }
</script>

<div
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
    style={stageStyle}
  >
    <slot></slot>
  </div>
</div>
