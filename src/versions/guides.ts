import type { Chapter } from '../types.ts';
import type { PresentationVersion } from './catalog.ts';

export function renderGuide(chapters: Chapter[], version: PresentationVersion): string {
  const count = chapters.reduce((total, chapter) => total + chapter.beats.length, 0);
  const minutes = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  let elapsed = 0;
  let number = 0;
  const table = chapters.map((chapter, index) => {
    const start = elapsed;
    const [mins, secs] = chapter.duration.split(':').map(Number);
    elapsed += mins * 60 + secs;
    return `| ${index + 1} | ${chapter.title} | ${chapter.beats.length} | ${minutes(start)}–${minutes(elapsed)} |`;
  }).join('\n');

  const sections = chapters.map((chapter, index) => {
    const events = chapter.beats.map((beat, step) => {
      number += 1;
      const url = `${version.name}.html#chapter-${index + 1}-step-${step + 1}`;
      return `### ${String(number).padStart(2, '0')}. ${beat.title}\n\n[Показать шаг](${url})\n\n${beat.summary}\n\n**Результат:** ${beat.result}\n\n${beat.note}`;
    }).join('\n\n');
    return `## ${index + 1}. ${chapter.title} — ${chapter.duration}\n\n${chapter.question}\n\n${events}`;
  }).join('\n\n');

  const controls = version.family === 'flight'
    ? '- Стрелки и экранные кнопки — переход между событиями.\n- Нижняя навигация — переход к главе.\n- На карте можно рассмотреть ответвления маршрута; подробности текущего события находятся в боковой панели.'
    : '- **← / →** — предыдущее / следующее событие.\n- **1–7** или нижняя навигация — выбор главы.\n- **Home / End** — начало / конец рассказа.\n- Нажатие на блок — его описание.\n- **F** — полноэкранный режим.';

  return `# ${version.title} — сценарий вебинара\n\n[Открыть презентацию](${version.name}.html)\n\nВсе сохраненные оформления используют единый актуальный флоу: **${chapters.length} глав, ${count} событий**, около **${minutes(elapsed)}**. Сценарий и схемы формируются из общих исходников; обозначение v1 сохраняет название оформления.\n\n**Уровни:** L0 — управляющий кластер; L1 — инфраструктурный; L2 — клиентский. Пользователь — отдельный участник процесса.\n\n## Управление\n\n${controls}\n\nПереходы выполняет ведущий. Параллельные процессы рассматриваются по очереди только для удобства объяснения.\n\n## План выступления\n\n| Глава | Тема | События | Время |\n| --- | --- | --- | --- |\n${table}\n\n## Опорные связи\n\n- ClusterClaim Operator наблюдает ClusterClaim; стрелка направлена от оператора к ресурсу. Оператор создает Cluster и CSR approver / CCM в L0 для L1 и L2.\n- Cluster API наблюдает ресурс Cluster и запускает создание машин или control plane. Статус инициализации L1 возвращается через Cluster L1 в ClusterClaim.\n- Аддоны проходят фазы установки, защиты, наблюдаемости и изоляции. Одновременно ClusterClaim Operator настраивает Vault для конкретного кластера.\n- Control plane L2 разворачивается по цепочке AddonClaim → Addon (CP) → Applications → приложение в L1.\n- Статус возвращается по цепочке Control plane L2 → Applications → Addon (CP) → AddonClaim → Cluster L2 → ClusterClaim.\n- Базовые аддоны L2 заказывает ClusterClaim Operator. Пользовательские приложения проходят ту же цепочку AddonClaim → Addon → Applications → итоговые ресурсы.\n- Vault хранит подготовленные зависимости и индивидуальные настройки доступа для кластера.\n\n${sections}\n\n## Завершение\n\nВернитесь к исходному заказу: ClusterClaim описывает целевое состояние, операторы доводят платформу до него, а статусы ресурсов позволяют подтвердить результат.\n`;
}
