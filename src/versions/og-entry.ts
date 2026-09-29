import { chapters } from '../flow.ts';
import type { Tier } from '../types.ts';
import { createStarMap } from './atlas-intro.ts';

/**
 * The link preview: the opening star map as the background, a quiet sky behind it,
 * and the talk's timeline along the bottom, from L0 to L2, with every event a tick.
 */
const NS = 'http://www.w3.org/2000/svg';
const LEVELS: Tier[] = ['l0', 'l1', 'l2'];
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.append(node);
  return node;
};
const find = (selector: string): Element => {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
};

// Sky: part of an atlas plate's graticule and a scatter of faint stars.
const sky = find('#sky');
for (const radius of [980, 1160, 1340]) el('circle', { class: 'arc', cx: 1020, cy: 1500, r: radius }, sky);
for (let angle = 200; angle <= 340; angle += 12) {
  const t = angle * Math.PI / 180;
  el('path', { class: 'arc', d: `M${1020 + Math.cos(t) * 800} ${1500 + Math.sin(t) * 800}L${1020 + Math.cos(t) * 1600} ${1500 + Math.sin(t) * 1600}` }, sky);
}
let seed = 20260929;
const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (let index = 0; index < 150; index++) {
  const magnitude = random();
  el('circle', { class: 'dot', cx: (random() * 1200).toFixed(1), cy: (random() * 630).toFixed(1),
    r: magnitude > .95 ? 1.4 : magnitude > .8 ? .9 : .6, 'fill-opacity': magnitude > .95 ? .6 : magnitude > .8 ? .35 : .2 }, sky);
}

// The constellation: every component of the platform, fully lit.
const map = createStarMap(chapters, { entrance: false });
find('#map').append(map.svg);
map.apply(0, 0);
// Star names under the text would only compete with it.
for (const star of map.svg.querySelectorAll('.s-star')) {
  const x = Number(star.getAttribute('transform')?.match(/translate\((-?[\d.]+)/)?.[1] ?? 0);
  if (x < 520) star.querySelector('.s-name')?.remove();
}

// Timeline: chapters in proportion to their events, stage marks where a level first appears.
const track = find('#track');
const total = chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0);
const width = 1072 - 160;
const base = 24.5;
el('path', { class: 'line', d: `M0 ${base}H${width}` }, track);
let at = 0;
const starts = new Map(LEVELS.map(level => [chapters.findIndex(chapter => chapter.zones.some(zone => zone.tier === level)), level]));
chapters.forEach((chapter, index) => {
  const x = Math.round(at / total * width) + .5;
  const level = starts.get(index);
  if (level) {
    el('path', { class: 'stage', d: `M${x} ${base - 18}V${base + 8}` }, track);
    el('text', { class: 'stage-label', x: x + 6, y: base - 8 }, track).textContent = level.toUpperCase();
  } else el('path', { class: 'bound', d: `M${x} ${base - 6}V${base + 6}` }, track);
  chapter.beats.forEach((_, beat) => {
    const tick = Math.round((at + beat + .5) / total * width) + .5;
    el('path', { class: 'tick', d: `M${tick} ${base - 3}V${base + 3}` }, track);
  });
  at += chapter.beats.length;
});
el('path', { class: 'end', d: `M${width - 1} ${base - 8}V${base + 8}` }, track);
el('text', { class: 'count', x: 1072, y: base + 5, 'text-anchor': 'end' }, track).textContent = `${chapters.length} глав · ${total} событий`;
