import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJECTS, PLANETS, FEATURED_IDS, SYSTEM_IDS, SEARCH_IDS } from './data.js';

const $ = id => document.getElementById(id);
const canvas = $('universe');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance', alpha:false});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .02, 2400);
camera.position.set(0, 78, 60);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010309);
scene.fog = new THREE.FogExp2(0x010309, .00125);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .055;
controls.rotateSpeed = .48;
controls.zoomSpeed = .72;
controls.minDistance = 7;
controls.maxDistance = 230;
controls.target.set(0,0,0);

const isMobile = matchMedia('(max-width: 800px)').matches;
const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
let quality = 'auto';
let mode = 'galaxy';
let selectedId = 'galaxy';
let infoPanelCollapsed = isMobile;
let playing = true;
let showOrbits = true;
let simDays = (Date.now() - Date.UTC(2000,0,1,12)) / 86400000;
let galaxyYears = 0;
let speedIndex = 0;
let followObject = null;
let previousFollow = new THREE.Vector3();
let cameraTween = null;
let genericAnimators = [];
let interactiveObjects = [];
let textureProgress = 0;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cameraOffset = new THREE.Vector3();
const roots = {};
const textureCache = new Map();
const solarBodies = new Map();
const markerPositions = {solar:new THREE.Vector3(26,.15,0), sgr:new THREE.Vector3(0,0,0)};
const J2000_MS = Date.UTC(2000,0,1,12);

const SPEEDS = {
  galaxy: [
    {label:'100 万年/秒', years:1e6},
    {label:'500 万年/秒', years:5e6},
    {label:'2000 万年/秒', years:2e7}
  ],
  solar: [
    {label:'1 日/秒', days:1},
    {label:'30 日/秒', days:30},
    {label:'1 年/秒', days:365.256}
  ],
  earth: [
    {label:'6 小时/秒', days:.25},
    {label:'1 日/秒', days:1},
    {label:'7 日/秒', days:7}
  ],
  system: [
    {label:'1 日/秒', days:1},
    {label:'30 日/秒', days:30},
    {label:'1 年/秒', days:365.256}
  ],
  blackhole: [
    {label:'教学速度', visual:1},
    {label:'5× 教学', visual:5},
    {label:'20× 教学', visual:20}
  ]
};

function seededRandom(seed=987654321){
  let x = seed >>> 0;
  return () => ((x = Math.imul(1664525,x) + 1013904223 >>> 0) / 4294967296);
}
const random = seededRandom();
function gaussian(){
  const u = Math.max(.000001, random());
  const v = random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function applyQuality(){
  const autoLow = isMobile || lowMemory;
  const ratio = quality === 'high' ? Math.min(devicePixelRatio,2) : quality === 'low' ? 1 : Math.min(devicePixelRatio,autoLow?1.3:1.75);
  renderer.setPixelRatio(ratio);
  renderer.setSize(innerWidth,innerHeight,false);
  $('quality-label').textContent = quality.toUpperCase();
  $('quality-button').querySelector('b').textContent = quality.toUpperCase();
}
applyQuality();

function makeGlowTexture(inner='#fff',middle='#79dfff',outer='rgba(25,122,190,0)'){
  const c=document.createElement('canvas'); c.width=c.height=256;
  const x=c.getContext('2d'); const g=x.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,inner); g.addColorStop(.12,inner); g.addColorStop(.3,middle); g.addColorStop(1,outer);
  x.fillStyle=g; x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

function makeUranusTexture(){
  const c=document.createElement('canvas'); c.width=1024; c.height=512; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,512);
  g.addColorStop(0,'#a8e0e1');g.addColorStop(.28,'#8fd3d8');g.addColorStop(.5,'#82cbd2');g.addColorStop(.72,'#90d2d7');g.addColorStop(1,'#a7dfe0');
  x.fillStyle=g;x.fillRect(0,0,1024,512);
  x.globalAlpha=.13;
  for(let i=0;i<18;i++){x.fillStyle=i%2?'#d7f5f2':'#4faab5';x.fillRect(0,i*30+random()*12,1024,2+random()*5)}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function makeRingTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=64;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,1024,0);
  g.addColorStop(0,'rgba(160,140,105,0)');g.addColorStop(.08,'rgba(205,187,145,.35)');g.addColorStop(.19,'rgba(238,220,172,.85)');g.addColorStop(.32,'rgba(122,107,82,.25)');g.addColorStop(.42,'rgba(236,219,177,.75)');g.addColorStop(.56,'rgba(180,163,128,.5)');g.addColorStop(.72,'rgba(235,220,184,.72)');g.addColorStop(.91,'rgba(158,142,111,.22)');g.addColorStop(1,'rgba(150,130,100,0)');
  x.fillStyle=g;x.fillRect(0,0,1024,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.ClampToEdgeWrapping;return t;
}

function sprite(texture,size,opacity=1){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));
  s.scale.set(size,size,1);return s;
}

function updateLoading(value,title,detail){
  textureProgress=Math.max(textureProgress,value);$('loading-progress').style.width=`${textureProgress}%`;
  if(title)$('loading-title').textContent=title;if(detail)$('loading-detail').textContent=detail;
}

function createBackground(){
  const count=isMobile?1800:3600;const pos=new Float32Array(count*3);const colors=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const r=250+random()*800;const theta=random()*Math.PI*2;const phi=Math.acos(2*random()-1);
    pos[i*3]=r*Math.sin(phi)*Math.cos(theta);pos[i*3+1]=r*Math.cos(phi);pos[i*3+2]=r*Math.sin(phi)*Math.sin(theta);
    const warm=random()>.86;colors[i*3]=warm?1:.62+random()*.35;colors[i*3+1]=warm?.79:.75+random()*.22;colors[i*3+2]=warm?.58:1;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({size:.7,vertexColors:true,transparent:true,opacity:.78,sizeAttenuation:true,depthWrite:false}));
  scene.add(p);
}

