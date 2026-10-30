// Providers excluded from this personal Safari build.
const DCSafariPreferences = {
  keys: ['mal-enabled', 'al-enabled', 'senscritique-enabled', 'mubi-enabled',
    'douban-enabled', 'filmaff-enabled', 'simkl-enabled', 'allocine-enabled',
    'kinopoisk-enabled', 'filmarks-enabled', 'ddd-enabled'],
  ratings: ['mal-ratings', 'al-ratings', 'anilist-ratings', 'sens-rating', 'sens-ratings', 'mubi-ratings', 'douban-ratings', 'filmaff-ratings', 'simkl-ratings', 'allocine-ratings', 'kinopoisk-ratings', 'filmarks-ratings'],
  apply(options) {
    for (const key of this.keys) options[key] = false;
    options['ddd-api-enabled'] = false;
    if (Array.isArray(options['ratings-order'])) options['ratings-order'] = options['ratings-order'].filter(key => !this.ratings.includes(key));
  },
};
