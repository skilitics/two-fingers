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

export type GestureCallbacks = {
  onGestureStart?: (gesture: Gesture) => void;
  onGestureChange?: (gesture: Gesture) => void;
  onGestureEnd?: (gesture: Gesture) => void;
};

export type WheelConfig = {
  scaleSpeedup: number;
  translationSpeedUp: number;
};

export type DeltaConfig = {
  lineMultiplier: number;
  pageMultiplier: number;
  maxMultiplier: number;
};
