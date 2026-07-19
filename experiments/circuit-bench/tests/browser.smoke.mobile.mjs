// 电学实验台移动端冒烟测试（390×844 视口 + 触摸模拟）：
// 验证移动布局（面板初始折叠、运输条视口内）、触摸放置元件、触摸点接连线与控制台错误。
// 用法：先在仓库根目录启动 python -m http.server 8766，再运行
//   node experiments/circuit-bench/tests/browser.smoke.mobile.mjs
import { spawn, spawnSync } from 'node:child_process';
const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = `http://localhost:${process.env.CB_PORT ?? 8766}/experiments/circuit-bench/`;
const PORT = 9300 + Math.floor(Math.random() * 600);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const consoleErrors = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
  `--remote-debugging-port=${PORT}`, '--window-size=390,844',
  '--user-data-dir=C:/Users/liyuan/AppData/Local/Temp/edge-cdp-mobile', 'about:blank'], { detached: true, stdio: 'ignore' });
edge.unref();
let ws;
try {
  for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(250); } }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails?.exception?.description ?? 'exc');
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result?.result?.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.bringToFront');
  // 模拟移动设备：视口 + 触摸
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.reload');
  await sleep(3500);

  check('就绪闸门', await evaluate('window.__circuitBenchReady === true'));
  check('视口尺寸', await evaluate('innerWidth === 390 && innerHeight === 844'), await evaluate('`${innerWidth}x${innerHeight}`'));
  check('移动端面板初始折叠', await evaluate('document.getElementById("library-panel").classList.contains("collapsed") && document.getElementById("inspector-panel").classList.contains("collapsed")'));
  check('折叠恢复按钮可见', await evaluate('!document.getElementById("library-reopen").hidden && !document.getElementById("inspector-reopen").hidden'));
  check('运输条在视口内', await evaluate(`(() => {
    const r = document.getElementById('flow-button').getBoundingClientRect();
    return r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844;
  })()`));
  check('顶栏在视口内', await evaluate(`(() => {
    const r = document.querySelector('.topbar').getBoundingClientRect();
    return r.left >= 0 && r.right <= 390 + 1;
  })()`));

  // 加载预设（触摸点按）
  await evaluate('document.querySelector(\'[data-preset="good-simple"]\').click()');
  await sleep(150);
  check('预设加载', await evaluate('document.querySelectorAll("#bench-svg .comp").length') === 3);

  // 触摸拖线：加一个电阻并触摸连线
  await evaluate('document.querySelector(\'.comp-item[data-type="resistor"]\').click()');
  await sleep(60);
  const tap = async (x, y) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], id: 1 });
  };
  await tap(300, 500);
  await sleep(120);
  check('触摸放置元件', await evaluate('window.__cb.controller.bench.components.length') === 4);

  // 触摸点按两接线柱连线（电阻串入回路会断路——只验证连线动作本身）
  const comps = await evaluate('window.__cb.controller.bench.components.map(c => ({ id: c.id, type: c.type }))');
  const res = comps.find(c => c.type === 'resistor');
  const bulb = comps.find(c => c.type === 'bulb');
  const termCenter = (compId, term) => evaluate(`(() => {
    const r = document.querySelector('.terminal-hit[data-comp="${compId}"][data-term="${term}"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  const wiresBefore = await evaluate('window.__cb.controller.bench.wires.length');
  const t1 = await termCenter(res.id, 'a');
  const t2 = await termCenter(bulb.id, 'a');
  await tap(t1.x, t1.y);
  await sleep(100);
  await tap(t2.x, t2.y);
  await sleep(150);
  check('触摸点接连线', await evaluate('window.__cb.controller.bench.wires.length') === wiresBefore + 1);

  // 面板展开/折叠按钮在移动端可用
  await evaluate('document.getElementById("inspector-reopen").click()');
  await sleep(80);
  const opened = await evaluate('!document.getElementById("inspector-panel").classList.contains("collapsed")');
  await evaluate('document.getElementById("inspector-close").click()');
  await sleep(80);
  check('右面板展开再折叠', opened && await evaluate('document.getElementById("inspector-panel").classList.contains("collapsed")'));
  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join('|'));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} 通过`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (err) {
  console.error('移动端冒烟测试失败:', err.message);
  process.exitCode = 1;
} finally {
  // 先通过 CDP 优雅关闭浏览器，taskkill 仅作兜底
  try { if (ws?.readyState === 1) { ws.send(JSON.stringify({ id: 9999, method: 'Browser.close' })); await sleep(600); } } catch {}
  try { ws?.close(); } catch {}
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
}
