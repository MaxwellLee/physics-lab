import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CYCLE_ANGLE, ENGINE_COPY, ENGINE_GEOMETRY, INLINE_FOUR_GEOMETRY, STROKES, getCycleState, getInlineFourStates, normalizeCycleAngle, sliderCrankPosition } from './engine-physics.js';

const $ = id => document.getElementById(id);
const canvas = $('engine-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcecf8);
scene.fog = new THREE.FogExp2(0xdcecf8, 0.018);
const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minZoom = .68;
controls.maxZoom = 2.4;
controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(18);
controls.maxPolarAngle = THREE.MathUtils.degToRad(90);
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
controls.target.set(0, .4, 0);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactiveMeshes = [];
const labelEntries = [];
const engines = {};
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const FUEL_MIST_COLOR=0xffff00;
const DIESEL_SPRAY_COLOR=0xffe000;
const EXHAUST_GAS_COLOR=0x343b40;
const EXHAUST_PARTICLE_COLOR=0x0b0f12;
let secondaryReady = false;
const interactionStats={pointerDown:0,pointerMove:0,touchStart:0,touchMove:0};

const state = {
  angle:THREE.MathUtils.degToRad(12),
  playing:true,
  speedIndex:2,
  speeds:[.25,.5,1,2,4],
  speedLabels:['0.25×','0.5×','1×','2×','4×'],
  engine:'gasoline',
  view:'cutaway',
  explode:.72,
  selected:null,
  audioEnabled:false
};

const VIEW_OPTIONS = [
  { id:'cutaway', label:'剖视' },
  { id:'solid', label:'完整' },
  { id:'exploded', label:'拆解' },
  { id:'front', label:'正视' }
];

const PARTS = {
  cylinder:{name:'汽缸与机体',en:'CYLINDER BLOCK',description:'固定的汽缸为活塞提供往复运动空间；剖切外壳便于观察内部结构。'},
  cylinderHead:{name:'汽缸盖',en:'CYLINDER HEAD',description:'封闭汽缸上部，并安装气门和点火装置，共同形成燃烧室。'},
  intakePort:{name:'进气道',en:'INTAKE PORT',description:'把新鲜空气或空气—燃油混合气引向进气门。'},
  exhaustPort:{name:'排气道',en:'EXHAUST PORT',description:'把燃烧后的废气从排气门引向发动机外部。'},
  piston:{name:'活塞',en:'PISTON',description:'在燃气压力和曲柄连杆机构作用下沿汽缸轴线往复运动。'},
  connectingRod:{name:'连杆',en:'CONNECTING ROD',description:'连接活塞与曲轴，将活塞的往复运动和曲轴的转动相互转换。'},
  crankshaft:{name:'曲轴',en:'CRANKSHAFT',description:'主轴颈的中心线是曲轴旋转轴；偏离它的曲柄销随曲轴转动，带动连杆把往复运动与旋转运动相互转换。'},
  flywheel:{name:'飞轮',en:'FLYWHEEL',description:'储存转动动能，在非做功冲程中帮助曲轴和活塞继续运动。'},
  intakeValve:{name:'进气门',en:'INTAKE VALVE',description:'吸气冲程打开，让新鲜空气或空气—燃油混合气进入汽缸。'},
  exhaustValve:{name:'排气门',en:'EXHAUST VALVE',description:'排气冲程打开，让燃烧后的废气离开汽缸。'},
  camshaft:{name:'凸轮轴',en:'CAMSHAFT',description:'四冲程循环中以曲轴一半的转速转动，按顺序控制进、排气门。'},
  ignition:{name:'点火装置',en:'IGNITION DEVICE',description:'汽油机使用火花塞点火；柴油机通过喷油嘴向高温压缩空气中喷油。'}
};

function getPartCopy(engineType, partId) {
  if (partId !== 'ignition') return PARTS[partId];
  return engineType === 'gasoline' || engineType === 'inline4'
    ? { name:'火花塞', en:'SPARK PLUG', description:'在压缩冲程末端产生电火花，点燃汽油与空气形成的混合气。' }
    : { name:'喷油嘴', en:'FUEL INJECTOR', description:'在压缩冲程末端向高温高压空气中喷入雾状柴油，使其自行燃烧。' };
}

function engineName(engineType) {
  return engineType==='gasoline'?'汽油机':engineType==='diesel'?'柴油机':'四缸汽油机';
}

function material(color, options={}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness:options.roughness ?? .55,
    metalness:options.metalness ?? .55,
    transparent:options.transparent ?? false,
    opacity:options.opacity ?? 1,
    side:options.side ?? THREE.FrontSide,
    depthWrite:options.depthWrite ?? true,
    emissive:options.emissive ?? 0x000000,
    emissiveIntensity:options.emissiveIntensity ?? 0
  });
}

function mesh(geometry, mat, position=[0,0,0], rotation=[0,0,0]) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function cylinderBetween(object, start, end) {
  object.position.copy(start).add(end).multiplyScalar(.5);
  tmpC.copy(end).sub(start);
  object.quaternion.setFromUnitVectors(yAxis, tmpC.clone().normalize());
  object.scale.y = tmpC.length();
}

function projectedBounds(object) {
  if(!object?.visible)return null;
  object.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(object,true);
  if(box.isEmpty())return null;
  const corners=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera));
  const minX=Math.min(...corners.map(point=>point.x));const maxX=Math.max(...corners.map(point=>point.x));
  const minY=Math.min(...corners.map(point=>point.y));const maxY=Math.max(...corners.map(point=>point.y));
  return {left:(minX*.5+.5)*innerWidth,right:(maxX*.5+.5)*innerWidth,top:(-maxY*.5+.5)*innerHeight,bottom:(-minY*.5+.5)*innerHeight};
}

function pointAxisRange(points,axis=0) {
  const positions=points?.geometry?.attributes?.position?.array;
  if(!positions?.length)return null;
  let min=Infinity;let max=-Infinity;
  for(let index=axis;index<positions.length;index+=3){min=Math.min(min,positions[index]);max=Math.max(max,positions[index])}
  return [min,max];
}

function pointAxisRangeBeyondX(points,minX,axis=1) {
  const positions=points?.geometry?.attributes?.position?.array;
  if(!positions?.length)return null;
  let min=Infinity;let max=-Infinity;
  for(let index=0;index<positions.length;index+=3){if(positions[index]<minX)continue;const value=positions[index+axis];min=Math.min(min,value);max=Math.max(max,value)}
  return Number.isFinite(min)?[min,max]:null;
}

function seeded01(value) {
  const result=Math.sin(value*12.9898+78.233)*43758.5453;
  return result-Math.floor(result);
}

function createRoundParticleTexture() {
  const sprite=document.createElement('canvas');sprite.width=64;sprite.height=64;
  const context=sprite.getContext('2d');
  const gradient=context.createRadialGradient(32,32,1,32,32,31);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.52,'rgba(255,255,255,.96)');gradient.addColorStop(.78,'rgba(255,255,255,.48)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  context.fillStyle=gradient;context.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(sprite);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;return texture;
}

const ROUND_PARTICLE_TEXTURE=createRoundParticleTexture();

function updateLoading(progress, title, detail) {
  $('loading-progress').style.width = `${progress}%`;
  if (title) $('loading-title').textContent = title;
  if (detail) $('loading-detail').textContent = detail;
}

function createBackdrop() {
  const floor = mesh(new THREE.CircleGeometry(13, 96), new THREE.MeshStandardMaterial({color:0xc4ddec,roughness:.92,metalness:.06,transparent:true,opacity:.78}), [0,-4.15,0], [-Math.PI/2,0,0]);
  floor.receiveShadow = true;
  scene.add(floor);
  const ringMat = new THREE.LineBasicMaterial({color:0x4a98bd,transparent:true,opacity:.26});
  for (const radius of [3.6,6.2,9.3]) {
    const points = Array.from({length:128},(_,i)=>new THREE.Vector3(Math.cos(i/128*Math.PI*2)*radius,-4.12,Math.sin(i/128*Math.PI*2)*radius));
    scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),ringMat));
  }
  const grid = new THREE.GridHelper(24,24,0x6aa5c2,0x91bdd1);grid.position.y=-4.1;grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);
}

function createArrowGroup(color) {
  const group = new THREE.Group();
  for (let i=0;i<3;i++) {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(-2.45-i*.48,2.66,(i-1)*.18),.58,color,.17,.1);
    group.add(arrow);
  }
  return group;
}

class EngineModel {
  constructor(type) {
    this.type = type;
    this.profile = ENGINE_GEOMETRY[type];
    this.root = new THREE.Group();
    this.root.name = `${type}-engine`;
    this.parts = new Map();
    this.hiddenParts = new Set();
    this.labels = [];
    this.elapsed = 0;
    this.build();
    scene.add(this.root);
  }

  addPart(id, group, explode, labelOffset=[0,0,0]) {
    group.name = `${this.type}-${id}`;
    group.userData.explode = new THREE.Vector3(...explode);
    group.userData.partId = id;
    group.userData.engineType = this.type;
    group.traverse(child=>{
      if (!child.isMesh) return;
      child.userData.partId=id;
      child.userData.engineType=this.type;
      child.userData.partGroup=group;
      if (child.material?.emissive) {
        child.material.userData.baseEmissive = child.material.emissive.getHex();
        child.material.userData.baseEmissiveIntensity = child.material.emissiveIntensity;
      }
      interactiveMeshes.push(child);
    });
    this.parts.set(id, group);
    const anchor = new THREE.Object3D();anchor.position.set(...labelOffset);group.add(anchor);
    const copy=getPartCopy(this.type,id);
    const element=document.createElement('div');element.className='model-label hidden';element.dataset.engine=this.type;element.dataset.part=id;element.tabIndex=-1;element.setAttribute('role','note');element.setAttribute('aria-label',`${this.type==='gasoline'?'汽油机':'柴油机'}：${copy.name}。${copy.description}`);element.innerHTML=`<i></i><span><b>${copy.name}</b><small>${copy.description}</small></span>`;
    element.addEventListener('click',event=>{event.stopPropagation();selectPart(this.type,id,'label')});
    $('model-labels').appendChild(element);
    const entry={engine:this,partId:id,anchor,element};this.labels.push(entry);labelEntries.push(entry);
    this.root.add(group);
    return group;
  }

