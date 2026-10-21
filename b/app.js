const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const chapters = [...document.querySelectorAll('[data-chapter]')];
const atlas = document.querySelector('#atlas');
const scene = document.querySelector('#scene');
const label = document.querySelector('#view-label');
const labels = {
  inicio: 'FIG. 01 / O CORPO INTEIRO', cervical: 'FIG. 02 / CERVICAL', ombros: 'FIG. 03 / OMBROS',
  coluna: 'FIG. 04 / COLUNA E LOMBAR', pelvis: 'FIG. 05 / ANCA E PÉLVIS', pernas: 'FIG. 06 / JOELHO E TORNOZELO',
  linfa: 'FIG. 07 / SISTEMA LINFÁTICO', 'bem-estar': 'FIG. 08 / CORPO E MENTE'
};
let active = '', model, framePending = false, paused = mediaMotion.matches;
let anatomy = false;
const motionButton = document.querySelector('#motion-toggle');
function updateMotionButton() {
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', paused ? 'Ativar movimento' : 'Pausar movimento');
  motionButton.title = paused ? 'Ativar movimento' : 'Pausar movimento';
  motionButton.firstElementChild.textContent = paused ? '▷' : 'Ⅱ';
}
function updateChapter() {
  framePending = false;
  const mobile = innerWidth <= 800;
  const anchor = mobile ? 120 : innerHeight * .45;
  let current = chapters[0];
  for (const chapter of chapters) if (chapter.getBoundingClientRect().top <= anchor) current = chapter;
  const hidden = atlas.getBoundingClientRect().bottom < innerHeight * .35;
  document.body.classList.toggle('stage-hidden', hidden);
  model?.setVisible(!hidden && !document.hidden);
  const id = current.dataset.chapter;
  if (active === id) return;
  active = id;
  document.body.classList.toggle('hero-active', id === 'inicio');
  document.body.classList.toggle('chapter-focused', id !== 'inicio' && id !== 'bem-estar');
  label.textContent = labels[id];
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-region]').forEach(a => {
    const selected = a.dataset.region === id;
    a.classList.toggle('active', selected);
    if (selected) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  model?.setChapter(id);
}
function queueUpdate() { if (!framePending) { framePending = true; requestAnimationFrame(updateChapter); } }
addEventListener('scroll', queueUpdate, { passive: true });
addEventListener('resize', queueUpdate, { passive: true });
document.addEventListener('visibilitychange', queueUpdate);
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  const target = document.querySelector(link.getAttribute('href'));
  if (!target) return;
  event.preventDefault();
  history.replaceState(null, '', link.getAttribute('href'));
  const withinAtlas = target.matches('[data-chapter]');
  const offset = withinAtlas ? 0 : (innerWidth <= 800 ? 78 : 100);
  const top = target.getBoundingClientRect().top + scrollY - offset;
  window.scrollTo({ top, behavior: mediaMotion.matches ? 'instant' : 'smooth' });
  // Native anchor focus is replicated for keyboard and assistive technology.
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}));
motionButton.addEventListener('click', () => { paused = !paused; updateMotionButton(); model?.setPaused(paused); });
mediaMotion.addEventListener('change', () => { paused = mediaMotion.matches; updateMotionButton(); model?.setReducedMotion(mediaMotion.matches); model?.setPaused(paused); });
document.querySelector('#rotate-toggle').addEventListener('click', () => model?.rotate());
document.querySelector('#anatomy-toggle').addEventListener('click', event => {
  anatomy = !anatomy;
  event.currentTarget.setAttribute('aria-pressed', String(anatomy));
  event.currentTarget.querySelector('span').textContent = anatomy ? 'Vista exterior' : 'Ver por dentro';
  model?.setAnatomy(anatomy);
});
updateMotionButton(); updateChapter();
function fallback() {
  document.body.classList.add('stage-static');
  document.body.classList.remove('webgl-ready');
  document.querySelectorAll('.scene-tools button').forEach(button => { button.hidden = true; });
  document.querySelector('.stage-instruction').textContent = 'Escolha uma zona';
  const anchors = { cervical:[300,175], ombros:[232,220], coluna:[300,330], pelvis:[270,420], pernas:[343,570], linfa:[250,500] };
  const place = () => {
    const width = scene.clientWidth, height = scene.clientHeight;
    const scale = Math.min(width / 600, height / 800);
    document.querySelectorAll('[data-region]').forEach(a => {
      const [x,y] = anchors[a.dataset.region];
      const px = (width - 600 * scale) / 2 + x * scale;
      const py = (height - 800 * scale) / 2 + y * scale;
      const baseX = parseFloat(a.style.getPropertyValue('--px')) / 100 * width;
      const baseY = parseFloat(a.style.getPropertyValue('--py')) / 100 * height;
      a.style.transform = `translate3d(${px-baseX}px,${py-baseY}px,0) translate(-50%,-50%)`;
      a.style.removeProperty('visibility');
    });
  };
  new ResizeObserver(place).observe(scene);
  place();
}
async function startAtlas() {
  try {
    const { createAtlas } = await import('./atlas.js');
    model = createAtlas(scene, { reducedMotion: mediaMotion.matches, onFailure: fallback });
    model.setPaused(paused); model.setChapter(active); model.setAnatomy(anatomy);
    document.body.classList.add('webgl-ready');
    queueUpdate();
  } catch { fallback(); }
}
// The page and static figure are usable before the 3D module is requested.
if ('requestIdleCallback' in window) requestIdleCallback(startAtlas, { timeout: 1200 });
else setTimeout(startAtlas, 250);
