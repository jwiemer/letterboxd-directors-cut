import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const prefs = await readFile(new URL('../../src/plus/safari-preferences.js', import.meta.url), 'utf8');
const background = await readFile(new URL('../../src/common/background.js', import.meta.url), 'utf8');

test('Safari excludes unwanted providers while keeping core preferences', () => {
  const c = vm.createContext({});
  vm.runInContext(prefs, c);
  const settings = { 'imdb-enabled': true, 'metacritic-enabled': true, 'dc-live-css-enabled': true, 'mal-enabled': true };
  c.settings = settings;
  vm.runInContext('DCSafariPreferences.apply(settings)', c);
  for (const key of ['mal', 'al', 'senscritique', 'mubi', 'douban', 'filmaff', 'simkl', 'allocine', 'kinopoisk', 'filmarks', 'ddd']) assert.equal(settings[key + '-enabled'], false);
  assert.equal(settings['imdb-enabled'], true);
  assert.equal(settings['metacritic-enabled'], true);
  assert.equal(settings['dc-live-css-enabled'], true);
  settings['mal-enabled'] = true;
  vm.runInContext('DCSafariPreferences.apply(settings)', c);
  assert.equal(settings['mal-enabled'], false);
});

test('Background checks origin patterns and reports network failure to the waiting page', async () => {
  let listener, origins;
  const c = vm.createContext({ URL, console: { error() {} }, fetch: async () => { throw Error('offline'); },
    browser: {
      runtime: { onMessage: { addListener: fn => { listener = fn; } }, onStartup: { addListener() {} }, onInstalled: { addListener() {} } },
      permissions: { contains: async request => { origins = request.origins; return true; } },
      storage: { sync: { get: (key, callback) => { callback?.({ options: {} }); return Promise.resolve({ options: {} }); } } },
    },
  });
  vm.runInContext(background, c);
  const reply = await new Promise(resolve => listener({ name: 'GETDATA', url: 'https://query.wikidata.org/sparql?format=json', type: 'JSON' }, {}, resolve));
  assert.equal(origins[0], 'https://query.wikidata.org/*');
  assert.equal(reply.status, 0);
  assert.equal(reply.response, null);
});
