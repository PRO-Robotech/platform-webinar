(function () {
  'use strict';

  var chapters = window.NarrativeContent.chapters;

  // Chapter 3 keeps both branches in place throughout the explanation.
  // Moving attention between beats does not complete either branch. The only
  // readiness transition is the explicitly explained join on the final beat.
  Object.assign(chapters[2], {
    zones: [
      { id: 'parallel-l1', x: 16, y: 16, w: 928, h: 184, label: 'L1 · ФАЗЫ ADDONOPERATOR', tier: 'l1', at: 0 },
      { id: 'parallel-vault', x: 16, y: 216, w: 928, h: 176, label: 'VAULT · НАСТРОЙКИ КЛАСТЕРА', tier: 'external', at: 0 },
      { id: 'parallel-l0', x: 968, y: 16, w: 216, h: 392, label: 'L0', tier: 'l0', at: 0 }
    ],
    nodes: [
      {
        id: 'parallel-claimoperator', x: 984, y: 264, w: 184, h: 136,
        title: ['ClusterClaim', 'Operator'], sub: ['Настраивает Vault', 'для кластера'],
        kind: 'operator', tier: 'l0', at: 0
      },
      {
        id: 'parallel-addonoperator', x: 40, y: 72, w: 208, h: 112,
        title: 'Аддоны', sub: ['Установка через', 'Argo CD Applications'],
        detail: 'Первая фаза: установка аддонов L1 через Argo CD Applications.',
        kind: 'app', tier: 'l1', phase: '01', at: 0, readyAt: 7
      },
      {
        id: 'parallel-phases', x: 272, y: 72, w: 192, h: 112,
        title: 'Защита', sub: ['mTLS', 'Сетевые политики'],
        kind: 'app', tier: 'l1', phase: '02', at: 1, readyAt: 7
      },
      {
        id: 'parallel-observability', x: 488, y: 72, w: 224, h: 112,
        title: 'Наблюдаемость', sub: ['Мониторинг', 'Сбор логов'],
        kind: 'app', tier: 'l1', phase: '03', at: 3, readyAt: 7
      },
      {
        id: 'parallel-firewall', x: 736, y: 72, w: 184, h: 112,
        title: 'Изоляция', sub: ['Host firewall', 'Default deny'],
        kind: 'app', tier: 'l1', phase: '04', at: 6, readyAt: 7
      },
      {
        id: 'parallel-vault', x: 40, y: 256, w: 208, h: 128,
        title: 'Vault', sub: ['Настройки кластера', 'Auth, секреты, KMS'],
        kind: 'storage', tier: 'external', at: 0, readyAt: 7,
        variants: [{ at: 7, sub: ['Настройки кластера', 'подготовлены'] }]
      },
      {
        id: 'parallel-access', x: 272, y: 256, w: 192, h: 128,
        title: 'Auth и роли', sub: ['ServiceAccount L1', 'Точечные роли'],
        detail: 'ServiceAccount auth: ServiceAccount из L1 сопоставляются с точечными ролями доступа в Vault.',
        kind: 'resource', tier: 'external', at: 2, readyAt: 7
      },
      {
        id: 'parallel-secrets', x: 488, y: 256, w: 224, h: 128,
        title: 'Секреты', sub: ['Индивидуальные', 'для компонентов'],
        kind: 'resource', tier: 'external', at: 4, readyAt: 7,
        badges: [{ at: 4, label: 'Высокая энтропия' }]
      },
      {
        id: 'parallel-kms', x: 736, y: 256, w: 184, h: 128,
        title: 'KMS Transit', sub: ['Ключ и доступы L2'],
        detail: 'KMS Transit: ключ и доступы L2 для Control plane L2.',
        kind: 'storage', tier: 'external', at: 5, readyAt: 7
      },
      {
        id: 'parallel-join', x: 984, y: 72, w: 184, h: 112,
        title: ['Условия', 'для L2'], sub: 'L1 + Vault готовы',
        kind: 'gate', tier: 'l0', at: 7, readyAt: 7
      }
    ],
    edges: [
      { from: 'parallel-claimoperator', to: 'parallel-vault', at: 0, path: 'M1076 399V412H144V383', kind: 'command', label: 'настройка кластера', lx: 624, ly: 404 },
      { from: 'parallel-addonoperator', to: 'parallel-phases', at: 1, path: 'M247 128H273', kind: 'command' },
      { from: 'parallel-phases', to: 'parallel-observability', at: 3, path: 'M463 128H489', kind: 'command' },
      { from: 'parallel-observability', to: 'parallel-firewall', at: 6, path: 'M711 128H737', kind: 'command' },
      { from: 'parallel-vault', to: 'parallel-access', at: 2, path: 'M247 320H273', kind: 'command' },
      { from: 'parallel-access', to: 'parallel-secrets', at: 4, path: 'M463 320H489', kind: 'command' },
      { from: 'parallel-secrets', to: 'parallel-kms', at: 5, path: 'M711 320H737', kind: 'command' },
      { from: 'parallel-firewall', to: 'parallel-join', at: 7, path: 'M919 128H985', kind: 'status' },
      { from: 'parallel-kms', to: 'parallel-join', at: 7, path: 'M919 320H952V216H1076V183', kind: 'status' }
    ]
  });

  [
    ['parallel-addonoperator', 'parallel-claimoperator', 'parallel-vault'],
    ['parallel-addonoperator', 'parallel-phases'],
    ['parallel-claimoperator', 'parallel-access'],
    ['parallel-observability'],
    ['parallel-claimoperator', 'parallel-secrets'],
    ['parallel-claimoperator', 'parallel-kms'],
    ['parallel-firewall'],
    ['parallel-firewall', 'parallel-kms', 'parallel-join']
  ].forEach(function (active, i) { chapters[2].beats[i].active = active; });

  // Chapter 5 keeps early resources fixed while revealing the complete
  // return path through Applications, Addon and AddonClaim to management.
  Object.assign(chapters[4], {
    zones: [
      { id: 'hosted-l0', x: 16, y: 16, w: 432, h: 392, label: 'L0', tier: 'l0', at: 0 },
      { id: 'hosted-l1', x: 464, y: 16, w: 480, h: 392, label: 'L1', tier: 'l1', at: 0 },
      { id: 'hosted-l2', x: 960, y: 16, w: 224, h: 392, label: 'L2 · ТОЧКА ДОСТУПА', tier: 'l2', at: 0 }
    ],
    nodes: [
      {
        id: 'hosted-infra-nodes', x: 480, y: 304, w: 208, h: 96,
        title: 'Узлы L1', sub: 'Исполняют CP L2',
        detail: 'Узлы инфраструктурного кластера L1 исполняют компоненты Control plane L2 как DaemonSet.',
        kind: 'machines', tier: 'l1', at: 0
      },
      {
        id: 'hosted-clientcp', x: 480, y: 184, w: 448, h: 88,
        title: 'Control plane L2', sub: 'DaemonSet на узлах L1',
        detailKind: 'Приложение · DaemonSet',
        detail: 'Компоненты control plane L2 исполняются как DaemonSet на узлах L1. Они обслуживают Kubernetes API L2 и используют etcd L1 с отдельным префиксом данных. Статус инициализации возвращается через Applications, Addon (CP) и AddonClaim в Cluster L2 и ClusterClaim.',
        kind: 'app', tier: 'l1', at: 0,
        variants: [{ at: 3, sub: 'DaemonSet на узлах L1 · инициализирован' }]
      },
      {
        id: 'hosted-etcd', x: 720, y: 304, w: 208, h: 96,
        title: 'Общий etcd L1', sub: 'отдельный префикс L2',
        detail: 'Существующее общее хранилище etcd в L1. Данные Control plane L2 используют отдельный префикс L2.',
        kind: 'storage', tier: 'l1', at: 1
      },
      {
        id: 'hosted-api-l2', x: 976, y: 184, w: 192, h: 112,
        title: 'API L2', sub: ['Точка доступа', 'Обслуживает L1'],
        detail: 'Точка доступа к Kubernetes API клиентского кластера L2. Запросы обслуживает control plane, работающий в L1. Карточка обозначает интерфейс доступа, а не отдельное приложение или дополнительные машины в L2.',
        kind: 'endpoint', tier: 'l2', at: 2
      },
      {
        id: 'hosted-applications', x: 720, y: 64, w: 208, h: 88,
        title: 'Applications', sub: 'Статус приложения',
        detail: 'Applications в L1 отражают состояние приложения Control plane L2 и передают его в Addon (CP).',
        kind: 'resource', tier: 'l1', at: 3
      },
      {
        id: 'hosted-addoncp', x: 480, y: 64, w: 208, h: 88,
        title: 'Addon (CP)', sub: 'Статус Applications',
        detail: 'Addon (CP) в L1 получает состояние Applications и передаёт статус в AddonClaim в L0.',
        kind: 'resource', tier: 'l1', at: 3
      },
      {
        id: 'hosted-addonclaim', x: 128, y: 64, w: 208, h: 88,
        title: 'AddonClaim', sub: 'Статус Addon',
        detail: 'AddonClaim в L0 отражает состояние Addon (CP) из L1. Через него статус Control plane L2 отражается в Cluster L2, а затем в исходном ClusterClaim.',
        kind: 'resource', tier: 'l0', at: 3
      },
      {
        id: 'hosted-client-resource', x: 128, y: 184, w: 208, h: 88,
        title: 'Cluster L2', sub: 'Инициализирован',
        kind: 'resource', tier: 'l0', at: 3
      },
      {
        id: 'hosted-clusterclaim', x: 128, y: 304, w: 208, h: 96,
        title: 'ClusterClaim', sub: 'Статус L2 получен',
        detail: 'ClusterClaim отражает состояние Cluster L2: control plane инициализирован. ClusterClaim Operator продолжает процесс установки базовых аддонов, после чего L2 можно передать пользователю.',
        kind: 'resource', tier: 'l0', at: 3
      }
    ],
    edges: [
      { from: 'hosted-infra-nodes', to: 'hosted-clientcp', at: 0, path: 'M580 311V271', kind: 'link' },
      { from: 'hosted-clientcp', to: 'hosted-etcd', at: 1, path: 'M824 271V305', kind: 'link' },
      { from: 'hosted-clientcp', to: 'hosted-api-l2', at: 2, path: 'M927 228H977', kind: 'link' },
      { from: 'hosted-clientcp', to: 'hosted-applications', at: 3, path: 'M824 185V151', kind: 'status' },
      { from: 'hosted-applications', to: 'hosted-addoncp', at: 3, path: 'M721 108H687', kind: 'status' },
      { from: 'hosted-addoncp', to: 'hosted-addonclaim', at: 3, path: 'M481 108H335', kind: 'status' },
      { from: 'hosted-addonclaim', to: 'hosted-client-resource', at: 3, path: 'M232 151V185', kind: 'status' },
      { from: 'hosted-client-resource', to: 'hosted-clusterclaim', at: 3, path: 'M232 271V305', kind: 'status' }
    ]
  });

  [
    ['hosted-infra-nodes', 'hosted-clientcp'],
    ['hosted-clientcp', 'hosted-etcd'],
    ['hosted-clientcp', 'hosted-api-l2'],
    ['hosted-clientcp', 'hosted-applications', 'hosted-addoncp', 'hosted-addonclaim', 'hosted-client-resource', 'hosted-clusterclaim']
  ].forEach(function (active, i) { chapters[4].beats[i].active = active; });
})();
