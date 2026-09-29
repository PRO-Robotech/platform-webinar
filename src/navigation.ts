import type { DiagramScene } from './types.ts';

/** Short chapter labels for navigation, shared by every presentation skin. */
export const chapterNames = ['Заказ и зависимости', 'Создание L1', 'L1 и Vault', 'Заказ L2', 'Устройство L2', 'Готовый L2', 'Приложения'];

/** The opening scene shown before the first chapter. */
export const intro: DiagramScene = {
  title: 'Три уровня одной платформы',
  zones: [
    { id: 'intro-l0', x: 20, y: 55, w: 355, h: 310, label: 'L0', tier: 'l0' },
    { id: 'intro-l1', x: 424, y: 55, w: 355, h: 310, label: 'L1', tier: 'l1' },
    { id: 'intro-l2', x: 827, y: 55, w: 353, h: 310, label: 'L2', tier: 'l2' },
  ],
  nodes: [
    { id: 'intro-management', at: 0, x: 54, y: 132, w: 287, h: 159, title: 'Принимает заказ', sub: ['Операторы и Cluster API', 'управляют созданием'], kind: 'operator', tier: 'l0' },
    { id: 'intro-infra', at: 0, x: 457, y: 132, w: 287, h: 159, title: 'Строит инфраструктуру', sub: ['Узлы L1 и', 'Control plane L2'], kind: 'machines', tier: 'l1' },
    { id: 'intro-client', at: 0, x: 860, y: 132, w: 287, h: 159, title: 'Предоставляет L2', sub: ['API L2 и', 'пользовательские приложения'], kind: 'endpoint', tier: 'l2' },
  ],
  edges: [
    { from: 'intro-management', to: 'intro-infra', at: 0, path: 'M341 212H457', label: 'создаёт', lx: 398, ly: 191, kind: 'command' },
    { from: 'intro-infra', to: 'intro-client', at: 0, path: 'M744 212H860', label: 'обслуживает', lx: 803, ly: 191, kind: 'link' },
  ],
  beats: [{ active: [] }],
};