let galaxyDisk,galaxyBulge,galaxyCore;
function createGalaxy(){
  const root=new THREE.Group();roots.galaxy=root;scene.add(root);
  const count=(quality==='low'||isMobile||lowMemory)?36000:76000;
  const diskCount=Math.floor(count*.82),bulgeCount=count-diskCount;
  const pos=new Float32Array(diskCount*3),col=new Float32Array(diskCount*3);
  const c=new THREE.Color();
  for(let i=0;i<diskCount;i++){
    const r=Math.pow(random(),.72)*47;const armPick=random();const arm=armPick<.34?0:armPick<.68?2:armPick<.84?1:3;const armBase=arm*Math.PI/2;const inArm=random()<.78;
    const theta=inArm?armBase+r*.19+gaussian()*(.05+.0037*r):random()*Math.PI*2;const spread=inArm?.16+.52*(r/47):.55;
    pos[i*3]=Math.cos(theta)*r+gaussian()*spread;pos[i*3+2]=Math.sin(theta)*r+gaussian()*spread;pos[i*3+1]=gaussian()*(.18+1.35*Math.exp(-r/13));
    const coreMix=Math.max(0,1-r/18);const young=random()>.72;
    c.setRGB(.48+.42*coreMix+(young?.12:0),.63+.25*coreMix+(young?.1:0),young?1:.8+.12*coreMix);
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
  galaxyDisk=new THREE.Points(g,new THREE.PointsMaterial({size:isMobile?.12:.15,vertexColors:true,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(galaxyDisk);
  const bp=new Float32Array(bulgeCount*3),bc=new Float32Array(bulgeCount*3);
  for(let i=0;i<bulgeCount;i++){
    const r=Math.pow(random(),2.2)*15;const theta=random()*Math.PI*2;const y=gaussian()*(2.8*(1-r/18)+.2);
    bp[i*3]=Math.cos(theta)*r*1.35;bp[i*3+1]=y;bp[i*3+2]=Math.sin(theta)*r*.72;
    const q=random();bc[i*3]=1;bc[i*3+1]=.66+q*.28;bc[i*3+2]=.35+q*.42;
  }
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(bp,3));bg.setAttribute('color',new THREE.BufferAttribute(bc,3));
  galaxyBulge=new THREE.Points(bg,new THREE.PointsMaterial({size:.18,vertexColors:true,transparent:true,opacity:.88,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(galaxyBulge);
  galaxyCore=sprite(makeGlowTexture('#fff8dc','#ffba61','rgba(255,120,20,0)'),17,.78);galaxyCore.scale.y=8;root.add(galaxyCore);
  const haloGeo=new THREE.BufferGeometry();const hp=[];for(let i=0;i<(isMobile?900:2300);i++){const r=20+random()*45;const t=random()*Math.PI*2;hp.push(Math.cos(t)*r,gaussian()*3.4,Math.sin(t)*r)}haloGeo.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));
  root.add(new THREE.Points(haloGeo,new THREE.PointsMaterial({size:.08,color:0x8cb6cc,transparent:true,opacity:.18,depthWrite:false})));
}

async function loadTexture(url){
  if(textureCache.has(url))return textureCache.get(url);
  const loader=new THREE.TextureLoader();
  const promise=loader.loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t});
  textureCache.set(url,promise);return promise;
}

function orbitRadius(a){return 7+Math.log2(1+a*3)*11}
function solvePosition(p,days,out=new THREE.Vector3()){
  let M=THREE.MathUtils.degToRad(p.m0)+Math.PI*2*days/p.period;M%=Math.PI*2;
  let E=M;for(let i=0;i<6;i++)E=M+p.e*Math.sin(E);
  const a=orbitRadius(p.a);const x=(Math.cos(E)-p.e)*a;const z=Math.sqrt(1-p.e*p.e)*Math.sin(E)*a;
  const inc=THREE.MathUtils.degToRad(p.i);out.set(x,z*Math.sin(inc),z*Math.cos(inc));return out;
}

function orbitLine(p,color=0x315363){
  const pts=[];for(let i=0;i<180;i++){const E=i/180*Math.PI*2;const a=orbitRadius(p.a);const x=(Math.cos(E)-p.e)*a;const z=Math.sqrt(1-p.e*p.e)*Math.sin(E)*a;const inc=THREE.MathUtils.degToRad(p.i);pts.push(new THREE.Vector3(x,z*Math.sin(inc),z*Math.cos(inc)))}
  const g=new THREE.BufferGeometry().setFromPoints(pts);return new THREE.LineLoop(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.32,depthWrite:false}));
}

function addSaturnRings(mesh,scale){
  const g=new THREE.RingGeometry(scale*1.25,scale*2.15,128);const uv=g.attributes.uv;
  for(let i=0;i<uv.count;i++){const p=new THREE.Vector2(g.attributes.position.getX(i),g.attributes.position.getY(i));uv.setXY(i,(p.length()-scale*1.25)/(scale*.9),.5)}
  const m=new THREE.MeshBasicMaterial({map:makeRingTexture(),transparent:true,opacity:.86,side:THREE.DoubleSide,depthWrite:false});const ring=new THREE.Mesh(g,m);ring.rotation.x=Math.PI/2;mesh.add(ring);
}

function addUranusRings(mesh,scale){
  const g=new THREE.RingGeometry(scale*1.4,scale*1.95,96);const m=new THREE.MeshBasicMaterial({color:0x8fb6b8,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false});const ring=new THREE.Mesh(g,m);ring.rotation.x=Math.PI/2;mesh.add(ring);
}

