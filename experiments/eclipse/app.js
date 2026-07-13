import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import earthHighUrl from '../../assets/textures/earth_4096.jpg';
import earthStandardUrl from '../../assets/textures/earth_2048.jpg';
import moonHighUrl from '../../assets/textures/moon_4096.jpg';
import moonStandardUrl from '../../assets/textures/moon_2048.jpg';
import moonHeightUrl from '../../assets/textures/moon_height_1024.jpg';
import cloudsUrl from '../../assets/textures/clouds_2048.png';
import moonNearsideUrl from '../../assets/textures/moon_nearside_1024.png';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#space-canvas');
const groundCanvas = $('#ground-canvas');
const groundCtx = groundCanvas.getContext('2d');

const state = {
  scenario: 'solar-total',
  family: 'solar',
  time: -1.05,
  speed: 1,
  playing: true,
  ground: false,
  showOrbits: true,
  showLabels: true,
  lastFrame: performance.now(),
  viewTransitionToken: 0,
  quality: 'auto'
};

const scenarios = {
  'solar-total': { title: '日全食', code: 'SOLAR ECLIPSE / TOTAL', family: 'solar', miss: 0.02, spaceMiss: 0, moonScale: 1.055 },
  'solar-partial': { title: '日偏食', code: 'SOLAR ECLIPSE / PARTIAL', family: 'solar', miss: 0.72, spaceMiss: 1.15, moonScale: 1.02 },
  'solar-annular': { title: '日环食', code: 'SOLAR ECLIPSE / ANNULAR', family: 'solar', miss: 0.02, spaceMiss: 0, moonScale: 0.84 },
  'lunar-total': { title: '月全食', code: 'LUNAR ECLIPSE / TOTAL', family: 'lunar', miss: 0.04, spaceMiss: 0.06, shadowScale: 1.34 },
  'lunar-partial': { title: '月偏食', code: 'LUNAR ECLIPSE / PARTIAL', family: 'lunar', miss: 0.82, spaceMiss: 1.18, shadowScale: 1.28 }
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.setClearColor(0x010309, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x01040b, 0.0026);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.08, 500);
camera.position.set(12.5, 17, 44);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 12;
controls.maxDistance = 90;
controls.target.set(12.5, 0, 2);
const defaultCameraPosition=camera.position.clone();
const defaultCameraTarget=controls.target.clone();
let cameraTween=null;

scene.add(new THREE.AmbientLight(0x182330, 0.09));
const sunlight = new THREE.PointLight(0xfff3d0, 950, 120, 1.55);
scene.add(sunlight);

