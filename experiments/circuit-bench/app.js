// 电学实验台 · 应用装配层
// 把物理引擎、实物台渲染、接线交互、面板、运输条与流向动画层连接到一起。

import { Controller } from './src/sim/controller.js';
import { BenchView, fmtA } from './src/render/bench.js';
import { attachWiring } from './src/ui/wiring.js';
import { Panels } from './src/ui/panels.js';
import { attachTransport } from './src/ui/transport.js';
import { attachMobileExperience, isMobileLab } from './src/ui/mobile.js';
import { BellSound } from './src/ui/sound.js';
import { FlowView } from './src/render/flow.js';
import { renderSchematic } from './src/render/schematic.js';
import { DEFS, SHORT_CURRENT } from './src/physics/components.js';

const $ = id => document.getElementById(id);

function boot() {
  // —— 全局 UI 状态（运输条直接读写）——
  const ui = { flowMode: 'off', view: 'bench', labelsVisible: true };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = attachMobileExperience();

  // —— 分层实例 ——
  const controller = new Controller();
  const view = new BenchView($('bench-svg'));
  const flow = new FlowView(view.flowLayer);
  const schFlow = new FlowView(null); // 电路图每次全量重画，renderSch 时再 setLayer 指向新图层
  const schematicCamera = { fit: null, manual: null };
  const bellSound = new BellSound();
  // 浏览器要求音频在用户手势后解锁；手机端可能首次恢复失败，因此每次有效手势都可安全重试。
  const unlockBellAudio = () => bellSound.unlock();
  addEventListener('pointerdown', unlockBellAudio, { capture: true });
  addEventListener('touchend', unlockBellAudio, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) bellSound.unlock();
  });

  // —— 事件横幅：短路 / 熔断 / 超功率 / 超量程 / 求解失败 ——
  const banner = $('event-banner');
  let dismissedSig = null;
  const BANNER_ORDER = [
    'ammeter-parallel', 'short', 'meter-terminal', 'meter-reversed',
    'voltmeter-series', 'diode-reversed', 'fuse-blown', 'overpower', 'overrange',
    'open', 'unsolvable', 'nonconverged'
  ];
  const BANNER_TEXT = {
    'ammeter-parallel': () => ['电流表并联，形成短路',
      '理想电流表的内阻为 0，必须串联接入电路。现在的并联接法相当于用导线跨接在被测支路两端，电流会绕过用电器并可能损坏电源；请删除故障导线后改为串联。'],
    short: () => ['检测到短路',
      `电源被近似零电阻的通路直接连通，支路电流已超过 ${SHORT_CURRENT} A 的短路判据（读数按导线 1 mΩ 的教学模型估算）。真实电路中这会烧坏电源或导线——请检查接线，或串联用电器 / 保险丝。`],
    'fuse-blown': e => ['保险丝熔断',
      `电流 ${fmtA(e.current)} 超过了保险丝额定值，保险丝已熔断、电路断开。排除故障后，选中保险丝并「更换保险丝」。`],
    overpower: e => ['用电器功率过大',
      `「${DEFS[controller.getComp(e.id)?.type]?.label ?? '元件'}」实际功率 ${e.power.toFixed(2)} W，已明显超过额定 ${e.ratedP.toFixed(2)} W——真实情况下会烧毁。请降低电源电压或增大电阻。`],
    overrange: e => ['电表超过量程',
      `${e.meter === 'voltmeter' ? '电压表' : '电流表'}读数 ${Math.abs(e.reading).toFixed(2)} 超过所接量程 ${e.range}。请换接更大量程的接线柱，真实电表超量程可能损坏。`],
    'meter-terminal': e => [`${e.meter === 'voltmeter' ? '电压表' : '电流表'}接线柱选择错误`,
      e.minusUsed
        ? '一个电表只能同时使用公共负接线柱和一个正量程接线柱，不能把两个正量程柱同时接入。请保留“−”柱，并在两个红色量程柱中只选择一个。'
        : '电表必须使用公共“−”接线柱，并在两个红色正量程柱中只选择一个。当前接法没有接负柱，因此不产生有效读数。'],
    'meter-reversed': e => [`${e.meter === 'voltmeter' ? '电压表' : '电流表'}正负接反`,
      `当前读数为 ${e.meter === 'voltmeter' ? `${e.reading.toFixed(2)} V` : fmtA(e.reading)}，指针会反向偏转。电流应从红色正量程柱流入、从黑色“−”柱流出；请交换两根表线。`],
    'voltmeter-series': () => ['电压表被串联接入',
      '理想电压表的内阻为无穷大，串联后相当于把电路断开，所以用电器不会工作。电压表应并联在被测用电器两端，并使用“−”柱和一个正量程柱。'],
    'diode-reversed': e => [e.diode === 'led' ? '发光二极管反向接入' : '二极管反向接入',
      `${e.diode === 'led' ? '发光二极管' : '二极管'}具有单向导电性：电流应从红色正极（阳极）流入、从黑色负极（阴极）流出。当前承受约 ${Math.abs(e.voltage).toFixed(2)} V 反向电压，元件截止，不会有正常电流${e.diode === 'led' ? '，也不会发光' : ''}；请交换两端接线。点击元件可左右翻转。`],
    open: e => ['电路尚未闭合',
      e.count > 0
        ? `闭合开关后仍没有形成完整回路；检测到 ${e.count} 个尚未接线的必要接线柱，已用黄色标出。请从黄色接线柱继续检查。`
        : '闭合开关后用电器仍无反应，说明各元件虽然都有导线，但没有组成一条连续的闭合回路。请沿电源正极到负极逐段检查连接。'],
    unsolvable: () => ['电路无法求解',
      '当前连接方式无法形成可计算的电路（例如多个电源直接对冲）。请检查电源与接线。'],
    nonconverged: () => ['求解未收敛',
      '非线性元件的迭代求解未完全收敛，读数可能不准确。请微调参数后重试。']
  };

  function updateBanner(results) {
    if (!results?.events?.length || !results.ok && !results.events?.length) {
      banner.hidden = true;
      $('status-dot').classList.remove('warn', 'caution');
      $('sim-status').textContent = 'CIRCUIT READY';
      dismissedSig = null;
      return;
    }
    const events = results.events;
    const sig = events.map(e => `${e.type}:${e.id ?? ''}`).sort().join('|');
    const top = BANNER_ORDER.map(t => events.find(e => e.type === t)).find(Boolean);
    const isShort = events.some(e => e.type === 'short' || e.type === 'ammeter-parallel');
    const isOpen = !isShort && events.some(e => e.type === 'open' || e.type === 'voltmeter-series');
    $('status-dot').classList.toggle('warn', isShort);
    $('status-dot').classList.toggle('caution', isOpen);
    $('sim-status').textContent = isShort ? 'SHORT CIRCUIT' : isOpen ? 'OPEN CIRCUIT' : 'CIRCUIT READY';
    if (!top || sig === dismissedSig) { banner.hidden = true; return; }
    const [title, detail] = BANNER_TEXT[top.type](top);
    $('event-title').textContent = title;
    $('event-detail').textContent = detail;
    banner.hidden = false;
    $('event-dismiss').onclick = () => { dismissedSig = sig; banner.hidden = true; };
  }

  // Parameter-level teaching notices reuse the existing non-modal fault banner.
  // This keeps long guidance out of the compact parameter bar.
  addEventListener('circuit:notice', event => {
    const notice = event.detail;
    if (!notice?.title || !notice?.message) return;
    $('event-title').textContent = notice.title;
    $('event-detail').textContent = notice.message;
    banner.hidden = false;
    $('event-dismiss').onclick = () => {
      dismissedSig = notice.key ?? null;
      banner.hidden = true;
    };
  });

  let lastRheostatWarningSig = null;
  function checkRheostatWiring(bench) {
    const invalid = [];
    const isConnected = (componentId, terminal) => bench.wires.some(wire =>
      (wire.a.comp === componentId && wire.a.term === terminal) ||
      (wire.b.comp === componentId && wire.b.term === terminal));
    for (const comp of bench.components.filter(item => item.type === 'rheostat')) {
      const connected = ['a', 'b', 'c', 'd'].map(terminal => isConnected(comp.id, terminal));
      const connectionCount = connected.filter(Boolean).length;
      if (connectionCount < 2) continue;
      const lowerCount = Number(connected[0]) + Number(connected[1]);
      const upperCount = Number(connected[2]) + Number(connected[3]);
      if (lowerCount !== 1 || upperCount !== 1) {
        invalid.push(`${comp.id}:${connected.map(Number).join('')}`);
      }
    }
    if (!invalid.length) {
      lastRheostatWarningSig = null;
      return;
    }
    const signature = invalid.sort().join('|');
    if (signature === lastRheostatWarningSig) return;
    lastRheostatWarningSig = signature;
    queueMicrotask(() => window.dispatchEvent(new CustomEvent('circuit:notice', {
      detail: {
        key: `rheostat-wiring:${signature}`,
        title: '滑动变阻器接线不正确',
        message: '请采用“一上一下”接法：滑片端接一个上接线柱，电阻丝接一个下接线柱。接左下柱时，滑片越靠左阻值越小；接右下柱时，滑片越靠右阻值越小。'
      }
    })));
  }

  // —— 视图切换（实物台 ⇄ 电路图） ——
  // 注意：SVG 元素没有 .hidden 反射属性，必须用 toggleAttribute 才能真正隐藏
  // 计算未被顶栏/面板/运输条遮挡的可视区域（CSS 像素），供电路图取景使用
  function stageViewport() {
    const W = innerWidth, H = innerHeight;
    const topbar = document.querySelector('.topbar')?.getBoundingClientRect();
    const transport = document.querySelector('.transport')?.getBoundingClientRect();
    const lp = $('library-panel');
    const inspector = $('inspector-panel');
    const leftPanelVisible = !lp.hidden && !lp.classList.contains('collapsed');
    const rightPanelVisible = inspector && !inspector.hidden && !inspector.classList.contains('collapsed');
    const L = leftPanelVisible ? lp.getBoundingClientRect().right + 14 : 12;
    const R = rightPanelVisible ? inspector.getBoundingClientRect().left - 14 : W - 12;
    const T = Math.max(12, (topbar?.bottom ?? (isMobileLab() ? 56 : 76)) + 18);
    const B = Math.min(H - 12, (transport?.top ?? (H - (isMobileLab() ? 68 : 100))) - 18);
    return { L, T, R: Math.max(R, L + 240), B: Math.max(B, T + 180) };
  }
  // 电路图重渲染 + 流向层重建（符号每次全量重画，流向层指向新图层）
  const readSchematicBox = () => {
    const values = ($('schematic-svg').getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number);
    return values.length === 4 && values.every(Number.isFinite)
      ? { x: values[0], y: values[1], w: values[2], h: values[3] }
      : null;
  };
  const writeSchematicBox = box => {
    if (!box) return;
    $('schematic-svg').setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
  };
  function renderSch({ refit = false } = {}) {
    const manual = refit ? null : schematicCamera.manual;
    const { flowLinks, flowLayer } = renderSchematic($('schematic-svg'), controller.bench, view, stageViewport(), controller.results);
    schematicCamera.fit = readSchematicBox();
    if (manual) writeSchematicBox(manual);
    if (refit) schematicCamera.manual = null;
    schFlow.setLayer(flowLayer);
    schFlow.buildFromLinks(ui.flowMode, flowLinks);
  }
  function panSchematic(dx, dy) {
    const svg = $('schematic-svg');
    const rect = svg.getBoundingClientRect();
    const box = readSchematicBox();
    if (!box || !rect.width || !rect.height) return;
    box.x -= dx * box.w / rect.width;
    box.y -= dy * box.h / rect.height;
    schematicCamera.manual = box;
    writeSchematicBox(box);
  }
  function zoomSchematic(factor, clientX, clientY) {
    const svg = $('schematic-svg');
    const rect = svg.getBoundingClientRect();
    const box = readSchematicBox();
    if (!box || !rect.width || !rect.height) return;
    const fx = ((clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width;
    const fy = ((clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height;
    const anchorX = box.x + fx * box.w;
    const anchorY = box.y + fy * box.h;
    const nextW = Math.min(5200, Math.max(260, box.w * factor));
    const nextH = Math.min(3300, Math.max(180, box.h * factor));
    const next = { x: anchorX - fx * nextW, y: anchorY - fy * nextH, w: nextW, h: nextH };
    schematicCamera.manual = next;
    writeSchematicBox(next);
  }
  function applyView() {
    const v = ui.view;
    if (v === 'schematic' && controller.selected) controller.select(null);
    $('bench-svg').toggleAttribute('hidden', v !== 'bench');
    $('schematic-svg').toggleAttribute('hidden', v !== 'schematic');
    $('schematic-note').hidden = v !== 'schematic';
    $('view-status').textContent = { bench: '实物台', schematic: '电路图' }[v];
    if (v === 'schematic') renderSch();
    else flow.rebuild(ui.flowMode, controller.results, view, controller.bench); // 切回实物台时恢复流向动画
  }

  // —— 控制层事件 → 渲染层 ——
  controller.subscribe((type, ctrl, payload) => {
    if (type === 'topology' || type === 'preset') {
      schematicCamera.manual = null;
      view.setBench(ctrl.bench);
      view.setSelected(ctrl.selected?.kind, ctrl.selected?.id);
      // 手机横屏较矮，切换演示时重新框住全电路，避免元件落在视口外。
      if (type === 'preset' && isMobileLab()) view.resetView(stageViewport());
      checkRheostatWiring(ctrl.bench);
    }
    if (type === 'param-structure') {
      const comp = ctrl.getComp(payload?.id);
      if (comp) view.redrawComponent(comp);
    }
    if (type === 'select') {
      view.setSelected(ctrl.selected?.kind, ctrl.selected?.id);
    }
    if (type === 'solved') {
      view.updateDynamic(ctrl.results, ctrl.bench);
      const hasOpenSwitch = ctrl.bench.components.some(c => c.type === 'switch' && !c.params.closed);
      const shouldDiagnoseOpen = ctrl.circuitAttempted && !hasOpenSwitch;
      const faults = view.updateFaults(ctrl.results, ctrl.bench, { showOpen: shouldDiagnoseOpen });
      const hasSource = ctrl.bench.components.some(c => DEFS[c.type]?.kind === 'source');
      const hasLoad = ctrl.bench.components.some(c =>
        ['load', 'resistor', 'semiconductor', 'protection'].includes(DEFS[c.type]?.kind));
      const hasResponse = ctrl.bench.components.some(c => {
        const result = ctrl.results?.comps.get(c.id);
        if (!result) return false;
        if (DEFS[c.type]?.kind === 'source') return Math.abs(result.I ?? 0) > 1e-5;
        return !!result.active || !!result.lit || (result.brightness ?? 0) > 0.03;
      });
      const showOpen = shouldDiagnoseOpen && hasSource && hasLoad && !hasResponse;
      updateBanner(showOpen
        ? { ...ctrl.results, events: [...(ctrl.results?.events ?? []), { type: 'open', count: faults.openTerms.length, ids: faults.openTerms }] }
        : ctrl.results);
      flow.rebuild(ui.flowMode, ctrl.results, view, ctrl.bench);
      if (ui.view === 'schematic') renderSch();
      // 任一电铃达到工作电流即打响
      const bellOn = ctrl.bench.components.some(c =>
        c.type === 'bell' && ctrl.results?.comps.get(c.id)?.active);
      bellSound.setActive(bellOn);
    }
  });

  // —— 接线交互 ——
  const defaultHint = $('hint-bar').textContent;
  let invalidWireHintTimer = null;
  attachWiring($('bench-svg'), view, controller, {
    getPlacementType: () => panels.placementType,
    clearPlacement: () => panels.clearPlacement(),
    onInvalidWire(message) {
      const hint = $('hint-bar');
      clearTimeout(invalidWireHintTimer);
      hint.textContent = `⛔ ${message}`;
      invalidWireHintTimer = setTimeout(() => { hint.textContent = defaultHint; }, 1800);
    }
  });

  // —— 左右面板 ——
  const panels = new Panels(controller, {
    onPlacementArmed(type) {
      $('hint-bar').textContent = type
        ? `点击台面空白处放置：${DEFS[type].label}（Esc 取消）`
        : defaultHint;
    },
    // 元件箱拖拽放置：落点在台面内时以指针为中心放置元件
    onDropPlace(type, x, y) {
      if (ui.view !== 'bench') return;
      const p = view.toBench(x, y);
      const geo = view.geometryOf({ type });
      const snapG = v => Math.round(v / 20) * 20;
      const comp = controller.addComponent(type, snapG(p.x - geo.w / 2), snapG(p.y - geo.h / 2));
      if (comp) controller.select(null);
    },
    // 面板折叠/展开会改变可视区，电路图需要重新取景（等折叠动画结束后再算）
    onLayoutChange() {
      if (ui.view !== 'schematic') return;
      setTimeout(renderSch, 340);
    }
  });

  // 窗口尺寸变化时电路图重新取景
  addEventListener('resize', () => {
    if (ui.view === 'schematic') renderSch();
  });

  // 电路图支持鼠标拖拽、单指拖动和双指缩放；自动重排后仍保留用户当前视角。
  const schematicSvg = $('schematic-svg');
  const schematicPointers = new Map();
  let schematicPanLast = null;
  let schematicPinch = null;
  let schematicComponentDrag = null;
  schematicSvg.addEventListener('pointerdown', event => {
    if (ui.view !== 'schematic' || (event.button !== undefined && event.button !== 0)) return;
    schematicPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    schematicSvg.setPointerCapture?.(event.pointerId);
    const componentNode = event.target.closest?.('[data-comp]');
    const component = componentNode ? controller.getComp(componentNode.dataset.comp) : null;
    if (schematicPointers.size === 1 && component) {
      schematicComponentDrag = {
        pointerId: event.pointerId,
        id: component.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: component.x,
        startY: component.y
      };
      schematicPanLast = null;
      schematicSvg.classList.add('dragging-component');
    } else if (schematicPointers.size === 1) {
      schematicPanLast = { x: event.clientX, y: event.clientY };
      schematicSvg.classList.add('panning');
    }
    if (schematicPointers.size === 2) {
      schematicComponentDrag = null;
      schematicSvg.classList.remove('dragging-component');
      const [a, b] = [...schematicPointers.values()];
      schematicPinch = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
      schematicPanLast = null;
    }
    event.preventDefault();
  });
  schematicSvg.addEventListener('pointermove', event => {
    if (!schematicPointers.has(event.pointerId)) return;
    schematicPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (schematicComponentDrag?.pointerId === event.pointerId && schematicPointers.size === 1) {
      const rect = schematicSvg.getBoundingClientRect();
      const box = readSchematicBox();
      if (box && rect.width && rect.height) {
        const dx = (event.clientX - schematicComponentDrag.startClientX) * box.w / rect.width;
        const dy = (event.clientY - schematicComponentDrag.startClientY) * box.h / rect.height;
        const x = Math.round((schematicComponentDrag.startX + dx) / 10) * 10;
        const y = Math.round((schematicComponentDrag.startY + dy) / 10) * 10;
        controller.moveComponent(schematicComponentDrag.id, x, y);
        view.moveComponent(schematicComponentDrag.id, x, y);
        renderSch();
      }
    } else if (schematicPointers.size >= 2 && schematicPinch) {
      const [a, b] = [...schematicPointers.values()];
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      zoomSchematic(schematicPinch.distance / distance, (a.x + b.x) / 2, (a.y + b.y) / 2);
      schematicPinch.distance = distance;
    } else if (schematicPanLast) {
      panSchematic(event.clientX - schematicPanLast.x, event.clientY - schematicPanLast.y);
      schematicPanLast = { x: event.clientX, y: event.clientY };
    }
    event.preventDefault();
  });
  const endSchematicPointer = event => {
    schematicPointers.delete(event.pointerId);
    if (schematicPointers.size === 1) {
      const remaining = [...schematicPointers.values()][0];
      schematicPanLast = { ...remaining };
      schematicPinch = null;
    } else if (!schematicPointers.size) {
      schematicPanLast = null;
      schematicPinch = null;
      schematicComponentDrag = null;
      schematicSvg.classList.remove('panning');
      schematicSvg.classList.remove('dragging-component');
    }
  };
  schematicSvg.addEventListener('pointerup', endSchematicPointer);
  schematicSvg.addEventListener('pointercancel', endSchematicPointer);

  // 手机横屏：默认露出窄元件栏；窄桌面先露出台面。
  if (isMobileLab()) {
    $('library-panel').classList.remove('collapsed');
    $('library-reopen').hidden = true;
  } else if (matchMedia('(max-width: 800px)').matches) {
    $('library-panel').classList.add('collapsed');
    $('library-reopen').hidden = false;
  }

  // —— 底部运输条 ——
  attachTransport(ui, {
    onLabelsChange(visible) {
      $('bench-svg').classList.toggle('component-labels-hidden', !visible);
      $('schematic-svg').classList.toggle('component-labels-hidden', !visible);
    },
    onFlowChange(mode) {
      if (ui.view === 'schematic') renderSch();
      else flow.rebuild(mode, controller.results, view, controller.bench);
    },
    onViewChange() { applyView(); },
    onReset() {
      controller.clear();
      schematicCamera.manual = null;
      dismissedSig = null;
      banner.hidden = true;
      view.resetView(stageViewport());
    },
    onZoom(factor) {
      if (ui.view === 'schematic') zoomSchematic(factor);
      else view.zoomAt(factor);
    },
    onZoomReset() {
      view.resetView(stageViewport());
      if (ui.view === 'schematic') renderSch({ refit: true });
    }
  });

  // 阻止手机长按触发“复制/全选/搜索”系统菜单。
  $('stage').addEventListener('contextmenu', event => event.preventDefault());

  // 滚轮缩放（以指针为中心）
  $('stage').addEventListener('wheel', (event) => {
    event.preventDefault();
    if (ui.view === 'schematic') {
      zoomSchematic(event.deltaY > 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
    } else {
      view.zoomAt(event.deltaY > 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
    }
  }, { passive: false });

  // —— 主循环：只驱动流向动画，物理求解由事件触发 ——
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden && ui.flowMode !== 'off') {
      if (ui.view === 'bench') flow.frame(dt, true, reducedMotion());
      else schFlow.frame(dt, true, reducedMotion());
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // —— 初始状态：支持 ?preset=good-simple 直达某个演示 ——
  const presetId = new URLSearchParams(location.search).get('preset');
  if (presetId) controller.loadPreset(presetId);
  else controller.solve();
  applyView();

  // —— 就绪闸门 ——
  window.__cb = { controller, view, ui, flow, schFlow, bellSound, mobile }; // 调试与自动化测试句柄
  window.__circuitBenchReady = true;
  const loading = $('loading');
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 900);
}

try {
  boot();
} catch (err) {
  console.error('[circuit-bench] 启动失败:', err);
  window.__showCircuitError?.(err?.message ?? 'STARTUP ERROR');
}
