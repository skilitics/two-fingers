# two-fingers

A package to help you with two fingers gestures on the web.

### Original research and code
This is an adaptation of the research, article and code by @danburzo:
- [Article](https://dev.to/danburzo/pinch-me-i-m-zooming-gestures-in-the-dom-a0e)
- [Github repo](https://github.com/danburzo/ok-zoomer)

### TL;DR   
Two fingers gestures have become very common on the web, mostly to enable zooming and panning.
But they are passed as different events depending on:
- the hardware on which they are performed (trackpad OR touchscreen)
- the OS and browser that interprets them

This package tries to unify these interactions and inconsistencies to expose a single `Gesture` object.

### Installation
```
npm i @skilitics/two-fingers
```
OR
```
yarn add @skilitics/two-fingers
```

### API
The API takes inspiration from Apple's [`GestureEvent` specification](https://developer.apple.com/documentation/webkitjs/gestureevent).

##### Usage
```javascript
const myDiv = document.querySelector('#myDiv');
const unregister = twoFingers(myDiv, {
  gestureStart: (g) => console.log(`Gesture start. Event: ${g.toString()}`),
  gestureChange: (g) => console.log(`Gesture change. Event: ${g.toString()}`),
  gestureEnd: (g) => console.log(`Gesture end. Event: ${g.toString()}`),
});
```

The callbacks are passed an object as argument, that is of the `Gesture` TS type:
```typescript
type Gesture = {
  origin: Coords;
  translation: Coords;
  scale: number;
  rotation?: number;
};

type Coords = {
  x: number;
  y: number;
};
```

Which means you can use the callback as in this example:
```javascript
const gestureChange = (g) => {
  console.log(g.origin) // { x: number; y: number }
  console.log(g.translation) // { x: number; y: number }
  console.log(g.scale) // number
  console.log(g.rotation) // number
}
```
