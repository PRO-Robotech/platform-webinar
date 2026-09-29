import type { Chapter, DiagramNode, TextLines, Tier } from '../types';

export interface FlightScene {
  id: string;
  chapter: number;
  step: number;
  title: string;
  eyebrow: string;
  summary: string;
  facts: { label: string; body: string }[];
  takeaway: string;
  note: string;
  layer: string;
  minute: string;
}

const text = (value: TextLines): string => Array.isArray(value) ? value.join(' ') : value;
const tiers: Record<Tier, string> = {
  l0: 'L0', l1: 'L1', l2: 'L2', external: 'Внешний сервис', actor: 'Заказчик',
};

function nodeAt(node: DiagramNode, step: number): DiagramNode {
  return node.variants?.filter(variant => variant.at <= step)
    .reduce<DiagramNode>((current, variant) => ({ ...current, ...variant }), node) ?? node;
}

/** The flight map uses the same event text and directed graph as the final story.
 * Chapters become navigation stations; individual events retain their reveal steps.
 */
export function createFlightContent(chapters: Chapter[]) {
  const scenes: FlightScene[] = chapters.flatMap((chapter, chapterIndex) =>
    chapter.beats.map((beat, step) => {
      const active = new Set(beat.active ?? []);
      const nodes = chapter.nodes.filter(node => node.at <= step && active.has(node.id));
      return {
        id: `${chapter.id}-${step + 1}`,
        chapter: chapterIndex,
        step,
        title: beat.title,
        eyebrow: `${chapterIndex + 1}.${step + 1} · ${chapter.kicker}`,
        summary: beat.summary,
        facts: nodes.map(original => {
          const node = nodeAt(original, step);
          return {
            label: `${tiers[node.tier]} · ${text(node.title)}`,
            body: node.detail || text(node.sub),
          };
        }),
        takeaway: beat.result,
        note: beat.note,
        layer: [...new Set(nodes.map(node => tiers[node.tier]))].join(' · '),
        minute: chapter.duration,
      };
    }));
  let start = 0;
  const stations = chapters.map((chapter, index) => {
    const station = {
      title: chapter.title,
      name: chapter.nav || chapter.title,
      start,
      count: chapter.beats.length,
      index,
    };
    start += station.count;
    return station;
  });
  return { scenes, stations, chapters };
}
