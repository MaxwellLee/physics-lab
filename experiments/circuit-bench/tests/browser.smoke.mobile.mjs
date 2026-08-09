// 简化探索版手机冒烟测试：390×844 竖屏闸门 + 844×390 横屏触控。
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = `http://localhost:${process.env.CB_PORT ?? 8766}/experiments/circuit-bench/`;
const PORT = 9300 + Math.floor(Math.random() * 600);
const PROFILE_DIR = `${process.env.CB_PROFILE_ROOT ?? 'C:/tmp'}/edge-cb-mobile-${PORT}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
  `--remote-debugging-port=${PORT}`, '--window-size=390,844',
  `--user-data-dir=${PROFILE_DIR}`,
  'about:blank'
], { detached: true, stdio: 'ignore' });
edge.unref();

let ws;
try {
  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(200); }
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      errors.push(details?.exception?.description ?? details?.text ?? 'exception');
    }
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const callId = ++id;
    pending.set(callId, resolve);
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return response.result?.result?.value;
  };
  const metrics = (width, height) => send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 3, mobile: true
  });
  const tap = async (x, y) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const touchDrag = async (x1, y1, x2, y2) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 8 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x1 + x2) / 2, y: (y1 + y2) / 2, id: 8 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x2, y: y2, id: 8 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await metrics(390, 844);
  await send('Page.reload');
  await sleep(2400);
  check('应用就绪', await evaluate('window.__circuitBenchReady === true'));
  check('竖屏显示旋转提示', await evaluate('!document.getElementById("orientation-gate").hidden'));

  await metrics(844, 390);
  await sleep(650);
  check('横屏进入实验台', await evaluate('document.getElementById("orientation-gate").hidden'));
  if (!await evaluate('document.getElementById("mobile-tutorial").hidden')) {
    await evaluate('document.getElementById("tutorial-ok").click()');
  }
  check('元件栏默认展开', await evaluate('!document.getElementById("library-panel").classList.contains("collapsed")'));
  check('手机元件栏宽度不超过 100px', await evaluate('document.getElementById("library-panel").getBoundingClientRect().width <= 100'));
  check('手机底部直接显示标签按钮', await evaluate(`(() => {
    const button = document.getElementById('labels-button');
    const r = button.getBoundingClientRect();
    return r.width >= 70 && r.height >= 46 && button.getAttribute('aria-pressed') === 'true';
  })()`));
  check('手机底部直接显示全屏按钮且位于更多左侧', await evaluate(`(() => {
    const fullscreen = document.getElementById('fullscreen-button');
    const more = document.getElementById('more-button');
    const r = fullscreen.getBoundingClientRect();
    return r.width >= 70 && r.height >= 46 && fullscreen.nextElementSibling === more;
  })()`));
  check('首次进入高亮提示打开全屏', await evaluate(`(() => {
    const fullscreen = document.getElementById('fullscreen-button');
    const coach = document.getElementById('fullscreen-coach');
    return fullscreen.classList.contains('coach-highlight') && !coach.hidden;
  })()`));
  await evaluate('document.getElementById("fullscreen-coach-dismiss").click()');
  check('全屏提示可关闭且不持续干扰', await evaluate(`
    document.getElementById('fullscreen-coach').hidden &&
    !document.getElementById('fullscreen-button').classList.contains('coach-highlight')`));
  check('元件栏避开左侧刘海安全区', await evaluate('document.getElementById("library-panel").getBoundingClientRect().left >= 20'));
  check('元件栏一屏至少完整显示四个元件', await evaluate(`(() => {
    const viewport = document.getElementById('library-scroll').getBoundingClientRect();
    return [...document.querySelectorAll('.comp-item')].filter(item => {
      const r = item.getBoundingClientRect();
      return r.top >= viewport.top && r.bottom <= viewport.bottom;
    }).length >= 4;
  })()`));
  check('图标元件共 19 种', await evaluate('document.querySelectorAll(".comp-item svg").length') === 19);
  check('演示和资料入口不存在', await evaluate('!document.querySelector("[data-lib], #preset-list, #inspector-panel, #inspector-reopen")'));
  check('禁止长按选词', await evaluate('getComputedStyle(document.getElementById("stage")).userSelect === "none"'));

  // 点图标、点台面放置；新元件不弹参数。
  await evaluate('document.querySelector(\'.comp-item[data-type="resistor"]\').click(); document.getElementById("library-close").click()');
  await tap(500, 180);
  await sleep(140);
  check('触摸快速添加元件', await evaluate('window.__cb.controller.bench.components.length') === 1);
  check('放置后参数条保持隐藏', await evaluate('document.getElementById("param-bar").hidden'));
  await evaluate('document.getElementById("labels-button").click()');
  check('手机标签按钮可隐藏名称', await evaluate(`
    getComputedStyle(document.querySelector('.component-name')).display === 'none' &&
    document.getElementById('labels-button').getAttribute('aria-pressed') === 'false'`));
  await evaluate('document.getElementById("labels-button").click()');
  check('手机元件名称唯一且位于图形下方', await evaluate(`(() => {
    const component = window.__cb.controller.bench.components[0];
    const geometry = window.__cb.view.geometryOf(component);
    const names = document.querySelectorAll('#comp-' + component.id + ' .component-name');
    return names.length === 1 && Number(names[0].getAttribute('y')) > geometry.h;
  })()`));
  const compRect = await evaluate(`(() => {
    const r = document.querySelector('#bench-svg .comp').getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height};
  })()`);
  check('手机元件尺寸小巧', compRect.w < 120, `${compRect.w.toFixed(1)} px`);
  const hitSize = await evaluate('document.querySelector(".terminal-hit").getBoundingClientRect().width');
  check('接线柱命中区随小元件自适应收窄', hitSize >= 18 && hitSize <= 38, `${hitSize.toFixed(1)} px`);
  await tap(compRect.x + compRect.w / 2, compRect.y + compRect.h / 2);
  await sleep(80);
  check('再次点元件显示参数与红叉', await evaluate('!document.getElementById("param-bar").hidden && document.querySelector(".param-delete")'));
  check('手机参数面板固定在右侧且不过度遮挡台面', await evaluate(`(() => {
    const bar = document.getElementById('param-bar');
    const r = bar.getBoundingClientRect();
    return r.right >= innerWidth - 14 && r.width <= 225 && r.height < innerHeight - 115;
  })()`));
  await evaluate('document.querySelector(".param-delete").click()');
  check('红叉删除元件', await evaluate('window.__cb.controller.bench.components.length') === 0);

  // 手机端从元件栏横向拖出即放置，不再依赖“点选—再点台面”。
  await evaluate('document.getElementById("library-reopen").click()');
  await sleep(380);
  const mobileDragSource = await evaluate(`(() => {
    const item = document.querySelector('.comp-item[data-type="diode"]');
    item.scrollIntoView({block:'center'});
    const r = item.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  await touchDrag(mobileDragSource.x, mobileDragSource.y, 430, 170);
  await sleep(160);
  const mobileDragResult = await evaluate(`({
    count: window.__cb.controller.bench.components.length,
    type: window.__cb.controller.bench.components[0]?.type
  })`);
  check('手机端可从元件栏直接拖放二极管',
    mobileDragResult.count === 1 && mobileDragResult.type === 'diode', JSON.stringify(mobileDragResult));
  if (mobileDragResult.count !== 1) throw new Error(`触摸拖放诊断：${JSON.stringify(mobileDragResult)}`);
  const diodeTap = await evaluate(`(() => {
    const component = document.querySelector('#bench-svg .comp-diode');
    const r = component.querySelector('.comp-hit').getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  await tap(diodeTap.x, diodeTap.y);
  await sleep(80);
  check('点击二极管本体弹出参数而不会误连导线', await evaluate(`
    window.__cb.controller.selected?.kind === 'comp' &&
    window.__cb.controller.getComp(window.__cb.controller.selected.id)?.type === 'diode' &&
    window.__cb.controller.bench.wires.length === 0 &&
    !document.getElementById('param-bar').hidden`));
  await evaluate('window.__cb.controller.clear(); document.getElementById("library-close").click()');

  // 真实触摸点接两根导线，随后点导线删除。
  const pair = await evaluate(`(() => {
    const c = window.__cb.controller;
    const s = c.addComponent('battery-pack', 300, 360);
    const b = c.addComponent('bulb', 950, 260);
    window.__cb.view.resetView({L:110,T:58,R:832,B:315});
    return {s:s.id,b:b.id};
  })()`);
  await evaluate(`window.__cb.controller.select("comp", "${pair.s}")`);
  await sleep(60);
  check('手机端显示左右翻转按钮', await evaluate(`(() => {
    const button = document.querySelector('.param-flip');
    return button?.textContent.includes('左右翻转') && button.getBoundingClientRect().height >= 42;
  })()`));
  check('手机端二极管极性颜色清晰', await evaluate(`(() => {
    const c = window.__cb.controller;
    const led = c.addComponent('led', 700, 420);
    const anode = document.querySelector('.terminal[data-comp="' + led.id + '"][data-term="an"]');
    const cathode = document.querySelector('.terminal[data-comp="' + led.id + '"][data-term="ka"]');
    return anode?.classList.contains('pos') && cathode?.classList.contains('neg');
  })()`));
  await evaluate('document.querySelector(".param-flip").click(); window.__cb.controller.select(null)');
  const center = (comp, term) => evaluate(`(() => {
    const r = document.querySelector('.terminal[data-comp="${comp}"][data-term="${term}"]').getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  const terminalPairs = [[await center(pair.s, 'pos'), await center(pair.b, 'a')], [await center(pair.b, 'b'), await center(pair.s, 'neg')]];
  for (const [a, b] of terminalPairs) {
    await tap(a.x, a.y);
    await sleep(70);
    await tap(b.x, b.y);
    await sleep(100);
  }
  const wireCount = await evaluate('window.__cb.controller.bench.wires.length');
  check('触摸点接完成闭合回路', wireCount === 2,
    `${wireCount} wires · ${terminalPairs.flat().map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(' / ')}`);
  const wirePoint = await evaluate(`(() => {
    const path = document.querySelector('.wire-hit');
    const p = path.getPointAtLength(path.getTotalLength()/2);
    const q = document.getElementById('bench-svg').createSVGPoint();
    q.x=p.x; q.y=p.y;
    const s=q.matrixTransform(document.getElementById('bench-svg').getScreenCTM());
    return {x:s.x,y:s.y};
  })()`);
  await tap(wirePoint.x, wirePoint.y);
  await sleep(70);
  check('触摸导线显示删除', await evaluate('window.__cb.controller.selected?.kind === "wire" && document.querySelector(".param-delete")?.textContent.includes("删除导线")'));
  await evaluate('document.querySelector(".param-delete").click()');
  check('红叉删除导线', await evaluate('window.__cb.controller.bench.wires.length') === 1);

  await evaluate('window.__cb.bellSound.setActive(true)');
  await tap(740, 120);
  await sleep(240);
  check('手机手势可解锁并触发电铃音频', await evaluate(`
    window.__cb.bellSound.ctx?.state === 'running' && window.__cb.bellSound.strikeCount > 0`));
  await evaluate('window.__cb.bellSound.setActive(false)');

  const viewBefore = await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 360, y: 170, id: 1 }, { x: 470, y: 170, id: 2 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 320, y: 170, id: 1 }, { x: 510, y: 170, id: 2 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  check('双指缩放可用', await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")') !== viewBefore);

  await evaluate('document.getElementById("view-button").click()');
  await sleep(180);
  const schematicBeforePan = await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 760, y: 110, id: 3 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 700, y: 135, id: 3 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(80);
  check('手机电路图可单指平移', await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")') !== schematicBeforePan);
  const schematicBeforePinch = await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 380, y: 180, id: 4 }, { x: 500, y: 180, id: 5 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 340, y: 180, id: 4 }, { x: 540, y: 180, id: 5 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(80);
  check('手机电路图可双指缩放', await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")') !== schematicBeforePinch);

  await evaluate('document.getElementById("more-button").click()');
  check('更多菜单可展开', await evaluate('document.getElementById("more-controls").classList.contains("open")'));
  check('全屏按钮不再折叠进更多菜单', await evaluate(`
    !document.getElementById('more-controls').contains(document.getElementById('fullscreen-button')) &&
    document.getElementById('more-controls').querySelectorAll('button').length === 4`));
  check('控制台无异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  await evaluate('document.getElementById("view-button").click()');
  await sleep(100);
  const reversedMeter = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const source = c.addComponent('student-supply', 180, 480);
    const meter = c.addComponent('ammeter', 680, 220);
    const load = c.addComponent('resistor', 1080, 480);
    window.__cb.view.resetView({L:110,T:58,R:832,B:315});
    return {source:source.id,meter:meter.id,load:load.id};
  })()`);
  const reversedTrace = [];
  for (const [fromComp, fromTerm, toComp, toTerm] of [
    [reversedMeter.source, 'pos', reversedMeter.meter, 'minus'],
    [reversedMeter.meter, 'low', reversedMeter.load, 'a'],
    [reversedMeter.load, 'b', reversedMeter.source, 'neg']
  ]) {
    const a = await center(fromComp, fromTerm);
    const b = await center(toComp, toTerm);
    await tap(a.x, a.y); await sleep(45); await tap(b.x, b.y); await sleep(70);
    reversedTrace.push({ fromTerm, toTerm, a, b, state: await evaluate(`window.__cb.controller.bench.wires.map(wire => ({a:wire.a,b:wire.b}))`) });
  }
  const reversedState = await evaluate(`(() => ({
    wires: window.__cb.controller.bench.wires.map(wire => [wire.a.term, wire.b.term]),
    events: window.__cb.controller.results.events.map(event => event.type),
    reading: window.__cb.controller.results.comps.get('${reversedMeter.meter}')?.reading,
    banner: document.getElementById('event-title').textContent
  }))()`);
  const reversedOk = reversedState.events.includes('meter-reversed') && !!reversedState.banner;
  check('手机端电流表反接自动报错', reversedOk,
    reversedOk ? '' : JSON.stringify({...reversedState, trace: reversedTrace}));

  const parallelVoltage = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const source = c.addComponent('student-supply', 180, 480);
    const load = c.addComponent('resistor', 720, 400);
    const meter = c.addComponent('voltmeter', 1050, 180);
    window.__cb.view.resetView({L:110,T:58,R:832,B:315});
    return {source:source.id,meter:meter.id,load:load.id};
  })()`);
  for (const [fromComp, fromTerm, toComp, toTerm] of [
    [parallelVoltage.source, 'pos', parallelVoltage.load, 'a'],
    [parallelVoltage.load, 'b', parallelVoltage.source, 'neg'],
    [parallelVoltage.meter, 'low', parallelVoltage.load, 'a'],
    [parallelVoltage.meter, 'minus', parallelVoltage.load, 'b']
  ]) {
    const a = await center(fromComp, fromTerm);
    const b = await center(toComp, toTerm);
    await tap(a.x, a.y); await sleep(45); await tap(b.x, b.y); await sleep(70);
  }
  check('手机端电压表并联不会误报电流表短路', await evaluate(`
    !window.__cb.controller.results.events.some(event => event.type === 'ammeter-parallel') &&
    window.__cb.controller.results.comps.get('${parallelVoltage.meter}').reading > 0`));

  const reversedLed = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const source = c.addComponent('student-supply', 180, 480);
    const led = c.addComponent('led', 680, 260);
    const load = c.addComponent('resistor', 1080, 480);
    window.__cb.view.resetView({L:110,T:58,R:832,B:315});
    return {source:source.id,led:led.id,load:load.id};
  })()`);
  for (const [fromComp, fromTerm, toComp, toTerm] of [
    [reversedLed.source, 'pos', reversedLed.led, 'ka'],
    [reversedLed.led, 'an', reversedLed.load, 'a'],
    [reversedLed.load, 'b', reversedLed.source, 'neg']
  ]) {
    const a = await center(fromComp, fromTerm);
    const b = await center(toComp, toTerm);
    await tap(a.x, a.y); await sleep(45); await tap(b.x, b.y); await sleep(70);
  }
  const reversedLedState = await evaluate(`(() => ({
    event: window.__cb.controller.results.events.find(event =>
      event.type === 'diode-reversed' && event.id === '${reversedLed.led}' && event.diode === 'led'),
    title: document.getElementById('event-title').textContent,
    detail: document.getElementById('event-detail').textContent,
    visible: !document.getElementById('event-banner').hidden
  }))()`);
  const reversedLedOk = !!reversedLedState.event && reversedLedState.visible &&
    reversedLedState.title.includes('发光二极管反向接入') &&
    reversedLedState.detail.includes('单向导电性') &&
    reversedLedState.detail.includes('点击元件可左右翻转');
  check('手机端发光二极管反接自动提示并给出翻转方法', reversedLedOk,
    reversedLedOk ? '' : JSON.stringify(reversedLedState));
  check('新增手机诊断无控制台异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} 通过`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (error) {
  console.error('手机冒烟测试失败:', error.message);
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
