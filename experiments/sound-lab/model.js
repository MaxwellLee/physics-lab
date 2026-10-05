export const RATE = 24000;
export const MAX_TRACKS = 10;
export const AVATARS = ['🐱','🐶','🐼','🦊','🐰','🐸','🐯','🐨','🐧','🦁','🐹','🐻'];
export const COLORS = ['#187ea9','#d08531','#8a67b5','#38988c','#c56783','#5f82c1','#a46543','#658c37','#b45258','#536ca3'];
export const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
export const HEARING_RANGES = {human:[20,20000],dog:[67,45000],cat:[45,64000],elephant:[16,12000],orca:[600,114000]};
export const frequencyPosition = hz => Math.log10(clamp(hz,1,200000))/Math.log10(200000)*100;
export const frequencyAt = position => Math.round(10**(clamp(position,0,100)/100*Math.log10(200000)));
export const soundRegion = hz => hz<20?'次声波':hz>20000?'超声波':'人耳可听频段';
// Compress the scene scale into a 48 dB playback span. This is NOT calibrated SPL.
export const sceneGain = db => .5*10**((clamp(db,0,140)-140)*48/140/20);
export function tone(type, frequency = 220, amplitude = .5, duration = 3) {
  if (!['sine','square','sawtooth','noise'].includes(type) || !Number.isFinite(frequency) || frequency < 80 || frequency > 1000 || !Number.isFinite(amplitude) || amplitude < .001 || amplitude > 1 || duration <= 0 || duration > 15) throw Error('合成参数无效');
  const data = new Float32Array(Math.round(RATE * duration));
  // Band-limit harmonics below 6 kHz so 2x playback remains below source Nyquist.
  const harmonics = Math.min(35, Math.floor(5900 / frequency));
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const phase = 2 * Math.PI * frequency * i / RATE;
    let value = type === 'noise' ? Math.random() * 2 - 1 : Math.sin(phase);
    if (type === 'square' || type === 'sawtooth') {
      value = 0;
      for (let n = 1; n <= harmonics; n += type === 'square' ? 2 : 1) value += Math.sin(n * phase) / n;
    }
    data[i] = value; peak = Math.max(peak, Math.abs(value));
  }
  // Peak amplitude is a chosen synthesis parameter; never normalize recorded audio.
  for (let i = 0; i < data.length; i++) data[i] *= amplitude / (peak || 1);
  return data;
}
export function pcmEncode(data) {
  const bytes = new Uint8Array(data.length * 2), view = new DataView(bytes.buffer);
  for (let i = 0; i < data.length; i++) view.setInt16(i * 2, Math.round(clamp(data[i], -1, 1) * 32767), true);
  let str = ''; for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(str);
}
export function pcmDecode(str) {
  if (typeof str !== 'string' || str.length > RATE * 15 * 2 * 4 / 3 + 8 || str.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(str)) throw Error('课堂音频数据无效');
  const raw = atob(str); if (raw.length % 2) throw Error('课堂音频长度无效');
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0)), view = new DataView(bytes.buffer), data = new Float32Array(raw.length / 2);
  for (let i = 0; i < data.length; i++) data[i] = view.getInt16(i * 2, true) / 32767;
  return data;
}
export function validateClass(obj) {
  if (obj?.format !== 'physics-sound-lab' || obj.version !== 1 || !Array.isArray(obj.tracks) || obj.tracks.length > MAX_TRACKS) throw Error('不是受支持的声音课堂文件');
  const tracks = obj.tracks.map(t => {
    if (typeof t.name !== 'string' || t.name.length > 40 || typeof t.avatar !== 'string' || (!AVATARS.includes(t.avatar) && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,100000}$/.test(t.avatar)) || typeof t.label !== 'string' || t.label.length > 140 || !(t.frequency === null || (Number.isFinite(t.frequency) && t.frequency >= 80 && t.frequency <= 1000))) throw Error('课堂轨道信息无效');
    if(t.credits!==undefined && (typeof t.credits!=='string'||t.credits.length>600))throw Error('声音来源信息无效');
    return {credits:t.credits||'',name:t.name, avatar:t.avatar, label:t.label, frequency:t.frequency, data:pcmDecode(t.pcm)};
  });
  const s = obj.settings;
  if (!s || ![.25,.5,.75,1,1.5,2].includes(s.speed) || !Number.isFinite(s.volume) || s.volume < 0 || s.volume > 1 || !Number.isFinite(s.offset) || s.offset < 0 || s.offset > 60 || !Number.isFinite(s.window) || s.window < .005 || s.window > 60 || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end <= s.start || s.end > 60 || typeof s.loop !== 'boolean') throw Error('课堂设置无效');
  return {tracks, settings:{speed:s.speed,volume:s.volume,offset:s.offset,window:s.window,start:s.start,end:s.end,loop:s.loop}};
}
export function sampleAt(data, time, speed = 1) {
  const p = time * speed * RATE, i = Math.floor(p);
  if (i < 0 || i >= data.length) return 0;
  return data[i] + ((data[i + 1] ?? data[i]) - data[i]) * (p - i);
}
