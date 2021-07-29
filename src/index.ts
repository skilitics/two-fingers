export * from "./types";
import type { Coords, DeltaConfig, Gesture, GestureCallbacks, WheelConfig } from "./types";

const limit = (delta: number, maxDelta: number) => Math.sign(delta) * Math.min(maxDelta, Math.abs(delta));

const normalizeWheel = (
  { deltaMode, deltaX, deltaY, shiftKey }: WheelEvent,
  { lineMultiplier, pageMultiplier, maxMultiplier }: DeltaConfig,
): [number, number] => {
  let dx = deltaX;
  let dy = deltaY;

  if (shiftKey && dx === 0) {
    dx = dy;
    dy = 0;
  }

  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dx *= lineMultiplier;
    dy *= lineMultiplier;
  } else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dx *= pageMultiplier;
    dy *= pageMultiplier;
  }

  return [limit(dx, maxMultiplier), limit(dy, maxMultiplier)];
};

const midpoint = ([t1, t2]: TouchList): Coords => ({
  x: (t1.clientX + t2.clientX) / 2,
  y: (t1.clientY + t2.clientY) / 2,
});

const distance = ([t1, t2]: TouchList) => {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;

  return Math.sqrt(dx * dx + dy * dy);
};

const angle = ([t1, t2]: TouchList) => {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;

  return (180 / Math.PI) * Math.atan2(dy, dx);
};

export const clientToHTMLElementCoords = (element: HTMLDivElement, coords: Coords): Coords => {
  const rect = element.getBoundingClientRect();

  return {
    x: coords.x - rect.x,
    y: coords.y - rect.y,
  };
};

export const clientToSVGElementCoords = (el: SVGSVGElement, coords: Coords): Coords | undefined => {
  const element: SVGSVGElement = el.ownerSVGElement ?? el;
  const coordinateTransformMatrix = element.getScreenCTM();

  if (!coordinateTransformMatrix) return;

  const screenToElement = coordinateTransformMatrix.inverse();
  const point = element.createSVGPoint();

  point.x = coords.x;
  point.y = coords.y;

  return point.matrixTransform(screenToElement);
};

export const twoFingers = (
  container: Element,
  { onGestureStart, onGestureChange, onGestureEnd }: GestureCallbacks = {},
  wheelConfig?: WheelConfig,
): (() => void) => {
  const scaleSpeedup = wheelConfig?.scaleSpeedup ?? 2;
  const translationSpeedUp = wheelConfig?.translationSpeedUp ?? 2;

  // note: may expose in the future if needed
  const deltaConfig: DeltaConfig = {
    lineMultiplier: 8,
    pageMultiplier: 24,
    maxMultiplier: 24,
  };

  // TODO: we shouldn't be reusing gesture
  let gesture: Gesture | undefined = undefined;
  let timer: number;

  const wheelListener = (e: WheelEvent) => {
    e.preventDefault();

    const [dx, dy] = normalizeWheel(e, deltaConfig);

    if (!gesture) {
      gesture = {
        scale: 1,
        translation: { x: 0, y: 0 },
        origin: { x: e.clientX, y: e.clientY },
      };
      onGestureStart?.(gesture);
    } else {
      gesture = {
        origin: { x: e.clientX, y: e.clientY },
        scale: e.ctrlKey ? gesture.scale * (1 - (scaleSpeedup * dy) / 100) : 1,
        translation: !e.ctrlKey
          ? {
              x: gesture.translation.x - translationSpeedUp * dx,
              y: gesture.translation.y - translationSpeedUp * dy,
            }
          : { x: 0, y: 0 },
      };

      onGestureChange?.(gesture);
    }

    if (timer) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      if (gesture) {
        onGestureEnd?.(gesture);
        gesture = undefined;
      }
    }, 20);
  };

  let initialTouches: TouchList;

  const touchMove = (e: Event) => {
    if (!(e instanceof TouchEvent)) return;

    if (e.touches.length === 2) {
      const initialMidpoint = midpoint(initialTouches);
      const currentMidpoint = midpoint(e.touches);

      gesture = {
        scale: e.scale !== undefined ? e.scale : distance(e.touches) / distance(initialTouches),
        rotation: e.rotation !== undefined ? e.rotation : angle(e.touches) - angle(initialTouches),
        translation: {
          x: currentMidpoint.x - initialMidpoint.x,
          y: currentMidpoint.y - initialMidpoint.y,
        },
        origin: initialMidpoint,
      };

      onGestureChange?.(gesture);
      e.preventDefault();
    }
  };

  const watchTouches = (e: Event) => {
    if (!(e instanceof TouchEvent)) return;

    if (e.touches.length === 2) {
      initialTouches = e.touches;
      gesture = {
        scale: 1,
        rotation: 0,
        translation: { x: 0, y: 0 },
        origin: midpoint(initialTouches),
      };

      /*
				All the other events using `watchTouches` are passive,
				we don't need to call preventDefault().
			 */
      if (e.type === "touchstart") {
        e.preventDefault();
      }

      onGestureStart?.(gesture);
      container.addEventListener("touchmove", touchMove, { passive: false });
      container.addEventListener("touchend", watchTouches);
      container.addEventListener("touchcancel", watchTouches);
    } else if (gesture) {
      onGestureEnd?.(gesture);
      gesture = undefined;
      container.removeEventListener("touchmove", touchMove);
      container.removeEventListener("touchend", watchTouches);
      container.removeEventListener("touchcancel", watchTouches);
    }
  };

  document.addEventListener("wheel", wheelListener, { passive: false });
  container.addEventListener("touchstart", watchTouches, { passive: false });

  /*
    GestureEvent handling - Safari only
  */

  const handleGestureStart = ({ clientX, clientY, rotation, scale, preventDefault }: GestureEvent) => {
    onGestureStart?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
    });

    preventDefault();
  };

  const handleGestureChange = ({ clientX, clientY, rotation, scale, preventDefault }: GestureEvent) => {
    onGestureChange?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
    });

    preventDefault();
  };

  const handleGestureEnd = ({ clientX, clientY, rotation, scale }: GestureEvent) => {
    onGestureEnd?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
    });
  };

  if (typeof window.GestureEvent !== "undefined" && typeof window.TouchEvent === "undefined") {
    container.addEventListener("gesturestart", handleGestureStart, { passive: false });
    container.addEventListener("gesturechange", handleGestureChange, { passive: false });
    container.addEventListener("gestureend", handleGestureEnd);
  }

  return () => {
    document.removeEventListener("wheel", wheelListener);
    container.removeEventListener("touchstart", watchTouches);

    if (typeof window.GestureEvent !== "undefined" && typeof window.TouchEvent === "undefined") {
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);
    }
  };
};