async function createSolarSystem(){
  const root=new THREE.Group();root.visible=false;roots.solar=root;scene.add(root);
  root.add(new THREE.AmbientLight(0x43505b,.2));
  const sunMat=new THREE.MeshBasicMaterial({color:0xffb64b});const sun=new THREE.Mesh(new THREE.SphereGeometry(4.2,48,32),sunMat);sun.userData={id:'sun',kind:'body'};root.add(sun);interactiveObjects.push(sun);solarBodies.set('sun',{mesh:sun,data:OBJECTS.sun});
  const sunGlow=sprite(makeGlowTexture('#fff8d8','#ff9b38','rgba(255,92,20,0)'),18,.8);sun.add(sunGlow);
  const light=new THREE.PointLight(0xfff0d2,450,260,1.1);root.add(light);
  for(let index=0;index<PLANETS.length;index++){
    const p=PLANETS[index];let map=null;
    if(p.texture){try{map=await loadTexture(p.texture)}catch(error){console.warn(`Texture failed: ${p.id}`,error)}}else map=makeUranusTexture();
    const material=new THREE.MeshStandardMaterial({map,color:map?0xffffff:p.color,roughness:.83,metalness:0});
    const holder=new THREE.Group();holder.rotation.z=THREE.MathUtils.degToRad(p.tilt);root.add(holder);
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.visual,40,24),material);mesh.userData={id:p.id,kind:'body'};holder.add(mesh);interactiveObjects.push(mesh);
    if(p.id==='earth'){
      try{const clouds=await loadTexture('../../assets/textures/clouds_2048.png');const cloudMesh=new THREE.Mesh(new THREE.SphereGeometry(p.visual*1.012,40,24),new THREE.MeshStandardMaterial({map:clouds,transparent:true,opacity:.55,depthWrite:false,roughness:1}));mesh.add(cloudMesh);mesh.userData.clouds=cloudMesh}catch{}
    }
    if(p.id==='venus'){const haze=new THREE.Mesh(new THREE.SphereGeometry(p.visual*1.025,32,20),new THREE.MeshStandardMaterial({color:0xd9b46e,transparent:true,opacity:.28,depthWrite:false,roughness:1}));mesh.add(haze)}
    if(p.id==='saturn')addSaturnRings(mesh,p.visual);
    if(p.id==='uranus')addUranusRings(mesh,p.visual);
    const orbit=orbitLine(p);root.add(orbit);
    solarBodies.set(p.id,{data:p,holder,mesh,orbit,position:new THREE.Vector3()});
    updateLoading(35+index*5,'正在装配太阳系',`LOADING ${p.en} SURFACE DATA`);
  }
}

async function createEarthSystem(){
  const root=new THREE.Group();root.visible=false;roots.earth=root;scene.add(root);
  root.add(new THREE.AmbientLight(0x6a87a5,.32));const key=new THREE.DirectionalLight(0xfff1d2,3.4);key.position.set(-15,8,12);root.add(key);
  let earthMap,moonMap,cloudMap;try{[earthMap,moonMap,cloudMap]=await Promise.all([loadTexture('../../assets/textures/earth_4096.jpg'),loadTexture('../../assets/textures/moon_4096.jpg'),loadTexture('../../assets/textures/clouds_2048.png')])}catch{[earthMap,moonMap,cloudMap]=await Promise.all([loadTexture('../../assets/textures/earth_2048.jpg'),loadTexture('../../assets/textures/moon_2048.jpg'),loadTexture('../../assets/textures/clouds_2048.png')])}
  const earth=new THREE.Mesh(new THREE.SphereGeometry(4.2,64,40),new THREE.MeshStandardMaterial({map:earthMap,roughness:.78}));earth.rotation.z=THREE.MathUtils.degToRad(23.44);earth.userData={id:'earth',kind:'body'};root.add(earth);interactiveObjects.push(earth);
  const clouds=new THREE.Mesh(new THREE.SphereGeometry(4.25,64,40),new THREE.MeshStandardMaterial({map:cloudMap,transparent:true,opacity:.64,depthWrite:false,roughness:1}));earth.add(clouds);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(4.34,48,32),new THREE.MeshBasicMaterial({color:0x55b9ff,transparent:true,opacity:.085,side:THREE.BackSide,depthWrite:false}));earth.add(atmosphere);
  const moonHolder=new THREE.Group();moonHolder.rotation.z=THREE.MathUtils.degToRad(5.1);root.add(moonHolder);const moon=new THREE.Mesh(new THREE.SphereGeometry(1.14,48,30),new THREE.MeshStandardMaterial({map:moonMap,roughness:.95}));moon.position.x=13;moon.userData={id:'moon',kind:'body'};moonHolder.add(moon);interactiveObjects.push(moon);
  const moonOrbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:160},(_,i)=>new THREE.Vector3(Math.cos(i/160*Math.PI*2)*13,Math.sin(i/160*Math.PI*2)*13*Math.sin(.089),Math.sin(i/160*Math.PI*2)*13*Math.cos(.089)))),new THREE.LineBasicMaterial({color:0x5a8294,transparent:true,opacity:.4}));root.add(moonOrbit);
  root.userData={earth,clouds,moonHolder,moon,moonOrbit};
}

