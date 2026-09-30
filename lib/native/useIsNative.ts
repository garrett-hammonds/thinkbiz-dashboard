'use client';

import { useSyncExternalStore } from 'react';
import { isNative } from './bridge';

const subscribeNoop = () => () => {};

// Host detection as a hook for rendering decisions. Returns null on the server
// and during hydration (the host isn't known yet), then true/false. Callers
// that hide something inside the app render nothing while it's null, so the
// hidden UI never flashes in the shell before hydration settles.
export function useIsNative(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribeNoop, isNative, () => null);
}
