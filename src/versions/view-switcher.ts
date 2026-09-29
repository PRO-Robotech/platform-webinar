import { versions } from './catalog.ts';
import type { PresentationVersion } from './catalog.ts';

type Position = { chapter: number; step: number } | null;

/** A native link menu shared by every presentation skin. */
export function mountViewSwitcher(chapterLengths: readonly number[], basePath = './'): void {
  if (document.querySelector('.view-switcher')) return;
  if (!chapterLengths.length || chapterLengths.some(length => !Number.isInteger(length) || length < 1)) {
    throw new Error('View switching requires positive chapter lengths.');
  }
  const host = document.querySelector<HTMLElement>('header .header-tools, header .header-actions, header .tools');
  if (!host) throw new Error('Presentation header tools are missing.');

  const filename = location.pathname.split('/').pop()?.replace(/\.html$/, '') || 'platform-beget';
  const current = versions.find(version => version.name === filename) || versions[0];
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const menu = document.createElement('details');
  menu.className = 'view-switcher';
  menu.dataset.theme = current.name === 'platform-beget-light-v1' ? 'light' : 'dark';
  menu.dataset.currentView = current.name;
  const summary = document.createElement('summary');
  summary.className = 'view-switcher-trigger';
  summary.setAttribute('aria-label', 'Выбрать оформление презентации');
  summary.title = `Оформление: ${current.switcherLabel}`;
  summary.innerHTML = '<svg class="view-switcher-icon" width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="1.5"/><rect x="12" y="2" width="6" height="6" rx="1.5"/><rect x="2" y="12" width="6" height="6" rx="1.5"/><rect x="12" y="12" width="6" height="6" rx="1.5"/></svg><span class="view-switcher-trigger-label">Вид</span><svg class="view-switcher-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2 4 3 3 3-3"/></svg>';
  const panel = document.createElement('nav');
  panel.className = 'view-switcher-panel';
  panel.setAttribute('aria-label', 'Сохранённые оформления презентации');
  const caption = document.createElement('p');
  caption.className = 'view-switcher-caption';
  caption.textContent = 'Оформление';
  const hint = document.createElement('p');
  hint.className = 'view-switcher-hint';
  hint.textContent = 'Текущий шаг сохранится';
  panel.append(caption, hint);
  const list = document.createElement('ul');
  list.className = 'view-switcher-list';
  const links = versions.map(version => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'view-switcher-link';
    link.dataset.view = version.name;
    const swatch = document.createElement('span');
    swatch.className = `view-switcher-swatch view-switcher-swatch-${version.name}`;
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'view-switcher-label';
    label.textContent = version.switcherLabel;
    link.append(swatch, label);
    if (version.name === current.name) {
      link.setAttribute('aria-current', 'page');
      const check = document.createElement('span');
      check.className = 'view-switcher-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      link.append(check);
    }
    item.append(link);
    list.append(item);
    return { link, version };
  });
  panel.append(list);
  menu.append(summary, panel);
  host.dataset.viewSwitcherHost = '';
  host.prepend(menu);

  function readPosition(): Position {
    const chapterMatch = location.hash.match(/^#(?:chapter|scene)-(\d+)(?:-step-(\d+))?$/);
    if (chapterMatch) {
      const chapter = Math.max(0, Math.min(chapterLengths.length - 1, Number(chapterMatch[1]) - 1));
      const step = Math.max(0, Math.min(chapterLengths[chapter] - 1, Number(chapterMatch[2] || '1') - 1));
      return { chapter, step };
    }
    const stop = location.hash.match(/^#stop-(\d+)$/);
    if (stop) {
      const total = chapterLengths.reduce((sum, length) => sum + length, 0);
      let offset = Math.max(0, Math.min(total - 1, Number(stop[1]) - 1));
      for (let chapter = 0; chapter < chapterLengths.length; chapter++) {
        if (offset < chapterLengths[chapter]) return { chapter, step: offset };
        offset -= chapterLengths[chapter];
      }
    }
    return null;
  }
  function destinationHash(version: PresentationVersion, position: Position): string {
    if (position) return `#chapter-${position.chapter + 1}-step-${position.step + 1}`;
    if (version.family === 'flight') return '#overview';
    if (version.family === 'classic') return '#chapter-1-step-1';
    return '#intro';
  }
  function updateLinks(): void {
    const position = readPosition();
    for (const { link, version } of links) {
      link.setAttribute('href', `${base}${version.name}.html${destinationHash(version, position)}`);
    }
  }
  function close(restoreFocus = false): void {
    menu.open = false;
    if (restoreFocus) summary.focus({ preventScroll: true });
  }
  updateLinks();
  // Presentation runtimes use replaceState, so hashchange alone cannot keep links current.
  menu.addEventListener('toggle', updateLinks);
  menu.addEventListener('focusin', updateLinks);
  menu.addEventListener('pointerdown', updateLinks, true);
  menu.addEventListener('click', updateLinks, true);
  menu.addEventListener('auxclick', updateLinks, true);
  menu.addEventListener('contextmenu', updateLinks, true);
  window.addEventListener('hashchange', updateLinks);
  menu.addEventListener('keydown', event => {
    // Global slide shortcuts must never consume keyboard interaction with this menu.
    event.stopPropagation();
    updateLinks();
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    menu.open = true;
    const focused = links.findIndex(({ link }) => link === document.activeElement);
    let next = focused;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = links.length - 1;
    else if (event.key === 'ArrowDown') next = (focused + 1) % links.length;
    else next = focused <= 0 ? links.length - 1 : focused - 1;
    links[next].link.focus({ preventScroll: true });
  });
  menu.addEventListener('keyup', event => event.stopPropagation());
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && !menu.contains(event.target)) close();
  });
}
