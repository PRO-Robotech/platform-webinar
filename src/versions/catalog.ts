export const versions = [
  { name: 'platform-beget-atlas', title: 'Beget · Атлас', switcherLabel: 'Beget · Атлас', family: 'atlas', guide: 'platform-beget-atlas-guide' },
  { name: 'platform-beget', title: 'Beget · Космос', switcherLabel: 'Beget · Космос', family: 'beget', guide: 'platform-beget-guide' },
  { name: 'platform-beget-light-v1', title: 'Beget · Светлая версия', switcherLabel: 'Beget · Светлая', family: 'narrative', guide: 'platform-beget-light-v1-guide' },
  { name: 'platform-story', title: 'Путь кластера · Темная история', switcherLabel: 'История · Темная', family: 'narrative', guide: 'platform-story-guide' },
  { name: 'platform-story-dark-v1', title: 'Путь кластера · Темная версия v1', switcherLabel: 'История · Версия v1', family: 'narrative', guide: 'platform-story-dark-v1-guide' },
  { name: 'platform-flight', title: 'Platform Odyssey · Космический маршрут', switcherLabel: 'Полет · Космический маршрут', family: 'flight', guide: 'platform-flight-guide' },
  { name: 'platform-flight-v1', title: 'Platform Odyssey · Маршрут v1', switcherLabel: 'Полет · Версия v1', family: 'flight', guide: 'platform-flight-v1-guide' },
  { name: 'platform-webinar', title: 'Путь кластера · Классическая презентация', switcherLabel: 'Вебинар · Классика', family: 'classic', guide: 'webinar-guide' },
  { name: 'platform-webinar-classic', title: 'Путь кластера · Classic', switcherLabel: 'Вебинар · Classic', family: 'classic', guide: 'webinar-guide-classic' },
] as const;

export type PresentationVersion = typeof versions[number];