  build() {
    const profile=this.profile;
    const steel=()=>material(this.type==='diesel'?0x587784:0x6f8d99,{roughness:.36,metalness:.72});
    const darkSteel=()=>material(0x314c59,{roughness:.4,metalness:.76});
    const alloy=()=>material(0xb6c7cc,{roughness:.32,metalness:.62});
    const copper=()=>material(0xc9793e,{roughness:.36,metalness:.58});
    const valveIn=()=>material(0x1ba8c5,{roughness:.34,metalness:.64});
    const valveOut=()=>material(0xd26443,{roughness:.34,metalness:.64});

    const housing = new THREE.Group();
    this.housingMaterial = material(this.type==='diesel'?0x426b78:0x50808e,{roughness:.48,metalness:.48,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
    const ringTube=this.type==='diesel'?.14:.075;
    const wall=mesh(new THREE.CylinderGeometry(profile.cylinderRadius,profile.cylinderRadius,profile.cylinderHeight,64,1,true,-Math.PI*.22,Math.PI*1.48),this.housingMaterial,[0,profile.cylinderCenterY,0]);housing.add(wall);
    const topRing=mesh(new THREE.TorusGeometry(profile.cylinderRadius-.01,ringTube,12,64,Math.PI*1.48),darkSteel(),[0,profile.cylinderTop,0],[Math.PI/2,0,-Math.PI*.22]);housing.add(topRing);
    const bottomRing=topRing.clone();bottomRing.material=darkSteel();bottomRing.position.y=profile.cylinderBottom;housing.add(bottomRing);
    const base=mesh(new THREE.BoxGeometry(profile.baseWidth,profile.baseHeight,profile.baseDepth),darkSteel(),[0,profile.baseY,0]);housing.add(base);
    const leftRail=mesh(new THREE.BoxGeometry(profile.railWidth,profile.railHeight,profile.railDepth),steel(),[-profile.railX,profile.railCenterY,-.95]);const rightRail=leftRail.clone();rightRail.material=steel();rightRail.position.x=profile.railX;housing.add(leftRail,rightRail);
    this.addPart('cylinder',housing,[-2.7,.1,-.7],[1.52,2.0,.2]);

    const cylinderHead=new THREE.Group();
    const headCenterY=profile.cylinderTop+profile.headHeight/2;
    cylinderHead.add(mesh(new THREE.BoxGeometry(profile.headWidth,profile.headHeight,profile.headDepth),steel(),[0,headCenterY,0]));
    this.cylinderHead=this.addPart('cylinderHead',cylinderHead,[0,2.25,.25],[profile.headWidth*.4,headCenterY,.15]);

    const intakePort=new THREE.Group();
    intakePort.add(mesh(new THREE.CylinderGeometry(.34,.46,2.1,28),valveIn(),[-2.22,2.75,0],[0,0,Math.PI/2]));
    this.intakePort=this.addPart('intakePort',intakePort,[-2.9,.65,.35],[-2.2,2.76,.25]);

    const exhaustPort=new THREE.Group();
    exhaustPort.add(mesh(new THREE.CylinderGeometry(.38,.34,2.1,28),valveOut(),[2.22,2.75,0],[0,0,Math.PI/2]));
    this.exhaustPort=this.addPart('exhaustPort',exhaustPort,[2.9,.65,.35],[2.2,2.76,.25]);

    const piston=new THREE.Group();
    const pistonHeight=profile.pistonHeight;
    const pistonBodyCenter=profile.pistonTopOffset-pistonHeight/2;
    const pistonBody=mesh(new THREE.CylinderGeometry(profile.pistonRadius,profile.pistonRadius*.965,pistonHeight,48),alloy(),[0,pistonBodyCenter,0]);piston.add(pistonBody);
    if(this.type==='diesel'){
      piston.add(mesh(new THREE.CylinderGeometry(.62,.76,.12,32),darkSteel(),[0,profile.pistonTopOffset-.02,0]));
      piston.add(mesh(new THREE.TorusGeometry(.74,.09,10,40),copper(),[0,profile.pistonTopOffset+.025,0],[Math.PI/2,0,0]));
    }
    for(const y of [profile.pistonTopOffset-.17,profile.pistonTopOffset-.33])piston.add(mesh(new THREE.TorusGeometry(profile.pistonRadius*.995,this.type==='diesel'?.052:.032,8,48),copper(),[0,y,0],[Math.PI/2,0,0]));
    piston.add(mesh(new THREE.CylinderGeometry(this.type==='diesel'?.26:.17,this.type==='diesel'?.26:.17,profile.pistonRadius*1.85,24),darkSteel(),[0,0,0],[Math.PI/2,0,0]));
    this.piston=this.addPart('piston',piston,[2.75,1.6,.25],[1.25,.45,0]);

    const rod=new THREE.Group();
    this.rodBeam=mesh(new THREE.CylinderGeometry(profile.rodTopRadius,profile.rodBottomRadius,1,22),copper());rod.add(this.rodBeam);
    this.rodTop=mesh(new THREE.TorusGeometry(profile.rodTopEye,profile.rodTopRadius*.55,12,30),copper(),[0,0,0]);rod.add(this.rodTop);
    this.rodBottom=mesh(new THREE.TorusGeometry(profile.rodBottomEye,profile.rodBottomRadius*.48,12,30),copper(),[0,0,0]);rod.add(this.rodBottom);
    this.rod=this.addPart('connectingRod',rod,[2.9,-.8,.55],[.55,0,.15]);

    const crank=new THREE.Group();
    const mainJournalRadius=this.type==='diesel'?.38:.27;
    crank.add(mesh(new THREE.CylinderGeometry(mainJournalRadius,mainJournalRadius,4.2,32),darkSteel(),[0,0,0],[Math.PI/2,0,0]));
    for(const z of [-.5,.5]){
      crank.add(mesh(new THREE.CylinderGeometry(profile.crankRadius*.58,profile.crankRadius*.58,this.type==='diesel'?.3:.2,32),steel(),[0,0,z],[Math.PI/2,0,0]));
      crank.add(mesh(new THREE.BoxGeometry(profile.crankWebWidth,profile.crankRadius+profile.crankPinRadius*2,.3),steel(),[0,profile.crankRadius/2,z]));
    }
    this.crankPin=mesh(new THREE.CylinderGeometry(profile.crankPinRadius,profile.crankPinRadius,1.35,28),copper(),[0,profile.crankRadius,0],[Math.PI/2,0,0]);crank.add(this.crankPin);
    this.mainJournal=mesh(new THREE.CylinderGeometry(mainJournalRadius*1.16,mainJournalRadius*1.16,.26,32),material(0x174f6b,{roughness:.3,metalness:.82}),[0,0,.84],[Math.PI/2,0,0]);crank.add(this.mainJournal);
    this.crankOrbit=mesh(new THREE.TorusGeometry(profile.crankRadius,.025,8,72),new THREE.MeshBasicMaterial({color:0x148fc4,transparent:true,opacity:.72,depthWrite:false,toneMapped:false}),[0,0,.86]);this.crankOrbit.castShadow=false;this.crankOrbit.receiveShadow=false;crank.add(this.crankOrbit);
    const axisMark=mesh(new THREE.TorusGeometry(mainJournalRadius*1.34,.035,8,40),new THREE.MeshBasicMaterial({color:0xbfefff,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}),[0,0,.87]);axisMark.castShadow=false;axisMark.receiveShadow=false;crank.add(axisMark);
    crank.userData.armCount=2;
    crank.userData.mainJournalAtRotationAxis=true;
    crank.userData.crankPinOffset=profile.crankRadius;
    this.crank=this.addPart('crankshaft',crank,[-2.6,-1.2,.3],[1.0,.2,1.2]);

    const flywheel=new THREE.Group();
    flywheel.add(mesh(new THREE.CylinderGeometry(profile.flywheelRadius,profile.flywheelRadius,this.type==='diesel'?.36:.24,48),darkSteel(),[0,0,-2.35],[Math.PI/2,0,0]));
    flywheel.add(mesh(new THREE.TorusGeometry(profile.flywheelRadius*.8,this.type==='diesel'?.15:.1,12,48),steel(),[0,0,-2.5]));
    for(let i=0;i<6;i++){const spoke=mesh(new THREE.BoxGeometry(this.type==='diesel'?.2:.12,profile.flywheelRadius*1.32,.15),steel(),[0,0,-2.51],[0,0,i*Math.PI/3]);flywheel.add(spoke)}
    this.flywheel=this.addPart('flywheel',flywheel,[-3.4,-1.4,-1.1],[1.35,0,-2.35]);

    this.intakeValve=this.buildValve(valveIn());
    this.intakeValve.position.set(-.68,3.12,0);
    this.addPart('intakeValve',this.intakeValve,[-2.35,1.45,.15],[0,.15,.15]);
    this.exhaustValve=this.buildValve(valveOut());
    this.exhaustValve.position.set(.68,3.12,0);
    this.addPart('exhaustValve',this.exhaustValve,[2.35,1.45,.15],[0,.15,.15]);

    const camshaft=new THREE.Group();
    camshaft.add(mesh(new THREE.CylinderGeometry(.17,.17,3.25,24),darkSteel(),[0,0,0],[Math.PI/2,0,0]));
    for(const z of [-.55,.55])camshaft.add(mesh(new THREE.SphereGeometry(.38,24,16),steel(),[z<0?-.68:.68,0,z],[0,0,z<0?-.5:.5]));
    camshaft.position.set(0,4.18,0);
    this.camshaft=this.addPart('camshaft',camshaft,[0,2.3,-1.4],[1.25,0,0]);

    const ignition=new THREE.Group();
    if(this.type==='gasoline'){
      ignition.add(mesh(new THREE.CylinderGeometry(.18,.18,.88,20),material(0xe6e9df,{roughness:.7,metalness:.08}),[0,.22,0]));
      ignition.add(mesh(new THREE.CylinderGeometry(.1,.1,.62,18),copper(),[0,-.46,0]));
      ignition.add(mesh(new THREE.TorusGeometry(.22,.05,8,20),darkSteel(),[0,.42,0],[Math.PI/2,0,0]));
      for(const y of [.08,.22,.36])ignition.add(mesh(new THREE.TorusGeometry(.2,.025,7,18),material(0xd2d8cf,{roughness:.72,metalness:.05}),[0,y,0],[Math.PI/2,0,0]));
    }else{
      ignition.add(mesh(new THREE.CylinderGeometry(.13,.2,1.18,20),steel(),[0,.05,0]));
      ignition.add(mesh(new THREE.ConeGeometry(.09,.58,18),darkSteel(),[0,-.78,0],[0,0,Math.PI]));
      ignition.add(mesh(new THREE.CylinderGeometry(.29,.29,.25,6),copper(),[0,.72,0]));
      ignition.add(mesh(new THREE.CylinderGeometry(.1,.1,1.05,18),copper(),[.48,.48,0],[0,0,Math.PI/2]));
      ignition.add(mesh(new THREE.CylinderGeometry(.2,.2,.26,18),steel(),[.98,.48,0],[0,0,Math.PI/2]));
    }
    ignition.position.set(0,3.82,0);
    this.ignition=this.addPart('ignition',ignition,[0,2.7,.25],[.65,.55,0]);

    this.gasMaterial=material(0x55dfff,{roughness:1,metalness:0,transparent:true,opacity:.12,depthWrite:false,emissive:0x1c6e82,emissiveIntensity:.35});
    this.gas=mesh(new THREE.CylinderGeometry(profile.pistonRadius+.1,profile.pistonRadius+.1,1,40,1,false),this.gasMaterial);this.gas.castShadow=false;this.gas.receiveShadow=false;this.gas.renderOrder=1;this.root.add(this.gas);
    this.combustionGlow=mesh(new THREE.CylinderGeometry(profile.pistonRadius+.14,profile.pistonRadius+.14,1,40,1,false),new THREE.MeshBasicMaterial({color:0xc6270f,transparent:true,opacity:.38,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false}));this.combustionGlow.castShadow=false;this.combustionGlow.receiveShadow=false;this.combustionGlow.visible=false;this.combustionGlow.renderOrder=2;this.root.add(this.combustionGlow);
    this.particles=this.buildParticles();this.particles.renderOrder=3;this.particles.material.depthTest=false;this.root.add(this.particles);
    this.fuelMist=this.buildFuelMist();this.root.add(this.fuelMist);
    this.exhaustPlume=this.buildExhaustPlume();this.root.add(this.exhaustPlume);
    this.intakeFlow=createArrowGroup(0x60ddff);this.root.add(this.intakeFlow);
    this.exhaustFlow=createArrowGroup(EXHAUST_PARTICLE_COLOR);this.exhaustFlow.position.x=4.9;this.root.add(this.exhaustFlow);
    this.spark=mesh(new THREE.IcosahedronGeometry(.22,1),new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.95}),[0,2.82,0]);this.spark.visible=false;this.root.add(this.spark);
    this.sparkLight=new THREE.PointLight(0xffa53f,0,5,2);this.sparkLight.position.set(0,2.25,0);this.root.add(this.sparkLight);
    this.injection=this.buildInjection();this.root.add(this.injection);
  }

  buildValve(mat) {
    const group=new THREE.Group();
    group.add(mesh(new THREE.CylinderGeometry(.105,.105,1.25,18),mat,[0,.45,0]));
    group.add(mesh(new THREE.CylinderGeometry(.42,.28,.16,28),mat,[0,-.22,0]));
    group.add(mesh(new THREE.TorusGeometry(.22,.045,8,24),material(0x91a3a8,{roughness:.4,metalness:.75}),[0,1.02,0],[Math.PI/2,0,0]));
    return group;
  }

