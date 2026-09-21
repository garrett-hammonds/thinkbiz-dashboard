// The native shell (thinkbiz-mobile-app, Capacitor) injects `window.Capacitor`
// into the remote page before any of our scripts run. The web app never
// imports @capacitor/* packages; it talks to the injected plugin proxies
// through lib/native/bridge.ts, so these are the only shapes we rely on.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => 'ios' | 'android' | 'web';
  Plugins?: Record<string, Record<string, (...args: never[]) => unknown>>;
}

interface Window {
  Capacitor?: CapacitorGlobal;
}
