import type { DiagramNode, Edge, TextLines, Tier } from '../types';
import type { createFlightContent } from './flight';

export type FlightContent = ReturnType<typeof createFlightContent>;
type Point = { x: number; y: number; z: number };
type Projected = Point & { scale: number };
type Camera = Point & { yaw: number; pitch: number; distance: number };
type Hit = { x: number; y: number; radius: number; index: number };
const TAU = Math.PI * 2;
const colors: Record<Tier, string> = { l0: '#77e8ef', l1: '#cdebab', l2: '#b9a0fb', external: '#f0bc75', actor: '#dce7ef' };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const plain = (value: TextLines) => Array.isArray(value) ? value.join(' ') : value;
const vec = (x: number, y: number, z = 0): Point => ({ x, y, z });
const minus = (a: Point, b: Point) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Point, b: Point) => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const normal = (p: Point) => { const length = Math.hypot(p.x, p.y, p.z) || 1; return vec(p.x / length, p.y / length, p.z / length); };
function rgba(hex: string, alpha: number) {
  const rgb = parseInt(hex.slice(1), 16);
  return `rgba(${rgb >> 16 & 255},${rgb >> 8 & 255},${rgb & 255},${clamp(alpha, 0, 1)})`;
}

/** Original flight-camera interaction around a graph supplied by the shared flow. */
export function createFlightMap(canvas: HTMLCanvasElement, content: FlightContent, callbacks: {
  onSelect(index: number): void;
  onMotion(): void;
}) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('The flight map requires Canvas 2D.');
  const ctx = context;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motion.matches;
  let width = 1, height = 1, dpr = 1, safeLeft = 0, safeTop = 100, safeBottom = 170, safeWidth = 1, safeHeight = 1, focal = 1;
  let current = -1, elapsed = 0, lastTime = 0, frame = 0, destroyed = false;
  const centers = content.stations.map((_, i) => vec((i - 3) * 1520, Math.sin(i * 1.1) * 450, Math.cos(i * .8) * 260));
  const camera: Camera = { ...centers[0], yaw: 0, pitch: .02, distance: 1600 };
  let target: Camera = { ...camera };
  let eye = vec(0, 0), right = vec(1, 0), cameraUp = vec(0, 1), forward = vec(0, 0, -1);
  let hits: Hit[] = [];
  let drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean; pan: boolean } | undefined;
  let seed = 317761;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 1300 }, () => ({ ...vec(random() * 26000 - 13000, random() * 11000 - 5500, random() * 13000 - 9000), size: .4 + random() * 1.3, alpha: .25 + random() * .7, previous: undefined as Projected | undefined }));
  const clouds = [ { ...vec(-4100, 1000, -2500), color: '#133f51' }, { ...vec(0, -650, -2300), color: '#271d51' }, { ...vec(4100, 700, -2200), color: '#114649' } ];
  const world = (chapter: number, x: number, y: number): Point => vec(centers[chapter].x + x - 600, centers[chapter].y + 210 - y, centers[chapter].z);

  function calculateBasis() {
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch), sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw);
    eye = vec(camera.x + sy * cp * camera.distance, camera.y + sp * camera.distance, camera.z + cy * cp * camera.distance);
    forward = normal(minus(vec(camera.x, camera.y, camera.z), eye));
    right = normal(cross(forward, vec(0, 1)));
    cameraUp = cross(right, forward);
  }
  function project(point: Point): Projected | undefined {
    const relative = minus(point, eye), z = dot(relative, forward);
    if (z < 30) return undefined;
    const scale = focal / z;
    return { x: safeLeft + safeWidth / 2 + dot(relative, right) * scale, y: safeTop + safeHeight / 2 - dot(relative, cameraUp) * scale, z, scale };
  }
  function glow(x: number, y: number, radius: number, color: string, alpha: number) {
    if (radius < 1) return;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(color, alpha)); gradient.addColorStop(.2, rgba(color, alpha * .45)); gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
  }
  function background() {
    ctx.fillStyle = '#04080e'; ctx.fillRect(0, 0, width, height);
    const base = ctx.createRadialGradient(safeLeft + safeWidth / 2, height / 2, 0, safeLeft + safeWidth / 2, height / 2, width * .75);
    base.addColorStop(0, '#081522'); base.addColorStop(1, '#03060b'); ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
    clouds.forEach(cloud => { const p = project(cloud); if (p) glow(p.x, p.y, clamp(2200 * p.scale, 100, 1000), cloud.color, .5); });
    stars.forEach(star => {
      const p = project(star);
      if (!p || p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) { star.previous = undefined; return; }
      const alpha = star.alpha * clamp(1 - p.z / 26000, .2, .85);
      const previous = star.previous;
      if (previous && !reduced) {
        const distance = Math.hypot(p.x - previous.x, p.y - previous.y);
        if (distance > 1 && distance < 120) { ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(p.x, p.y); ctx.strokeStyle = rgba('#a6e3ed', alpha * .3); ctx.lineWidth = .6; ctx.stroke(); }
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, clamp(star.size * (.7 + p.scale * .5), .35, 2.2), 0, TAU); ctx.fillStyle = rgba('#bedce9', alpha); ctx.fill(); star.previous = p;
    });
  }
  function stroke(points: Point[], color: string, alpha: number, thickness = 1, dashed = false) {
    const projected = points.map(project).filter((p): p is Projected => !!p);
    if (projected.length < 2) return projected;
    ctx.beginPath(); projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = thickness; ctx.setLineDash(dashed ? [5, 4] : []); ctx.shadowColor = rgba(color, .4); ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
    return projected;
  }
  function packet(points: Projected[], position: number, color: string) {
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const total = lengths.reduce((sum, value) => sum + value, 0); let distance = position * total;
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i]) { const fraction = distance / (lengths[i] || 1), a = points[i], b = points[i + 1], x = a.x + (b.x - a.x) * fraction, y = a.y + (b.y - a.y) * fraction; glow(x, y, 8, color, .4); ctx.fillStyle = '#eaffff'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); return; }
      distance -= lengths[i];
    }
  }
  function arrow(points: Projected[], color: string, alpha: number) {
    if (points.length < 2) return;
    const b = points[points.length - 1], a = points[points.length - 2], angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(angle - .42) * 7, b.y - Math.sin(angle - .42) * 7); ctx.lineTo(b.x - Math.cos(angle + .42) * 7, b.y - Math.sin(angle + .42) * 7); ctx.closePath(); ctx.fillStyle = rgba(color, alpha); ctx.fill();
  }
  function wrap(text: string, maxWidth: number): string[] {
    const lines: string[] = []; let line = '';
    text.split(/\s+/).forEach(word => { const next = line ? `${line} ${word}` : word; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next; });
    if (line) lines.push(line); return lines;
  }
  function overview() {
    const samples: Point[] = [];
    centers.forEach((center, i) => {
      if (!i) { samples.push(center); return; }
      const a = centers[i - 1];
      for (let j = 1; j <= 28; j++) { const t = j / 28, smooth = t * t * (3 - 2 * t); samples.push(vec(a.x + (center.x - a.x) * t, a.y + (center.y - a.y) * smooth, a.z + (center.z - a.z) * smooth)); }
    });
    const route = stroke(samples, colors.l0, .65, 1.2);
    if (route.length) for (let i = 0; i < 4; i++) packet(route, (elapsed * .025 + i / 4) % 1, colors.l0);
    centers.forEach((center, index) => {
      const p = project(center); if (!p) return;
      const color = index >= 5 ? colors.l2 : index === 2 ? colors.external : colors.l0;
      glow(p.x, p.y, 50, color, .35); ctx.strokeStyle = rgba(color, .7); ctx.lineWidth = 1;
      [6, 15, 23].forEach(radius => { ctx.beginPath(); ctx.ellipse(p.x, p.y, radius, radius * (radius === 23 ? .45 : 1), -.25, 0, TAU); ctx.stroke(); });
      ctx.fillStyle = '#f0fcff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill();
      ctx.font = '500 12px Inter,system-ui,sans-serif'; ctx.textAlign = 'center';
      const label = wrap(content.stations[index].title, Math.max(95, safeWidth / 7 - 5));
      label.forEach((line, lineIndex) => { ctx.fillStyle = '#c8e0e9'; ctx.fillText(line, p.x, p.y + 42 + lineIndex * 16); });
      ctx.fillStyle = rgba(color, .8); ctx.font = '9px ui-monospace,monospace'; ctx.fillText(String(index + 1).padStart(2, '0'), p.x, p.y - 34);
      hits.push({ x: p.x, y: p.y, radius: 34, index: content.stations[index].start });
    });
  }
  function edgePoints(edge: Edge, chapter: number) {
    const tokens = edge.path.match(/[MHV]|-?\d+(?:\.\d+)?/g) || [];
    const points: Point[] = []; let x = 0, y = 0, command = '';
    for (let i = 0; i < tokens.length;) {
      if (/^[MHV]$/.test(tokens[i])) command = tokens[i++];
      if (command === 'M') { x = Number(tokens[i++]); y = Number(tokens[i++]); }
      else if (command === 'H') x = Number(tokens[i++]);
      else if (command === 'V') y = Number(tokens[i++]);
      else throw new Error(`Unsupported flight path: ${edge.path}`);
      points.push(world(chapter, x, y));
    }
    return points;
  }
  function node(original: DiagramNode, chapter: number, step: number, active: Set<string>) {
    const node = original.variants?.filter(v => v.at <= step).reduce<DiagramNode>((current, v) => ({ ...current, ...v }), original) ?? original;
    const p = project(world(chapter, node.x + node.w / 2, node.y + node.h / 2)); if (!p) return;
    const color = colors[node.tier], hot = active.has(node.id), scale = p.scale;
    const w = node.w * scale, h = node.h * scale, x = p.x - w / 2, y = p.y - h / 2;
    glow(p.x, p.y, Math.max(w, h) * .75, color, hot ? .07 : .015);
    ctx.fillStyle = hot ? 'rgba(9,26,38,.95)' : 'rgba(6,16,28,.91)'; ctx.strokeStyle = rgba(color, hot ? .78 : .26); ctx.lineWidth = hot ? 1.1 : .7;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
    const corner = Math.min(9, w / 8); ctx.strokeStyle = rgba(color, hot ? 1 : .65); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y); ctx.moveTo(x + w - corner, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - corner); ctx.stroke();
    const compact = h < 46;
    const font = clamp(19 * scale, 10, 17), line = font * 1.22;
    ctx.font = `500 ${font}px Inter,system-ui,sans-serif`; ctx.textAlign = 'center';
    const titles = wrap(plain(node.title), w - 14);
    const subFont = clamp(12 * scale, 8, 11), subLine = subFont * 1.3;
    ctx.font = `${subFont}px Inter,system-ui,sans-serif`;
    const sourceSub = Array.isArray(node.sub) ? node.sub : [node.sub];
    const descriptions = sourceSub.flatMap(value => wrap(value, w - 16));
    const badges = (node.badges || []).filter(badge => badge.at <= step);
    const badgeHeight = badges.length ? 11 : 0;
    const titleHeight = titles.length * line;
    const showSub = !compact && h >= titleHeight + descriptions.length * subLine + badgeHeight + 19 && descriptions.length > 0;
    const baseY = p.y - (titleHeight + (showSub ? descriptions.length * subLine + badgeHeight + 3 : 0)) / 2 + font * .8 + (compact ? 0 : 5);
    ctx.font = `500 ${font}px Inter,system-ui,sans-serif`;
    titles.forEach((title, index) => { ctx.fillStyle = hot ? '#eaffff' : '#c1d5df'; ctx.fillText(title, p.x, baseY + index * line); });
    if (showSub) {
      ctx.font = `${subFont}px Inter,system-ui,sans-serif`; ctx.fillStyle = rgba(color, .85);
      descriptions.forEach((description, index) => ctx.fillText(description, p.x, baseY + titleHeight + 2 + index * subLine));
      if (badges.length) { ctx.font = '7px ui-monospace,monospace'; ctx.fillStyle = '#d6beff'; ctx.fillText(badges.map(badge => badge.label).join(' · '), p.x, y + h - 6); }
    }
    if (!compact) {
      ctx.font = `${clamp(10 * scale, 7, 9)}px ui-monospace,monospace`; ctx.fillStyle = rgba(color, .7); ctx.textAlign = 'left';
      const tier = node.tier === 'external' ? 'EXTERNAL' : node.tier === 'actor' ? 'ЗАКАЗЧИК' : node.tier.toUpperCase();
      ctx.fillText(tier + (node.phase ? ' · ФАЗА ' + node.phase : ''), x + 7, y + 10);
      if (node.readyAt !== undefined && node.readyAt <= step) { ctx.textAlign = 'right'; ctx.fillStyle = colors.l1; ctx.fillText('✓', x + w - 7, y + 10); }
    }
  }
  function graph() {
    const scene = content.scenes[current], chapter = content.chapters[scene.chapter], active = new Set(chapter.beats[scene.step].active ?? []);
    const visible = new Set(chapter.nodes.filter(node => node.at <= scene.step).map(node => node.id));
    chapter.zones.filter(zone => (zone.at || 0) <= scene.step).forEach(zone => {
      const p = project(world(scene.chapter, zone.x, zone.y)), q = project(world(scene.chapter, zone.x + zone.w, zone.y + zone.h)); if (!p || !q) return;
      ctx.strokeStyle = rgba(colors[zone.tier], .15); ctx.lineWidth = .65; ctx.setLineDash([2, 7]); ctx.strokeRect(p.x, p.y, q.x - p.x, q.y - p.y); ctx.setLineDash([]);
      ctx.fillStyle = rgba(colors[zone.tier], .64); ctx.font = '8px ui-monospace,monospace'; ctx.textAlign = 'left'; ctx.fillText(zone.label, p.x + 9, p.y + 12);
    });
    chapter.edges.filter(edge => edge.at <= scene.step && visible.has(edge.from) && visible.has(edge.to)).forEach(edge => {
      const hot = edge.at === scene.step || active.has(edge.from) && active.has(edge.to);
      const color = edge.kind === 'status' ? colors.l2 : edge.kind === 'link' ? '#a3c3ce' : colors.l0;
      const points = stroke(edgePoints(edge, scene.chapter), color, hot ? .92 : .39, hot ? 1.5 : .85, edge.kind === 'status');
      arrow(points, color, hot ? 1 : .65);
      if (hot && points.length > 1 && !reduced) packet(points, (elapsed * .17 + .15) % 1, color);
      if (edge.label && edge.lx !== undefined && edge.ly !== undefined) {
        const label = project(world(scene.chapter, edge.lx, edge.ly));
        if (label) {
          ctx.font = '8px ui-monospace,monospace'; const labelWidth = ctx.measureText(edge.label).width;
          ctx.fillStyle = 'rgba(5,13,23,.95)'; ctx.fillRect(label.x - labelWidth / 2 - 4, label.y - 6, labelWidth + 8, 12);
          ctx.fillStyle = rgba(color, hot ? .95 : .67); ctx.textAlign = 'center'; ctx.fillText(edge.label, label.x, label.y + 3);
        }
      }
    });
    chapter.nodes.filter(n => n.at <= scene.step).forEach(n => node(n, scene.chapter, scene.step, active));
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); calculateBasis(); background(); hits = [];
    if (current < 0) overview(); else graph();
  }
  function tick(now: number) {
    frame = 0; if (destroyed || document.hidden) return;
    const dt = clamp((now - (lastTime || now - 16.7)) / 1000, .001, .04); lastTime = now; if (!reduced) elapsed += dt;
    const amount = reduced ? 1 : 1 - Math.exp(-6 * dt);
    (Object.keys(camera) as (keyof Camera)[]).forEach(key => { camera[key] += (target[key] - camera[key]) * amount; });
    draw();
    if (!reduced) frame = requestAnimationFrame(tick);
  }
  function invalidate() { if (!destroyed && !frame) frame = requestAnimationFrame(tick); }
  function goal(immediate = false) {
    if (current < 0) target = { x: 0, y: 0, z: 0, yaw: -.025, pitch: .10, distance: Math.max(9800 * focal / safeWidth, 1700 * focal / safeHeight) };
    else { const scene = content.scenes[current]; target = { ...centers[scene.chapter], yaw: 0, pitch: .015, distance: Math.max(1290 * focal / safeWidth, 515 * focal / safeHeight) }; }
    if (immediate || reduced) Object.assign(camera, target);
    invalidate();
  }
  function setScene(index: number, options: { immediate?: boolean } = {}) { current = clamp(index, 0, content.scenes.length - 1); goal(!!options.immediate); }
  function showOverview(options: { immediate?: boolean } = {}) { current = -1; goal(!!options.immediate); }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    safeLeft = width >= 1100 ? Math.min(405, width * .33) : width >= 861 ? Math.min(345, width * .36) : 28;
    safeTop = width > 860 ? 138 : Math.min(height * .52, 470); safeBottom = width > 860 ? 185 : 145;
    safeWidth = Math.max(220, width - safeLeft - 40); safeHeight = Math.max(180, height - safeTop - safeBottom); focal = Math.min(width, height) * 1.03;
    goal(true);
  }
  function position(event: PointerEvent) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function down(event: PointerEvent) { if (![0, 2].includes(event.button)) return; const p = position(event); drag = { id: event.pointerId, ...p, startX: p.x, startY: p.y, moved: false, pan: event.shiftKey || event.button === 2 }; canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; }
  function move(event: PointerEvent) {
    const p = position(event);
    if (drag?.id === event.pointerId) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4) drag.moved = true;
      if (drag.moved) { if (drag.pan) { target.x -= dx * target.distance / focal; target.y += dy * target.distance / focal; } else { target.yaw -= dx * .003; target.pitch = clamp(target.pitch + dy * .003, -.8, .9); } callbacks.onMotion(); if (reduced) Object.assign(camera, target); invalidate(); }
      drag.x = p.x; drag.y = p.y;
    } else canvas.style.cursor = hits.some(hit => Math.hypot(hit.x - p.x, hit.y - p.y) < hit.radius) ? 'pointer' : 'grab';
  }
  function up(event: PointerEvent) { if (drag?.id !== event.pointerId) return; const previous = drag; drag = undefined; canvas.releasePointerCapture(event.pointerId); canvas.style.cursor = 'grab'; if (!previous.moved) { const p = position(event), hit = hits.find(hit => Math.hypot(hit.x - p.x, hit.y - p.y) < hit.radius); if (hit) callbacks.onSelect(hit.index); } }
  function cancel() { drag = undefined; canvas.style.cursor = 'grab'; }
  function wheel(event: WheelEvent) { event.preventDefault(); target.distance = clamp(target.distance * Math.exp(clamp(event.deltaY, -200, 200) * .0014), 400, 30000); callbacks.onMotion(); if (reduced) Object.assign(camera, target); invalidate(); }
  function contextmenu(event: MouseEvent) { event.preventDefault(); }
  function visibility() { lastTime = 0; if (!document.hidden) invalidate(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } }
  function preference() { reduced = motion.matches; if (reduced) Object.assign(camera, target); invalidate(); }
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('contextmenu', contextmenu);
  document.addEventListener('visibilitychange', visibility); motion.addEventListener('change', preference);
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {
    setScene, overview: showOverview,
    destroy() { destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', contextmenu); document.removeEventListener('visibilitychange', visibility); motion.removeEventListener('change', preference); },
  };
}
