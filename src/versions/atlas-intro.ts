import type { Chapter, NodeKind, TextLines, Tier } from '../types.ts';
import { KINDS, joinParts, symbol, textWidth, type DiagramView } from './atlas-diagram.ts';

/**
 * The opening frame: one order and the whole platform it grows into, as a star
 * map. Every component that appears during the talk is a star, drawn with its type
 * mark and grouped into constellations by level. Lines are the real relations from
 * the chapter schemes: solid inside a constellation, faint between them. On entry only ClusterClaim is lit, then the platform lights up
 * wave by wave along those relations.
 */
const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1200;
const HEIGHT = 416;

type Point = [number, number];
type Attrs = Record<string, string | number>;

/** Constellation regions, snapped to the page grid columns. */
const REGIONS: { tiers: Tier[]; label: string; x: number; y: number; w: number; h: number }[] = [
  { tiers: ['l0'], label: 'L0 · управляющий кластер', x: 0, y: 0, w: 384, h: 248 },
  { tiers: ['external'], label: 'Внешние сервисы', x: 0, y: 272, w: 384, h: 144 },
  { tiers: ['l1'], label: 'L1 · инфраструктурный кластер', x: 408, y: 0, w: 486, h: 416 },
  { tiers: ['l2', 'actor'], label: 'L2 · клиент и пользователи', x: 918, y: 0, w: 282, h: 416 },
];

/** Star positions, by component title as it appears in the shared flow. */
const STARS: Record<string, Point> = {
  'Заказчик': [40, 176],
  'ClusterClaim': [112, 136],
  'ClusterClaim Operator': [196, 80],
  'Сертификаты': [120, 56],
  'CSR + CCM': [296, 56],
  'Cluster L1': [184, 204],
  'Cluster L2': [280, 164],
  'Cluster API': [312, 224],
  'AddonClaim': [352, 112],
  'Условия для L2': [368, 40],
  'Облако Backup-бакет': [72, 320],
  'Vault': [160, 352],
  'Auth и роли': [232, 392],
  'Секреты': [272, 336],
  'KMS Transit': [352, 368],
  'Облако': [336, 296],
  'Машины L1': [448, 320],
  'Cilium CoreDNS': [520, 376],
  'Argo CD AddonOperator': [616, 352],
  'Изоляция': [456, 56],
  'Наблюдаемость': [544, 88],
  'Защита': [640, 56],
  'Аддоны': [728, 88],
  'Addon (CP)': [472, 176],
  'Addon': [560, 216],
  'Applications': [656, 176],
  'Control plane L2': [768, 208],
  'Узлы L1': [728, 304],
  'Общий etcd L1': [840, 280],
  'API L2': [960, 208],
  'Аддоны L2': [984, 104],
  'Приложение': [1072, 256],
  'Пользователь получает кластер': [1112, 152],
  'Пользователь': [1136, 352],
};

/** Named stars, as bright stars carry names on a chart. The rest show a tooltip. */
const NAMED = new Set(['ClusterClaim', 'ClusterClaim Operator', 'Vault', 'Control plane L2', 'Приложение']);

const regionOf = (tier: Tier | undefined): number => REGIONS.findIndex(region => tier !== undefined && region.tiers.includes(tier));
const titleOf = (value: TextLines): string => Array.isArray(value) ? value.join(' ') : value;

interface Entity { title: string; label: string; description: string; tier: Tier; kind: NodeKind; chapter: number; step: number }

/** Every component of the talk, once, with where it first appears; and their relations. */
export function platformMap(chapters: Chapter[]): { entities: Map<string, Entity>; links: [string, string][] } {
  const entities = new Map<string, Entity>();
  const links = new Map<string, [string, string]>();
  chapters.forEach((chapter, index) => {
    const titles = new Map(chapter.nodes.map(node => [node.id, titleOf(node.title)]));
    for (const node of [...chapter.nodes].sort((a, b) => a.at - b.at)) {
      const title = titleOf(node.title);
      if (!entities.has(title)) entities.set(title, { title, label: joinParts(node.title), description: '', tier: node.tier, kind: node.kind, chapter: index, step: node.at });
      // The fuller description wins: a block's detail text over its subtitle.
      const entity = entities.get(title)!;
      const description = node.detail ?? joinParts(node.sub);
      if (node.detail ? !entity.description || entity.description.length < description.length : !entity.description) entity.description = description;
    }
    for (const edge of chapter.edges) {
      const a = titles.get(edge.from);
      const b = titles.get(edge.to);
      if (!a || !b || a === b) continue;
      const pair: [string, string] = a < b ? [a, b] : [b, a];
      links.set(pair.join('\u0000'), pair);
    }
  });
  return { entities, links: [...links.values()] };
}