function canvasTexture(width, height, painter) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  painter(c.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const earthTexture = canvasTexture(1024, 512, (ctx, w, h) => {
  const sea = ctx.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#143d68'); sea.addColorStop(.52, '#0a5a7d'); sea.addColorStop(1, '#102b51'); ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
  const continents = [
    [[.08,.28],[.18,.20],[.26,.29],[.23,.43],[.18,.47],[.16,.65],[.10,.54],[.07,.38]],
    [[.28,.62],[.35,.54],[.40,.60],[.37,.78],[.32,.90],[.29,.75]],
    [[.48,.27],[.59,.18],[.70,.25],[.79,.22],[.88,.35],[.82,.48],[.70,.46],[.65,.60],[.57,.55],[.53,.43]],
    [[.57,.53],[.67,.50],[.70,.68],[.64,.82],[.57,.73]],
    [[.82,.68],[.89,.63],[.94,.73],[.91,.84],[.84,.82]]
  ];
  continents.forEach((points, n) => { ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h)); ctx.closePath(); const g=ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,n%2?'#587c54':'#497c58'); g.addColorStop(1,'#8b7650'); ctx.fillStyle=g; ctx.fill(); });
  ctx.globalAlpha=.22; ctx.fillStyle='#fff'; for(let i=0;i<190;i++){const x=Math.random()*w,y=Math.random()*h*.75+30,r=Math.random()*12+2;ctx.beginPath();ctx.ellipse(x,y,r*2.5,r,0,0,Math.PI*2);ctx.fill()} ctx.globalAlpha=1;
  const ice=ctx.createLinearGradient(0,0,0,60);ice.addColorStop(0,'#f0fbff');ice.addColorStop(1,'rgba(220,245,255,0)');ctx.fillStyle=ice;ctx.fillRect(0,0,w,62);ctx.save();ctx.translate(0,h);ctx.scale(1,-1);ctx.fillRect(0,0,w,50);ctx.restore();
});
const cloudTexture = canvasTexture(1024, 512, (ctx,w,h)=>{ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(255,255,255,.34)';for(let i=0;i<270;i++){const x=Math.random()*w,y=Math.random()*h,r=Math.random()*8+1;ctx.beginPath();ctx.ellipse(x,y,r*3,r,Math.random()*.6,0,Math.PI*2);ctx.fill()}});
const moonTexture = canvasTexture(512, 256, (ctx,w,h)=>{const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#bfc2bd');g.addColorStop(.5,'#8d918e');g.addColorStop(1,'#565b59');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(let i=0;i<105;i++){const x=Math.random()*w,y=Math.random()*h,r=Math.random()*10+2;ctx.fillStyle=`rgba(35,39,38,${Math.random()*.24+.05})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(240,240,230,.1)';ctx.stroke()}});
const sunTexture = canvasTexture(512, 256, (ctx,w,h)=>{const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#ffb22f');g.addColorStop(.48,'#ffe26b');g.addColorStop(1,'#e97d19');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='soft-light';for(let i=0;i<760;i++){const x=Math.random()*w,y=Math.random()*h,r=Math.random()*4+.4;ctx.fillStyle=i%3?'rgba(255,245,164,.42)':'rgba(165,55,5,.28)';ctx.beginPath();ctx.ellipse(x,y,r*2.8,r,Math.random(),0,Math.PI*2);ctx.fill()}ctx.globalCompositeOperation='source-over'});

function glowTexture(inner, middle) { return canvasTexture(256,256,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,8,w/2,h/2,w/2);g.addColorStop(0,inner);g.addColorStop(.25,middle);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}); }
function makeSprite(texture, scale, opacity=1){const m=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity});const s=new THREE.Sprite(m);s.scale.set(scale,scale,1);return s}

const sunGroup = new THREE.Group();
const sun = new THREE.Mesh(new THREE.SphereGeometry(3.7, 64, 40), new THREE.MeshBasicMaterial({ map:sunTexture, color:0xffd05a }));
sunGroup.add(sun,makeSprite(glowTexture('rgba(255,249,215,1)','rgba(255,128,26,.32)'),15),makeSprite(glowTexture('rgba(255,212,128,.32)','rgba(255,102,12,.07)'),27,.55));
scene.add(sunGroup);

const earthGroup = new THREE.Group();
const earthMaterial=new THREE.MeshStandardMaterial({map:earthTexture,roughness:.82,metalness:0});
const earth = new THREE.Mesh(new THREE.SphereGeometry(1.45,64,40),earthMaterial);
earth.rotation.z=THREE.MathUtils.degToRad(23.44);
const cloudMaterial=new THREE.MeshStandardMaterial({map:cloudTexture,transparent:true,opacity:.62,depthWrite:false,roughness:1});
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.475,64,40),cloudMaterial);
clouds.rotation.z=earth.rotation.z;
const atmosphereMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec3 vNormal;varying vec3 vWorldPosition;void main(){vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.0);vWorldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,fragmentShader:`varying vec3 vNormal;varying vec3 vWorldPosition;void main(){vec3 viewDir=normalize(cameraPosition-vWorldPosition);float rim=pow(1.0-abs(dot(normalize(vNormal),viewDir)),2.35);vec3 blue=mix(vec3(.08,.32,.72),vec3(.25,.78,1.0),rim);gl_FragColor=vec4(blue,rim*.62);}`});
const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.57,64,40),atmosphereMaterial);
earthGroup.add(earth,clouds,atmosphere);scene.add(earthGroup);

