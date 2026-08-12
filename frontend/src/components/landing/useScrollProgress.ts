import { useSyncExternalStore } from 'react';

/**
 * Single source of truth for scroll progress (0 -> 1).
 * Plain singleton, not a state library: R3F components read
 * `scrollProgressStore.get()` directly inside useFrame (no re-render).
 * DOM components that need to react to it use the useScrollProgress() hook.
 */
class ScrollProgressStore {
  private value = 0;
  private listeners = new Set<() => void>();

  get() {
    return this.value;
  }

  set(v: number) {
    const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
    if (clamped === this.value) return;
    this.value = clamped;
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const scrollProgressStore = new ScrollProgressStore();

export function useScrollProgress() {
  return useSyncExternalStore(
    (cb) => scrollProgressStore.subscribe(cb),
    () => scrollProgressStore.get(),
    () => 0
  );
}
