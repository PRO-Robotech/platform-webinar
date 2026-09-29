import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Prints the Beget · Atlas presentation to PDF: eight pages (the star map, then each
 * chapter as it stands after its last step), built by the presentation's own print
 * layout. Needs a local Chrome or Chromium; set CHROME_PATH to point at another one.
 *
 *   npm run export:pdf  → outputs/platform-beget-atlas.pdf (dark) and
 *                         outputs/platform-beget-atlas-light.pdf (light)
 *
 * The presentation's “Download PDF” button links to these files by theme.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'outputs/platform-beget-atlas.html');

const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter((path): path is string => !!path);
const chrome = candidates.find(path => existsSync(path));
if (!chrome) throw new Error('Chrome or Chromium was not found. Set CHROME_PATH to its executable.');
if (!existsSync(source)) throw new Error('outputs/platform-beget-atlas.html is missing. Run npm run build first.');

for (const light of [false, true]) {
  const target = resolve(root, `outputs/platform-beget-atlas${light ? '-light' : ''}.pdf`);
  const url = `${pathToFileURL(source).href}${light ? '?theme=light' : ''}`;
  const result = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--hide-scrollbars',
    // Time for the embedded fonts and the first layout of every page.
    '--virtual-time-budget=6000',
    `--print-to-pdf=${target}`,
    url,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.status !== 0 || !existsSync(target)) {
    throw new Error(`Chrome could not print the PDF:\n${result.stderr?.toString() ?? ''}`);
  }
  const pages = (readFileSync(target, 'latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  if (pages !== 8) throw new Error(`Expected 8 pages in ${target}, got ${pages}.`);
  console.log(`PDF: ${target} (${pages} pages)`);
}
