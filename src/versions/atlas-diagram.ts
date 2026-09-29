import type { Badge, DiagramNode, DiagramScene, NodeKind, TextLines } from '../types.ts';
import { layoutScene, type Rect } from './atlas-layout.ts';

export const SANS = '"PT Sans", "Segoe UI", Arial, sans-serif';
export const CAPTION = '"PT Sans Caption", "PT Sans", "Segoe UI", Arial, sans-serif';

/** Forward step: text fades, the new edge is drawn, then the new block and the arrowhead appear. */
export const TIMING = { text: 180, draw: 480, nodeDelay: 200, headDelay: 420, head: 160, scene: 280 };

const NS = 'http://www.w3.org/2000/svg';
export const KINDS: Record<NodeKind, string> = {
  resource: 'ресурс', operator: 'контроллер', cloud: 'облако', machines: 'узлы', app: 'приложение',
  endpoint: 'точка доступа', storage: 'хранилище', gate: 'условие', user: 'участник',
};
// Block rhythm, px. Padding is 16 on every side, as in zones: 16 to the top of the type
// row (mark and label share the band 16–26), 16 to the sides, 16 below the last baseline.
// 16 from the type row to the title's capitals (baseline 54); title lines step 24;
// subtitle 20 below the last title line in steps of 20; badge 20 below.
const PAD = 16;
const KIND_BASELINE = 25;
const TITLE = { size: 18, weight: 700, family: CAPTION, top: 54, step: 24 };
const SUB = { size: 14, step: 20 };
const EDGE_LABEL = { size: 14, family: SANS, style: 'italic' };
/** Shimmer speed along action edges, px per second, and the share of a cycle it travels. */
const FLOW_SPEED = 240;
const FLOW_SHARE = .6;
/** How far before the start and past the end the shimmer's centre travels, px. */
const FLOW_RUNWAY = 40;
/** Stacked dash lengths: the longest sets the width of the soft band. */
const FLOW_LAYERS = [72, 52, 34, 18];
let diagramSerial = 0;

/**
 * The shimmer eases with cubic-bezier(.45, 0, .55, 1). Given how far along its run the
 * shimmer is (0…1), returns the matching share of the run's time, so the arrowhead can
 * light up exactly when the shimmer arrives.
 */
function travelTime(progress: number): number {
  const bezier = (t: number, p1: number, p2: number): number => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 32; index++) {
    const mid = (low + high) / 2;
    if (bezier(mid, 0, 1) < progress) low = mid; else high = mid;
  }
  return bezier((low + high) / 2, .45, .55);
}

type Attrs = Record<string, string | number>;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

function write(attrs: Attrs, value: string, parent: Element): SVGTextElement {
  const node = el('text', attrs, parent);
  node.textContent = value;
  return node;
}

const lines = (value: TextLines | undefined): string[] =>
  value == null ? [] : (Array.isArray(value) ? value : [value]).filter(line => line.trim().length > 0);

// Created on first use, so the module also loads in Node for build checks.
let context: CanvasRenderingContext2D | null | undefined;

/** Line breaks follow real font metrics, so wrapping matches what is drawn. */
export function textWidth(value: string, size: number, weight = 400, family = SANS, style = 'normal'): number {
  if (context === undefined) context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!context) return value.length * size * .55;
  context.font = `${style} ${weight} ${size}px ${family}`;
  return context.measureText(value).width;
}

function wrap(value: string, width: number, measure: (text: string) => number): string[] {
  const result: string[] = [];
  let current = '';
  for (const word of value.trim().split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next) > width) { result.push(current); current = word; }
    else current = next;
  }
  if (current) result.push(current);
  return result;
}

const titleWidth = (text: string): number => textWidth(text, TITLE.size, TITLE.weight, TITLE.family);
const subWidth = (text: string): number => textWidth(text, SUB.size);

/**
 * The shared data breaks titles and subtitles into lines for a narrower layout.
 * Here the parts are rejoined and rewrapped: a continuation (lower case, after a
 * colon or a preposition, or “Operator”) joins with a space, separate items with a middle dot.
 */
export function joinParts(value: TextLines | undefined): string {
  return lines(value).reduce((text, part) => !text ? part
    : /^[a-zа-яё]/.test(part) || /(:|\s(и|в|на|для|с|к|по))$/.test(text) || part === 'Operator' ? `${text} ${part}` : `${text} · ${part}`, '');
}