  buildParticles() {
    const count=96;const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*2;positions[i*3+1]=Math.random();positions[i*3+2]=(Math.random()-.5)*2}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const mat=new THREE.PointsMaterial({color:0x82eaff,size:.055,transparent:true,opacity:.68,depthWrite:false,blending:THREE.AdditiveBlending});
    const points=new THREE.Points(geometry,mat);points.userData.seed=positions.slice();return points;
  }

  buildFuelMist() {
    const count=this.type==='gasoline'?168:0;
    const positions=new Float32Array(count*3);
    const phase=new Float32Array(count);
    const lateral=new Float32Array(count);
    const vertical=new Float32Array(count);
    for(let i=0;i<count;i++){
      phase[i]=seeded01(i+1);
      lateral[i]=seeded01(i+101)*2-1;
      vertical[i]=seeded01(i+211)*2-1;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const halo=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x6e5a00,size:9.5,map:ROUND_PARTICLE_TEXTURE,alphaTest:.02,sizeAttenuation:false,transparent:true,opacity:.62,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false}));halo.renderOrder=4;
    const mat=new THREE.PointsMaterial({color:FUEL_MIST_COLOR,size:5.4,map:ROUND_PARTICLE_TEXTURE,alphaTest:.04,sizeAttenuation:false,transparent:true,opacity:1,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false});
    const points=new THREE.Points(geometry,mat);points.add(halo);points.userData.phase=phase;points.userData.lateral=lateral;points.userData.vertical=vertical;points.userData.halo=halo;points.userData.flowDirection='intake-to-chamber';points.renderOrder=5;points.visible=false;return points;
  }

  buildExhaustPlume() {
    const count=180;
    const positions=new Float32Array(count*3);
    const phase=new Float32Array(count);
    const lateral=new Float32Array(count);
    const vertical=new Float32Array(count);
    const speed=new Float32Array(count);
    for(let i=0;i<count;i++){
      phase[i]=seeded01(i+401);
      lateral[i]=seeded01(i+503)*2-1;
      vertical[i]=seeded01(i+607)*2-1;
      speed[i]=.82+seeded01(i+709)*.36;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const halo=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x596168,size:10,map:ROUND_PARTICLE_TEXTURE,alphaTest:.015,sizeAttenuation:false,transparent:true,opacity:.2,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false}));halo.renderOrder=5;
    const mat=new THREE.PointsMaterial({color:EXHAUST_PARTICLE_COLOR,size:4.2,map:ROUND_PARTICLE_TEXTURE,alphaTest:.04,sizeAttenuation:false,transparent:true,opacity:.78,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false});
    const points=new THREE.Points(geometry,mat);points.add(halo);points.userData.phase=phase;points.userData.lateral=lateral;points.userData.vertical=vertical;points.userData.speed=speed;points.userData.halo=halo;points.userData.flowDirection='chamber-to-exhaust';points.renderOrder=6;points.visible=false;return points;
  }

  buildInjection() {
    const count=this.type==='diesel'?96:0;
    const positions=new Float32Array(count*3);
    const phase=new Float32Array(count);
    const azimuth=new Float32Array(count);
    const radius=new Float32Array(count);
    const speed=new Float32Array(count);
    for(let i=0;i<count;i++){
      phase[i]=seeded01(i+811);
      azimuth[i]=(i%7)/7*Math.PI*2+(seeded01(i+919)-.5)*.2;
      radius[i]=.38+seeded01(i+1021)*.62;
      speed[i]=.86+seeded01(i+1129)*.3;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const halo=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x765000,size:7.6,map:ROUND_PARTICLE_TEXTURE,alphaTest:.02,sizeAttenuation:false,transparent:true,opacity:.42,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false}));halo.renderOrder=6;
    const mat=new THREE.PointsMaterial({color:DIESEL_SPRAY_COLOR,size:4.8,map:ROUND_PARTICLE_TEXTURE,alphaTest:.04,sizeAttenuation:false,transparent:true,opacity:1,depthWrite:false,depthTest:false,blending:THREE.NormalBlending,toneMapped:false});
    const points=new THREE.Points(geometry,mat);points.add(halo);points.userData.phase=phase;points.userData.azimuth=azimuth;points.userData.radius=radius;points.userData.speed=speed;points.userData.halo=halo;points.userData.nozzleY=this.profile.chamberTop-.035;points.userData.flowDirection='injector-to-chamber';points.renderOrder=7;points.visible=false;return points;
  }

  setRootLayout(mode) {
    if(mode==='compare'){
      const portrait=innerWidth<700&&innerHeight>innerWidth;
      const widePanels=innerWidth>1050;
      const shortLandscape=innerHeight<=560&&innerWidth>innerHeight;
      this.root.visible=true;
      this.root.scale.setScalar(portrait?.54:(shortLandscape?.56:(widePanels?.58:.64)));
      const x=widePanels?(this.type==='gasoline'?-3.2:2.15):(this.type==='gasoline'?-3.25:3.25);
      this.root.position.set(portrait?0:x,portrait?(this.type==='gasoline'?2.45:-2.55):(shortLandscape?-.35:-.2),0);
    }else{
      this.root.visible=mode===this.type;
      const compact=innerWidth<=1050;
      const portrait=innerWidth<700&&innerHeight>innerWidth;
      const shortLandscape=innerHeight<=560&&innerWidth>innerHeight;
      this.root.scale.setScalar(portrait?.7:(shortLandscape?.63:(compact?.86:.92)));
      const portraitY=this.type==='diesel'?-.12:-.25;
      const shortLandscapeY=this.type==='diesel'?-.66:-.9;
      const desktopY=this.type==='diesel'?-.4:-.24;
      this.root.position.set(0,portrait?portraitY:(shortLandscape?shortLandscapeY:desktopY),0);
    }
  }

  restoreParts() { this.hiddenParts.clear();for(const group of this.parts.values())group.visible=true; }

  getConnectionError() {
    this.root.updateMatrixWorld(true);
    return this.crankPin.getWorldPosition(new THREE.Vector3()).distanceTo(this.rodBottom.getWorldPosition(new THREE.Vector3()));
  }

  update(angle, view, explodeAmount, elapsed) {
    this.elapsed=elapsed;
    const cycle=getCycleState(angle,this.type);
    const profile=this.profile;
    const mechanism=sliderCrankPosition(angle,profile.crankRadius,profile.rodLength,profile.crankY);
    const explode=view==='exploded'?explodeAmount:0;
    const setPosition=(group,x,y,z=0)=>group.position.set(x+group.userData.explode.x*explode,y+group.userData.explode.y*explode,z+group.userData.explode.z*explode);

    setPosition(this.piston,0,mechanism.pistonPinY,0);
    const crankWorld=new THREE.Vector3(mechanism.crankX,mechanism.crankPinY,0);
    const pistonWorld=new THREE.Vector3(0,mechanism.pistonPinY,0);
    this.rod.position.copy(crankWorld).add(pistonWorld).multiplyScalar(.5).addScaledVector(this.rod.userData.explode,explode);
    tmpC.copy(pistonWorld).sub(crankWorld);this.rod.quaternion.setFromUnitVectors(yAxis,tmpC.clone().normalize());
    this.rodBeam.scale.y=tmpC.length();this.rodTop.position.set(0,tmpC.length()/2,0);this.rodBottom.position.set(0,-tmpC.length()/2,0);
    setPosition(this.crank,0,profile.crankY,0);this.crank.rotation.z=-mechanism.crankAngle;
    setPosition(this.flywheel,0,profile.crankY,0);this.flywheel.rotation.z=-mechanism.crankAngle;
    setPosition(this.intakeValve,-.68,3.12-cycle.intakeLift*.42,0);
    setPosition(this.exhaustValve,.68,3.12-cycle.exhaustLift*.42,0);
    setPosition(this.camshaft,0,4.18,0);this.camshaft.rotation.z=-mechanism.crankAngle/2;
    setPosition(this.ignition,0,3.82,0);
    const housing=this.parts.get('cylinder');setPosition(housing,0,0,0);
    setPosition(this.cylinderHead,0,0,0);
    setPosition(this.intakePort,0,0,0);
    setPosition(this.exhaustPort,0,0,0);
    this.housingMaterial.opacity=view==='solid'?.76:view==='exploded'?.1:.17;
    this.housingMaterial.depthWrite=view==='solid';

    const pistonTop=mechanism.pistonPinY+profile.pistonTopOffset;
    const chamberTop=profile.chamberTop;
    const chamberHeight=Math.max(.2,chamberTop-pistonTop);
    this.gas.position.set(0,pistonTop+chamberHeight/2,0);this.gas.scale.set(1,chamberHeight,1);
    this.combustionGlow.position.copy(this.gas.position);this.combustionGlow.scale.set(1,chamberHeight,1);this.combustionGlow.visible=cycle.combustion&&view!=='solid'&&view!=='exploded';
    const isExhaust=cycle.gasKind==='exhaust';
    const gasColors={air:0x5ed8ff,mixture:0x70e5c0,combustion:0xd33512,exhaust:EXHAUST_GAS_COLOR};
    this.gasMaterial.color.setHex(gasColors[cycle.gasKind]);this.gasMaterial.emissive.setHex(cycle.combustion?0x760b03:(isExhaust?0x090c0f:0x0d5266));this.gasMaterial.emissiveIntensity=cycle.combustion?.78:(isExhaust?.1:.35);this.gasMaterial.opacity=cycle.combustion?.46:(isExhaust?.32:.12);
    const pointColors={air:0x8ceaff,mixture:0x8fffd7,combustion:0xffcc66,exhaust:EXHAUST_PARTICLE_COLOR};this.particles.material.color.setHex(pointColors[cycle.gasKind]);this.particles.material.opacity=cycle.combustion?1:(isExhaust?.98:.68);this.particles.material.size=cycle.combustion?.074:(isExhaust?.1:.055);const particleBlending=isExhaust?THREE.NormalBlending:THREE.AdditiveBlending;if(this.particles.material.blending!==particleBlending){this.particles.material.blending=particleBlending;this.particles.material.needsUpdate=true}
    const positions=this.particles.geometry.attributes.position.array;const seed=this.particles.userData.seed;
    for(let i=0;i<positions.length/3;i++){
      const swirl=elapsed*.36+i*.73;
      positions[i*3]=seed[i*3]*1.03+Math.sin(swirl)*.055;
      positions[i*3+1]=pistonTop+((seed[i*3+1]+elapsed*(cycle.strokeIndex===0?.15:cycle.strokeIndex===3?.22:.04))%1)*chamberHeight;
      positions[i*3+2]=seed[i*3+2]*1.03+Math.cos(swirl*.8)*.045;
    }
    this.particles.geometry.attributes.position.needsUpdate=true;
    const showFuelMist=this.type==='gasoline'&&cycle.strokeIndex===0&&view!=='exploded';
    this.fuelMist.visible=showFuelMist;
    if(showFuelMist){
      const mistPositions=this.fuelMist.geometry.attributes.position.array;
      const mistPhase=this.fuelMist.userData.phase;
      const mistLateral=this.fuelMist.userData.lateral;
      const mistVertical=this.fuelMist.userData.vertical;
      for(let i=0;i<mistPhase.length;i++){
        const phase=(mistPhase[i]+elapsed*.3+cycle.progress*.48)%1;
        if(phase<.48){
          const t=phase/.48;
          mistPositions[i*3]=-3.5+t*2.48;
          mistPositions[i*3+1]=2.75-t*.05+mistVertical[i]*.14+Math.sin(elapsed*2.4+i)*.025;
          mistPositions[i*3+2]=mistLateral[i]*.24;
        }else if(phase<.7){
          const t=(phase-.48)/.22;
          mistPositions[i*3]=-1.02+t*.9+mistLateral[i]*.06;
          mistPositions[i*3+1]=Math.max(pistonTop+.2,2.7-t*Math.max(.25,chamberHeight*.36)+mistVertical[i]*.1);
          mistPositions[i*3+2]=mistLateral[i]*(.24+t*.2);
        }else{
          const t=(phase-.7)/.3;
          const usableHeight=Math.max(.16,chamberHeight-.22);
          mistPositions[i*3]=mistLateral[i]*(.7+t*.2)+Math.sin(elapsed*1.7+i*.53)*.1;
          mistPositions[i*3+1]=pistonTop+.12+(mistVertical[i]*.5+.5)*usableHeight+Math.sin(elapsed*1.4+i*.37)*.045;
          mistPositions[i*3+2]=Math.sin(i*.81+elapsed*1.5)*(.38+t*.34);
        }
      }
      this.fuelMist.geometry.attributes.position.needsUpdate=true;
    }
    const showInjection=this.type==='diesel'&&cycle.injection&&view!=='exploded';
    this.injection.visible=showInjection;
    if(showInjection){
      const injectionPositions=this.injection.geometry.attributes.position.array;
      const injectionPhase=this.injection.userData.phase;
      const injectionAzimuth=this.injection.userData.azimuth;
      const injectionRadius=this.injection.userData.radius;
      const injectionSpeed=this.injection.userData.speed;
      const nozzleY=this.injection.userData.nozzleY;
      const chamberFloor=pistonTop+.035;
      const sprayDepth=Math.max(.045,nozzleY-chamberFloor);
      const sprayRadius=Math.min(profile.pistonRadius*.72,.2+sprayDepth*3.6);
      for(let i=0;i<injectionPhase.length;i++){
        const phase=(injectionPhase[i]+elapsed*.92*injectionSpeed[i]+Math.max(0,cycle.progress-.9)*2.4)%1;
        const t=Math.pow(phase,.72);
        const fanRadius=sprayRadius*t*injectionRadius[i];
        injectionPositions[i*3]=Math.cos(injectionAzimuth[i])*fanRadius+Math.sin(elapsed*4+i)*.012*t;
        injectionPositions[i*3+1]=Math.max(chamberFloor,nozzleY-sprayDepth*t);
        injectionPositions[i*3+2]=Math.sin(injectionAzimuth[i])*fanRadius+Math.cos(elapsed*3.6+i*.7)*.012*t;
      }
      this.injection.geometry.attributes.position.needsUpdate=true;
    }
    const showExhaustPlume=cycle.strokeIndex===3&&view!=='exploded';
    this.exhaustPlume.visible=showExhaustPlume;
    if(showExhaustPlume){
      const plumePositions=this.exhaustPlume.geometry.attributes.position.array;
      const plumePhase=this.exhaustPlume.userData.phase;
      const plumeLateral=this.exhaustPlume.userData.lateral;
      const plumeVertical=this.exhaustPlume.userData.vertical;
      const plumeSpeed=this.exhaustPlume.userData.speed;
      for(let i=0;i<plumePhase.length;i++){
        const phase=(plumePhase[i]+elapsed*.2*plumeSpeed[i]+cycle.progress*.4)%1;
        if(phase<.28){
          const t=phase/.28;
          plumePositions[i*3]=(-.35+plumeLateral[i]*.48)*(1-t)+t;
          plumePositions[i*3+1]=(pistonTop+chamberHeight*(.3+(plumeVertical[i]*.5+.5)*.5))*(1-t)+2.72*t;
          plumePositions[i*3+2]=plumeLateral[i]*(.45-t*.28);
        }else if(phase<.66){
          const t=(phase-.28)/.38;
          plumePositions[i*3]=1+t*2.3+plumeLateral[i]*.035;
          plumePositions[i*3+1]=2.72+plumeVertical[i]*.11+Math.sin(elapsed*2+i)*.025;
          plumePositions[i*3+2]=plumeLateral[i]*.16;
        }else{
          const t=(phase-.66)/.34;
          const spread=.18+t*.72;
          plumePositions[i*3]=3.3+t*(1.55+(plumeSpeed[i]-.82)*.8)+plumeLateral[i]*.12;
          plumePositions[i*3+1]=2.72+t*.1+plumeVertical[i]*spread+Math.sin(elapsed*2+i*.8)*(.05+t*.14);
          plumePositions[i*3+2]=plumeLateral[i]*(.2+t*.6);
        }
      }
      this.exhaustPlume.geometry.attributes.position.needsUpdate=true;
    }
    this.intakeFlow.visible=cycle.strokeIndex===0;
    this.exhaustFlow.visible=showExhaustPlume;
    this.spark.visible=cycle.spark;this.spark.scale.setScalar(.8+Math.sin(elapsed*36)*.35);this.sparkLight.color.setHex(cycle.combustion?0xff4e22:0xffa53f);this.sparkLight.intensity=cycle.spark?8.5:cycle.combustion?4.2:0;
    for(const [id,group] of this.parts)group.visible=!this.hiddenParts.has(id);
  }
}

