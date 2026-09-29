import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** PT Sans and PT Sans Caption as data URLs, so a page works offline and from file://. */
export async function embeddedFonts(): Promise<string> {
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

/** A local Chrome or Chromium for printing and screenshots; CHROME_PATH points at another one. */
export function findChrome(): string {
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
  return chrome;
}

/** Headless flags shared by the exports. Chrome refuses to run as root (as in a Docker build) with its sandbox on. */
export const headless = [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
];
