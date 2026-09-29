import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chapters } from '../src/flow.ts';
import { versions } from '../src/versions/catalog.ts';
import { renderGuide } from '../src/versions/guides.ts';
import { renderNarrativeVersion } from '../src/versions/narrative.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = resolve(root, 'outputs');
const dist = resolve(root, 'dist');
const fingerprint = createHash('sha256').update(JSON.stringify(chapters)).digest('hex');
const metadata = `<meta name="platform-flow" content="${fingerprint}">`;
const stamp = (html: string): string => html.replace(/<meta name="platform-flow" content="[^"]+">/g, '').replace('</head>', `${metadata}</head>`);

async function runtime(family: 'classic' | 'flight' | 'atlas' | 'view-switcher'): Promise<string> {
  const result = await build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      lib: {
        entry: resolve(root, `src/versions/${family}-entry.ts`),
        name: `Platform${family.replaceAll('-', '')}`,
        formats: ['iife'],
      },
    },
  });
  const builds = Array.isArray(result) ? result : [result];
  const chunks = builds.flatMap(output => 'output' in output ? output.output.filter(chunk => chunk.type === 'chunk') : []);
  if (chunks.length !== 1) throw new Error(`${family}: expected one self-contained runtime.`);
  return chunks[0].code.replace(/<\/script/gi, '<\\/script');
}

async function themedPage(family: 'classic' | 'flight' | 'atlas', fonts = ''): Promise<string> {
  const shell = await readFile(resolve(root, `templates/${family}/shell.html`), 'utf8');
  const style = await readFile(resolve(root, `templates/${family}/style.css`), 'utf8');
  const code = await runtime(family);
  return shell.replace('__STYLE__', () => `${fonts}\n${style}\n${switcherStyle}`).replace('__SCRIPT__', () => code);
}

/** PT Sans and PT Sans Caption, embedded so the file works offline. */
async function embeddedFonts(): Promise<string> {
  const css = await readFile(resolve(root, 'src/assets/atlas-fonts.css'), 'utf8');
  const faces = css.match(/@font-face\{[^}]+\}/g) ?? [];
  if (!faces.length) throw new Error('Font faces are missing from atlas-fonts.css.');
  const embedded = await Promise.all(faces.map(async face => {
    const file = face.match(/url\(\.\/([^)]+\.woff2)\)/)?.[1];
    if (!file) throw new Error('A font face has no local woff2 source.');
    const data = (await readFile(resolve(root, 'src/assets', file))).toString('base64');
    return face.replace(/url\([^)]+\)/, `url(data:font/woff2;base64,${data})`);
  }));
  return embedded.join('\n');
}

const switcherStyle = await readFile(resolve(root, 'src/versions/view-switcher.css'), 'utf8');
const narrativeSwitcher = await runtime('view-switcher');
const classic = await themedPage('classic');
const flight = await themedPage('flight');
const atlas = await themedPage('atlas', await embeddedFonts());
await mkdir(resolve(dist, 'outputs'), { recursive: true });
for (const version of versions) {
  let html: string;
  if (version.family === 'narrative') {
    const template = await readFile(resolve(root, `templates/narrative/${version.name}.html`), 'utf8');
    html = renderNarrativeVersion(template, chapters);
    html = html.replace('</head>', () => `<style>${switcherStyle}</style></head>`)
      .replace('</body>', () => `<script>${narrativeSwitcher}</script></body>`);
  } else if (version.family === 'classic') html = classic;
  else if (version.family === 'flight') html = flight;
  else if (version.family === 'atlas') html = atlas;
  else html = await readFile(resolve(outputs, `${version.name}.html`), 'utf8');
  html = html.replace(/href="(?:\.\/)?(?:outputs\/)?[\w-]*guide[\w-]*\.md"/g, `href="${version.guide}.md"`);
  await writeFile(resolve(outputs, `${version.name}.html`), stamp(html));
  await writeFile(resolve(outputs, `${version.guide}.md`), renderGuide(chapters, version));
}

// Publish every saved theme at its actual URL, as well as the outputs/ paths in
// documentation. A missing version must never silently fall back to index.html.
for (const file of await readdir(outputs)) {
  if (!/\.(html|md|png|pdf)$/.test(file)) continue;
  await copyFile(resolve(outputs, file), resolve(dist, file));
  await copyFile(resolve(outputs, file), resolve(dist, 'outputs', file));
}
// The atlas is the default view: the site root serves it. Cosmos stays at platform-beget.html.
await copyFile(resolve(outputs, 'platform-beget-atlas.html'), resolve(dist, 'index.html'));
console.log(`Synchronized ${versions.length} presentations and guides: ${chapters.length} chapters, ${chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0)} events.`);
