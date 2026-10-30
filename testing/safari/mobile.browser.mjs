// Run after building Safari and installing the existing testing/ dependencies.
// node testing/safari/mobile.browser.mjs
const { chromium } = await import(process.env.DC_PLAYWRIGHT_MODULE || 'playwright');
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../', import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
const page = await browser.newPage({ viewport: { width: 393, height: 750 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => route.fulfill({ body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>', contentType: 'text/html' }));
await page.goto('https://letterboxd.com/film/finding-vivian-maier/');
const optionsHtml = await readFile(root + '/src/dist/safari/options.html', 'utf8');
await page.setContent(optionsHtml.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]*>/g, ''));
await page.evaluate(() => document.body.className = 'firefox popup');
for (const name of ['src/common/options.css', 'src/plus/options-plus.css']) await page.addStyleTag({ content: await readFile(root + '/' + name, 'utf8') });
await page.addScriptTag({ content: await readFile(root + '/src/plus/options-plus.js', 'utf8') });
const label = await page.locator('label[for=cast-extras-enabled]').boundingBox();
const help = await page.locator('#cast-extras > div > p').first().boundingBox();
assert.ok(label.width > 180, JSON.stringify(label));
assert.ok(help.y >= label.y + label.height, JSON.stringify({ label, help }));
assert.ok(help.height >= 30, JSON.stringify(help));
const mojoLabel = await page.locator('label[for=mojo-link-enabled]').boundingBox();
assert.ok(mojoLabel.width > 180, JSON.stringify(mojoLabel));
for (const key of ['mal', 'al', 'senscritique', 'mubi', 'douban', 'filmaff', 'simkl', 'allocine', 'kinopoisk', 'filmarks', 'ddd']) assert.equal(await page.locator('#' + key + '-enabled').count(), 0);
const overflow = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
assert.ok(overflow.width <= overflow.viewport, JSON.stringify(overflow));
const toggle = await page.locator('#metacritic-enabled').boundingBox();
assert.ok(toggle.x >= 0 && toggle.x + toggle.width <= 393, JSON.stringify(toggle));
await page.screenshot({ path: path.join(tmpdir(), 'dc-settings-mobile.png'), fullPage: false });
await page.locator('#cast-extras').scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(tmpdir(), 'dc-cast-settings-mobile.png'), fullPage: false });

// Reproduce a mobile film with a changed tooltip and no loaded account controls.
await page.setContent(`<html class="mobile"><head></head><body>
<section class="production-masthead"><h1 class="headline-1 primaryname"><span>Finding Vivian Maier</span></h1><span class="releasedate"><a>2013</a></span></section>
<aside class="sidebar"><section class="section ratings-histogram-chart"><a class="averagerating" title="3.8 out of 5, 20,000 votes"></a><div class="rating-histogram"></div></section></aside>
<p class="text-link text-footer">More at <a class="micro-button track-event" href="https://www.imdb.com/title/tt2714900/">IMDb</a><a class="micro-button track-event" href="https://www.themoviedb.org/movie/169607/">TMDB</a></p>
</body></html>`);
await page.evaluate(() => {
  window.person = { loggedIn: true };
  const settings = { 'ratings-order': [], 'hide-ratings-enabled': 'unchanged', 'hide-reviews-enabled': 'false',
    'imdb-enabled': true, 'imdb-250-enabled': false, 'cast-extras-enabled': false, 'dc-photos-enabled': false, 'metacritic-enabled': true, 'tomato-enabled': true, 'mojo-link-enabled': true, 'ebert-link-enabled': true, 'bluray-link-enabled': true, 'wiki-link-enabled': true };
  window.sent = [];
  window.browser = {
    storage: { sync: { get: async () => ({ options: settings }), set: async () => {} },
      local: { get: async () => ({ options: {} }) }, onChanged: { addListener() {} } },
    runtime: { sendMessage: (message, cb) => { window.sent.push(message);
      if (message.url === 'https://api.graphql.imdb.com/') queueMicrotask(() => cb({ status: 200, url: message.url, response: { data: { title: {
        ratingsSummary: { aggregateRating: 7.7, voteCount: 100 },
        aggregateRatingsBreakdown: { histogram: { histogramValues: Array.from({length:10}, (_, i) => ({rating:i+1, voteCount:10})) } }
      } } } }));
      return undefined; }, getURL: path => path },
  };
});
await page.addScriptTag({ content: await readFile(root + '/src/common/additional.js', 'utf8') });
await page.addScriptTag({ content: await readFile(root + '/src/common/polyfill.js', 'utf8') });
let bundle = await readFile(root + '/src/dist/safari/letterboxd-extras.user.js', 'utf8');
bundle = bundle.replace('const ready = Promise.all(', 'window.__dcTest = letterboxd;\nconst ready = Promise.all(');
await page.addScriptTag({ content: bundle });
await page.waitForFunction(() => window.sent.some(message => message.url === 'https://api.graphql.imdb.com/'));
await page.waitForSelector('.imdb-ratings');
const result = await page.evaluate(() => ({ id: __dcTest.overview.imdbID, links: __dcTest.overview.linksMoved, running: __dcTest.overview.running, requests: sent.length }));
assert.equal(result.id, 'tt2714900');
assert.equal(result.links, true);
assert.equal(result.running, false);
assert.equal(errors.length, 0, errors.join('\n'));
// Additional links remain insertable even without the old nested wrapper.
await page.evaluate(() => __dcTest.overview.addLink('https://www.rogerebert.com/reviews/test', 'Ebert', 'ebert'));
assert.equal(await page.locator('.ebert-button').count(), 1);
await page.evaluate(() => { document.querySelector('.text-footer > div')?.replaceWith(...document.querySelectorAll('.text-footer a')); __dcTest.overview.metaHelper.addButtonLink('https://www.metacritic.com/movie/test/', 'META'); });
assert.equal(await page.locator('.meta-button').count(), 0);
await page.evaluate(() => __dcTest.overview.tomatoHelper.addButtonLink('https://www.rottentomatoes.com/m/test', 'RT'));
assert.equal(await page.locator('.tomato-button').count(), 0);
await page.addScriptTag({ content: await readFile(root + '/src/plus/dc-core.js', 'utf8') });
await page.addScriptTag({ content: await readFile(root + '/src/plus/photos/content.js', 'utf8') });
for (const name of ['src/plus/plus.css', 'src/plus/photos/panel.css']) await page.addStyleTag({ content: await readFile(root + '/' + name, 'utf8') });
await page.evaluate(() => {
  document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width,initial-scale=1">');
  const img = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="%23344556"/></svg>');
  pageMode = 'film';
  filmData = { backdrops: [img], posters: [img], meta: {}, cast: [], tmdbId: 169607 };
  canSet = true;
  buildPanel();
});
const setButton = await page.locator('#tmdb-photo-panel .tmdb-set').boundingBox();
const gridButton = await page.locator('#tmdb-photo-panel .tmdb-open-grid').boundingBox();
assert.equal(setButton.width, 52);
assert.equal(setButton.height, 28);
assert.equal(gridButton.width, 32);
assert.equal(gridButton.height, 28);
// Extras can arrive after the gallery, and friends' activity can arrive later.
await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div class="col-main" data-tmdb-type="movie" data-tmdb-id="169607"></div>'));
await page.route('**/pages/directors-cut-api/**', route => route.fulfill({ json: { results: [{ site: 'YouTube', key: 'test', official: true, type: 'Trailer', name: 'Sample trailer' }] } }));
await page.addScriptTag({ content: await readFile(root + '/src/plus/extras.js', 'utf8') });
await page.waitForFunction(() => document.querySelector('.dc-extras')?.nextElementSibling?.id === 'tmdb-photo-panel');
await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<section id="late-friends"><h2>Activity from Friends</h2></section>'));
await page.waitForFunction(() => document.querySelector('#late-friends')?.previousElementSibling?.id === 'tmdb-photo-panel');
assert.equal(await page.evaluate(() => document.querySelector('.dc-extras').nextElementSibling.id), 'tmdb-photo-panel');
await page.screenshot({ path: path.join(tmpdir(), 'dc-gallery-mobile.png'), fullPage: true });
console.log(JSON.stringify({ settings: overflow, film: result, gallery: { setButton, gridButton }, errors }));
} finally { await browser.close(); }
