// Apply a CSS overlay after bundled styles, keeping the app usable offline.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  if (!api.runtime.getManifest().background?.scripts?.includes('plus/live-styles-background.js')) return;
  const ID = 'dc-live-css';
  let revision = 0;
  async function apply() {
    const current = ++revision;
    try {
      const result = await api.runtime.sendMessage({ name: 'DC_LIVE_CSS' });
      if (current !== revision) return;
      document.getElementById(ID)?.remove();
      if (!result?.css) return;
      const style = document.createElement('style');
      style.id = ID;
      style.textContent = result.css;
      (document.head || document.documentElement).append(style);
    } catch { /* Bundled styles remain in place if the extension is unavailable. */ }
  }
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.options) apply();
    if (area === 'local' && changes['dc-live-css-cache-v1']) apply();
  });
  apply();
})();
