// Safari-only CSS updates. The extension never downloads or evaluates JavaScript.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const SOURCE = 'https://raw.githubusercontent.com/jwiemer/letterboxd-directors-cut/safari-ios/safari/styles/live.css';
  const ORIGIN = 'https://raw.githubusercontent.com/*';
  const KEY = 'dc-live-css-cache-v1';
  const HEADER = "/* Director's Cut live styles v1 */";
  const TTL = 5 * 60 * 1000;
  const MAX_BYTES = 128 * 1024;
  let pending = null;

  const valid = css => typeof css === 'string' && css.startsWith(HEADER) &&
    new TextEncoder().encode(css).length <= MAX_BYTES && !/@import\b/i.test(css);

  async function load(force) {
    const { options = {} } = await api.storage.sync.get('options');
    if (options['dc-live-css-enabled'] !== true) return { css: '', state: 'disabled' };
    if (!await api.permissions.contains({ origins: [ORIGIN] })) return { css: '', state: 'permission' };
    const data = await api.storage.local.get(KEY);
    const cache = data[KEY];
    const usable = cache?.source === SOURCE && valid(cache.css) && Number.isFinite(cache.checkedAt);
    if (!force && usable && Date.now() - cache.checkedAt >= 0 && Date.now() - cache.checkedAt < TTL) {
      return { ...cache, state: 'cached' };
    }
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(SOURCE, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
        if (!response.ok) throw new Error('Styles unavailable');
        // Read with a limit instead of buffering an arbitrarily large response.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let css = '', bytes = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > MAX_BYTES) throw new Error('Styles too large');
            css += decoder.decode(chunk.value, { stream: true });
          }
          css += decoder.decode();
        } finally {
          await reader.cancel();
        }
        if (!valid(css)) throw new Error('Invalid stylesheet');
        const next = { source: SOURCE, css, checkedAt: Date.now() };
        await api.storage.local.set({ [KEY]: next });
        return { ...next, state: 'updated' };
      } catch {
        return usable ? { ...cache, state: 'offline' } : { css: '', state: 'unavailable' };
      } finally {
        clearTimeout(timer);
        pending = null;
      }
    })();
    return pending;
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.name !== 'DC_LIVE_CSS') return false;
    // Only this extension's own settings pages can bypass the check interval.
    const force = message.force === true && !sender.tab;
    load(force).then(respond, () => respond({ css: '', state: 'unavailable' }));
    return true;
  });
})();
