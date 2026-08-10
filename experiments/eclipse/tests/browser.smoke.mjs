import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const HTTP_PAGE = `http://localhost:${process.env.ECLIPSE_PORT ?? 8766}/experiments/eclipse/`;
const FILE_PAGE = pathToFileURL(resolve('experiments/eclipse/index.html')).href;
const PORT = 9600 + Math.floor(Math.random() * 300);
const PROFILE_DIR = `${process.env.ECLIPSE_PROFILE_ROOT ?? 'C:/tmp'}/edge-eclipse-${PORT}`;
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
      const request = pending.get(message.id);
      clearTimeout(request.timer);
      request.resolve(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details?.exception?.description ?? details?.text ?? 'exception');
    }
  };
  ws.onclose = () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Edge DevTools connection closed'));
    }
    pending.clear();
  };
  const send = (method, params = {}) => new Promise((resolvePromise, reject) => {
    const callId = ++id;
    const timer = setTimeout(() => {
      pending.delete(callId);
      reject(new Error(`Edge DevTools timeout: ${method}`));
    }, 12000);
    pending.set(callId, { resolve: resolvePromise, reject, timer });
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 180,
    downloadThroughput: 32 * 1024,
    uploadThroughput: 32 * 1024,
    connectionType: 'cellular3g'
  });
  await send('Page.navigate', { url: `${HTTP_PAGE}?cold-start=${Date.now()}` });
  await sleep(9000);
  const slowState = await evaluate(`(() => {
    const loading = document.getElementById('loading');
    return {
      failed: loading?.classList.contains('failed') ?? false,
      errorHidden: document.getElementById('loading-error')?.hidden !== false,
      title: document.getElementById('loading-title')?.textContent ?? ''
    };
  })()`);
  check('慢速冷启动 8 秒后不会误报失败', !slowState.failed && slowState.errorHidden, slowState.title);
  const slowReadyMs = await waitFor('window.__orbitalModelReady === true', 23000);
  check('约 256 Kbps 冷启动可在最终超时前恢复', slowReadyMs >= 0 && slowReadyMs < 21000, `${slowReadyMs} ms after checkpoint`);
  check('慢速启动后错误卡片保持隐藏', await evaluate('document.getElementById("loading-error")?.hidden !== false'));

  await send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'none'
  });
  await send('Network.setCacheDisabled', { cacheDisabled: false });
  const textureReadyMs = await waitFor('document.getElementById("quality-button").disabled === false', 12000);
  check('真实天体纹理在后台完成加载', textureReadyMs >= 0 && !await evaluate('document.getElementById("quality-button").textContent.includes("失败")'), `${textureReadyMs} ms`);

  console.log('\n开始情景与控制回归…');
  const scenarios = await evaluate(`(async () => {
    const names = ['solar-total','solar-partial','solar-annular','lunar-total','lunar-partial'];
    const readings = [];
    for (const name of names) {
      document.querySelector('[data-scenario="' + name + '"]').click();
      for (const time of [-1.05, 0, 1.05]) {
        const slider = document.getElementById('time-slider');
        slider.value = String(time);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolvePromise => setTimeout(resolvePromise, 40));
        readings.push({ name, time, title: document.getElementById('event-title').textContent, coverage: document.getElementById('coverage-value').textContent });
      }
    }
    return readings;
  })()`);
  check('五种情景的开始、食甚与结束均可计算', scenarios.length === 15 && scenarios.every(item => /%$/.test(item.coverage)));

  const controls = await evaluate(`(async () => {
    document.querySelector('[data-scenario="solar-total"]').click();
    const play = document.getElementById('play-button');
    if (play.querySelector('span').textContent === '▶') play.click();
    play.click();
    const paused = play.querySelector('span').textContent === '▶';
    document.getElementById('reverse-button').click();
    const reversed = document.getElementById('speed-button').querySelector('b').textContent.startsWith('-');
    document.getElementById('speed-button').click();
    const spedUp = document.getElementById('speed-button').querySelector('b').textContent === '-2×';
    const orbit = document.getElementById('orbit-toggle'); orbit.click();
    const labels = document.getElementById('label-toggle'); labels.click();
    await new Promise(resolvePromise => setTimeout(resolvePromise, 80));
    return { paused, reversed, spedUp, orbitOff: !orbit.checked, labelsOff: !labels.checked && getComputedStyle(document.getElementById('earth-label')).opacity === '0' };
  })()`);
  check('暂停、倒放与变速控制正常', controls.paused && controls.reversed && controls.spedUp, JSON.stringify(controls));
  check('轨迹和标签显隐开关正常', controls.orbitOff && controls.labelsOff, JSON.stringify(controls));

  await evaluate('document.getElementById("observe-button").click()');
  await sleep(1200);
  check('可进入地面观测视角', await evaluate('document.body.classList.contains("ground-view") && !document.getElementById("ground-canvas").hidden'));
  await evaluate('document.getElementById("space-return").click()');
  await sleep(1200);
  check('可返回三维空间视角', await evaluate('!document.body.classList.contains("ground-view") && document.getElementById("ground-canvas").hidden'));

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  console.log('开始手机视口回归…');
  await send('Page.navigate', { url: `${HTTP_PAGE}?mobile=${Date.now()}` });
  const mobileReadyMs = await waitFor('window.__orbitalModelReady === true', 8000);
  check('手机窄视口可正常启动', mobileReadyMs >= 0, `${mobileReadyMs} ms`);
  check('手机控制面板保持在视口内', await evaluate(`(() => { const r=document.getElementById('control-panel').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight; })()`));

  await send('Emulation.clearDeviceMetricsOverride');
  console.log('开始本地文件模式回归…');
  await send('Page.navigate', { url: FILE_PAGE });
  const fileReadyMs = await waitFor('window.__orbitalModelReady === true', 8000);
  check('直接打开本地 HTML 仍可启动', fileReadyMs >= 0, `${fileReadyMs} ms`);
  const fileTextureReadyMs = await waitFor('document.getElementById("quality-button").disabled === false', 8000);
  check('本地文件模式仍可加载真实纹理', fileTextureReadyMs >= 0 && !await evaluate('document.getElementById("quality-button").textContent.includes("失败")'), `${fileTextureReadyMs} ms`);
  check('本地文件模式没有启动错误', await evaluate('!document.getElementById("loading")?.classList.contains("failed")'));
  check('控制台无异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} 通过`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (error) {
  console.error('日月食浏览器冒烟测试失败:', error.message);
  process.exitCode = 1;
} finally {
  try {
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ id: 9999, method: 'Browser.close' }));
      await sleep(500);
    }
  } catch {}
  try { ws?.close(); } catch {}
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
  try { rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch {}
}
