// 电学实验台浏览器冒烟测试（桌面端 1920×1080）：无第三方依赖，
// 通过 CDP 驱动本机 Edge headless，验证就绪闸门、全部预设、三视图、
// 流向/电势、面板折叠、复位、真实鼠标放置/拖线/点按连线/键盘删除与控制台错误。
// 用法：先在仓库根目录启动 python -m http.server 8766，再运行
//   node experiments/circuit-bench/tests/browser.smoke.mjs
// 可用环境变量 EDGE_PATH 指定浏览器路径，CB_PORT 指定页面端口（默认 8766）。
import { spawn, spawnSync } from 'node:child_process';

const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = `http://localhost:${process.env.CB_PORT ?? 8766}/experiments/circuit-bench/`;
const PORT = 9300 + Math.floor(Math.random() * 600);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const consoleErrors = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. 启动 Edge
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
  `--remote-debugging-port=${PORT}`, '--window-size=1920,1080',
  '--user-data-dir=C:/Users/liyuan/AppData/Local/Temp/edge-cdp-profile',
  'about:blank'
], { detached: true, stdio: 'ignore' });
edge.unref();

let ws;
try {
  // 2. 等待调试端口
  let version = null;
  for (let i = 0; i < 40; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!version) throw new Error('Edge 调试端口未就绪');

  // 3. 新建标签页
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PAGE)}`, { method: 'PUT' })).json();

  // 4. CDP 连接
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? 'unknown');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args?.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text ?? '';
      if (!/favicon/.test(t)) consoleErrors.push(t);
    }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('页面内执行出错: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await sleep(3500); // 等待加载与就绪闸门

  // 5. 基础检查
  check('就绪闸门 __circuitBenchReady', await evaluate('window.__circuitBenchReady === true'));
  check('加载层已移除', await evaluate('!document.getElementById("loading")'));
  check('元件箱条目数 = 19', await evaluate('document.querySelectorAll(".comp-item").length') === 19,
    String(await evaluate('document.querySelectorAll(".comp-item").length')));
  check('演示电路条目数 = 15', await evaluate('document.querySelectorAll(".preset-item").length') === 15,
    String(await evaluate('document.querySelectorAll(".preset-item").length')));

  // 6. 逐个加载预设，检查元件/导线/求解
  const presets = await evaluate('Array.from(document.querySelectorAll(".preset-item")).map(b => b.dataset.preset)');
  for (const p of presets) {
    await evaluate(`document.querySelector('[data-preset="${p}"]').click()`);
    await sleep(120);
    const st = await evaluate(`(() => {
      const comps = document.querySelectorAll('#bench-svg .comp').length;
      const wires = document.querySelectorAll('#bench-svg .wire').length;
      const banner = !document.getElementById('event-banner').hidden;
      return { comps, wires, banner };
    })()`);
    check(`预设 ${p}`, st.comps > 0 && st.wires > 0, `元件${st.comps} 导线${st.wires}${st.banner ? ' 有事件横幅' : ''}`);
  }

  // 6b. 三接线柱电表（人教版）：伏安法预设中的电流表/电压表都应有 3 个接线柱
  await evaluate('document.querySelector(\'[data-preset="good-volt-amp"]\').click()');
  await sleep(150);
  const meterTerms = await evaluate(`(() => {
    const comps = window.__cb.controller.bench.components.filter(c => c.type === 'ammeter' || c.type === 'voltmeter');
    return comps.map(c => document.querySelectorAll('.terminal-hit[data-comp="' + c.id + '"]').length);
  })()`);
  check('电表为三接线柱结构', meterTerms.length === 2 && meterTerms.every(n => n === 3), JSON.stringify(meterTerms));
  const ammeterRange = await evaluate(`(() => {
    const c = window.__cb.controller.bench.components.find(c => c.type === 'ammeter');
    const r = window.__cb.controller.results.comps.get(c.id);
    return r?.rangeLabel ?? null;
  })()`);
  check('电流表量程由接线柱决定（0–0.6 A）', ammeterRange === '0–0.6 A', String(ammeterRange));

  // 7. 视图切换：实物台 ⇄ 电路图（先加载串联演示）
  await evaluate('document.querySelector(\'[data-preset="good-series"]\').click()');
  await sleep(120);
  await evaluate('document.getElementById("view-button").click()');
  await sleep(200);
  check('电路图视图生成符号', await evaluate('getComputedStyle(document.getElementById("schematic-svg")).display !== "none" && getComputedStyle(document.getElementById("bench-svg")).display === "none" && document.querySelectorAll("#schematic-svg .sch-sym, #schematic-svg .sch-fill").length > 0'));
  await evaluate('document.getElementById("view-button").click()');
  await sleep(120);
  check('返回实物台视图', await evaluate('getComputedStyle(document.getElementById("bench-svg")).display !== "none" && getComputedStyle(document.getElementById("schematic-svg")).display === "none"'));

  // 8. 流向演示（三态循环：关 → 电流 → 电子 → 关）
  await evaluate('document.getElementById("flow-button").click()');
  await sleep(250);
  check('电流模式生成流动箭头', await evaluate('document.querySelectorAll("#bench-svg .flow-arrow").length > 0'));
  await evaluate('document.getElementById("flow-button").click()');
  await sleep(250);
  check('电子模式生成电子点', await evaluate('document.querySelectorAll("#bench-svg .flow-dot").length > 0 && document.querySelectorAll("#bench-svg .flow-arrow").length === 0'));
  await evaluate('document.getElementById("flow-button").click()');
  await sleep(120);
  check('流向关闭后清空', await evaluate('document.querySelectorAll("#bench-svg .flow-layer > *").length === 0'));

  // 9. 缩放与平移
  const vb0 = await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")');
  await evaluate('document.getElementById("zoom-in").click()');
  await sleep(80);
  const vb1 = await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")');
  check('放大按钮缩小视野宽度', parseFloat(vb1.split(' ')[2]) < parseFloat(vb0.split(' ')[2]), `${vb0} → ${vb1}`);
  await evaluate('document.getElementById("zoom-reset").click()');
  await sleep(80);
  check('重置视图恢复初始视野', await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")') === vb0);

  // 10. 面板折叠/展开
  await evaluate('document.getElementById("library-close").click()');
  await sleep(80);
  const collapsed = await evaluate('document.getElementById("library-panel").classList.contains("collapsed") && !document.getElementById("library-reopen").hidden');
  await evaluate('document.getElementById("library-reopen").click()');
  await sleep(80);
  check('左面板折叠与恢复', collapsed && await evaluate('!document.getElementById("library-panel").classList.contains("collapsed")'));

  // 11. 复位（两段确认）
  await evaluate('document.getElementById("reset-button").click()');
  await evaluate('document.getElementById("reset-button").click()');
  await sleep(150);
  check('复位清空台面', await evaluate('document.querySelectorAll("#bench-svg .comp").length === 0'));

  // 12. 短路事件横幅（加载短路演示）
  const shortPreset = presets.find(p => p.includes('short'));
  if (shortPreset) {
    await evaluate(`document.querySelector('[data-preset="${shortPreset}"]').click()`);
    await sleep(200);
    check('短路演示出现警告横幅', await evaluate('!document.getElementById("event-banner").hidden'));
  }

  // 14. 真实鼠标交互：放置元件 + 拖线 + 点按连线 + 删除
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
  const clickAt = async (x, y) => { await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); };
  const dragTo = async (x1, y1, x2, y2) => {
    await mouse('mousePressed', x1, y1);
    for (let i = 1; i <= 6; i++) await mouse('mouseMoved', x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6);
    await mouse('mouseReleased', x2, y2);
  };
  const termCenter = (compId, term) => evaluate(`(() => {
    const r = document.querySelector('.terminal-hit[data-comp="${compId}"][data-term="${term}"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);

  await evaluate('document.getElementById("reset-button").click()');
  await evaluate('document.getElementById("reset-button").click()');
  await sleep(150);

  // 放置电源与电阻
  await evaluate('document.querySelector(\'.comp-item[data-type="student-supply"]\').click()');
  await sleep(60);
  await clickAt(620, 620);
  await sleep(100);
  await evaluate('document.querySelector(\'.comp-item[data-type="resistor"]\').click()');
  await sleep(60);
  await clickAt(980, 420);
  await sleep(100);
  let compIds = await evaluate('window.__cb.controller.bench.components.map(c => ({ id: c.id, type: c.type }))');
  check('点击放置两个元件', compIds.length === 2, JSON.stringify(compIds.map(c => c.type)));
  const supply = compIds.find(c => c.type === 'student-supply');
  const resistor = compIds.find(c => c.type === 'resistor');

  // 拖线：电源+ → 电阻a
  let t1 = await termCenter(supply.id, 'pos'), t2 = await termCenter(resistor.id, 'a');
  await dragTo(t1.x, t1.y, t2.x, t2.y);
  await sleep(120);
  check('拖线吸附连线成功', await evaluate('window.__cb.controller.bench.wires.length') === 1);

  // 点按连线：电阻b → 电源−（两次快速点击）
  t1 = await termCenter(resistor.id, 'b'); t2 = await termCenter(supply.id, 'neg');
  await clickAt(t1.x, t1.y);
  await sleep(80);
  await clickAt(t2.x, t2.y);
  await sleep(120);
  check('点按两接线柱连线成功', await evaluate('window.__cb.controller.bench.wires.length') === 2);

  // 回路导通：电阻电流 ≈ 3V / 10Ω
  const ri = await evaluate(`Math.abs(window.__cb.controller.results.comps.get('${resistor.id}').I)`);
  check('自由搭建回路导通', ri > 0.1, `I = ${ri.toFixed(3)} A`);

  // 选中电阻并记录数据
  await evaluate(`window.__cb.controller.select('comp', '${resistor.id}')`);
  await sleep(100);
  await evaluate(`(() => { const s = document.getElementById('data-target'); s.value = '${resistor.id}'; s.dispatchEvent(new Event('change')); })()`);
  await evaluate('document.getElementById("data-record").click()');
  await sleep(80);
  check('数据记录写入表格', await evaluate('document.querySelectorAll("#data-tbody tr").length') === 1);
  check('I-U 图描点', await evaluate('document.querySelectorAll("#plot-svg circle").length >= 1'));

  // 参数极值：电阻最小值、电源最大电压
  await evaluate(`window.__cb.controller.setParam('${resistor.id}', 'resistance', 0)`);
  await evaluate(`window.__cb.controller.setParam('${supply.id}', 'voltage', 99)`);
  await sleep(120);
  const extreme = await evaluate(`(() => {
    const cb = window.__cb;
    const r = cb.controller.getComp('${resistor.id}');
    const s = cb.controller.getComp('${supply.id}');
    return { rMin: r.params.resistance, vMax: s.params.voltage, ok: cb.controller.results.ok, i: cb.controller.results.comps.get('${resistor.id}').I };
  })()`);
  check('参数极值被钳制且求解稳定', extreme.rMin >= 0.1 && extreme.vMax <= 15 && extreme.ok && Number.isFinite(extreme.i),
    `R=${extreme.rMin}Ω U=${extreme.vMax}V I=${extreme.i?.toFixed(2)}A`);

  // 键盘删除选中导线
  await evaluate(`window.__cb.controller.select('wire', window.__cb.controller.bench.wires[0].id)`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await sleep(120);
  check('Delete 键删除选中导线', await evaluate('window.__cb.controller.bench.wires.length') === 1);

  // 自由搭建电路 → 电路图（两态切换）
  await evaluate('document.getElementById("view-button").click()');
  await sleep(200);
  check('自由搭建可生成电路图', await evaluate('document.querySelectorAll("#schematic-svg .sch-sym, #schematic-svg .sch-fill").length >= 2'));
  await evaluate('document.getElementById("view-button").click()');
  await sleep(120);

  // 底部参数条：选中元件弹出，含滑块
  await evaluate(`window.__cb.controller.select('comp', '${resistor.id}')`);
  await sleep(120);
  check('选中元件后底部参数条弹出', await evaluate('!document.getElementById("param-bar").hidden && document.querySelectorAll("#param-bar input[type=range]").length >= 1'));
  const paramText = await evaluate('document.getElementById("param-bar").textContent');
  check('参数条含阻值标签', paramText.includes('阻值'), paramText.slice(0, 40));

  // 空白处拖动 = 平移画布
  const vbBefore = await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")');
  await dragTo(1400, 760, 1520, 810);
  await sleep(100);
  const vbAfter = await evaluate('document.getElementById("bench-svg").getAttribute("viewBox")');
  check('拖动空白处平移画布', vbBefore !== vbAfter, `${vbBefore} → ${vbAfter}`);
  await evaluate('document.getElementById("zoom-reset").click()');
  await sleep(80);

  // 拖入垃圾桶删除元件（连带导线）
  const rPos = await evaluate(`(() => { const r = document.getElementById('comp-${resistor.id}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const trashPos = await evaluate(`(() => { const r = document.getElementById('trash-bin').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await dragTo(rPos.x, rPos.y, trashPos.x, trashPos.y);
  await sleep(150);
  check('拖入垃圾桶删除元件', await evaluate('window.__cb.controller.bench.components.length') === 1
    && await evaluate('window.__cb.controller.bench.wires.length') === 0);
  check('垃圾桶已隐藏', await evaluate('!document.getElementById("trash-bin").classList.contains("show")'));

  // 15. 控制台错误
  check('浏览器控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  process.exitCode = failed.length ? 1 : 0;
} catch (err) {
  console.error('冒烟测试执行失败:', err.message);
  process.exitCode = 1;
} finally {
  // 先通过 CDP 优雅关闭浏览器（Windows 上 msedge 引导进程会退出，edge.pid 并非真实浏览器进程），
  // taskkill 仅作兜底。
  try { if (ws?.readyState === 1) { ws.send(JSON.stringify({ id: 9999, method: 'Browser.close' })); await sleep(600); } } catch {}
  try { ws?.close(); } catch {}
  spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
}
