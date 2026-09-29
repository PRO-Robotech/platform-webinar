import type { DiagramNode, DiagramScene, Edge } from '../types.ts';

/**
 * Atlas skin positions. The shared flow keeps content, topology and reveal order;
 * this file only decides where things stand on the atlas grid.
 *
 * Each scene gets an even grid of `columns` across the 1200 px diagram, with one
 * gutter everywhere (56 px). A zone wraps its columns with 16 px of padding, so
 * the gap between blocks is the same inside a zone and across zones. Blocks in one
 * row share a height, so every row lines up through all zones.
 */
export const WIDTH = 1200;
const PAD = 16;
const GUTTER = 56;
const HEADER = 40;
const ZONE_BOTTOM = 16;
const ZONE_GAP = 24;
const ROW_GAP = 40;
/** The detour above a row: far enough that both legs keep a visible stem after the 6 px gaps. */
const ABOVE = 20;
const BELOW = ZONE_BOTTOM + 16;
const EDGE_GAP = 6;

type Span = [number, number];
type Route = 'h' | 'v' | 'hv' | 'vh' | 'vhv' | 'hvh';

export interface EdgePlacement {
  route?: Route;
  /** Anchor along the source/target side, 0…1. A vertical edge uses `fromAt` for both ends. */
  fromAt?: number;
  toAt?: number;
  channel?: 'above' | 'below' | 'between';
}

export interface ScenePlacement {
  columns: number;
  rows: number;
  zones: Record<string, { cols: Span; rows: Span }>;
  nodes: Record<string, { cols: Span | number; row: number }>;
  /** Keyed by `from>to:kind`. */
  edges?: Record<string, EdgePlacement>;
}

export interface Rect { x: number; y: number; w: number; h: number }
/** A label sits on the longest segment: its centre, that segment's direction, and its distance along the path. */
export interface EdgeLabel { x: number; y: number; dx: number; dy: number; at: number }
export interface PlacedEdge { edge: Edge; path: string; length: number; label: EdgeLabel | null }
export interface SceneGeometry {
  width: number;
  height: number;
  rowHeights: number[];
  zones: Map<string, Rect>;
  nodes: Map<string, Rect>;
  edges: PlacedEdge[];
}

export const edgeKey = (edge: Edge): string => `${edge.from}>${edge.to}:${edge.kind ?? 'command'}`;

