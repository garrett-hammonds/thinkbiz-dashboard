// Host detection and a thin typed adapter over the native shell's plugins.
//
// The dashboard runs in three hosts: a normal browser, the installed PWA, and
// the Capacitor shell (thinkbiz-mobile-app on iOS / Android). Every component
// that needs native behaviour goes through this module, so the shell's plugin
// set is documented in exactly one place and nothing else in the app needs to
// know which host it is in.
//
// Client-safe: no imports, no side effects at module load. Safe to call from
// server-rendered components too — everything returns the "web" answer when
// `window` is undefined.

export type Host = 'capacitor' | 'web';
export type Platform = 'ios' | 'android' | 'web';

export function detectHost(): Host {
  if (typeof window === 'undefined') return 'web';
  return window.Capacitor?.isNativePlatform?.() ? 'capacitor' : 'web';
}

export function isNative(): boolean {
  return detectHost() === 'capacitor';
}

export function platform(): Platform {
  if (typeof window === 'undefined') return 'web';
  const p = window.Capacitor?.getPlatform?.();
  return p === 'ios' || p === 'android' ? p : 'web';
}

// ─── Plugin surfaces (only the methods we call) ────────────────────────────

type Listener<T> = (event: T) => void;
export interface Handle {
  remove(): Promise<void> | void;
}
// The shell injects plugin proxies whose addListener returns the handle
// synchronously (no @capacitor/core runtime runs on the remote page), while
// the core runtime returns a Promise. Callers must accept both: always wrap
// the raw return in `Promise.resolve(...)`.
type MaybeHandle = Handle | Promise<Handle>;

export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface PushPlugin {
  // @capacitor-firebase/messaging — one FCM token on both platforms.
  checkPermissions(): Promise<{ receive: PermissionState }>;
  requestPermissions(): Promise<{ receive: PermissionState }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  // Android only; a no-op elsewhere. Importance 4 = IMPORTANCE_HIGH (heads-up).
  createChannel(opts: { id: string; name: string; description?: string; importance?: 1 | 2 | 3 | 4 | 5 }): Promise<void>;
  addListener(event: 'tokenReceived', fn: Listener<{ token: string }>): MaybeHandle;
  addListener(
    event: 'notificationActionPerformed',
    fn: Listener<{ notification: { data?: Record<string, string> | null } }>,
  ): MaybeHandle;
}

export interface AppPlugin {
  getLaunchUrl(): Promise<{ url?: string } | null>;
  minimizeApp(): Promise<void>;
  addListener(event: 'appUrlOpen', fn: Listener<{ url: string }>): MaybeHandle;
  addListener(event: 'backButton', fn: Listener<{ canGoBack: boolean }>): MaybeHandle;
  addListener(event: 'appStateChange', fn: Listener<{ isActive: boolean }>): MaybeHandle;
}

export interface BrowserPlugin {
  open(opts: { url: string; presentationStyle?: 'fullscreen' | 'popover' }): Promise<void>;
  close(): Promise<void>;
}

export interface NetworkPlugin {
  getStatus(): Promise<{ connected: boolean }>;
  addListener(event: 'networkStatusChange', fn: Listener<{ connected: boolean }>): MaybeHandle;
}

export interface FilesystemPlugin {
  writeFile(opts: {
    path: string;
    data: string;
    directory: 'CACHE';
    // Omit encoding to write base64 (binary); 'utf8' writes text as-is.
    encoding?: 'utf8';
  }): Promise<{ uri: string }>;
}

export interface SharePlugin {
  share(opts: { title?: string; text?: string; url?: string; files?: string[] }): Promise<unknown>;
}

export interface PreferencesPlugin {
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
}

export interface HapticsPlugin {
  impact(opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }): Promise<void>;
  notification(opts: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }): Promise<void>;
}

export interface StatusBarPlugin {
  setStyle(opts: { style: 'LIGHT' | 'DARK' | 'DEFAULT' }): Promise<void>;
  setBackgroundColor(opts: { color: string }): Promise<void>;
}

export interface SplashScreenPlugin {
  hide(): Promise<void>;
}

interface PluginMap {
  FirebaseMessaging: PushPlugin;
  App: AppPlugin;
  Browser: BrowserPlugin;
  Network: NetworkPlugin;
  Filesystem: FilesystemPlugin;
  Share: SharePlugin;
  Preferences: PreferencesPlugin;
  Haptics: HapticsPlugin;
  StatusBar: StatusBarPlugin;
  SplashScreen: SplashScreenPlugin;
}

export function getPlugin<K extends keyof PluginMap>(name: K): PluginMap[K] | null {
  if (typeof window === 'undefined') return null;
  const plugin = window.Capacitor?.Plugins?.[name];
  return (plugin as unknown as PluginMap[K]) ?? null;
}

// ─── Host adapter ──────────────────────────────────────────────────────────

export interface HostAdapter {
  host: Host;
  // Open a URL outside the app's WebView (system browser / in-app browser).
  // Used for every off-origin link and for Stripe Checkout / the billing
  // portal, which must not run inside an embedded WebView.
  openExternal(url: string): Promise<void>;
  // Hand a file to the platform share sheet. `data` is base64 for binary
  // files, or plain text when `encoding` is 'utf8'. Returns false when the
  // host cannot (the caller falls back to a normal download).
  shareFile(name: string, data: string, encoding?: 'utf8'): Promise<boolean>;
  haptic(type?: 'SUCCESS' | 'WARNING' | 'ERROR'): Promise<void>;
}

const webAdapter: HostAdapter = {
  host: 'web',
  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  async shareFile() {
    return false;
  },
  async haptic() {},
};

const capacitorAdapter: HostAdapter = {
  host: 'capacitor',
  async openExternal(url) {
    const browser = getPlugin('Browser');
    if (browser) await browser.open({ url: absolute(url), presentationStyle: 'popover' });
    else window.open(url, '_blank', 'noopener,noreferrer');
  },
  async shareFile(name, data, encoding) {
    const fs = getPlugin('Filesystem');
    const share = getPlugin('Share');
    if (!fs || !share) return false;
    const { uri } = await fs.writeFile({ path: name, data, directory: 'CACHE', encoding });
    await share.share({ title: name, files: [uri] });
    return true;
  },
  async haptic(type) {
    const haptics = getPlugin('Haptics');
    if (!haptics) return;
    try {
      if (type) await haptics.notification({ type });
      else await haptics.impact({ style: 'LIGHT' });
    } catch {
      // Haptics are decoration; never let them surface an error.
    }
  },
};

export function hostAdapter(): HostAdapter {
  return detectHost() === 'capacitor' ? capacitorAdapter : webAdapter;
}

export function absolute(url: string): string {
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).toString();
}

// The custom scheme the shells register (mirrors capacitor.config.ts in
// thinkbiz-mobile-app). Used when a flow that had to leave the WebView (Stripe
// Checkout in the system browser) wants to hand focus back to the app.
export const NATIVE_SCHEME = process.env.NEXT_PUBLIC_NATIVE_SCHEME || 'thinkbiz';

// Android notification channel. Must match the channelId the server puts on
// every FCM message (lib/notifications/push-native.ts) and the manifest's
// default_notification_channel_id in the shell.
export const PUSH_CHANNEL_ID = 'thinkbiz-default';

// Device-local preference keys (Capacitor Preferences, never synced).
export const PREF_PUSH_TOKEN = 'thinkbiz.pushToken';
export const PREF_PUSH_ASKED = 'thinkbiz.pushAsked';
