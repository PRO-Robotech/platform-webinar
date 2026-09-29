import type { Chapter, DiagramScene, TextLines } from '../types.js';

type DiagramRenderer = (chapter: DiagramScene, step: number) => string;

/** The classic view owns its presentation only; all content and edges come from the shared flow. */
export function mountClassic(chapters: Chapter[], renderDiagram: DiagramRenderer): void {
  if (!chapters.length) throw new Error('The classic presentation requires chapters.');
  const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (value: string | number): string => String(value).replace(/[&<>"']/g, char => escapes[char]);
  const text = (value: TextLines): string => Array.isArray(value) ? value.join(' ') : value;
  function element<T extends HTMLElement = HTMLElement>(id: string): T {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Missing classic element: ${id}`);
    return found as T;
  }
  const dialog = element<HTMLDialogElement>('details-dialog');
  const chapterName = (chapter: Chapter): string => chapter.nav || chapter.label || chapter.title;
  let scene = 0;
  let step = 0;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const eventTotal = chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0);

  function readHash(): { scene: number; step: number } {
    const match = location.hash.match(/^#(?:chapter|scene)-(\d+)(?:-step-(\d+))?$/);
    const scene = Math.max(0, Math.min(chapters.length - 1, match ? Number(match[1]) - 1 : 0));
    const step = Math.max(0, Math.min(chapters[scene].beats.length - 1, match?.[2] ? Number(match[2]) - 1 : 0));
    return { scene, step };
  }
  function writeHash(): void {
    history.replaceState(null, '', `#chapter-${scene + 1}-step-${step + 1}`);
  }
  function openDialog(kicker: string, title: string, html: string, wide = false): void {
    dialog.classList.toggle('wide', wide);
    element('dialog-kicker').textContent = kicker;
    element('dialog-title').textContent = title;
    element('dialog-content').innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  function inspect(id: string): void {
    const node = chapters[scene].nodes.find(node => node.id === id && node.at <= step);
    if (!node) return;
    const variants = (node.variants || []).filter(variant => variant.at <= step).sort((a, b) => a.at - b.at);
    const current = Object.assign({}, node, ...variants);
    const tiers = { l0: 'L0', l1: 'L1', l2: 'L2', external: 'Внешний сервис', actor: 'Участник' };
    openDialog(tiers[node.tier], text(current.title), `<p>${esc(node.detail || text(current.sub))}</p>`);
  }
  function overview(): void {
    openDialog('ПОЛНЫЙ ПУТЬ', 'От заказа к работающему приложению',
      '<div class="overview-fallback">' + chapters.map((chapter, index) =>
        `<button class="overview-chapter" data-chapter="${index}"><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(chapterName(chapter))}</h3><p>${esc(chapter.question)}</p><small>${chapter.beats.length} шагов · ${esc(chapter.duration)}</small></div></button>`
      ).join('') + '</div>', true);
  }
  function render(): void {
    const chapter = chapters[scene];
    const beat = chapter.beats[step];
    element('scene-eyebrow').textContent = `${String(scene + 1).padStart(2, '0')} / ${chapter.kicker}`;
    element('scene-title').textContent = beat.title;
    element('scene-description').textContent = beat.summary;
    element('visual-kicker').textContent = chapterName(chapter).toUpperCase();
    element('scene-duration').textContent = `≈ ${chapter.duration}`;
    element('stage-list').innerHTML = chapter.beats.map((beat, index) =>
      `<button class="step-button${index < step ? ' done' : ''}" data-step="${index}" ${index === step ? 'aria-current="step"' : ''} title="${esc(beat.title)}" aria-label="Шаг ${index + 1}: ${esc(beat.title)}"><span class="step-number">${index < step ? '✓' : String(index + 1).padStart(2, '0')}</span><span class="step-label">${esc(beat.title)}</span></button>`
    ).join('');
    element('step-count').textContent = `ШАГ ${String(step + 1).padStart(2, '0')} / ${String(chapter.beats.length).padStart(2, '0')}`;
    const last = scene === chapters.length - 1 && step === chapter.beats.length - 1;
    element('next-button').innerHTML = (step < chapter.beats.length - 1 ? 'Следующий шаг' : last ? 'Весь путь' : 'Следующая глава') + ` <span aria-hidden="true">${last ? '↗' : '→'}</span>`;
    element<HTMLButtonElement>('previous-button').disabled = scene === 0 && step === 0;
    element<HTMLButtonElement>('forward-button').disabled = last;
    element('current-number').textContent = String(scene + 1).padStart(2, '0');
    element('takeaway').textContent = beat.result;
    element('takeaway').classList.remove('pending');
    element('takeaway').removeAttribute('aria-hidden');
    document.querySelectorAll('.chapter').forEach((item, index) => {
      item.classList.toggle('done', index < scene);
      if (index === scene) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    // The palette adapts the shared drawing to the graphite/orange/cyan classic theme.
    const palette: Record<string, string> = { '#80b4ff': '#ff825c', '#68d5c8': '#65d9e5', '#bbabff': '#d2f58b', '#e2b478': '#d4b780', '#111e2f': '#141e2a', '#0d1726': '#101923' };
    const diagram = renderDiagram(chapter, step).replace(/#80b4ff|#68d5c8|#bbabff|#e2b478|#111e2f|#0d1726/g, color => palette[color]);
    element('diagram').innerHTML = diagram;
    element('notes-title').textContent = beat.title;
    element('notes-duration').textContent = `ГЛАВА ${String(scene + 1).padStart(2, '0')} · ШАГ ${step + 1} / ${chapter.beats.length}`;
    element('notes-content').innerHTML = `<p>${esc(beat.note)}</p>`;
    document.title = `${String(scene + 1).padStart(2, '0')} · ${beat.title} · Beget`;
    element('deck').dataset.chapter = String(scene + 1);
    element('deck').dataset.step = String(step + 1);
  }
  function goScene(index: number, desiredStep = 0): void {
    scene = Math.max(0, Math.min(chapters.length - 1, index));
    step = Math.max(0, Math.min(chapters[scene].beats.length - 1, desiredStep));
    writeHash();
    render();
  }
  function advance(): void {
    if (step < chapters[scene].beats.length - 1) goScene(scene, step + 1);
    else if (scene < chapters.length - 1) goScene(scene + 1);
    else overview();
  }
  function retreat(): void {
    if (step > 0) goScene(scene, step - 1);
    else if (scene > 0) goScene(scene - 1, chapters[scene - 1].beats.length - 1);
  }
  function notes(): void {
    const panel = element('notes-panel');
    panel.hidden = !panel.hidden;
    element('notes-button').setAttribute('aria-expanded', String(!panel.hidden));
  }
  function toast(message: string): void {
    if (toastTimer) clearTimeout(toastTimer);
    element('toast').textContent = message;
    element('toast').hidden = false;
    toastTimer = setTimeout(() => { element('toast').hidden = true; }, 4000);
  }
  async function fullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { toast('Для полного экрана откройте HTML в отдельном браузере и нажмите F11.'); }
  }
  element('chapters').innerHTML = chapters.map((chapter, index) =>
    `<button class="chapter" data-scene="${index}" aria-label="Глава ${index + 1}: ${esc(chapterName(chapter))}"><span class="chapter-number">${String(index + 1).padStart(2, '0')}</span><span class="chapter-title">${esc(chapterName(chapter))}</span></button>`
  ).join('');
  const total = document.querySelector('.total-number');
  if (total) total.textContent = `/ ${String(chapters.length).padStart(2, '0')}`;
  element('chapters').addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-scene]');
    if (target) goScene(Number(target.dataset.scene));
  });
  element('stage-list').addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-step]');
    if (target) goScene(scene, Number(target.dataset.step));
  });
  element('next-button').addEventListener('click', advance);
  element('forward-button').addEventListener('click', advance);
  element('previous-button').addEventListener('click', retreat);
  element('diagram').addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-nodeid]');
    if (target?.dataset.nodeid) inspect(target.dataset.nodeid);
  });
  element('diagram').addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = (event.target as Element).closest<HTMLElement>('[data-nodeid]');
    if (target?.dataset.nodeid) { event.preventDefault(); event.stopPropagation(); inspect(target.dataset.nodeid); }
  });
  element('dialog-content').addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-chapter]');
    if (target) { dialog.close(); goScene(Number(target.dataset.chapter)); }
  });
  element('overview-button').addEventListener('click', overview);
  element('notes-button').addEventListener('click', notes);
  element('close-notes').addEventListener('click', notes);
  element('fullscreen-button').addEventListener('click', () => { void fullscreen(); });
  element('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  element('sources-button').addEventListener('click', () => openDialog('СЦЕНАРИЙ ВЕБИНАРА', 'От заявки до работающего приложения',
    `<p>${chapters.length} глав и ${eventTotal} последовательных событий: заказ, подготовка L1, настройка Vault, создание и инициализация L2, базовые аддоны и пользовательские приложения.</p><p>Содержание, схемы и направления связей синхронизированы с итоговой презентацией Beget. Эта версия сохраняет классическое оформление.</p><p class="detail-label">Управление</p><p>← / → или пробел: шаги. 1–${chapters.length}: главы. Home / End: начало / финал. N: заметки. F: полный экран.</p>`));
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || dialog.open || (event.target as Element).closest('input,textarea,select')) return;
    if (event.key === 'Escape' && !element('notes-panel').hidden) { notes(); return; }
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); advance(); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); retreat(); }
    else if (event.key === ' ' && !(event.target as Element).closest('button,a,[role=button]')) { event.preventDefault(); advance(); }
    else if (event.key === 'Home') { event.preventDefault(); goScene(0); }
    else if (event.key === 'End') { event.preventDefault(); goScene(chapters.length - 1, chapters[chapters.length - 1].beats.length - 1); }
    else if (/^[1-9]$/.test(event.key) && Number(event.key) <= chapters.length) goScene(Number(event.key) - 1);
    else if (['n', 'т'].includes(event.key.toLowerCase())) notes();
    else if (['f', 'а'].includes(event.key.toLowerCase())) void fullscreen();
  });
  window.addEventListener('hashchange', () => { ({ scene, step } = readHash()); render(); });
  ({ scene, step } = readHash());
  render();
}