const moonMaterial=new THREE.MeshStandardMaterial({map:moonTexture,roughness:1,metalness:0});
const moon = new THREE.Mesh(new THREE.SphereGeometry(.52,64,40),moonMaterial);scene.add(moon);

const textureLoader=new THREE.TextureLoader();
const textureProfiles={standard:{earth:earthStandardUrl,moon:moonStandardUrl},high:{earth:earthHighUrl,moon:moonHighUrl}};
const groundMoonImage=new Image();groundMoonImage.decoding='async';groundMoonImage.src=moonNearsideUrl;
let textureLoadToken=0;
function autoTextureQuality(){const memory=navigator.deviceMemory||8;return innerWidth<900||memory<=4||renderer.capabilities.maxTextureSize<4096?'standard':'high'}
function loadPlanetTexture(url,color=true){return new Promise((resolve,reject)=>textureLoader.load(url,texture=>{if(color)texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());resolve(texture)},undefined,reject))}
async function applyTextureQuality(mode){
  const token=++textureLoadToken,resolved=mode==='auto'?autoTextureQuality():mode,profile=textureProfiles[resolved],button=$('#quality-button');
  state.quality=mode;button.textContent=`${mode==='auto'?'自动':'手动'} · ${resolved==='high'?'高清':'标准'}`;button.disabled=true;
  try{
    const [earthMap,moonMap,cloudMap,moonHeight]=await Promise.all([loadPlanetTexture(profile.earth),loadPlanetTexture(profile.moon),loadPlanetTexture(cloudsUrl),loadPlanetTexture(moonHeightUrl,false)]);
    if(token!==textureLoadToken){earthMap.dispose();moonMap.dispose();cloudMap.dispose();moonHeight.dispose();return}
    [earthMaterial.map,moonMaterial.map,moonMaterial.bumpMap,cloudMaterial.map].forEach(texture=>{if(texture?.userData?.nasaAsset)texture.dispose()});
    earthMap.userData.nasaAsset=moonMap.userData.nasaAsset=cloudMap.userData.nasaAsset=moonHeight.userData.nasaAsset=true;
    earthMaterial.map=earthMap;moonMaterial.map=moonMap;moonMaterial.bumpMap=moonHeight;moonMaterial.bumpScale=.035;cloudMaterial.map=cloudMap;
    earthMaterial.needsUpdate=moonMaterial.needsUpdate=cloudMaterial.needsUpdate=true;
  }catch(error){console.warn('NASA textures could not be loaded; procedural fallback remains active.',error);button.textContent='真实纹理加载失败'}finally{if(token===textureLoadToken)button.disabled=false}
}

function createStarfield() {
  const count=7600, positions=new Float32Array(count*3), colors=new Float32Array(count*3), color=new THREE.Color();
  for(let i=0;i<count;i++){const r=THREE.MathUtils.randFloat(85,235),theta=Math.random()*Math.PI*2;let y;if(i<count*.28){y=THREE.MathUtils.randFloatSpread(18)*(Math.random()*.65+.35)}else y=THREE.MathUtils.randFloatSpread(r*2);const radial=Math.sqrt(Math.max(0,r*r-y*y));positions[i*3]=radial*Math.cos(theta);positions[i*3+1]=y;positions[i*3+2]=radial*Math.sin(theta);const warm=Math.random()>.84;color.setHSL(warm?THREE.MathUtils.randFloat(.06,.13):THREE.MathUtils.randFloat(.53,.67),THREE.MathUtils.randFloat(.04,.38),THREE.MathUtils.randFloat(.62,1));colors.set([color.r,color.g,color.b],i*3)}
  const starMap=canvasTexture(64,64,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));const mat=new THREE.PointsMaterial({size:.22,map:starMap,vertexColors:true,transparent:true,opacity:.78,alphaTest:.015,sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending});scene.add(new THREE.Points(geo,mat));
}
createStarfield();

