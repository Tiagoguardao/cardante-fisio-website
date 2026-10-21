/* Review switcher shared by the four Cardante options.
   Include on every option page: <script src="../assets/options.js" defer></script>
   It adds a small floating pill (bottom-left) that says this is a proposal and links A / B / C / D.
   Pages can hide it while a full-screen intro plays with document.documentElement.classList.add("cdt-opt-hide"). */
(function () {
  var options = [
    { key: "a", label: "A", name: "Visita ao estúdio" },
    { key: "b", label: "B", name: "Atlas do corpo" },
    { key: "c", label: "C", name: "Mãos e folhas" },
    { key: "d", label: "D", name: "Equipamento em 3D" }
  ];
  var here = (location.pathname.match(/\/([abcd])\/(?:index\.html)?$/) || [])[1];
  var css =
    ".cdt-opt{position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:6px;" +
    "padding:5px 6px 5px 12px;border-radius:999px;background:rgba(18,32,36,.82);color:#eef3f2;" +
    "font:500 11.5px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.01em;" +
    "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 24px rgba(0,0,0,.18);transition:opacity .4s}" +
    ".cdt-opt span{opacity:.78;margin-right:4px;white-space:nowrap}" +
    ".cdt-opt a{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;color:inherit;text-decoration:none;" +
    "font-weight:650;background:rgba(255,255,255,.08)}" +
    ".cdt-opt a:hover,.cdt-opt a:focus-visible{background:rgba(255,255,255,.22);outline:none}" +
    ".cdt-opt a[aria-current]{background:#eef3f2;color:#14303a}" +
    "html.cdt-opt-hide .cdt-opt{opacity:0;pointer-events:none}" +
    "@media (max-width:480px){.cdt-opt span{display:none}.cdt-opt{padding:5px}}" +
    "@media print{.cdt-opt{display:none}}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var nav = document.createElement("nav");
  nav.className = "cdt-opt";
  nav.setAttribute("aria-label", "Opções de website");
  var note = document.createElement("span");
  note.textContent = "Proposta de Tiago Guardão · em revisão";
  nav.appendChild(note);
  options.forEach(function (o) {
    var a = document.createElement("a");
    a.href = "../" + o.key + "/";
    a.textContent = o.label;
    a.title = "Opção " + o.label + " — " + o.name;
    if (o.key === here) a.setAttribute("aria-current", "page");
    nav.appendChild(a);
  });
  document.body.appendChild(nav);
})();