/**
 * Where a step happens on the star map: the middle of its participants' stars.
 * Chapter changes fly the camera between these points.
 */
export function stepStar(chapters: Chapter[], index: number, beat: number): Point | null {
  const chapter = chapters[index];
  const ids = new Set(chapter?.beats[beat]?.active ?? []);
  const points = (chapter?.nodes ?? []).filter(node => ids.has(node.id)).map(node => STARS[titleOf(node.title)]).filter(Boolean);
  if (!points.length) return null;
  return [points.reduce((sum, [x]) => sum + x, 0) / points.length, points.reduce((sum, [, y]) => sum + y, 0) / points.length];
}

/** Build check: every component has a place on the star map. */
export function validateStarMap(chapters: Chapter[]): string[] {
  return [...platformMap(chapters).entities.keys()].filter(title => !STARS[title]).map(title => `вступление «Атласа»: нет места для «${title}»`);
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

/** Level as shown in the tooltip; participants are outside the levels, so they have none. */
const LEVEL_NAMES: Record<Tier, string> = { l0: 'L0', l1: 'L1', l2: 'L2', external: 'внешний сервис', actor: '' };

export function createStarMap(chapters: Chapter[], options: { entrance?: boolean } = {}): DiagramView {
  const { entities, links } = platformMap(chapters);

  const svg = el('svg', { class: 'dg stars', width: WIDTH, height: HEIGHT, viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'group',
    'aria-label': `Одна заявка ClusterClaim и ${entities.size} компонентов платформы, которые из нее вырастут` });

  for (const region of REGIONS) {
    const count = [...entities.values()].filter(entity => region.tiers.includes(entity.tier)).length;
    const label = el('text', { class: 's-region-label', x: region.x + 16, y: region.y + 24 }, svg);
    label.textContent = region.label;
    el('tspan', { class: 's-count', dx: 8 }, label).textContent = String(count);
  }

  // Waves: distance from ClusterClaim along the relations.
  const origin = 'ClusterClaim';
  const wave = new Map<string, number>([[origin, 0]]);
  const queue = [origin];
  while (queue.length) {
    const current = queue.shift()!;
    for (const [a, b] of links) {
      const next = a === current ? b : b === current ? a : null;
      if (next && !wave.has(next)) { wave.set(next, wave.get(current)! + 1); queue.push(next); }
    }
  }
  const last = Math.max(...wave.values()) + 1;

  const lineLayer = el('g', {}, svg);
  const starLayer = el('g', {}, svg);
  // Lines inside a constellation carry its shape; links between constellations stay faint.
  const lines = links.filter(([a, b]) => STARS[a] && STARS[b]).map(([a, b]) => {
    const [from, to] = (wave.get(a) ?? last) <= (wave.get(b) ?? last) ? [a, b] : [b, a];
    const [x1, y1] = STARS[from];
    const [x2, y2] = STARS[to];
    const cross = regionOf(entities.get(from)?.tier) !== regionOf(entities.get(to)?.tier);
    const line = el('path', { class: `s-link${cross ? ' cross' : ''}`, d: `M${x1} ${y1}L${x2} ${y2}` }, lineLayer);
    return { line, wave: wave.get(to) ?? last, length: Math.hypot(x2 - x1, y2 - y1) };
  });

  const stars = [...entities.values()].filter(entity => STARS[entity.title]).map(entity => {
    const [x, y] = STARS[entity.title];
    const main = entity.title === origin;
    const level = LEVEL_NAMES[entity.tier];
    const g = el('g', {
      class: `s-star${main ? ' origin' : ''}`, transform: `translate(${x} ${y})`,
      'data-go': `${entity.chapter}:${entity.step}`, tabindex: 0, role: 'button',
      'aria-label': [entity.label, KINDS[entity.kind], level, `появляется в главе ${entity.chapter + 1}`].filter(Boolean).join(', '),
    }, starLayer);
    // The body animates on its own element, so the position on the group is never overridden.
    const body = el('g', { class: 's-body' }, g);
    el('circle', { class: 's-hit', r: 16 }, body);
    if (main) el('circle', { class: 's-halo', r: 18 }, body);
    // A plate of ink under the mark, so constellation lines stop at the icon.
    el('circle', { class: 's-plate', r: main ? 13 : 11 }, body);
    const scale = main ? 1.8 : 1.4;
    symbol(entity.kind, el('g', { class: 's-mark', transform: `scale(${scale}) translate(-5 -5)` }, body));
    if (NAMED.has(entity.title)) {
      const left = x > WIDTH - 160;
      const gap = main ? 26 : 18;
      el('text', { class: 's-name', x: left ? -gap : gap, y: 5, 'text-anchor': left ? 'end' : 'start' }, body).textContent = entity.label;
    }
    return { g, body, entity, x, y, wave: wave.get(entity.title) ?? last };
  });

  // Tooltip: name, type and level, then the component's description from its block.
  const TIP_TEXT = 296;
  const tip = el('g', { class: 's-tip', 'aria-hidden': 'true' }, svg);
  const tipBox = el('rect', { class: 's-tip-box', rx: 2 }, tip);
  const tipTitle = el('text', { class: 's-tip-title', x: 12, y: 24 }, tip);
  const tipMeta = el('text', { class: 's-tip-meta', x: 12, y: 42 }, tip);
  const tipBody = el('text', { class: 's-tip-body', x: 12, y: 66 }, tip);
  tip.style.display = 'none';
  const wrapDescription = (text: string): string[] => {
    const rows: string[] = [];
    let row = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = row ? `${row} ${word}` : word;
      if (row && textWidth(next, 14) > TIP_TEXT) { rows.push(row); row = word; } else row = next;
    }
    if (row) rows.push(row);
    return rows;
  };
  const show = ({ entity, x, y }: typeof stars[number]): void => {
    tipTitle.textContent = entity.label;
    tipMeta.textContent = [KINDS[entity.kind], LEVEL_NAMES[entity.tier]].filter(Boolean).join(' · ');
    tipBody.replaceChildren();
    const rows = wrapDescription(entity.description);
    rows.forEach((row, index) => { el('tspan', { x: 12, dy: index ? 20 : 0 }, tipBody).textContent = row; });
    tip.style.display = '';
    const width = Math.ceil(Math.max(tipTitle.getComputedTextLength(), tipMeta.getComputedTextLength(),
      ...rows.map(row => textWidth(row, 14)))) + 24;
    const height = rows.length ? 66 + (rows.length - 1) * 20 + 14 : 54;
    tipBox.setAttribute('width', String(width));
    tipBox.setAttribute('height', String(height));
    const left = x + 24 + width > WIDTH ? x - 24 - width : x + 24;
    const top = Math.min(HEIGHT - height, Math.max(0, y - 28));
    tip.setAttribute('transform', `translate(${left} ${top})`);
  };
  const hide = (): void => { tip.style.display = 'none'; };
  // Tooltips wait until the entrance has finished.
  let ready = true;
  for (const star of stars) {
    star.g.addEventListener('pointerenter', () => { if (ready) show(star); });
    star.g.addEventListener('pointerleave', hide);
    star.g.addEventListener('focus', () => { if (ready) show(star); });
    star.g.addEventListener('blur', hide);
  }

  // The orchestrated entrance: ClusterClaim first, then each wave of the platform lights up.
  // Skipped when returning to the map: then it zooms out already lit.
  if (options.entrance !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const start = 500;
    const step = 280;
    ready = false;
    const entrance: Animation[] = [];
    for (const { body, wave: index } of stars) {
      if (!index) continue;
      entrance.push(body.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 360, delay: start + index * step, fill: 'backwards', easing: 'cubic-bezier(.25,.7,.25,1)' }));
    }
    const settle = (): void => { ready = true; };
    Promise.all(entrance.map(animation => animation.finished)).then(settle, settle);
    for (const { line, wave: index, length } of lines) {
      line.style.strokeDasharray = `${length} ${length}`;
      line.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: step, delay: start + (index - 1) * step + 80, fill: 'backwards', easing: 'linear' });
    }
  }

  return { svg, apply: () => undefined, overflow: () => [] };
}
