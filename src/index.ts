declare global {
  /*
    TouchEvent' `scale` and `rotation` properties aren't standardized:
    https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent
  */
  interface TouchEvent {
    scale?: number;
    rotation?: number;
  }

  /*
    GestureEvents aren't standardized:
    https://developer.mozilla.org/en-US/docs/Web/API/GestureEvent
    https://developer.apple.com/documentation/webkitjs/gestureevent
  */
  interface GestureEvent extends UIEvent {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    scale: number;
    rotation: number;
    clientX: number;
    clientY: number;
    screenX: number;
    screenY: number;
  }

  // extends the original ElementEventMap
  interface ElementEventMap {
    gesturestart: GestureEvent;
    gesturechange: GestureEvent;
    gestureend: GestureEvent;
  }

  // required to check for its existence
  interface Window {
    GestureEvent?: GestureEvent;
  }
}

export type Coords = {
  x: number;
  y: number;
};

export type Gesture = {
  origin: Coords;
  translation: Coords;
  scale: number;
  rotation?: number;
};

type Callbacks = {
  gestureStart?: (gesture: Gesture) => void;
  gestureChange?: (gesture: Gesture) => void;
  gestureEnd?: (gesture: Gesture) => void;
};

type WheelConfig = {
  scaleSpeedup: number;
  translationSpeedUp: number;
};

type DeltaConfig = {
  lineMultiplier: number;
  pageMultiplier: number;
  maxMultiplier: number;
};

function normalizeWheel(
  { deltaMode, deltaX, deltaY, shiftKey }: WheelEvent,
  { lineMultiplier, pageMultiplier, maxMultiplier }: DeltaConfig,
): [number, number] {
  let dx = deltaX;
  let dy = deltaY;

  if (shiftKey && dx === 0) {
    const tmp = dx;
    dx = dy;
    dy = tmp;
  }

  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dx *= lineMultiplier;
    dy *= lineMultiplier;
  } else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dx *= pageMultiplier;
    dy *= pageMultiplier;
  }

  return [limit(dx, maxMultiplier), limit(dy, maxMultiplier)];
}

const limit = (delta: number, maxDelta: number) => Math.sign(delta) * Math.min(maxDelta, Math.abs(delta));

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
  const element: SVGSVGElement = !el.ownerSVGElement ? el : el.ownerSVGElement;
  const elScreenCTM = element.getScreenCTM();

  if (!elScreenCTM) return;

  const screenToElement = elScreenCTM.inverse();
  const point = element.createSVGPoint();

  point.x = coords.x;
  point.y = coords.y;

  return point.matrixTransform(screenToElement);
};

export function twoFingers(
  container: Element,
  { gestureStart, gestureChange, gestureEnd }: Callbacks = {},
  wheelConfig?: WheelConfig,
): () => void {
  const scaleSpeedup = wheelConfig?.scaleSpeedup ?? 2;
  const translationSpeedUp = wheelConfig?.translationSpeedUp ?? 2;

  // note: may expose if needed
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
      gestureStart?.(gesture);
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

      gestureChange?.(gesture);
    }

    if (timer) {
      window.clearTimeout(timer);
    }

    timer = window.setTimeout(() => {
      if (gesture) {
        gestureEnd?.(gesture);
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

      gestureChange?.(gesture);
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

      gestureStart?.(gesture);
      container.addEventListener("touchmove", touchMove, { passive: false });
      container.addEventListener("touchend", watchTouches);
      container.addEventListener("touchcancel", watchTouches);
    } else if (gesture) {
      gestureEnd?.(gesture);
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
    gestureStart?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
    });

    preventDefault();
  };

  const handleGestureChange = ({ clientX, clientY, rotation, scale, preventDefault }: GestureEvent) => {
    gestureChange?.({
      translation: { x: 0, y: 0 },
      scale,
      rotation,
      origin: { x: clientX, y: clientY },
    });

    preventDefault();
  };

  const handleGestureEnd = ({ clientX, clientY, rotation, scale }: GestureEvent) => {
    gestureEnd?.({
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
}
