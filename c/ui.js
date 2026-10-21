/* Cardante · Conceito C · small UI layer (no dependencies) */
(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  function motionAllowed() { return !mq.matches && !params.has("still"); }
  if (motionAllowed()) root.classList.add("motion");

  // Header state
  var header = document.querySelector(".site-header");
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Slow reveal of editorial blocks
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!root.classList.contains("motion") || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }
  mq.addEventListener && mq.addEventListener("change", function () {
    if (mq.matches) {
      root.classList.remove("motion");
      items.forEach(function (el) { el.classList.add("is-in"); });
    }
  });
})();
