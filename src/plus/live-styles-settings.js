// The controls are visible only in a build with the Safari update handler.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const group = document.getElementById('dc-live-css-settings');
  if (!api.runtime.getManifest().background?.scripts?.includes('plus/live-styles-background.js')) return;
  group.hidden = false;
  const status = document.getElementById('dc-live-css-status');
  const button = document.getElementById('dc-live-css-check');
  const labels = {
    disabled: 'Turn on GitHub CSS updates to use the shared stylesheet.',
    permission: 'Allow access to raw.githubusercontent.com to check for styles.',
    updated: 'Latest GitHub styles downloaded. Reload Letterboxd to apply them.',
    cached: 'Using saved GitHub styles.',
    offline: 'GitHub could not be reached. Keeping the last downloaded styles.',
    unavailable: 'No GitHub styles available. Using the bundled styles.',
  };
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Checking GitHub…';
    try {
      const result = await api.runtime.sendMessage({ name: 'DC_LIVE_CSS', force: true });
      status.textContent = labels[result?.state] || labels.unavailable;
    } catch { status.textContent = labels.unavailable; }
    finally { button.disabled = false; }
  });
})();
