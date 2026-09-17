import {useEffect, useRef} from 'react';

/**
 * The site's star field, as three parallax layers that drift on their own and
 * lean toward the pointer.
 *
 * It replaces the single `body::after` tile, which twinkled in place and never
 * moved. One tile cannot read as depth: every star sat on the same plane, so
 * any motion applied to it looked like the whole page sliding.
 *
 * THE RULES THIS HAD TO RESPECT, because this site has paid for breaking them
 * before:
 *
 * - **Nothing here may move layout.** Three fixed, pointer-events:none divs
 *   behind everything at `z-index:-1`. No size, no flow, no CLS. This page
 *   fought a 0.132 CLS on the hero for a day and a half; a decorative layer is
 *   not allowed to reopen that.
 * - **Transform only.** The pointer handler writes two CSS custom properties
 *   and nothing else, so each frame is a GPU transform, never a repaint of a
 *   twenty stop gradient.
 * - **One rAF, coalesced.** `pointermove` fires far faster than the display.
 *   The handler stores the coordinates and schedules at most one frame.
 * - **`prefers-reduced-motion` kills all of it**, drift included, in CSS. The
 *   listener is never even attached.
 * - **Pointer devices only.** A touch screen has no cursor to follow, so the
 *   layers keep their own drift and the listener is skipped.
 *
 * The markup renders identically on the server, so there is no hydration
 * mismatch and no flash: the field is painted before the JS lands, and the JS
 * only ever adds the lean.
 */
export function Starfield() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (reduced.matches || !fine.matches) return undefined;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      root.style.setProperty('--sws-star-x', `${x.toFixed(3)}`);
      root.style.setProperty('--sws-star-y', `${y.toFixed(3)}`);
    };

    const onMove = (event) => {
      // -1 to 1 from the centre of the viewport, so the lean is symmetric and
      // independent of screen size.
      x = (event.clientX / window.innerWidth) * 2 - 1;
      y = (event.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    window.addEventListener('pointermove', onMove, {passive: true});
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="sws-starfield" ref={rootRef} aria-hidden="true">
      {/*
        Two elements per layer, and the split is the whole point.

        The OUTER element carries the pointer parallax: a transform driven by
        --sws-star-x/y with an easing transition. The INNER element carries the
        endless drift, also a transform. Nested transforms compose, so both
        motions run at once without either overwriting the other.

        Before 2026-09-17 the drift animated `background-position` on the same
        element instead. `background-position` is a PAINT property: it cannot
        be composited, so every frame repainted a full-viewport layer carrying
        six to ten radial gradients, three layers deep, forever, on an element
        that `will-change: transform` had already promoted. A promoted layer
        repainting every frame is the worst of both worlds. Todd reported bad
        flickering on his laptop. Transform drift is compositor-only and costs
        nothing to repaint.
      */}
      <div className="sws-star-layer sws-star-layer-far">
        <div className="sws-star-drift sws-star-drift-far" />
      </div>
      <div className="sws-star-layer sws-star-layer-mid">
        <div className="sws-star-drift sws-star-drift-mid" />
      </div>
      <div className="sws-star-layer sws-star-layer-near">
        <div className="sws-star-drift sws-star-drift-near" />
      </div>
    </div>
  );
}