function ellipseLine(rx, rz, color, opacity, segments=192){const pts=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*rx,0,Math.sin(a)*rz))}return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity}))}
const orbitGroup=new THREE.Group();
const earthOrbit=ellipseLine(25,24.6,0x3bc8ee,.25);orbitGroup.add(earthOrbit);
const moonOrbit=ellipseLine(4.1,4.1,0x74dff7,.37);moonOrbit.rotation.x=THREE.MathUtils.degToRad(5.145);earthGroup.add(moonOrbit);
scene.add(orbitGroup);

function makeShadowVolume(startRadius,endRadius,length,color,opacity){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(endRadius,startRadius,length,40,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));mesh.geometry.rotateZ(-Math.PI/2);mesh.userData.length=length;return mesh}
const solarUmbra=makeShadowVolume(.54,.025,5.15,0x274d77,.25);
const solarAnnularUmbra=makeShadowVolume(.54,.025,3.45,0x274d77,.25);
const solarAntumbra=makeShadowVolume(.025,.34,3.1,0x356386,.2);
const solarPenumbra=makeShadowVolume(.54,1.7,6.7,0x367395,.055);
const earthShadow=makeShadowVolume(1.42,.76,8.5,0x67212b,.18);
scene.add(solarUmbra,solarAnnularUmbra,solarAntumbra,solarPenumbra,earthShadow);

const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
let pointerStart={x:0,y:0};
canvas.addEventListener('pointerdown',(event)=>{pointerStart={x:event.clientX,y:event.clientY}});
canvas.addEventListener('pointerup',(event)=>{if(state.ground||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)return;const rect=canvas.getBoundingClientRect();pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);if(raycaster.intersectObject(earth,true).length) enterGround();});

function orbitalPositions() {
  const cfg=scenarios[state.scenario];
  const earthAngle=.18 + state.time*.006;
  const earthPos=new THREE.Vector3(Math.cos(earthAngle)*25,0,Math.sin(earthAngle)*24.6);
  earthGroup.position.copy(earthPos);
  const sunDirection=new THREE.Vector3().subVectors(new THREE.Vector3(),earthPos).normalize();
  const perpendicular=new THREE.Vector3(-sunDirection.z,0,sunDirection.x);
  const phase=state.time*.24;
  const side=cfg.family==='solar'?1:-1;
  const baseDir=sunDirection.clone().multiplyScalar(side);
  const moonDistance=cfg.family==='solar'?(cfg.moonScale<.9?4.6:4.05):4.1;
  const relative=baseDir.multiplyScalar(moonDistance*Math.cos(phase)).add(perpendicular.multiplyScalar(moonDistance*Math.sin(phase)));
  relative.y=Math.sin(phase)*moonDistance*Math.sin(THREE.MathUtils.degToRad(5.145)) + cfg.spaceMiss;
  moon.position.copy(earthPos).add(relative);
  const faceEarth=new THREE.Vector3().subVectors(earthPos,moon.position).normalize();
  moon.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),faceEarth);
  sunlight.position.set(0,0,0);
  const awayFromSun=earthPos.clone().normalize();
  const moonAwayFromSun=moon.position.clone().normalize();
  solarUmbra.visible=cfg.family==='solar'&&state.scenario!=='solar-annular';
  solarAnnularUmbra.visible=state.scenario==='solar-annular';
  solarAntumbra.visible=state.scenario==='solar-annular';
  solarPenumbra.visible=cfg.family==='solar';earthShadow.visible=cfg.family==='lunar';
  if(cfg.family==='solar'){
    alignShadow(solarPenumbra,moon.position,moonAwayFromSun);
    if(state.scenario==='solar-annular'){
      alignShadow(solarAnnularUmbra,moon.position,moonAwayFromSun);
      alignShadow(solarAntumbra,moon.position,moonAwayFromSun,3.45);
    }else alignShadow(solarUmbra,moon.position,moonAwayFromSun);
  }else alignShadow(earthShadow,earthPos,awayFromSun);
  moon.scale.setScalar(cfg.family==='solar' ? cfg.moonScale : 1);
}