let blackLensingMaterial,blackLensingPlane,blackOrbitGroup;
function createBlackHole(){
  const root=new THREE.Group();root.visible=false;roots.blackhole=root;scene.add(root);
  const cluster=[];const cc=[];for(let i=0;i<(isMobile?1400:3200);i++){const r=4+Math.pow(random(),1.8)*36;const t=random()*Math.PI*2;cluster.push(Math.cos(t)*r,gaussian()*(.5+r*.03),Math.sin(t)*r);cc.push(1,.52+random()*.4,.25+random()*.5)}
  const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(cluster,3));cg.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));blackOrbitGroup=new THREE.Points(cg,new THREE.PointsMaterial({size:.1,vertexColors:true,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending}));blackOrbitGroup.renderOrder=0;root.add(blackOrbitGroup);

  // The visible dark region is the lensing shadow, not the event horizon itself.
  // This smaller sphere preserves a ray-cast target and represents the horizon scale.
  const hole=new THREE.Mesh(new THREE.SphereGeometry(1.22,48,30),new THREE.MeshBasicMaterial({color:0x000000}));hole.userData={id:'sagittarius-a',kind:'body'};root.add(hole);interactiveObjects.push(hole);

  const vertexShader=`
    varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `;
  const fragmentShader=`
    precision highp float;
    uniform float uTime;
    uniform float uElevation;
    varying vec2 vUv;

    float hash21(vec2 p){
      p=fract(p*vec2(123.34,456.21));
      p+=dot(p,p+45.32);
      return fract(p.x*p.y);
    }
    float noise21(vec2 p){
      vec2 i=floor(p),f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+1.0),f.x),f.y);
    }
    float annulus(float r,float innerRadius,float outerRadius){
      return smoothstep(innerRadius,innerRadius+.025,r)*(1.0-smoothstep(outerRadius-.05,outerRadius,r));
    }
    float filaments(float radial,float angle,float phase){
      vec2 flow=vec2(cos(angle),sin(angle))*(radial*9.0)+vec2(radial*13.0,phase*.17);
      float n=noise21(flow)+.5*noise21(flow*2.07+13.4);
      float fine=.5+.5*sin(radial*112.0-angle*6.0+phase*1.15+n*1.2);
      float lanes=.5+.5*sin(radial*29.0+angle*2.0-phase*.38+n*.75);
      vec2 angular=vec2(cos(angle),sin(angle));
      float knots=.75+.25*noise21(angular*4.4+vec2(radial*24.0,-phase*.18));
      return mix(.19,1.0,pow(fine,1.45))*mix(.78,1.0,lanes)*mix(.86,1.0,knots);
    }
    vec3 diskColor(float radial,float x,float textureValue){
      float heat=1.0-smoothstep(.34,1.38,radial);
      vec3 ember=vec3(.12,.003,.001);
      vec3 orange=vec3(1.35,.105,.008);
      vec3 whiteHot=vec3(3.5,1.45,.32);
      vec3 color=mix(ember,orange,smoothstep(.02,.72,heat));
      color=mix(color,whiteHot,pow(heat,3.1));
      float beam=mix(.34,1.48,smoothstep(1.25,-1.25,x));
      beam=mix(beam,1.0,smoothstep(.18,.82,uElevation));
      color*=beam*(.25+.95*textureValue);
      color.b+=max(beam-1.0,0.0)*heat*.22;
      return color;
    }
    void addLayer(inout vec3 color,inout float alpha,vec3 layerColor,float layerAlpha){
      color=mix(color,layerColor,clamp(layerAlpha,0.0,1.0));
      alpha=layerAlpha+alpha*(1.0-layerAlpha);
    }

    void main(){
      vec2 p=vec2((vUv.x-.5)*3.1,(vUv.y-.5)*2.0);
      float r=length(p);
      float angle=atan(p.y,p.x);
      float faceOn=smoothstep(.18,.82,uElevation);
      vec3 color=vec3(0.0);
      float alpha=0.0;

      // Every visible image samples one source-disk flow field. The coordinates stretch
      // continuously away from the mid-plane, so the direct disk becomes its lensed image
      // instead of ending where a separately animated layer begins.
      float projectedThickness=mix(.115,1.0,faceOn);
      vec2 diskQ=vec2(p.x,(p.y+.008)/projectedThickness);
      float diskR=length(diskQ);
      float diskMask=annulus(diskR,.36,1.43);
      float diskTexture=filaments(diskR,atan(diskQ.y,diskQ.x),uTime);
      float faceDiskOpacity=diskMask*faceOn*(.34+.66*diskTexture);
      addLayer(color,alpha,diskColor(diskR,p.x,diskTexture)*1.08,faceDiskOpacity);

      float farWarp=(1.0-faceOn)*smoothstep(-.015,.48,p.y);
      float farScale=mix(projectedThickness,.48,farWarp);
      vec2 farQ=vec2(p.x,(p.y+.008)/farScale);
      float farR=length(farQ);
      float farTexture=filaments(farR,atan(farQ.y,farQ.x),uTime);
      float farVisibility=smoothstep(-.055,.055,p.y);
      float farMask=annulus(farR,.35,1.43)*farVisibility*(1.0-faceOn);
      addLayer(color,alpha,diskColor(farR,p.x,farTexture)*1.08,farMask*(.34+.66*farTexture));

      // The fainter underside image grows out of the near-side flow after the foreground
      // strip has already begun to curve away, preserving the same lanes through the join.
      float lowerWarp=(1.0-faceOn)*smoothstep(.015,.44,-p.y);
      float lowerScale=mix(projectedThickness,.43,lowerWarp);
      vec2 lowerQ=vec2(p.x,(p.y+.008)/lowerScale);
      float lowerR=length(lowerQ);
      float lowerTexture=filaments(lowerR,atan(lowerQ.y,lowerQ.x),uTime);
      float lowerEmergence=(1.0-faceOn)*smoothstep(.045,.19,-p.y);
      float lowerMask=annulus(lowerR,.35,1.3)*(1.0-farVisibility)*lowerEmergence;
      float lowerEnergy=mix(1.0,.62,lowerWarp);
      addLayer(color,alpha,diskColor(lowerR,p.x,lowerTexture)*lowerEnergy,lowerMask*(.24+.58*lowerTexture));

      // A Schwarzschild-like circular shadow, larger than the horizon scale.
      float shadow=1.0-smoothstep(.279,.289,r);
      color=mix(color,vec3(0.0),shadow);
      alpha=max(alpha,shadow);

      // Multiple photon-ring images become progressively thinner and fainter.
      float photonMain=exp(-pow((r-.303)/.0042,2.0))*.78;
      float photonSecond=exp(-pow((r-.314)/.0024,2.0))*.27;
      float photonThird=exp(-pow((r-.321)/.0014,2.0))*.10;
      float photon=photonMain+photonSecond+photonThird;
      float photonBeam=mix(.48,1.35,smoothstep(.31,-.31,p.x));
      vec3 photonColor=vec3(2.35,.72,.105)*photon*photonBeam;
      addLayer(color,alpha,photonColor,clamp(photon*.68,0.0,.82));

      // Only the physically foreground portion is restored over the shadow. It uses the
      // exact same phase and source coordinates as both lensed images above.
      float edgeNear=1.0-smoothstep(-.025,.045,p.y);
      float nearSide=diskMask*edgeNear*(1.0-faceOn);
      addLayer(color,alpha,diskColor(diskR,p.x,diskTexture)*.98,nearSide*(.32+.58*diskTexture));

      // A faint optically thin halo keeps the edge from reading as a hard graphic cutout.
      float halo=exp(-pow(max(r-.32,0.0)/.36,2.0))*(1.0-smoothstep(.34,1.28,r))*.055;
      color+=vec3(.42,.025,.006)*halo;
      alpha=max(alpha,halo);
      if(alpha<.003)discard;
      gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
    }
  `;
  blackLensingMaterial=new THREE.ShaderMaterial({
    transparent:true,depthTest:false,depthWrite:false,toneMapped:true,
    uniforms:{uTime:{value:0},uElevation:{value:.2}},vertexShader,fragmentShader
  });
  blackLensingPlane=new THREE.Mesh(new THREE.PlaneGeometry(34,22),blackLensingMaterial);
  blackLensingPlane.renderOrder=10;
  root.add(blackLensingPlane);
}

