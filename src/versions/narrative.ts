import type { Chapter } from '../types.js';

/** Saved visual treatments that share the chapter/step navigation model. */
export const narrativeVersionNames = [
  'platform-story',
  'platform-story-dark-v1',
  'platform-beget-light-v1',
] as const;

const contentMarker = '__NARRATIVE_CONTENT__';

/**
 * Keep each saved theme and its interactions, while using the same narrative,
 * graph topology, controller directions, reveal steps and statuses as the main
 * presentation. Templates deliberately contain no copies of the flow data.
 */
export function renderNarrativeVersion(template: string, chapters: Chapter[]): string {
  if (template.split(contentMarker).length !== 2) {
    throw new Error('A narrative template must contain one content marker.');
  }
  const content = JSON.stringify({ chapters })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return template.replace(contentMarker, () => `window.NarrativeContent = ${content};`);
}
