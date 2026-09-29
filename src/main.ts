import './assets/beget-official-fonts.css';
import './style.css';
import './versions/view-switcher.css';
import { mountViewSwitcher } from './versions/view-switcher';
import { chapters } from './flow';
import { render as renderDiagram } from './diagram';
import { startSpace } from './space';
import { chapterNames as names, intro } from './navigation';
import type { NodeKind, TextLines } from './types';

function element<T extends HTMLElement>(selector: string, type: { new(): T }): T {
  const found = document.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing presentation element: ${selector}`);
  return found;
}

const dom = {
  presentation: element('.presentation', HTMLElement),
  sceneContext: element('.scene-context', HTMLElement),
  chapterLabel: element('#chapter-label', HTMLElement),
  eventPosition: element('#event-position', HTMLElement),
  headline: element('#headline', HTMLHeadingElement),
  explanation: element('#explanation', HTMLParagraphElement),
  contextLine: element('#context-line', HTMLElement),
  diagram: element('#diagram', HTMLElement),
  resultCaption: element('#result-caption', HTMLElement),
  resultText: element('#result-text', HTMLParagraphElement),
  next: element('#next', HTMLButtonElement),
  back: element('#back', HTMLButtonElement),
  chapters: element('#chapters', HTMLElement),
  beatNav: element('#beat-nav', HTMLElement),
  storyCount: element('#story-count', HTMLElement),
  dialog: element('#dialog', HTMLDialogElement),
  dialogKicker: element('#dialog-kicker', HTMLElement),
  dialogTitle: element('#dialog-title', HTMLHeadingElement),
  dialogBody: element('#dialog-body', HTMLElement),
  closeDialog: element('#close-dialog', HTMLButtonElement),
  fullscreen: element('#fullscreen', HTMLButtonElement),
  toast: element('#toast', HTMLElement),
};

const escapes: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
const esc = (value: string | number): string => String(value).replace(/[&<>"']/g, char => escapes[char]);
const lines = (value: TextLines): string[] => Array.isArray(value) ? value : [value];

function formatExplanation(value: string): string {
  return value.split(/(ClusterClaim Operator|Control plane L2|ClusterClaim|Cluster API|Cluster L[12]|AddonOperator|AddonClaim|Applications|Argo CD|Vault)/g)
    .map((part, index) => index % 2 ? `<span class="technical-name">${esc(part)}</span>` : esc(part))
    .join('');
}

const offsets = chapters.map((_, index) => chapters.slice(0, index).reduce((sum, value) => sum + value.beats.length, 0));
const total = chapters.reduce((sum, value) => sum + value.beats.length, 0);
const eventWord = total % 100 >= 11 && total % 100 <= 14 ? 'СОБЫТИЙ'
  : total % 10 === 1 ? 'СОБЫТИЕ' : total % 10 >= 2 && total % 10 <= 4 ? 'СОБЫТИЯ' : 'СОБЫТИЙ';
let chapter = -1;
let step = 0;
let frameAlignment = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;


function alignFrame(): void {
  if (frameAlignment) cancelAnimationFrame(frameAlignment);
  frameAlignment = requestAnimationFrame(() => {
    frameAlignment = 0;
    const rect = dom.diagram.getBoundingClientRect();
    const width = Math.min(rect.width, rect.height * 1168 / 420);
    dom.presentation.style.setProperty('--content-width', `${width}px`);
  });
}

function render(): void {
  const current = chapter >= 0 ? chapters[chapter] : undefined;
  const beat = current?.beats[step];
  const opening = !current || !beat;
  dom.chapterLabel.textContent = opening ? 'ИСТОРИЯ ОДНОГО ЗАКАЗА' : `${String(chapter + 1).padStart(2, '0')} / ${current.kicker}`;
  dom.eventPosition.textContent = opening ? 'L0 → L1 → L2' : `СОБЫТИЕ ${String(offsets[chapter] + step + 1).padStart(2, '0')} / ${total}`;
  dom.headline.textContent = opening ? 'Что происходит после «Создать кластер»?' : beat.title;
  dom.explanation.innerHTML = formatExplanation(opening
    ? 'Одна заявка запускает создание целой платформы. Проследим, кто действует, что появляется и почему разрешен следующий шаг.' : beat.summary);
  dom.contextLine.textContent = opening ? 'ТРИ УРОВНЯ ОДНОЙ ПЛАТФОРМЫ'
    : chapter === 2 ? 'ВЕТКИ ИДУТ ОДНОВРЕМЕННО · МЕНЯЕТСЯ ТОЛЬКО ФОКУС РАССКАЗА' : current.question;
  dom.sceneContext.classList.toggle('parallel', chapter === 2);
  dom.diagram.innerHTML = renderDiagram(opening ? intro : current, opening ? 0 : step);
  alignFrame();
  dom.resultCaption.textContent = opening ? 'ГЛАВНЫЙ ВОПРОС' : 'ЧТО ИЗМЕНИЛОСЬ';
  dom.resultText.textContent = opening ? 'Как из конфигурации получить Kubernetes, готовый для приложений пользователя?' : beat.result;

  let nextTitle = 'Начать историю';
  if (current && beat) {
    if (step < current.beats.length - 1) nextTitle = current.beats[step + 1].title;
    else if (chapter < chapters.length - 1) nextTitle = chapters[chapter + 1].beats[0].title;
    else nextTitle = 'В начало';
  }
  const last = current && chapter === chapters.length - 1 && step === current.beats.length - 1;
  dom.next.innerHTML = `${esc(nextTitle)} <span aria-hidden="true">${last ? '↺' : '→'}</span>`;
  dom.next.setAttribute('aria-label', opening ? 'Начать историю' : `Далее: ${nextTitle}`);
  dom.back.disabled = opening;
  document.querySelectorAll('.chapter').forEach((button, index) => {
    if (index === chapter) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  dom.beatNav.innerHTML = opening ? '' : current.beats.map((value, index) =>
    `<button class="beat-dot" data-beat="${index}" aria-label="Событие ${offsets[chapter] + index + 1}: ${esc(value.title)}" ${index === step ? 'aria-current="step"' : ''} title="${esc(value.title)}"></button>`).join('');
  dom.storyCount.textContent = opening ? `${chapters.length} ГЛАВ · ${total} ${eventWord}` : `${step + 1} / ${current.beats.length} В ЭТОЙ ГЛАВЕ`;
  document.title = `${opening ? 'Путь кластера' : beat.title} · Beget`;
}

function go(index: number, beat = 0, options: { fromHash?: boolean } = {}): void {
  chapter = Math.max(-1, Math.min(chapters.length - 1, index));
  step = chapter < 0 ? 0 : Math.max(0, Math.min(chapters[chapter].beats.length - 1, beat));
  if (!options.fromHash) history.replaceState(null, '', chapter < 0 ? '#intro' : `#chapter-${chapter + 1}-step-${step + 1}`);
  render();
}

