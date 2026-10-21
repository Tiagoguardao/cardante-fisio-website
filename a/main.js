// Option A — scroll-driven visit through Sofia Cardante's studio.
// The room is a Blender reconstruction with lighting baked into textures (studio.glb);
// the machines are separate Higgsfield/Tripo models lit in real time.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Reflector } from "three/addons/objects/Reflector.js";

const root = document.documentElement;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const B = (x, y, z) => new THREE.Vector3(x, z, -y); // Blender (Z-up) -> three (Y-up)

// ---------- camera path (Blender coordinates). c = chapter index shown at that key ----------
const KEYS = [
  { c: 0, p: [0.3, -6.0, 1.5], t: [-0.9, 0.0, 1.45] },         // street, facing the front door and its window on the south facade
  { p: [-0.66, -1.7, 1.5], t: [-0.64, 1.0, 1.4] },             // straight through the front door...
  { p: [-0.66, 0.15, 1.55], t: [-0.64, 3.0, 1.4] },
  { p: [-0.6, 1.0, 1.55], t: [-2.8, 1.6, 1.3] },               // turning left inside the hall...
  { c: 1, p: [-0.5, 1.8, 1.55], t: [-1.75, 0.25, 1.05] },     // ...to the waiting corner: chair, shelf, rope mirrors
  { p: [-0.6, 1.85, 1.58], t: [-2.7, 2.6, 1.3] },              // turn back towards the studio door
  { p: [-0.66, 1.9, 1.6], t: [-0.6, 4.6, 1.4] },              // ...and straight through it
  { c: 2, p: [-0.6, 2.75, 1.6], t: [-0.3, 5.6, 0.95],         // Sofia's desk straight ahead; card on the right
    mt: [-1.3, 5.6, 0.95] },                                   // portrait: the desk itself
  { p: [-0.68, 3.05, 1.62], t: [1.2, 4.3, 1.35] },             // then turn right
  { c: 3, p: [-0.75, 3.25, 1.62], t: [8.9, 3.05, 1.2] },      // facing the gym mirror down the whole studio
  { p: [1.5, 1.6, 4.4], t: [3.5, 3.0, 0.4] },
  { c: 4, p: [-0.99, -7.46, 11.67], t: [3.0, 3.5, 0.0],       // the whole plan, centred, seen from the entrance side
    mp: [-5.23, 3.0, 9.96], mt: [0.5, 3.5, 0.0] },           // portrait: from the west, long side upright
  { c: 5, p: [0.4, 0.6, 2.3], t: [7.0, 3.6, 0.5] },            // the whole studio from the window corner; card on the right
  { c: 6, p: [4.7, 1.6, 2.0], t: [7.7, 4.6, 0.9] },            // exercício: the gym
  { p: [4.8, 2.5, 1.95], t: [6.9, 0.4, 0.7] },                // turn right through the cabinets...
  { c: 7, p: [4.6, 3.3, 1.9], t: [2.3, 1.2, 0.6] },            // ...to the marquesa (terapia manual), INDIBA beside it
  { p: [3.7, 2.9, 1.8], t: [5.4, 0.4, 0.6] },                 // turn back left through the cabinets...
  { c: 8, p: [2.8, 2.6, 1.75], t: [6.2, 4.0, 0.6] },           // ...to the mirror (RPG)
  { p: [2.9, 2.8, 1.65], t: [4.35, 0.2, 0.5] },               // turn right through the cabinets...
  { c: 9, p: [2.95, 2.95, 1.5], t: [1.2, 1.7, 0.45] },         // ...to the marquesa from the gym side (oncológica)
  { c: 10, p: [0.75, 3.35, 1.75], t: [2.2, 1.25, 0.6] },       // the marquesa and INDIBA from the desk side (pavimento pélvico)
  { p: [2.5, -1.5, 6.0], t: [3.5, 3.0, 0.3] },
  { c: 11, p: [-7.4, -3.48, 22.22], t: [-2.0, -6.0, 0.0],     // plan seen from above the entrance side, left of the booking cards
    mp: [-5.23, -12.94, 18.26], mt: [-2.42, -6.91, 0.0] },   // portrait: the plan sits above the stacked cards
];
// portrait screens may override a key (mp/mt) where the stacked cards would hide the view
const path = portrait => ({
  pos: new THREE.CatmullRomCurve3(KEYS.map(k => B(...(portrait && k.mp || k.p))), false, "centripetal"),
  tgt: new THREE.CatmullRomCurve3(KEYS.map(k => B(...(portrait && k.mt || k.t))), false, "centripetal"),
});
const PATHS = [path(false), path(true)];
const keyU = i => i / (KEYS.length - 1);
const chapterKey = [];
KEYS.forEach((k, i) => { if (k.c !== undefined) chapterKey[k.c] = i; });