class InlineFourModel {
  constructor() {
    this.type='inline4';
    this.profile=INLINE_FOUR_GEOMETRY;
    this.root=new THREE.Group();
    this.root.name='inline-four-gasoline-engine';
    this.parts=new Map();
    this.hiddenParts=new Set();
    this.labels=[];
    this.pistons=[];
    this.rods=[];
    this.throws=[];
    this.crankPins=[];
    this.intakeValves=[];
    this.exhaustValves=[];
    this.gases=[];
    this.particleClouds=[];
    this.combustionGlows=[];
    this.sparks=[];
    this.sparkLights=[];
    this.states=getInlineFourStates(0);
    this.build();
    scene.add(this.root);
  }

  addPart(id, group, labelOffset=[0,0,0]) {
    group.name=`inline4-${id}`;
    group.userData.partId=id;
    group.userData.engineType=this.type;
    group.traverse(child=>{
      if(!child.isMesh)return;
      child.userData.partId=id;
      child.userData.engineType=this.type;
      child.userData.partGroup=group;
      if(child.material?.emissive){
        child.material.userData.baseEmissive=child.material.emissive.getHex();
        child.material.userData.baseEmissiveIntensity=child.material.emissiveIntensity;
      }
      interactiveMeshes.push(child);
    });
    this.parts.set(id,group);
    const anchor=new THREE.Object3D();anchor.position.set(...labelOffset);group.add(anchor);
    const copy=getPartCopy(this.type,id);
    const element=document.createElement('div');
    element.className='model-label hidden';element.dataset.engine=this.type;element.dataset.part=id;element.tabIndex=-1;element.setAttribute('role','note');element.setAttribute('aria-label',`${engineName(this.type)}：${copy.name}。${copy.description}`);element.innerHTML=`<i></i><span><b>${copy.name}</b><small>${copy.description}</small></span>`;
    element.addEventListener('click',event=>{event.stopPropagation();selectPart(this.type,id,'label')});
    $('model-labels').appendChild(element);
    const entry={engine:this,partId:id,anchor,element};this.labels.push(entry);labelEntries.push(entry);
    this.root.add(group);
    return group;
  }

