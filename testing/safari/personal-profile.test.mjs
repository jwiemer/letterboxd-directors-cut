import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../src/dist/safari/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const options = await readFile(new URL('options.html', root), 'utf8');
const bundle = await readFile(new URL('letterboxd-extras.user.js', root), 'utf8');

test('Personal Safari settings omit unwanted providers rather than hiding disabled switches', () => {
  for (const key of ['mal', 'al', 'senscritique', 'mubi', 'douban', 'filmaff', 'simkl', 'allocine', 'kinopoisk', 'filmarks', 'ddd']) {
    assert.ok(!options.includes(`id="${key}-enabled"`), key);
  }
  for (const name of ['MyAnimeList', 'AniList', 'SensCritique', 'Does the Dog Die?']) assert.ok(!options.includes(name), name);
  assert.ok(options.includes('id="imdb-enabled"'));
  assert.ok(options.includes('id="metacritic-enabled"'));
  assert.ok(options.includes('id="tomato-enabled"'));
});

test('Excluded provider implementations are absent from the Safari bundle', () => {
  for (const name of ['AnilistHelper', 'MubiHelper', 'FilmAffinityHelper', 'KinopoiskHelper', 'SimklHelper', 'MyAnimeListHelper', 'DoubanHelper']) {
    assert.ok(!bundle.includes(`class ${name}`), name);
  }
  for (const name of ['initDDD', 'searchSensCritique', 'initAllocine', 'getFilmarks']) assert.ok(!bundle.includes(`${name}(`), name);
});

test('Safari no longer declares the removed providers’ website permissions', () => {
  const hosts = [...manifest.host_permissions, ...manifest.optional_host_permissions].join('\n');
  for (const site of ['anilist', 'mubi', 'senscritique', 'douban', 'filmaffinity', 'simkl', 'allocine', 'kinopoisk', 'markuapi', 'tenrai', 'doesthedogdie']) assert.ok(!hosts.includes(site), site);
});