export const placements: Record<string, ScenePlacement> = {
  intro: {
    columns: 8, rows: 1,
    zones: { 'intro-l0': { cols: [1, 2], rows: [1, 1] }, 'intro-l1': { cols: [4, 5], rows: [1, 1] }, 'intro-l2': { cols: [7, 8], rows: [1, 1] } },
    nodes: { 'intro-management': { cols: [1, 2], row: 1 }, 'intro-infra': { cols: [4, 5], row: 1 }, 'intro-client': { cols: [7, 8], row: 1 } },
  },
  prepare: {
    columns: 12, rows: 2,
    zones: { l0: { cols: [3, 8], rows: [1, 2] }, ext: { cols: [10, 12], rows: [1, 2] } },
    nodes: {
      customer: { cols: [1, 2], row: 1 }, claim: { cols: [3, 5], row: 1 }, operator: { cols: [6, 8], row: 1 },
      certificates: { cols: [6, 8], row: 2 }, bucket: { cols: [10, 12], row: 1 }, vault: { cols: [10, 12], row: 2 },
    },
  },
  infra: {
    columns: 12, rows: 3,
    zones: { l0: { cols: [1, 9], rows: [1, 2] }, ext: { cols: [11, 12], rows: [2, 2] }, l1: { cols: [1, 12], rows: [3, 3] } },
    nodes: {
      'infra-claim': { cols: [1, 3], row: 1 }, 'infra-operator': { cols: [4, 6], row: 1 }, 'infra-resource': { cols: [7, 9], row: 1 },
      services: { cols: [4, 6], row: 2 }, capi: { cols: [7, 9], row: 2 }, cloud: { cols: [11, 12], row: 2 },
      delivery: { cols: [1, 3], row: 3 }, network: { cols: [4, 6], row: 3 }, machines: { cols: [10, 12], row: 3 },
    },
    edges: {
      'capi>infra-resource:command': { route: 'v', fromAt: .35 },
      'capi>infra-resource:status': { route: 'v', fromAt: .65 },
      'infra-resource>infra-claim:status': { route: 'vhv', channel: 'above', toAt: .75 },
      'machines>capi:status': { route: 'vhv', channel: 'between', fromAt: .15, toAt: .75 },
    },
  },
  parallel: {
    columns: 5, rows: 2,
    zones: { 'parallel-l1': { cols: [1, 4], rows: [1, 1] }, 'parallel-vault': { cols: [1, 4], rows: [2, 2] }, 'parallel-l0': { cols: [5, 5], rows: [1, 2] } },
    nodes: {
      'parallel-addonoperator': { cols: 1, row: 1 }, 'parallel-phases': { cols: 2, row: 1 },
      'parallel-observability': { cols: 3, row: 1 }, 'parallel-firewall': { cols: 4, row: 1 },
      'parallel-vault': { cols: 1, row: 2 }, 'parallel-access': { cols: 2, row: 2 },
      'parallel-secrets': { cols: 3, row: 2 }, 'parallel-kms': { cols: 4, row: 2 },
      'parallel-join': { cols: 5, row: 1 }, 'parallel-claimoperator': { cols: 5, row: 2 },
    },
    edges: {
      'parallel-kms>parallel-join:status': { route: 'vhv', channel: 'between', toAt: .3 },
      'parallel-claimoperator>parallel-vault:command': { route: 'vhv', channel: 'below' },
    },
  },
  client: {
    columns: 4, rows: 3,
    zones: { l0: { cols: [1, 3], rows: [1, 3] }, l1: { cols: [4, 4], rows: [1, 3] } },
    nodes: {
      'client-claim': { cols: 1, row: 1 }, 'client-operator': { cols: 2, row: 1 }, 'client-services': { cols: 3, row: 1 },
      'client-resource': { cols: 1, row: 3 }, 'client-capi': { cols: 2, row: 3 }, addonclaim: { cols: 3, row: 3 },
      'addon-cp': { cols: 4, row: 1 }, 'cp-applications': { cols: 4, row: 2 }, 'client-app': { cols: 4, row: 3 },
    },
    edges: {
      'client-operator>client-resource:command': { route: 'vhv', channel: 'between' },
      'addonclaim>addon-cp:command': { route: 'hvh' },
    },
  },
  controlplane: {
    columns: 4, rows: 3,
    zones: { 'hosted-l0': { cols: [1, 1], rows: [1, 3] }, 'hosted-l1': { cols: [2, 3], rows: [1, 3] }, 'hosted-l2': { cols: [4, 4], rows: [1, 3] } },
    nodes: {
      'hosted-addonclaim': { cols: 1, row: 1 }, 'hosted-client-resource': { cols: 1, row: 2 }, 'hosted-clusterclaim': { cols: 1, row: 3 },
      'hosted-addoncp': { cols: 2, row: 1 }, 'hosted-applications': { cols: 3, row: 1 }, 'hosted-clientcp': { cols: [2, 3], row: 2 },
      'hosted-infra-nodes': { cols: 2, row: 3 }, 'hosted-etcd': { cols: 3, row: 3 }, 'hosted-api-l2': { cols: 4, row: 2 },
    },
    edges: {
      'hosted-clientcp>hosted-etcd:link': { route: 'v', fromAt: .75 },
      'hosted-clientcp>hosted-applications:status': { route: 'v', fromAt: .75 },
    },
  },
  delivery: {
    columns: 9, rows: 2,
    zones: { l0: { cols: [1, 2], rows: [1, 2] }, l1: { cols: [3, 6], rows: [1, 1] }, l2: { cols: [8, 9], rows: [1, 1] } },
    nodes: {
      'defaults-claim': { cols: [1, 2], row: 1 }, 'defaults-operator': { cols: [1, 2], row: 2 },
      'defaults-addon': { cols: [3, 4], row: 1 }, 'defaults-applications': { cols: [5, 6], row: 1 },
      'default-addons': { cols: [8, 9], row: 1 }, 'hand-off': { cols: [8, 9], row: 2 },
    },
  },
  'user-apps': {
    columns: 5, rows: 1,
    zones: { 'user-l0': { cols: [2, 2], rows: [1, 1] }, 'user-l1': { cols: [3, 4], rows: [1, 1] }, 'user-l2': { cols: [5, 5], rows: [1, 1] } },
    nodes: {
      'user-order': { cols: 1, row: 1 }, 'user-addonclaim': { cols: 2, row: 1 }, 'user-addon': { cols: 3, row: 1 },
      'user-applications': { cols: 4, row: 1 }, 'user-workload': { cols: 5, row: 1 },
    },
  },
};