function alignShadow(mesh,from,direction,startOffset=0){const length=mesh.userData.length;mesh.position.copy(from).add(direction.clone().multiplyScalar(startOffset+length/2));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),direction)}

function circleOverlap(r1,r2,d){if(d>=r1+r2)return 0;if(d<=Math.abs(r1-r2))return Math.PI*Math.min(r1,r2)**2;const a=r1*r1*Math.acos((d*d+r1*r1-r2*r2)/(2*d*r1));const b=r2*r2*Math.acos((d*d+r2*r2-r1*r1)/(2*d*r2));const c=.5*Math.sqrt((-d+r1+r2)*(d+r1-r2)*(d-r1+r2)*(d+r1+r2));return a+b-c}
function coverage() {const cfg=scenarios[state.scenario];const travel=Math.abs(state.time)*1.75; if(cfg.family==='solar'){const sunR=1,moonR=cfg.moonScale,d=Math.hypot(travel,cfg.miss);return Math.min(1,circleOverlap(sunR,moonR,d)/(Math.PI*sunR*sunR));} const moonR=1,shadowR=cfg.shadowScale,d=Math.hypot(travel,cfg.miss);return Math.min(1,circleOverlap(moonR,shadowR,d)/(Math.PI*moonR*moonR));}
function phaseText(value){const cfg=scenarios[state.scenario];if(Math.abs(state.time)<.07)return cfg.family==='solar'?'食甚 · 遮掩达到最大':'食甚 · 月球最深处于地球本影';if(value<.01)return state.time<0?(cfg.family==='solar'?'初亏前 · 月球正在接近太阳视圆面':'初亏前 · 月球正在接近地球本影'):(cfg.family==='solar'?'复圆后 · 月球离开太阳视圆面':'复圆后 · 月球离开地球本影');return state.time<0?(cfg.family==='solar'?'初亏至食甚 · 遮掩范围正在增大':'初亏至食甚 · 月面正在变暗'):(cfg.family==='solar'?'食甚至复圆 · 太阳正在重新显露':'食甚至复圆 · 月面正在恢复');}

function updateReadout(){const cfg=scenarios[state.scenario],value=coverage();$('#event-kind').textContent=cfg.code;$('#event-title').textContent=cfg.title;$('#event-phase').textContent=phaseText(value);$('#coverage-value').textContent=`${Math.round(value*100)}%`;$('#coverage-bar').style.width=`${value*100}%`;}

function projectLabel(object,element){const p=new THREE.Vector3();object.getWorldPosition(p);p.project(camera);element.style.left=`${(p.x*.5+.5)*innerWidth}px`;element.style.top=`${(-p.y*.5+.5)*innerHeight}px`;element.style.opacity=(p.z<1&&state.showLabels&&!state.ground)?'1':'0'}

