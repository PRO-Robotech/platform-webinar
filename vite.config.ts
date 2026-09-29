import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Serves the atlas skin from its sources during development, at the site root (the
 * default view) and at the path of the built file.
 */
function atlasDevPage(): Plugin {
  return {
    name: 'atlas-dev-page',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split(/[?#]/)[0] ?? '';
        // Files the atlas links to relatively (PDFs, the guide) live in outputs/.
        if (/^\/platform-[\w-]+\.(pdf|md|png)$/.test(path) && existsSync(resolve(root, `outputs${path}`))) {
          request.url = `/outputs${request.url}`;
          return next();
        }
        // The site root serves the default view, the atlas; Cosmos stays at /index.html.
        if (path !== '/' && path !== '/outputs/platform-beget-atlas.html') return next();
        try {
          const shell = (await readFile(resolve(root, 'templates/atlas/shell.html'), 'utf8'))
            .replace('<style>__STYLE__</style>', () => [
              '/src/assets/atlas-fonts.css', '/templates/atlas/style.css', '/src/versions/view-switcher.css',
            ].map(href => `<link rel="stylesheet" href="${href}">`).join(''))
            .replace('<script>__SCRIPT__</script>', () => '<script type="module" src="/src/versions/atlas-entry.ts"></script>');
          const html = await server.transformIndexHtml(request.url ?? path, shell);
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [atlasDevPage()],
  build: {
    // Keep fonts embedded so the exported HTML also works offline.
    assetsInlineLimit: Infinity,
    modulePreload: false,
    cssCodeSplit: false,
    sourcemap: false,
  },
});