/** Structural check used by the build: every zone, block and override must be placed. */
export function validatePlacement(id: string, scene: DiagramScene): string[] {
  const spec = placements[id];
  if (!spec) return [`${id}: нет раскладки для «Атласа»`];
  const problems: string[] = [];
  const within = (span: Span, max: number): boolean => span[0] >= 1 && span[1] <= max && span[0] <= span[1];
  for (const zone of scene.zones) {
    const place = spec.zones[zone.id];
    if (!place) problems.push(`${id}: зона ${zone.id} не размещена`);
    else if (!within(place.cols, spec.columns) || !within(place.rows, spec.rows)) problems.push(`${id}: зона ${zone.id} вне сетки`);
  }
  for (const node of scene.nodes) {
    const place = spec.nodes[node.id];
    if (!place) { problems.push(`${id}: блок ${node.id} не размещён`); continue; }
    const cols: Span = typeof place.cols === 'number' ? [place.cols, place.cols] : place.cols;
    if (!within(cols, spec.columns) || place.row < 1 || place.row > spec.rows) problems.push(`${id}: блок ${node.id} вне сетки`);
  }
  const keys = new Set(scene.edges.map(edgeKey));
  for (const key of Object.keys(spec.edges ?? {})) if (!keys.has(key)) problems.push(`${id}: связь ${key} не существует`);
  const cells = new Map<string, string>();
  for (const [node, place] of Object.entries(spec.nodes)) {
    const [a, b] = typeof place.cols === 'number' ? [place.cols, place.cols] : place.cols;
    for (let col = a; col <= b; col++) {
      const cell = `${place.row}:${col}`;
      if (cells.has(cell)) problems.push(`${id}: блоки ${cells.get(cell)} и ${node} занимают одну клетку`);
      cells.set(cell, node);
    }
  }
  return problems;
}