  build() {
    const profile=this.profile;
    const steel=()=>material(0x688b98,{roughness:.38,metalness:.68});
    const dark=()=>material(0x2d4856,{roughness:.4,metalness:.78});
    const alloy=()=>material(0xb8c9ce,{roughness:.3,metalness:.65});
    const copper=()=>material(0xc77739,{roughness:.34,metalness:.62});
    const intake=()=>material(0x1aa6c4,{roughness:.34,metalness:.62});
    const exhaust=()=>material(0xcc593b,{roughness:.34,metalness:.62});

    this.housingMaterials=[];
    const housing=new THREE.Group();
    for(const x of profile.cylinderX){
      const shellMaterial=material(0x557f8d,{roughness:.5,metalness:.5,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
      this.housingMaterials.push(shellMaterial);
      housing.add(mesh(new THREE.CylinderGeometry(profile.cylinderRadius,profile.cylinderRadius,profile.cylinderHeight,40,1,true,-Math.PI*.2,Math.PI*1.46),shellMaterial,[x,profile.cylinderCenterY,0]));
      housing.add(mesh(new THREE.TorusGeometry(profile.cylinderRadius-.015,.055,8,40,Math.PI*1.46),dark(),[x,profile.cylinderCenterY+profile.cylinderHeight/2,0],[Math.PI/2,0,-Math.PI*.2]));
      housing.add(mesh(new THREE.TorusGeometry(profile.cylinderRadius-.015,.055,8,40,Math.PI*1.46),dark(),[x,profile.cylinderCenterY-profile.cylinderHeight/2,0],[Math.PI/2,0,-Math.PI*.2]));
    }
    housing.add(mesh(new THREE.BoxGeometry(8.35,.66,2.35),dark(),[0,-2.72,0]));
    housing.add(mesh(new THREE.BoxGeometry(.22,5.16,.35),steel(),[-3.78,.05,-.88]));
    housing.add(mesh(new THREE.BoxGeometry(.22,5.16,.35),steel(),[3.78,.05,-.88]));
    this.addPart('cylinder',housing,[3.65,1.55,.5]);

    const head=new THREE.Group();
    head.add(mesh(new THREE.BoxGeometry(7.72,.48,2.2),steel(),[0,2.91,0]));
    for(const x of profile.cylinderX)head.add(mesh(new THREE.TorusGeometry(.55,.055,8,32),dark(),[x,2.66,0],[Math.PI/2,0,0]));
    this.addPart('cylinderHead',head,[3.25,2.92,.65]);

    const intakePorts=new THREE.Group();
    const exhaustPorts=new THREE.Group();
    for(const x of profile.cylinderX){
      intakePorts.add(mesh(new THREE.CylinderGeometry(.15,.23,1.12,20),intake(),[x,2.66,-.92],[Math.PI/2,0,0]));
      exhaustPorts.add(mesh(new THREE.CylinderGeometry(.16,.24,1.12,20),exhaust(),[x,2.66,.92],[Math.PI/2,0,0]));
    }
    this.addPart('intakePort',intakePorts,[-3.25,2.66,-1.42]);
    this.addPart('exhaustPort',exhaustPorts,[3.25,2.66,1.42]);

    const pistonPart=new THREE.Group();
    for(const x of profile.cylinderX){
      const piston=new THREE.Group();
      piston.add(mesh(new THREE.CylinderGeometry(.65,.63,profile.pistonHeight,36),alloy(),[0,profile.pistonTopOffset-profile.pistonHeight/2,0]));
      for(const y of [profile.pistonTopOffset-.12,profile.pistonTopOffset-.24])piston.add(mesh(new THREE.TorusGeometry(.65,.025,7,36),copper(),[0,y,0],[Math.PI/2,0,0]));
      piston.add(mesh(new THREE.CylinderGeometry(.13,.13,1.18,18),dark(),[0,0,0],[0,0,Math.PI/2]));
      piston.position.x=x;pistonPart.add(piston);this.pistons.push(piston);
    }
    this.addPart('piston',pistonPart,[3.3,.35,.6]);

    const rodPart=new THREE.Group();
    for(let index=0;index<profile.cylinderX.length;index++){
      const beam=mesh(new THREE.CylinderGeometry(.105,.15,1,18),copper());
      const topEye=mesh(new THREE.TorusGeometry(.22,.075,10,24),copper(),[0,0,0],[0,Math.PI/2,0]);
      const bottomEye=mesh(new THREE.TorusGeometry(.29,.09,10,24),copper(),[0,0,0],[0,Math.PI/2,0]);
      rodPart.add(beam,topEye,bottomEye);this.rods.push({beam,topEye,bottomEye});
    }
    this.addPart('connectingRod',rodPart,[2.8,-.72,.5]);

    const crankPart=new THREE.Group();
    crankPart.add(mesh(new THREE.CylinderGeometry(.2,.2,8.15,32),dark(),[0,profile.crankY,0],[0,0,Math.PI/2]));
    for(const x of [-3.72,-1.9,0,1.9,3.72])crankPart.add(mesh(new THREE.CylinderGeometry(.32,.32,.22,28),material(0x174f6b,{roughness:.3,metalness:.82}),[x,profile.crankY,0],[0,0,Math.PI/2]));
    for(const x of profile.cylinderX){
      const crankThrow=new THREE.Group();crankThrow.position.set(x,profile.crankY,0);
      for(const localX of [-.24,.24]){
        crankThrow.add(mesh(new THREE.CylinderGeometry(.46,.46,.16,28),steel(),[localX,0,0],[0,0,Math.PI/2]));
        crankThrow.add(mesh(new THREE.BoxGeometry(.16,profile.crankRadius+.34,.34),steel(),[localX,profile.crankRadius/2,0]));
        crankThrow.add(mesh(new THREE.SphereGeometry(.29,20,14),dark(),[localX,-profile.crankRadius*.62,0]));
      }
      const crankPin=mesh(new THREE.CylinderGeometry(.19,.19,.72,24),copper(),[0,profile.crankRadius,0],[0,0,Math.PI/2]);crankThrow.add(crankPin);this.crankPins.push(crankPin);
      const orbit=mesh(new THREE.TorusGeometry(profile.crankRadius,.018,7,54),new THREE.MeshBasicMaterial({color:0x148fc4,transparent:true,opacity:.58,depthWrite:false,toneMapped:false}),[.44,0,0],[0,Math.PI/2,0]);orbit.castShadow=false;orbit.receiveShadow=false;crankThrow.add(orbit);
      crankPart.add(crankThrow);this.throws.push(crankThrow);
    }
    crankPart.userData.throwCount=4;crankPart.userData.mainJournalAtRotationAxis=true;
    this.addPart('crankshaft',crankPart,[3.35,profile.crankY,.65]);

    const flywheel=new THREE.Group();
    flywheel.position.set(-4.35,profile.crankY,0);
    flywheel.add(mesh(new THREE.CylinderGeometry(1.04,1.04,.3,44),dark(),[0,0,0],[0,0,Math.PI/2]));
    flywheel.add(mesh(new THREE.TorusGeometry(.78,.11,10,40),steel(),[-.17,0,0],[0,Math.PI/2,0]));
    for(let i=0;i<6;i++)flywheel.add(mesh(new THREE.BoxGeometry(.14,1.3,.12),steel(),[-.19,0,0],[i*Math.PI/3,0,Math.PI/2]));
    this.flywheel=this.addPart('flywheel',flywheel,[-.15,.85,.25]);

    const intakeValvePart=new THREE.Group();
    const exhaustValvePart=new THREE.Group();
    for(const x of profile.cylinderX){
      const inlet=this.buildValve(intake());inlet.position.set(x,2.96,-.34);intakeValvePart.add(inlet);this.intakeValves.push(inlet);
      const outlet=this.buildValve(exhaust());outlet.position.set(x,2.96,.34);exhaustValvePart.add(outlet);this.exhaustValves.push(outlet);
    }
    this.addPart('intakeValve',intakeValvePart,[-3.1,3.05,-.4]);
    this.addPart('exhaustValve',exhaustValvePart,[3.1,3.05,.4]);

    const camshaft=new THREE.Group();
    camshaft.position.set(0,3.72,0);
    camshaft.add(mesh(new THREE.CylinderGeometry(.13,.13,8,22),dark(),[0,0,0],[0,0,Math.PI/2]));
    for(const x of profile.cylinderX)camshaft.add(mesh(new THREE.SphereGeometry(.26,18,12),steel(),[x,0,0]));
    this.camshaft=this.addPart('camshaft',camshaft,[3.1,0,.35]);

    const ignitionPart=new THREE.Group();
    for(const x of profile.cylinderX){
      const plug=new THREE.Group();
      plug.add(mesh(new THREE.CylinderGeometry(.1,.1,.7,16),material(0xe3e8df,{roughness:.72,metalness:.08}),[0,.16,0]));
      plug.add(mesh(new THREE.CylinderGeometry(.06,.06,.43,14),copper(),[0,-.39,0]));
      plug.add(mesh(new THREE.TorusGeometry(.13,.025,7,16),dark(),[0,.35,0],[Math.PI/2,0,0]));
      plug.position.set(x,3.27,0);ignitionPart.add(plug);
    }
    this.addPart('ignition',ignitionPart,[3.15,3.46,.2]);

    for(const x of profile.cylinderX){
      const gasMaterial=material(0x70e5c0,{roughness:1,metalness:0,transparent:true,opacity:.12,depthWrite:false,emissive:0x0d5266,emissiveIntensity:.35});
      const gas=mesh(new THREE.CylinderGeometry(.7,.7,1,30),gasMaterial,[x,0,0]);gas.castShadow=false;gas.receiveShadow=false;gas.renderOrder=1;this.root.add(gas);this.gases.push(gas);
      const glow=mesh(new THREE.CylinderGeometry(.73,.73,1,30),new THREE.MeshBasicMaterial({color:0xc6270f,transparent:true,opacity:.4,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false}),[x,0,0]);glow.castShadow=false;glow.receiveShadow=false;glow.visible=false;glow.renderOrder=2;this.root.add(glow);this.combustionGlows.push(glow);
      const particleCount=34;const positions=new Float32Array(particleCount*3);const seed=new Float32Array(particleCount*3);
      for(let i=0;i<particleCount;i++){seed[i*3]=(Math.random()-.5)*1.15;seed[i*3+1]=Math.random();seed[i*3+2]=(Math.random()-.5)*1.15}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x8fffd7,size:.045,transparent:true,opacity:.68,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,toneMapped:false}));points.position.x=x;points.userData.seed=seed;points.renderOrder=3;this.root.add(points);this.particleClouds.push(points);
      const spark=mesh(new THREE.IcosahedronGeometry(.12,1),new THREE.MeshBasicMaterial({color:0xfff0a8,transparent:true,opacity:.98,toneMapped:false}),[x,2.61,0]);spark.castShadow=false;spark.receiveShadow=false;spark.visible=false;this.root.add(spark);this.sparks.push(spark);
      const sparkLight=new THREE.PointLight(0xff4e22,0,3.2,2);sparkLight.position.set(x,2.42,0);this.root.add(sparkLight);this.sparkLights.push(sparkLight);
    }
  }

  buildValve(mat) {
    const group=new THREE.Group();
    group.add(mesh(new THREE.CylinderGeometry(.06,.06,.72,14),mat,[0,.22,0]));
    group.add(mesh(new THREE.CylinderGeometry(.23,.15,.1,20),mat,[0,-.18,0]));
    return group;
  }

  setRootLayout(mode) {
    this.root.visible=mode==='inline4';
    const portrait=innerWidth<700&&innerHeight>innerWidth;
    const compact=innerWidth<=1050;
    const shortLandscape=innerHeight<=560&&innerWidth>innerHeight;
    this.root.scale.setScalar(portrait?.48:(shortLandscape?.58:(compact?.69:.86)));
    this.root.position.set(0,portrait?-.58:(shortLandscape?-.18:-.3),0);
  }

  restoreParts() {this.hiddenParts.clear();for(const group of this.parts.values())group.visible=true}

  getConnectionErrors() {
    if(!this.root.visible)return [];
    this.root.updateMatrixWorld(true);
    return this.crankPins.map((crankPin,index)=>crankPin.getWorldPosition(new THREE.Vector3()).distanceTo(this.rods[index].bottomEye.getWorldPosition(new THREE.Vector3())));
  }

  update(angle, view, _explodeAmount, elapsed) {
    if(!this.root.visible)return;
    const states=getInlineFourStates(angle);this.states=states;
    const profile=this.profile;
    const gasColors={air:0x5ed8ff,mixture:0x70e5c0,combustion:0xd33512,exhaust:EXHAUST_GAS_COLOR};
    const particleColors={air:0x8ceaff,mixture:0x8fffd7,combustion:0xffcc66,exhaust:EXHAUST_PARTICLE_COLOR};
    for(let index=0;index<states.length;index++){
      const cycle=states[index];
      const mechanism=sliderCrankPosition(cycle.angle,profile.crankRadius,profile.rodLength,profile.crankY);
      const x=profile.cylinderX[index];
      this.pistons[index].position.set(x,mechanism.pistonPinY,0);
      const crankPin=new THREE.Vector3(x,mechanism.crankPinY,mechanism.crankX);
      const pistonPin=new THREE.Vector3(x,mechanism.pistonPinY,0);
      const rod=this.rods[index];cylinderBetween(rod.beam,crankPin,pistonPin);rod.topEye.position.copy(pistonPin);rod.bottomEye.position.copy(crankPin);
      this.throws[index].rotation.x=mechanism.crankAngle;
      this.intakeValves[index].position.y=2.96-cycle.intakeLift*.28;
      this.exhaustValves[index].position.y=2.96-cycle.exhaustLift*.28;
      const pistonTop=mechanism.pistonPinY+profile.pistonTopOffset;
      const chamberHeight=Math.max(.16,profile.chamberTop-pistonTop);
      const isExhaust=cycle.gasKind==='exhaust';
      const gas=this.gases[index];gas.position.set(x,pistonTop+chamberHeight/2,0);gas.scale.set(1,chamberHeight,1);gas.material.color.setHex(gasColors[cycle.gasKind]);gas.material.emissive.setHex(cycle.combustion?0x760b03:(isExhaust?0x090c0f:0x0d5266));gas.material.emissiveIntensity=cycle.combustion?.78:(isExhaust?.1:.35);gas.material.opacity=cycle.combustion?.46:(isExhaust?.32:.12);gas.visible=view!=='solid';
      const glow=this.combustionGlows[index];glow.position.copy(gas.position);glow.scale.copy(gas.scale);glow.visible=cycle.combustion&&view!=='solid';
      const particles=this.particleClouds[index];particles.visible=view!=='solid';particles.material.color.setHex(particleColors[cycle.gasKind]);particles.material.opacity=cycle.combustion?1:(isExhaust?.98:.68);particles.material.size=cycle.combustion?.064:(isExhaust?.084:.045);const particleBlending=isExhaust?THREE.NormalBlending:THREE.AdditiveBlending;if(particles.material.blending!==particleBlending){particles.material.blending=particleBlending;particles.material.needsUpdate=true}
      const positions=particles.geometry.attributes.position.array;const seed=particles.userData.seed;
      for(let i=0;i<positions.length/3;i++){const swirl=elapsed*.42+i*.61;positions[i*3]=seed[i*3]+Math.sin(swirl)*.035;positions[i*3+1]=pistonTop+((seed[i*3+1]+elapsed*.045)%1)*chamberHeight;positions[i*3+2]=seed[i*3+2]+Math.cos(swirl*.8)*.035}
      particles.geometry.attributes.position.needsUpdate=true;
      this.sparks[index].visible=cycle.spark&&view!=='solid';this.sparks[index].scale.setScalar(.8+Math.sin(elapsed*34+index)*.28);this.sparkLights[index].intensity=cycle.spark?4.8:cycle.combustion?3.7:0;
    }
    this.flywheel.rotation.x=normalizeCycleAngle(angle)%(Math.PI*2);
    this.camshaft.rotation.x=-(normalizeCycleAngle(angle)%(Math.PI*4))/2;
    for(const housingMaterial of this.housingMaterials){housingMaterial.opacity=view==='solid'?.72:.16;housingMaterial.depthWrite=view==='solid'}
    for(const [id,group] of this.parts)group.visible=!this.hiddenParts.has(id);
  }
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0xf6fbff,0x8da7b6,2.05));
  const key=new THREE.DirectionalLight(0xffffff,3.25);key.position.set(6,10,8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const warm=new THREE.PointLight(0xffc48f,18,18,2);warm.position.set(-6,2,4);scene.add(warm);
  const cyan=new THREE.PointLight(0x76d9ff,15,18,2);cyan.position.set(6,1,-3);scene.add(cyan);
}

class EngineAudio {
  constructor() {
    this.context=null;
    this.master=null;
    this.compressor=null;
    this.voices={};
    this.volume=.76;
    this.startedAt=-Infinity;
    this.virtualRpms=[700,850,1100,1650,2500];
    this.forceImmediate=false;
    this.supported=Boolean(window.AudioContext||window.webkitAudioContext);
  }

