import type { Chapter, DiagramScene, Tier } from '../types.ts';
import { chapterNames, intro } from '../navigation.ts';
import { createDiagram, type DiagramView } from './atlas-diagram.ts';
import { createStarMap, stepStar } from './atlas-intro.ts';

const NS = 'http://www.w3.org/2000/svg';
const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 784;
const GRID_WIDTH = 1200;
// Below this the frame is not shrunk further: it stays readable and is dragged around instead.
const MIN_SCALE = .6;
const TRACK_WIDTH = 894;
// Track rows, px: level labels above, the line at 24, chapter names below.
const TRACK_BASE = 24.5;
const TRACK_MIN_CHAPTER = 96;
const LEVELS: Tier[] = ['l0', 'l1', 'l2'];
// Button icons: chevrons, and a circular arrow for starting over.
const ICON = (path: string): string => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const ICON_NEXT = ICON('M6 3.5 10.5 8 6 12.5');
const ICON_RESTART = ICON('M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 2.5v3h3');
/** Typing speed, characters per second: the headline a little slower than the text; erasing is quick. */
const TYPE_RATE = { headline: 42, text: 120, erase: 320 };
/** Longest an erase pass may take, seconds. */
const ERASE_MAX = .3;

const TERMS = /(ClusterClaim Operator|ClusterClaimOperator|Control plane L2|control plane L2|Cluster API|Cluster L[12]|AddonOperator|AddonClaim|ClusterClaim|Applications|Addon \(CP\)|Argo CD|Vault)/g;

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value: string | number): string => String(value).replace(/[&<>"']/g, char => escapes[char]);
const terms = (value: string): string => esc(value).replace(TERMS, '<span class="term">$1</span>');
const seconds = (value: string): number => { const [m, s] = value.split(':').map(Number); return m * 60 + s; };

function find<T extends Element>(selector: string, type: { new(): T; prototype: T }): T {
  const found = document.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Missing presentation element: ${selector}`);
  return found;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.append(node);
  return node;
}

export function mountAtlas(chapters: Chapter[]): void {
  const dom = {
    viewport: find('.viewport', HTMLElement),
    viewportSize: find('.viewport-size', HTMLElement),
    slide: find('.slide', HTMLElement),
    sky: find('#sky', HTMLCanvasElement),
    log: find('.log', HTMLElement),
    story: find('#story', HTMLElement),
    headline: find('#headline', HTMLHeadingElement),
    summary: find('#summary', HTMLParagraphElement),
    resultBlock: find('#result-block', HTMLElement),
    resultLabel: find('#result-label', HTMLElement),
    result: find('#result', HTMLParagraphElement),
    diagram: find('#diagram', HTMLElement),
    track: find('#trajectory', SVGSVGElement),
    counter: find('#counter', HTMLElement),
    back: find('#back', HTMLButtonElement),
    next: find('#next', HTMLButtonElement),
    grid: find('#grid', HTMLElement),
    fullscreen: find('#fullscreen', HTMLButtonElement),
    printPages: find('#print-pages', HTMLElement),
    pdf: find('#pdf', HTMLAnchorElement),
    theme: find('#theme', HTMLButtonElement),
    toast: find('#toast', HTMLElement),
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const offsets = chapters.map((_, index) => chapters.slice(0, index).reduce((sum, value) => sum + value.beats.length, 0));
  const total = chapters.reduce((sum, value) => sum + value.beats.length, 0);

  let chapter = -2;
  let step = 0;
  let view: DiagramView | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const sceneOf = (index: number): DiagramScene => index < 0 ? intro : chapters[index];
  const sceneId = (index: number): string => index < 0 ? 'intro' : chapters[index].id;

  // ---------- fit: the frame is at least 1280×784 and always fills the window ----------
  // On a small screen (a phone) the whole frame would be too small to read, so it keeps a
  // readable scale, filling the height of a portrait screen, and is dragged around instead.
  function fit(): void {
    const fitScale = Math.min(innerWidth / SLIDE_WIDTH, innerHeight / SLIDE_HEIGHT);
    const scale = fitScale >= MIN_SCALE ? fitScale : Math.max(MIN_SCALE, Math.min(1, innerHeight / SLIDE_HEIGHT));
    const width = Math.max(SLIDE_WIDTH, innerWidth / scale);
    const height = Math.max(SLIDE_HEIGHT, innerHeight / scale);
    dom.viewportSize.style.width = `${width * scale}px`;
    dom.viewportSize.style.height = `${height * scale}px`;
    dom.viewport.classList.toggle('pan', width * scale > innerWidth + 1 || height * scale > innerHeight + 1);
    dom.slide.style.width = `${width}px`;
    dom.slide.style.height = `${height}px`;
    dom.slide.style.transform = `scale(${scale})`;
    dom.slide.style.setProperty('--frame-left', `${(width - GRID_WIDTH) / 2}px`);
    sky.scale = scale;
    sky.offsetX = (width - SLIDE_WIDTH) / 2 * scale;
    sky.offsetY = (height - SLIDE_HEIGHT) / 2 * scale;
    const ratio = Math.min(2, devicePixelRatio || 1);
    dom.sky.width = Math.round(innerWidth * ratio);
    dom.sky.height = Math.round(innerHeight * ratio);
    drawSky();
    fitDiagram();
  }

  /** Diagrams are drawn 1:1; one taller than its area shrinks as a whole, never partly. */
  function fitDiagram(): void {
    for (const drawing of dom.diagram.querySelectorAll<SVGSVGElement>('svg')) {
      const natural = Number(drawing.getAttribute('height'));
      const room = dom.diagram.clientHeight;
      drawing.style.height = natural > room ? `${room}px` : '';
      drawing.style.width = natural > room ? 'auto' : '';
    }
  }

  // ---------- sky: a slowly turning plate and drifting stars, with a camera ----------
  // The camera moves with the story: x/y in slide pixels, z as a slight zoom. Each
  // star has a depth, so near stars move more than far ones (parallax); the
  // graticule is farthest and moves least. Between transitions the plate turns and
  // the stars drift slowly. One loop draws it all; it rests with reduced motion.
  const sky = { scale: 1, offsetX: 0, offsetY: 0, camera: { x: 0, y: 0, z: 0 }, time: 0 };
  let tween: { from: typeof sky.camera; to: typeof sky.camera; start: number; duration: number } | null = null;
  const starField = (() => {
    let seed = 20260929;
    const random = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    return Array.from({ length: 420 }, () => ({ x: random(), y: random(), depth: .25 + random() * .75, magnitude: random() }));
  })();
  const GRATICULE_DEPTH = .2;
  const TURN = .0045;
  const DRIFT_SPEED = { x: 5, y: 1.5 };

  // ---------- theme: dark or light, revealed as a circle growing from the toggle ----------
  const skyTheme = { ink: '#27272A', tint: '244,244,245' };
  // The download button offers the PDF in the theme on screen.
  const updatePdfLink = (): void => {
    const light = document.documentElement.dataset.theme === 'light';
    dom.pdf.href = light ? 'platform-beget-atlas-light.pdf' : 'platform-beget-atlas.pdf';
    dom.pdf.download = light ? 'Beget-Atlas-light.pdf' : 'Beget-Atlas.pdf';
  };

  function readSkyTheme(): void {
    updatePdfLink();
    const style = getComputedStyle(document.documentElement);
    skyTheme.ink = style.getPropertyValue('--ink').trim() || skyTheme.ink;
    skyTheme.tint = style.getPropertyValue('--tint').trim() || skyTheme.tint;
  }
  readSkyTheme();

  function setTheme(next: 'light' | 'dark'): void {
    const apply = (): void => {
      if (next === 'light') document.documentElement.dataset.theme = 'light';
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem('atlas-theme', next); } catch { /* the choice just is not remembered */ }
      readSkyTheme();
      drawSky();
    };
    const start = (document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } }).startViewTransition;
    if (!start || reducedMotion.matches) { apply(); return; }
    const box = dom.theme.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    start.call(document, apply).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 640, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }, () => undefined);
  }
  const toggleTheme = (): void => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

  function drawSky(): void {
    const context = dom.sky.getContext('2d');
    if (!context) return;
    const ratio = dom.sky.width / innerWidth;
    const width = innerWidth;
    const height = innerHeight;
    const { scale, offsetX, offsetY, camera, time } = sky;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = skyTheme.ink;
    context.fillRect(0, 0, width, height);
    // A polar graticule in slide coordinates, as on an atlas plate, turning about its pole.
    const cx = 900;
    const cy = 1760;
    const zoom = 1 + camera.z * GRATICULE_DEPTH;
    context.save();
    context.translate(offsetX + camera.x * GRATICULE_DEPTH * scale, offsetY + camera.y * GRATICULE_DEPTH * scale);
    context.translate(SLIDE_WIDTH / 2 * scale, SLIDE_HEIGHT / 2 * scale);
    context.scale(scale * zoom, scale * zoom);
    context.translate(-SLIDE_WIDTH / 2, -SLIDE_HEIGHT / 2);
    context.translate(cx, cy);
    context.rotate(time * TURN);
    context.translate(-cx, -cy);
    context.strokeStyle = `rgba(${skyTheme.tint},.05)`;
    context.lineWidth = 1 / (scale * zoom);
    for (const radius of [1180, 1370, 1560, 1750]) {
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.stroke();
    }
    for (let angle = 0; angle < 360; angle += 12) {
      const t = angle * Math.PI / 180;
      context.beginPath();
      context.moveTo(cx + Math.cos(t) * 1000, cy + Math.sin(t) * 1000);
      context.lineTo(cx + Math.cos(t) * 2100, cy + Math.sin(t) * 2100);
      context.stroke();
    }
    context.restore();
    // Stars of three magnitudes, wrapped around the window so the field never runs out.
    const count = Math.min(starField.length, Math.round(width * height / 5400));
    const wrap = (value: number, size: number): number => ((value % size) + size) % size;
    for (let index = 0; index < count; index++) {
      const star = starField[index];
      const grow = 1 + camera.z * star.depth;
      const driftX = (camera.x + time * DRIFT_SPEED.x) * star.depth * scale;
      const driftY = (camera.y + time * DRIFT_SPEED.y) * star.depth * scale;
      const x = wrap((star.x * width - width / 2) * grow + width / 2 + driftX, width);
      const y = wrap((star.y * height - height / 2) * grow + height / 2 + driftY, height);
      const bright = star.magnitude > .96 ? 2 : star.magnitude > .82 ? 1 : 0;
      const radius = [.6, .9, 1.4][bright] * Math.max(.75, scale) * (1 + camera.z * star.depth * .5);
      context.fillStyle = `rgba(${skyTheme.tint},${[.24, .4, .7][bright]})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  const easeInOut = (t: number): number => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  let lastFrame = 0;
  const epoch = performance.now();
  function skyLoop(now: number): void {
    // About 30 frames a second is plenty for a slow sky.
    if (now - lastFrame >= 32 || tween) {
      lastFrame = now;
      sky.time = (now - epoch) / 1000;
      if (tween) {
        const k = easeInOut(Math.min(1, Math.max(0, (now - tween.start) / tween.duration)));
        const { from, to } = tween;
        sky.camera = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k };
        if (k >= 1) tween = null;
      }
      drawSky();
    }
    requestAnimationFrame(skyLoop);
  }

  /** Glides the camera to a new position over a transition. */
  function moveCamera(target: { x?: number; y?: number; z?: number }, duration: number): void {
    const to = { x: target.x ?? sky.camera.x, y: target.y ?? sky.camera.y, z: target.z ?? sky.camera.z };
    if (reducedMotion.matches) { sky.camera = to; drawSky(); return; }
    tween = { from: { ...sky.camera }, to, start: performance.now(), duration };
  }


  // ---------- trajectory: every event is a tick; chapter width follows its duration ----------
  const durations = chapters.map(value => seconds(value.duration));
  // A level's stage starts in the first chapter where it appears on the map as a zone.
  const stages = LEVELS.map(level => ({ level, chapter: chapters.findIndex(value => value.zones.some(zone => zone.tier === level)) }))
    .filter(stage => stage.chapter >= 0);
  const stageStarts = new Map(stages.map(stage => [stage.chapter, stage.level]));

  /**
   * Draws a trajectory into `host` at the given width. The slide's is interactive; the
   * printed pages get a still copy. Returns how to show a position on it.
   */
  function createTrack(host: SVGSVGElement, trackWidth: number, interactive: boolean): (at: number, beat: number, complete?: boolean) => void {
    // Proportional to duration, with a floor so every chapter name stays legible.
    const sum = durations.reduce((a, b) => a + b, 0);
    const small = durations.map(value => value / sum * trackWidth < TRACK_MIN_CHAPTER);
    const rest = trackWidth - small.filter(Boolean).length * TRACK_MIN_CHAPTER;
    const restSum = durations.filter((_, index) => !small[index]).reduce((a, b) => a + b, 0);
    const widths = durations.map((value, index) => small[index] ? TRACK_MIN_CHAPTER : value / restSum * rest);
    const chapterX = (index: number): number => widths.slice(0, index).reduce((a, b) => a + b, 0);
    const tickX = (index: number, beat: number): number =>
      Math.round(chapterX(index) + 8 + (beat + .5) * (widths[index] - 16) / chapters[index].beats.length) + .5;
    const ticks: { tick: SVGPathElement; chapter: number; step: number }[] = [];
    const names: SVGTextElement[] = [];

    svg('path', { class: 't-line', d: `M0 ${TRACK_BASE}H${trackWidth}` }, host);
    const progress = svg('path', { class: 't-progress', d: `M0 ${TRACK_BASE}H${trackWidth}` }, host);
    chapters.forEach((value, index) => {
      const x = Math.round(chapterX(index)) + .5;
      if (!stageStarts.has(index)) svg('path', { class: 't-bound', d: `M${x} ${TRACK_BASE - 6}V${TRACK_BASE + 6}` }, host);
      value.beats.forEach((_, beat) => {
        ticks.push({ tick: svg('path', { class: 't-tick', d: `M${tickX(index, beat)} ${TRACK_BASE - 3}V${TRACK_BASE + 3}` }, host), chapter: index, step: beat });
      });
      const name = svg('text', { class: 't-name', x: Math.round(chapterX(index)), y: 50 }, host);
      name.textContent = `${index + 1} ${chapterNames[index] ?? value.title}`;
      names.push(name);
    });
    svg('path', { class: 't-bound', d: `M${trackWidth - .5} ${TRACK_BASE - 6}V${TRACK_BASE + 6}` }, host);
    // Stage marks: longer ticks reaching above the line, labelled once.
    for (const { level, chapter: index } of stages) {
      const x = Math.round(chapterX(index)) + .5;
      svg('path', { class: 't-stage', d: `M${x} ${TRACK_BASE - 18}V${TRACK_BASE + 8}` }, host);
      svg('text', { class: 't-stage-label', x: x + 5.5, y: TRACK_BASE - 10 }, host).textContent = level.toUpperCase();
    }
    const marker = svg('path', { class: 't-marker', d: `M0 ${TRACK_BASE - 8}V${TRACK_BASE + 8}` }, host);
    if (interactive) {
      chapters.forEach((value, index) => {
        const x0 = chapterX(index);
        const spacing = (widths[index] - 16) / value.beats.length;
        value.beats.forEach((beat, number) => {
          const width = Math.min(16, spacing);
          const hit = svg('rect', { class: 't-hit', x: tickX(index, number) - width / 2, y: TRACK_BASE - 10, width, height: 20, tabindex: -1, 'data-chapter': index, 'data-step': number }, host);
          svg('title', {}, hit).textContent = `${offsets[index] + number + 1}. ${beat.title}`;
        });
        const hit = svg('rect', { class: 't-hit', x: x0, y: 36, width: widths[index], height: 20, tabindex: 0, role: 'button', 'data-chapter': index, 'aria-label': `Глава ${index + 1}: ${value.title}` }, host);
        svg('title', {}, hit).textContent = value.title;
      });
    }

    // `complete` marks the whole position as done, as on a printed chapter page.
    // The talk's last event fills the line to its end: the story is complete.
    return (at: number, beat: number, complete = false): void => {
      const final = at === chapters.length - 1 && beat === chapters[at].beats.length - 1;
      if (final) complete = true;
      const x = at < 0 ? 0 : final ? trackWidth - .5 : tickX(at, beat) - .5;
      ticks.forEach(({ tick, chapter: index, step: tickStep }) =>
        tick.classList.toggle('past', at >= 0 && (index < at || (index === at && (tickStep < beat || (complete && tickStep === beat))))));
      names.forEach((name, index) => name.classList.toggle('cur', index === at));
      marker.classList.toggle('hidden', at < 0);
      marker.style.transform = `translateX(${x}px)`;
      progress.style.transform = `scaleX(${x / trackWidth})`;
    };
  }

  // ---------- print: one page per stage, the finished scheme and the timeline ----------
  // Printing (or `npm run export:pdf`) gives eight pages: the star map, then each chapter
  // as it stands after its last step, every block at full strength. No interface: only the
  // content in the middle, the timeline below and the Beget logo where the buttons are.
  function buildPrintPages(): void {
    const host = dom.printPages;
    host.replaceChildren();
    const logo = document.querySelector('.brand-logo');
    for (let index = -1; index < chapters.length; index++) {
      const page = document.createElement('section');
      page.className = 'print-page';
      const area = document.createElement('div');
      area.className = 'print-diagram';
      page.append(area);
      const scene = sceneOf(index);
      const last = index < 0 ? 0 : chapters[index].beats.length - 1;
      const drawing = index < 0
        ? createStarMap(chapters, { entrance: false })
        : createDiagram(sceneId(index), scene, scene.label ?? scene.title ?? 'Схема', { marksNew: false, focusAll: true, still: true });
      area.append(drawing.svg);
      drawing.apply(last, 0);
      const deck = document.createElement('div');
      deck.className = 'print-deck';
      const track = document.createElementNS(NS, 'svg');
      for (const [key, value] of Object.entries({ class: 'trajectory', width: TRACK_WIDTH, height: 56, viewBox: `0 0 ${TRACK_WIDTH} 56` })) track.setAttribute(key, String(value));
      deck.append(track);
      if (logo) deck.append(logo.cloneNode(true));
      page.append(deck);
      createTrack(track, TRACK_WIDTH, false)(index, last, true);
      host.append(page);
    }
  }

  let showTrack: (at: number, beat: number, complete?: boolean) => void = () => undefined;
  const updateTrack = (): void => showTrack(chapter, step);

  // ---------- typewriter: the step's text is erased and typed with a full-block carriage ----------
  // Two tracks run side by side, each with its own caret: the story (headline, then the
  // explanation) and the outcome. On a new step each caret first backs over its old text,
  // then types the new one. Bold terms keep their markup: text nodes are filled in place.
  // After typing the carets blink for a moment and leave. Screen readers get the text once
  // it is complete.
  type Target = { element: HTMLElement; html: string; rate: number };
  type Pass = { nodes: { node: Text; text: string }[]; total: number; rate: number; element: HTMLElement; erase: boolean };
  const makeCaret = (): HTMLSpanElement => {
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.setAttribute('aria-hidden', 'true');
    return caret;
  };
  const carets = [makeCaret(), makeCaret()];
  let typing: { run: number; targets: Target[] } = { run: 0, targets: [] };
  let caretTimer: ReturnType<typeof setTimeout> | undefined;

  const textNodes = (element: HTMLElement): { node: Text; text: string }[] => {
    const nodes: { node: Text; text: string }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push({ node: node as Text, text: node.textContent ?? '' });
    return nodes;
  };

  /** Jumps to the end: the final text in place, no carets. */
  function finishTyping(): void {
    typing.run += 1;
    for (const target of typing.targets) target.element.innerHTML = target.html;
    typing.targets = [];
    clearTimeout(caretTimer);
    for (const caret of carets) { caret.remove(); caret.classList.remove('idle'); }
    dom.log.setAttribute('aria-busy', 'false');
  }

  function retype(tracks: Target[][]): void {
    finishTyping();
    const targets = tracks.flat();
    if (reducedMotion.matches) { for (const target of targets) target.element.innerHTML = target.html; return; }
    const run = typing.run;
    typing = { run, targets };
    dom.log.setAttribute('aria-busy', 'true');
    let pending = tracks.length;
    const settle = (): void => {
      pending -= 1;
      if (pending > 0 || typing.run !== run) return;
      typing.targets = [];
      dom.log.setAttribute('aria-busy', 'false');
      for (const caret of carets) caret.classList.add('idle');
      caretTimer = setTimeout(() => { for (const caret of carets) { caret.remove(); caret.classList.remove('idle'); } }, 1200);
    };
    tracks.forEach((track, trackIndex) => {
      const caret = carets[trackIndex] ?? makeCaret();
      // Erase passes, last element of the track first; each takes at most ERASE_MAX seconds.
      const passes: Pass[] = [...track].reverse().map(({ element }) => {
        const nodes = textNodes(element);
        const total = nodes.reduce((sum, entry) => sum + entry.text.length, 0);
        return { nodes, total, rate: Math.max(TYPE_RATE.erase, total / ERASE_MAX), element, erase: true };
      }).filter(pass => pass.total > 0);
      let index = 0;
      let started = performance.now();
      let typed = false;
      const place = (pass: Pass, count: number): void => {
        let left = count;
        let anchor: Text | null = null;
        for (const entry of pass.nodes) {
          const take = Math.max(0, Math.min(entry.text.length, left));
          entry.node.textContent = entry.text.slice(0, take);
          if (take > 0 || !anchor) anchor = entry.node;
          left -= take;
        }
        if (anchor) anchor.after(caret); else pass.element.append(caret);
      };
      // A timer rather than animation frames, so typing also completes in a background tab.
      const tick = (): void => {
        if (typing.run !== run) return;
        const now = performance.now();
        if (index >= passes.length && !typed) {
          // Erasing is done: set the new text and queue the typing passes.
          typed = true;
          for (const target of track) {
            target.element.innerHTML = target.html;
            const nodes = textNodes(target.element);
            for (const entry of nodes) entry.node.textContent = '';
            passes.push({ nodes, total: nodes.reduce((sum, entry) => sum + entry.text.length, 0), rate: target.rate, element: target.element, erase: false });
          }
          started = now;
        }
        const pass = passes[index];
        if (!pass) { settle(); return; }
        const done = Math.min(pass.total, Math.floor((now - started) * pass.rate / 1000));
        place(pass, pass.erase ? pass.total - done : done);
        if (done >= pass.total) { index += 1; started = now; }
        setTimeout(tick, 16);
      };
      setTimeout(tick, 16);
    });
  }

  /** Position of an element placed with translate(x y), in diagram pixels. */
  function placed(element: Element | null | undefined): [number, number] | null {
    const match = element?.getAttribute('transform')?.match(/translate\((-?[\d.]+)[ ,](-?[\d.]+)\)/);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  /** The star a chapter step starts from: its first component, or ClusterClaim for the very first step. */
  function starOf(map: SVGSVGElement, index: number, beat: number): [number, number] {
    const exact = map.querySelectorAll(`.s-star[data-go="${index}:${beat}"]`);
    const chosen = [...exact].find(star => star.classList.contains('origin')) ?? exact[0]
      ?? map.querySelector(`.s-star[data-go^="${index}:"]`);
    return placed(chosen) ?? [WIDTH_HALF, HEIGHT_HALF(map)];
  }

  /** Centre of the block a chapter step is about, in its diagram. */
  function focusOf(drawing: SVGSVGElement, index: number, beat: number): [number, number] {
    const id = chapters[index]?.beats[beat]?.active?.[0];
    const node = id ? drawing.querySelector(`[data-node="${id}"]`) : null;
    const at = placed(node);
    const box = node?.querySelector('.box');
    if (!at || !box) return [WIDTH_HALF, HEIGHT_HALF(drawing)];
    return [at[0] + Number(box.getAttribute('width')) / 2, at[1] + Number(box.getAttribute('height')) / 2];
  }

  const WIDTH_HALF = GRID_WIDTH / 2;
  const HEIGHT_HALF = (drawing: SVGSVGElement): number => Number(drawing.getAttribute('height')) / 2;
  const MOVE = 'cubic-bezier(.65,0,.35,1)';
  const ZOOM = 3.2;
  // Fading schemes also lose focus a little.
  const BLUR = 'blur(6px)';
  const SHARP = 'blur(0px)';
  const FLIGHT = 400;
  // How far the sky follows: a fraction of the schemes' movement, scaled per star depth.
  const SKY_FLIGHT = .9;
  const SKY_ZOOM = .45;
  const DRIFT = .1;

  /**
   * Chapter to chapter: the camera flies across the star map from where the previous
   * step happens to where the new one does, so a destination up and to the right moves
   * the schemes down and to the left, with a slight zoom. From the opening: the star map
   * zooms into the star the step starts from and the scheme grows out of it; back to the
   * opening zooms out.
   */
  function swapDiagram(direction: -1 | 0 | 1, previousChapter: number, previousStep: number): void {
    const previous = view?.svg;
    const scene = sceneOf(chapter);
    view = chapter < 0
      ? createStarMap(chapters, { entrance: !previous })
      : createDiagram(sceneId(chapter), scene, scene.label ?? scene.title ?? 'Схема создания платформы');
    const next = view.svg;
    dom.diagram.append(next);
    fitDiagram();
    if (!previous) return;
    const done = (): void => previous.remove();
    if (!direction || reducedMotion.matches) { done(); return; }
    previous.classList.add('leaving');
    // The arriving scheme ignores the pointer (no tooltips, no clicks) until it has settled.
    next.classList.add('arriving');
    requestAnimationFrame(() => {
      const settle = (): void => next.classList.remove('arriving');
      Promise.all(next.getAnimations().map(animation => animation.finished)).then(settle, settle);
    });

    if (previousChapter < 0 && chapter >= 0) {
      const [sx, sy] = starOf(previous, chapter, step);
      const [fx, fy] = focusOf(next, chapter, step);
      previous.style.transformOrigin = `${sx}px ${sy}px`;
      next.style.transformOrigin = `${fx}px ${fy}px`;
      moveCamera({ z: SKY_ZOOM }, 880);
      previous.animate([{ transform: 'scale(1)', opacity: 1, filter: SHARP }, { transform: `scale(${ZOOM})`, opacity: 0, filter: BLUR }],
        { duration: 640, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished.then(done, done);
      next.animate([{ transform: 'scale(.6)', opacity: 0, filter: BLUR }, { transform: 'scale(1)', opacity: 1, filter: SHARP }],
        { duration: 560, delay: 320, easing: 'cubic-bezier(.25,1,.5,1)', fill: 'backwards' });
    } else if (chapter < 0 && previousChapter >= 0) {
      const [fx, fy] = focusOf(previous, previousChapter, 0);
      const [sx, sy] = starOf(next, previousChapter, 0);
      previous.style.transformOrigin = `${fx}px ${fy}px`;
      next.style.transformOrigin = `${sx}px ${sy}px`;
      moveCamera({ z: 0 }, 840);
      previous.animate([{ transform: 'scale(1)', opacity: 1, filter: SHARP }, { transform: 'scale(.6)', opacity: 0, filter: BLUR }],
        { duration: 360, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished.then(done, done);
      next.animate([{ transform: `scale(${ZOOM})`, opacity: 0, filter: BLUR }, { transform: 'scale(1)', opacity: 1, filter: SHARP }],
        { duration: 640, delay: 200, easing: 'cubic-bezier(.25,1,.5,1)', fill: 'backwards' });
    } else {
      const from = stepStar(chapters, previousChapter, previousStep);
      const to = stepStar(chapters, chapter, step);
      let [dx, dy] = from && to ? [to[0] - from[0], to[1] - from[1]] : [direction, 0];
      const length = Math.hypot(dx, dy) || 1;
      [dx, dy] = [dx / length * FLIGHT, dy / length * FLIGHT];
      // The camera moves towards the destination, so the scenery moves the other way.
      moveCamera({ x: sky.camera.x - dx * SKY_FLIGHT, y: sky.camera.y - dy * SKY_FLIGHT }, 640);
      previous.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, filter: SHARP },
        { transform: `translate(${-dx}px, ${-dy}px) scale(${1 + DRIFT})`, opacity: 0, filter: BLUR },
      ], { duration: 640, easing: MOVE, fill: 'forwards' }).finished.then(done, done);
      next.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${1 - DRIFT})`, opacity: 0, filter: BLUR },
        { transform: 'translate(0, 0) scale(1)', opacity: 1, filter: SHARP },
      ], { duration: 640, easing: MOVE, fill: 'backwards' });
    }
  }

  function render(direction: -1 | 0 | 1, chapterChanged: boolean, previousChapter: number, previousStep: number): void {
    const current = chapter >= 0 ? chapters[chapter] : undefined;
    const beat = current?.beats[step];
    if (chapterChanged) swapDiagram(direction, previousChapter, previousStep);
    view?.apply(current ? step : 0, chapterChanged ? 0 : direction);

    const opening = !current || !beat;
    dom.resultLabel.textContent = opening ? 'Главный вопрос' : 'Итог шага';
    dom.counter.textContent = opening ? `${total} событий` : `${offsets[chapter] + step + 1} из ${total}`;
    // The outcome types alongside the headline, not after the explanation.
    retype([
      [
        { element: dom.headline, html: esc(opening ? 'Что происходит после «Создать кластер»?' : beat.title), rate: TYPE_RATE.headline },
        { element: dom.summary, html: terms(opening ? 'Одна заявка запускает создание целой платформы. Проследим, кто действует, что появляется и почему разрешён следующий шаг.' : beat.summary), rate: TYPE_RATE.text },
      ],
      [{ element: dom.result, html: opening ? esc('Как из конфигурации получить Kubernetes, готовый для приложений пользователя?') : terms(beat.result), rate: TYPE_RATE.text }],
    ]);

    const last = chapter === chapters.length - 1 && step === chapters[chapter].beats.length - 1;
    let nextTitle = chapters[0].beats[0].title;
    if (current) {
      if (step < current.beats.length - 1) nextTitle = current.beats[step + 1].title;
      else if (!last) nextTitle = chapters[chapter + 1].beats[0].title;
      else nextTitle = 'Вступление';
    }
    const nextLabel = chapter < 0 ? 'Начать' : last ? 'Сначала' : 'Далее';
    dom.next.innerHTML = `${esc(nextLabel)} ${last ? ICON_RESTART : ICON_NEXT}`;
    dom.next.setAttribute('aria-label', `${nextLabel}: ${nextTitle}`);
    dom.next.title = nextTitle;
    dom.back.setAttribute('aria-label', chapter < 0 ? 'К последнему событию' : 'Предыдущее событие');
    updateTrack();
    document.title = `${beat ? beat.title : 'Атлас Managed Kubernetes'} · Beget`;
  }

  function go(index: number, beat = 0, options: { fromHash?: boolean } = {}): void {
    const nextChapter = Math.max(-1, Math.min(chapters.length - 1, index));
    const nextStep = nextChapter < 0 ? 0 : Math.max(0, Math.min(chapters[nextChapter].beats.length - 1, beat));
    if (nextChapter === chapter && nextStep === step) return;
    const order = (value: number, beatIndex: number): number => value < 0 ? -1 : offsets[value] + beatIndex;
    const direction: -1 | 0 | 1 = chapter === -2 ? 0 : order(nextChapter, nextStep) > order(chapter, step) ? 1 : -1;
    const chapterChanged = nextChapter !== chapter;
    const previousChapter = chapter;
    const previousStep = step;
    chapter = nextChapter;
    step = nextStep;
    if (!options.fromHash) history.replaceState(null, '', chapter < 0 ? '#intro' : `#chapter-${chapter + 1}-step-${step + 1}`);
    render(direction, chapterChanged, previousChapter, previousStep);
  }

  function next(): void {
    if (chapter < 0) go(0);
    else if (step < chapters[chapter].beats.length - 1) go(chapter, step + 1);
    else if (chapter < chapters.length - 1) go(chapter + 1);
    else go(-1);
  }

  function back(): void {
    // From the opening, back goes round to the last event of the talk.
    if (chapter < 0) { go(chapters.length - 1, chapters[chapters.length - 1].beats.length - 1); return; }
    if (step > 0) go(chapter, step - 1);
    else if (chapter > 0) go(chapter - 1, chapters[chapter - 1].beats.length - 1);
    else go(-1);
  }

  function toast(message: string): void {
    clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 4000);
  }

  const closest = (event: Event, selector: string): Element | null =>
    event.target instanceof Element ? event.target.closest(selector) : null;

  // ---------- events ----------
  dom.next.addEventListener('click', next);
  dom.back.addEventListener('click', back);
  dom.track.addEventListener('click', event => {
    const hit = closest(event, '[data-chapter]');
    if (hit) go(Number(hit.getAttribute('data-chapter')), Number(hit.getAttribute('data-step') ?? 0));
  });
  dom.track.addEventListener('keydown', event => {
    const hit = closest(event, '[data-chapter]');
    if (hit && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      go(Number(hit.getAttribute('data-chapter')));
    }
  });
  // On the star map a star opens the step where that component first appears.
  const jump = (target: Element): void => {
    const [index, beat] = (target.getAttribute('data-go') ?? '0:0').split(':').map(Number);
    go(index, beat);
  };
  dom.diagram.addEventListener('click', event => {
    const target = closest(event, '[data-go]');
    if (target) jump(target);
  });
  dom.diagram.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = closest(event, '[data-go]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    jump(target);
  });
  dom.theme.addEventListener('click', toggleTheme);
  dom.fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Для полного экрана откройте HTML в браузере и нажмите F11.');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || closest(event, 'input,textarea,select,details')) return;
    const key = event.key.toLowerCase();
    if (['ArrowRight', 'PageDown'].includes(event.key)) { event.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); back(); }
    else if (event.key === ' ' && !closest(event, 'button,a,[role=button]')) { event.preventDefault(); next(); }
    else if (/^[1-9]$/.test(event.key) && Number(event.key) <= chapters.length) go(Number(event.key) - 1);
    else if (event.key === 'Home') go(-1);
    else if (event.key === 'End') go(chapters.length - 1, chapters[chapters.length - 1].beats.length - 1);
    else if (['f', 'а'].includes(key)) dom.fullscreen.click();
    else if (['t', 'е'].includes(key)) toggleTheme();
    // Shift+G shows the layout grid while adjusting the design.
    else if (event.shiftKey && ['g', 'п'].includes(key)) dom.grid.hidden = !dom.grid.hidden;
  });

  function hashState(): { chapter: number; step: number } {
    const match = location.hash.match(/^#chapter-(\d+)(?:-step-(\d+))?$/);
    return match ? { chapter: Number(match[1]) - 1, step: Number(match[2] ?? '1') - 1 } : { chapter: -1, step: 0 };
  }
  window.addEventListener('hashchange', () => {
    const state = hashState();
    go(state.chapter, state.step, { fromHash: true });
  });
  window.addEventListener('resize', fit, { passive: true });

  // Dragging a frame larger than the window: touch pans natively; the mouse drags here.
  let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  let dragEnded = 0;
  dom.viewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !dom.viewport.classList.contains('pan')) return;
    if (closest(event, 'button,a,[role=button],[data-go],[tabindex]')) return;
    drag = { x: event.clientX, y: event.clientY, left: dom.viewport.scrollLeft, top: dom.viewport.scrollTop, moved: false };
  });
  addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    dom.viewport.classList.add('dragging');
    dom.viewport.scrollLeft = drag.left - dx;
    dom.viewport.scrollTop = drag.top - dy;
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved) dragEnded = performance.now();
    drag = null;
    dom.viewport.classList.remove('dragging');
  });
  // A drag is not a click on whatever it ended over.
  addEventListener('click', event => { if (performance.now() - dragEnded < 100) event.stopPropagation(); }, { capture: true });

  for (let index = 0; index < 12; index++) {
    const column = document.createElement('i');
    column.style.left = `${index * 102}px`;
    dom.grid.append(column);
  }

  function start(): void {
    fit();
    if (!reducedMotion.matches) requestAnimationFrame(skyLoop);
    showTrack = createTrack(dom.track, TRACK_WIDTH, true);
    buildPrintPages();
    const initial = hashState();
    go(initial.chapter, initial.step, { fromHash: true });
    requestAnimationFrame(() => requestAnimationFrame(() => dom.track.classList.add('live')));
    // Layout check of every step, for automated verification.
    (window as Window & { atlasCheck?: () => string[] }).atlasCheck = () => {
      const problems: string[] = [];
      const saved = { chapter, step };
      for (let index = -1; index < chapters.length; index++) {
        const count = index < 0 ? 1 : chapters[index].beats.length;
        for (let beat = 0; beat < count; beat++) {
          go(index, beat);
          finishTyping();
          const where = index < 0 ? 'вступление' : `${index + 1}.${beat + 1}`;
          const overflow = view?.overflow() ?? [];
          if (overflow.length) problems.push(`${where}: не помещается ${overflow.join(', ')}`);
          if (dom.headline.scrollWidth > dom.headline.clientWidth + 1) problems.push(`${where}: заголовок не помещается`);
          if (dom.summary.offsetHeight > 48) problems.push(`${where}: пояснение длиннее двух строк`);
          if (dom.result.offsetHeight > 72) problems.push(`${where}: итог длиннее трёх строк`);
          const drawing = view?.svg;
          if (drawing && Number(drawing.getAttribute('height')) > dom.diagram.clientHeight) problems.push(`${where}: схема ${drawing.getAttribute('height')} выше области ${dom.diagram.clientHeight}`);
        }
      }
      go(saved.chapter, saved.step);
      return problems;
    };
  }

  // Wrapping inside blocks relies on real font metrics, so wait for the faces in use.
  const faces = ['700 18px "PT Sans Caption"', '700 32px "PT Sans Caption"', '400 14px "PT Sans"', '700 12px "PT Sans"', 'italic 400 14px "PT Sans"'];
  const fonts = document.fonts
    ? Promise.race([Promise.all(faces.map(face => document.fonts.load(face))), new Promise(resolve => setTimeout(resolve, 1500))])
    : Promise.resolve();
  void fonts.catch(() => undefined).then(start);
}