/** Computes block, zone and edge geometry for a scene, given the block height it needs. */
export function layoutScene(id: string, scene: DiagramScene, nodeHeight: (node: DiagramNode, width: number) => number): SceneGeometry {
  const spec = placements[id];
  if (!spec) throw new Error(`${id}: нет раскладки для «Атласа»`);
  const columnWidth = (WIDTH - PAD * 2 - GUTTER * (spec.columns - 1)) / spec.columns;
  const colX = (col: number): number => PAD + (col - 1) * (columnWidth + GUTTER);
  const span = (cols: Span | number): Span => typeof cols === 'number' ? [cols, cols] : cols;
  const horizontal = (cols: Span | number): [number, number] => {
    const [a, b] = span(cols);
    return [Math.round(colX(a)), Math.round(colX(b) + columnWidth)];
  };

  const widths = new Map(scene.nodes.map(node => {
    const [left, right] = horizontal(spec.nodes[node.id].cols);
    return [node.id, right - left];
  }));
  // The fullest block of a row sets its height, so it gets exactly the block padding below its last line.
  const rowHeight: number[] = [];
  for (let row = 1; row <= spec.rows; row++) {
    const inRow = scene.nodes.filter(node => spec.nodes[node.id].row === row);
    rowHeight[row] = Math.max(0, ...inRow.map(node => Math.ceil(nodeHeight(node, widths.get(node.id) ?? 0))));
  }

  // Rows: a zone boundary between two rows gets zone padding, zone gap and the next header.
  const zoneSpecs = Object.values(spec.zones);
  const stacked = (row: number): boolean =>
    zoneSpecs.some(zone => zone.rows[1] === row) && zoneSpecs.some(zone => zone.rows[0] === row + 1);
  const rowTop: number[] = [];
  let y = HEADER;
  for (let row = 1; row <= spec.rows; row++) {
    rowTop[row] = y;
    y += rowHeight[row] + (stacked(row) ? ZONE_BOTTOM + ZONE_GAP + HEADER : ROW_GAP);
  }
  const gapMid = (row: number): number => stacked(row)
    ? rowTop[row] + rowHeight[row] + ZONE_BOTTOM + ZONE_GAP / 2
    : rowTop[row] + rowHeight[row] + ROW_GAP / 2;

  const nodes = new Map<string, Rect>();
  for (const node of scene.nodes) {
    const place = spec.nodes[node.id];
    const [left, right] = horizontal(place.cols);
    nodes.set(node.id, { x: left, y: rowTop[place.row], w: right - left, h: rowHeight[place.row] });
  }
  const zones = new Map<string, Rect>();
  for (const zone of scene.zones) {
    const place = spec.zones[zone.id];
    const [left, right] = horizontal(place.cols);
    const top = rowTop[place.rows[0]] - HEADER;
    const bottom = rowTop[place.rows[1]] + rowHeight[place.rows[1]] + ZONE_BOTTOM;
    zones.set(zone.id, { x: left - PAD, y: top, w: right - left + PAD * 2, h: bottom - top });
  }

  let bottom = Math.max(...[...zones.values(), ...nodes.values()].map(rect => rect.y + rect.h));
  const rowOf = (id: string): number => spec.nodes[id].row;

  const edges: PlacedEdge[] = scene.edges.map(edge => {
    const a = nodes.get(edge.from)!;
    const b = nodes.get(edge.to)!;
    const place = spec.edges?.[edgeKey(edge)] ?? {};
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const route: Route = place.route ?? (overlapX >= 24 ? 'v' : overlapY >= 24 ? 'h' : 'hv');
    const along = (rect: Rect, at: number | undefined, fallback: number): number => at === undefined ? fallback : rect.x + rect.w * at;
    const points: [number, number][] = [];

    if (route === 'h') {
      const yMid = Math.round(Math.max(a.y, b.y) + overlapY / 2);
      const right = b.x > a.x;
      points.push([right ? a.x + a.w : a.x, yMid], [right ? b.x : b.x + b.w, yMid]);
    } else if (route === 'v') {
      // One x for both ends, kept inside the shared span of the two blocks.
      const center = Math.max(a.x, b.x) + overlapX / 2;
      const left = Math.max(a.x, b.x) + 12;
      const right = Math.min(a.x + a.w, b.x + b.w) - 12;
      const x = Math.round(Math.min(right, Math.max(left, along(a, place.fromAt, center))));
      const down = b.y > a.y;
      points.push([x, down ? a.y + a.h : a.y], [x, down ? b.y : b.y + b.h]);
    } else if (route === 'vhv') {
      const x1 = Math.round(along(a, place.fromAt, a.x + a.w / 2));
      const x2 = Math.round(along(b, place.toAt, b.x + b.w / 2));
      const upper = Math.min(rowOf(edge.from), rowOf(edge.to));
      let channel: number;
      if (place.channel === 'above') channel = Math.min(a.y, b.y) - ABOVE;
      else if (place.channel === 'below') channel = Math.max(a.y + a.h, b.y + b.h) + BELOW;
      // Two rows apart runs through the middle of the empty row; neighbours use the gap between them.
      else if (Math.abs(rowOf(edge.from) - rowOf(edge.to)) === 2) channel = rowTop[upper + 1] + rowHeight[upper + 1] / 2;
      else channel = gapMid(upper);
      channel = Math.round(channel);
      const startY = channel < a.y ? a.y : a.y + a.h;
      const endY = channel < b.y ? b.y : b.y + b.h;
      points.push([x1, startY], [x1, channel], [x2, channel], [x2, endY]);
      if (place.channel === 'below') bottom = Math.max(bottom, channel + 12);
    } else if (route === 'hvh') {
      const right = b.x > a.x;
      const startX = right ? a.x + a.w : a.x;
      const endX = right ? b.x : b.x + b.w;
      const channel = Math.round((startX + endX) / 2);
      const y1 = Math.round(a.y + a.h / 2);
      const y2 = Math.round(b.y + b.h / 2);
      points.push([startX, y1], [channel, y1], [channel, y2], [endX, y2]);
    } else if (route === 'hv') {
      const right = b.x > a.x;
      const x2 = Math.round(along(b, place.toAt, b.x + b.w / 2));
      const y1 = Math.round(a.y + a.h / 2);
      points.push([right ? a.x + a.w : a.x, y1], [x2, y1], [x2, b.y > a.y ? b.y : b.y + b.h]);
    } else {
      const x1 = Math.round(along(a, place.fromAt, a.x + a.w / 2));
      const y2 = Math.round(b.y + b.h / 2);
      const down = b.y > a.y;
      points.push([x1, down ? a.y + a.h : a.y], [x1, y2], [b.x > x1 ? b.x : b.x + b.w, y2]);
    }

    // Lines stand 6 px off the blocks at both ends.
    const inset = (from: [number, number], to: [number, number]): [number, number] => {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      return [from[0] + (to[0] - from[0]) / length * EDGE_GAP, from[1] + (to[1] - from[1]) / length * EDGE_GAP];
    };
    points[0] = inset(points[0], points[1]);
    points[points.length - 1] = inset(points[points.length - 1], points[points.length - 2]);
    const path = points.map(([px, py], index) => `${index ? 'L' : 'M'}${px} ${py}`).join('');
    let label: EdgeLabel | null = null;
    let travelled = 0;
    let longest = 0;
    for (let index = 1; index < points.length; index++) {
      const [x1, y1] = points[index - 1];
      const [x2, y2] = points[index];
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (edge.label && length > longest) {
        longest = length;
        label = { x: (x1 + x2) / 2, y: (y1 + y2) / 2, dx: (x2 - x1) / (length || 1), dy: (y2 - y1) / (length || 1), at: travelled + length / 2 };
      }
      travelled += length;
    }
    return { edge, path, length: travelled, label };
  });

  return { width: WIDTH, height: Math.ceil(bottom), rowHeights: rowHeight.slice(1), zones, nodes, edges };
}
