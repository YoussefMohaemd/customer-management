/**
 * Global test bootstrap for the `@angular/build:unit-test` runner.
 * Stubs browser APIs that PrimeNG components rely on and that jsdom
 * does not implement natively.
 */

import 'zone.js/testing';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function matchMediaStub(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  };
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = ResizeObserverStub;
}
if (!('IntersectionObserver' in globalThis)) {
  (globalThis as unknown as Record<string, unknown>)['IntersectionObserver'] =
    IntersectionObserverStub;
}
if (!('matchMedia' in globalThis)) {
  (globalThis as unknown as Record<string, unknown>)['matchMedia'] = matchMediaStub;
}
if (!('scrollTo' in window)) {
  Object.defineProperty(window, 'scrollTo', {
    value: () => undefined,
    writable: true,
  });
}
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
