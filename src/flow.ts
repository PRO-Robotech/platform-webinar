import { chapters } from './content.ts';
import { applyGraphsA } from './graphs-a.ts';
import { applyGraphsB } from './graphs-b.ts';

// Every presentation reads the same completed flow. Themes only change how it
// is displayed; they never keep a separate copy of the steps or dependencies.
applyGraphsA(chapters);
applyGraphsB(chapters);

export { chapters };