// ---------- machines (pre-normalised GLBs: front faces +X) ----------
const MACHINES = [
  ["treatment-bed", 1.98, 1.42, 0.0, 0], ["rf-tower", 3.5, 1.25, 0.0, 90],
  ["paraffin-bath", 4.8, 0.22, 0.78, 90], ["chattanooga-unit", 5.55, 0.24, 0.78, 90],
  ["vibration-plate", 4.45, 5.5, 0.0, 270], ["trampoline", 5.75, 5.45, 0.0, 0],
  ["bh-multigym", 7.75, 3.55, 0.0, 180], ["treadmill", 7.15, 5.62, 0.0, 0],
];

// ---------- DOM ----------
const sections = [...document.querySelectorAll(".ch")];
const rail = document.querySelector(".rail");
sections.forEach((s, i) => {
  const a = document.createElement("a");
  a.href = "#" + s.id;
  a.innerHTML = "<i></i>";
  a.setAttribute("aria-label", s.dataset.title);
  rail.appendChild(a);
});
const railLinks = [...rail.children];

// ---------- scroll -> path parameter ----------
const HOLD = 0.42;
let chapter = 0;
function scrollState() {
  const y = window.scrollY;
  let i = 0;
  for (let k = 0; k < sections.length; k++) if (sections[k].offsetTop <= y + 1) i = k;
  const s = sections[i];
  const f = THREE.MathUtils.clamp((y - s.offsetTop) / Math.max(1, s.offsetHeight), 0, 1);
  const a = keyU(chapterKey[i]);
  let u = a;
  if (i < sections.length - 1 && f > HOLD) {
    const b = keyU(chapterKey[i + 1]);
    const x = (f - HOLD) / (1 - HOLD);
    u = a + (b - a) * (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  }
  return { i, f, u };
}
function setChapter(i, f) {
  // a section with data-early shows its card before its stop, while the camera is still turning towards it
  sections.forEach((s, k) => s.classList.toggle("on", (k === i && f < 0.66) || (k === i + 1 && f > (+s.dataset.early || 2))));
  railLinks.forEach((a, k) => (k === i ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
  chapter = i;
}

// ---------- WebGL guard ----------
function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}
function fallback() {
  root.classList.add("no-webgl", "ready");
  const tick = () => { const st = scrollState(); setChapter(st.i, st.f); };
  addEventListener("scroll", tick, { passive: true }); tick();
}
if (!webglOK()) { fallback(); } else { start().catch(err => { console.error(err); fallback(); }); }

async function start() {
  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  const mobile = matchMedia("(max-width: 760px)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#dfe9f2");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;
  const sun = new THREE.DirectionalLight("#fff4e6", 1.1); sun.position.set(2, 6, 4); scene.add(sun);
  scene.add(new THREE.HemisphereLight("#eef4fa", "#8d8b88", 0.55));

  const camera = new THREE.PerspectiveCamera(mobile ? 62 : 52, innerWidth / innerHeight, 0.05, 80);

  const manager = new THREE.LoadingManager();
  const draco = new DRACOLoader(manager).setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
  const loader = new GLTFLoader(manager).setDRACOLoader(draco);

  const gltf = await loader.loadAsync("studio.glb");
  const room = gltf.scene;
  const facade = [], south = [];
  let frontDoor, studioDoor, mirror;
  const basic = new Map();
  room.traverse(o => {
    if (o.name === "DOOR_front") frontDoor = o;
    if (o.name === "DOOR_studio") studioDoor = o;
    if (!o.isMesh) return;
    const n = o.name;
    if (n.startsWith("BAKE_")) {
      const map = o.material.map;
      if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; }
      o.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
      if (n.startsWith("BAKE_facade")) { o.material.transparent = true; facade.push(o); }
      if (n.startsWith("BAKE_south")) south.push(o);
    } else if (n.startsWith("GLS_mirror")) {
      mirror = o; // live Reflector inside the room, flat tint when seen from outside
      o.material = new THREE.MeshBasicMaterial({ color: "#c3cfd4", toneMapped: false });
    } else if (n.includes("_glass")) { // door glass: frosted, translucent
      o.material = new THREE.MeshBasicMaterial({ color: "#e9eff2", transparent: true, opacity: 0.93, toneMapped: false });
    } else if (n.startsWith("GLS_win")) {
      o.material = new THREE.MeshBasicMaterial({ color: "#f5f9fc", side: THREE.BackSide, toneMapped: false });
    } else if (n.startsWith("GLS_")) {
      o.material = new THREE.MeshBasicMaterial({ color: "#fbfcfd", side: THREE.DoubleSide, toneMapped: false });
    }
  });
  scene.add(room);
  for (const r of roofs()) { scene.add(r); facade.push(r); }
  scene.add(groundShadow());
  room.updateMatrixWorld(true);

  // gym mirror: a live reflection on every frame (frustum culling skips it when it is out of view)
  let reflector = null;
  if (mirror) {
    const bb = new THREE.Box3().setFromObject(mirror);
    const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const alongX = size.x < size.z; // thin in x -> the mirror faces +/-x
    const roomC = B(4.5, 3.1, 1.2);
    const n = alongX ? new THREE.Vector3(Math.sign(roomC.x - c.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(roomC.z - c.z));
    const w = alongX ? size.z : size.x;
    reflector = new Reflector(new THREE.PlaneGeometry(w, size.y), {
      textureWidth: Math.round(innerWidth * 0.6), textureHeight: Math.round(innerHeight * 0.6), color: 0xb3bfc3,
    });
    reflector.position.copy(c).addScaledVector(n, (alongX ? size.x : size.z) / 2 + 0.006);
    reflector.lookAt(reflector.position.clone().add(n));
    scene.add(reflector);
    mirror.visible = false;
  }

  // logo printed on the front-door glass: no card, readable from outside, mirrored from the hall like the real one
  const hallC = B(-1.165, 1.1, 1.2); // hall interior x -2.15..-0.18, y 0..2.15
  let doorBase = 0, doorSign = 1;
  if (frontDoor) {
    let glass = null;
    frontDoor.traverse(o => { if (!glass && o.isMesh && o.name.includes("_glass")) glass = o; });
    const decal = await logoDecal();
    const toHall = hallC.clone().sub(frontDoor.getWorldPosition(new THREE.Vector3()));
    const zW = new THREE.Vector3(0, 0, 1).transformDirection(frontDoor.matrixWorld);
    const outZ = zW.dot(toHall) > 0 ? -1 : 1; // local z side that faces the street
    let gx = 0.43, gz = 0, half = 0.006;
    if (glass) {
      glass.geometry.computeBoundingBox();
      const toDoor = frontDoor.matrixWorld.clone().invert().multiply(glass.matrixWorld);
      const gb = glass.geometry.boundingBox.clone().applyMatrix4(toDoor);
      gx = (gb.min.x + gb.max.x) / 2; gz = (gb.min.z + gb.max.z) / 2; half = (gb.max.z - gb.min.z) / 2;
    }
    decal.position.set(gx, 1.33, gz + outZ * (half + 0.002));
    if (outZ < 0) decal.rotation.y = Math.PI;
    frontDoor.add(decal);
    // swing inward: pick the rotation sign that moves the free edge toward the hall
    doorBase = frontDoor.rotation.y;
    const edge = new THREE.Vector3(), probe = s => {
      frontDoor.rotation.y = doorBase + s * 0.6; frontDoor.updateMatrixWorld(true);
      return edge.set(0.86, 1, 0).applyMatrix4(frontDoor.matrixWorld).distanceTo(hallC);
    };
    doorSign = probe(1) < probe(-1) ? 1 : -1;
    frontDoor.rotation.y = doorBase; frontDoor.updateMatrixWorld(true);
  }
  const studioDoorX = studioDoor ? studioDoor.position.x : 0;

  // machines
  await Promise.all(MACHINES.map(async ([name, x, y, z, rot]) => {
    const m = await loader.loadAsync(`../assets/machines/${name}.glb`);
    const g = m.scene;
    g.position.copy(B(x, y, z));
    g.rotation.y = THREE.MathUtils.degToRad(rot);
    g.traverse(o => { if (o.isMesh && o.material) { o.material.envMapIntensity = 1.0; } });
    scene.add(g);
  }));

  // ---------- loop ----------
  const camPos = PATHS[0].pos.getPoint(0), camTgt = PATHS[0].tgt.getPoint(0);
  let u = 0, uView = scrollState().u;
  const pointer = new THREE.Vector2();
  addEventListener("pointermove", e => { pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); }, { passive: true });
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  });
  const look = new THREE.Vector3(), sway = new THREE.Vector3();
  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) clock.getDelta(); });

  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;
    step(Math.min(clock.getDelta(), 0.1), false);
  }
  // review hook: render one fully settled frame for the current scroll position
  window.__cdtStep = () => { step(0.016, true); return { chapter, u: +uView.toFixed(4) }; };
  function step(dt, snap) {
    const st = scrollState();
    setChapter(st.i, st.f);
    u = st.u;
    uView = still.matches || snap ? u : uView + (u - uView) * (1 - Math.exp(-dt * 4.5));
    const P = PATHS[camera.aspect < 1.2 ? 1 : 0];
    P.pos.getPoint(THREE.MathUtils.clamp(uView, 0, 1), camPos);
    P.tgt.getPoint(THREE.MathUtils.clamp(uView, 0, 1), camTgt);
    if (camera.aspect < 1.2) {
      const out = THREE.MathUtils.clamp((camPos.y - 3.2) / 3, 0, 1); // only when high above the room
      camPos.sub(camTgt).multiplyScalar(1 + out * (1.2 - camera.aspect) * 0.9).add(camTgt);
    }
    if (!still.matches) {
      sway.set(pointer.x * 0.35, -pointer.y * 0.18, 0).applyQuaternion(camera.quaternion);
      look.copy(camTgt).add(sway);
    } else look.copy(camTgt);
    camera.position.copy(camPos);
    camera.lookAt(look);

    // doors follow the path: the front door opens on the way into the hall, the studio door on the way out of it
    const k0 = keyU(chapterKey[0]), k1 = keyU(chapterKey[1]), k2 = k1, k3 = keyU(chapterKey[2]);
    if (frontDoor) frontDoor.rotation.y = doorBase + doorSign * 1.5 * smooth((uView - k0 - (k1 - k0) * 0.03) / ((k1 - k0) * 0.3)); // fully open before the camera reaches it
    if (studioDoor) studioDoor.position.x = studioDoorX - 0.9 * smooth((uView - k2) / ((k3 - k2) * 0.22)); // open before the camera reaches it

    // exterior walls fade as the camera rises; south-wall window parts hide when the camera is outside
    const fo = THREE.MathUtils.clamp((3.3 - camera.position.y) / 0.9, 0, 1);
    for (const f of facade) for (const m of [].concat(f.material)) { m.opacity = fo; m.depthWrite = fo > 0.99; f.visible = fo > 0.01; }
    const inside = camera.position.z < -0.02 && camera.position.x > -2.2; // camera within the footprint (north of the south facade)
    for (const s of south) s.visible = inside;

    renderer.render(scene, camera);
  }
  if (new URLSearchParams(location.search).has("debug")) window.__cdt = { THREE, scene, camera, room, reflector, mirror, frontDoor };
  renderer.compile(scene, camera);
  root.classList.add("ready");
  frame();
}