function next(): void {
  if (chapter < 0) go(0);
  else if (step < chapters[chapter].beats.length - 1) go(chapter, step + 1);
  else if (chapter < chapters.length - 1) go(chapter + 1);
  else go(-1);
}

function back(): void {
  if (chapter < 0) return;
  if (step > 0) go(chapter, step - 1);
  else if (chapter > 0) go(chapter - 1, chapters[chapter - 1].beats.length - 1);
  else go(-1);
}

function inspect(id: string): void {
  const current = chapter < 0 ? intro : chapters[chapter];
  const original = current.nodes.find(node => node.id === id);
  if (!original) return;
  let node = { ...original };
  for (const variant of node.variants ?? []) {
    if (variant.at <= step) node = { ...node, ...variant };
  }
  const types: Record<NodeKind, string> = {
    resource: 'Ресурс Kubernetes', operator: 'Контроллер', cloud: 'Облачный сервис',
    machines: 'Машины и узлы', app: 'Приложение', endpoint: 'Точка доступа API',
    storage: 'Хранилище', gate: 'Условие перехода', user: 'Пользователь',
  };
  dom.dialog.classList.remove('wide');
  dom.dialogKicker.textContent = node.tier === 'actor' ? 'Участник процесса'
    : `${node.tier === 'external' ? 'Внешний сервис' : node.tier.toUpperCase()} · ${node.detailKind ?? types[node.kind]}`;
  dom.dialogTitle.textContent = lines(node.title).join(' ');
  dom.dialogBody.innerHTML = `<p>${node.detail ? esc(node.detail) : lines(node.sub).map(esc).join('<br>')}</p>`
    + (node.badges ?? []).filter(badge => badge.at <= step).map(badge => `<p>${esc(badge.label)}</p>`).join('');
  if (!dom.dialog.open) dom.dialog.showModal();
}

