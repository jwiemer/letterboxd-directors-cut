// Build-time exclusions for the personal Safari variant. Shared browser sources stay intact.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import MagicString from 'magic-string';

export const excludedKeys = ['mal-enabled', 'al-enabled', 'senscritique-enabled', 'mubi-enabled',
  'douban-enabled', 'filmaff-enabled', 'simkl-enabled', 'allocine-enabled', 'kinopoisk-enabled', 'filmarks-enabled', 'ddd-enabled'];
export const excludedRatings = ['mal-ratings', 'al-ratings', 'anilist-ratings', 'sens-rating', 'sens-ratings', 'mubi-ratings', 'douban-ratings',
  'filmaff-ratings', 'simkl-ratings', 'allocine-ratings', 'kinopoisk-ratings', 'filmarks-ratings'];
const excludedClasses = ['AnilistHelper', 'MubiHelper', 'FilmAffinityHelper', 'KinopoiskHelper', 'SimklHelper', 'MyAnimeListHelper', 'DoubanHelper'];
const excludedMethods = new Set(['searchSensCritique', 'addSensCritique', 'initAllocine', 'addAllocine', 'initDDD',
  'addDDD', 'getFilmarks', 'searchFilmarks', 'addFilmarks', 'getSensFilmQuery', 'createAllocineCriticScore', 'getSensSearchQuery', 'getSensIDQuery']);

export function safariProfilePlugin() {
  return {
    name: 'personal-safari-profile',
    transform(code, id) {
      if (process.env.DC_BUILD_TARGET !== 'safari' || !id.replaceAll('\\', '/').endsWith('/user.js/letterboxd-extras.js')) return null;
      for (const name of excludedClasses) {
        code = code.replace(new RegExp(`^import\\s+\\{\\s*${name}\\s*\\}[^\\n]+\\n`, 'm'), '');
        code = code.replace(new RegExp(`^.*\\{ class: ${name},[^\\n]+\\n`, 'm'), '');
      }
      for (const key of excludedKeys) code = code.replaceAll(`letterboxd.storage.get('${key}')`, 'false');
      const parsed = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const output = new MagicString(code);
      function visit(node) {
        if (ts.isMethodDeclaration(node) && excludedMethods.has(node.name.getText(parsed))) {
          output.remove(node.getFullStart(), node.end + (code[node.end] === ',' ? 1 : 0));
          return;
        }
        ts.forEachChild(node, visit);
      }
      visit(parsed);
      return { code: output.toString(), map: output.generateMap({ hires: true }) };
    },
  };
}

export async function prepareSafari(dist) {
  const file = path.join(dist, 'options.html');
  let html = await readFile(file, 'utf8');
  const stack = [], groups = [];
  for (const match of html.matchAll(/<\/?div\b[^>]*>/gi)) {
    if (!match[0].startsWith('</')) stack.push({ start: match.index, content: match.index + match[0].length });
    else {
      const group = stack.pop();
      if (group) groups.push({ ...group, end: match.index + match[0].length });
    }
  }
  const removed = new Map();
  for (const key of excludedKeys) {
    const at = html.search(new RegExp(`id=["']${key}["']`));
    const group = groups.filter(g => g.start < at && g.end > at && /^\s*<h4\b/.test(html.slice(g.content, at))).sort((a, b) => b.start - a.start)[0];
    if (!group) throw new Error(`Could not exclude settings for ${key}`);
    removed.set(group.start, group);
  }
  for (const group of [...removed.values()].sort((a, b) => b.start - a.start)) {
    html = html.slice(0, group.start) + '<!-- Provider omitted from personal Safari build. -->' + html.slice(group.end);
  }
  const ratingPattern = [...excludedRatings, 'al-ratings'].join('|');
  html = html.replace(new RegExp(`<li\\b[^>]*rating-id=["'](?:${ratingPattern})["'][^>]*>[\\s\\S]*?<\\/li>`, 'g'), '');
  await writeFile(file, html);
  const optionsFile = path.join(dist, 'options.js');
  const options = (await readFile(optionsFile, 'utf8')).replace('function SetRatingsOrder(ratingsOrder){',
    `function SetRatingsOrder(ratingsOrder){\n    ratingsOrder = ratingsOrder.filter(key => !${JSON.stringify(excludedRatings)}.includes(key));`);
  await writeFile(optionsFile, options);
  const backgroundFile = path.join(dist, 'background.js');
  const background = await readFile(backgroundFile, 'utf8');
  const parsed = ts.createSourceFile(backgroundFile, background, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const output = new MagicString(background);
  function visit(node) {
    if (ts.isIfStatement(node) && node.expression.getText(parsed).includes("msg.url.includes('kinopoiskapiunofficial.tech')")) {
      output.remove(node.getFullStart(), node.end);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  await writeFile(backgroundFile, output.toString());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepareSafari(process.argv[2]);
