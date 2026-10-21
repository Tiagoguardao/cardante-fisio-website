/* Cardante · Opção A, página Máquinas (extraída da Opção D) — palco 3D partilhado (renderer, luz, plinto, sombra de contacto, carregamento dos modelos).
   Usado por app.js. Three.js r169 via importmap. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

export { THREE };

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/';
const MODEL_DIR = new URL('../../assets/machines/', import.meta.url).href;

export const PLINTH_H = 0.075;

/* ---------- renderer + cena ---------- */
export function createStage(canvas, { pixelRatioCap = 2 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.95;
  pmrem.dispose();

  // luz principal, quente e suave, vinda da frente-esquerda
  const key = new THREE.DirectionalLight(0xfff3e6, 1.55);
  key.position.set(-2.4, 4.6, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera;
  sc.left = -1.7; sc.right = 1.7; sc.top = 1.7; sc.bottom = -1.7; sc.near = 1; sc.far = 12;
  key.shadow.radius = 14;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);

  // contraluz fria (paredes azul-céu do estúdio)
  const rim = new THREE.DirectionalLight(0xd6e6f3, 0.9);
  rim.position.set(3.2, 2.4, -3.4);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 60);
  camera.position.set(2.6, 1.3, 3.6);

  return { renderer, scene, camera, key };
}

/* ---------- carregador ---------- */
let _loader = null;
function loader() {
  if (_loader) return _loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  draco.preload();
  _loader = new GLTFLoader();
  _loader.setDRACOLoader(draco);
  return _loader;
}

/* ---------- sombra de contacto (cozida uma vez por modelo, em espaço local) ---------- */
let _depthMat = null, _hBlur = null, _vBlur = null, _quad = null, _quadCam = null;
function bakeTools() {
  if (_depthMat) return;
  _depthMat = new THREE.MeshDepthMaterial();
  _depthMat.userData.darkness = { value: 1.25 };
  _depthMat.onBeforeCompile = (shader) => {
    shader.uniforms.darkness = _depthMat.userData.darkness;
    shader.fragmentShader = 'uniform float darkness;\n' + shader.fragmentShader.replace(
      'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
      'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );'
    );
  };
  _depthMat.depthTest = false;
  _depthMat.depthWrite = false;
  _depthMat.side = THREE.DoubleSide;
  _hBlur = new THREE.ShaderMaterial(HorizontalBlurShader); _hBlur.depthTest = false;
  _vBlur = new THREE.ShaderMaterial(VerticalBlurShader); _vBlur.depthTest = false;
  _quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _hBlur);
  _quad.position.z = -0.5;
  _quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}

function bakeContactShadow(renderer, object, extent, height) {
  bakeTools();
  const size = 512;
  const opts = { generateMipmaps: false };
  const rt = new THREE.WebGLRenderTarget(size, size, opts);
  const rtB = new THREE.WebGLRenderTarget(size, size, opts);
  const cam = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0, height);
  cam.rotation.x = Math.PI / 2; // olha para cima, a partir do chão
  cam.position.y = -0.002;
  cam.updateMatrixWorld(true);

  const bake = new THREE.Scene();
  bake.overrideMaterial = _depthMat;
  const parent = object.parent;
  const prevPos = object.position.clone();
  bake.add(object);
  object.updateMatrixWorld(true);

  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(bake, cam);

  const blur = (amount) => {
    _quad.material = _hBlur;
    _hBlur.uniforms.tDiffuse.value = rt.texture;
    _hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(rtB);
    renderer.clear();
    renderer.render(_quad, _quadCam);
    _quad.material = _vBlur;
    _vBlur.uniforms.tDiffuse.value = rtB.texture;
    _vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(_quad, _quadCam);
  };
  blur(2.2);
  blur(1.1);
  blur(0.5);

  renderer.setRenderTarget(null);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.shadowMap.autoUpdate = prevShadow;
  rtB.dispose();

  if (parent) parent.add(object);
  object.position.copy(prevPos);

  const geo = new THREE.PlaneGeometry(extent * 2, extent * 2).rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthWrite: false, opacity: 0.92 });
  const plane = new THREE.Mesh(geo, mat);
  plane.scale.y = -1; // vira para cima, mantendo a orientação da textura
  plane.position.y = 0.0016;
  plane.renderOrder = 2;
  plane.userData.rt = rt;
  return plane;
}

/* ---------- plinto ---------- */
function plinthGeometry(r, h) {
  const e = Math.min(0.03, h * 0.42); // raio do boleado
  const pts = [new THREE.Vector2(0, -h)];
  pts.push(new THREE.Vector2(r - e * 1.6, -h));
  const steps = 8;
  for (let i = 0; i <= steps; i++) { // canto inferior, mais suave
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - e * 1.6 + Math.cos(a) * e * 1.6, -h + e * 1.6 + Math.sin(a) * e * 1.6));
  }
  for (let i = 0; i <= steps; i++) { // canto superior
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - e + Math.cos(a) * e, -e + Math.sin(a) * e));
  }
  pts.push(new THREE.Vector2(0, 0));
  return new THREE.LatheGeometry(pts, 128);
}

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.42, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.7, 'rgba(0,0,0,0.16)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