  createNoiseBuffer(context) {
    const length=context.sampleRate*2;
    const buffer=context.createBuffer(1,length,context.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(.72+Math.sin(i*.017)*.08);
    return buffer;
  }

  createVoice(type, pan, noiseBuffer) {
    const context=this.context;
    const output=context.createGain();output.gain.value=0;
    const panner=context.createStereoPanner?context.createStereoPanner():context.createGain();
    if('pan' in panner)panner.pan.value=pan;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.Q.value=type==='diesel'?4.2:1.7;
    const tone=context.createOscillator();tone.type=type==='diesel'?'sawtooth':'triangle';
    const startRpm=this.virtualRpms[state.speedIndex];
    const runningFrequency=type==='diesel'?26+startRpm*.04:38+startRpm*.055;
    tone.frequency.value=runningFrequency;
    const toneGain=context.createGain();toneGain.gain.value=type==='diesel'?.18:.15;
    const harmonic=context.createOscillator();harmonic.type=type==='diesel'?'square':'sine';
    harmonic.frequency.value=runningFrequency*(type==='diesel'?1.72:2.28);
    const harmonicGain=context.createGain();harmonicGain.gain.value=type==='diesel'?.045:.04;
    const noise=context.createBufferSource();noise.buffer=noiseBuffer;noise.loop=true;
    const noiseFilter=context.createBiquadFilter();noiseFilter.type='bandpass';noiseFilter.frequency.value=type==='diesel'?460:820;noiseFilter.Q.value=type==='diesel'?3.5:1.7;
    const noiseGain=context.createGain();noiseGain.gain.value=type==='diesel'?.045:.018;
    const starter=context.createOscillator();starter.type=type==='diesel'?'sawtooth':'triangle';starter.frequency.value=type==='diesel'?68:104;
    const starterFilter=context.createBiquadFilter();starterFilter.type='lowpass';starterFilter.frequency.value=type==='diesel'?520:780;
    const starterGain=context.createGain();starterGain.gain.value=0;
    tone.connect(toneGain).connect(filter);
    harmonic.connect(harmonicGain).connect(filter);
    noise.connect(noiseFilter).connect(noiseGain).connect(filter);
    filter.connect(output).connect(panner).connect(this.master);
    starter.connect(starterFilter).connect(starterGain).connect(panner);
    tone.start();harmonic.start();noise.start();starter.start();
    return {type,output,filter,tone,toneGain,harmonic,harmonicGain,noiseGain,starter,starterGain};
  }

  async ensure() {
    if(!this.supported)return false;
    if(!this.context){
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      this.context=new AudioContextClass({latencyHint:'interactive'});
      this.master=this.context.createGain();this.master.gain.value=this.volume;
      this.compressor=this.context.createDynamicsCompressor();this.compressor.threshold.value=-20;this.compressor.knee.value=12;this.compressor.ratio.value=6;this.compressor.attack.value=.003;this.compressor.release.value=.16;
      this.master.connect(this.compressor).connect(this.context.destination);
      const noiseBuffer=this.createNoiseBuffer(this.context);
      this.voices.gasoline=this.createVoice('gasoline',-.35,noiseBuffer);
      this.voices.diesel=this.createVoice('diesel',.35,noiseBuffer);
    }
    if(this.context.state==='suspended')await this.context.resume();
    return true;
  }

  async toggle() {
    if(!state.audioEnabled){
      const ready=await this.ensure();
      if(!ready)return false;
      state.audioEnabled=true;
      this.triggerStart();
      this.forceImmediate=true;
    }else state.audioEnabled=false;
    this.update();
    this.updateButton();
    return state.audioEnabled;
  }

  triggerStart() {
    if(this.context)this.startedAt=this.context.currentTime-.22;
  }

  setVolume(value) {
    this.volume=THREE.MathUtils.clamp(value,0,1);
    if(this.master)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.04);
  }

  updateButton() {
    const button=$('audio-button');
    button.classList.toggle('active',state.audioEnabled);
    button.setAttribute('aria-pressed',String(state.audioEnabled));
    button.querySelector('span').textContent=state.audioEnabled?'♫':'♪';
    button.querySelector('small').textContent=state.audioEnabled?'关闭音效':'开启音效';
    $('sound-help').textContent=state.audioEnabled
      ? `音效已开启：当前模拟约 ${this.virtualRpms[state.speedIndex]} r/min，音调和脉冲会随速度联动。`
      : '点击底部“音效”按钮后播放；声音会随演示速度同步变化。';
  }

  update() {
    if(!this.context)return;
    const now=this.context.currentTime;
    const rpm=this.virtualRpms[state.speedIndex];
    const startAge=now-this.startedAt;
    for(const type of ['gasoline','diesel']){
      const voice=this.voices[type];
      const active=state.engine===type||state.engine==='compare'||(state.engine==='inline4'&&type==='gasoline');
      const audible=state.audioEnabled&&state.playing&&active;
      const cycle=getCycleState(state.angle,type);
      const cylinderMultiplier=state.engine==='inline4'&&type==='gasoline'?4:1;
      const pulseRate=rpm/120*cylinderMultiplier;
      const repeatingPhase=(now*pulseRate+(type==='diesel'?.17:0))%1;
      const runningPulse=type==='diesel'?Math.exp(-repeatingPhase*8):Math.pow(.5+.5*Math.cos(repeatingPhase*Math.PI*2),2);
      const workCue=state.engine!=='inline4'&&cycle.strokeIndex===2?Math.exp(-cycle.progress*18):0;
      const compareScale=state.engine==='compare'?.56:1;
      const runningRamp=audible?THREE.MathUtils.clamp((startAge-.16)/.58,0,1):0;
      const starterEnvelope=audible&&startAge>=0&&startAge<.92?Math.sin(Math.min(1,startAge/.16)*Math.PI/2)*(1-startAge/.92):0;
      const base=type==='diesel'?.04:.05;
      const pulseStrength=type==='diesel'?.11:.055;
      const workStrength=type==='diesel'?.04:.025;
      const target=audible?(base+runningPulse*pulseStrength+workCue*workStrength)*compareScale*runningRamp:0;
      const starterTarget=starterEnvelope*(type==='diesel'?.11:.075)*compareScale;
      const baseFrequency=type==='diesel'?26+rpm*.04:38+rpm*.055;
      const harmonicFrequency=baseFrequency*(type==='diesel'?1.72:2.28);
      const starterFrequency=(type==='diesel'?68:104)+(rpm-700)*(type==='diesel'?.024:.04);
      const filterFrequency=(type==='diesel'?420:640)+rpm*(type==='diesel'?.2:.28);
      const rpmNoiseScale=Math.min(rpm/1650,1.25);
      const noiseGain=(type==='diesel'?.035:.014)+rpmNoiseScale*(type==='diesel'?.018:.012);
      if(this.forceImmediate){
        for(const parameter of [voice.output.gain,voice.starterGain.gain,voice.tone.frequency,voice.harmonic.frequency,voice.starter.frequency,voice.filter.frequency,voice.noiseGain.gain])parameter.cancelScheduledValues(now);
        voice.output.gain.value=target;voice.starterGain.gain.value=starterTarget;voice.tone.frequency.value=baseFrequency;voice.harmonic.frequency.value=harmonicFrequency;voice.starter.frequency.value=starterFrequency;voice.filter.frequency.value=filterFrequency;voice.noiseGain.gain.value=noiseGain;
      }else{
        voice.output.gain.setTargetAtTime(target,now,audible?.018:.055);voice.starterGain.gain.setTargetAtTime(starterTarget,now,.015);voice.tone.frequency.setTargetAtTime(baseFrequency,now,.03);voice.harmonic.frequency.setTargetAtTime(harmonicFrequency,now,.03);voice.starter.frequency.setTargetAtTime(starterFrequency,now,.035);voice.filter.frequency.setTargetAtTime(filterFrequency,now,.04);voice.noiseGain.gain.setTargetAtTime(noiseGain,now,.04);
      }
    }
    this.forceImmediate=false;
  }

  snapshot() {
    const virtualRpm=this.virtualRpms[state.speedIndex];
    const cylinderMultiplier=state.engine==='inline4'?4:1;
    return {supported:this.supported,initialized:Boolean(this.context),enabled:state.audioEnabled,volume:this.volume,contextState:this.context?.state??'uninitialized',speedLabel:state.speedLabels[state.speedIndex],virtualRpm,pulseRate:virtualRpm/120*cylinderMultiplier,gasolineFrequency:this.voices.gasoline?.tone.frequency.value??0,dieselFrequency:this.voices.diesel?.tone.frequency.value??0,gasolineGain:this.voices.gasoline?.output.gain.value??0,dieselGain:this.voices.diesel?.output.gain.value??0,gasolineNoiseGain:this.voices.gasoline?.noiseGain.gain.value??0,dieselNoiseGain:this.voices.diesel?.noiseGain.gain.value??0,gasolineStarterGain:this.voices.gasoline?.starterGain.gain.value??0,dieselStarterGain:this.voices.diesel?.starterGain.gain.value??0};
  }
}

const engineAudio=new EngineAudio();

function updateCameraFrustum(mode=state.engine) {
  const portrait=innerWidth<700&&innerHeight>innerWidth;
  const viewHeight=mode==='compare'?(portrait?15.7:(innerWidth>1050?11.8:10.7)):mode==='inline4'?(portrait?16.2:(innerWidth>1050?9.6:10.4)):(innerWidth>1050?12.7:10.6);
  const aspect=innerWidth/innerHeight;
  camera.left=-viewHeight*aspect/2;
  camera.right=viewHeight*aspect/2;
  camera.top=viewHeight/2;
  camera.bottom=-viewHeight/2;
  camera.updateProjectionMatrix();
}

function setCameraForMode(mode, immediate=false) {
  const portrait=innerWidth<700&&innerHeight>innerWidth;
  const target=mode==='compare'&&portrait?new THREE.Vector3(0,-.15,0):mode==='inline4'?new THREE.Vector3(0,-.05,0):new THREE.Vector3(0,.15,0);
  const position=mode==='inline4'&&state.view!=='front'&&!portrait?new THREE.Vector3(7.2,1.75,16):new THREE.Vector3(0,target.y,16);
  updateCameraFrustum(mode);
  camera.zoom=1;
  camera.updateProjectionMatrix();
  if(immediate){camera.position.copy(position);controls.target.copy(target);controls.update();return}
  camera.position.lerp(position,.72);controls.target.lerp(target,.72);controls.update();
}

function setEngineMode(mode, resetCamera=true) {
  if((mode==='diesel'||mode==='compare'||mode==='inline4')&&!secondaryReady)return;
  state.engine=mode;document.body.classList.toggle('compare-mode',mode==='compare');document.body.classList.toggle('inline4-mode',mode==='inline4');
  if(mode==='inline4'&&state.view==='exploded')setView('cutaway');
  document.querySelectorAll('.engine-switch [data-engine]').forEach(button=>button.classList.toggle('active',button.dataset.engine===mode));
  engines.gasoline?.setRootLayout(mode);engines.diesel?.setRootLayout(mode);engines.inline4?.setRootLayout(mode);
  if(resetCamera)setCameraForMode(mode);
  const isCompare=mode==='compare';
  $('comparison-table-wrap').hidden=!isCompare;
  $('inline4-status').hidden=mode!=='inline4';
  $('info-reopen').querySelector('span').textContent=isCompare?'对比表':'讲解';
  $('engine-type-label').textContent=isCompare?'SYNCHRONIZED COMPARISON · 720°':mode==='inline4'?'INLINE FOUR GASOLINE · FIRING ORDER 1–3–4–2':`${ENGINE_COPY[mode].en} · ${mode.toUpperCase()}`;
  const timelineLabels=mode==='inline4'?['1缸做功','3缸做功','4缸做功','2缸做功']:['吸气','压缩','做功','排气'];
  document.querySelectorAll('.timeline-labels span').forEach((label,index)=>label.textContent=timelineLabels[index]);
  $('timeline-wrap').setAttribute('aria-label',mode==='inline4'?'四缸汽油机点火顺序时间轴':'四冲程时间轴');
  clearSelection();syncResponsiveUI();updateUI();
}

function setView(view) {
  if(state.engine==='inline4'&&view==='exploded')view='cutaway';
  const option=VIEW_OPTIONS.find(item=>item.id===view);
  if(!option)return;
  state.view=view;
  if(view==='exploded'){state.playing=false;updatePlayButton()}
  $('explode-control').hidden=view!=='exploded';
  const button=$('view-cycle-button');
  button.querySelector('b').textContent=option.label;
  button.setAttribute('aria-label',`当前${option.label}，点击切换观察方式`);
  button.classList.toggle('active',view==='exploded');
  if(view==='front'||state.engine==='inline4')setCameraForMode(state.engine,true);
}

