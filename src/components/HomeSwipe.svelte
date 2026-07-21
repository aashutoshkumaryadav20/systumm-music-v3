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

  let shell = null;
  let viewport = null;
  let stage = null;
  let curtain = null;

  let dragging = false;
  let navigating = false;

  let pointerId = null;
  let axis = '';

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  let rawX = 0;
  let visibleX = 0;

  let renderFrame = 0;
  let pendingX = 0;

  let swipeDirection = '';

  let removeClickBlock = null;

  function reducedMotion() {
    return window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }

  function clearRenderFrame() {
    if (!renderFrame) {
      return;
    }

    cancelAnimationFrame(
      renderFrame
    );

    renderFrame = 0;
  }

  function clearStageStyles() {
    clearRenderFrame();

    if (stage) {
      stage.style.removeProperty(
        'transform'
      );

      stage.style.removeProperty(
        'opacity'
      );

      stage.style.removeProperty(
        'clip-path'
      );
    }

    shell?.style.removeProperty(
      '--home-swipe-progress'
    );
  }

  function stageTransform(x) {
    const width =
      viewport?.clientWidth ||
      window.innerWidth ||
      360;

    const progress = Math.min(
      1,
      Math.abs(x) / width
    );

    const rotation =
      Math.max(
        -4.5,
        Math.min(
          4.5,
          (x / width) * 8
        )
      );

    const movement =
      x * 0.23;

    const scale =
      1 - progress * 0.018;

    return [
      'perspective(1100px)',
      `translate3d(${movement}px,0,0)`,
      `rotateY(${rotation}deg)`,
      `scale(${scale})`
    ].join(' ');
  }

  function applyDragPosition(x) {
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
      stageTransform(x);

    shell?.style.setProperty(
      '--home-swipe-progress',
      String(progress)
    );
  }

  function scheduleDragPosition(x) {
    pendingX = x;

    if (renderFrame) {
      return;
    }

    renderFrame =
      requestAnimationFrame(() => {
        renderFrame = 0;

        applyDragPosition(
          pendingX
        );
      });
  }

  async function playAnimation(
    element,
    keyframes,
    options
  ) {
    if (
      !element ||
      typeof element.animate !==
        'function' ||
      reducedMotion()
    ) {
      return null;
    }

    const animation =
      element.animate(
        keyframes,
        {
          fill: 'both',
          ...options
        }
      );

    try {
      await animation.finished;
    } catch {
      // A later interaction may cancel it.
    }

    return animation;
  }

  async function returnToCentre(
    fromX
  ) {
    const animation =
      await playAnimation(
        stage,
        [
          {
            transform:
              stageTransform(fromX)
          },
          {
            transform:
              'perspective(1100px) translate3d(0,0,0) rotateY(0deg) scale(1)'
          }
        ],
        {
          duration: 115,
          easing:
            'cubic-bezier(.2,.85,.25,1)'
        }
      );

    animation?.cancel();
    clearStageStyles();
  }

  function playCurtain(direction) {
    if (
      !curtain ||
      typeof curtain.animate !==
        'function' ||
      reducedMotion()
    ) {
      return;
    }

    const start =
      direction === 'next'
        ? '105%'
        : '-105%';

    const finish =
      direction === 'next'
        ? '-105%'
        : '105%';

    const animation =
      curtain.animate(
        [
          {
            transform:
              `translate3d(${start},0,0)`,
            opacity: 0
          },
          {
            opacity: 0.72,
            offset: 0.42
          },
          {
            transform:
              `translate3d(${finish},0,0)`,
            opacity: 0
          }
        ],
        {
          duration: 225,
          easing:
            'cubic-bezier(.2,.8,.2,1)'
        }
      );

    animation.finished
      .catch(() => {})
      .finally(() => {
        animation.cancel();
      });
  }

  function blockGestureClick() {
    removeClickBlock?.();

    let timer = null;

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

      clearTimeout(timer);

      if (
        removeClickBlock ===
        cleanup
      ) {
        removeClickBlock = null;
      }
    };

    window.addEventListener(
      'click',
      blockClick,
      true
    );

    timer = setTimeout(
      cleanup,
      450
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

    const movingNext =
      targetIndex > activeIndex;

    const direction =
      movingNext
        ? 'next'
        : 'previous';

    swipeDirection = direction;

    const outgoingClip =
      movingNext
        ? 'inset(0 100% 0 0 round 20px)'
        : 'inset(0 0 0 100% round 20px)';

    const incomingClip =
      movingNext
        ? 'inset(0 0 0 100% round 20px)'
        : 'inset(0 100% 0 0 round 20px)';

    const outgoingX =
      movingNext
        ? -34
        : 34;

    const incomingX =
      -outgoingX;

    playCurtain(direction);

    const outgoing =
      await playAnimation(
        stage,
        [
          {
            transform:
              stageTransform(fromX),
            clipPath:
              'inset(0 0 0 0 round 20px)'
          },
          {
            transform: [
              'perspective(1100px)',
              `translate3d(${outgoingX}px,0,0)`,
              `rotateY(${movingNext ? -5 : 5}deg)`,
              'scale(.982)'
            ].join(' '),

            clipPath:
              outgoingClip
          }
        ],
        {
          duration: 92,
          easing:
            'cubic-bezier(.45,0,1,1)'
        }
      );

    const navigationResult =
      onNavigate(targetIndex);

    await tick();

    outgoing?.cancel();

    const incoming =
      await playAnimation(
        stage,
        [
          {
            transform: [
              'perspective(1100px)',
              `translate3d(${incomingX}px,0,0)`,
              `rotateY(${movingNext ? 5 : -5}deg)`,
              'scale(.982)'
            ].join(' '),

            clipPath:
              incomingClip
          },
          {
            transform:
              'perspective(1100px) translate3d(0,0,0) rotateY(0deg) scale(1)',

            clipPath:
              'inset(0 0 0 0 round 20px)'
          }
        ],
        {
          duration: 145,
          easing:
            'cubic-bezier(.12,.82,.22,1)'
        }
      );

    incoming?.cancel();

    clearStageStyles();

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
        Math.abs(differenceX) < 7 &&
        Math.abs(differenceY) < 7
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

    swipeDirection =
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
        : 0.94;

    visibleX =
      differenceX * resistance;

    scheduleDragPosition(
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
      swipeDirection = '';
      return;
    }

    const qualifies =
      Math.abs(finalRawX) >= 38 ||
      Math.abs(velocity) >= 0.23;

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
      clearStageStyles();
    }

    swipeDirection = '';
  }

  onDestroy(() => {
    removeClickBlock?.();
    clearRenderFrame();
  });
</script>

<div
  bind:this={shell}
  class="home-swipe-shell"
  class:dragging
  class:navigating
  class:direction-next={
    swipeDirection === 'next'
  }
  class:direction-previous={
    swipeDirection === 'previous'
  }
>
  <div
    bind:this={curtain}
    class="home-swipe-curtain"
    aria-hidden="true"
  ></div>

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