function disposeGroup(group){
  group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(v=>v.dispose())}});
  group.clear();
}

function starMesh(radius,color){
  const holder=new THREE.Group();const star=new THREE.Mesh(new THREE.SphereGeometry(radius,40,24),new THREE.MeshBasicMaterial({color}));holder.add(star);holder.add(sprite(makeGlowTexture('#fff',`#${new THREE.Color(color).getHexString()}`,'rgba(60,100,160,0)'),radius*5,.55));return holder;
}

function createPlanetDot(radius,color,distance,speed,phase=0){
  const pivot=new THREE.Group();const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,24,14),new THREE.MeshStandardMaterial({color,roughness:.85}));mesh.position.x=distance;pivot.add(mesh);genericAnimators.push({pivot,speed,phase});return pivot;
}

function buildGenericSystem(id){
  let root=roots.system;if(!root){root=new THREE.Group();roots.system=root;scene.add(root)}else disposeGroup(root);
  root.visible=true;genericAnimators=[];root.add(new THREE.AmbientLight(0x647185,.5));const d=OBJECTS[id];
  if(id==='alpha-centauri'){
    const binary=new THREE.Group();const a=starMesh(2.2,0xffd98f),b=starMesh(1.65,0xffb56d);a.position.x=-3;b.position.x=4;binary.add(a,b);root.add(binary);genericAnimators.push({pivot:binary,speed:.12,phase:0});
    const proxima=starMesh(.8,0xff553b);proxima.position.set(15,2,-5);root.add(proxima);root.add(createPlanetDot(.48,0x9b6c50,18,.5,1.2));
  }else if(id==='sirius'){
    const binary=new THREE.Group();const a=starMesh(2.7,0xdcecff),b=starMesh(.55,0xf5fbff);a.position.x=-2;b.position.x=8;binary.add(a,b);root.add(binary);genericAnimators.push({pivot:binary,speed:.18,phase:0});
  }else if(id==='trappist-1'){
    root.add(starMesh(1.7,0xff583b));for(let i=0;i<7;i++){
      const distance=4+i*1.55;root.add(createPlanetDot(.32+i*.025,0x806451+i*0x080401,distance,.8/(i+1),i*.7));
      const points=Array.from({length:120},(_,n)=>new THREE.Vector3(Math.cos(n/120*Math.PI*2)*distance,0,Math.sin(n/120*Math.PI*2)*distance));
      root.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x4c3734,transparent:true,opacity:.34})));
    }
  }else if(id==='betelgeuse'){
    const giant=starMesh(7.5,0xff6539);root.add(giant);const shell=new THREE.Mesh(new THREE.SphereGeometry(8.4,32,18),new THREE.MeshBasicMaterial({color:0xff6b35,transparent:true,opacity:.06,side:THREE.BackSide}));root.add(shell);
  }else if(id==='vega'){
    root.add(starMesh(3.6,0xd8e8ff));const disc=new THREE.Mesh(new THREE.RingGeometry(7,15,96),new THREE.MeshBasicMaterial({color:0x87b8d6,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=Math.PI/2;root.add(disc);
  }else{
    const primary=starMesh(4.3,0xffefcf);root.add(primary);const b=starMesh(.8,0xffc785);b.position.set(10,2,0);root.add(b);root.add(createPlanetDot(.45,0xd9c6a7,15,.16,.5));
  }
  const light=new THREE.PointLight(d.color||0xffffff,160,100);root.add(light);return root;
}

function updateSolar(){
  for(const p of PLANETS){const body=solarBodies.get(p.id);if(!body)continue;solvePosition(p,simDays,body.position);body.holder.position.copy(body.position)}
}

function setRootVisibility(next){
  for(const [key,root] of Object.entries(roots))root.visible=key===next;
}

function modeCopy(next,id){
  if(next==='galaxy')return ['MILKY WAY / SCIENTIFIC RECONSTRUCTION','银河系 · 棒旋星系','拖动旋转，滚轮缩放；点击标记或搜索目标开始航行。'];
  if(next==='solar')return ['SOLAR SYSTEM / J2000 ORBIT MODEL','太阳系 · 八大行星','点击太阳或行星查看资料；点击地球进入地月系统。'];
  if(next==='earth')return ['EARTH–MOON SYSTEM / TEACHING SCALE','地月系 · 相互绕行','地月距离与天体大小采用不同可视化比例。'];
  if(next==='blackhole')return ['GALACTIC CENTER / RELATIVISTIC VISUALIZATION','人马座 A* · 银河系中心','阴影、光子环与被引力透镜弯曲的吸积盘为定性科学可视化，并非直接照片。'];
  const d=OBJECTS[id];return ['STELLAR SYSTEM / OBSERVATION MODEL',`${d.name} · ${d.en}`,'系外行星没有可靠表面影像，外观仅按物理属性示意。'];
}

function updateModeUI(next,id){
  document.body.className=`mode-${next}${document.body.classList.contains('no-labels')?' no-labels':''}`;
  const copy=modeCopy(next,id);$('mode-kicker').textContent=copy[0];$('mode-title').textContent=copy[1];$('mode-description').textContent=copy[2];
  $('render-status').textContent=next==='galaxy'?'GALACTIC MODEL':next==='solar'?'ORBITAL MODEL':next==='earth'?'EARTH–MOON MODEL':next==='blackhole'?'GALACTIC CENTER':'STELLAR MODEL';
  $('system-strip').hidden=next!=='solar'&&next!=='earth';
  updateSystemStrip();
  speedIndex=0;updateSpeedLabel();updateBreadcrumb(next,id);
}

function cameraPreset(next){
  if(next==='galaxy')return {pos:new THREE.Vector3(0,78,60),target:new THREE.Vector3(),min:16,max:210};
  if(next==='solar')return {pos:new THREE.Vector3(0,98,122),target:new THREE.Vector3(),min:10,max:210};
  if(next==='earth')return {pos:new THREE.Vector3(0,10,32),target:new THREE.Vector3(),min:7,max:52};
  if(next==='blackhole')return {pos:new THREE.Vector3(0,6.5,31),target:new THREE.Vector3(),min:9,max:75};
  return {pos:new THREE.Vector3(0,14,34),target:new THREE.Vector3(),min:8,max:80};
}

function animateCamera(pos,target,duration=900){
  cameraTween={started:performance.now(),duration,startPos:camera.position.clone(),endPos:pos.clone(),startTarget:controls.target.clone(),endTarget:target.clone()};
}

function setMode(next,id,instant=false){
  if(next===mode && next!=='system'&&!instant){
    if(next==='solar'&&id==='solar-system'){focusSolarOverview();return}
    showInfo(id);if(next==='solar')focusSolarBody(id);return
  }
  followObject=null;cameraTween=null;
  const finish=()=>{
    mode=next;selectedId=id;setRootVisibility(next);if(next==='system')buildGenericSystem(id);if(next==='solar')updateSolar();
    const preset=cameraPreset(next);camera.position.copy(preset.pos);controls.target.copy(preset.target);controls.minDistance=preset.min;controls.maxDistance=preset.max;controls.update();
    updateModeUI(next,id);showInfo(id);updateCatalog();
    if(!instant)setTimeout(()=>$('travel-screen').classList.remove('active'),280);
  };
  if(instant){finish();return}
  const d=OBJECTS[id];$('travel-title').textContent=d.name;$('travel-distance').textContent=next==='solar'?'从猎户臂进入行星尺度':next==='earth'?'从行星尺度进入地月尺度':next==='blackhole'?'接近银河系动力学中心':'正在切换恒星系统尺度';$('travel-screen').classList.add('active');
  setTimeout(finish,430);
}

function navigateTo(id,instant=false){
  const d=OBJECTS[id];if(!d)return;
  if(id==='galaxy'){setMode('galaxy','galaxy',instant);return}
  if(id==='sagittarius-a'){setMode('blackhole',id,instant);return}
  if(id==='solar-system'){setMode('solar',id,instant);return}
  if(id==='earth'||id==='moon'){setMode('earth',id,instant);return}
  if(d.mode==='system'){setMode('system',id,instant);return}
  if(id==='sun'||PLANETS.some(p=>p.id===id)){
    if(mode!=='solar'){setMode('solar',id,instant);setTimeout(()=>focusSolarBody(id),instant?0:780)}else focusSolarBody(id);
  }
}

function focusSolarOverview(){
  const preset=cameraPreset('solar');
  selectedId='solar-system';followObject=null;previousFollow.set(0,0,0);
  controls.minDistance=preset.min;controls.maxDistance=preset.max;
  animateCamera(preset.pos,preset.target,900);showInfo('solar-system');updateSystemStrip();updateBreadcrumb('solar','solar-system');
}

function focusSolarBody(id){
  const body=solarBodies.get(id);if(!body)return;selectedId=id;showInfo(id);updateSystemStrip();
  const world=new THREE.Vector3();body.mesh.getWorldPosition(world);const size=id==='sun'?4.2:body.data.visual;
  const direction=new THREE.Vector3(.85,.45,1).normalize();
  const earthVisual=PLANETS.find(p=>p.id==='earth').visual;
  const distance=id==='sun'?size*5.2:size*(8.7/earthVisual);
  controls.minDistance=id==='sun'?5:Math.max(.8,size*2.35);controls.maxDistance=cameraPreset('solar').max;
  const pos=world.clone().addScaledVector(direction,distance);
  animateCamera(pos,world,800);followObject=body.mesh;previousFollow.copy(world);
}

function updateFollow(){
  if(!followObject||!followObject.visible)return;const p=new THREE.Vector3();followObject.getWorldPosition(p);const delta=p.clone().sub(previousFollow);if(!cameraTween)camera.position.add(delta);controls.target.copy(p);previousFollow.copy(p);
}

function showInfo(id){
  const d=OBJECTS[id]||OBJECTS.galaxy;selectedId=id;
  $('object-type').textContent=d.type;$('object-name').textContent=d.name;$('object-en').textContent=d.en;$('object-index').textContent=d.code;$('object-summary').textContent=d.summary;
  $('object-metrics').innerHTML=d.metrics.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('object-facts').innerHTML=d.facts.map(v=>`<div class="fact"><i></i><span>${v}</span></div>`).join('');
  $('scale-note').textContent=d.note||'模型采用教学可视化比例。';$('source-link').href=d.source;$('source-link').textContent=`${d.sourceLabel||'权威资料'} ↗`;
  $('info-panel').classList.toggle('collapsed',infoPanelCollapsed);$('info-reopen').hidden=!infoPanelCollapsed;
  try{history.replaceState(null,'',`#${id}`)}catch{}
  updateCatalog();
}

function updateBreadcrumb(next,id){
  let html='<button data-nav="galaxy">银河系</button>';
  if(next==='galaxy')html+='<i>›</i><span>总览</span>';
  else if(next==='blackhole')html+='<i>›</i><span>银河中心</span><i>›</i><span>人马座 A*</span>';
  else if(next==='solar')html+='<i>›</i><span>猎户臂</span><i>›</i><button data-target="solar-system">太阳系</button>';
  else if(next==='earth')html+='<i>›</i><button data-target="solar-system">太阳系</button><i>›</i><span>地月系</span>';
  else html+=`<i>›</i><span>${OBJECTS[id].name}</span>`;
  $('breadcrumb').innerHTML=html;
}

function renderCatalog(kind='featured'){
  const ids=kind==='systems'?SYSTEM_IDS:FEATURED_IDS;
  $('target-list').innerHTML=ids.map((id,i)=>{const d=OBJECTS[id];return `<button class="target-button ${id===selectedId?'active':''}" data-target="${id}"><i style="color:${id==='sagittarius-a'?'#ff9f74':'#60ddff'}"></i><span><b>${d.name}</b><small>${d.en}</small></span><em>${String(i+1).padStart(2,'0')}</em></button>`}).join('');
}
function updateCatalog(){const active=document.querySelector('.catalog-tabs button.active');renderCatalog(active?.dataset.catalog||'featured')}

function updateSystemStrip(){
  const ids=['solar-system','sun',...PLANETS.map(p=>p.id)];const activeId=mode==='earth'?'earth':selectedId;
  $('system-strip').innerHTML=ids.map(id=>`<button data-target="${id}" class="${activeId===id?'active':''}">${id==='solar-system'?'总览':OBJECTS[id].name}</button>`).join('');
}

function search(query){
  const q=query.trim().toLowerCase();if(!q){$('search-results').hidden=true;return}
  const ids=SEARCH_IDS.filter(id=>{const d=OBJECTS[id];return `${d.name} ${d.en} ${d.code}`.toLowerCase().includes(q)}).slice(0,8);
  $('search-results').innerHTML=ids.map((id,i)=>{const d=OBJECTS[id];return `<button class="search-result ${i===0?'active':''}" data-target="${id}"><span><b>${d.name}</b><small>${d.en}</small></span><em>${d.type.split('·')[0]}</em></button>`}).join('');$('search-results').hidden=!ids.length;
}

function updateSpeedLabel(){const presets=SPEEDS[mode]||SPEEDS.galaxy;const p=presets[speedIndex%presets.length];$('speed-button').querySelector('b').textContent=p.label}
function formatTime(){
  if(mode==='galaxy')return `J2000 + ${(galaxyYears/10000).toFixed(galaxyYears<100000?1:0)} 万年`;
  if(mode==='blackhole')return '相对时间 · 教学模拟';
  const ms=J2000_MS+simDays*86400000;const date=new Date(ms);return Number.isFinite(date.getTime())?date.toLocaleDateString('zh-CN',{timeZone:'UTC'}):'轨道时间超出范围';
}

function updateMarkers(){
  const entries=[];
  if(mode==='galaxy'){
    const a=galaxyDisk?.rotation.y||0;markerPositions.solar.set(Math.cos(a)*26,.15,-Math.sin(a)*26);
    entries.push(['marker-solar',markerPositions.solar],['marker-sgr',markerPositions.sgr]);
  }else if(mode==='earth'&&roots.earth?.userData.moon){
    const moonPosition=new THREE.Vector3();roots.earth.userData.moon.getWorldPosition(moonPosition);entries.push(['marker-moon',moonPosition]);
  }else return;
  entries.forEach(([id,p])=>{
    const el=$(id);const v=p.clone().project(camera);const visible=v.z>-1&&v.z<1&&Math.abs(v.x)<1.08&&Math.abs(v.y)<1.08;el.style.opacity=visible?'1':'0';el.style.pointerEvents=visible?'auto':'none';el.style.left=`${(v.x*.5+.5)*innerWidth}px`;el.style.top=`${(-v.y*.5+.5)*innerHeight}px`;
  });
}

function updateCameraTween(now){
  if(!cameraTween)return;const t=Math.min(1,(now-cameraTween.started)/cameraTween.duration);const e=1-Math.pow(1-t,3);camera.position.lerpVectors(cameraTween.startPos,cameraTween.endPos,e);controls.target.lerpVectors(cameraTween.startTarget,cameraTween.endTarget,e);if(t>=1)cameraTween=null;
}

function animate(now){
  requestAnimationFrame(animate);const delta=Math.min(clock.getDelta(),.05);const speed=(SPEEDS[mode]||SPEEDS.galaxy)[speedIndex]||{};
  if(playing){
    if(mode==='galaxy'){galaxyYears+=delta*speed.years;const rotation=delta*speed.years/230e6*Math.PI*2;galaxyDisk.rotation.y+=rotation;galaxyBulge.rotation.y+=rotation*1.7;galaxyCore.material.rotation-=rotation*.15}
    else if(mode==='solar'||mode==='earth'||mode==='system'){simDays+=delta*speed.days;if(mode==='solar')updateSolar()}
    else if(mode==='blackhole'){const s=speed.visual||1;blackLensingMaterial.uniforms.uTime.value+=delta*s;blackOrbitGroup.rotation.y+=delta*.08*s}
  }
  if(mode==='solar'){
    for(const body of solarBodies.values())if(body.mesh){const hours=Math.max(4,Math.abs(body.data.rotation||24));body.mesh.rotation.y+=delta*(playing?1:0)*(12/hours);if(body.mesh.userData.clouds)body.mesh.userData.clouds.rotation.y+=delta*.018}
  }
  if(mode==='earth'&&roots.earth){const d=roots.earth.userData;const phase=simDays/27.321661*Math.PI*2;d.moonHolder.rotation.y=-phase;d.earth.rotation.y+=delta*.25*(playing?1:0);d.clouds.rotation.y+=delta*.035*(playing?1:0);d.moon.rotation.y+=delta*.03}
  if(mode==='system'&&playing)for(const a of genericAnimators){a.pivot.rotation.y=a.phase+simDays*a.speed*.003}
  updateCameraTween(now);updateFollow();controls.update();
  if(mode==='blackhole'&&blackLensingPlane){
    blackLensingPlane.quaternion.copy(camera.quaternion);
    cameraOffset.copy(camera.position).sub(controls.target);
    blackLensingMaterial.uniforms.uElevation.value=Math.abs(cameraOffset.y)/Math.max(cameraOffset.length(),.0001);
  }
  updateMarkers();$('time-value').textContent=formatTime();renderer.render(scene,camera);
}

function onPointer(event){
  const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);
  const worldVisible=o=>{let n=o;while(n){if(!n.visible)return false;n=n.parent}return true};
  const hits=raycaster.intersectObjects(interactiveObjects.filter(o=>o.parent&&worldVisible(o)),true);if(!hits.length)return;let o=hits[0].object;while(o&&!o.userData.id)o=o.parent;if(o?.userData.id)navigateTo(o.userData.id);
}

let pointerStart=null;canvas.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});canvas.addEventListener('pointerup',e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)<6)onPointer(e);pointerStart=null});
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-target]');if(target){navigateTo(target.dataset.target);$('search-input').value='';$('search-results').hidden=true;$('catalog-panel').classList.remove('open')}
  const nav=event.target.closest('[data-nav]');if(nav?.dataset.nav==='galaxy')navigateTo('galaxy');
});
$('search-input').addEventListener('input',e=>search(e.target.value));$('search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('search-results').querySelector('[data-target]');if(first)navigateTo(first.dataset.target);e.target.value='';$('search-results').hidden=true}else if(e.key==='Escape'){$('search-results').hidden=true;e.target.blur()}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();$('search-input').focus()}if(e.key==='Escape'&&document.activeElement!==$('search-input')){if(mode==='earth'||mode==='blackhole'||mode==='system')navigateTo(mode==='earth'?'solar-system':'galaxy')}});
document.querySelectorAll('.catalog-tabs button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.catalog-tabs button').forEach(x=>x.classList.toggle('active',x===b));renderCatalog(b.dataset.catalog)}));
$('play-button').addEventListener('click',()=>{playing=!playing;$('play-button').querySelector('span').textContent=playing?'Ⅱ':'▶';$('play-button').querySelector('small').textContent=playing?'暂停':'播放'});
$('speed-button').addEventListener('click',()=>{speedIndex=(speedIndex+1)%SPEEDS[mode].length;updateSpeedLabel()});
$('orbit-button').addEventListener('click',()=>{showOrbits=!showOrbits;$('orbit-button').classList.toggle('active',showOrbits);for(const body of solarBodies.values())if(body.orbit)body.orbit.visible=showOrbits;if(roots.earth?.userData.moonOrbit)roots.earth.userData.moonOrbit.visible=showOrbits});
$('label-button').addEventListener('click',()=>{document.body.classList.toggle('no-labels');$('label-button').classList.toggle('active',!document.body.classList.contains('no-labels'))});
$('quality-button').addEventListener('click',()=>{quality=quality==='auto'?'high':quality==='high'?'low':'auto';applyQuality()});
$('home-button').addEventListener('click',()=>navigateTo('galaxy'));
$('panel-close').addEventListener('click',()=>{infoPanelCollapsed=true;$('info-panel').classList.add('collapsed');$('info-reopen').hidden=false});
$('info-reopen').addEventListener('click',()=>{infoPanelCollapsed=false;$('info-panel').classList.remove('collapsed');$('info-reopen').hidden=true});
$('mobile-catalog').addEventListener('click',()=>$('catalog-panel').classList.toggle('open'));
$('model-info').addEventListener('click',()=>$('model-dialog').showModal());$('dialog-close').addEventListener('click',()=>$('model-dialog').close());
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();applyQuality()});

async function init(){
  updateLoading(8);createBackground();updateLoading(18,'正在生成银河旋臂','DISTRIBUTING STARS AND DUST');createGalaxy();
  updateLoading(28,'正在读取天体资料','NASA / JPL / USGS DATA');
  await createSolarSystem();updateLoading(82,'正在建立地月系统','LOADING EARTH–MOON SYSTEM');await createEarthSystem();
  createBlackHole();updateLoading(94,'正在校准相机','CALIBRATING OBSERVATION SCALES');
  updateSolar();updateSystemStrip();renderCatalog();setMode('galaxy','galaxy',true);showInfo('galaxy');
  updateLoading(100,'银河坐标系已就绪','MODEL READY');
  setTimeout(()=>{$('loading').classList.add('done');window.__galaxyReady=true},450);
  const initial=location.hash.slice(1);if(initial&&OBJECTS[initial]&&initial!=='galaxy')setTimeout(()=>navigateTo(initial),900);
  requestAnimationFrame(animate);
}
init().catch(error=>{console.error(error);window.__showGalaxyError(error?.message||'MODEL INITIALIZATION ERROR')});
