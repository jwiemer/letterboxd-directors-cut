import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../src/plus/photos/content.js', import.meta.url), 'utf8');

for (const [device, navigator] of [
  ['iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }],
  ['iPad desktop mode', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }],
]) {
  test(`${device} opens the original image during the tap without fetching first`, async () => {
    const opened = [];
    const context = vm.createContext({ navigator, location: { pathname: '/' },
      window: { open: (...args) => opened.push(args) },
      fetch: () => { throw new Error('Must preserve user activation'); },
    });
    vm.runInContext(source, context);
    const button = { disabled: false };
    const promise = context.downloadOriginal('https://image.tmdb.org/t/p/w780/poster.jpg', 0, button);
    assert.equal(opened.length, 1, 'Opening must happen synchronously, before the first await');
    assert.deepEqual(opened[0], ['https://image.tmdb.org/t/p/original/poster.jpg', '_blank', 'noopener']);
    await promise;
    assert.equal(button.disabled, false);
  });
}

test('Desktop keeps downloading the full-resolution file and releases its blob URL', async () => {
  const events = [];
  const link = { click: () => events.push('click'), remove: () => events.push('remove') };
  const context = vm.createContext({ navigator: { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 },
    location: { pathname: '/' }, window: { open: () => assert.fail('Unexpected fallback') },
    fetch: async url => { events.push(url); return { ok: true, blob: async () => ({}) }; },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: url => events.push(url) },
    setTimeout: callback => callback(),
    document: { createElement: () => link, body: { appendChild: () => events.push('append') } },
  });
  vm.runInContext(source, context);
  const button = { disabled: false };
  await context.downloadOriginal('https://image.tmdb.org/t/p/w780/poster.jpg', 0, button);
  assert.deepEqual(events, ['https://image.tmdb.org/t/p/original/poster.jpg', 'append', 'click', 'remove', 'blob:test']);
  assert.equal(button.disabled, false);
  assert.equal(link.download, 'letterboxd-still-1.jpg');
});
