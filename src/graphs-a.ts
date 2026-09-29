import type { Chapter, DiagramGraph, DiagramNode, Edge, EdgeKind, NodeKind, TextLines, Tier } from './types.js';

export function applyGraphsA(chapters: Chapter[]): void {
 const chapterAt = (index: number): Chapter => {
  const chapter = chapters[index];
  if (!chapter) throw new Error(`Missing chapter ${index + 1}`);
  return chapter;
 };
 const activate = (chapterIndex: number, beatIndex: number, active: string[]): void => {
  const beat = chapterAt(chapterIndex).beats[beatIndex];
  if (!beat) throw new Error(`Missing beat ${beatIndex + 1} in chapter ${chapterIndex + 1}`);
  beat.active = active;
 };
 const N = (id: string, at: number, x: number, y: number, w: number, h: number,
  title: TextLines, sub: TextLines, kind: NodeKind, tier: Tier,
  extra: Partial<Pick<DiagramNode, 'detail' | 'detailKind' | 'phase' | 'readyAt' | 'variants' | 'badges'>> = {}): DiagramNode =>
  ({ id, at, x, y, w, h, title, sub, kind, tier, ...extra });
 const E = (from: string, to: string, at: number, path: string, label?: string,
  lx?: number, ly?: number, kind: EdgeKind = 'command'): Edge =>
  ({ from, to, at, path, label, lx, ly, kind });
 // Card positions use an 8 px grid. Ports terminate on the visible shape,
 // including the inset front face of machines and curved storage caps.
 Object.assign(chapterAt(0),{
  zones:[{id:'l0',x:224,y:24,w:560,h:384,label:'L0',tier:'l0'},{id:'ext',x:904,y:24,w:272,h:384,label:'ВНЕШНИЕ СЕРВИСЫ',tier:'external'}],
  nodes:[
   N('customer',0,24,88,176,136,'Заказчик','Заказ платформы','user','actor'),
   N('claim',0,248,88,232,136,'ClusterClaim',['Версия платформы','Сеть, версии, ресурсы'],'resource','l0'),
   N('operator',1,528,88,232,136,['ClusterClaim','Operator'],'Исполняет описание','operator','l0'),
   N('bucket',2,936,88,216,136,['Облако','Backup-бакет'],'Создан S3-бакет','cloud','external'),
   N('certificates',3,528,272,232,112,'Сертификаты','Материал доверия','resource','l0'),
   N('vault',4,936,272,216,112,'Vault',['Credentials бакета','Сертификаты'],'storage','external')
  ],
  edges:[E('customer','claim',0,'M199 156H249'),E('operator','claim',1,'M529 156H479'),E('operator','bucket',2,'M759 156H937','запрос',848,132),E('operator','certificates',3,'M644 223V273','выпуск',704,248),E('bucket','vault',4,'M1044 223V273','credentials',1112,248)]
 } satisfies DiagramGraph);
 [['customer','claim'],['claim','operator'],['operator','bucket'],['operator','certificates'],['bucket','certificates','vault']].forEach((active,i)=>activate(0,i,active));
 Object.assign(chapterAt(1),{
  zones:[{id:'l0',x:16,y:16,w:800,h:232,label:'L0',tier:'l0'},{id:'ext',x:856,y:16,w:328,h:232,label:'ВНЕШНЕЕ ОБЛАКО',tier:'external'},{id:'l1',x:16,y:264,w:1168,h:144,label:'L1',tier:'l1',at:1}],
  nodes:[
   N('infra-claim',0,40,64,208,88,'ClusterClaim','Исходный заказ','resource','l0',{variants:[{at:2,sub:'L1 инициализирован'}]}),
   N('infra-operator',0,304,64,208,88,['ClusterClaim','Operator'],'','operator','l0',{detail:'ClusterClaim Operator наблюдает исходный ClusterClaim и создаёт ресурс Cluster L1. Параллельно он заказывает CSR approver для подписи сертификатов нод и CCM для интеграции с облаком; оба компонента работают в L0.'}),
   N('infra-resource',0,568,64,208,88,'Cluster L1','Описание в L0','resource','l0',{variants:[{at:2,sub:'Инициализирован'}]}),
   N('services',0,304,176,208,64,'CSR + CCM','','operator','l0',{detail:'ClusterClaim Operator создаёт CSR approver для подписи сертификатов нод и CCM для интеграции с облаком параллельно с Cluster L1. Оба компонента работают в L0.'}),
   N('capi',1,568,176,208,64,'Cluster API','','operator','l0',{detail:'Cluster API наблюдает ресурс Cluster L1 и запрашивает создание виртуальных машин в облаке. Статус инициализации возвращается от машин через Cluster API и Cluster L1 в исходный ClusterClaim.'}),
   N('cloud',1,880,176,272,64,'Облако','','cloud','external',{detail:'По запросу Cluster API облако создаёт виртуальные машины инфраструктурного кластера L1.'}),
   N('machines',1,888,304,264,96,'Машины L1','Кластер инициализируется','machines','l1',{variants:[{at:2,sub:'L1 инициализирован'}]}),
   N('network',3,464,304,264,96,['Cilium','CoreDNS'],'','app','l1'),
   N('delivery',4,40,304,264,96,['Argo CD','AddonOperator'],'','operator','l1')
  ],
  edges:[
   E('infra-operator','infra-claim',0,'M305 108H247'),
   E('infra-operator','infra-resource',0,'M511 108H569'),
   E('infra-operator','services',0,'M408 151V177'),
   E('capi','infra-resource',1,'M640 177V151'),
   E('capi','cloud',1,'M775 208H881','создать VM',828,184),
   E('cloud','machines',1,'M1016 239V311','машины L1',1092,280),
   E('machines','capi',2,'M944 311V280H704V239','инициализирован',824,280,'status'),
   E('capi','infra-resource',2,'M704 177V151','',0,0,'status'),
   E('infra-resource','infra-claim',2,'M672 65V40H144V65','',0,0,'status'),
   E('machines','network',3,'M889 352H727','bootstrap',808,328),
   E('network','delivery',4,'M465 352H303')
  ]
 } satisfies DiagramGraph);
 [['infra-claim','infra-operator','infra-resource','services'],['capi','cloud','machines'],['machines','capi','infra-resource','infra-claim'],['machines','network'],['network','delivery']].forEach((active,i)=>activate(1,i,active));
 Object.assign(chapterAt(3),{
  zones:[{id:'l0',x:24,y:24,w:744,h:384,label:'L0',tier:'l0'},{id:'l1',x:808,y:24,w:368,h:384,label:'L1',tier:'l1'}],
  nodes:[
   N('client-claim',0,48,72,208,112,'ClusterClaim','Исходный заказ','resource','l0'),
   N('client-operator',0,304,72,208,112,['ClusterClaim','Operator'],'Исполняет заказ','operator','l0',{detail:'ClusterClaim Operator наблюдает ClusterClaim и создаёт ресурс Cluster L2. Параллельно он заказывает CSR approver для подписи сертификатов нод и CCM для интеграции с облаком. CSR approver и CCM работают в L0.'}),
   N('client-services',0,560,72,184,112,'CSR + CCM',['Сертификаты нод','Облако'],'operator','l0',{detail:'ClusterClaim Operator создаёт CSR approver для подписи сертификатов нод и CCM для интеграции с облаком параллельно с Cluster L2. Оба компонента работают в L0.'}),
   N('client-resource',0,48,272,208,112,'Cluster L2','Описание L2 в L0','resource','l0'),
   N('client-capi',1,304,272,208,112,'Cluster API','Запрашивает Control plane L2','operator','l0'),
   N('addonclaim',1,560,272,184,112,'AddonClaim','Заявка на аддон','resource','l0'),
   N('addon-cp',2,832,72,320,88,'Addon (CP)','Ресурс Kubernetes','resource','l1'),
   N('cp-applications',3,832,184,320,88,'Applications','Ресурсы Argo CD','resource','l1'),
   N('client-app',4,832,296,320,88,'Control plane L2','Приложение в L1','app','l1')
  ],
  edges:[
   E('client-operator','client-claim',0,'M305 128H255'),
   E('client-operator','client-services',0,'M511 128H561'),
   E('client-operator','client-resource',0,'M408 183V228H152V273'),
   E('client-capi','client-resource',1,'M305 328H255'),
   E('client-capi','addonclaim',1,'M511 328H561'),
   E('addonclaim','addon-cp',2,'M743 328H784V116H833'),
   E('addon-cp','cp-applications',3,'M992 159V185','AddonOperator',1091,172),
   E('cp-applications','client-app',4,'M992 271V297','Argo CD',1068,284)
  ]
 } satisfies DiagramGraph);
 [['client-claim','client-operator','client-resource','client-services'],['client-capi','addonclaim'],['addonclaim','addon-cp'],['addon-cp','cp-applications'],['cp-applications','client-app']].forEach((active,i)=>activate(3,i,active));
 Object.assign(chapterAt(5),{
  zones:[{id:'l0',x:16,y:16,w:264,h:392,label:'L0',tier:'l0'},{id:'l1',x:304,y:16,w:520,h:224,label:'L1 · ДОСТАВКА АДДОНОВ',tier:'l1'},{id:'l2',x:848,y:16,w:336,h:224,label:'L2',tier:'l2'}],
  nodes:[
   N('defaults-operator',0,40,272,216,120,['ClusterClaim','Operator'],'Заказывает аддоны L2','operator','l0'),
   N('defaults-claim',0,40,88,216,128,'AddonClaim',['Заявка на стандартные','аддоны L2'],'resource','l0'),
   N('defaults-addon',1,328,88,208,128,'Addon',['Обработчик:','AddonOperator'],'resource','l1'),
   N('defaults-applications',2,584,88,216,128,'Applications',['Ресурсы Argo CD','Целевая среда — L2'],'resource','l1'),
   N('default-addons',3,872,88,288,128,'Аддоны L2',['Cilium · CoreDNS','Konnectivity'],'app','l2',{detail:'Итоговые базовые ресурсы L2: Cilium, CoreDNS и Konnectivity.'}),
   N('hand-off',4,872,272,288,120,['Пользователь','получает кластер'],'Можно запускать приложения','user','actor')
  ],
  edges:[E('defaults-operator','defaults-claim',0,'M148 273V215','создаёт',216,244),E('defaults-claim','defaults-addon',1,'M255 152H329'),E('defaults-addon','defaults-applications',2,'M535 152H585'),E('defaults-applications','default-addons',3,'M799 152H873','Argo CD',836,128),E('default-addons','hand-off',4,'M1016 215V273','L2 готов',1080,244,'status')]
 } satisfies DiagramGraph);
 [['defaults-operator','defaults-claim'],['defaults-claim','defaults-addon'],['defaults-addon','defaults-applications'],['defaults-applications','default-addons'],['default-addons','hand-off']].forEach((active,i)=>activate(5,i,active));
 Object.assign(chapterAt(6),{
  zones:[{id:'user-l0',x:224,y:16,w:232,h:392,label:'L0',tier:'l0'},{id:'user-l1',x:464,y:16,w:496,h:392,label:'L1 · ДОСТАВКА ПРИЛОЖЕНИЯ',tier:'l1'},{id:'user-l2',x:968,y:16,w:216,h:392,label:'L2',tier:'l2'}],
  nodes:[
   N('user-order',0,16,160,176,136,'Пользователь',['Заказывает','приложение'],'user','actor'),
   N('user-addonclaim',0,240,160,200,136,'AddonClaim',['Заказ приложения','пользователя'],'resource','l0'),
   N('user-addon',1,488,160,184,136,'Addon',['Описание','приложения'],'resource','l1'),
   N('user-applications',2,720,160,208,136,'Applications',['Ресурсы Argo CD','Целевая среда — L2'],'resource','l1'),
   N('user-workload',3,984,160,184,136,'Приложение',['Для пользователя','Работает в L2'],'app','l2',{detail:'Приложение, заказанное пользователем через AddonClaim. Его ресурсы развёрнуты и работают в L2.'})
  ],
  edges:[E('user-order','user-addonclaim',0,'M191 228H241'),E('user-addonclaim','user-addon',1,'M439 228H489'),E('user-addon','user-applications',2,'M671 228H721'),E('user-applications','user-workload',3,'M927 228H985')]
 } satisfies DiagramGraph);
 [['user-order','user-addonclaim'],['user-addonclaim','user-addon'],['user-addon','user-applications'],['user-applications','user-workload']].forEach((active,i)=>activate(6,i,active));
}
