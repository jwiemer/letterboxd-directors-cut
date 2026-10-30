import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const background = await readFile(new URL('../../src/plus/live-styles-background.js', import.meta.url), 'utf8');
const content = await readFile(new URL('../../src/plus/live-styles.js', import.meta.url), 'utf8');
const css = "/* Director's Cut live styles v1 */\n.dc-card-title { color: red; }";
const key = 'dc-live-css-cache-v1';
const source = 'https://raw.githubusercontent.com/jwiemer/letterboxd-directors-cut/safari-ios/safari/styles/live.css';

function fixture({ enabled = true, permission = true, cache, response = css, fail = false } = {}) {
  const store = cache ? { [key]: cache } : {};
  let listener, requests = 0;
  const api = {
    runtime: { onMessage: { addListener: fn => { listener = fn; } } },
    permissions: { contains: async () => permission },
    storage: {
      sync: { get: async () => ({ options: { 'dc-live-css-enabled': enabled } }) },
      local: { get: async () => store, set: async data => Object.assign(store, data) },
    },
  };
  vm.runInNewContext(background, { browser: api, TextEncoder, TextDecoder, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests++;
      assert.equal(url, source);
      assert.equal(options.credentials, 'omit');
      if (fail) throw new Error('offline');
      return new Response(response);
    },
  });
  return { store, requests: () => requests,
    call: (force = false, sender = {}) => new Promise(resolve => {
      assert.equal(listener({ name: 'DC_LIVE_CSS', force }, sender, resolve), true);
    }),
  };
}

test('Disabled updates and denied permission never fetch or return cached CSS', async () => {
  for (const options of [{ enabled: false }, { permission: false }]) {
    const f = fixture({ ...options, cache: { source, css, checkedAt: Date.now() } });
    assert.equal((await f.call()).css, '');
    assert.equal(f.requests(), 0);
  }
});

test('Downloads CSS, caches it, and avoids another request for five minutes', async () => {
  const f = fixture();
  assert.equal((await f.call()).state, 'updated');
  assert.equal(f.store[key].css, css);
  assert.equal((await f.call()).state, 'cached');
  assert.equal(f.requests(), 1);
  assert.equal((await f.call(true)).state, 'updated');
  assert.equal(f.requests(), 2);
  // A content script cannot bypass the interval by sending force:true.
  assert.equal((await f.call(true, { tab: { id: 1 } })).state, 'cached');
  assert.equal(f.requests(), 2);
});

test('Offline checks retain the last valid stylesheet, with bundled fallback for first use', async () => {
  const f = fixture({ fail: true, cache: { source, css, checkedAt: 1 } });
  const result = await f.call();
  assert.equal(result.state, 'offline');
  assert.equal(result.css, css);
  assert.equal((await fixture({ fail: true }).call()).css, '');
});

test('Rejects HTML, nested imports, and oversized CSS without replacing the good cache', async () => {
  for (const response of ['<html>404</html>', css + '\n@import "https://example.com/file.css";', css + ' '.repeat(128 * 1024)]) {
    const f = fixture({ response, cache: { source, css, checkedAt: 1 } });
    assert.equal((await f.call()).css, css);
    assert.equal(f.store[key].checkedAt, 1);
  }
});

test('Drops cache from an unexpected source', async () => {
  const f = fixture({ fail: true, cache: { source: 'https://example.com', css, checkedAt: 1 } });
  assert.equal((await f.call()).css, '');
});

test('Adds CSS as text, updates it once, and removes it when switched off', async () => {
  let style = null, handler, result = { css };
  const doc = {
    getElementById: () => style,
    createElement: () => ({ remove() { style = null; } }),
    head: { append: node => { style = node; } },
  };
  vm.runInNewContext(content, { document: doc, browser: {
    runtime: { sendMessage: async () => result, getManifest: () => ({ background: { scripts: ['plus/live-styles-background.js'] } }) },
    storage: { onChanged: { addListener: fn => { handler = fn; } } },
  } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(style.textContent, css);
  assert.equal(style.id, 'dc-live-css');
  result = { css: css + '\n.dc-extras { margin: 0; }' };
  handler({ [key]: {} }, 'local');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(style.textContent, result.css);
  result = { css: '', state: 'disabled' };
  handler({ options: {} }, 'sync');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(style, null);
});

test('The published starter stylesheet is accepted by the updater', async () => {
  const starter = await readFile(new URL('../../safari/styles/live.css', import.meta.url), 'utf8');
  const result = await fixture({ response: starter }).call();
  assert.equal(result.state, 'updated');
  assert.equal(result.css, starter);
});
