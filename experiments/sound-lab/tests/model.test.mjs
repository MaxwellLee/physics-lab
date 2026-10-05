import assert from 'node:assert/strict';
import {tone,RATE,sampleAt,pcmEncode,pcmDecode,validateClass} from '../model.js';
const sine=tone('sine',200,.5), loud=tone('sine',200,.8);
const peak=data=>data.reduce((max,v)=>Math.max(max,Math.abs(v)),0);
assert.equal(sine.length,RATE*3);assert.ok(Math.abs(peak(loud)/peak(sine)-1.6)<1e-6);
for(const type of ['sine','square','sawtooth']){
 const data=tone(type,200,.5);assert.ok(Math.abs(peak(data)-.5)<1e-6);
 for(let i=0;i<120;i++)assert.ok(Math.abs(data[i]-data[i+120])<1e-6,`${type} period`);
}
assert.ok(Math.abs(sampleAt(sine,.001,2)-sampleAt(sine,.002,1))<1e-6);
assert.equal(sampleAt(sine,-1),0);assert.equal(sampleAt(sine,4),0);
const restored=pcmDecode(pcmEncode(sine));assert.equal(restored.length,sine.length);
for(let i=0;i<sine.length;i+=31)assert.ok(Math.abs(restored[i]-sine[i])<=1/32767);
const classroom={format:'physics-sound-lab',version:1,tracks:[{name:'小明',avatar:'🐱',label:'学生录音',frequency:null,pcm:pcmEncode(sine)}],settings:{speed:2,volume:.35,offset:.1,window:.025,start:0,end:1.5,loop:false}};
assert.equal(validateClass(classroom).tracks[0].name,'小明');
for(const corrupt of [{...classroom,version:2},{...classroom,tracks:Array(11).fill(classroom.tracks[0])},{...classroom,settings:{...classroom.settings,speed:NaN}},{...classroom,tracks:[{...classroom.tracks[0],avatar:'https://example.com/tracker'}]},{...classroom,tracks:[{...classroom.tracks[0],pcm:'?!'}]}])assert.throws(()=>validateClass(corrupt));
assert.throws(()=>tone('sine',0));
console.log('PASS: synthesis periods, amplitude, speed mapping, PCM round-trip, invalid class rejection');

assert.equal(validateClass({...classroom,tracks:Array(10).fill(classroom.tracks[0])}).tracks.length,10);

for(const amplitude of [.001,1])assert.ok(Math.abs(peak(tone("sine",220,amplitude))-amplitude)<1e-6);
for(const amplitude of [0,1.001,NaN])assert.throws(()=>tone("sine",220,amplitude));

const {HEARING_RANGES,frequencyPosition,frequencyAt,soundRegion,sceneGain}=await import('../model.js');
for(const hz of [1,20,67,1000,20000,45000,64000,100000,114000,200000])assert.ok(Math.abs(frequencyAt(frequencyPosition(hz))-hz)<=1);
assert.equal(soundRegion(19),'次声波');assert.equal(soundRegion(20),'人耳可听频段');assert.equal(soundRegion(20000),'人耳可听频段');assert.equal(soundRegion(20001),'超声波');
assert.deepEqual(HEARING_RANGES.cat,[45,64000]);assert.deepEqual(HEARING_RANGES.dog,[67,45000]);
assert.equal(sceneGain(140),.5);assert.equal(sceneGain(200),.5);assert.ok(sceneGain(40)<sceneGain(90));assert.ok(sceneGain(140)/sceneGain(0)>250);
console.log('PASS: hearing boundaries, logarithmic frequency scale and bounded scene audition');

assert.deepEqual(HEARING_RANGES.elephant,[16,12000]);assert.deepEqual(HEARING_RANGES.orca,[600,114000]);