/** Items share a line when they all fit; otherwise each item starts a new line. */
function itemLines(value: TextLines | undefined, width: number, measure: (text: string) => number): string[] {
  const joined = joinParts(value);
  if (!joined) return [];
  if (measure(joined) <= width) return [joined];
  return joined.split(' · ').flatMap(item => wrap(item, width, measure));
}

const titleLines = (value: TextLines, width: number): string[] => itemLines(value, width, titleWidth);
const subLines = (value: TextLines | undefined, width: number): string[] => itemLines(value, width, subWidth);

function resolved(node: DiagramNode, step: number): { title: TextLines; sub: TextLines; badges: Badge[] } {
  let { title, sub } = node;
  for (const variant of [...node.variants ?? []].sort((a, b) => a.at - b.at)) {
    if (variant.at > step) continue;
    if (variant.title !== undefined) title = variant.title;
    if (variant.sub !== undefined) sub = variant.sub;
  }
  return { title, sub, badges: (node.badges ?? []).filter(badge => badge.at <= step) };
}

function lastBaseline(text: { title: TextLines; sub: TextLines; badges: Badge[] }, inner: number): number {
  let last = TITLE.top + (titleLines(text.title, inner).length - 1) * TITLE.step;
  const sub = subLines(text.sub, inner);
  if (sub.length) last += 20 + (sub.length - 1) * SUB.step;
  if (text.badges.length) last += 20;
  return last;
}

/** Height a block needs for its fullest state across the whole chapter. */
function neededHeight(node: DiagramNode, width: number): number {
  const steps = [0, ...(node.variants ?? []).map(variant => variant.at), ...(node.badges ?? []).map(badge => badge.at), 99];
  return Math.max(...steps.map(step => lastBaseline(resolved(node, step), width - PAD * 2) + PAD));
}

/** Type marks are 10×10 px. */
export function symbol(kind: NodeKind, parent: Element): void {
  const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  switch (kind) {
    case 'resource': el('rect', { x: .75, y: .75, width: 8.5, height: 8.5, ...stroke }, parent); break;
    case 'operator':
      el('circle', { cx: 5, cy: 5, r: 4.25, ...stroke }, parent);
      el('circle', { cx: 5, cy: 5, r: 1.5, fill: 'currentColor' }, parent);
      break;
    case 'app': el('rect', { x: 0, y: 0, width: 10, height: 10, fill: 'currentColor' }, parent); break;
    case 'cloud': el('path', { d: 'M2.6 8.6h5a2.2 2.2 0 0 0 .5-4.35A3 3 0 0 0 2.4 4.9 1.85 1.85 0 0 0 2.6 8.6Z', ...stroke }, parent); break;
    case 'machines':
      el('rect', { x: .75, y: .75, width: 8.5, height: 3.5, ...stroke }, parent);
      el('rect', { x: .75, y: 5.75, width: 8.5, height: 3.5, ...stroke }, parent);
      break;
    case 'endpoint': el('path', { d: 'M.75 .75v8.5M3 5h6.25M6.5 2.25 9.25 5 6.5 7.75', ...stroke }, parent); break;
    case 'storage':
      el('ellipse', { cx: 5, cy: 2.5, rx: 4.25, ry: 1.75, ...stroke }, parent);
      el('path', { d: 'M.75 2.5v5c0 1 1.9 1.75 4.25 1.75s4.25-.75 4.25-1.75v-5', ...stroke }, parent);
      break;
    case 'gate': el('path', { class: 'gate-mark', d: 'M5 .75 9.25 5 5 9.25 .75 5Z', ...stroke }, parent); break;
    case 'user':
      el('circle', { cx: 5, cy: 3, r: 2.25, ...stroke }, parent);
      el('path', { d: 'M1 9.25c.4-2.2 1.9-3.25 4-3.25s3.6 1.05 4 3.25', ...stroke }, parent);
      break;
  }
}

/**
 * Each kind of block keeps the same rectangle but gets its own mark, always inside the
 * block: machines show a small rack of three squares, storage a double base, a cloud a
 * dashed outline, a gate a double frame, a participant rounded corners. Resources,
 * operators, apps and endpoints — most of the map — stay plain, so the marks keep their meaning.
 * Marks are coloured like the frame, so they follow the block's state.
 */
