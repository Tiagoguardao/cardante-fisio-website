/* Cardante · Opção A, página Máquinas (extraída da Opção D) — história em scroll com um único canvas fixo.
   Cada capítulo ([data-model]) mostra a sua máquina no plinto; os modelos carregam à medida que se aproximam. */

const html = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqWide = matchMedia('(min-width: 900px)');
let reduced = mqReduce.matches;

/* ---------- revelação dos cartões (funciona com ou sem 3D) ---------- */
(function reveal() {
  if (!('IntersectionObserver' in window)) return;
  html.classList.add('reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  $$('.chapter .card').forEach((c) => io.observe(c));
})();

function fallback(reason) {
  console.warn('[Cardante · Máquinas] 3D indisponível; a mostrar a versão estática.', reason || '');
  html.classList.remove('gl', 'exploring', 'stage-off');
  html.classList.add('no-gl');
}

if (html.classList.contains('gl')) {
  boot().catch((err) => fallback(err));
}

async function boot() {
  const [{ createStage, loadExhibit, fitDistance, THREE }, { OrbitControls }] = await Promise.all([
    import('./stage.js'),
    import('three/addons/controls/OrbitControls.js')
  ]);

  const canvas = $('#stage');
  const stage = createStage(canvas);
  const { renderer, scene, camera } = stage;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallback('contexto WebGL perdido'); });

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.enablePan = false;
  controls.enableZoom = false; // a roda do rato continua a fazer scroll na página
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.55;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // nunca abaixo do plinto
  controls.target.set(0, 0.7, 0);

  const backdrop = $('.backdrop');
  const loaderEl = $('#loader');
  const loaderPct = $('.loader-pct', loaderEl);
  const hint = $('#stage-hint');
  const bar = $('#explore-bar');
  const barTitle = $('#explore-title');
  const railLinks = $$('.rail a');
  const endSection = $('#todos');
  const deg = THREE.MathUtils.degToRad;

  const chapters = $$('[data-model]').map((el, i) => {
    const cs = getComputedStyle(el);
    return {
      el, i,
      id: el.id,
      model: el.dataset.model,
      name: el.dataset.name || ($('h2', el) || {}).textContent || '',
      view: JSON.parse(el.dataset.view || '{}'),
      load: JSON.parse(el.dataset.load || '{}'),
      hotspots: JSON.parse(el.dataset.hotspots || '[]'),
      tint: ['--c1', '--c2', '--cp'].map((v) => cs.getPropertyValue(v).trim()),
      hs: [],
      anchors: null
    };
  });

  /* ---------- exposições (uma por modelo) ---------- */
  const exhibits = new Map();
  function want(ch) {
    if (!ch) return null;
    let rec = exhibits.get(ch.model);
    if (rec) return rec;
    rec = { ex: null, failed: false, progress: 0, p: 0, from: 0, to: 0, t0: 0, dur: 1, entering: false, spin: 0, sway: 0, gain: reduced ? 0 : 1 };
    exhibits.set(ch.model, rec);
    rec.promise = loadExhibit(stage, ch.model, {
      ...ch.load,
      onProgress: (e) => { if (e.lengthComputable && e.total) rec.progress = e.loaded / e.total; updateLoader(); }
    }).then(async (ex) => {
      ex.root.visible = false;
      ex.setFade(0);
      scene.add(ex.root);
      try { await renderer.compileAsync(ex.root, camera, scene); } catch (_) { /* compila no primeiro frame */ }
      rec.ex = ex;
      chapters.filter((c) => c.model === ch.model).forEach((c) => c.el.setAttribute('data-ready', ''));
      if (active && active.model === ch.model) { enter(active); goalFor(active, false); }
      updateLoader();
      return ex;
    }).catch((err) => {
      rec.failed = true;
      console.warn('[Cardante · Máquinas] Não foi possível carregar', ch.model, err);
      chapters.filter((c) => c.model === ch.model).forEach((c) => c.el.classList.add('is-fallback'));
      updateLoader();
    });
    return rec;
  }

  function play(rec, to, dur, delay = 0) {
    rec.from = rec.p; rec.to = to; rec.t0 = performance.now() + delay * 1000; rec.dur = Math.max(1, dur * 1000);
  }
  function enter(ch) {
    const rec = exhibits.get(ch.model);
    if (!rec || !rec.ex) return;
    rec.ex.setTint(ch.tint[2] || '#f3f6f8');
    if (rec.to === 1 && rec.p > 0) return; // já está (ou está a entrar)
    rec.entering = true;
    rec.spin = reduced ? 0 : -0.95;
    play(rec, 1, reduced ? 0.35 : 1.35, reduced ? 0 : 0.28);
  }
  function leave(model) {
    const rec = exhibits.get(model);
    if (!rec || !rec.ex || rec.to === 0) return;
    rec.entering = false;
    play(rec, 0, reduced ? 0.25 : 0.5);
  }

  /* ---------- layout do palco (onde fica o modelo no ecrã) ---------- */
  const L = { W: 1, H: 1, cx: 0, cy: 0, rpx: 100, tcx: 0, tcy: 0, trpx: 100, init: false };
  function slotHeight() {
    const el = (active && $('.slot', active.el)) || $('.chapter:not(.hero) .slot');
    return el ? el.getBoundingClientRect().height : L.H * 0.6;
  }
  function measure() {
    const W = canvas.clientWidth || innerWidth;
    const H = canvas.clientHeight || innerHeight;
    if (W !== L.W || H !== L.H) {
      renderer.setSize(W, H, false);
      L.W = W; L.H = H;
    }
    layoutTarget();
  }
  function layoutTarget() {
    const { W, H } = L;
    const headH = mqWide.matches ? 72 : 66; // altura do cabeçalho .top da Opção A
    if (exploring) {
      const barH = mqWide.matches ? 96 : 150;
      L.tcx = W / 2;
      L.tcy = headH * 0.4 + (H - barH - headH * 0.4) / 2;
      L.trpx = Math.min(W * 0.9, H - barH - 120) / 2;
    } else if (mqWide.matches) {
      const left = Math.min(Math.max(W * 0.44, 420), W * 0.52);
      const regionW = W - left - (W >= 1100 ? 90 : 20); // deixa espaço para o índice lateral
      L.tcx = left + regionW * 0.5;
      L.tcy = headH + (H - headH - 64) * 0.5;
      L.trpx = Math.min(regionW * 0.8, H - headH - 150) / 2;
    } else {
      L.tcx = W / 2;
      const top = headH + 6, bottom = Math.max(top + 200, slotHeight() - 52);
      L.tcy = (top + bottom) / 2;
      L.trpx = Math.min(W - 40, bottom - top) / 2;
    }
    if (!L.init) { L.cx = L.tcx; L.cy = L.tcy; L.rpx = L.trpx; L.init = true; }
    html.style.setProperty('--cx', L.tcx + 'px');
    html.style.setProperty('--cy', L.tcy + 'px');
    html.style.setProperty('--hint-x', L.tcx + 'px');
  }
  function applyView() {
    const { W, H } = L;
    camera.setViewOffset(W, H, W / 2 - L.cx, H / 2 - L.cy, W, H);
  }

  /* ---------- câmara: objetivo + transição suave ---------- */
  const goal = { theta: 0.5, phi: 1.35, radius: 6, ty: 0.7 };
  let easing = false, dragging = false, lastTouch = -1e9, userZoom = 1;
  const sph = new THREE.Spherical();
  const tmpV = new THREE.Vector3();

  function baseRadius(ch) {
    const rec = exhibits.get(ch.model);
    const ex = rec && rec.ex;
    const R = Math.max(1, ex ? ex.plinthR : 1) * (ch.view.zoom || 1);
    return fitDistance(camera, R, L.trpx, L.H);
  }
  function goalFor(ch, keepAngle) {
    if (!ch) return;
    const rec = exhibits.get(ch.model);
    const ex = rec && rec.ex;
    if (keepAngle) {
      sph.setFromVector3(tmpV.copy(camera.position).sub(controls.target));
      goal.theta = sph.theta; goal.phi = sph.phi;
    } else {
      goal.theta = deg(ch.view.az ?? 28);
      goal.phi = Math.PI / 2 - deg(ch.view.el ?? 10);
    }
    goal.ty = (ex ? ex.height : 1.2) * (ch.view.ty ?? 0.5);
    goal.radius = baseRadius(ch) * userZoom;
    startEase();
  }
  function startEase() {
    easing = true;
    controls.minDistance = 0; controls.maxDistance = Infinity;
  }
  function settle() {
    easing = false;
    if (!active) return;
    const b = baseRadius(active);
    controls.minDistance = b * (exploring ? 0.55 : 0.8);
    controls.maxDistance = b * (exploring ? 1.35 : 1.15);
  }
  const wrapPI = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function stepCamera(dt) {
    if (!easing || dragging) return;
    sph.setFromVector3(tmpV.copy(camera.position).sub(controls.target));
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.8);
    const dT = wrapPI(goal.theta - sph.theta), dP = goal.phi - sph.phi, dR = goal.radius - sph.radius, dY = goal.ty - controls.target.y;
    sph.theta += dT * k; sph.phi += dP * k; sph.radius += dR * k;
    controls.target.y += dY * k;
    camera.position.copy(controls.target).add(tmpV.setFromSpherical(sph));
    if (Math.abs(dT) < 0.002 && Math.abs(dP) < 0.002 && Math.abs(dR) < 0.004 * goal.radius && Math.abs(dY) < 0.002) settle();
  }

  controls.addEventListener('start', () => {
    dragging = true; easing = false; lastTouch = performance.now();
    html.classList.add('dragging');
    hint && hint.classList.add('is-hidden');
  });
  controls.addEventListener('end', () => {
    dragging = false; lastTouch = performance.now();
    html.classList.remove('dragging');
    if (active) { const b = baseRadius(active); controls.minDistance = b * (exploring ? 0.55 : 0.8); controls.maxDistance = b * (exploring ? 1.35 : 1.15); }
  });

  /* ---------- capítulo ativo ---------- */
  let active = null;
  let exploring = null;
  function pickActive() {
    const H = innerHeight;
    const line = mqWide.matches ? H * 0.5 : H * 0.8;
    let cur = null;
    for (const ch of chapters) if (ch.el.getBoundingClientRect().top < line) cur = ch;
    if (endSection && endSection.getBoundingClientRect().top < H * 0.62) cur = null;
    return cur;
  }
  function setActive(ch) {
    if (ch === active) return;
    const prev = active;
    active = ch;
    if (prev) prev.el.classList.remove('is-active');
    html.dataset.active = ch ? ch.id : '';
    railLinks.forEach((a) => {
      const on = ch && a.getAttribute('href') === '#' + ch.id;
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    if (prev && (!ch || prev.model !== ch.model)) leave(prev.model);
    if (!ch) {
      html.classList.add('stage-off');
      backdrop.style.setProperty('--bg1', '#eef3f6');
      backdrop.style.setProperty('--bg2', '#dde7ee');
      html.style.setProperty('--band-t', '#eef3f6');
      html.style.setProperty('--band-b', '#dde7ee');
      updateLoader();
      return;
    }
    html.classList.remove('stage-off');
    ch.el.classList.add('is-active');
    backdrop.style.setProperty('--bg1', ch.tint[0]);
    backdrop.style.setProperty('--bg2', ch.tint[1]);
    // véus do cabeçalho e das redes sociais na mesma cor do fundo
    html.style.setProperty('--band-t', ch.tint[0]);
    html.style.setProperty('--band-b', ch.tint[1]);
    userZoom = 1;
    if (!mqWide.matches) layoutTarget();
    const rec = want(ch);
    if (rec.ex) enter(ch);
    goalFor(ch, false);
    buildHotspots(ch);
    want(chapters[ch.i + 1]); // pré-carrega o seguinte
    updateLoader();
  }

  function updateLoader() {
    const rec = active && exhibits.get(active.model);
    const show = !!(rec && !rec.ex && !rec.failed);
    loaderEl.hidden = !show;
    if (show) loaderPct.textContent = rec.progress > 0 ? ' · ' + Math.round(rec.progress * 100) + '%' : '…';
  }

  // carregamento preguiçoso: quando um capítulo se aproxima do ecrã
  const near = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { const ch = chapters.find((c) => c.el === e.target); want(ch); near.unobserve(e.target); } });
  }, { rootMargin: '120% 0px 120% 0px' });
  chapters.forEach((c) => near.observe(c.el));

  /* ---------- anotações ---------- */
  function buildHotspots(ch) {
    if (ch.hs.length || !ch.hotspots.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'hotspots';
    ch.hotspots.forEach((h) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hs is-hidden';
      b.setAttribute('aria-expanded', 'false');
      const dot = document.createElement('span'); dot.className = 'hs-dot'; dot.setAttribute('aria-hidden', 'true');
      const txt = document.createElement('span'); txt.className = 'hs-text';
      const t = document.createElement('strong'); t.textContent = h.t;
      const d = document.createElement('span'); d.textContent = h.d;
      txt.append(t, d); b.append(dot, txt);
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        ch.hs.forEach((o) => o.setAttribute('aria-expanded', 'false'));
        b.setAttribute('aria-expanded', String(open));
      });
      wrap.appendChild(b);
      ch.hs.push(b);
    });
    ch.el.appendChild(wrap);
  }
  const vA = new THREE.Vector3(), vN = new THREE.Vector3(), vC = new THREE.Vector3();
  function stepHotspots() {
    if (!active || !active.hs.length) return;
    const rec = exhibits.get(active.model);
    if (!rec || !rec.ex) return;
    const ex = rec.ex;
    if (!active.anchors) active.anchors = active.hotspots.map((h) => ex.anchor(h.p, h.n));
    const showAll = mqWide.matches || exploring;
    const presence = THREE.MathUtils.clamp((rec.p - 0.82) / 0.18, 0, 1) * (rec.to === 1 ? 1 : 0);
    active.anchors.forEach((a, k) => {
      const el = active.hs[k];
      vA.copy(a.point); ex.model.localToWorld(vA);
      vN.copy(a.normal).transformDirection(ex.model.matrixWorld);
      const facing = vN.dot(vC.copy(camera.position).sub(vA).normalize());
      vA.project(camera);
      const x = (vA.x + 1) / 2 * L.W, y = (1 - vA.y) / 2 * L.H;
      let o = THREE.MathUtils.clamp((facing - 0.08) / 0.22, 0, 1) * presence;
      if (!showAll || x < 8 || x > L.W - 8 || y < 70 || y > L.H - 20) o = 0;
      const flip = x + 200 > (mqWide.matches && !exploring ? L.W - 100 : L.W - 8);
      if (flip !== el.classList.contains('flip')) el.classList.toggle('flip', flip);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` + (flip ? ' translateX(-100%)' : '');
      el.style.opacity = o.toFixed(3);
      const hidden = o < 0.05;
      if (hidden !== el.classList.contains('is-hidden')) el.classList.toggle('is-hidden', hidden);
    });
  }

  /* ---------- explorar (ecrã inteiro, zoom e toque ativos) ---------- */
  let opener = null;
  function enterExplore(ch, btn) {
    if (!ch) return;
    const rec = exhibits.get(ch.model);
    if (rec && rec.failed) return;
    opener = btn || null;
    if (active !== ch) {
      ch.el.scrollIntoView({ block: 'start', behavior: 'instant' });
      setActive(ch);
    }
    exploring = ch;
    html.classList.add('exploring');
    controls.enableZoom = true;
    barTitle.textContent = ch.name;
    bar.setAttribute('aria-label', ch.name + ': explorar em 3D');
    bar.hidden = false;
    layoutTarget();
    goalFor(ch, true);
    requestAnimationFrame(() => $('[data-act="close"]', bar).focus({ preventScroll: true }));
  }
  function exitExplore() {
    if (!exploring) return;
    const ch = exploring;
    exploring = null;
    html.classList.remove('exploring');
    controls.enableZoom = false;
    bar.hidden = true;
    userZoom = 1;
    layoutTarget();
    goalFor(ch, false);
    ch.hs.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    onScroll();
  }

  function act(name, ch) {
    const target = ch || active;
    if (!target || target !== active) return;
    lastTouch = performance.now();
    if (name === 'left' || name === 'right') {
      goalFor(target, true);
      goal.theta += (name === 'left' ? -1 : 1) * Math.PI / 4;
    } else if (name === 'in' || name === 'out') {
      userZoom = THREE.MathUtils.clamp(userZoom * (name === 'in' ? 0.84 : 1.18), 0.58, 1.3);
      goalFor(target, true);
    } else if (name === 'reset') {
      userZoom = 1;
      goalFor(target, false);
    } else if (name === 'close') {
      exitExplore();
    }
  }

  document.addEventListener('click', (e) => {
    const ex = e.target.closest('[data-explore]');
    if (ex) { enterExplore(chapters.find((c) => c.el.contains(ex)), ex); return; }
    const a = e.target.closest('[data-act]');
    if (a) {
      const ch = chapters.find((c) => c.el.contains(a));
      if (ch && ch !== active) { ch.el.scrollIntoView({ block: 'start' }); return; }
      act(a.dataset.act, ch);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!exploring) return;
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); exitExplore(); return; }
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const map = { ArrowLeft: 'left', ArrowRight: 'right', '+': 'in', '=': 'in', '-': 'out', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[k] && !(e.target.closest && e.target.closest('.hs') && (k === 'Enter' || k === ' '))) {
      e.preventDefault();
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        goalFor(exploring, true);
        goal.phi = THREE.MathUtils.clamp(goal.phi + (k === 'ArrowUp' ? 0.18 : -0.18), controls.minPolarAngle, controls.maxPolarAngle);
      } else act(map[k], exploring);
    } else if ([' ', 'PageDown', 'PageUp', 'Home', 'End'].includes(k) && !(e.target.closest && e.target.closest('button, a'))) {
      e.preventDefault(); // não deixa a página fazer scroll por baixo
    }
  });

  /* ---------- scroll + redimensionamento ---------- */
  let scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      if (!exploring) setActive(pickActive());
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  let resizeT = 0, lastW = innerWidth;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      // em iOS a barra de endereço muda só a altura: ignoramos pequenas variações
      const dw = Math.abs(innerWidth - lastW);
      lastW = innerWidth;
      measure();
      if (active && (dw > 0 || !easing)) goalFor(active, true);
      onScroll();
    }, 120);
  });
  mqReduce.addEventListener && mqReduce.addEventListener('change', (e) => { reduced = e.matches; });

  /* ---------- ciclo de desenho ---------- */
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  let last = performance.now();
  let firstFrame = true;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // layout (transição ao entrar/sair do modo explorar)
    const kL = reduced ? 1 : 1 - Math.exp(-dt * 6);
    L.cx += (L.tcx - L.cx) * kL; L.cy += (L.tcy - L.cy) * kL; L.rpx += (L.trpx - L.rpx) * kL;
    applyView();

    let anyVisible = false;
    const idle = now - lastTouch > 4500 && !dragging;
    exhibits.forEach((rec) => {
      const ex = rec.ex;
      if (!ex) return;
      if (now >= rec.t0 && rec.p !== rec.to) {
        const t = Math.min(1, (now - rec.t0) / rec.dur);
        rec.p = rec.from + (rec.to - rec.from) * (rec.to === 1 ? easeOut(t) : easeInOut(t));
        if (t >= 1) rec.p = rec.to;
      }
      const p = rec.p;
      ex.root.visible = p > 0.002;
      if (!ex.root.visible) return;
      anyVisible = true;
      const motion = reduced ? 0 : 1;
      ex.root.position.y = -(1 - p) * (rec.entering ? 0.28 : 0.12) * motion;
      ex.root.scale.setScalar(1 - (1 - p) * 0.06 * motion);
      ex.setFade(p);
      if (ex.clip) ex.clip.constant = -ex.root.position.y + 0.0004;
      // rotação: entrada em espiral + balanço lento (pára enquanto o utilizador roda)
      rec.gain += ((idle && !reduced ? 1 : 0) - rec.gain) * (1 - Math.exp(-dt * 1.2));
      if (!reduced) rec.sway += dt * (Math.PI * 2 / 22);
      const spin = rec.entering ? rec.spin * (1 - easeOut(Math.min(1, Math.max(0, p)))) : 0;
      ex.turntable.rotation.y = spin + rec.gain * 0.6 * Math.sin(rec.sway);
    });

    stepCamera(dt);
    controls.update();
    stepHotspots();

    if (anyVisible || firstFrame) {
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; html.dataset.stage = 'ready'; }
    }
    // sinal para testes: capítulo ativo pronto e assente
    if (active) {
      const rec = exhibits.get(active.model);
      const ok = rec && rec.ex && rec.p >= 0.999 && !easing;
      if (ok !== active.el.hasAttribute('data-settled')) active.el.toggleAttribute('data-settled', ok);
    }
  }

  measure();
  setActive(pickActive());
  if (active) {
    // primeira câmara já no sítio certo, sem viagem
    sph.set(goal.radius, goal.phi, goal.theta);
    controls.target.set(0, goal.ty, 0);
    camera.position.copy(controls.target).add(tmpV.setFromSpherical(sph));
  }
  requestAnimationFrame(frame);
}
