import { mountViewSwitcher } from './view-switcher.ts';

// Saved narrative skins expose the canonical data before mounting their UI.
const narrative = (window as Window & { NarrativeContent?: { chapters: { beats: unknown[] }[] } }).NarrativeContent;
if (!narrative) throw new Error('Narrative flow is missing.');
mountViewSwitcher(narrative.chapters.map(chapter => chapter.beats.length));
