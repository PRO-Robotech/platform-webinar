import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(root, 'outputs');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');

// The presentation has one entry module and one stylesheet. Fail explicitly if
// the build shape changes, so an incomplete offline export is never published.
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) {
  throw new Error('Standalone export expects exactly one script and one stylesheet.');
}
const script = scripts[0];
const style = styles[0];
const code = await readFile(resolve(dist, script[1]), 'utf8');
const css = await readFile(resolve(dist, style[1]), 'utf8');
new Script(code, { filename: script[1] });

// Use a classic script at the end of the body for file:// support. The app has
// no runtime imports or exports; fonts and images are already embedded by Vite.
const standalone = html
  .replace(script[0], '')
  .replace(/[\t ]+\n/g, '\n')
  .replace(style[0], () => `<style>${css}</style>`)
  .replace('href="./outputs/platform-beget-guide.md"', 'href="platform-beget-guide.md"')
  .replace('</body>', () => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script></body>`);

await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'platform-beget.html'), standalone);
await copyFile(resolve(dist, 'index.html'), resolve(dist, 'platform-beget.html'));
await mkdir(resolve(dist, 'outputs'), { recursive: true });
await copyFile(resolve(output, 'platform-beget-guide.md'), resolve(dist, 'outputs/platform-beget-guide.md'));
console.log('Static site: dist/; offline presentation: outputs/platform-beget.html');
