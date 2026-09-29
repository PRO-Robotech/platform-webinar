import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { embeddedFonts, findChrome, headless, root } from './atlas-assets.ts';

/**
 * Draws the link preview (Open Graph image, 1200×630) for every page: the opening star
 * map as the background, the question of the talk and its timeline. Needs Chrome.
 *
 *   npm run export:og  → outputs/platform-og.png
 */
const result = await build({
  root,
  configFile: false,
  publicDir: false,
  logLevel: 'error',
  build: { write: false, minify: true, sourcemap: false, lib: { entry: resolve(root, 'src/versions/og-entry.ts'), name: 'PlatformOg', formats: ['iife'] } },
});
const builds = Array.isArray(result) ? result : [result];
const chunks = builds.flatMap(output => 'output' in output ? output.output.filter(chunk => chunk.type === 'chunk') : []);
if (chunks.length !== 1) throw new Error('og: expected one self-contained runtime.');
const code = chunks[0].code.replace(/<\/script/gi, '<\\/script');

const shell = await readFile(resolve(root, 'templates/atlas/shell.html'), 'utf8');
const logo = shell.match(/<svg class="brand-logo"[\s\S]*?<\/svg>/)?.[0];
if (!logo) throw new Error('The Beget logo is missing from the atlas shell.');
const style = [await embeddedFonts(), await readFile(resolve(root, 'templates/atlas/style.css'), 'utf8'), await readFile(resolve(root, 'templates/og/style.css'), 'utf8')].join('\n');
const page = (await readFile(resolve(root, 'templates/og/og.html'), 'utf8'))
  .replace('__STYLE__', () => style).replace('__LOGO__', () => logo).replace('__SCRIPT__', () => code);

const work = resolve(root, 'work');
await mkdir(work, { recursive: true });
const source = resolve(work, 'og.html');
await writeFile(source, page);
const target = resolve(root, 'outputs/platform-og.png');
const run = spawnSync(findChrome(), [
  ...headless, '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=4000',
  `--screenshot=${target}`, pathToFileURL(source).href,
], { stdio: ['ignore', 'ignore', 'pipe'] });
if (run.status !== 0 || !existsSync(target)) throw new Error(`Chrome could not draw the preview:\n${run.stderr?.toString() ?? ''}`);
console.log(`Preview: ${target}`);