function resizeGround(){const dpr=Math.min(devicePixelRatio,2);groundCanvas.width=innerWidth*dpr;groundCanvas.height=innerHeight*dpr;groundCtx.setTransform(dpr,0,0,dpr,0,0)}
function seededStars(ctx,w,h,intensity=1){for(let i=0;i<160;i++){const x=(Math.sin(i*928.1)*.5+.5)*w,y=(Math.sin(i*371.7+4)*.5+.5)*h*.75,a=(.18+(i%7)/10)*intensity;ctx.fillStyle=`rgba(220,240,255,${a})`;ctx.fillRect(x,y,i%17===0?1.5:1,i%17===0?1.5:1)}}
function mixRgb(a,b,t){const v=a.map((n,i)=>Math.round(n+(b[i]-n)*t));return `rgb(${v[0]},${v[1]},${v[2]})`}
function drawGround(){const w=innerWidth,h=innerHeight,cx=w*.5,cy=h*.41,cfg=scenarios[state.scenario],value=coverage();const grad=groundCtx.createLinearGradient(0,0,0,h);let darkness=0;if(cfg.family==='solar'){darkness=value*(state.scenario==='solar-total'?1:.48);grad.addColorStop(0,mixRgb([7,20,35],[1,3,9],darkness));grad.addColorStop(.56,mixRgb([33,77,104],[6,13,24],darkness));grad.addColorStop(.79,mixRgb([186,124,69],[67,43,35],darkness));grad.addColorStop(1,mixRgb([16,20,23],[5,7,9],darkness))}else{grad.addColorStop(0,'#01040c');grad.addColorStop(.62,'#071425');grad.addColorStop(1,'#18212a')}groundCtx.fillStyle=grad;groundCtx.fillRect(0,0,w,h);if(cfg.family==='lunar')seededStars(groundCtx,w,h);else if(state.scenario==='solar-total'&&value>.86)seededStars(groundCtx,w,h,Math.min(1,(value-.86)/.14));
  const horizonY=h*.80;groundCtx.fillStyle=cfg.family==='solar'?mixRgb([17,23,25],[4,7,9],darkness):'#05090d';groundCtx.beginPath();groundCtx.moveTo(0,horizonY);for(let x=0;x<=w;x+=35)groundCtx.lineTo(x,horizonY-Math.sin(x*.012)*12-Math.sin(x*.035)*4);groundCtx.lineTo(w,h);groundCtx.lineTo(0,h);groundCtx.closePath();groundCtx.fill();
  if(cfg.family==='solar')drawSolarSky(cx,cy,Math.min(w,h)*.115,cfg);else drawLunarSky(cx,cy,Math.min(w,h)*.105,cfg);
}
function drawSolarSky(cx,cy,r,cfg){
  const ctx=groundCtx,travel=state.time*r*1.75,mx=cx+travel,my=cy+cfg.miss*r,isTotal=cfg.moonScale>1&&Math.abs(state.time)<.16&&cfg.miss<.1;
  const aura=ctx.createRadialGradient(cx,cy,r*.65,cx,cy,r*3.8);aura.addColorStop(0,'rgba(255,246,202,.78)');aura.addColorStop(.18,'rgba(255,190,87,.26)');aura.addColorStop(1,'rgba(255,175,68,0)');ctx.fillStyle=aura;ctx.fillRect(cx-r*4,cy-r*4,r*8,r*8);
  if(isTotal){ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowColor='rgba(205,231,255,.2)';ctx.shadowBlur=5;for(let i=0;i<148;i++){const noise=Math.sin(i*91.733)*43758.5453%1,a=i/148*Math.PI*2+noise*.026,len=r*(1.13+Math.abs(noise)*.78),bend=noise*.13,mid=r*(1.04+Math.abs(noise)*.24);ctx.strokeStyle=`rgba(214,236,252,${.018+Math.abs(noise)*.055})`;ctx.lineWidth=.35+Math.abs(noise)*.8;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.985,cy+Math.sin(a)*r*.985);ctx.quadraticCurveTo(cx+Math.cos(a+bend)*mid,cy+Math.sin(a+bend)*mid,cx+Math.cos(a+bend*.55)*len,cy+Math.sin(a+bend*.55)*len);ctx.stroke()}ctx.restore()}
  const sunG=ctx.createRadialGradient(cx-r*.25,cy-r*.25,r*.1,cx,cy,r);sunG.addColorStop(0,'#fffdf0');sunG.addColorStop(.52,'#ffe18b');sunG.addColorStop(1,'#f2912d');ctx.fillStyle=sunG;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  const moonR=r*cfg.moonScale;ctx.fillStyle='#020307';ctx.beginPath();ctx.arc(mx,my,moonR,0,Math.PI*2);ctx.fill();
}
function drawLunarSky(cx,cy,r,cfg){const ctx=groundCtx,travel=state.time*r*1.75,sx=cx+travel,sy=cy+cfg.miss*r,shadowR=r*cfg.shadowScale;ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();if(groundMoonImage.complete&&groundMoonImage.naturalWidth){ctx.drawImage(groundMoonImage,cx-r,cy-r,r*2,r*2)}else{const moonG=ctx.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);moonG.addColorStop(0,'#e7dfca');moonG.addColorStop(.65,'#ada997');moonG.addColorStop(1,'#77776e');ctx.fillStyle=moonG;ctx.fillRect(cx-r,cy-r,r*2,r*2)}const shadow=ctx.createRadialGradient(sx,sy,shadowR*.2,sx,sy,shadowR);if(state.scenario==='lunar-total'){shadow.addColorStop(0,'rgba(151,52,29,.84)');shadow.addColorStop(.72,'rgba(124,35,18,.8)');shadow.addColorStop(.9,'rgba(28,6,6,.7)')}else{shadow.addColorStop(0,'rgba(18,7,8,.94)');shadow.addColorStop(.72,'rgba(45,14,10,.88)');shadow.addColorStop(.9,'rgba(17,7,9,.72)')}shadow.addColorStop(1,'rgba(8,8,14,.06)');ctx.globalCompositeOperation='multiply';ctx.fillStyle=shadow;ctx.beginPath();ctx.arc(sx,sy,shadowR,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.restore();ctx.strokeStyle='rgba(220,235,238,.2)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();const halo=ctx.createRadialGradient(cx,cy,r,cx,cy,r*1.7);halo.addColorStop(0,'rgba(120,170,205,.1)');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.fillRect(cx-r*2,cy-r*2,r*4,r*4)}

function easeInOutCubic(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function tweenCamera(position,target,duration=900){cameraTween={started:performance.now(),duration,fromPosition:camera.position.clone(),toPosition:position.clone(),fromTarget:controls.target.clone(),toTarget:target.clone()}}
function enterGround(immediate=false){
  if(state.ground)return;
  const token=++state.viewTransitionToken;
  state.ground=true;
  controls.enabled=false;
  groundCanvas.hidden=false;
  resizeGround();drawGround();
  $('#space-return').hidden=false;$('#ground-hint').hidden=false;$('#view-label').textContent='地面观测';
  $('#observe-button').disabled=true;$('#observe-button span').textContent='正在从地球表面观察';
  if(immediate){document.body.classList.add('ground-view');canvas.style.visibility='hidden';return}
  canvas.style.visibility='visible';
  document.body.classList.add('view-transitioning');
  const earthPos=earthGroup.position.clone();
  const approach=camera.position.clone().sub(earthPos).normalize();
  tweenCamera(earthPos.clone().add(approach.multiplyScalar(4.2)).add(new THREE.Vector3(0,.8,0)),earthPos,820);
  setTimeout(()=>{if(token!==state.viewTransitionToken)return;requestAnimationFrame(()=>document.body.classList.add('ground-view'))},260);
  setTimeout(()=>{if(token===state.viewTransitionToken){canvas.style.visibility='hidden';document.body.classList.remove('view-transitioning')}},1040);
}
function leaveGround(){
  if(!state.ground)return;
  const token=++state.viewTransitionToken;
  state.ground=false;
  canvas.style.visibility='visible';
  document.body.classList.add('view-transitioning');
  document.body.classList.remove('ground-view');
  $('#space-return').hidden=true;$('#ground-hint').hidden=true;$('#view-label').textContent='三维空间';
  $('#observe-button').disabled=false;$('#observe-button span').textContent='从地球表面观察';
  tweenCamera(defaultCameraPosition,defaultCameraTarget,1050);
  setTimeout(()=>{if(token!==state.viewTransitionToken)return;groundCanvas.hidden=true;controls.enabled=true;document.body.classList.remove('view-transitioning')},1080);
}
function setScenario(name){state.scenario=name;state.family=scenarios[name].family;state.time=-1.05;$('#time-slider').value=state.time;document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active',b.dataset.scenario===name));updateReadout();orbitalPositions();drawGround()}

document.querySelectorAll('[data-family]').forEach(button=>button.addEventListener('click',()=>{state.family=button.dataset.family;document.querySelectorAll('[data-family]').forEach(b=>b.classList.toggle('active',b===button));$('#solar-presets').hidden=state.family!=='solar';$('#lunar-presets').hidden=state.family!=='lunar';setScenario(state.family==='solar'?'solar-total':'lunar-total')}));
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>setScenario(button.dataset.scenario)));
$('#orbit-toggle').addEventListener('change',e=>{state.showOrbits=e.target.checked;orbitGroup.visible=state.showOrbits;moonOrbit.visible=state.showOrbits});
$('#label-toggle').addEventListener('change',e=>state.showLabels=e.target.checked);
const qualityModes=['auto','high','standard'];
try{const savedQuality=localStorage.getItem('physics-lab-quality');if(qualityModes.includes(savedQuality))state.quality=savedQuality}catch{}
$('#quality-button').addEventListener('click',()=>{const next=qualityModes[(qualityModes.indexOf(state.quality)+1)%qualityModes.length];try{localStorage.setItem('physics-lab-quality',next)}catch{}applyTextureQuality(next)});
applyTextureQuality(state.quality);
$('#observe-button').addEventListener('click',()=>enterGround(false));$('#space-return').addEventListener('click',leaveGround);
$('#time-slider').addEventListener('input',e=>{state.time=Number(e.target.value);state.playing=false;$('#play-button span').textContent='▶';updateReadout();drawGround()});
$('#play-button').addEventListener('click',()=>{state.playing=!state.playing;$('#play-button span').textContent=state.playing?'Ⅱ':'▶'});
$('#reverse-button').addEventListener('click',()=>{state.speed=-Math.abs(state.speed||1);state.playing=true;$('#speed-button b').textContent=`${state.speed}×`;$('#play-button span').textContent='Ⅱ'});
const speeds=[.25,.5,1,2,4,8];$('#speed-button').addEventListener('click',()=>{const current=Math.abs(state.speed),next=speeds[(speeds.indexOf(current)+1)%speeds.length];state.speed=Math.sign(state.speed||1)*next;$('#speed-button b').textContent=`${state.speed}×`});
$('#info-button').addEventListener('click',()=>$('#info-dialog').showModal());$('#dialog-close').addEventListener('click',()=>$('#info-dialog').close());

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);resizeGround();if(state.ground)drawGround()});

