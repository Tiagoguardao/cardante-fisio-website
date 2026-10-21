/* Cardante · Conceito C · «Mãos e folhas»
   One fixed WebGL layer behind the editorial page:
   - porcelain hands (AI-generated image → image-to-3D model → Blender/Draco) that sit on DOM "slots" and travel with scroll;
   - instanced glazed leaves that leave the hands, drift through the page and land, at the end,
     inside the outlines of the Cardante symbol to complete it.
   Fallbacks: the HTML ships a poster image and the full logo; this file only upgrades them. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

// Leaf poses measured from the logo's own leaf fills (x, y as fractions of the mark's viewBox,
// angle in degrees with y pointing down, length as a fraction of the mark's width).
const LANDING = [
  [0.273, 0.275, 132, 0.19], [0.113, 0.404, 76, 0.185], [0.236, 0.463, 140, 0.16],
  [0.086, 0.582, 47, 0.15], [0.252, 0.628, 102, 0.145], [0.149, 0.747, 30, 0.145],
  [0.2325, 0.8415, 7, 0.11], [0.322, 0.71, 95, 0.1], [0.807, 0.442, 80, 0.11],
  [0.786, 0.5465, 32, 0.105], [0.92, 0.592, 148, 0.13], [0.873, 0.672, -18, 0.09],
  [0.792, 0.814, 151, 0.115]
];
// Drifting leaves stay pale so text over them keeps its contrast; landing leaves deepen to the logo blue.
const DRIFT = ["#a8c4d3", "#c9dbe9", "#b6cfdc", "#a8c4d3", "#93b6c8"];
const LAND = ["#5f8ea5", "#8fb2c4", "#6a97ad"];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function leafGeometry() {
  // An almond leaf like the logo's: pointed at both ends, folded along the midrib, gently arched.
  const SL = 28, SW = 6;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= SL; i++) {
    const u = i / SL, x = u - 0.5;
    const half = 0.14 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.9)), 0.82);
    for (let j = 0; j <= SW; j++) {
      const v = (j / SW) * 2 - 1;
      const y = v * half;
      const z = Math.abs(v) * half * 0.5 - 0.11 * x * x + 0.025 * Math.sin(Math.PI * u) * v * v;
      pos.push(x, y, z);
      uv.push(u, (v + 1) / 2);
    }
  }
  for (let i = 0; i < SL; i++) {
    for (let j = 0; j < SW; j++) {
      const a = i * (SW + 1) + j, b = a + SW + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(23,52,60,0.34)");
  g.addColorStop(0.45, "rgba(23,52,60,0.14)");
  g.addColorStop(1, "rgba(23,52,60,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function init() {
  if (params.has("nowebgl")) return;
  const canvas = document.getElementById("scene");
  const slotHero = document.getElementById("slot-hero");
  const slotTravel = document.getElementById("slot-manifesto");
  const anchor = document.getElementById("wreath-anchor");
  if (!canvas || !slotHero || !anchor) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    console.info("[cardante] WebGL indisponível, a mostrar a versão estática.");
    return;
  }
  root.classList.add("gl");

  let still = motionQuery.matches || params.has("still");
  root.classList.toggle("still", still);

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = params.get("tm") === "agx" ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.get("tm") === "agx" ? 1.05 : 0.95;

  const scene = new THREE.Scene();
  const CAM_Z = 6;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
  camera.position.set(0, 0, CAM_Z);
  scene.fog = new THREE.Fog(0xf3eee5, CAM_Z + 0.4, CAM_Z + 5.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xfff1e2, 1.5);
  key.position.set(-2.4, 3.2, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9dbe9, 0.9);
  rim.position.set(3, 1.2, -2.5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6d9c6, 0.35));

  // ---------- Hands ----------
  const handsRoot = new THREE.Group();
  const handsSpin = new THREE.Group();
  const handsOrient = new THREE.Group();
  handsOrient.rotation.y = -Math.PI / 2; // the model's palms face glTF +X
  handsSpin.add(handsOrient);
  handsRoot.add(handsSpin);
  handsRoot.visible = false;
  scene.add(handsRoot);
  const MODEL_H = 0.4;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, fog: false, toneMapped: false })
  );
  shadow.scale.set(0.36, 0.07, 1);
  shadow.position.set(0, -0.255, -0.05);
  handsRoot.add(shadow);
  let handsReady = false;

  const draco = new DRACOLoader();
  draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(
    "./hero.glb",
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (!o.isMesh) return;
        const old = o.material;
        const mat = new THREE.MeshPhysicalMaterial({
          map: old.map,
          normalMap: old.normalMap,
          roughnessMap: old.roughnessMap,
          roughness: 1,
          metalness: 0, // the generated model bakes a metallic channel; porcelain is a dielectric
          sheen: 0.5,
          sheenRoughness: 0.65,
          sheenColor: new THREE.Color("#ffffff"),
          clearcoat: 0.18,
          clearcoatRoughness: 0.55
        });
        if (old.normalScale) mat.normalScale.copy(old.normalScale);
        o.material = mat;
        old.dispose();
      });
      model.position.y = -MODEL_H / 2;
      handsOrient.add(model);
      handsRoot.visible = true;
      handsReady = true;
      draco.dispose();
      requestRender();
    },
    undefined,
    (err) => {
      console.warn("[cardante] Não foi possível carregar as mãos 3D; mantém-se a imagem.", err);
      root.classList.remove("gl");
    }
  );

  // ---------- Leaves ----------
  const MAX_DRIFT = 24;
  const N = LANDING.length + MAX_DRIFT;
  const leafMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.4, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.3,
    side: THREE.DoubleSide
  });
  const leaves = new THREE.InstancedMesh(leafGeometry(), leafMat, N);
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.frustumCulled = false;
  scene.add(leaves);
  const rand = rng(7568);
  const P = [];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const lander = i < LANDING.length;
    const edge = rand() < (lander ? 0.7 : 0.8);
    const side = rand() < 0.5 ? -1 : 1;
    const from = new THREE.Color(DRIFT[Math.floor(rand() * DRIFT.length)]);
    P.push({
      lander,
      from,
      to: new THREE.Color(LAND[i % LAND.length]),
      ux: edge ? side * (0.34 + rand() * 0.22) : (rand() - 0.5) * 0.8,
      y0: rand(),
      speed: 0.3 + rand() * 0.9,
      z: edge ? -1.7 + rand() * 2.4 : -1.8 + rand() * 1.1,
      size: (0.75 + rand() * 0.6) * (edge ? 1 : 0.7),
      rx: (rand() - 0.5) * 0.5, ry: (rand() - 0.5) * 0.6, rz: (rand() - 0.5) * 0.4,
      ph: rand() * Math.PI * 2,
      spawn: -0.5 + rand() * 1.5,
      sway: 0.02 + rand() * 0.035
    });
    leaves.setColorAt(i, from);
  }
  leaves.instanceColor.needsUpdate = true;
  root.classList.add("leaves-on");

  // ---------- Layout mapping ----------
  let vw = 1, vh = 1, k = 1, small = false;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    small = w < 720;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    vw = w; vh = h;
    k = (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h;
    leaves.count = LANDING.length + (still ? 0 : small ? 12 : MAX_DRIFT);
  }
  const toWorld = (r) => ({
    x: (r.left + r.width / 2 - vw / 2) * k,
    y: -(r.top + r.height / 2 - vh / 2) * k,
    w: r.width * k,
    h: r.height * k
  });

  // ---------- State ----------
  let pointerX = 0, pointerY = 0, px = 0, py = 0;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointerX = (e.clientX / vw) * 2 - 1;
    pointerY = (e.clientY / vh) * 2 - 1;
  }, { passive: true });

  let travel = 0, landing = 0, time = 0, last = performance.now();
  let lastSy = window.scrollY, wind = 0, gust = 0;
  let lastLine = -1, lastDone = -1;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const sprig = new THREE.Vector3();
  let firstFrame = true, handsShown = false;

  function update(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!still) time += dt;
    const sy = window.scrollY;
    if (!still && dt > 0) {
      wind = damp(wind, clamp((sy - lastSy) / dt / 2400, -1, 1), 2.5, dt);
      gust += dt * (1 + 3.5 * Math.abs(wind));
    }
    lastSy = sy;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    // Hands: from the hero slot to the manifesto slot, then away with the page.
    const r1 = slotHero.getBoundingClientRect();
    const a = toWorld(r1);
    let b = a, travelT = 0;
    if (!still && slotTravel && slotTravel.offsetWidth > 0) {
      const r2 = slotTravel.getBoundingClientRect();
      b = toWorld(r2);
      const docC2 = r2.top + sy + r2.height / 2;
      travelT = clamp(sy / Math.max(1, docC2 - vh / 2));
    }
    travel = still ? travelT : damp(travel, travelT, 6, dt);
    const e = easeInOut(travel);
    const hx = lerp(a.x, b.x, e), hy = lerp(a.y, b.y, e), hs = lerp(a.h, b.h, e);
    px = damp(px, still ? 0 : pointerX, 2.2, dt);
    py = damp(py, still ? 0 : pointerY, 2.2, dt);
    const scale = (hs * 0.9) / MODEL_H;
    handsRoot.position.set(hx, hy + Math.sin(time * 0.55) * 0.012 * hs, 0);
    handsRoot.scale.setScalar(scale);
    const beyond = slotTravel && slotTravel.offsetWidth > 0 ? clamp((sy - (slotTravel.getBoundingClientRect().top + sy + slotTravel.offsetHeight / 2 - vh / 2)) / vh) : 0;
    const baseYaw = small ? lerp(0, 0.4, e) : lerp(-0.32, 0.5, e);
    handsSpin.rotation.set(
      0.16 + py * 0.12 + beyond * 0.35 + Math.sin(time * 0.31) * 0.025,
      baseYaw + Math.sin(time * 0.23) * 0.16 + px * 0.28 + e * 0.15,
      Math.sin(time * 0.19) * 0.02
    );
    const handsOnScreen = Math.abs(hy) < (vh * k) * 0.5 + hs && handsReady;
    handsRoot.visible = handsOnScreen;
    sprig.set(hx, hy + hs * 0.22, 0.05);

    // Leaves
    const ra = anchor.getBoundingClientRect();
    let landT = clamp((vh - ra.top) / (vh * 0.55 + ra.height * 0.55));
    if (sy >= maxScroll - 2) landT = 1;
    if (still) landT = 1;
    landing = still ? landT : damp(landing, landT, 3.2, dt);
    const an = toWorld(ra);
    const visH = vh * k, visW = vw * k;
    const unit = Math.min(visW, visH);
    const sN = still ? 0 : sy / vh;
    const settle = smooth(0.25, 0.85, landing);

    for (let i = 0; i < leaves.count; i++) {
      const p = P[i];
      // drifting field (parallax: leaves rise at different speeds as the page scrolls)
      const tt = still ? 0 : time;
      const gt = still ? 0 : gust;
      const yN = (((p.y0 + sN * p.speed * 0.32 + tt * 0.007 * (0.6 + p.speed)) % 1) + 1) % 1;
      let x = p.ux * visW + Math.sin(tt * 0.17 + p.ph) * p.sway * visW + px * 0.05 * (p.z + 1)
        + wind * 0.035 * visW * Math.sin(p.ph * 3 + tt * 0.9) * (p.z + 2.2) * 0.5;
      let y = (yN - 0.5) * 1.55 * visH;
      let z = p.z;
      let len = unit * 0.075 * p.size;
      e3.set(p.ph + gt * p.rx + sN * 0.6 * p.rx, p.ph * 0.7 + gt * p.ry + sN * 0.5, p.ph * 1.3 + gt * p.rz + wind * 0.6);
      qa.setFromEuler(e3);

      // leaving the hands: leaves that have not "spawned" yet sit in the sprig
      const born = still ? 1 : smooth(p.spawn, p.spawn + 0.35, sN * 0.85);
      if (born < 1) {
        const bo = easeOut(born);
        x = lerp(sprig.x, x, bo); y = lerp(sprig.y, y, bo); z = lerp(sprig.z, z, bo);
        len *= bo;
      }

      if (p.lander) {
        const L = LANDING[i];
        const tx = an.x + (L[0] - 0.5) * an.w;
        const ty = an.y - (L[1] - 0.5) * an.h;
        const tl = L[3] * an.w * 1.06;
        const li = still ? 1 : easeInOut(smooth(i * 0.03, i * 0.03 + 0.62, landing));
        const arc = Math.sin(Math.PI * li);
        x = lerp(x, tx, li) + arc * 0.08 * visW * (L[0] < 0.5 ? -1 : 1);
        y = lerp(y, ty, li);
        z = lerp(z, 0.02, li) + arc * 0.9;
        len = lerp(len, tl, li);
        qb.setFromEuler(e3.set(0, 0, -THREE.MathUtils.degToRad(L[2])));
        q.slerpQuaternions(qa, qb, li);
        col.copy(p.from).lerp(p.to, smooth(0.2, 0.95, li));
        leaves.setColorAt(i, col);
      } else {
        len *= 1 - settle;
        q.copy(qa);
      }
      v3.set(x, y, z);
      s3.setScalar(Math.max(len, 1e-5));
      m4.compose(v3, q, s3);
      leaves.setMatrixAt(i, m4);
    }
    leaves.instanceMatrix.needsUpdate = true;
    leaves.instanceColor.needsUpdate = true;

    const line = Math.round(smooth(0.02, 0.5, landing) * 100) / 100;
    const done = Math.round(smooth(0.86, 1, landing) * 100) / 100;
    if (line !== lastLine) { root.style.setProperty("--wreath-line", line); lastLine = line; }
    if (done !== lastDone) { root.style.setProperty("--wreath-done", done); lastDone = done; }

    camera.position.x = px * 0.06;
    camera.position.y = -py * 0.04;
    camera.lookAt(0, 0, 0);
  }

  let rafId = 0, pending = false;
  function frame(now) {
    rafId = 0;
    pending = false;
    update(now);
    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; root.classList.add("gl-on"); }
    if (handsReady && !handsShown) { handsShown = true; root.classList.add("hands-on"); }
    if (!still && !document.hidden) rafId = requestAnimationFrame(frame);
  }
  function requestRender() {
    if (pending || rafId) return;
    pending = true;
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", () => { resize(); requestRender(); }, { passive: true });
  window.addEventListener("scroll", () => { if (still) requestRender(); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (rafId) cancelAnimationFrame(rafId); rafId = 0; pending = false; }
    else { last = performance.now(); requestRender(); }
  });
  motionQuery.addEventListener && motionQuery.addEventListener("change", () => {
    still = motionQuery.matches || params.has("still");
    root.classList.toggle("still", still);
    resize();
    requestRender();
  });
  if ("ResizeObserver" in window) new ResizeObserver(() => requestRender()).observe(document.body);
  requestRender();
}

init();