function frameOver(kind: NodeKind, g: SVGGElement, w: number, h: number): void {
  if (kind === 'machines') {
    // Three small squares in the bottom-right corner, one above two, like a rack of servers.
    const size = 8;
    const gap = 3;
    const right = w - PAD;
    const bottom = h - PAD;
    for (const [x, y] of [[right - size, bottom - size * 2 - gap], [right - size * 2 - gap, bottom - size], [right - size, bottom - size]]) {
      el('rect', { class: 'deco', x: x + .75, y: y + .75, width: size - 1.5, height: size - 1.5 }, g);
    }
  } else if (kind === 'storage') {
    // A second line just above the bottom edge: a base.
    el('path', { class: 'deco', d: `M.75 ${h - 5}H${w - .75}` }, g);
  } else if (kind === 'gate') {
    // A double frame: a checkpoint.
    el('rect', { class: 'deco', x: 4.75, y: 4.75, width: w - 9.5, height: h - 9.5 }, g);
  } else if (kind === 'cloud') {
    // A dashed outline over the frame: outside the platform.
    g.classList.add('dashed');
  }
}

/** The arrowhead is a separate filled element, so it can appear after the line is drawn. */
export function arrowhead(path: string): string {
  const list = [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  if (list.length < 2) return '';
  const [x1, y1] = list[list.length - 2];
  const [x2, y2] = list[list.length - 1];
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const dx = (x2 - x1) / length;
  const dy = (y2 - y1) / length;
  // A wide round join rounds the corners; it reaches ~1.25 px past the geometry, so the tip is set back by that much.
  const tx = x2 - dx * 1.25;
  const ty = y2 - dy * 1.25;
  const back = 7.5;
  const half = 3.75;
  return `M${tx} ${ty}L${tx - dx * back - dy * half} ${ty - dy * back + dx * half}L${tx - dx * back + dy * half} ${ty - dy * back - dx * half}Z`;
}

/** Stops a line inside its arrowhead, so the round cap never shows past the tip. */
function trimEnd(path: string, by: number): string {
  const list = [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  if (list.length < 2) return path;
  const [x1, y1] = list[list.length - 2];
  const [x2, y2] = list[list.length - 1];
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  list[list.length - 1] = [x2 - (x2 - x1) / length * Math.min(by, length - 1), y2 - (y2 - y1) / length * Math.min(by, length - 1)];
  return list.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join('');
}

interface NodeView { node: DiagramNode; rect: Rect; g: SVGGElement; content: SVGGElement; key: string }
interface EdgeView {
  edge: DiagramScene['edges'][number]; g: SVGGElement; line: SVGPathElement; head: SVGPathElement | null; glintHead: SVGPathElement | null; caption: SVGGElement | null;
  sweep: SVGAnimateTransformElement | null; text: SVGTextElement | null; moving: boolean;
  length: number; cycle: number; glint: Animation | null;
}

export interface DiagramView {
  svg: SVGSVGElement;
  apply(step: number, direction: -1 | 0 | 1): void;
  /** Blocks whose text does not fit, for layout checks. */
  overflow(): string[];
}

/**
 * Builds a chapter diagram once, 1:1 in slide pixels. Steps only switch state
 * classes, so CSS transitions move between states instead of redrawing.
 */
/**
 * `still` draws a scheme for print: every block at full strength (`focusAll`), no marks
 * for what is new, no shimmer.
 */
export function createDiagram(id: string, scene: DiagramScene, label: string, options: { marksNew?: boolean; focusAll?: boolean; still?: boolean } = {}): DiagramView {
  // The opening scene has no steps, so nothing on it is marked as new.
  const marksNew = options.marksNew ?? true;
  const geometry = layoutScene(id, scene, neededHeight);
  const svg = el('svg', {
    class: 'dg', width: geometry.width, height: geometry.height, role: 'group',
    viewBox: `0 0 ${geometry.width} ${geometry.height}`, 'aria-label': label,
  });

  const zoneLayer = el('g', {}, svg);
  const edgeLayer = el('g', {}, svg);
  // Zone labels sit above edges on an ink plate, so lines never cross the text.
  const zoneLabelLayer = el('g', {}, svg);
  const captionLayer = el('g', {}, svg);
  const nodeLayer = el('g', {}, svg);

  for (const zone of scene.zones) {
    const rect = geometry.zones.get(zone.id)!;
    const tone = `z${zone.tier === 'external' ? ' external' : ''}`;
    const frame = el('g', { class: tone, 'data-at': zone.at ?? 0 }, zoneLayer);
    el('rect', { class: 'z-box', x: rect.x + .5, y: rect.y + .5, width: rect.w - 1, height: rect.h - 1 }, frame);
    const text = zoneLabel(zone.label);
    const caption = el('g', { class: tone, 'data-at': zone.at ?? 0 }, zoneLabelLayer);
    el('rect', { class: 'z-label-bg', x: rect.x + PAD - 4, y: rect.y + 12, width: textWidth(text, 12, 700) + 8, height: 16 }, caption);
    write({ class: 'z-label', x: rect.x + PAD, y: rect.y + 24 }, text, caption);
  }

  const uid = `atlas-${++diagramSerial}`;
  const edges: EdgeView[] = geometry.edges.map(({ edge, path, length, label: anchor }, index) => {
    const kind = edge.kind ?? 'command';
    const g = el('g', { class: `e ${kind}${edge.emphasis ? ' emphasis' : ''}` }, edgeLayer);
    const line = el('path', { class: 'line', d: kind === 'link' ? path : trimEnd(path, 6) }, g);
    // A soft shimmer runs along directed edges: stacked dashes of the line's own width, shorter
    // ones brighter in the middle, so it fades at both ends and never leaves the line.
    // Constant speed, so every edge feels equally fast; the pause keeps it calm.
    // Actions and returned statuses both carry the shimmer; plain links do not.
    const moving = kind !== 'link' && length > 24;
    const cycle = Math.max(1.6, (length + FLOW_RUNWAY * 2) / FLOW_SPEED / FLOW_SHARE);
    if (moving) {
      const flow = el('g', { class: 'flow' }, g);
      flow.style.setProperty('--len', String(Math.round(length)));
      g.style.setProperty('--cycle', `${cycle.toFixed(2)}s`);
      for (const dash of FLOW_LAYERS) {
        const layer = el('path', { class: 'flow-layer', d: path }, flow);
        layer.style.setProperty('--dash', String(dash));
      }
    }
    const head = kind === 'link' ? null : el('path', { class: 'head', d: arrowhead(path) }, g);
    // A copy of the arrowhead in the shimmer's colour; only its opacity animates, so the
    // arrowhead itself always keeps the colour of the edge's state.
    const glintHead = head && length > 24 ? el('path', { class: 'head-glint', d: arrowhead(path) }, g) : null;
    let caption: SVGGElement | null = null;
    let sweep: SVGAnimateTransformElement | null = null;
    let text: SVGTextElement | null = null;
    if (edge.label && anchor) {
      caption = el('g', { class: `e ${kind}` }, captionLayer);
      const w = textWidth(edge.label, EDGE_LABEL.size, 400, EDGE_LABEL.family, EDGE_LABEL.style) + 12;
      el('rect', { class: 'e-caption-bg', x: anchor.x - w / 2, y: anchor.y - 10, width: w, height: 20 }, caption);
      text = write({ class: 'e-caption', x: anchor.x, y: anchor.y + 5, 'text-anchor': 'middle' }, edge.label, caption);
      if (moving) {
        // The same shimmer crosses the label: a soft band moving with the dashes on the line.
        const id = `${uid}-sweep-${index}`;
        const band = FLOW_LAYERS[0] / 2;
        const gradient = el('linearGradient', {
          id, gradientUnits: 'userSpaceOnUse',
          x1: anchor.x - anchor.dx * band, y1: anchor.y - anchor.dy * band, x2: anchor.x + anchor.dx * band, y2: anchor.y + anchor.dy * band,
        }, caption);
        for (const [offset, tone] of [[0, 'base'], [.2, 'base'], [.5, 'shine'], [.8, 'base'], [1, 'base']] as const) {
          el('stop', { class: `sweep-${tone}`, offset }, gradient);
        }
        const from = -FLOW_RUNWAY - anchor.at;
        const to = length + FLOW_RUNWAY - anchor.at;
        sweep = el('animateTransform', {
          attributeName: 'gradientTransform', type: 'translate', begin: 'indefinite', dur: `${cycle.toFixed(2)}s`,
          repeatCount: 'indefinite', calcMode: 'spline', keyTimes: `0;${FLOW_SHARE};1`, keySplines: '.45 0 .55 1;0 0 1 1',
          values: `${anchor.dx * from} ${anchor.dy * from};${anchor.dx * to} ${anchor.dy * to};${anchor.dx * to} ${anchor.dy * to}`,
        }, gradient);
        text.dataset.sweep = id;
      }
    }
    return { edge, g, line, head, glintHead, caption, sweep, text, moving: false, length, cycle, glint: null };
  });

  const nodes: NodeView[] = scene.nodes.map(node => {
    const rect = geometry.nodes.get(node.id)!;
    const g = el('g', { class: 'n', transform: `translate(${rect.x} ${rect.y})`, role: 'img', 'data-node': node.id }, nodeLayer);
    el('rect', { class: 'box', x: .75, y: .75, width: rect.w - 1.5, height: rect.h - 1.5, rx: node.kind === 'user' ? 10 : 0 }, g);
    frameOver(node.kind, g, rect.w, rect.h);
    return { node, rect, g, content: el('g', {}, g), key: '' };
  });

  const overflowing = new Set<string>();

  function layout(view: NodeView, step: number): void {
    const { node, rect, g, content } = view;
    const text = resolved(node, step);
    const key = JSON.stringify(text);
    if (key === view.key) return;
    view.key = key;
    content.replaceChildren();
    const inner = rect.w - PAD * 2;

    const mark = el('g', { class: 'sym', transform: `translate(${PAD} ${PAD})` }, content);
    symbol(node.kind, mark);
    write({ class: 'kind', x: PAD + 18, y: KIND_BASELINE }, node.phase ? `фаза ${node.phase}` : KINDS[node.kind], content);
    // Same 10 px band as the type mark (y 16–26), flush with the right padding.
    el('path', { class: 'check', d: `M${rect.w - PAD - 12} ${PAD + 6.5}l3.5 3.5 8.5-10` }, content);

    const title = titleLines(text.title, inner);
    title.forEach((line, index) => write({ class: 'title', x: PAD, y: TITLE.top + index * TITLE.step }, line, content));
    let last = TITLE.top + (title.length - 1) * TITLE.step;
    const sub = subLines(text.sub, inner);
    sub.forEach((line, index) => write({ class: 'sub', x: PAD, y: last + 20 + index * SUB.step }, line, content));
    if (sub.length) last += 20 + (sub.length - 1) * SUB.step;
    if (text.badges.length) {
      last += 20;
      write({ class: 'badges', x: PAD, y: last }, text.badges.map(badge => badge.label).join(' · '), content);
    }
    const overflow = last + PAD > rect.h + .5 || title.some(line => titleWidth(line) > inner) || sub.some(line => subWidth(line) > inner);
    const summary = [...lines(text.title), ...lines(text.sub), ...text.badges.map(badge => badge.label)].join('. ');
    g.setAttribute('aria-label', `${KINDS[node.kind]}: ${summary}`);
    if (overflow) overflowing.add(node.id); else overflowing.delete(node.id);
  }

  function apply(step: number, direction: -1 | 0 | 1): void {
    const active = new Set(scene.beats[step]?.active ?? []);
    // A step without named participants (the opening) shows everything at full strength.
    const focused = (id: string): boolean => !!options.focusAll || !active.size || active.has(id);
    const animate = direction > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches;

    svg.querySelectorAll<SVGGElement>('.z').forEach(zone => zone.classList.toggle('hidden', Number(zone.dataset.at) > step));

    for (const view of nodes) {
      const { node, g } = view;
      const fresh = marksNew && node.at === step;
      layout(view, step);
      g.style.transitionDelay = animate && fresh ? `${TIMING.nodeDelay}ms` : '0ms';
      g.classList.toggle('hidden', node.at > step);
      g.classList.toggle('on', focused(node.id));
      g.classList.toggle('new', fresh);
      g.classList.toggle('ready', typeof node.readyAt === 'number' && step >= node.readyAt);
      g.setAttribute('aria-hidden', node.at > step ? 'true' : 'false');
    }

    for (const view of edges) {
      const { edge, g, line, head, caption } = view;
      const fresh = marksNew && edge.at === step;
      const hot = focused(edge.from) || focused(edge.to);
      const draw = animate && fresh && (edge.kind ?? 'command') === 'command';
      // Delays are set before classes change, otherwise the transition starts with the old delay.
      if (caption) caption.style.transitionDelay = draw ? `${TIMING.headDelay}ms` : '0ms';
      for (const part of [g, caption]) {
        if (!part) continue;
        part.classList.toggle('hidden', edge.at > step);
        part.classList.toggle('hot', hot);
        part.classList.toggle('new', fresh);
      }
      // The label's sweep starts with the line's shimmer (same 0.6 s delay) and stops with it.
      const shimmer = hot && edge.at <= step && !options.still && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      const flows = !!g.querySelector('.flow');
      if (flows && shimmer !== view.moving) {
        view.moving = shimmer;
        if (view.sweep && view.text) {
          view.text.style.fill = shimmer ? `url(#${view.text.dataset.sweep})` : '';
          if (shimmer) view.sweep.beginElementAt(.6); else view.sweep.endElement();
        }
        // Line, label and arrowhead start together, only when the edge comes into focus,
        // and then share one cycle; restarting on every step would pull them apart.
        if (shimmer) g.querySelectorAll<SVGPathElement>('.flow-layer').forEach(layer => layer.getAnimations().forEach(animation => { animation.currentTime = 0; }));
        // The arrowhead lights up as the shimmer reaches it.
        view.glint?.cancel();
        view.glint = null;
        if (shimmer && view.glintHead) {
          const arrive = FLOW_SHARE * travelTime((view.length - 6 + FLOW_RUNWAY) / (view.length + FLOW_RUNWAY * 2));
          const at = (offset: number): number => Math.min(1, Math.max(0, offset));
          view.glint = view.glintHead.animate([
            { opacity: 0, offset: 0 },
            { opacity: 0, offset: at(arrive - .06) },
            { opacity: 1, offset: at(arrive) },
            { opacity: 0, offset: at(arrive + .12) },
            { opacity: 0, offset: 1 },
          ], { duration: view.cycle * 1000, delay: 600, iterations: Infinity, easing: 'linear' });
        }
      }

      line.style.transition = line.style.strokeDasharray = line.style.strokeDashoffset = '';
      if (head) head.style.transition = head.style.opacity = '';
      if (!draw) continue;
      const length = line.getTotalLength();
      g.style.transition = 'none';
      line.style.strokeDasharray = `${length} ${length}`;
      line.style.strokeDashoffset = String(length);
      if (head) head.style.opacity = '0';
      g.getBoundingClientRect();
      g.style.transition = '';
      line.style.transition = `stroke-dashoffset ${TIMING.draw}ms var(--ease), stroke .24s var(--ease)`;
      line.style.strokeDashoffset = '0';
      if (head) {
        head.style.transition = `opacity ${TIMING.head}ms var(--ease) ${TIMING.headDelay}ms`;
        head.style.opacity = '1';
      }
      line.addEventListener('transitionend', event => {
        if (event.propertyName !== 'stroke-dashoffset') return;
        line.style.strokeDasharray = line.style.strokeDashoffset = line.style.transition = '';
      });
    }
  }

  return { svg, apply, overflow: () => [...overflowing] };
}

/** Zone labels are set in sentence case; level codes and product names keep their spelling. */
export function zoneLabel(value: string): string {
  const levels: Record<string, string> = { L0: 'управляющий кластер', L1: 'инфраструктурный кластер', L2: 'клиентский кластер' };
  const keep: Record<string, string> = { ADDONOPERATOR: 'AddonOperator', VAULT: 'Vault', KUBERNETES: 'Kubernetes' };
  const parts = value.split(' · ');
  if (parts.length === 1 && levels[value]) return `${value} · ${levels[value]}`;
  return parts.map((part, index) => {
    if (/^L[0-2]$/.test(part)) return part;
    const text = part.split(' ').map(word => keep[word] ?? word.toLowerCase()).join(' ');
    return index === 0 && !keep[part.split(' ')[0]] ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }).join(' · ');
}