function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-state.lastFrame)/1000,.05);state.lastFrame=now;if(state.playing){state.time+=dt*.16*state.speed;if(state.time>1.25)state.time=-1.25;if(state.time< -1.25)state.time=1.25;$('#time-slider').value=state.time}earth.rotation.y+=dt*.17;clouds.rotation.y+=dt*.2;sun.rotation.y+=dt*.035;orbitalPositions();if(cameraTween){const progress=Math.min(1,(now-cameraTween.started)/cameraTween.duration),eased=easeInOutCubic(progress);camera.position.lerpVectors(cameraTween.fromPosition,cameraTween.toPosition,eased);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,eased);if(progress>=1)cameraTween=null}controls.update();updateReadout();if(state.ground)drawGround();else{projectLabel(sunGroup,$('#sun-label'));projectLabel(earthGroup,$('#earth-label'));projectLabel(moon,$('#moon-label'))}renderer.render(scene,camera)}

resizeGround();orbitalPositions();updateReadout();requestAnimationFrame(animate);
const params=new URLSearchParams(location.search);
const requestedScenario=params.get('scenario');
if(scenarios[requestedScenario]){
  const requestedFamily=scenarios[requestedScenario].family;
  document.querySelectorAll('[data-family]').forEach(b=>b.classList.toggle('active',b.dataset.family===requestedFamily));
  $('#solar-presets').hidden=requestedFamily!=='solar';$('#lunar-presets').hidden=requestedFamily!=='lunar';
  setScenario(requestedScenario);
}
if(params.has('t')){state.time=THREE.MathUtils.clamp(Number(params.get('t'))||0,-1.25,1.25);state.playing=false;$('#time-slider').value=state.time;$('#play-button span').textContent='▶';}
if(params.get('view')==='ground')setTimeout(()=>enterGround(true),120);
window.__orbitalModelReady=true;
setTimeout(()=>$('#loading').classList.add('done'),550);
setTimeout(()=>$('#loading')?.remove(),1450);
