import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HTTP_PAGE = `http://localhost:${process.env.GALAXY_PORT ?? 8766}/experiments/galaxy/`;
const FILE_PAGE = pathToFileURL(resolve('experiments/galaxy/index.html')).href;
const PORT = 9900 + Math.floor(Math.random() * 90);
const PROFILE_DIR = `${process.env.GALAXY_PROFILE_ROOT ?? 'C:/tmp'}/edge-galaxy-${PORT}`;
const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));
const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
  `--remote-debugging-port=${PORT}`, '--window-size=1440,900',
  `--user-data-dir=${PROFILE_DIR}`,
  'about:blank'
], { detached: true, stdio: 'ignore' });
edge.unref();

let ws;
try {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(200); }
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => { ws.onopen = resolvePromise; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);clearTimeout(request.timer);request.resolve(message);pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details?.exception?.description ?? details?.text ?? 'exception');
    }
  };
  ws.onclose = () => {
    for (const request of pending.values()) { clearTimeout(request.timer);request.reject(new Error('Edge DevTools connection closed')); }
    pending.clear();
  };
  const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => { pending.delete(callId);reject(new Error(`Edge DevTools timeout: ${method}`)); }, 12000);
    pending.set(callId, { resolve:resolvePromise, reject, timer });
    ws.send(JSON.stringify({ id:callId, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true });
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  };
  const waitFor = async (expression, timeout = 10000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try { if (await evaluate(expression)) return Date.now() - started; } catch {}
      await sleep(200);
    }
    return -1;
  };

  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled:true });
  await send('Network.emulateNetworkConditions', { offline:false, latency:180, downloadThroughput:32*1024, uploadThroughput:32*1024, connectionType:'cellular3g' });
  await send('Page.navigate', { url:`${HTTP_PAGE}?cold-start=${Date.now()}` });
  await sleep(16000);
  const slowState = await evaluate(`(() => { const loading=document.getElementById('loading'); return { failed:loading?.classList.contains('failed')??false, errorHidden:document.getElementById('loading-error')?.hidden!==false, title:document.getElementById('loading-title')?.textContent??'' }; })()`);
  check('慢速冷启动 15 秒后不会误报失败', !slowState.failed && slowState.errorHidden, slowState.title);
  const slowReadyMs = await waitFor('window.__galaxyReady === true', 30000);
  check('约 256 Kbps 冷启动可自动恢复', slowReadyMs >= 0 && slowReadyMs < 28000, `${slowReadyMs} ms after checkpoint`);
  const initialTextureState = await evaluate('window.__galaxyTextureState');
  check('核心模型先于高清纹理就绪', initialTextureState.pending > 0, JSON.stringify(initialTextureState));

  await send('Network.emulateNetworkConditions', { offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1, connectionType:'none' });
  await send('Network.setCacheDisabled', { cacheDisabled:false });
  const texturesReadyMs = await waitFor('window.__galaxyTextureState?.pending === 0', 15000);
  const finalTextureState = await evaluate('window.__galaxyTextureState');
  check('真实天体纹理在后台完成加载', texturesReadyMs >= 0 && finalTextureState.failed === 0, `${texturesReadyMs} ms · ${JSON.stringify(finalTextureState)}`);

  const modes = await evaluate(`(async () => {
    const click=async selector=>{document.querySelector(selector).click();await new Promise(resolvePromise=>setTimeout(resolvePromise,850));return document.body.className};
    const neighborhood=await click('[data-target="solar-neighborhood"]');
    const solar=await click('[data-target="solar-system"]');
    const earth=await click('#system-strip [data-target="earth"]');
    const blackhole=await click('[data-target="sagittarius-a"]');
    document.getElementById('home-button').click();await new Promise(resolvePromise=>setTimeout(resolvePromise,850));
    return {neighborhood,solar,earth,blackhole,home:document.body.className};
  })()`);
  check('银河系、太阳邻域、太阳系、地月系和黑洞视图可切换', modes.neighborhood.includes('mode-neighborhood') && modes.solar.includes('mode-solar') && modes.earth.includes('mode-earth') && modes.blackhole.includes('mode-blackhole') && modes.home.includes('mode-galaxy'), JSON.stringify(modes));

  const controls = await evaluate(`(async () => {
    const play=document.getElementById('play-button');if(play.querySelector('span').textContent==='▶')play.click();play.click();const paused=play.querySelector('span').textContent==='▶';
    const before=document.getElementById('speed-button').querySelector('b').textContent;document.getElementById('speed-button').click();const sped=document.getElementById('speed-button').querySelector('b').textContent!==before;
    const orbit=document.getElementById('orbit-button');orbit.click();const orbitOff=orbit.getAttribute('aria-pressed')==='false';
    const labels=document.getElementById('label-button');labels.click();await new Promise(resolvePromise=>setTimeout(resolvePromise,80));const labelsOff=document.body.classList.contains('no-labels');
    return {paused,sped,orbitOff,labelsOff};
  })()`);
  check('播放、暂停、速度、轨迹与标签控制正常', Object.values(controls).every(Boolean), JSON.stringify(controls));

  await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:3, mobile:true });
  await send('Page.navigate', { url:`${HTTP_PAGE}?mobile=${Date.now()}` });
  const mobileReadyMs = await waitFor('window.__galaxyReady === true', 8000);
  check('手机窄视口可正常启动', mobileReadyMs >= 0, `${mobileReadyMs} ms`);
  check('手机底部控制条保持在视口内', await evaluate(`(() => { const r=document.querySelector('.transport').getBoundingClientRect(); return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight; })()`));

  await send('Emulation.clearDeviceMetricsOverride');
  await send('Page.navigate', { url:FILE_PAGE });
  const fileReadyMs = await waitFor('window.__galaxyReady === true', 8000);
  check('直接打开本地 HTML 仍可启动', fileReadyMs >= 0, `${fileReadyMs} ms`);
  const fileTexturesMs = await waitFor('window.__galaxyTextureState?.pending === 0', 12000);
  const fileTextureState = await evaluate('window.__galaxyTextureState');
  check('本地文件模式使用无报错教学配色回退', fileTexturesMs >= 0 && fileTextureState.failed === 0 && fileTextureState.skipped === true, `${fileTexturesMs} ms · ${JSON.stringify(fileTextureState)}`);
  check('控制台无异常', errors.length === 0, errors.slice(0,2).join(' | '));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} 通过`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (error) {
  console.error('银河系浏览器冒烟测试失败:', error.message);process.exitCode=1;
} finally {
  try { if(ws?.readyState===1){ws.send(JSON.stringify({id:9999,method:'Browser.close'}));await sleep(500)} } catch {}
  try { ws?.close() } catch {}
  spawnSync('taskkill',['/PID',String(edge.pid),'/T','/F'],{stdio:'ignore'});
  try { rmSync(PROFILE_DIR,{recursive:true,force:true}) } catch {}
}