// Exterior roof (not in the bake): only ever seen from outside, faded out with the facade for the cutaway.
function roofs() {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 256;
  const g = cv.getContext("2d");
  for (let i = 0; i < 8; i++) { // tile courses
    const y = i * 32, grd = g.createLinearGradient(0, y, 0, y + 32);
    grd.addColorStop(0, "#c46a4a"); grd.addColorStop(0.75, "#a9533a"); grd.addColorStop(1, "#7d3a28");
    g.fillStyle = grd; g.fillRect(0, y, 64, 32);
  }
  const tiles = new THREE.CanvasTexture(cv);
  tiles.colorSpace = THREE.SRGBColorSpace; tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  const out = [], x0 = -2.6, x1 = 9.45, yR = 3.1, zR = 3.66;
  for (const [yE, zE] of [[-0.38, 2.535], [6.58, 2.535]]) { // south and north slopes
    const len = Math.hypot(yR - yE, zR - zE);
    const tex = tiles.clone(); tex.needsUpdate = true; tex.repeat.set((x1 - x0) / 0.25, len / 0.32);
    const trim = new THREE.MeshStandardMaterial({ color: "#ebe5d8", roughness: 0.9, transparent: true }); // fascia and soffit
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true });
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.09, len), [trim, trim, top, trim, trim, trim]);
    const a = B((x0 + x1) / 2, (yE + yR) / 2, (zE + zR) / 2), b = B((x0 + x1) / 2, yR, zR);
    m.position.copy(a); m.lookAt(b); m.name = "ROOF";
    out.push(m);
  }
  return out;
}

// No pavement: just a soft, untextured shadow under the building so it does not float.
function groundShadow() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const g = cv.getContext("2d"), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(38, 60, 68, .2)"); grd.addColorStop(0.5, "rgba(38, 60, 68, .1)"); grd.addColorStop(1, "rgba(38, 60, 68, 0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 17),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.copy(B(2.4, 3.1, -0.004)); m.renderOrder = -1; m.name = "ground-shadow";
  return m;
}

function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }

async function logoDecal() {
  const img = new Image();
  img.src = "../assets/cardante-logo.svg";
  await img.decode();
  const ratio = img.naturalHeight / img.naturalWidth || 1.09;
  const W = 1024, H = Math.round(W * ratio), cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.drawImage(img, 0, 0, W, H); // transparent background: only the printed lines and leaves
  const px = g.getImageData(0, 0, W, H), d = px.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) d[i + 3] = 0;
  g.putImageData(px, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const w = 0.36;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * ratio),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  mesh.renderOrder = 2;
  mesh.name = "logo-decal";
  return mesh;
}
