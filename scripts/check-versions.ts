import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { chapters } from '../src/flow.ts';
import { versions } from '../src/versions/catalog.ts';
import { createFlightContent } from '../src/versions/flight.ts';
import { validatePlacement } from '../src/versions/atlas-layout.ts';
import { validateStarMap } from '../src/versions/atlas-intro.ts';
import { intro } from '../src/navigation.ts';
import type { Chapter } from '../src/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fingerprint = createHash('sha256').update(JSON.stringify(chapters)).digest('hex');
const beats = chapters.flatMap(chapter => chapter.beats);
assert.equal(chapters.length, 7);
assert.equal(beats.length, 36);

const hasEdge = (chapter: number, from: string, to: string): boolean =>
  chapters[chapter].edges.some(edge => edge.from === from && edge.to === to);
assert(hasEdge(0, 'operator', 'claim'), 'The controller observes ClusterClaim.');
assert(!hasEdge(0, 'certificates', 'vault'), 'Do not reintroduce a certificate-to-Vault arrow.');
for (const [chapter, prefix, capi, services] of [[1, 'infra', 'capi', 'services'], [3, 'client', 'client-capi', 'client-services']] as const) {
  assert(hasEdge(chapter, `${prefix}-operator`, `${prefix}-claim`));
  assert(hasEdge(chapter, `${prefix}-operator`, `${prefix}-resource`));
  assert(hasEdge(chapter, `${prefix}-operator`, services));
  assert(hasEdge(chapter, capi, `${prefix}-resource`));
  assert.equal(chapters[chapter].nodes.find(node => node.id === services)?.tier, 'l0');
}
const returnedStatus = ['hosted-clientcp', 'hosted-applications', 'hosted-addoncp', 'hosted-addonclaim', 'hosted-client-resource', 'hosted-clusterclaim'];
for (let index = 1; index < returnedStatus.length; index += 1) {
  assert(chapters[4].edges.some(edge => edge.from === returnedStatus[index - 1]
    && edge.to === returnedStatus[index] && edge.kind === 'status'), 'CP readiness must return through each resource to ClusterClaim.');
}
for (const chapter of chapters) {
  const ids = new Set(chapter.nodes.map(node => node.id));
  assert.equal(ids.size, chapter.nodes.length, `${chapter.id}: duplicate node id`);
  for (const edge of chapter.edges) {
    assert(ids.has(edge.from) && ids.has(edge.to), `${chapter.id}: disconnected edge`);
    assert(edge.at >= 0 && edge.at < chapter.beats.length, `${chapter.id}: edge outside event sequence`);
    for (const id of [edge.from, edge.to]) assert(chapter.nodes.find(node => node.id === id)!.at <= edge.at);
  }
}

// The atlas skin places every zone, block and edge override on its own grid.
const placementProblems = [validatePlacement('intro', intro), ...chapters.map(chapter => validatePlacement(chapter.id, chapter)), validateStarMap(chapters)].flat();
assert.deepEqual(placementProblems, [], `Atlas layout is out of date:\n${placementProblems.join('\n')}`);

const flight = createFlightContent(chapters);
assert.equal(flight.scenes.length, beats.length);
flight.scenes.forEach((scene, index) => {
  assert.equal(scene.title, beats[index].title);
  assert.equal(scene.summary, beats[index].summary);
  assert.equal(scene.takeaway, beats[index].result);
  assert.equal(scene.note, beats[index].note);
});

let rendered = 0;
for (const version of versions) {
  const file = `${version.name}.html`;
  const html = await readFile(resolve(root, 'outputs', file), 'utf8');
  assert(html.includes(`<meta name="platform-flow" content="${fingerprint}">`), `${file}: stale flow`);
  assert(html.includes('view-switcher'), `${file}: missing display switcher`);
  assert(!/PRO[\s-]*Robotech/i.test(html), `${file}: old company branding`);
  assert(!/__NARRATIVE_CONTENT__|__STYLE__|__SCRIPT__|__CONTENT__|__ENGINE__/.test(html), `${file}: unresolved template`);
  assert(!/<script\b[^>]*\bsrc=/.test(html), `${file}: external script in offline presentation`);
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  scripts.forEach(code => { new Script(code, { filename: file }); });
  for (const location of ['dist', 'dist/outputs']) {
    assert.equal(await readFile(resolve(root, location, file), 'utf8'), html, `${location}/${file}: missing or stale variant`);
  }
  const guide = await readFile(resolve(root, 'outputs', `${version.guide}.md`), 'utf8');
  assert.equal((guide.match(/^### \d+\./gm) ?? []).length, beats.length, `${file}: guide event count`);
  beats.forEach(beat => assert(guide.includes(beat.title), `${file}: guide omits ${beat.title}`));
  if (version.family === 'narrative') {
    const context: { window: { NarrativeContent?: { chapters: Chapter[] }; NarrativeDiagram?: { render(chapter: Chapter, step: number): string } } } = { window: {} };
    new Script(scripts[0]).runInNewContext(context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.NarrativeContent?.chapters)), JSON.parse(JSON.stringify(chapters)), `${file}: stale graph data`);
    new Script(scripts[1]).runInNewContext(context);
    for (const chapter of chapters) chapter.beats.forEach((_, step) => {
      const svg = context.window.NarrativeDiagram!.render(chapter, step);
      assert(!svg.includes('data-layout-overflow'), `${file}: clipped card at ${chapter.id}:${step}`);
      rendered += 1;
    });
  }
}
console.log(`Verified ${versions.length} static versions, ${beats.length} events each, ${rendered} saved-theme SVG states, controller directions, archive URLs and generated guides.`);
