import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findChrome, headless, root } from './atlas-assets.ts';

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
const source = resolve(root, 'outputs/platform-beget-atlas.html');
const chrome = findChrome();
if (!existsSync(source)) throw new Error('outputs/platform-beget-atlas.html is missing. Run npm run build first.');

for (const light of [false, true]) {
  const target = resolve(root, `outputs/platform-beget-atlas${light ? '-light' : ''}.pdf`);
  const url = `${pathToFileURL(source).href}${light ? '?theme=light' : ''}`;
  const result = spawnSync(chrome, [
    ...headless, '--no-pdf-header-footer',
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
