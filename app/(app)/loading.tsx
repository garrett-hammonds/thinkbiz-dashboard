// Shown in the content area while a screen's data loads; the sidebar and
// header stay put. It stays invisible for the first 200ms (the .loading-delayed
// rule in globals.css), so a screen that arrives quickly never flashes a
// spinner, and anything slower gets one.
export default function AppLoading() {
  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center px-4 py-12">
      <div role="status" aria-live="polite" className="loading-delayed flex flex-col items-center gap-3">
        <span
          aria-hidden="true"
          className="loading-spinner h-9 w-9 rounded-full border-4 border-gray-200 border-t-primary"
        />
        <span className="text-sm font-medium text-gray-500">Loading…</span>
      </div>
    </main>
  );
}