function cycleView() {
  const options=state.engine==='inline4'?VIEW_OPTIONS.filter(option=>option.id!=='exploded'):VIEW_OPTIONS;
  const index=options.findIndex(option=>option.id===state.view);
  setView(options[(index+1)%options.length].id);
}

function updateUI() {
  if(state.engine==='inline4'){
    const states=engines.inline4?.states??getInlineFourStates(state.angle);
    document.querySelectorAll('[data-cylinder]').forEach((card,index)=>{
      const cycle=states[index];
      card.className=`cylinder-state ${cycle.stroke.id}`;
      card.querySelector('b').textContent=`${index+1} 缸`;
      card.querySelector('span').textContent=cycle.stroke.name;
    });
    $('cycle-range').value=String(Math.min(720,normalizeCycleAngle(state.angle)*180/Math.PI));
    document.querySelectorAll('[data-stroke]').forEach(button=>button.classList.remove('active'));
    return;
  }
  const type=state.engine==='diesel'?'diesel':'gasoline';const cycle=getCycleState(state.angle,type);const stroke=cycle.stroke;
  $('stroke-index').textContent=`0${cycle.strokeIndex+1} / 04`;$('stroke-name').textContent=stroke.name;$('angle-value').textContent=`${Math.round(cycle.degrees)}°`;$('stroke-summary').textContent=stroke.summary;
  $('piston-state').textContent=stroke.direction;$('valve-state').textContent=cycle.intakeLift>0?'进气门打开':cycle.exhaustLift>0?'排气门打开':'两气门关闭';$('pressure-state').textContent=cycle.pressure;$('temperature-state').textContent=cycle.temperature;$('energy-copy').textContent=stroke.energy;
  if(state.engine==='compare'){
    const compareProcesses=[
      '当前同为吸气冲程：汽油机吸入空气—汽油混合气，黄色雾滴表示随气流进入的汽油；柴油机只吸入空气。',
      '当前同为压缩冲程：汽油机压缩混合气；柴油机压缩空气，并在末端由顶部喷油嘴喷入柴油（黄色油滴为教学示意）。',
      '当前同为做功冲程：两者的高温燃气都推动活塞向下，通过连杆带动曲轴。',
      '当前同为排气冲程：两者都打开排气门，由活塞把废气推出汽缸。'
    ];
    $('engine-process').textContent=compareProcesses[cycle.strokeIndex];
    $('compare-live').textContent=compareProcesses[cycle.strokeIndex];
  }else if(cycle.strokeIndex===0){$('engine-process').textContent=type==='gasoline'?'亮黄色颗粒从左侧进气口进入汽缸，表示空气与汽油雾滴同时被吸入（教学示意）。':cycle.engine.intake+'。'}
  else if(cycle.strokeIndex===1){$('engine-process').textContent=type==='diesel'?'压缩冲程末端，顶部喷油嘴把柴油以黄色雾滴喷入高温压缩空气中（教学示意）。':cycle.engine.ignition+'。'}
  else if(cycle.strokeIndex===3){$('engine-process').textContent='近黑色废气颗粒从燃烧室穿过右侧排气门和排气口，沿箭头方向排出（教学示意）。'}
  else{$('engine-process').textContent=stroke.summary}
  document.querySelectorAll('[data-stroke]').forEach(button=>button.classList.toggle('active',Number(button.dataset.stroke)===cycle.strokeIndex));
  $('cycle-range').value=String(Math.min(720,cycle.degrees));
}

function clearSelection() {
  for(const engine of Object.values(engines))for(const group of engine.parts.values())group.traverse(child=>{if(child.material?.emissive){child.material.emissive.setHex(child.material.userData.baseEmissive??0);child.material.emissiveIntensity=child.material.userData.baseEmissiveIntensity??0}});
  document.querySelectorAll('.model-label.selected').forEach(label=>label.classList.remove('selected'));
  state.selected=null;$('hide-part').disabled=true;$('part-card').classList.remove('selected');$('part-name').textContent='点击模型零件';$('part-en').textContent='SELECT A COMPONENT';$('part-description').textContent='可选择活塞、连杆、曲轴、气门、火花塞或喷油嘴。';
}

function selectPart(engineType,partId) {
  if(state.selected?.engineType===engineType&&state.selected?.partId===partId)return;
  clearSelection();const engine=engines[engineType];const group=engine?.parts.get(partId);if(!group)return;
  group.traverse(child=>{if(child.material?.emissive){child.material.emissive.setHex(engineType==='diesel'?0xff8f52:0x2aaed0);child.material.emissiveIntensity=.5}});
  state.selected={engineType,partId};const copy=getPartCopy(engineType,partId);$('part-card').classList.add('selected');$('part-name').textContent=`${engineName(engineType)} · ${copy.name}`;$('part-en').textContent=copy.en;$('part-description').textContent=copy.description;$('hide-part').disabled=false;
  document.querySelector(`.model-label[data-engine="${engineType}"][data-part="${partId}"]`)?.classList.add('selected');
}

function updateLabels() {
  const selected=state.selected;
  for(const entry of labelEntries){
    const matches=selected?.engineType===entry.engine.type&&selected?.partId===entry.partId;
    const partVisible=entry.engine.parts.get(entry.partId).visible;
    if(!matches||!entry.engine.root.visible||!partVisible){entry.element.classList.add('hidden');entry.element.tabIndex=-1;continue}
    entry.anchor.getWorldPosition(tmpA);tmpA.project(camera);
    const screenX=(tmpA.x*.5+.5)*innerWidth;
    const screenY=(-tmpA.y*.5+.5)*innerHeight;
    const visible=tmpA.z>-1&&tmpA.z<1&&screenY>76&&screenY<innerHeight-54;
    entry.element.classList.toggle('hidden',!visible);entry.element.tabIndex=visible?0:-1;
    if(!visible)continue;
    const labelWidth=entry.element.offsetWidth||250;
    const offset=innerWidth<600?22:34;
    let side=screenX+offset+labelWidth>innerWidth-12?'left':'right';
    if(side==='left'&&screenX-offset-labelWidth<12)side='right';
    entry.element.classList.toggle('label-left',side==='left');
    entry.element.style.left=`${THREE.MathUtils.clamp(screenX+(side==='right'?offset:-offset),12,innerWidth-12)}px`;
    entry.element.style.top=`${THREE.MathUtils.clamp(screenY,innerWidth<=1050?132:92,innerHeight-(innerWidth<820?154:82))}px`;
  }
}

function bindUI() {
  document.querySelectorAll('.engine-switch [data-engine]').forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.engine;
    setEngineMode(mode);
    if(state.engine===mode&&location.hash!==`#${mode}`)history.pushState({engine:mode},'',`#${mode}`);
  }));
  addEventListener('popstate',()=>{const mode=location.hash.slice(1);if(['gasoline','diesel','compare','inline4'].includes(mode))setEngineMode(mode)});
  $('view-cycle-button').addEventListener('click',cycleView);
  document.querySelectorAll('[data-stroke]').forEach(button=>button.addEventListener('click',()=>{state.angle=Number(button.dataset.stroke)*Math.PI+.04;state.playing=false;updatePlayButton();updateUI()}));
  $('play-button').addEventListener('click',()=>{state.playing=!state.playing;if(state.playing&&state.audioEnabled)engineAudio.triggerStart();updatePlayButton()});
  $('speed-button').addEventListener('click',()=>{state.speedIndex=(state.speedIndex+1)%state.speeds.length;$('speed-button').querySelector('b').textContent=state.speedLabels[state.speedIndex];engineAudio.forceImmediate=true;engineAudio.update();engineAudio.updateButton()});
  $('audio-button').addEventListener('click',async()=>{const enabled=await engineAudio.toggle();if(!enabled&&!engineAudio.supported)$('sound-help').textContent='当前浏览器不支持程序生成音效，请更换新版 Chrome 或 Edge。'});
  $('volume-range').addEventListener('input',event=>{const value=Number(event.target.value);$('volume-value').textContent=`${value}%`;engineAudio.setVolume(value/100)});
  $('reset-button').addEventListener('click',resetExperiment);
  $('cycle-range').addEventListener('input',event=>{state.angle=THREE.MathUtils.degToRad(Number(event.target.value));state.playing=false;updatePlayButton();updateUI()});
  $('explode-range').addEventListener('input',event=>{state.explode=Number(event.target.value)/100;$('explode-value').textContent=`${event.target.value}%`});
  $('hide-part').addEventListener('click',()=>{if(!state.selected)return;engines[state.selected.engineType].hiddenParts.add(state.selected.partId);engines[state.selected.engineType].parts.get(state.selected.partId).visible=false;clearSelection()});
  $('restore-parts').addEventListener('click',()=>{for(const engine of Object.values(engines))engine.restoreParts();clearSelection()});
  $('lesson-close').addEventListener('click',()=>{if(innerWidth<=1050)$('lesson-panel').classList.remove('mobile-open');else{$('lesson-panel').classList.add('collapsed');$('lesson-reopen').hidden=false}});
  $('lesson-reopen').addEventListener('click',()=>{if(innerWidth<=1050){$('lesson-panel').classList.toggle('mobile-open');$('info-panel').classList.remove('mobile-open')}else{$('lesson-panel').classList.remove('collapsed');$('lesson-reopen').hidden=true}});
  $('info-close').addEventListener('click',()=>{if(innerWidth<=1050)$('info-panel').classList.remove('mobile-open');else{$('info-panel').classList.add('collapsed');$('info-reopen').hidden=false}});
  $('info-reopen').addEventListener('click',()=>{if(innerWidth<=1050){$('info-panel').classList.toggle('mobile-open');$('lesson-panel').classList.remove('mobile-open')}else{$('info-panel').classList.remove('collapsed');$('info-reopen').hidden=true}});
  $('model-info').addEventListener('click',()=>$('model-dialog').showModal());$('dialog-close').addEventListener('click',()=>$('model-dialog').close());
  const pickPart=(x,y)=>{pointer.x=x/innerWidth*2-1;pointer.y=-(y/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);const candidates=interactiveMeshes.filter(object=>object.visible&&object.userData.partGroup?.visible&&engines[object.userData.engineType]?.root.visible);const hits=raycaster.intersectObjects(candidates,false);const hit=hits.find(item=>item.object.userData.partId!=='cylinder')||hits[0];if(hit){selectPart(hit.object.userData.engineType,hit.object.userData.partId);return true}clearSelection();return false};
  let down=null;let touchOrbit=null;let touchFallback=null;
  canvas.addEventListener('pointerdown',event=>{interactionStats.pointerDown++;down={x:event.clientX,y:event.clientY};if(event.pointerType==='touch'&&event.isPrimary!==false){touchOrbit={x:event.clientX,y:event.clientY,spherical:new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))}}});
  canvas.addEventListener('pointerup',event=>{const start=down;down=null;touchOrbit=null;if(!start||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)return;pickPart(event.clientX,event.clientY)});
  canvas.addEventListener('pointercancel',()=>{down=null;touchOrbit=null});
  canvas.addEventListener('pointermove',event=>{
    interactionStats.pointerMove++;
    if(event.pointerType==='touch'&&touchOrbit){
      const spherical=touchOrbit.spherical.clone();
      spherical.theta-=(event.clientX-touchOrbit.x)/innerWidth*Math.PI*1.55;
      spherical.phi-=(event.clientY-touchOrbit.y)/innerHeight*Math.PI*.85;
      spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
      return;
    }
    if(event.pointerType==='touch'||down)return;
  });
  canvas.addEventListener('touchstart',event=>{interactionStats.touchStart++;if(event.touches.length!==1){touchFallback=null;return}const touch=event.touches[0];touchFallback={x:touch.clientX,y:touch.clientY,spherical:new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))};event.preventDefault()},{passive:false});
  canvas.addEventListener('touchmove',event=>{interactionStats.touchMove++;if(!touchFallback||event.touches.length!==1)return;const touch=event.touches[0];const spherical=touchFallback.spherical.clone();spherical.theta-=(touch.clientX-touchFallback.x)/innerWidth*Math.PI*1.55;spherical.phi-=(touch.clientY-touchFallback.y)/innerHeight*Math.PI*.85;spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();event.preventDefault()},{passive:false});
  canvas.addEventListener('touchend',()=>{touchFallback=null});canvas.addEventListener('touchcancel',()=>{touchFallback=null});
  addEventListener('keydown',event=>{if(event.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement?.tagName)){event.preventDefault();state.playing=!state.playing;if(state.playing&&state.audioEnabled)engineAudio.triggerStart();updatePlayButton()}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&engineAudio.context)engineAudio.context.suspend();else if(state.audioEnabled)engineAudio.context?.resume().catch(()=>{})});
}

