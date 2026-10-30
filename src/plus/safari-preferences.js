// Safari's initial provider preset. Migration is one-time so users can opt back in.
const DCSafariPreferences = {
  keys: ['mal-enabled', 'al-enabled', 'senscritique-enabled', 'mubi-enabled',
    'douban-enabled', 'filmaff-enabled', 'simkl-enabled', 'allocine-enabled',
    'kinopoisk-enabled', 'filmarks-enabled', 'ddd-enabled'],
  apply(options) {
    if (options['dc-safari-providers-v1'] === true) return;
    for (const key of this.keys) options[key] = false;
    options['dc-safari-providers-v1'] = true;
  },
};
