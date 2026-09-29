/** Text may use explicit line breaks to preserve the presentation layout. */
export type TextLines = string | string[];

export type Tier = 'l0' | 'l1' | 'l2' | 'external' | 'actor';

export type NodeKind =
  | 'resource'
  | 'operator'
  | 'cloud'
  | 'machines'
  | 'app'
  | 'endpoint'
  | 'storage'
  | 'gate'
  | 'user';

export type EdgeKind = 'command' | 'status' | 'link';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NodeVariant {
  at: number;
  title?: TextLines;
  sub?: TextLines;
}

export interface Badge {
  at: number;
  label: string;
}

export interface DiagramNode extends Bounds {
  id: string;
  at: number;
  title: TextLines;
  sub: TextLines;
  kind: NodeKind;
  tier: Tier;
  detail?: string;
  detailKind?: string;
  phase?: string;
  readyAt?: number;
  variants?: NodeVariant[];
  badges?: Badge[];
}

export interface Zone extends Bounds {
  id: string;
  label: string;
  tier: Tier;
  at?: number;
}

export interface Edge {
  from: string;
  to: string;
  at: number;
  path: string;
  kind?: EdgeKind;
  label?: string;
  lx?: number;
  ly?: number;
  emphasis?: boolean;
}

/** The opening diagram only needs an active-node selection. */
export interface SceneBeat {
  active?: string[];
}

export interface Beat extends SceneBeat {
  title: string;
  summary: string;
  result: string;
  note: string;
}

export interface DiagramGraph {
  zones: Zone[];
  nodes: DiagramNode[];
  edges: Edge[];
}

export interface DiagramScene extends DiagramGraph {
  title?: string;
  label?: string;
  nav?: string;
  beats: SceneBeat[];
}

export interface Chapter extends DiagramScene {
  id: string;
  title: string;
  kicker: string;
  question: string;
  duration: string;
  beats: Beat[];
}
