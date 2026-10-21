/* Cardante · Opção A, página Tratamentos — entrada suave dos blocos, capítulo ativo no índice lateral
   e cor de fundo por capítulo. Sem dependências; a página funciona igual sem JavaScript. */
(function () {
  var html = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* entrada suave: só com IntersectionObserver e sem "reduzir movimento" */
  if ('IntersectionObserver' in window && !reduce) {
    html.classList.add('reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  }

  /* capítulo ativo: o último cujo topo já passou a meio do ecrã */
  var backdrop = document.querySelector('.backdrop');
  var parts = Array.prototype.slice.call(document.querySelectorAll('[data-tint]'));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll('.rail a'));
  var current;

  function pick() {
    var line = innerHeight * 0.5, cur = parts[0];
    for (var i = 0; i < parts.length; i++) if (parts[i].getBoundingClientRect().top < line) cur = parts[i];
    // no fim da página o contacto fica ativo, mesmo que não chegue a meio do ecrã
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = parts[parts.length - 1];
    return cur;
  }
  function setActive(el) {
    if (el === current) return;
    current = el;
    var tint = (el.getAttribute('data-tint') || '').split(' ');
    if (tint.length === 2) {
      backdrop.style.setProperty('--bg1', tint[0]);
      backdrop.style.setProperty('--bg2', tint[1]);
      html.style.setProperty('--band-t', tint[0]);
      html.style.setProperty('--band-b', tint[1]);
    }
    var onRail = false;
    railLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + el.id;
      if (on) { a.setAttribute('aria-current', 'true'); onRail = true; } else a.removeAttribute('aria-current');
    });
    html.classList.toggle('rail-off', !onRail);
  }

  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; setActive(pick()); });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  setActive(pick());
})();
