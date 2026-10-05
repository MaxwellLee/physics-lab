import {createInstruments} from './instruments.js';
import {MAX_TRACKS, RATE, AVATARS, COLORS, clamp, tone, pcmEncode, validateClass, sampleAt} from './model.js';
const $ = id => document.getElementById(id);
const names = {sine:'正弦波', square:'方波', sawtooth:'锯齿波', noise:'白噪声'};
const natural = {bird:['鸟叫 · 美洲知更鸟','bird.mp3','🐦'],frog:['蛙鸣 · 花狭口蛙','frog-croak.ogg','🐸'],marsh:['湖蛙 · 连续蛙鸣','marsh-frog.ogg','🐸'],thunder:['雷声 · 清晰增强','thunder-clear.wav','🌩'],rain:['雨声 · 清晰增强','rain-clear.wav','🐼'],chainsaw:['链锯 · 机械噪声','chainsaw.mp3','🐯'],ak47:['AK47 · 实录枪声','ak47.wav','🐯'],explosion:['原子弹爆炸 · 合成音效','nuclear-effect.wav','🐯'],laser:['科幻激光 · 合成音效','laser.wav','🦊'],sonar:['声呐提示 · 合成音效','sonar.wav','🐨'],trump:['特朗普 · 口号原声','trump-slogan.wav','🦁']};
const sourceInfo={
 frog:{label:'花狭口蛙 · Inspector 实录',credits:'Inspector; Banded Bull Frog Call; https://commons.wikimedia.org/wiki/File:Banded_Bull_Frog_Call.ogg ; CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/ ; first 15s, mono 24kHz; excerpt under same license.'},
 marsh:{label:'湖蛙 · Llivermore 实录',credits:'Llivermore; Marsh frog; https://commons.wikimedia.org/wiki/File:Marsh_frog_(Pelophylax_ridibundus)_call.ogg ; CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ ; first 15s, mono 24kHz; excerpt under same license.'},
 rain:{label:'NPS 实录 · 音量增强',credits:'NPS; public domain; https://www.nps.gov/subjects/sound/sounds-rain.htm ; mono 24kHz; amplitude compression power 0.75, peak 0.85.'},
 thunder:{label:'NPS 实录 · 音量增强',credits:'NPS; public domain; https://www.nps.gov/subjects/sound/sounds-thunder.htm ; excerpt 11.77996-23.77996s; mono 24kHz; amplitude compression power 0.75, peak 0.85.'},
 ak47:{label:'qubodup · 实录节选',credits:'qubodup; AK-47; https://freesound.org/people/qubodup/sounds/184750/ ; CC0 https://creativecommons.org/publicdomain/zero/1.0/ ; first 8s, mono 24kHz, peak 0.85.'},
 trump:{label:'2017 原声 · We will…',credits:'Donald Trump; 2017 inaugural address; US Executive Office of the President; public domain; https://commons.wikimedia.org/wiki/File:President_Donald_Trump%27s_First_Inaugural_Address_-_January_20,_2017.wav ; excerpt 974.35-980.60s; mono 24kHz, peak 0.85.'}
};
for(const kind of ['explosion','laser','sonar'])sourceInfo[kind]={label:'教学合成 · 非现场实录',credits:'Physics Lab; original synthesized teaching sound effect; not a recording of a real event.'};
let tracks = [], speed = 1, view = {offset:0,window:3}, selection = {start:0,end:3}, context, gain, source, lessonGain, playback = null, queue = [], recorder = null, stream = null, recordingId = null, recordingPending = false, recordTimer, recordInterval, busy = false, dirty = false, avatarId, nextId = 1, playToken = 0, classroom = null, lessonKind = null, recordingTarget = null, recordingNew = false, recordingCancelled = false, recordToken = 0, liveNode, liveSource, liveMute, liveLoaded = false;
const status = text => {$('status').textContent = text;if($('record-dialog').open)$('record-message').textContent=text;};
const duration = t => t.data.length / RATE;
const total = () => Math.max(recordingId!==null?15:.02, ...tracks.map(t => duration(t) / speed), tracks.some(t => !t.data.length) ? 3 : 0);
const busyRecording = () => recordingPending || recordingId !== null;
function changed(){if(!classroom)dirty = true;}
function protect(fn){return async (...args) => {try {await fn(...args);} catch(e){console.error(e);status(e.message || '操作失败，请重试。');}};}
function audio() {
  if (!context) {context = new AudioContext({sampleRate:RATE});gain=context.createGain();gain.gain.value=Number($('volume').value);gain.connect(context.destination);}
  return context;
}
async function decode(bytes) {
  const offline = new OfflineAudioContext(1, 1, RATE);
  const buffer = await offline.decodeAudioData(bytes);
  const count = Math.min(Math.round(15 * RATE), buffer.length), data = new Float32Array(count);
  for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<count;i++)data[i]+=channel[i]/buffer.numberOfChannels;}
  return data;
}
function stop(reset = true) {
  instruments.stop();
  playToken++;
  queue=[]; if(source){source.onended=null;source.stop();source.disconnect();source=null;}
  lessonGain?.disconnect();lessonGain=null;
  if(reset) playback=null;
  syncPlayback();
  document.querySelectorAll('.track.playing').forEach(e=>e.classList.remove('playing'));
  draw();
}
async function play(t, offset, following=[], sequenceMode=false) {
  if (busyRecording()) {status('请先停止录音，再播放声音。');return;}
  if (!t?.data.length) {status('请先为这条轨道录入声音。');return;}
  const end=Math.min(selection.end, duration(t)/speed), start=offset ?? selection.start;
  if (start >= end) {status('选段不在这条声音范围内，请重新选择或点击“整段播放”。');return;}
  stop(); queue=following;
  const token=playToken,ac=audio(); await ac.resume();if(token!==playToken)return;
  const shouldLoop=$('loop').checked && !sequenceMode;
  if(t.lessonAmplitude!==undefined && lessonKind!=='timbre'){
    source=ac.createOscillator();source.frequency.value=t.frequency*speed;
    lessonGain=ac.createGain();lessonGain.gain.value=t.lessonAmplitude;source.connect(lessonGain).connect(gain);
  }else{
    const buffer=ac.createBuffer(1,t.data.length,RATE);buffer.copyToChannel(t.data,0);
    source=ac.createBufferSource();source.buffer=buffer;source.playbackRate.value=speed;source.connect(gain);
    source.loop=shouldLoop;source.loopStart=selection.start*speed;source.loopEnd=end*speed;
  }
  playback={id:t.id,start,from:ac.currentTime,end,paused:false,loop:shouldLoop,sequenceMode};
  source.onended=()=>{source.disconnect();source=null;lessonGain?.disconnect();lessonGain=null;const next=queue.shift(),rest=[...queue];playback=null;if(next)protect(()=>play(next,undefined,rest,sequenceMode))();else if(sequenceMode && $('loop').checked)$('sequence').click();else stop();};
  if(lessonGain){source.start();if(!shouldLoop)source.stop(ac.currentTime+end-start);}
  else if(shouldLoop)source.start(0,start*speed);else source.start(0,start*speed,(end-start)*speed);
  syncPlayback();
  status(`正在播放：${t.name} · ${speed}×${t.frequency ? ' · '+(t.frequency*speed)+' Hz' : ''}`);
}
function syncPlayback(){
  $('pause').textContent=playback?.paused?'继续':'暂停';$('pause').disabled=!playback;
  document.querySelectorAll('.track').forEach(row=>{const active=playback?.id===Number(row.dataset.id),button=row.querySelector('.track-pause');button.disabled=!active;button.textContent=active&&playback.paused?'继续':'暂停';button.setAttribute('aria-label',button.textContent+'这条声音');row.classList.toggle('playing',active&&!playback.paused);});
}
async function pausePlayback(){if(!playback)return;if(playback.paused){const t=tracks.find(t=>t.id===playback.id),pos=playback.start,rest=[...queue],sequenceMode=playback.sequenceMode;await play(t,pos,rest,sequenceMode);}else{const pos=cursor(),rest=[...queue];playback.start=pos;playback.paused=true;stop(false);queue=rest;status('已暂停，点击“继续”从当前位置播放。');}}
function cursor(){if(!playback)return null;if(playback.paused)return playback.start;let t=playback.start+audio().currentTime-playback.from;if(playback.loop && t>=playback.end)t=selection.start+(t-selection.start)%(playback.end-selection.start);return Math.min(t,playback.end);}
function makeTrack(name, data=new Float32Array(), meta={}) {return {id:nextId++,name,avatar:AVATARS[tracks.length%AVATARS.length],data,label:'学生录音',frequency:null,...meta};}
function room(n=1){if(busyRecording() || busy){status('请等待当前录音或文件处理完成。');return false;}if(classroom)backToClass();if(tracks.length+n>MAX_TRACKS){status(`最多支持 ${MAX_TRACKS} 条声音，请先删除 ${tracks.length+n-MAX_TRACKS} 条不需要的轨道。`);return false;}return true;}
function backToClass(){
  if(!classroom)return;stop();const saved=classroom;tracks=saved.tracks;speed=saved.speed;view=saved.view;setSelection(saved.selection.start,saved.selection.end);$('speed').value=speed;$('loop').checked=saved.loop;$('lesson-note').textContent=saved.note;classroom=null;lessonKind=null;syncLesson();
  document.querySelectorAll('[data-lesson]').forEach(b=>b.classList.remove('active'));render();updateView();$('track-scroll').scrollTop=saved.scroll;status('已返回我的声轨。拖动 ⠿ 调整顺序，把要比较的声音排在一起。');
}
$('back-class').onclick=backToClass;
function syncGutter(){const scroller=$('track-scroll');document.querySelector('.wave-panel').style.setProperty('--scroll-gutter',`${scroller.offsetWidth-scroller.clientWidth}px`);}
function wireReorder(row,t){
  const handle=row.querySelector('.reorder');handle.disabled=!!classroom||busyRecording()||busy;
  handle.onkeydown=e=>{if(!['ArrowUp','ArrowDown'].includes(e.key)||handle.disabled)return;e.preventDefault();const from=tracks.indexOf(t),to=clamp(from+(e.key==='ArrowUp'?-1:1),0,tracks.length-1);if(from===to)return;stop();tracks.splice(from,1);tracks.splice(to,0,t);changed();render();const moved=document.querySelector(`[data-id="${t.id}"]`);moved.querySelector('.reorder').focus({preventScroll:true});moved.scrollIntoView({block:'nearest'});status(`已将 ${t.name} 移到第 ${to+1} 条。`);};
  handle.onpointerdown=e=>{
    if(handle.disabled||e.button!==0)return;e.preventDefault();stop();const scroller=$('track-scroll'),original=[...tracks];let y=e.clientY,frame;
    row.classList.add('dragging');
    const move=()=>{const rect=scroller.getBoundingClientRect();if(y<rect.top+35)scroller.scrollTop-=12;else if(y>rect.bottom-35)scroller.scrollTop+=12;
      const others=[...$('tracks').children].filter(el=>el!==row);const target=others.find(el=>{const r=el.getBoundingClientRect();return y<r.top+r.height/2;});
      if(target) $('tracks').insertBefore(row,target);else $('tracks').append(row);
      frame=requestAnimationFrame(move);
    };
    const pointerMove=event=>{y=event.clientY;};
    const finish=event=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);
      tracks=event.type==='pointercancel'?original:[...$('tracks').children].map(el=>original.find(x=>x.id===Number(el.dataset.id)));
      if(event.type!=='pointercancel')changed();render();status(`已调整顺序：${t.name} 位于第 ${tracks.indexOf(t)+1} 条。`);
    };window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);frame=requestAnimationFrame(move);
  };
}
function add(t){tracks.push(t);changed();overview();render();}
function setSelection(start,end){selection={start,end};$('start').value=start.toFixed(3);$('end').value=end.toFixed(3);}
function overview(){view={offset:0,window:Math.max(3,total())};setSelection(0,total());updateView();}
function updateView(){const max=Math.max(3,total());view.window=clamp(view.window,.005,max);view.offset=clamp(view.offset,0,Math.max(0,total()-view.window));$('zoom').value=100*Math.log(max/view.window)/Math.log(max/.005);$('window-value').textContent=view.window<1?(view.window*1000).toFixed(1)+' ms':view.window.toFixed(2)+' 秒';const panMax=Math.max(0,total()-view.window);$('pan').max=panMax;$('pan').value=view.offset;$('pan').disabled=panMax===0;$('position').max=panMax;$('position').value=view.offset.toFixed(4);$('pan-back').disabled=view.offset<=0;$('pan-next').disabled=view.offset>=panMax;$('overview').classList.toggle('active',view.window>=total());$('detail').classList.toggle('active',view.window<=.1);$('axis-note').textContent=`统一刻度 · 相对幅度 ±1 · 横轴：播放时间（${speed}×）`;draw();}
function render(){
  const root=$('tracks');root.replaceChildren();$('empty').hidden=tracks.length>0;$('count').textContent=classroom ? `${tracks.length} 条演示 · 我的声轨已保留` : `${tracks.length} / ${MAX_TRACKS}`;$('add-student').disabled=(!classroom && tracks.length>=MAX_TRACKS) || busyRecording() || busy;$('back-class').hidden=!classroom;
  tracks.forEach((t,index)=>{
    const row=document.createElement('article');row.className='track';row.classList.toggle('recording-track',recordingId===t.id);row.dataset.id=t.id;row.style.setProperty('--track',COLORS[(t.id-1)%COLORS.length]);
    row.innerHTML='<div class="track-info"><button class="avatar" title="选择或上传头像" aria-label="选择或上传头像"></button><input class="name" maxlength="40" aria-label="声音名称"><div class="track-meta"></div><div class="track-actions"><button class="reorder" title="拖动排序；聚焦后按上下方向键移动" aria-label="拖动排序，或按上下方向键">⠿</button><button class="play">▶ 播放</button><button class="track-pause" disabled>暂停</button><button class="record">● 录音</button><button class="delete" title="删除轨道" aria-label="删除轨道">×</button></div></div><div class="wave-area"><canvas aria-label="声音波形：横轴播放时间，纵轴相对信号幅度"></canvas><span class="wave-placeholder"></span></div>';
    const avatar=row.querySelector('.avatar');if(t.avatar.startsWith('data:')){const img=new Image();img.src=t.avatar;img.alt='自选头像';avatar.append(img);}else avatar.textContent=t.avatar;
    avatar.disabled=!!classroom;avatar.onclick=()=>{avatarId=t.id;$('avatar-dialog').showModal();};
    const name=row.querySelector('.name');name.value=t.name;name.readOnly=!!classroom;name.oninput=()=>{t.name=name.value;changed();};
    syncTrackText(row,t);
    if(lessonKind==='amplitude'||lessonKind==='frequency')addLessonControl(row,t,index);
    row.querySelector('.play').disabled=!t.data.length || busyRecording();row.querySelector('.play').onclick=protect(()=>play(t));
    row.querySelector('.track-pause').onclick=protect(()=>{if(playback?.id===t.id)return pausePlayback();});
    const rec=row.querySelector('.record');rec.textContent=recordingId===t.id?'■ 停止':t.data.length?'● 重录':'● 录音';rec.classList.toggle('recording',recordingId===t.id);rec.disabled=!!classroom || busy || recordingPending || (recordingId!==null && recordingId!==t.id);rec.onclick=()=>showRecording(t);
    row.querySelector('.delete').disabled=!!classroom || busyRecording() || busy;row.querySelector('.delete').onclick=()=>{if(t.data.length&&!confirm(`删除“${t.name}”及其声音？`))return;stop();tracks=tracks.filter(x=>x!==t);changed();overview();render();};
    row.querySelector('.wave-placeholder').textContent=!t.data.length?(recordingId===t.id?'正在录音…':'点击「录音」，留下一段你的声音') : '';
    const canvas=row.querySelector('canvas');let drag=null;
    canvas.onpointerdown=e=>{if(!t.data.length)return;const rect=canvas.getBoundingClientRect();drag={x:e.clientX,offset:view.offset,time:view.offset+clamp((e.clientX-rect.left)/rect.width,0,1)*view.window,pan:e.shiftKey};canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!drag)return;const rect=canvas.getBoundingClientRect();if(drag.pan){view.offset=drag.offset-(e.clientX-drag.x)/rect.width*view.window;updateView();return;}const time=clamp(view.offset+(e.clientX-rect.left)/rect.width*view.window,0,total());const a=Math.min(drag.time,time),b=Math.max(drag.time,time);if(b-a>=.001){stop();setSelection(a,b);changed();draw();}};
    canvas.onpointerup=()=>{drag=null;};canvas.onpointercancel=()=>{drag=null;};
    wireReorder(row,t);
    root.append(row);
  });syncGutter();syncPlayback();draw();
}
function draw(){
  const ruler=$('ruler'),ticks=ruler.clientWidth<350?2:5;ruler.replaceChildren();for(let i=0;i<=ticks;i++){const span=document.createElement('span');span.style.left=(i*100/ticks)+'%';const time=view.offset+view.window*i/ticks;span.textContent=view.window<1?(time*1000).toFixed(1)+' ms':time.toFixed(2)+' s';ruler.append(span);}
  document.querySelectorAll('.track').forEach((row,index)=>{
    const t=tracks.find(t=>t.id===Number(row.dataset.id));if(!t)return;const plotData=t.liveData?t.liveData.subarray(0,t.liveLength):t.data;
    const canvas=row.querySelector('canvas'),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=rect.width,h=rect.height;if(!w)return;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const mid=h/2,amp=h*.36;
    const sx=(selection.start-view.offset)/view.window*w,ex=(selection.end-view.offset)/view.window*w;
    c.fillStyle='#147da509';c.fillRect(Math.max(0,sx),0,Math.max(0,Math.min(w,ex)-Math.max(0,sx)),h);
    c.lineWidth=1;c.strokeStyle='#dce8f0';c.beginPath();for(let i=0;i<=10;i++){c.moveTo(i*w/10,0);c.lineTo(i*w/10,h);}for(const y of [mid-amp,mid,mid+amp]){c.moveTo(0,y);c.lineTo(w,y);}c.stroke();
    c.fillStyle='#7991a2';c.font='9px system-ui';c.fillText('+1',2,mid-amp-3);c.fillText('0',2,mid-3);c.fillText('−1',2,mid+amp+10);
    if(plotData.length){c.strokeStyle=COLORS[(t.id-1)%COLORS.length];c.lineWidth=1.4;c.beginPath();const step=view.window*speed*RATE/w;
      if(step>2){for(let x=0;x<w;x++){const a=Math.max(0,Math.floor((view.offset+view.window*x/w)*speed*RATE)),b=Math.min(plotData.length,Math.ceil(a+step));if(a>=plotData.length)break;let min=1,max=-1;for(let i=a;i<b;i++){min=Math.min(min,plotData[i]);max=Math.max(max,plotData[i]);}c.moveTo(x,mid-max*amp);c.lineTo(x,mid-min*amp);}}
      else {for(let x=0;x<w;x++){const time=view.offset+view.window*x/w;if(time*speed*RATE>=plotData.length)break;const y=mid-sampleAt(plotData,time,speed)*amp;x?c.lineTo(x,y):c.moveTo(x,y);}}c.stroke();
    }
    if(lessonKind && t.frequency)drawMeasurement(c,t,w,h,amp);
    if(sx>0&&sx<w){c.strokeStyle='#91bbcf';c.beginPath();c.moveTo(sx,0);c.lineTo(sx,h);c.stroke();}if(ex>0&&ex<w){c.strokeStyle='#91bbcf';c.beginPath();c.moveTo(ex,0);c.lineTo(ex,h);c.stroke();}
    if(playback?.id===t.id){const x=(cursor()-view.offset)/view.window*w;if(x>=0&&x<=w){c.strokeStyle='#d4544f';c.lineWidth=2;c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}}
  });
}
function syncTrackText(row,t){
  row.querySelector('.name').value=t.name;
  row.querySelector('.track-meta').textContent=t.data.length?`${t.label} · ${(duration(t)/speed).toFixed(2)} s${t.frequency?' · '+(t.frequency*speed)+' Hz':''}`:'等待录音 · 最长 15 秒';
}
function addLessonControl(row,t,index){
  const amplitude=lessonKind==='amplitude',initial=amplitude?[.02,.8][index]:[160,480][index];
  const control=document.createElement('div');control.className='lesson-control';
  control.innerHTML=`<label for="lesson-${t.id}">${amplitude?'振幅 A':'频率（原速）'} <output></output></label><div><input id="lesson-${t.id}" type="range" min="${amplitude?.001:80}" max="${amplitude?1:1000}" step="${amplitude?.001:10}"><button type="button" title="恢复这条演示声轨的预设参数">复原</button></div>`;
  const slider=control.querySelector('input'),output=control.querySelector('output');slider.value=amplitude?t.lessonAmplitude:t.frequency;if(amplitude)slider.title='振幅 0.001—1.000；最左端很弱，向右增强';slider.setAttribute('aria-label',`第 ${index+1} 条演示${amplitude?'振幅':'频率'}`);
  const show=()=>{output.textContent=amplitude?Number(slider.value).toFixed(3):slider.value+' Hz';};show();
  slider.oninput=()=>{
    const value=Number(slider.value);if(!Number.isFinite(value))return;
    if(amplitude)t.lessonAmplitude=clamp(value,.001,1);else t.frequency=clamp(value,80,1000);
    t.data=tone('sine',t.frequency,t.lessonAmplitude);t.name=`正弦波 · ${amplitude?'振幅 '+t.lessonAmplitude.toFixed(3):t.frequency+' Hz'}`;t.label=`正弦波 · A=${t.lessonAmplitude.toFixed(3)}`;
    if(playback?.id===t.id && lessonGain){const now=audio().currentTime;lessonGain.gain.setTargetAtTime(t.lessonAmplitude,now,.015);source.frequency.setTargetAtTime(t.frequency*speed,now,.015);}
    show();syncTrackText(row,t);syncLesson();draw();
    status('参数已更新。点击播放可试听；播放中拖动会实时变声，勾选“循环选段”可持续演示。');
  };
  control.querySelector('button').onclick=()=>{slider.value=initial;slider.oninput();};row.querySelector('.track-info').append(control);
}
function syncLesson(){
  instruments.setMode(lessonKind);
  const labels={amplitude:['响度：只改振幅','同为 220 Hz 正弦波','A = 0.020 → 0.800；看上下高度'],frequency:['音调：只改频率','同为正弦波，A = 0.50','160 Hz → 480 Hz；看周期疏密'],timbre:['音色：只改波形','基频同为 220 Hz，峰值 A = 0.50','正弦 / 方波 / 锯齿波；看周期内形状']};
  if(lessonKind==='amplitude'&&tracks.length===2){labels.amplitude[1]=`同为 ${220*speed} Hz 正弦波`;labels.amplitude[2]=`A = ${tracks[0].lessonAmplitude.toFixed(3)} → ${tracks[1].lessonAmplitude.toFixed(3)}；看上下高度`;labels.amplitude.push('振幅范围 0.001—1.000。拖到最左端与最右端对比；播放中可实时试听。振幅比不是主观响度比。');}
  if(lessonKind==='frequency'&&tracks.length===2){labels.frequency[2]=`${tracks[0].frequency*speed} Hz → ${tracks[1].frequency*speed} Hz；看周期疏密`;labels.frequency.push('拖动各声轨的频率滑块，观察周期变化；振幅保持 0.50。播放中可实时试听，频率越高音调通常越高。');}
  if(labels[lessonKind]?.[3])$('lesson-note').textContent=labels[lessonKind][3];
  document.body.classList.toggle('demo-mode',!!lessonKind);$('lesson-summary').hidden=!lessonKind;$('comparison-title').textContent=lessonKind?labels[lessonKind][0]:'声音对比台';$('lesson-summary').replaceChildren();
  if(lessonKind){const b=document.createElement('b'),span=document.createElement('span');b.textContent='保持不变：'+labels[lessonKind][1];span.textContent='改变 / 观察：'+labels[lessonKind][2];$('lesson-summary').append(b,span);}
  draw();
}
function drawMeasurement(c,t,w,h,amp){
  c.font='11px system-ui';c.fillStyle='#31596d';c.strokeStyle='#6b94a9';c.lineWidth=1;
  if(lessonKind==='amplitude'){
    const peak=t.data.reduce((m,v)=>Math.max(m,Math.abs(v)),0),x=w-70,mid=h/2,top=mid-peak*amp;c.beginPath();c.moveTo(x,mid);c.lineTo(x,top);c.moveTo(x-4,top);c.lineTo(x+4,top);c.moveTo(x-4,mid);c.lineTo(x+4,mid);c.stroke();c.fillText('A = '+peak.toFixed(3),x-14,Math.max(13,top-8));
  }else{
    const f=t.frequency*speed,period=1/f,start=Math.ceil(view.offset*f-1e-8)/f,x=(start-view.offset)/view.window*w,end=x+period/view.window*w;
    if(end<=w&&end-x>30){c.fillStyle='#147da50b';c.fillRect(x,22,end-x,h-35);c.beginPath();c.moveTo(x,24);c.lineTo(x,16);c.lineTo(end,16);c.lineTo(end,24);c.stroke();c.fillStyle='#31596d';c.fillText('T = '+(period*1000).toFixed(2)+' ms',Math.max(4,x+4),12);}
  }
}
function showRecording(t=null){
  if(busyRecording()||busy)return;stop();recordingTarget=t;recordingNew=!t;recordingCancelled=false;$('record-name').value=t?.name||`同学 ${tracks.length+1}`;$('record-name').disabled=false;
  $('record-title').textContent=t?.data.length?'重新录入声音':'录入你的声音';$('record-message').textContent=t?.data.length?'新录音完成后替换旧声音；取消会保留原录音。':'输入姓名，点击开始录音，然后对着麦克风说话。';
  $('record-time').textContent='0.0 / 15 秒';$('record-progress').value=0;$('record-start').hidden=false;$('record-start').disabled=false;$('record-start').textContent='● 开始录音';$('record-finish').hidden=true;$('record-cancel').textContent='取消';$('record-cancel').disabled=false;
  $('record-dialog').showModal();paintRecording();$('record-name').focus();
}
function paintRecording(){
  const canvas=$('record-wave'),c=canvas.getContext('2d'),w=canvas.clientWidth||400,h=110;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;c.scale(devicePixelRatio,devicePixelRatio);c.clearRect(0,0,w,h);c.strokeStyle='#c8dce9';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
  const data=recordingTarget?.liveData,n=recordingTarget?.liveLength||0;if(!data)return;c.strokeStyle='#ce6450';c.beginPath();const step=15*RATE/w;for(let x=0;x<w&&x*step<n;x++){let lo=1,hi=-1;for(let i=Math.floor(x*step);i<Math.min(n,(x+1)*step);i++){lo=Math.min(lo,data[i]);hi=Math.max(hi,data[i]);}c.moveTo(x,h/2-hi*42);c.lineTo(x,h/2-lo*42);}c.stroke();
}
function closeLive(){liveNode?.disconnect();liveSource?.disconnect();liveMute?.disconnect();if(liveNode)liveNode.port.onmessage=null;liveNode=liveSource=liveMute=null;}
async function record(t){
  if(busyRecording()||busy)return;
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)throw Error('当前浏览器无法录音。请使用新版 Chrome / Edge，通过 HTTPS 或 localhost 打开。');
  stop();const token=++recordToken;recordingPending=true;render();$('record-start').disabled=true;$('record-name').disabled=true;status('请允许浏览器使用麦克风…');
  try{
    const ac=audio();await ac.resume();if(!liveLoaded){await ac.audioWorklet.addModule('live-input.js');liveLoaded=true;}
    if(token!==recordToken)return;
    const input=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,autoGainControl:false,echoCancellation:false,noiseSuppression:false}});
    if(token!==recordToken){input.getTracks().forEach(x=>x.stop());return;}stream=input;
    t.liveData=new Float32Array(15*RATE);t.liveLength=0;liveSource=ac.createMediaStreamSource(stream);liveNode=new AudioWorkletNode(ac,'sound-lab-live-input');liveMute=ac.createGain();liveMute.gain.value=0;liveSource.connect(liveNode).connect(liveMute).connect(ac.destination);
    liveNode.port.onmessage=e=>{const chunk=e.data,n=Math.min(chunk.length,t.liveData.length-t.liveLength);if(n>0){t.liveData.set(chunk.subarray(0,n),t.liveLength);t.liveLength+=n;}};
    const chunks=[];recorder=new MediaRecorder(stream);recordingId=t.id;recordingPending=false;const began=performance.now();
    speed=1;$('speed').value=1;view={offset:0,window:15};setSelection(0,15);updateView();render();document.querySelector(`[data-id="${t.id}"]`)?.scrollIntoView({block:'nearest'});
    $('record-start').hidden=true;$('record-finish').hidden=false;$('record-finish').disabled=false;status('正在录音，请对着麦克风说话。波形同步显示，15 秒后自动完成。');
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onerror=()=>{recordingCancelled=true;status('录音设备中断，原声音已保留。');stopRecording();};
    recorder.onstop=protect(async()=>{
      clearTimeout(recordTimer);clearInterval(recordInterval);closeLive();stream?.getTracks().forEach(x=>x.stop());stream=null;recorder=null;recordingId=null;busy=true;render();
      try{if(recordingCancelled){if(recordingNew)tracks=tracks.filter(x=>x!==t);status('已取消本次录音。');}else{const data=await decode(await new Blob(chunks).arrayBuffer());if(data.length<RATE*.1)throw Error('录音太短，请至少录制 0.1 秒。');t.data=data;t.name=$('record-name').value.trim()||t.name;t.frequency=null;t.label='学生录音';t.credits='';recordingNew=false;changed();const peak=data.reduce((m,x)=>Math.max(m,Math.abs(x)),0);status(peak<.001?'录音完成，但信号很弱；请检查麦克风输入，必要时重新录制。':peak>.98?'录音完成，信号接近满幅；可稍远离麦克风重录，避免削波失真。':'录音完成，已保存到对应声轨。可关闭弹窗进行对比。');$('record-cancel').textContent='完成并关闭';}}
      finally{delete t.liveData;delete t.liveLength;busy=false;$('record-finish').hidden=true;$('record-cancel').disabled=false;overview();render();if(recordingCancelled)$('record-dialog').close();else{$('record-start').hidden=false;$('record-start').disabled=false;$('record-start').textContent='● 再录一次';$('record-name').disabled=false;}}
    });
    recorder.start();recordTimer=setTimeout(stopRecording,15000);recordInterval=setInterval(()=>{const elapsed=Math.min(15,(performance.now()-began)/1000);$('record-time').textContent=elapsed.toFixed(1)+' / 15 秒';$('record-progress').value=elapsed;paintRecording();draw();},90);
  }catch(e){if(token!==recordToken)return;closeLive();stream?.getTracks().forEach(x=>x.stop());stream=null;delete t.liveData;delete t.liveLength;recordingPending=false;recordingId=null;render();$('record-start').disabled=false;$('record-name').disabled=false;throw Error(e.name==='NotAllowedError'?'麦克风权限未开启，请在地址栏允许麦克风后重试。':e.name==='NotFoundError'?'未找到麦克风，请连接设备后重试。':e.message);}
}
function stopRecording(){if(recorder?.state==='recording'){clearTimeout(recordTimer);clearInterval(recordInterval);$('record-finish').disabled=true;$('record-cancel').disabled=true;recorder.stop();status('正在处理录音…');}}
$('record-start').onclick=protect(async()=>{if(!recordingTarget||!tracks.includes(recordingTarget)){if(!room())return;recordingTarget=makeTrack($('record-name').value.trim()||`同学 ${tracks.length+1}`);add(recordingTarget);}recordingCancelled=false;await record(recordingTarget);});
$('record-finish').onclick=stopRecording;
function cancelRecording(){if(busy)return;if(recordingId!==null){recordingCancelled=true;stopRecording();return;}recordToken++;recordingPending=false;if(recordingNew&&recordingTarget&&!recordingTarget.data.length){tracks=tracks.filter(t=>t!==recordingTarget);render();}$('record-dialog').close();}
$('record-cancel').onclick=cancelRecording;$('record-dialog').oncancel=e=>{e.preventDefault();cancelRecording();};
$('add-student').onclick=()=>{if(room())showRecording();};
$('add-tone').onclick=()=>{if(!room())return;const type=$('wave').value,f=Number($('frequency').value),a=Number($('amplitude').value);add(makeTrack(names[type],tone(type,f,a),{avatar:'🐼',label:`${names[type]} · A=${a.toFixed(2)}`,frequency:type==='noise'?null:f}));};
document.querySelectorAll('[data-lesson]').forEach(button=>button.onclick=()=>{
  if(busyRecording() || busy){status('请先完成当前录音或文件处理，再切换实验。');return;}
  const mode=button.dataset.lesson;stop();lessonKind=mode;
  if(!classroom)classroom={tracks,speed,view:{...view},selection:{...selection},loop:$('loop').checked,note:$('lesson-note').textContent,scroll:$('track-scroll').scrollTop};
  tracks=[];$('loop').checked=true;$('track-scroll').scrollTop=0;
  const specs=mode==='amplitude'?[['sine',220,.02],['sine',220,.8]]:mode==='frequency'?[['sine',160,.5],['sine',480,.5]]:[['sine',220,.5],['square',220,.5],['sawtooth',220,.5]];
  for(const [type,f,a] of specs)tracks.push(makeTrack(`${names[type]} · ${mode==='amplitude'?'振幅 '+a:f+' Hz'}`,tone(type,f,a),{label:`${names[type]} · A=${a.toFixed(2)}`,frequency:f,lessonAmplitude:a}));
  changed();speed=1;$('speed').value=1;overview();view.window=.025;view.offset=.1;updateView();render();
  const notes={amplitude:'响度实验：频率同为 220 Hz，波形相同，振幅为 0.020 与 0.800。先观察上下高度，再轮流听。保持系统音量不变；振幅比不是主观响度比。',frequency:'音调实验：振幅同为 0.50，比较 160 Hz 与 480 Hz。相同时间里，后者的完整周期数为前者的 3 倍。再改变播放速度，观察周期与听感一起变化。',timbre:'音色实验：三种波形的基频同为 220 Hz，周期同为约 4.55 ms，细节形状不同。依次听正弦波、方波、锯齿波；同峰值不代表同响度，不要把周期内部的小尖峰当成新周期。'};
  $('lesson-note').textContent=notes[mode];syncLesson();document.querySelectorAll('[data-lesson]').forEach(b=>b.classList.toggle('active',b===button));status('正在演示：'+button.querySelector('b').textContent+'。已默认循环：单轨持续试听，轮流播放循环对比。点击“返回我的声轨”可恢复学生录音。');
});
document.querySelectorAll('[data-nature]').forEach(button=>button.onclick=protect(async()=>{if(!room())return;busy=true;button.disabled=true;render();try{const kind=button.dataset.nature,[name,file,avatar]=natural[kind];status(`正在加载${name}…`);const res=await fetch(`audio/${file}`);if(!res.ok)throw Error('素材加载失败，请检查网站资源后重试。');const data=await decode(await res.arrayBuffer());add(makeTrack(name,data,{avatar:AVATARS.includes(avatar)?avatar:'🐧',...(sourceInfo[kind]||{label:'NPS 环境实录',credits:'NPS; public domain; https://www.nps.gov/subjects/sound/gallery.htm'})}));status('声音已添加。素材经过节选或音量调整，不用于比较真实声源响度。');}finally{busy=false;button.disabled=false;render();}}));
$('add-noise').onclick=()=>{if(room()){add(makeTrack('白噪声',tone('noise',220,.5),{label:'白噪声 · 随机信号',frequency:null}));$('lesson-note').textContent='白噪声没有稳定重复周期；链锯可用于听辨机械噪声。环境意义上的噪声取决于是否妨碍生活学习，不能只凭波形是否规则判断。';}};
$('frequency').oninput=()=>{$('frequency-value').textContent=$('frequency').value+' Hz';};$('amplitude').oninput=()=>{$('amplitude-value').textContent=Number($('amplitude').value).toFixed(2);};$('wave').onchange=()=>{$('frequency').disabled=$('wave').value==='noise';$('frequency-value').textContent=$('wave').value==='noise'?'无单一频率':$('frequency').value+' Hz';};
$('speed').onchange=()=>{const old=speed;stop();speed=Number($('speed').value);setSelection(selection.start*old/speed,selection.end*old/speed);view.offset*=old/speed;changed();updateView();render();syncLesson();status(`${speed}× 播放：频率变为原来的 ${speed} 倍，时长变为原来的 ${(1/speed).toFixed(2)} 倍。横轴仍为播放秒数，时间窗保持不变。`);};
$('volume').oninput=()=>{if(gain)gain.gain.setTargetAtTime(Number($('volume').value),audio().currentTime,.02);changed();};
$('stop').onclick=()=>{stop();status('已停止播放。');};
$('pause').onclick=protect(pausePlayback);
$('sequence').onclick=protect(async()=>{const list=tracks.filter(t=>duration(t)/speed>selection.start);if(!list.length){status('当前选段内没有声音。');return;}await play(list[0],undefined,list.slice(1),true);});
$('loop').onchange=()=>{stop();changed();};
function selectionInput(){const a=Number($('start').value),b=Number($('end').value);if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||b>Math.max(total(),.02)){status('选段需满足：0 ≤ 起点 < 终点 ≤ 最长声音时长。');setSelection(selection.start,selection.end);return;}stop();setSelection(a,b);changed();draw();}
$('start').onchange=selectionInput;$('end').onchange=selectionInput;
$('select-view').onclick=()=>{stop();setSelection(view.offset,Math.min(total(),view.offset+view.window));changed();draw();};$('clear-selection').onclick=()=>{stop();setSelection(0,total());changed();draw();};
$('overview').onclick=()=>{view={offset:0,window:Math.max(3,total())};changed();updateView();};$('detail').onclick=()=>{view.window=.025;changed();updateView();};$('reset-view').onclick=()=>{stop();speed=1;$('speed').value=1;$('loop').checked=!!lessonKind;overview();changed();render();syncLesson();};
$('zoom').oninput=()=>{const max=Math.max(3,total());view.window=max*Math.pow(.005/max,Number($('zoom').value)/100);changed();updateView();};$('pan').oninput=()=>{view.offset=Number($('pan').value);changed();updateView();};
$('position').onchange=()=>{const value=Number($('position').value);if(Number.isFinite(value)){view.offset=value;changed();}updateView();};
$('pan-back').onclick=()=>{view.offset-=view.window/10;changed();updateView();};$('pan-next').onclick=()=>{view.offset+=view.window/10;changed();updateView();};
AVATARS.forEach(emoji=>{const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label',`选择头像 ${emoji}`);button.onclick=()=>{const t=tracks.find(t=>t.id===avatarId);if(t){t.avatar=emoji;changed();render();}$('avatar-dialog').close();};$('avatars').append(button);});
$('upload-avatar').onclick=()=>$('avatar-file').click();
$('avatar-file').onchange=protect(async()=>{const file=$('avatar-file').files[0];$('avatar-file').value='';if(!file)return;if(file.size>5e6||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 5 MB 以内的 PNG、JPEG 或 WebP 图片。');const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const side=Math.min(bitmap.width,bitmap.height);canvas.getContext('2d').drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,128,128);bitmap.close();const t=tracks.find(t=>t.id===avatarId);if(t){t.avatar=canvas.toDataURL('image/jpeg',.8);changed();render();}$('avatar-dialog').close();});
$('import-audio').onclick=()=>{if(room())$('audio-file').click();};
$('audio-file').onchange=protect(async()=>{const file=$('audio-file').files[0];$('audio-file').value='';if(!file||!room())return;if(file.size>20e6)throw Error('声音文件请控制在 20 MB 以内。');busy=true;render();try{status('正在读取声音…');const data=await decode(await file.arrayBuffer());add(makeTrack(file.name.slice(0,40),data,{label:'导入声音'}));status('导入完成，保留最多前 15 秒。');}catch{throw Error('无法解码这个声音文件，请使用浏览器支持的 WAV、MP3 或 WebM。');}finally{busy=false;render();}});
function exportClass(){const active=classroom||{tracks,speed,view,selection,loop:$('loop').checked};return {format:'physics-sound-lab',version:1,tracks:active.tracks.map(t=>({name:t.name,avatar:t.avatar,label:t.label,frequency:t.frequency,credits:t.credits||'',pcm:pcmEncode(t.data)})),settings:{speed:active.speed,volume:Number($('volume').value),offset:active.view.offset,window:active.view.window,start:active.selection.start,end:active.selection.end,loop:active.loop}};}
$('save').onclick=protect(()=>{if(busyRecording()||busy){status('请等待录音或文件处理完成后再保存。');return;}const blob=new Blob([JSON.stringify(exportClass())],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`声音课堂-${new Date().toISOString().slice(0,10)}.soundlab`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dirty=false;status('已发起课堂文件下载（我的声轨与设置），请确认浏览器已保存到电脑。录音和头像不会上传。');});
$('open').onclick=()=>{if(!busyRecording()&&!busy)$('class-file').click();else status('请先完成当前录音或文件处理。');};
async function loadClass(obj){const parsed=validateClass(obj);stop();classroom=null;lessonKind=null;syncLesson();document.querySelectorAll('[data-lesson]').forEach(b=>b.classList.remove('active'));tracks=parsed.tracks.map(t=>({...t,id:nextId++}));const s=parsed.settings;speed=s.speed;view={offset:s.offset,window:s.window};setSelection(s.start,s.end);$('speed').value=speed;$('volume').value=s.volume;$('loop').checked=s.loop;if(gain)gain.gain.value=s.volume;dirty=false;updateView();render();status('课堂已恢复，可以继续播放和录音。');}
$('class-file').onchange=protect(async()=>{const file=$('class-file').files[0];$('class-file').value='';if(!file||busyRecording()||busy)return;if(file.size>12e6)throw Error('课堂文件超过 12 MB，无法打开。');if(dirty&&!confirm('打开课堂会替换当前内容。请确认已保存需要保留的录音。'))return;busy=true;try{const obj=JSON.parse(await file.text());await loadClass(obj);}catch(e){throw Error(`打开失败，当前课堂保持不变：${e.message}`);}finally{busy=false;render();}});
window.addEventListener('beforeunload',e=>{if(dirty||busyRecording()){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{instruments.stop();stream?.getTracks().forEach(t=>t.stop());});window.addEventListener('resize',()=>{syncGutter();draw();});
let lastFrame=0;function animate(now){if(playback&&!playback.paused&&now-lastFrame>45){draw();lastFrame=now;}requestAnimationFrame(animate);}requestAnimationFrame(animate);
const instruments=createInstruments({audio,output:()=>gain,beforePlay:stop,onError:e=>status(e.message||'试听失败，请重试。')});
render();updateView();
// Narrow test seam: classroom round-trip and source-time invariants, no network or persistent storage.
window.soundLab={exportClass,loadClass,getInstrumentState:instruments.getState,getState:()=>({tracks:tracks.map(t=>({id:t.id,name:t.name,length:t.data.length,liveSamples:t.liveLength||0,frequency:t.frequency,amplitude:t.lessonAmplitude,peak:t.lessonAmplitude===undefined?null:t.data.reduce((m,x)=>Math.max(m,Math.abs(x)),0)})),audioParameters:lessonGain?{frequency:source.frequency.value,amplitude:lessonGain.gain.value}:null,speed,view,selection,recordingId,playback,lessonMode:!!classroom})};
