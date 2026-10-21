import * as THREE from 'three';

// An original procedural line sculpture. No downloaded human mesh or texture.
export function createAtlas(container, { reducedMotion = false, onFailure }) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha:true, antialias:true, powerPreference:'low-power' });
  if (!context) throw new Error('WebGL unavailable; use the static atlas.');
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 60);
  const body = new THREE.Group(); scene.add(body);
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const wirePositions = [], contourPositions = [];
  const wireMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      focus: { value: V(0, .3, 0) }, radius: { value: .7 }, strength: { value: 0 },
      ink: { value: new THREE.Color('#397584') }, accent: { value: new THREE.Color('#aa7951') }, alpha: { value: .66 }
    },
    vertexShader: `varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 focus;uniform float radius;uniform float strength;uniform vec3 ink;uniform vec3 accent;uniform float alpha;varying vec3 vPosition;void main(){float d=distance(vPosition,focus);float h=(1.0-smoothstep(radius*.15,radius,d))*strength;vec3 color=mix(ink,accent,h*.95);gl_FragColor=vec4(color,alpha+ h*.25);#include <colorspace_fragment>}`.replace(';#include', ';\n#include')
  });
  const outlineMaterial = wireMaterial.clone(); outlineMaterial.uniforms.alpha.value = .14;
  function addPath(points, into = wirePositions) {
    for (let i = 1; i < points.length; i++) into.push(...points[i - 1].toArray(), ...points[i].toArray());
  }
  function smoothPath(points, samples = 70) {
    return new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? V(...p) : p)).getPoints(samples);
  }
  // Horizontal ellipses lofted through hand-shaped anatomical proportions.
  function loft(rings, count = 48, slices = 85, twist = 0) {
    const center = new THREE.CatmullRomCurve3(rings.map(r => V(r[1], r[0], r[2])));
    const radii = new THREE.CatmullRomCurve3(rings.map(r => V(r[3], r[4], 0)));
    const point = (u, t) => {
      const c = center.getPoint(t), r = radii.getPoint(t);
      const a = u * Math.PI * 2 + twist * Math.sin(t * Math.PI);
      return V(c.x + Math.cos(a) * r.x, c.y, c.z + Math.sin(a) * r.y);
    };
    for (let j = 0; j < count; j++) {
      const points = [];
      for (let i = 0; i <= slices; i++) points.push(point(j / count, i / slices));
      addPath(points);
    }
    for (let j = 1; j < slices; j += 7) {
      const points = [];
      for (let i = 0; i <= 80; i++) points.push(point(i / 80, j / slices));
      addPath(points, contourPositions);
    }
  }
  loft([
    [-.64,0,.025,.39,.24],[-.43,0,.01,.55,.34],[-.15,0,0,.53,.32],
    [.22,0,0,.39,.25],[.57,0,0,.45,.27],[.94,0,-.01,.57,.32],
    [1.22,0,0,.64,.30],[1.43,0,0,.67,.23],[1.56,0,0,.42,.19],[1.68,0,0,.21,.16]
  ], 50, 110, .32);
  loft([[1.49,0,0,.22,.17],[1.72,0,0,.18,.16],[1.91,.01,0,.20,.18],[2.03,.02,.015,.25,.21]], 40, 32, .1);
  // The head is gently turned, with a face profile instead of a mannequin face.
  for (let j = 0; j < 58; j++) {
    const points = [];
    for (let i = 0; i <= 85; i++) {
      const lat = .035 + i / 85 * (Math.PI - .07), a = j / 58 * Math.PI * 2;
      let y = 2.27 + Math.cos(lat) * .48;
      let x = Math.cos(a) * Math.sin(lat) * .34;
      let z = Math.sin(a) * Math.sin(lat) * .30;
      const face = Math.pow(Math.max(0, Math.sin(a)), 28);
      z += face * (.15 * Math.exp(-Math.pow((y - 2.20) / .075, 2)) + .025 * Math.exp(-Math.pow((y - 2.07) / .045, 2)));
      x += (2.27 - y) * .08;
      const turn = .6;
      points.push(V(x * Math.cos(turn) + z * Math.sin(turn) + .025, y, z * Math.cos(turn) - x * Math.sin(turn)));
    }
    addPath(points);
  }
  for (const side of [-1, 1]) {
    const asymmetry = side < 0 ? .03 : -.04;
    loft([
      [1.39,side*.62,0,.13,.15],[1.22,side*.76,.01,.19,.18],
      [.92,side*.83,.01,.16,.15],[.59,side*.9,.035,.12,.12],
      [.38,side*.93,.055,.11,.105],[.08,side*1.01,.11,.115,.11],
      [-.24,side*1.06,.14,.09,.085],[-.49,side*1.09,.16,.065,.065],
      [-.63,side*1.10,.18,.087,.045],[-.79,side*1.11,.18,.07,.038]
    ].map(r => [r[0] + asymmetry,...r.slice(1)]), 30, 85, .13 * side);
    for (let finger=0;finger<4;finger++) {
      const x = side * (1.05 + finger * .039);
      const length = [.16,.22,.2,.15][finger];
      for (let j=0;j<4;j++) {
        const a=j/4*Math.PI*2;
        addPath(smoothPath([[x+Math.cos(a)*.017,-.72+asymmetry,.18+Math.sin(a)*.018],[x+side*.005,-.84+asymmetry,.19],[x-side*.025,-.79-length+asymmetry,.21]],18));
      }
    }
    addPath(smoothPath([[side*1.04,-.54,.18],[side*.98,-.65,.20],[side*.99,-.76,.24]],16));
    loft([
      [-.38,side*.29,.02,.28,.27],[-.65,side*.30,.01,.29,.29],
      [-1.05,side*.34,.015,.235,.25],[-1.48,side*.38,.01,.175,.17],
      [-1.72,side*.395,.04,.145,.15],[-1.93,side*.415,.025,.17,.17],
      [-2.20,side*.445,-.025,.165,.17],[-2.57,side*.475,-.02,.115,.12],
      [-2.86,side*.49,.015,.085,.10],[-3.02,side*.49,.10,.10,.17],
      [-3.12,side*.49,.21,.135,.29],[-3.17,side*.49,.22,.13,.28]
    ], 32, 115, -.26 * side);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions,3));
  const wires = new THREE.LineSegments(geometry, wireMaterial); body.add(wires);
  const contourGeometry = new THREE.BufferGeometry(); contourGeometry.setAttribute('position', new THREE.Float32BufferAttribute(contourPositions,3));
  body.add(new THREE.LineSegments(contourGeometry, outlineMaterial));

  // Floating botanical linework echoes the studio's figure-and-leaf mark.
  const botanicals = new THREE.Group(); body.add(botanicals);
  const leafMaterial = new THREE.MeshBasicMaterial({ color: '#91b0a0', side: THREE.DoubleSide, transparent: true, opacity: .44, depthWrite: false });
  const leafLine = new THREE.LineBasicMaterial({ color:'#5f8f86', transparent:true, opacity:.66 });
  const lineGeo = pts => new THREE.BufferGeometry().setFromPoints(pts);
  function leaf(start, tip, width, bow = .10) {
    const direction = tip.clone().sub(start), side = V(-direction.y, direction.x, 0).normalize().multiplyScalar(width);
    const vertices = [], indices = [], edges = [[],[]], mid = [];
    for (let i=0;i<=20;i++) {
      const t=i/20, c=start.clone().lerp(tip,t); c.z += Math.sin(t*Math.PI)*bow;
      mid.push(c);
      const w=Math.pow(Math.sin(Math.PI*t), .85);
      const a=c.clone().addScaledVector(side,w), b=c.clone().addScaledVector(side,-w*.68);
      vertices.push(...a.toArray(),...b.toArray()); edges[0].push(a); edges[1].push(b);
      if (i<20) { const k=i*2; indices.push(k,k+1,k+2,k+1,k+3,k+2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
    botanicals.add(new THREE.Mesh(g,leafMaterial));
    for (const path of [...edges,mid]) botanicals.add(new THREE.Line(lineGeo(path),leafLine));
  }
  const branches = [
    [[-.40,-.72,-.05],[-1.10,-.12,-.08],[-1.49,.59,-.04],[-1.42,1.30,0]],
    [[.52,.89,-.03],[1.11,1.20,-.12],[1.38,1.74,-.02],[1.38,2.30,.03]],
    [[.45,-2.83,-.03],[1.03,-2.29,-.12],[1.26,-1.71,.01]]
  ];
  branches.forEach(path => botanicals.add(new THREE.Line(lineGeo(smoothPath(path)),leafLine)));
  [
    [[-1.12,-.10,-.08],[-1.70,.13,.05],.13], [[-1.32,.23,-.05],[-1.13,.80,.14],.15],
    [[-1.46,.52,-.02],[-1.86,.98,.08],.14], [[-1.46,.91,0],[-1.18,1.45,.14],.16],
    [[-1.43,1.18,.01],[-1.58,1.65,.04],.13], [[1.07,1.18,-.06],[1.64,1.22,.12],.14],
    [[1.27,1.55,-.06],[.97,2.01,.08],.15], [[1.38,1.83,0],[1.79,2.22,.10],.16],
    [[1.40,2.14,.02],[1.26,2.66,.04],.13], [[.87,-2.48,-.08],[1.48,-2.41,.07],.13],
    [[1.11,-2.11,-.04],[.98,-1.64,.08],.12], [[1.23,-1.80,.01],[1.63,-1.49,.07],.11]
  ].forEach(([a,b,w]) => leaf(V(...a),V(...b),w));

  const anatomy = new THREE.Group();body.add(anatomy);
  const spineMaterial = new THREE.MeshBasicMaterial({ color:'#b58e61', transparent:true,opacity:.77 });
  const anatomyLine = new THREE.LineBasicMaterial({ color:'#a57c50',transparent:true,opacity:.7 });
  const spinePoints = smoothPath([[0,1.70,.18],[0,1.12,.28],[0,.63,.24],[0,.16,.21],[0,-.44,.29]],80);
  const spineCurve = new THREE.CatmullRomCurve3(spinePoints);
  anatomy.add(new THREE.Mesh(new THREE.TubeGeometry(spineCurve,90,.018,5,false),spineMaterial));
  const vertebra = new THREE.TorusGeometry(.055,.014,4,12,Math.PI*1.7);
  for(let i=0;i<25;i++) {
    const p=spineCurve.getPoint(i/25), vertebraMesh=new THREE.Mesh(vertebra,spineMaterial);
    vertebraMesh.position.copy(p);vertebraMesh.rotation.x=Math.PI/2;vertebraMesh.rotation.z=.28;
    vertebraMesh.scale.setScalar(i>18 ? 1.3 : .8);anatomy.add(vertebraMesh);
  }
  for (const side of [-1,1]) {
    for(let i=0;i<9;i++) {
      const y=1.3-i*.1, width=.50 - Math.abs(i-3)*.027;
      anatomy.add(new THREE.Line(lineGeo(smoothPath([[0,y,.24],[side*width*.6,y+.035,.31],[side*width,y-.08,.16],[side*width*.80,y-.23,.29],[side*.08,y-.28,.34]],36)),anatomyLine));
    }
    anatomy.add(new THREE.Line(lineGeo(smoothPath([[side*.05,-.20,.27],[side*.37,-.12,.26],[side*.49,-.38,.27],[side*.30,-.68,.28],[side*.06,-.59,.26]],45)),anatomyLine));
  }
  anatomy.visible=false;
  const lymph=new THREE.Group();body.add(lymph);
  const lymphMaterial=new THREE.LineBasicMaterial({color:'#5e9b82',transparent:true,opacity:.85});
  const nodeMaterial=new THREE.MeshBasicMaterial({color:'#5a947a'});
  const nodeGeometry=new THREE.SphereGeometry(.031,8,6);
  for(const side of [-1,1]) {
    const paths=[[[side*.10,1.7,.22],[side*.23,1.29,.31],[side*.44,.92,.31],[side*.21,.31,.28],[side*.29,-.42,.34],[side*.35,-1.1,.26],[side*.41,-1.9,.20],[side*.49,-2.9,.15]],[[side*.44,.92,.28],[side*.73,1.17,.19],[side*.86,.50,.15],[side*1.02,-.26,.22]]];
    paths.forEach(points => {
      const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p)));
      lymph.add(new THREE.Line(lineGeo(curve.getPoints(120)),lymphMaterial));
      for(let i=0;i<16;i++){const node=new THREE.Mesh(nodeGeometry,nodeMaterial);node.position.copy(curve.getPoint(i/16));lymph.add(node);}
    });
  }
  lymph.visible=false;

  // A quiet orbit makes the figure read as a spatial object, rather than a flat illustration.
  const orbitMaterial=new THREE.LineBasicMaterial({color:'#75a0a5',transparent:true,opacity:.19});
  const orbit=new THREE.Group();scene.add(orbit);
  for(let k=0;k<2;k++) {
    const points=[];
    for(let i=0;i<=180;i++) {const t=i/180*Math.PI*2;points.push(V(Math.cos(t)*(2.13+k*.15),Math.sin(t)*3.22-.2,-.65));}
    const loop=new THREE.Line(lineGeo(points),orbitMaterial);orbit.add(loop);
    if(k===1){loop.rotation.y=.32;loop.rotation.z=-.15;}
  }
  const tickPoints=[];
  for(let i=0;i<65;i++){const y=-3.25+i*.1;tickPoints.push(-2.1,y,-.8,-2.1+(i%5===0?.07:.025),y,-.8);}
  const tickGeometry=new THREE.BufferGeometry();tickGeometry.setAttribute('position',new THREE.Float32BufferAttribute(tickPoints,3));
  orbit.add(new THREE.LineSegments(tickGeometry,orbitMaterial));

  const states={
    inicio:{target:[0,-.15,0],distance:12.9,rotation:-.20,focus:[0,0,0],radius:.8},
    cervical:{target:[0,1.35,0],distance:8.2,rotation:-.55,focus:[0,1.65,.1],radius:.7},
    ombros:{target:[0,.8,0],distance:8.9,rotation:.30,focus:[-.65,1.22,0],radius:.72},
    coluna:{target:[0,.35,0],distance:9.1,rotation:-.18,focus:[0,.32,.1],radius:1.3},
    pelvis:{target:[0,-.32,0],distance:8.6,rotation:-.33,focus:[0,-.4,.1],radius:.85},
    pernas:{target:[0,-1.87,0],distance:8.7,rotation:.18,focus:[.4,-1.8,.05],radius:1.25},
    linfa:{target:[0,-.15,0],distance:12.9,rotation:-.2,focus:[0,0,0],radius:4},
    'bem-estar':{target:[0,-.15,0],distance:13.3,rotation:-.28,focus:[0,.4,0],radius:4}
  };
  const locations={cervical:V(0,1.65,.18),ombros:V(-.69,1.27,.15),coluna:V(.04,.43,.30),pelvis:V(-.29,-.36,.31),pernas:V(.40,-1.75,.19),linfa:V(-.40,-1.25,.27)};
  const hotspots=[...container.querySelectorAll('[data-region]')];
  let current='inicio',desired=states.inicio,focus=V(0,-.15,0),distance=12.9,angle=-.2;
  let manualRotation=0,paused=reducedMotion,visible=true,frame=0,dirty=true,lastTime=0,time=0,showAnatomy=false,disposed=false;
  let w=1,h=1;
  function resize(){
    const r=container.getBoundingClientRect();w=Math.max(r.width,1);h=Math.max(r.height,1);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;requestDraw();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);
  function projectHotspots(){
    body.updateMatrixWorld();
    for(const el of hotspots){
      const p=locations[el.dataset.region].clone();body.localToWorld(p);p.project(camera);
      const x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;
      const inside=x>20&&x<w-20&&y>15&&y<h-20;
      const baseX=parseFloat(el.style.getPropertyValue('--px'))/100*w;
      const baseY=parseFloat(el.style.getPropertyValue('--py'))/100*h;
      el.style.transform=`translate3d(${x-baseX}px,${y-baseY}px,0) translate(-50%,-50%)`;
      el.style.visibility=inside?'visible':'hidden';
    }
  }
  function requestDraw(){if(!frame&&visible&&!disposed)frame=requestAnimationFrame(draw);}
  function draw(timestamp){
    frame=0;if(!visible||disposed)return;
    const dt=Math.min((timestamp-lastTime)/1000 || .016,.05);lastTime=timestamp;
    if(!paused)time+=dt;
    const immediate=reducedMotion,blend=immediate?1:1-Math.exp(-dt*5.5);
    const target=V(...desired.target);
    // A wider field on portrait screens preserves the figure and its botanical outline.
    const aspectScale=camera.aspect<.95 ? 1.08 : 1;
    const targetDistance=desired.distance*aspectScale;
    const rotationTarget=desired.rotation+manualRotation;
    focus.lerp(target,blend);distance=THREE.MathUtils.lerp(distance,targetDistance,blend);angle=THREE.MathUtils.lerp(angle,rotationTarget,blend);
    const idle=paused?0:Math.sin(time*.32)*.045;
    body.rotation.y=angle+idle;
    body.position.y=paused?0:Math.sin(time*.6)*.018;
    botanicals.rotation.y=paused?0:Math.sin(time*.42)*.025;
    camera.position.set(focus.x,focus.y,distance);camera.lookAt(focus);camera.updateMatrixWorld();
    const focusTarget=V(...desired.focus);
    for(const material of [wireMaterial,outlineMaterial]){
      material.uniforms.focus.value.lerp(focusTarget,blend);
      material.uniforms.radius.value=THREE.MathUtils.lerp(material.uniforms.radius.value,desired.radius,blend);
      material.uniforms.strength.value=THREE.MathUtils.lerp(material.uniforms.strength.value,current==='inicio'||current==='bem-estar'?0:1,blend);
    }
    anatomy.visible=showAnatomy||current==='coluna';
    lymph.visible=current==='linfa'||showAnatomy;
    orbit.visible=current==='inicio'||current==='bem-estar'||current==='linfa';
    projectHotspots();renderer.render(scene,camera);
    const strengthTarget=current==='inicio'||current==='bem-estar'?0:1;
    const moving=focus.distanceTo(target)>.001||Math.abs(distance-targetDistance)>.001||Math.abs(angle-rotationTarget)>.001
      ||wireMaterial.uniforms.focus.value.distanceTo(focusTarget)>.001
      ||Math.abs(wireMaterial.uniforms.radius.value-desired.radius)>.001
      ||Math.abs(wireMaterial.uniforms.strength.value-strengthTarget)>.001;
    dirty=moving;
    if(!paused||dirty)requestDraw();
  }
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    event.preventDefault();disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.remove();onFailure();
  });
  resize();requestDraw();
  return {
    setChapter(id){current=id;desired=states[id]||states.inicio;manualRotation=0;dirty=true;requestDraw();},
    setPaused(value){paused=value;dirty=true;requestDraw();},
    setReducedMotion(value){reducedMotion=value;dirty=true;requestDraw();},
    setVisible(value){visible=value;if(value)requestDraw();else{cancelAnimationFrame(frame);frame=0;}},
    setAnatomy(value){showAnatomy=value;dirty=true;requestDraw();},
    rotate(){manualRotation+=Math.PI/2;dirty=true;requestDraw();}
  };
}
