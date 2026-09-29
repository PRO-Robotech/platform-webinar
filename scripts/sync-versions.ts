import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chapters } from '../src/flow.ts';
import { versions } from '../src/versions/catalog.ts';
import { renderGuide } from '../src/versions/guides.ts';
import { renderNarrativeVersion } from '../src/versions/narrative.ts';
import { embeddedFonts } from './atlas-assets.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = resolve(root, 'outputs');
const dist = resolve(root, 'dist');
const fingerprint = createHash('sha256').update(JSON.stringify(chapters)).digest('hex');
const metadata = `<meta name="platform-flow" content="${fingerprint}">`;
const stamp = (html: string): string => html.replace(/<meta name="platform-flow" content="[^"]+">/g, '').replace('</head>', `${metadata}</head>`);

// Where the site is published: link previews need absolute URLs. SITE_URL overrides it.
const site = (process.env.SITE_URL ?? 'https://k8s.beget.xlsft.ru').replace(/\/+$/, '');
const events = chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0);
const attr = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/**
 * Link previews (Open Graph, Twitter) and noindex: the presentations are shared by
 * link but kept out of search. Every page shares one preview image (npm run export:og).
 */
function social(html: string, version: typeof versions[number], path = `${version.name}.html`): string {
  const title = version.family === 'atlas' ? 'Атлас Managed Kubernetes · Beget' : version.title;
  const description = `Путь от ClusterClaim до готовой Kubernetes-платформы и приложений пользователя: ${chapters.length} глав и ${events} событий.`;
  const tags = [
    '<meta name="robots" content="noindex, nofollow">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Beget">',
    '<meta property="og:locale" content="ru_RU">',
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${site}/${path}">`,
    `<meta property="og:image" content="${site}/platform-og.png">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${attr(title)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
  ].join('\n');
  return html
    .replace(/<meta (?:name="robots"|property="og:[^"]+"|name="twitter:[^"]+") content="[^"]*">\n?/g, '')
    .replace('</head>', () => `${tags}\n</head>`);
}

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
  await writeFile(resolve(outputs, `${version.name}.html`), stamp(social(html, version)));
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
const atlasVersion = versions.find(version => version.family === 'atlas');
if (!atlasVersion) throw new Error('The atlas version is missing from the catalog.');
await writeFile(resolve(dist, 'index.html'), social(await readFile(resolve(outputs, 'platform-beget-atlas.html'), 'utf8'), atlasVersion, ''));
console.log(`Synchronized ${versions.length} presentations and guides: ${chapters.length} chapters, ${chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0)} events.`);