/* ---------- exposição: modelo + plinto + sombras ---------- */
export async function loadExhibit(stage, id, { onProgress, drop = 0, metal = 1, minRough = 0 } = {}) {
  const { renderer } = stage;
  const gltf = await loader().loadAsync(MODEL_DIR + id + '.glb', onProgress);
  const model = gltf.scene;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const meshes = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    meshes.push(o);
    const m = o.material;
    if (m) {
      if (m.map) m.map.anisotropy = Math.min(8, maxAniso);
      m.envMapIntensity = 1;
      m.metalness = Math.min(m.metalness, metal);
      if (minRough > 0) { // evita reflexos de espelho em painéis muito lisos
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\n\troughnessFactor = max( roughnessFactor, ' + minRough.toFixed(3) + ' );');
        };
        m.customProgramCacheKey = () => 'minRough' + minRough;
      }
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  // alguns modelos têm um cabo pendurado abaixo da base: baixamos o corpo até ao plinto
  // e cortamos o que ficaria por baixo dele
  let clip = null;
  if (drop) {
    model.position.y = -drop * size.y;
    clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    meshes.forEach((o) => { o.material.clippingPlanes = [clip]; o.material.clipShadows = true; });
  }
  const radius = size.length() / 2;
  const s = 1 / radius; // esfera envolvente com raio 1

  // o modelo vem com a frente em +X; rodamos para +Z (para a câmara)
  const orient = new THREE.Group();
  orient.rotation.y = -Math.PI / 2;
  orient.add(model);
  const scaler = new THREE.Group();
  scaler.scale.setScalar(s);
  scaler.add(orient);

  const height = size.y * (1 - drop) * s;
  const footR = Math.hypot(size.x, size.z) * 0.5 * s;
  const plinthR = footR * 1.08 + 0.07;

  const turntable = new THREE.Group();
  turntable.add(scaler);

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xf3f6f8, roughness: 0.9, metalness: 0 });
  const plinth = new THREE.Mesh(plinthGeometry(plinthR, PLINTH_H), plinthMat);
  plinth.receiveShadow = true;
  turntable.add(plinth);

  const contact = bakeContactShadow(renderer, scaler, plinthR * 0.98, Math.max(0.22, height * 0.32));
  turntable.add(contact);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(plinthR * 3.1, plinthR * 3.1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x1d3c46, transparent: true, opacity: 0.2, depthWrite: false })
  );
  glow.position.y = -PLINTH_H - 0.002;
  glow.renderOrder = 1;

  const root = new THREE.Group();
  root.add(turntable, glow);
  root.name = id;

  const materials = [plinthMat, contact.material, glow.material];
  meshes.forEach((m) => { if (!materials.includes(m.material)) materials.push(m.material); });
  materials.forEach((m) => { m.transparent = true; });
  const baseOpacity = materials.map((m) => m.opacity);

  return {
    id,
    root,
    turntable,
    scaler,
    model,
    meshes,
    plinth,
    height,
    footR,
    plinthR,
    size, // dimensões originais (metros)
    clip,
    scale: s,
    setTint(color) { plinthMat.color.set(color); },
    setFade(f) { materials.forEach((m, i) => { m.opacity = baseOpacity[i] * f; }); },
    /* ponto à superfície para anotações: px,pz em [-1,1] da meia-largura (frente = +X do ficheiro), py em [0,1] da altura */
    anchor(p, dirFile) {
      const hx = size.x / 2, hz = size.z / 2;
      const local = new THREE.Vector3(p[0] * hx, (drop + p[1] * (1 - drop)) * size.y, p[2] * hz);
      const dir = new THREE.Vector3(...dirFile).normalize();
      // lança um raio de fora para dentro e prende o ponto à superfície (espaço do ficheiro → mundo → ficheiro)
      model.updateMatrixWorld(true);
      const origin = model.localToWorld(local.clone().addScaledVector(dir, radius * 2.2));
      const towards = dir.clone().negate().transformDirection(model.matrixWorld);
      const hit = new THREE.Raycaster(origin, towards, 0, Infinity).intersectObjects(meshes, false)[0];
      const point = hit ? model.worldToLocal(hit.point.clone()) : local;
      return { point: point.addScaledVector(dir, radius * 0.012), normal: dir };
    }
  };
}

/* distância da câmara para que uma esfera de raio R caiba num círculo de rpx píxeis, num ecrã com H píxeis de altura */
export function fitDistance(camera, R, rpx, H) {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const k = (R * (H / 2)) / (rpx * t);
  return Math.sqrt(k * k + R * R);
}
