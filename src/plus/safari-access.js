// Request only the sites used by the selected core features, during a button tap.
const DCSafariAccess = {
  origins(settings) {
    const origins = new Set();
    const on = key => settings[key] !== false;
    if (on('imdb-enabled') || on('imdb-250-enabled') || on('cast-extras-enabled')) origins.add('https://*.imdb.com/*');
    if (on('tomato-enabled')) origins.add('https://www.rottentomatoes.com/*');
    if (on('metacritic-enabled')) origins.add('https://www.metacritic.com/*');
    if (on('cinema-enabled')) origins.add('https://webapp.cinemascore.com/*');
    // Wikidata resolves IDs for ratings, Wikipedia, Blu-ray and Ebert links.
    if (['tomato-enabled', 'metacritic-enabled', 'wiki-link-enabled', 'bluray-link-enabled',
      'ebert-link-enabled', 'criterion-link-enabled'].some(on) || settings['content-ratings'] !== 'none') {
      origins.add('https://query.wikidata.org/*');
    }
    if (on('imdb-enabled') || on('imdb-250-enabled') || on('cast-extras-enabled') || on('mojo-link-enabled') || settings['boxoffice-enabled'] === true) origins.add('https://www.boxofficemojo.com/*');
    return [...origins];
  },
};

(() => {
  const api = globalThis.browser || globalThis.chrome;
  if (!api.runtime.getManifest().background?.scripts?.includes('plus/safari-preferences.js')) return;
  document.getElementById('dc-safari-access').hidden = false;
  const button = document.getElementById('dc-safari-allow');
  const status = document.getElementById('dc-safari-access-status');
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Requesting access…';
    try {
      // options is the saved settings object maintained by options.js.
      const granted = await api.permissions.request({ origins: DCSafariAccess.origins(globalThis.options || {}) });
      status.textContent = granted ? 'Access allowed. Reload the Letterboxd page.' :
        'Some access was not allowed. Check Director’s Cut website access in Safari Settings, then try again.';
    } catch {
      status.textContent = 'Open Settings → Apps → Safari → Extensions → Director’s Cut to allow the rating sites.';
    } finally { button.disabled = false; }
  });
})();