function closest(event: Event, selector: string): Element | null {
  return event.target instanceof Element ? event.target.closest(selector) : null;
}

dom.chapters.innerHTML = names.map((name, index) =>
  `<button class="chapter" data-chapter="${index}" aria-label="Глава ${index + 1}: ${esc(name)}"><span class="chapter-number">${String(index + 1).padStart(2, '0')}</span>${esc(name)}</button>`).join('');
dom.chapters.addEventListener('click', event => {
  const button = closest(event, '[data-chapter]');
  if (button) go(Number(button.getAttribute('data-chapter')));
});
dom.beatNav.addEventListener('click', event => {
  const button = closest(event, '[data-beat]');
  if (button) go(chapter, Number(button.getAttribute('data-beat')));
});
dom.next.addEventListener('click', next);
dom.back.addEventListener('click', back);
dom.closeDialog.addEventListener('click', () => dom.dialog.close());
dom.diagram.addEventListener('click', event => {
  const id = closest(event, '[data-nodeid]')?.getAttribute('data-nodeid');
  if (id) inspect(id);
});
dom.diagram.addEventListener('keydown', event => {
  const id = closest(event, '[data-nodeid]')?.getAttribute('data-nodeid');
  if (id && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    event.stopPropagation();
    inspect(id);
  }
});
dom.dialog.addEventListener('click', event => {
  if (event.target !== dom.dialog) return;
  const rect = dom.dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dom.dialog.close();
});
dom.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    clearTimeout(toastTimer);
    dom.toast.textContent = 'Для полного экрана откройте HTML в браузере и нажмите F11.';
    dom.toast.hidden = false;
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 4000);
  }
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || dom.dialog.open || closest(event, 'input,textarea,select')) return;
  const key = event.key.toLowerCase();
  if (event.key === 'Escape') return;
  if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); back(); }
  else if (event.key === ' ' && !closest(event, 'button,a,[role=button]')) { event.preventDefault(); next(); }
  else if (/^[1-9]$/.test(event.key) && Number(event.key) <= chapters.length) go(Number(event.key) - 1);
  else if (event.key === 'Home') go(-1);
  else if (event.key === 'End') go(chapters.length - 1, chapters[chapters.length - 1].beats.length - 1);
  else if (['f', 'а'].includes(key)) dom.fullscreen.click();
});

function hashState(): { chapter: number; step: number } {
  const match = location.hash.match(/^#chapter-(\d+)-step-(\d+)$/);
  return match ? { chapter: Number(match[1]) - 1, step: Number(match[2]) - 1 } : { chapter: -1, step: 0 };
}
window.addEventListener('hashchange', () => {
  const state = hashState();
  go(state.chapter, state.step, { fromHash: true });
});
window.addEventListener('resize', alignFrame, { passive: true });
void document.fonts.ready.then(alignFrame);
startSpace();
const initial = hashState();
go(initial.chapter, initial.step, { fromHash: true });
mountViewSwitcher(chapters.map(chapter => chapter.beats.length), import.meta.env.DEV ? './outputs/' : './');
