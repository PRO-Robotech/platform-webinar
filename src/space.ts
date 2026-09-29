interface Star {
  featured: boolean;
  x: number;
  y: number;
  z: number;
  speed: number;
  age: number;
  dust: boolean;
  size: number;
  alpha: number;
  color: string;
  ray: boolean;
  soft: boolean;
}

interface Meteor {
  age: number;
  duration: number;
  tail: number;
  peak: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function startSpace(): void {
  const element = document.getElementById('space-flight');
  if (!(element instanceof HTMLCanvasElement) || element.dataset.spaceFlightReady === '1') return;
  const canvas = element;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;
  const ctx = context;
  canvas.dataset.spaceFlightReady = '1';

  let motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stars: Star[] = [];
  let width = 1, height = 1, focal = 1;
  let centerX = 0, centerY = 0, frame = 0, last = 0, lastDraw = 0, time = 0;
  let interval = 1000 / 30, resizeFrame = 0;
  let colors = ['#c6d6f0', '#a9c6e9', '#a4d1cf', '#c9bfdf', '#d7c7b0'];
  let meteor: Meteor | null = null;
  let nextMeteor = random(4, 7);

  function random(a: number, b: number): number { return a + Math.random() * (b - a); }
  function smooth(a: number, b: number, x: number): number {
    let t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function updateMeteor(dt: number): void {
    if (meteor) {
      meteor.age += dt;
      if (meteor.age >= meteor.duration) meteor = null;
    }
    if (meteor || time < nextMeteor || motion.matches || document.hidden) return;
    let lane = Math.random();
    meteor = {
      x: 0, y: 0, dx: 0, dy: 0,
      age: 0, duration: random(1.2, 1.7), tail: random(55, 95), peak: random(0.35, 0.5)
    };
    if (lane < 0.5) {
      meteor.x = random(0.7, 0.94);
      meteor.y = random(0.015, 0.055);
      meteor.dx = -random(0.12, 0.2);
      meteor.dy = random(0.09, 0.14);
    } else {
      let right = lane < 0.8;
      meteor.x = right ? random(0.985, 1.015) : random(-0.015, 0.015);
      meteor.y = random(0.22, 0.43);
      meteor.dx = (right ? -1 : 1) * random(0.035, 0.065);
      meteor.dy = random(0.2, 0.29);
    }
    // Intervals are measured in visible animation time; never catch up in bursts.
    nextMeteor = time + random(10, 18);
  }
  function drawMeteor(): void {
    if (!meteor || motion.matches || document.hidden) return;
    let progress = Math.min(1, meteor.age / meteor.duration);
    let alpha = meteor.peak * smooth(0, 0.2, progress) * (1 - smooth(0.58, 1, progress));
    if (alpha < 0.002) return;
    let dx = meteor.dx * width, dy = meteor.dy * height;
    let length = Math.hypot(dx, dy) || 1;
    let x = meteor.x * width + dx * progress;
    let y = meteor.y * height + dy * progress;
    let tailX = x - dx / length * meteor.tail;
    let tailY = y - dy / length * meteor.tail;
    let trail = ctx.createLinearGradient(tailX, tailY, x, y);
    trail.addColorStop(0, 'rgba(159,194,239,0)');
    trail.addColorStop(0.35, 'rgba(179,210,246,0.18)');
    trail.addColorStop(0.8, 'rgba(205,228,255,0.7)');
    trail.addColorStop(1, 'rgba(228,241,255,1)');
    ctx.strokeStyle = trail;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(x, y);
    ctx.globalAlpha = alpha * 0.12;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.fillStyle = '#e4f1ff';
    ctx.beginPath();
    ctx.arc(x, y, 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  function project(star: Star): { x: number; y: number } {
    return {
      x: centerX + star.x * focal / star.z,
      y: centerY + star.y * focal / star.z
    };
  }
  function place(star: Star, initial: boolean): Star {
    // Recycled particles return at depth and fade in; no visible teleport.
    let near = initial && (star.featured || Math.random() < 0.16);
    star.z = near ? random(0.47, 0.74) : random(initial ? 0.78 : 1.35, 1.95);
    star.x = (random(-20, width + 20) - centerX) * star.z / focal;
    star.y = (random(-20, height + 20) - centerY) * star.z / focal;
    star.speed = random(0.0085, 0.0115);
    star.age = initial ? 8 : 0;
    star.dust = !star.featured && Math.random() < 0.52;
    star.size = star.featured ? random(0.98, 1.12) : star.dust ? random(0.29, 0.5) : random(0.52, 0.84);
    star.alpha = star.featured ? random(0.85, 0.98) : star.dust ? random(0.18, 0.3) : random(0.38, 0.67);
    star.color = colors[Math.random() < 0.72 ? (Math.random() < 0.65 ? 0 : 1) : Math.floor(random(2, 5))];
    star.ray = !star.dust && Math.random() < 0.27;
    if (star.featured) star.color = '#e2efff';
    star.soft = star.featured || (!star.dust && Math.random() < 0.08);
    return star;
  }

  function resize(): void {
    let positions = stars.map(function (star) {
      let point = project(star);
      return { x: point.x / width, y: point.y / height };
    });
    let rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || window.innerWidth);
    height = Math.max(1, rect.height || window.innerHeight);
    centerX = width * 0.56;
    centerY = height * 0.49;
    focal = Math.max(width, height) * 0.68;
    let dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars.forEach(function (star, i) {
      star.x = (positions[i].x * width - centerX) * star.z / focal;
      star.y = (positions[i].y * height - centerY) * star.z / focal;
    });
    let count = Math.max(280, Math.min(420, Math.round(280 + width * height / 18000)));
    while (stars.length < count) stars.push(place({
      featured: stars.length < 18, x: 0, y: 0, z: 1, speed: 0, age: 0,
      dust: false, size: 0, alpha: 0, color: colors[0], ray: false, soft: false
    }, true));
    if (stars.length > count) stars.length = count;
    draw();
  }

  function update(dt: number): void {
    time += dt;
    let drift = 0.85 + Math.sin(time / 22) * 0.18;
    let verticalDrift = Math.sin(time / 31) * 0.16;
    stars.forEach(function (star) {
      let before = project(star);
      let distance = Math.hypot(before.x - centerX, before.y - centerY);
      let radialSpeed = distance * star.speed / star.z;
      // Perspective gives the near layer more motion, capped at a calm 16 px/s.
      let rate = Math.min(1, 16 / Math.max(1, radialSpeed + drift));
      star.z -= star.speed * rate * dt;
      star.x += drift * star.z / focal * rate * dt;
      star.y += verticalDrift * star.z / focal * dt;
      star.age += dt;
      let point = project(star);
      if (star.z < 0.39 || point.x < -28 || point.x > width + 28 ||
          point.y < -28 || point.y > height + 28) place(star, false);
    });
    updateMeteor(dt);
  }

  function draw(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    stars.forEach(function (star) {
      let point = project(star);
      if (point.x < -8 || point.x > width + 8 || point.y < -8 || point.y > height + 8) return;
      let nx = (point.x - width * 0.5) / (width * 0.45);
      let ny = (point.y - height * 0.48) / (height * 0.43);
      let peripheral = 0.12 + 0.88 * smooth(0.3, 1.24, Math.hypot(nx, ny));
      let textQuiet = 0.36 + 0.64 * smooth(0.17, 0.38, point.y / height);
      let fade = smooth(0, 4.5, star.age) * smooth(0.39, 0.52, star.z);
      let alpha = star.alpha * peripheral * textQuiet * fade;
      let depth = Math.max(0, Math.min(1, (1.7 - star.z) / 1.2));
      let radius = Math.min(1.5, star.size * (0.77 + depth * 0.76));
      if (alpha < 0.008) return;

      if (star.ray) {
        let dx = point.x - centerX, dy = point.y - centerY;
        let length = Math.hypot(dx, dy) || 1;
        let ray = 1 + depth * 4;
        ctx.globalAlpha = alpha * 0.32;
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(point.x - dx / length * ray, point.y - dy / length * ray);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
      if (star.soft && depth > 0.55) {
        ctx.globalAlpha = alpha * 0.06;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    drawMeteor();
    ctx.globalAlpha = 1;
  }

  function tick(timestamp: number): void {
    frame = 0;
    if (document.hidden || motion.matches) return;
    if (!last) last = lastDraw = timestamp;
    let elapsed = timestamp - last;
    if (elapsed >= interval - 0.2) {
      last = timestamp;
      // A delayed frame or a resumed tab never catches up with a sudden jump.
      update(Math.min(0.1, (timestamp - lastDraw) / 1000));
      lastDraw = timestamp;
      draw();
    }
    frame = window.requestAnimationFrame(tick);
  }
  function synchronize(): void {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    last = lastDraw = 0;
    if (document.hidden) return;
    if (motion.matches) { meteor = null; draw(); }
    else frame = window.requestAnimationFrame(tick);
  }
  function onResize(): void {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(function () {
      resizeFrame = 0;
      resize();
    });
  }

  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', synchronize);
  if (motion.addEventListener) motion.addEventListener('change', synchronize);
  else motion.addListener(synchronize);
  window.addEventListener('pagehide', function () {
    if (frame) window.cancelAnimationFrame(frame);
    if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
    frame = resizeFrame = 0;
    last = lastDraw = 0;
  });
  window.addEventListener('pageshow', synchronize);
  resize();
  synchronize();
}
