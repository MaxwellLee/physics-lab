import {clamp,HEARING_RANGES,frequencyPosition,frequencyAt,soundRegion,sceneGain} from './model.js';
const scenes=[
  [0,'听阈参考','正常听力者在特定条件下刚能听到的参考，不代表没有声波。'],
  [30,'轻声耳语','轻声耳语的粗略示例；与说话距离有关。'],
  [40,'安静图书馆','典型安静图书馆约 40 dB；人多、交谈时会改变。'],
  [60,'正常交谈','日常正常交谈的参考值，不是每个人都固定为 60 dB。'],
  [90,'繁忙道路 / 卡车','较强的卡车交通噪声示例；不代表所有马路。'],
  [110,'链锯作业','链锯作业附近的高声级示例，距离改变，读数也改变。'],
  [120,'救护车警笛','警笛附近的高声级示例，并非日常背景声。'],
  [140,'飞机发动机附近','喷气发动机起飞噪声的高声级示例，不是机场候机厅。']
];
export function createInstruments({audio,output,beforePlay,onError}){
  const $=id=>document.getElementById(id);
  let detailOpen=false,mode=null,db=60,hz=1000,species='human',oscillator=null,level=null,playing=null,token=0;
  function stop(){token++;if(oscillator){oscillator.stop();oscillator.disconnect();oscillator=null;}level?.disconnect();level=null;playing=null;buttons();}
  function buttons(){
    $('scene-listen').textContent=playing==='amplitude'?'■ 停止试听':'▶ 试听强弱';
    $('hearing-listen').textContent=playing==='frequency'?'■ 停止试听':'▶ 试听此频率';
    $('scene-listen').setAttribute('aria-pressed',String(playing==='amplitude'));
    $('hearing-listen').setAttribute('aria-pressed',String(playing==='frequency'));
    $('hearing-listen').disabled=hz<80||hz>8000;
  }
  async function listen(kind){
    if(playing===kind){stop();return;}if(!detailOpen||mode!==kind || (kind==='frequency'&&(hz<80||hz>8000)))return;
    beforePlay();const current=++token,ac=audio();await ac.resume();if(current!==token||mode!==kind)return;
    if(kind==='frequency'&&(hz<80||hz>8000))return;
    oscillator=ac.createOscillator();level=ac.createGain();oscillator.frequency.value=kind==='amplitude'?440:hz;
    level.gain.value=kind==='amplitude'?sceneGain(db):.12;oscillator.connect(level).connect(output());oscillator.start();playing=kind;buttons();
  }
  function drawDial(){
    const canvas=$('db-dial'),c=canvas.getContext('2d'),w=280,h=260;c.setTransform(3,0,0,3,0,0);c.clearRect(0,0,w,h);
    c.save();c.translate(140,132);const start=Math.PI*.75,span=Math.PI*1.5;
    for(let i=0;i<140;i++){c.beginPath();c.strokeStyle=i<60?'#6ab7a5':i<100?'#e2b357':'#d78272';c.lineWidth=12;c.arc(0,0,100,start+span*i/140,start+span*(i+1)/140);c.stroke();}
    c.font='22px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#577589';
    for(let value=0;value<=140;value+=20){const a=start+span*value/140;c.fillText(value,Math.cos(a)*76,Math.sin(a)*76);}
    const a=start+span*db/140;c.strokeStyle='#187da3';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*88,Math.sin(a)*88);c.stroke();c.fillStyle='#187da3';c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();c.restore();
    c.fillStyle='#233c50';c.font='bold 29px system-ui';c.textAlign='center';c.fillText(db+' dB',140,222);c.font='15px system-ui';c.fillStyle='#637e90';c.fillText('场景示意 · 非实测',140,248);
    canvas.setAttribute('aria-valuenow',db);canvas.setAttribute('aria-valuetext',db+' 分贝，参考场景，非实际输出声压级');
  }
  function setDb(value){
    if(!Number.isFinite(value)){ $('scene-db').value=db;return; }db=Math.round(clamp(value,0,140));$('scene-db').value=db;drawDial();
    const closest=scenes.reduce((a,b)=>Math.abs(b[0]-db)<Math.abs(a[0]-db)?b:a);
    document.querySelectorAll('[data-db]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.db)===closest[0]);b.setAttribute('aria-pressed',String(Number(b.dataset.db)===closest[0]));});
    $('scene-description').textContent=(db===closest[0]?'参考场景：':'邻近参考（约 '+closest[0]+' dB）：')+closest[2];
    if(playing==='amplitude')level.gain.setTargetAtTime(sceneGain(db),audio().currentTime,.03);
  }
  scenes.forEach(([value,name])=>{const b=document.createElement('button');b.dataset.db=value;b.innerHTML='<span></span><b></b>';b.querySelector('span').textContent=name;b.querySelector('b').textContent='约 '+value+' dB';b.onclick=()=>setDb(value);$('scene-list').append(b);});
  $('scene-db').oninput=()=>{if($('scene-db').value!=='')setDb(Number($('scene-db').value));};$('scene-db').onchange=()=>setDb(Number($('scene-db').value));
  const dial=$('db-dial');
  function turn(e){const r=dial.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*280-140,y=(e.clientY-r.top)/r.height*260-132;if(Math.hypot(x,y)<15)return;let a=(Math.atan2(y,x)*180/Math.PI-135+360)%360;if(a>270)a=a>315?0:270;setDb(a/270*140);}
  dial.onpointerdown=e=>{if(e.button!==0)return;dial.setPointerCapture(e.pointerId);turn(e);};dial.onpointermove=e=>{if(dial.hasPointerCapture(e.pointerId))turn(e);};
  dial.onkeydown=e=>{const deltas={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:10,PageDown:-10};if(e.key in deltas){e.preventDefault();setDb(db+deltas[e.key]);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();setDb(e.key==='Home'?0:140);}};
  function updateHearing(){
    const [low,high]=HEARING_RANGES[species],names={human:'人',cat:'猫',dog:'狗',elephant:'亚洲象（单个体实验示例）',orca:'虎鲸（鲸类代表，水下测听）'};
    $('hearing-hz').value=hz;$('hearing-frequency').value=frequencyPosition(hz);$('hearing-frequency').setAttribute('aria-valuetext',hz+' Hz');
    $('hearing-band').style.left=frequencyPosition(low)+'%';$('hearing-band').style.width=(frequencyPosition(high)-frequencyPosition(low))+'%';$('hearing-marker').style.left=frequencyPosition(hz)+'%';
    $('hearing-range').textContent=names[species]+'：约 '+low.toLocaleString()+'—'+high.toLocaleString()+' Hz';
    $('hearing-result').textContent=soundRegion(hz)+' · '+(hz>=low&&hz<=high?'位于所选范围内':'超出所选范围');
    $('hearing-explanation').textContent=species==='elephant'?'条带为 1982 年一头亚洲象在约 16—12,000 Hz 的实验示例，两端需较强声音；不是所有大象的统一上下限。':species==='orca'?'条带依据 2017 年虎鲸综合听力图：约 600 Hz—114 kHz，截止判据为阈值超过 100 dB re 1 μPa。不能推广到所有鲸类，也不能与空气中分贝直接比较。':species==='human'?'以人耳为参照：低于 20 Hz 为次声波，高于 20,000 Hz 为超声波；个体与年龄会影响范围。':'次声与超声仍以人耳为参照；猫狗可听到部分人耳听不到的高频，不代表范围内任何弱声都能听到。';
    $('hearing-audio-note').textContent=hz<80||hz>8000?'当前只显示频率与范围，不发声。电脑未发声不等于动物听不到。':'可试听当前频率的纯音；本站仅开放 80—8,000 Hz 试听，实际听感受设备影响。';
    document.querySelectorAll('[data-species]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.species===species)));
    if(playing==='frequency'){if(hz<80||hz>8000)stop();else oscillator.frequency.setTargetAtTime(hz,audio().currentTime,.02);}buttons();
  }
  function setHz(value){if(Number.isFinite(value))hz=Math.round(clamp(value,1,200000));updateHearing();}
  $('hearing-frequency').oninput=()=>setHz(frequencyAt(Number($('hearing-frequency').value)));
  $('hearing-hz').onchange=()=>setHz(Number($('hearing-hz').value));
  document.querySelectorAll('[data-species]').forEach(b=>b.onclick=()=>{species=b.dataset.species;updateHearing();});
  document.querySelectorAll('[data-hz]').forEach(b=>b.onclick=()=>setHz(Number(b.dataset.hz)));
  $('scene-listen').onclick=()=>listen('amplitude').catch(onError);$('hearing-listen').onclick=()=>listen('frequency').catch(onError);
  function showDetail(open){
    detailOpen=open;beforePlay();
    document.querySelector('main').hidden=open;document.querySelector('body>header').hidden=open;
    $('detail-page').hidden=!open;document.body.classList.toggle('detail-open',open);
    $('scene-instrument').hidden=!open||mode!=='amplitude';$('hearing-instrument').hidden=!open||mode!=='frequency';
    if(open){$('detail-title').textContent=mode==='amplitude'?'响度详情 · 分贝与生活场景':'音调详情 · 频率与听力范围';$('detail-page').scrollTop=0;$('detail-title').focus();}
    else{window.dispatchEvent(new Event('resize'));$('lesson-details').focus();}
  }
  $('lesson-details').onclick=()=>showDetail(true);$('detail-back').onclick=()=>showDetail(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&detailOpen){e.preventDefault();showDetail(false);}});
  document.querySelectorAll('[data-tick]').forEach(t=>t.style.left=frequencyPosition(Number(t.dataset.tick))+'%');
  document.querySelector('.hearing-zones').style.gridTemplateColumns=frequencyPosition(20)+'% '+(frequencyPosition(20000)-frequencyPosition(20))+'% '+(100-frequencyPosition(20000))+'%';
  setDb(db);updateHearing();
  return {stop,setMode(next){if(mode!==next){stop();if(detailOpen)showDetail(false);}mode=next;$('lesson-details').hidden=!['amplitude','frequency'].includes(mode);$('lesson-details').textContent=mode==='amplitude'?'分贝与生活场景 · 详情 ↗':'频率与听力范围 · 详情 ↗';},getState:()=>({mode,detailOpen,db,hz,species,playing,gain:level?.gain.value??0,frequency:oscillator?.frequency.value??null})};
}
