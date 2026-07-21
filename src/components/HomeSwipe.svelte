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

  let stage = null;

  let navigating = false;
  let tracking = false;

  let pointerId = null;
  let axis = '';

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  let differenceX = 0;

  let removeClickBlock = null;

  function reducedMotion() {
    return window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }

  async function animate(
    keyframes,
    duration,
    easing
  ) {
    if (
      !stage ||
      typeof stage.animate !== 'function' ||
      reducedMotion()
    ) {
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
      // A later interaction may interrupt it.
    } finally {
      animation.cancel();
    }
  }

  function blockNextClick() {
    removeClickBlock?.();

    let timer = null;

    const stopClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener(
        'click',
        stopClick,
        true
      );

      clearTimeout(timer);

      if (
        removeClickBlock === cleanup
      ) {
        removeClickBlock = null;
      }
    };

    window.addEventListener(
      'click',
      stopClick,
      true
    );

    timer = setTimeout(
      cleanup,
      350
    );

    removeClickBlock = cleanup;
  }

  export async function navigateTo(
    targetIndex
  ) {
    if (
      !enabled ||
      navigating ||
      targetIndex === activeIndex ||
      targetIndex < 0 ||
      targetIndex >= pageCount
    ) {
      return;
    }

    navigating = true;
    onSwipeDetected();

    const movingForward =
      targetIndex > activeIndex;

    const direction =
      movingForward ? -1 : 1;

    /*
     * Small and subtle exit:
     * only 10px movement.
     */
    await animate(
      [
        {
          opacity: 1,
          transform:
            'translate3d(0,0,0)'
        },
        {
          opacity: 0.72,
          transform:
            `translate3d(${direction * 10}px,0,0)`
        }
      ],
      75,
      'ease-out'
    );

    const result =
      onNavigate(targetIndex);

    await tick();

    /*
     * Soft entrance from the opposite side.
     */
    await animate(
      [
        {
          opacity: 0.72,
          transform:
            `translate3d(${-direction * 10}px,0,0)`
        },
        {
          opacity: 1,
          transform:
            'translate3d(0,0,0)'
        }
      ],
      125,
      'cubic-bezier(.2,.75,.25,1)'
    );

    Promise
      .resolve(result)
      .catch(() => {});

    navigating = false;
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

    tracking = true;
    pointerId = event.pointerId;

    axis = '';
    differenceX = 0;

    startX = event.clientX;
    startY = event.clientY;
    startTime = performance.now();
  }

  function moveGesture(event) {
    if (
      !tracking ||
      event.pointerId !== pointerId
    ) {
      return;
    }

    const moveX =
      event.clientX - startX;

    const moveY =
      event.clientY - startY;

    differenceX = moveX;

    if (!axis) {
      if (
        Math.abs(moveX) < 7 &&
        Math.abs(moveY) < 7
      ) {
        return;
      }

      axis =
        Math.abs(moveX) >
        Math.abs(moveY) * 1.12
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

        blockNextClick();
        onSwipeDetected();
      }
    }

    if (axis === 'horizontal') {
      event.preventDefault();
    }
  }

  async function finishGesture(event) {
    if (
      !tracking ||
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
      // The pointer may not have been captured.
    }

    const finalX =
      differenceX;

    const finalAxis =
      axis;

    const elapsed = Math.max(
      1,
      performance.now() - startTime
    );

    const velocity =
      finalX / elapsed;

    tracking = false;
    pointerId = null;
    axis = '';
    differenceX = 0;

    if (
      finalAxis !== 'horizontal'
    ) {
      return;
    }

    const validSwipe =
      Math.abs(finalX) >= 44 ||
      Math.abs(velocity) >= 0.28;

    if (!validSwipe) {
      return;
    }

    const targetIndex =
      finalX < 0
        ? activeIndex + 1
        : activeIndex - 1;

    await navigateTo(
      targetIndex
    );
  }

  function cancelGesture() {
    tracking = false;
    pointerId = null;
    axis = '';
    differenceX = 0;
  }

  onDestroy(() => {
    removeClickBlock?.();
  });
</script>

<div
  class="home-swipe-shell"
  class:navigating
>
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
    >
      <slot></slot>
    </div>
  </div>
</div>