function syncResponsiveUI() {
  if(state.engine==='inline4'){
    $('lesson-reopen').hidden=true;$('info-reopen').hidden=true;
    $('lesson-panel').classList.remove('mobile-open');$('info-panel').classList.remove('mobile-open');
    return;
  }
  const compact=innerWidth<=1050;
  if(compact){$('lesson-reopen').hidden=false;$('info-reopen').hidden=false}
  else{
    $('lesson-reopen').hidden=!$('lesson-panel').classList.contains('collapsed');
    $('info-reopen').hidden=!$('info-panel').classList.contains('collapsed');
    $('lesson-panel').classList.remove('mobile-open');$('info-panel').classList.remove('mobile-open');
  }
}

function updatePlayButton() { const button=$('play-button');button.querySelector('span').textContent=state.playing?'Ⅱ':'▶';button.querySelector('small').textContent=state.playing?'暂停':'播放'; }
function resetExperiment(){state.angle=THREE.MathUtils.degToRad(12);state.playing=true;state.speedIndex=2;state.explode=.72;$('explode-range').value='72';$('explode-value').textContent='72%';$('speed-button').querySelector('b').textContent='1×';for(const engine of Object.values(engines))engine.restoreParts();setView('cutaway');setEngineMode('gasoline',false);history.replaceState({engine:'gasoline'},'','#gasoline');setCameraForMode('gasoline',true);clearSelection();updatePlayButton();engineAudio.updateButton()}

function onResize(){renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<1050?1.35:1.65));engines.gasoline?.setRootLayout(state.engine);engines.diesel?.setRootLayout(state.engine);engines.inline4?.setRootLayout(state.engine);setCameraForMode(state.engine,true);syncResponsiveUI()}

function animate() {
  requestAnimationFrame(animate);const dt=Math.min(.05,clock.getDelta());const elapsed=clock.elapsedTime;
  if(state.playing)state.angle=normalizeCycleAngle(state.angle+dt*(Math.PI/3)*state.speeds[state.speedIndex]);
  engines.gasoline?.update(state.angle,state.view,state.explode,elapsed);engines.diesel?.update(state.angle,state.view,state.explode,elapsed);engines.inline4?.update(state.angle,state.view,state.explode,elapsed);
  engineAudio.update();
  controls.update();updateUI();updateLabels();renderer.render(scene,camera);
}

function buildSecondaryEngine(requestedMode) {
  updateLoading(84,'正在准备柴油机与四缸应用','PREPARING EXTENDED MODELS');
  engines.diesel=new EngineModel('diesel');
  engines.inline4=new InlineFourModel();
  secondaryReady=true;
  window.__heatEngineSecondaryReady=true;
  document.querySelectorAll('[data-engine="diesel"],[data-engine="compare"],[data-engine="inline4"]').forEach(button=>button.disabled=false);
  engines.diesel.setRootLayout(state.engine);engines.inline4.setRootLayout(state.engine);
  if(requestedMode==='diesel'||requestedMode==='compare'||requestedMode==='inline4')setEngineMode(requestedMode,true);
  updateLoading(100,'单缸对比与四缸应用均已就绪','ALL MODELS READY');
}

function init() {
  updateLoading(14,'正在建立曲柄坐标系','SETTING CRANK GEOMETRY');
  createBackdrop();createLights();
  updateLoading(42,'正在装配汽油机','ASSEMBLING SPARK-IGNITION ENGINE');engines.gasoline=new EngineModel('gasoline');
  document.querySelectorAll('[data-engine="diesel"],[data-engine="compare"],[data-engine="inline4"]').forEach(button=>button.disabled=true);
  const requestedMode=['gasoline','diesel','compare','inline4'].includes(location.hash.slice(1))?location.hash.slice(1):'gasoline';
  updateLoading(72,'汽油机已可使用','CORE MODEL READY');bindUI();setEngineMode('gasoline',false);setView('cutaway');setCameraForMode('gasoline',true);syncResponsiveUI();addEventListener('resize',onResize);
  if(!location.hash)history.replaceState({engine:'gasoline'},'','#gasoline');
  window.__heatEngineTest={getSnapshot:()=>({
    engine:state.engine,view:state.view,angle:normalizeCycleAngle(state.angle),playing:state.playing,
    gasolineParts:engines.gasoline.parts.size,dieselParts:engines.diesel?.parts.size??0,inlineFourParts:engines.inline4?.parts.size??0,secondaryReady,
    projection:camera.isOrthographicCamera?'orthographic':'perspective',zoom:camera.zoom,camera:camera.position.toArray(),target:controls.target.toArray(),polarAngle:controls.getPolarAngle(),
    visibleRoots:Number(engines.gasoline.root.visible)+Number(engines.diesel?.root.visible??false)+Number(engines.inline4?.root.visible??false),gasolineRoot:engines.gasoline.root.position.toArray(),dieselRoot:engines.diesel?.root.position.toArray()??null,inlineFourRoot:engines.inline4?.root.position.toArray()??null,gasolineRootScale:engines.gasoline.root.scale.x,dieselRootScale:engines.diesel?.root.scale.x??0,inlineFourRootScale:engines.inline4?.root.scale.x??0,gasolineBounds:projectedBounds(engines.gasoline.root),dieselBounds:projectedBounds(engines.diesel?.root),inlineFourBounds:projectedBounds(engines.inline4?.root),
    gasolineProfile:{...engines.gasoline.profile},dieselProfile:engines.diesel?{...engines.diesel.profile}:null,inlineFourProfile:engines.inline4?{...engines.inline4.profile}:null,
    gasolineFuelMistVisible:engines.gasoline.fuelMist.visible,gasolineFuelMistCount:engines.gasoline.fuelMist.geometry.attributes.position.count,gasolineFuelMistColor:engines.gasoline.fuelMist.material.color.getHex(),gasolineFuelMistOpacity:engines.gasoline.fuelMist.material.opacity,gasolineFuelMistSize:engines.gasoline.fuelMist.material.size,gasolineFuelMistHaloColor:engines.gasoline.fuelMist.userData.halo.material.color.getHex(),dieselFuelMistVisible:engines.diesel?.fuelMist.visible??false,dieselInjectionVisible:engines.diesel?.injection.visible??false,gasolineCombustionGlowVisible:engines.gasoline.combustionGlow.visible,gasolineGasColor:engines.gasoline.gasMaterial.color.getHex(),gasolineGasOpacity:engines.gasoline.gasMaterial.opacity,gasolineParticleColor:engines.gasoline.particles.material.color.getHex(),gasolineParticleOpacity:engines.gasoline.particles.material.opacity,gasolineParticleSize:engines.gasoline.particles.material.size,gasolineParticleBlending:engines.gasoline.particles.material.blending,dieselGasColor:engines.diesel?.gasMaterial.color.getHex()??null,dieselGasOpacity:engines.diesel?.gasMaterial.opacity??0,dieselParticleColor:engines.diesel?.particles.material.color.getHex()??null,dieselParticleOpacity:engines.diesel?.particles.material.opacity??0,dieselParticleSize:engines.diesel?.particles.material.size??0,dieselParticleBlending:engines.diesel?.particles.material.blending??null,
    gasolineFuelMistXRange:pointAxisRange(engines.gasoline.fuelMist),gasolineFuelMistSizeAttenuation:engines.gasoline.fuelMist.material.sizeAttenuation,gasolineFuelFlowDirection:engines.gasoline.fuelMist.userData.flowDirection,gasolineInjectionVisible:engines.gasoline.injection.visible,dieselInjectionCount:engines.diesel?.injection.geometry.attributes.position.count??0,dieselInjectionColor:engines.diesel?.injection.material.color.getHex()??null,dieselInjectionHaloColor:engines.diesel?.injection.userData.halo?.material.color.getHex()??null,dieselInjectionSize:engines.diesel?.injection.material.size??0,dieselInjectionSizeAttenuation:engines.diesel?.injection.material.sizeAttenuation??null,dieselInjectionXRange:pointAxisRange(engines.diesel?.injection),dieselInjectionYRange:pointAxisRange(engines.diesel?.injection,1),dieselInjectionNozzleY:engines.diesel?.injection.userData.nozzleY??null,dieselInjectionFlowDirection:engines.diesel?.injection.userData.flowDirection??null,gasolineExhaustPlumeVisible:engines.gasoline.exhaustPlume.visible,gasolineExhaustPlumeCount:engines.gasoline.exhaustPlume.geometry.attributes.position.count,gasolineExhaustPlumeColor:engines.gasoline.exhaustPlume.material.color.getHex(),gasolineExhaustPlumeSize:engines.gasoline.exhaustPlume.material.size,gasolineExhaustPlumeSizeAttenuation:engines.gasoline.exhaustPlume.material.sizeAttenuation,gasolineExhaustPlumeXRange:pointAxisRange(engines.gasoline.exhaustPlume),gasolineExhaustOuterYRange:pointAxisRangeBeyondX(engines.gasoline.exhaustPlume,3.3,1),gasolineExhaustFlowDirection:engines.gasoline.exhaustPlume.userData.flowDirection,dieselExhaustPlumeVisible:engines.diesel?.exhaustPlume.visible??false,dieselExhaustPlumeCount:engines.diesel?.exhaustPlume.geometry.attributes.position.count??0,dieselExhaustPlumeColor:engines.diesel?.exhaustPlume.material.color.getHex()??null,dieselExhaustPlumeSize:engines.diesel?.exhaustPlume.material.size??0,dieselExhaustPlumeSizeAttenuation:engines.diesel?.exhaustPlume.material.sizeAttenuation??null,dieselExhaustPlumeXRange:pointAxisRange(engines.diesel?.exhaustPlume),dieselExhaustOuterYRange:pointAxisRangeBeyondX(engines.diesel?.exhaustPlume,3.3,1),dieselExhaustFlowDirection:engines.diesel?.exhaustPlume.userData.flowDirection??null,
    gasolineCrankArmCount:engines.gasoline.crank.userData.armCount??0,dieselCrankArmCount:engines.diesel?.crank.userData.armCount??0,gasolineMainJournalAtRotationAxis:Boolean(engines.gasoline.crank.userData.mainJournalAtRotationAxis),gasolineCrankPinOffset:engines.gasoline.crank.userData.crankPinOffset??0,gasolineConnectionError:engines.gasoline.getConnectionError(),dieselConnectionError:engines.diesel?.getConnectionError()??null,inlineFourCylinderCount:engines.inline4?.pistons.length??0,inlineFourThrowCount:engines.inline4?.throws.length??0,inlineFourConnectionErrors:engines.inline4?.getConnectionErrors()??[],inlineFourStates:engines.inline4?.states.map(cycle=>({cylinder:cycle.cylinder,stroke:cycle.stroke.id,pistonDirection:cycle.pistonDirection}))??[],inlineFourStatusHidden:$('inline4-status').hidden,
    audio:engineAudio.snapshot(),interaction:{...interactionStats},compareTableHidden:$('comparison-table-wrap').hidden
  })};
  window.__heatEngineReady=true;clearTimeout(window.__heatEngineSlowTimer);clearTimeout(window.__heatEngineFailTimer);setTimeout(()=>$('loading').classList.add('done'),180);
  animate();
  requestAnimationFrame(()=>setTimeout(()=>buildSecondaryEngine(requestedMode),0));
}

try{init()}catch(error){console.error(error);window.__showHeatEngineError(error.message)}
