// 简化探索版桌面浏览器冒烟测试。运行前先 npm run preview。
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = `http://localhost:${process.env.CB_PORT ?? 8766}/experiments/circuit-bench/`;
const PORT = 9000 + Math.floor(Math.random() * 700);
const PROFILE_DIR = `${process.env.CB_PROFILE_ROOT ?? 'C:/tmp'}/edge-cb-desktop-${PORT}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  };
  const mouseClick = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const mouseDrag = async (x1, y1, x2, y2) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x2, y: y2, button: 'left', buttons: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(2400);

  check('应用就绪', await evaluate('window.__circuitBenchReady === true'));
  check('元件栏包含 19 种元件', await evaluate('document.querySelectorAll(".comp-item").length') === 19);
  check('演示与资料系统已移除', await evaluate('!document.querySelector("[data-lib], #preset-list, #inspector-panel, #model-info, #trash-bin")'));
  check('窄元件栏', await evaluate('document.getElementById("library-panel").getBoundingClientRect().width <= 120'));
  check('元件栏使用图形图标', await evaluate('document.querySelectorAll(".comp-item svg").length') === 19);
  check('页面禁用长按选词', await evaluate('getComputedStyle(document.getElementById("stage")).userSelect === "none"'));

  await evaluate('document.querySelector(\'.comp-item[data-type="battery-pack"]\').click()');
  await mouseClick(780, 380);
  await sleep(120);
  check('点击台面添加元件', await evaluate('window.__cb.controller.bench.components.length') === 1);
  check('新元件不立即弹参数', await evaluate('document.getElementById("param-bar").hidden'));
  const labelStyle = await evaluate(`(() => {
    const name = document.querySelector('.component-name');
    const style = getComputedStyle(name);
    return {fill:style.fill, weight:style.fontWeight, size:parseFloat(style.fontSize)};
  })()`);
  check('实物元件名称改为纯黑常规字重',
    labelStyle.fill === 'rgb(0, 0, 0)' && Number(labelStyle.weight) === 400 && labelStyle.size >= 15,
    `${labelStyle.fill} / ${labelStyle.weight} / ${labelStyle.size}px`);
  check('每个元件只有一个名称且位于元件底部', await evaluate(`(() => {
    const component = window.__cb.controller.bench.components[0];
    const geometry = window.__cb.view.geometryOf(component);
    const labels = document.querySelectorAll('#comp-' + component.id + ' .component-name');
    return labels.length === 1 && Number(labels[0].getAttribute('y')) > geometry.h;
  })()`));
  await evaluate('document.getElementById("labels-button").click()');
  check('标签按钮可隐藏元件名称但保留参数读数', await evaluate(`
    getComputedStyle(document.querySelector('.component-name')).display === 'none' &&
    getComputedStyle(document.querySelector('.pack-volt')).display !== 'none' &&
    document.getElementById('labels-button').getAttribute('aria-pressed') === 'false'`));
  await evaluate('document.getElementById("labels-button").click()');
  check('再次点击恢复元件名称', await evaluate(`
    getComputedStyle(document.querySelector('.component-name')).display !== 'none' &&
    document.getElementById('labels-button').getAttribute('aria-pressed') === 'true'`));
  const componentWidth = await evaluate('document.querySelector("#bench-svg .comp").getBoundingClientRect().width');
  check('元件初始视觉尺寸缩小', componentWidth < 220, `${componentWidth.toFixed(1)} px`);
  const terminalHit = await evaluate('document.querySelector(".terminal-hit").getBoundingClientRect().width');
  check('接线柱命中区仍易点击', terminalHit >= 36, `${terminalHit.toFixed(1)} px`);

  await evaluate('window.__cb.controller.select("comp", window.__cb.controller.bench.components[0].id)');
  await sleep(60);
  check('再次点选才显示参数', !await evaluate('document.getElementById("param-bar").hidden'));
  check('元件参数条含红色删除', await evaluate('document.querySelector(".param-delete")?.textContent.includes("删除元件")'));
  check('参数面板位于右侧并采用紧凑纵向布局', await evaluate(`(() => {
    const bar = document.getElementById('param-bar');
    const r = bar.getBoundingClientRect();
    const style = getComputedStyle(bar);
    return r.right >= innerWidth - 20 && r.width <= 310 && style.flexDirection === 'column';
  })()`));
  const batteryFlip = await evaluate(`(() => {
    const c = window.__cb.controller;
    const component = c.bench.components[0];
    const before = {
      pos: window.__cb.view.terminalPos(component.id, 'pos').x,
      neg: window.__cb.view.terminalPos(component.id, 'neg').x
    };
    const button = document.querySelector('.param-flip');
    const precedesDelete = button?.nextElementSibling?.classList.contains('param-delete');
    button?.click();
    const after = {
      pos: window.__cb.view.terminalPos(component.id, 'pos').x,
      neg: window.__cb.view.terminalPos(component.id, 'neg').x
    };
    return {
      before, after, precedesDelete,
      label: button?.textContent,
      pressed: document.querySelector('.param-flip')?.getAttribute('aria-pressed'),
      mirrored: document.querySelector('#comp-' + component.id + ' .comp-visual')?.getAttribute('transform')
    };
  })()`);
  check('左右翻转位于删除按钮左侧', batteryFlip.precedesDelete && batteryFlip.label.includes('左右翻转'));
  check('干电池翻转后正负接线柱交换左右位置',
    batteryFlip.before.pos === batteryFlip.after.neg && batteryFlip.before.neg === batteryFlip.after.pos);
  check('翻转按钮反馈当前朝向', batteryFlip.pressed === 'true' && batteryFlip.mirrored.includes('scale(-1 1)'));
  await evaluate('document.querySelector(".param-delete").click()');
  check('红叉删除元件', await evaluate('window.__cb.controller.bench.components.length') === 0);
  const paletteDrag = await evaluate(`(() => {
    const item = document.querySelector('.comp-item[data-type="battery-pack"]');
    item.scrollIntoView({block:'center'});
    const r = item.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  await mouseDrag(paletteDrag.x, paletteDrag.y, 720, 300);
  await sleep(120);
  check('桌面端可从元件栏直接拖放到台面', await evaluate(`
    window.__cb.controller.bench.components.length === 1 &&
    window.__cb.controller.bench.components[0].type === 'battery-pack'`));
  await evaluate('window.__cb.controller.clear()');
  check('二极管和发光二极管也支持保持极性的左右翻转', await evaluate(`(() => {
    const c = window.__cb.controller;
    return ['diode', 'led'].every((type, index) => {
      const component = c.addComponent(type, 300 + index * 300, 300);
      const anode = document.querySelector('.terminal[data-comp="' + component.id + '"][data-term="an"]');
      const cathode = document.querySelector('.terminal[data-comp="' + component.id + '"][data-term="ka"]');
      const labels = [...document.querySelectorAll('#term-' + component.id + ' .term-label')];
      const polarityIsVisible = anode.classList.contains('pos') &&
        cathode.classList.contains('neg') &&
        labels.some(label => label.textContent === '+' && label.classList.contains('pos')) &&
        labels.some(label => label.textContent === '−' && label.classList.contains('neg'));
      const beforeAn = window.__cb.view.terminalPos(component.id, 'an').x;
      const beforeKa = window.__cb.view.terminalPos(component.id, 'ka').x;
      const changed = c.toggleHorizontalFlip(component.id);
      const afterAn = window.__cb.view.terminalPos(component.id, 'an').x;
      const afterKa = window.__cb.view.terminalPos(component.id, 'ka').x;
      return polarityIsVisible && changed && component.flipped &&
        beforeAn === afterKa && beforeKa === afterAn;
    });
  })()`));
  await evaluate('window.__cb.controller.clear()');

  // 接线过程中不打扰；只有实际闭合开关且电路无响应时才提示断路。
  await evaluate(`(() => {
    const c = window.__cb.controller;
    const s = c.addComponent('battery-pack', 300, 500);
    const r = c.addComponent('resistor', 850, 300);
    c.addWire({comp:s.id,term:'pos'},{comp:r.id,term:'a'});
  })()`);
  await sleep(100);
  check('初次接线不显示断路黄点', await evaluate('document.querySelectorAll(".terminal.fault-open").length === 0'));
  check('初次接线不弹断路横幅', await evaluate('document.getElementById("event-banner").hidden'));

  // 导线可点选并直接删除。
  await evaluate('window.__cb.controller.select("wire", window.__cb.controller.bench.wires[0].id)');
  check('导线选中显示删除按钮', await evaluate('document.querySelector(".param-delete")?.textContent.includes("删除导线")'));
  await evaluate('document.querySelector(".param-delete").click()');
  check('删除导线生效', await evaluate('window.__cb.controller.bench.wires.length') === 0);

  await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const s = c.addComponent('battery-pack', 260, 520);
    const sw = c.addComponent('switch', 650, 320);
    const b = c.addComponent('bulb', 980, 280);
    c.setParam(sw.id, 'closed', false, {redraw:false});
    c.addWire({comp:s.id,term:'pos'},{comp:sw.id,term:'a'});
    c.addWire({comp:sw.id,term:'b'},{comp:b.id,term:'a'});
    c.toggleSwitch(sw.id);
  })()`);
  await sleep(100);
  check('闭合开关后断路端子黄色高亮', await evaluate('document.querySelectorAll(".terminal.fault-open").length >= 2'));
  check('闭合开关后弹出断路提示', await evaluate('!document.getElementById("event-banner").hidden && document.getElementById("event-title").textContent.includes("尚未闭合")'));

  // 电表接线规则与专用故障提示。
  const meterChecks = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const s = c.addComponent('student-supply', 200, 500);
    const v = c.addComponent('voltmeter', 760, 260);
    c.addWire({comp:s.id,term:'pos'},{comp:v.id,term:'low'});
    c.addWire({comp:v.id,term:'high'},{comp:s.id,term:'neg'});
    const result = c.results.comps.get(v.id);
    return {
      connected: result.connected,
      reading: result.reading,
      terminalEvent: c.results.events.some(e => e.type === 'meter-terminal')
    };
  })()`);
  check('电压表两个正柱不产生假读数', meterChecks.connected === false && meterChecks.reading === 0);
  check('电压表错误接线给出专用提示', meterChecks.terminalEvent);

  // 同一元件的不同接线柱不能被外部导线互连；触控大命中区也不得误吸附。
  const selfWireRejected = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const v = c.addComponent('voltmeter', 700, 300);
    const wire = c.addWire({comp:v.id,term:'low'},{comp:v.id,term:'high'});
    return { rejected: wire === null, count: c.bench.wires.length, id: v.id };
  })()`);
  check('控制层拒绝同一元件接线柱自连接', selfWireRejected.rejected && selfWireRejected.count === 0);
  const selfTerminalPoints = await evaluate(`(() => {
    const id = "${selfWireRejected.id}";
    const point = term => {
      const rect = document.querySelector('.terminal[data-comp="' + id + '"][data-term="' + term + '"]').getBoundingClientRect();
      return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
    };
    return {low: point('low'), high: point('high')};
  })()`);
  await mouseClick(selfTerminalPoints.low.x, selfTerminalPoints.low.y);
  await mouseClick(selfTerminalPoints.high.x, selfTerminalPoints.high.y);
  await sleep(70);
  check('实际点按同一电表两柱不会生成导线', await evaluate('window.__cb.controller.bench.wires.length === 0'));
  check('非法自连接给出红色反馈', await evaluate('document.querySelectorAll(".terminal.invalid-connection").length >= 2'));
  await evaluate('document.body.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}))');

  // 紧贴电表底部的合法导线仍应能点选删除。
  await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const v = c.addComponent('voltmeter', 700, 300);
    const r = c.addComponent('resistor', 1080, 360);
    c.addWire({comp:v.id,term:'low'},{comp:r.id,term:'a'});
  })()`);
  const wirePoint = await evaluate(`(() => {
    const path = document.querySelector('.wire-hit');
    const point = path.getPointAtLength(Math.min(18, path.getTotalLength() / 3));
    const svgPoint = path.ownerSVGElement.createSVGPoint();
    svgPoint.x = point.x; svgPoint.y = point.y;
    const screen = svgPoint.matrixTransform(path.getScreenCTM());
    return {x: screen.x, y: screen.y};
  })()`);
  await mouseClick(wirePoint.x, wirePoint.y);
  await sleep(60);
  const wireSelection = await evaluate(`({
    selected: window.__cb.controller.selected,
    armed: document.querySelectorAll('.terminal.armed').length,
    stack: document.elementsFromPoint(${wirePoint.x}, ${wirePoint.y}).map(n => n.className?.baseVal || n.className || n.tagName).slice(0, 6)
  })`);
  check('电表底部故障导线可直接点选', wireSelection.selected?.kind === 'wire');

  // 短路整条路径红色：通过独立开关跨接电源两极，而不是对电源自身画非法自环。
  await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const s = c.addComponent('battery-pack', 400, 400);
    const sw = c.addComponent('switch', 760, 400);
    c.addWire({comp:s.id,term:'pos'},{comp:sw.id,term:'a'});
    c.addWire({comp:sw.id,term:'b'},{comp:s.id,term:'neg'});
  })()`);
  await sleep(100);
  check('短路导线与电源红色高亮', await evaluate('document.querySelector(".wire.fault-short") && document.querySelector(".comp.fault-short")'));
  check('短路横幅提示', await evaluate('document.getElementById("event-title").textContent.includes("短路")'));

  // 电铃闭合即动作。
  const bellActive = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const s = c.addComponent('battery-pack', 200, 500);
    const b = c.addComponent('bell', 850, 300);
    c.addWire({comp:s.id,term:'pos'},{comp:b.id,term:'a'});
    c.addWire({comp:b.id,term:'b'},{comp:s.id,term:'neg'});
    return c.results.comps.get(b.id).active;
  })()`);
  check('电铃通电直接动作', bellActive);

  const motorState = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const s = c.addComponent('battery-pack', 200, 500);
    const m = c.addComponent('motor', 850, 300);
    c.addWire({comp:s.id,term:'pos'},{comp:m.id,term:'a'});
    c.addWire({comp:m.id,term:'b'},{comp:s.id,term:'neg'});
    return {
      active: c.results.comps.get(m.id).active,
      fanWidth: document.querySelector('.motor-fan').getBBox().width
    };
  })()`);
  check('电动机通电直接启动', motorState.active);
  check('电动机扇叶已放大', motorState.fanWidth > 50, `${motorState.fanWidth.toFixed(1)} world units`);

  const bulbState = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const s = c.addComponent('battery-pack', 260, 520);
    const b = c.addComponent('bulb', 920, 280);
    c.setParam(b.id, 'ratedP', 5);
    c.addWire({comp:s.id,term:'pos'},{comp:b.id,term:'a'});
    c.addWire({comp:b.id,term:'b'},{comp:s.id,term:'neg'});
    return {
      brightness: c.results.comps.get(b.id).brightness,
      lit: document.querySelector('.bulb-glass').classList.contains('on')
    };
  })()`);
  check('低于额定功率时灯泡仍有清晰亮度', bulbState.lit && bulbState.brightness > 0.35, `${bulbState.brightness.toFixed(2)}`);
  await evaluate('document.getElementById("flow-button").click()');
  await sleep(80);
  check('电流箭头更密集醒目', await evaluate('document.querySelectorAll(".flow-arrow").length >= 4 && document.querySelector(".flow-arrow").getBBox().width >= 18'));
  await evaluate('document.getElementById("flow-button").click()');
  await sleep(80);
  check('电子显示为带负号的高亮圆点', await evaluate('document.querySelectorAll(".flow-electron").length >= 5 && document.querySelector(".flow-electron-minus")?.textContent === "−"'));

  const meterScale = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const a = c.addComponent('ammeter', 600, 300);
    const v = c.addComponent('voltmeter', 980, 300);
    const labels = id => [...document.querySelector('#comp-' + id).querySelectorAll('.meter-scale-label')].map(n => n.textContent);
    return {
      aTicks: document.querySelector('#comp-' + a.id).querySelectorAll('.meter-tick').length,
      vTicks: document.querySelector('#comp-' + v.id).querySelectorAll('.meter-tick').length,
      aLabels: labels(a.id),
      vLabels: labels(v.id),
      aNeedle: document.querySelector('#comp-' + a.id + ' .needle-g').getAttribute('transform'),
      vNeedle: document.querySelector('#comp-' + v.id + ' .needle-g').getAttribute('transform')
    };
  })()`);
  check('电流表双量程与30分格正确', meterScale.aTicks === 31 && ['0.2', '0.6', '1', '3'].every(v => meterScale.aLabels.includes(v)));
  check('电压表双量程与30分格正确', meterScale.vTicks === 31 && ['1', '3', '5', '15'].every(v => meterScale.vLabels.includes(v)));
  check('电表初始指针位于左侧零位', meterScale.aNeedle.includes('rotate(-60') && meterScale.vNeedle.includes('rotate(-60'));

  // PhET 式原位电路图：不重新解释拓扑，只把实物替换成标准符号。
  await evaluate('window.__cb.controller.loadPreset("good-series"); document.getElementById("view-button").click()');
  await sleep(180);
  check('电路图生成全部标准元件', await evaluate('document.querySelectorAll("#schematic-svg .sch-component").length') === 4);
  check('串联元件两侧不再显示空心或实心端点', await evaluate(`
    document.querySelectorAll('#schematic-svg .sch-port, #schematic-svg .sch-junction').length === 0`));
  await evaluate('document.getElementById("labels-button").click()');
  check('标签按钮在电路图视图同样隐藏标签', await evaluate(`
    getComputedStyle(document.querySelector('#schematic-svg .sch-label-layer')).display === 'none' &&
    document.querySelectorAll('#schematic-svg .sch-component').length === 4`));
  await evaluate('document.getElementById("labels-button").click()');
  check('电路图标签可再次恢复', await evaluate(`
    getComputedStyle(document.querySelector('#schematic-svg .sch-label-layer')).display !== 'none'`));
  check('电路图逐根保留原接线', await evaluate('document.querySelectorAll("#schematic-svg .sch-wire[data-wire]").length === window.__cb.controller.bench.wires.length'));
  check('电路图导线横平竖直', await evaluate('[...document.querySelectorAll("#schematic-svg .sch-wire")].every(p => !p.getAttribute("d").includes("C"))'));
  check('符号保持原位并只做轻量同行对齐', await evaluate(`(() => {
    const svg = document.getElementById('schematic-svg');
    return window.__cb.controller.bench.components.every(component => {
      const geometry = window.__cb.view.geometryOf(component);
      const matrix = svg.querySelector('[data-comp="' + component.id + '"]').transform.baseVal.consolidate()?.matrix;
      return Math.abs(matrix.e - (component.x + geometry.w / 2)) < .1 &&
        Math.abs(matrix.f - (component.y + geometry.h / 2)) <= 48;
    });
  })()`));
  check('近似同行导线不再出现短台阶', await evaluate(`[...document.querySelectorAll('#schematic-svg .sch-wire')].every(path => {
    const points = (path.getAttribute('d').match(/-?\\d+(?:\\.\\d+)?/g) || []).map(Number);
    const pairs = [];
    for (let i = 0; i < points.length; i += 2) pairs.push({x:points[i], y:points[i+1]});
    return pairs.slice(1).every((point, index) => Math.hypot(point.x-pairs[index].x, point.y-pairs[index].y) >= 30);
  })`));
  const draggableSymbol = await evaluate(`(() => {
    const component = window.__cb.controller.bench.components.find(item => item.type === 'bulb');
    const node = document.querySelector('#schematic-svg .sch-component[data-comp="' + component.id + '"]');
    const rect = node.getBoundingClientRect();
    return { id: component.id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, before: component.x };
  })()`);
  await mouseDrag(draggableSymbol.x, draggableSymbol.y, draggableSymbol.x + 64, draggableSymbol.y + 32);
  await sleep(80);
  check('电路图符号可直接拖动并同步实物', await evaluate(`window.__cb.controller.getComp("${draggableSymbol.id}").x !== ${draggableSymbol.before}`));
  const schematicBeforePan = await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")');
  await mouseDrag(1180, 700, 1250, 740);
  const schematicAfterPan = await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")');
  check('电路图支持拖拽平移', schematicAfterPan !== schematicBeforePan);
  await evaluate('document.getElementById("zoom-in").click()');
  const schematicAfterZoom = await evaluate('document.getElementById("schematic-svg").getAttribute("viewBox")');
  check('电路图支持按钮缩放', schematicAfterZoom !== schematicAfterPan);
  await evaluate('document.getElementById("zoom-reset").click()');
  await sleep(80);
  check('居中后元件完整位于标题栏下方', await evaluate(`(() => {
    const top = document.querySelector('.topbar').getBoundingClientRect().bottom;
    return [...document.querySelectorAll('#schematic-svg .sch-component')].every(node => node.getBoundingClientRect().top >= top + 6);
  })()`));
  check('原位符号视图说明已更新', await evaluate('document.getElementById("schematic-note").textContent.includes("原位符号")'));
  await evaluate('window.__cb.controller.loadPreset("good-parallel")');
  await sleep(120);
  check('并联三叉接触处保留黑色结点', await evaluate(`
    document.querySelectorAll('#schematic-svg .sch-junction').length === 2 &&
    [...document.querySelectorAll('#schematic-svg .sch-junction')].every(dot => getComputedStyle(dot).fill === 'rgb(26, 36, 48)')`));
  check('并联图仍不显示普通元件端点', await evaluate(`
    document.querySelectorAll('#schematic-svg .sch-port').length === 0`));
  check('控制台无异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  // Rheostat guidance belongs to the separate event banner, while the compact
  // parameter row always reserves its output slot for an actual resistance.
  await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const rheostat = c.addComponent('rheostat', 650, 320);
    const left = c.addComponent('resistor', 250, 500);
    const right = c.addComponent('resistor', 1050, 500);
    c.setParam(rheostat.id, 'max', 80, {redraw:false});
    c.setParam(rheostat.id, 'x', 0.25, {redraw:false});
    c.addWire({comp:rheostat.id,term:'a'},{comp:left.id,term:'a'});
    c.addWire({comp:rheostat.id,term:'b'},{comp:right.id,term:'a'});
  })()`);
  await sleep(80);
  check('无需选中变阻器也会自动提示错误接法', await evaluate(`
    !document.getElementById('event-banner').hidden &&
    document.getElementById('event-title').textContent.includes('滑动变阻器接线不正确') &&
    window.__cb.controller.selected === null`));
  await evaluate(`(() => {
    const c = window.__cb.controller;
    c.select('comp', c.bench.components.find(item => item.type === 'rheostat').id);
  })()`);
  check('错误提示不再挤占真实电阻位置', await evaluate(`
    document.querySelector('.param-row[data-param="x"] output').textContent.includes('—') &&
    !document.getElementById('param-bar').textContent.includes('请按一上一下接线')`));
  await evaluate(`(() => {
    const c = window.__cb.controller;
    const rheostat = c.bench.components.find(item => item.type === 'rheostat');
    const right = c.bench.components.filter(item => item.type === 'resistor')[1];
    const lowerRightWire = c.bench.wires.find(wire =>
      (wire.a.comp === rheostat.id && wire.a.term === 'b') ||
      (wire.b.comp === rheostat.id && wire.b.term === 'b'));
    c.removeWire(lowerRightWire.id);
    c.addWire({comp:rheostat.id,term:'c'},{comp:right.id,term:'b'});
  })()`);
  await sleep(80);
  check('接左下柱时显示实际有效电阻', await evaluate(`
    document.querySelector('.param-row[data-param="x"] output').textContent.trim() === '20 Ω'`));
  check('新增交互无控制台异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  const reversedDiode = await evaluate(`(() => {
    const c = window.__cb.controller; c.clear();
    const source = c.addComponent('student-supply', 220, 500);
    const diode = c.addComponent('diode', 700, 300);
    const load = c.addComponent('resistor', 1050, 500);
    c.addWire({comp:source.id,term:'pos'},{comp:diode.id,term:'ka'});
    c.addWire({comp:diode.id,term:'an'},{comp:load.id,term:'a'});
    c.addWire({comp:load.id,term:'b'},{comp:source.id,term:'neg'});
    return diode.id;
  })()`);
  await sleep(80);
  check('二极管反接自动说明单向导电性', await evaluate(`
    window.__cb.controller.results.events.some(event => event.type === 'diode-reversed' && event.id === '${reversedDiode}') &&
    document.getElementById('event-detail').textContent.includes('单向导电性') &&
    document.getElementById('event-detail').textContent.includes('点击元件可左右翻转')`));
  check('新增半导体诊断无控制台异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} 通过`);
  process.exitCode = passed === results.length ? 0 : 1;
} catch (error) {
  console.error('桌面冒烟测试失败:', error.message);
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
