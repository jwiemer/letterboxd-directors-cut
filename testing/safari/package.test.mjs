import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'src/dist/safari');
const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));

test('Safari package references files that actually ship', async () => {
  const files = [manifest.action.default_popup.split('?')[0], manifest.options_ui.page,
    ...manifest.background.scripts, ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap(script => [...script.js ?? [], ...script.css ?? []])];
  for (const file of files) await access(path.join(dist, file));
  const options = await readFile(path.join(dist, manifest.options_ui.page), 'utf8');
  for (const match of options.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css|png))"/g)) {
    await access(path.join(dist, match[1]));
  }
});

test('Safari uses a nonpersistent background and removes Chrome-only keys', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.notEqual(manifest.background.persistent, true);
  assert.equal(manifest.options_ui.open_in_tab, undefined);
  assert.equal(manifest.background.service_worker, undefined);
  assert.equal(manifest.minimum_chrome_version, undefined);
  assert.equal(manifest.options_ui.browser_style, undefined);
  assert.ok(manifest.web_accessible_resources.every(resource => !('use_dynamic_url' in resource)));
});

test('Safari ships the same version as the shared Director’s Cut features', async () => {
  const version = process.env.DC_VERSION ?? (await readFile(path.join(root, 'src/plus/VERSION'), 'utf8')).trim();
  assert.equal(manifest.version, version);
  assert.ok(manifest.host_permissions.includes('https://vinciamomedia.com/*'));
  assert.ok(manifest.content_scripts.every(script => script.matches.includes('https://letterboxd.com/*')));
});
