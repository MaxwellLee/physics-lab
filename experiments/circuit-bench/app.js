// 电学实验台 · 应用装配层
// 把物理引擎、实物台渲染、接线交互、面板、运输条与各可视化层连接到一起。

import { Controller } from './src/sim/controller.js';
import { BenchView, fmtA } from './src/render/bench.js';
import { attachWiring } from './src/ui/wiring.js';
import { Panels } from './src/ui/panels.js';
import { attachTransport } from './src/ui/transport.js';
import { attachDialog } from './src/ui/dialog.js';
import { FlowView } from './src/render/flow.js';
import { PotentialView } from './src/render/potential.js';
import { renderSchematic } from './src/render/schematic.js';
import { WaterView } from './src/render/water.js';
import { reduceForWater } from './src/physics/circuit.js';
import { DEFS, SHORT_CURRENT } from './src/physics/components.js';

const $ = id => document.getElementById(id);

function boot() {
  // —— 全局 UI 状态（运输条直接读写）——
  const ui = { playing: true, speed: 1, flowMode: 'off', potential: false, view: 'bench' };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // —— 分层实例 ——
  const controller = new Controller();
  const view = new BenchView($('bench-svg'));
  const flow = new FlowView(view.flowLayer);
  const potential = new PotentialView(view, {
    root: $('potential-legend'), max: $('legend-max'), mid: $('legend-mid'), min: $('legend-min')
  });
  const water = new WaterView($('water-canvas'));

  // —— 事件横幅：短路 / 熔断 / 超功率 / 超量程 / 求解失败 ——
  const banner = $('event-banner');
  let dismissedSig = null;
  const BANNER_ORDER = ['short', 'fuse-blown', 'overpower', 'overrange', 'unsolvable', 'nonconverged'];
  const BANNER_TEXT = {
    short: () => ['检测到短路',
      `电源被近似零电阻的通路直接连通，电流已达安全上限 ${SHORT_CURRENT} A（教学限流模型）。真实电路中这会烧坏电源或导线——请检查接线，或串联用电器 / 保险丝。`],
    'fuse-blown': e => ['保险丝熔断',
      `电流 ${fmtA(e.current)} 超过了保险丝额定值，保险丝已熔断、电路断开。排除故障后，选中保险丝并「更换保险丝」。`],
    overpower: e => ['用电器功率过大',
      `「${DEFS[controller.getComp(e.id)?.type]?.label ?? '元件'}」实际功率 ${e.power.toFixed(2)} W，已明显超过额定 ${e.ratedP.toFixed(2)} W——真实情况下会烧毁。请降低电源电压或增大电阻。`],
    overrange: e => ['电表超过量程',
      `${e.meter === 'voltmeter' ? '电压表' : '电流表'}读数 ${Math.abs(e.reading).toFixed(2)} 超过所选量程 ${e.range}。请换用更大量程，真实电表超量程可能损坏。`],
    unsolvable: () => ['电路无法求解',
      '当前连接方式无法形成可计算的电路（例如多个电源直接对冲）。请检查电源与接线。'],
    nonconverged: () => ['求解未收敛',
      '非线性元件的迭代求解未完全收敛，读数可能不准确。请微调参数后重试。']
  };

  function updateBanner(results) {
    if (!results?.events?.length || !results.ok && !results.events?.length) {
      banner.hidden = true;
      $('status-dot').classList.remove('warn');
      $('sim-status').textContent = 'CIRCUIT READY';
      return;
    }
    const events = results.events;
    const sig = events.map(e => `${e.type}:${e.id ?? ''}`).sort().join('|');
    const top = BANNER_ORDER.map(t => events.find(e => e.type === t)).find(Boolean);
    const isShort = events.some(e => e.type === 'short');
    $('status-dot').classList.toggle('warn', isShort);
    $('sim-status').textContent = isShort ? 'SHORT CIRCUIT' : 'CIRCUIT READY';
    if (!top || sig === dismissedSig) { banner.hidden = true; return; }
    const [title, detail] = BANNER_TEXT[top.type](top);
    $('event-title').textContent = title;
    $('event-detail').textContent = detail;
    banner.hidden = false;
    $('event-dismiss').onclick = () => { dismissedSig = sig; banner.hidden = true; };
  }

  // —— 水路类比数据：与所搭电路数值联动 ——
  function updateWater() {
    const bench = controller.bench, results = controller.results;
    if (!bench.components.length) { water.setData({ mode: 'empty' }); return; }
    const red = reduceForWater(bench);
    if (!red || !results?.ok) { water.setData({ mode: 'unavailable' }); return; }
    const src = results.comps.get(red.sourceId);
    const loads = red.loadIds.map(id => {
      const comp = controller.getComp(id);
      const r = results.comps.get(id);
      let R = r?.rNow;
      if (R === undefined) R = r && Math.abs(r.I) > 1e-9 ? Math.abs(r.U / r.I) : 0;
      return { label: DEFS[comp.type].label, R };
    });
    water.setData({ mode: red.mode, U: src?.U ?? 0, I: src?.I ?? 0, loads });
  }

  // —— 视图切换 ——
  function applyView() {
    const v = ui.view;
    $('bench-svg').hidden = v !== 'bench';
    $('schematic-svg').hidden = v !== 'schematic';
    $('water-canvas').hidden = v !== 'water';
    $('schematic-note').hidden = v !== 'schematic';
    $('potential-legend').hidden = !(ui.potential && v === 'bench');
    $('view-status').textContent = { bench: '实物台', schematic: '电路图', water: '水路类比' }[v];
    if (v === 'schematic') renderSchematic($('schematic-svg'), controller.bench, view);
    if (v === 'water') { water.resize(); updateWater(); water.frame(0, false, reducedMotion()); }
  }

  // —— 控制层事件 → 渲染层 ——
  controller.subscribe((type, ctrl, payload) => {
    if (type === 'topology' || type === 'preset') {
      view.setBench(ctrl.bench);
      view.setSelected(ctrl.selected?.kind, ctrl.selected?.id);
      potential.pins = [];
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
      updateBanner(ctrl.results);
      flow.rebuild(ui.flowMode, ctrl.results, view, ctrl.bench);
      if (potential.enabled) potential.apply(ctrl.results);
      updateWater();
      if (ui.view === 'schematic') renderSchematic($('schematic-svg'), ctrl.bench, view);
    }
  });

  // —— 接线交互 ——
  attachWiring($('bench-svg'), view, controller, {
    getPlacementType: () => panels.placementType,
    clearPlacement: () => panels.clearPlacement()
  });

  // 电势模式：捕获阶段拦截接线柱 / 导线点击，转为电势测量（先于接线逻辑）
  $('bench-svg').addEventListener('pointerdown', (event) => {
    if (!ui.potential || ui.view !== 'bench') return;
    const results = controller.results;
    if (!results?.ok || !results.v) return;
    const t = event.target.closest?.('.terminal-hit, .terminal');
    const w = event.target.closest?.('.wire-hit');
    if (!t && !w) return;
    let node;
    if (t) node = results.nodeOf.get(`${t.dataset.comp}:${t.dataset.term}`);
    else {
      const wr = results.wires.get(w.dataset.wire);
      node = wr ? wr.aNode : undefined;
    }
    if (node === undefined) return;
    event.stopPropagation();
    event.preventDefault();
    potential.pick(view.toBench(event.clientX, event.clientY), node);
  }, true);

  // —— 左右面板 ——
  const defaultHint = $('hint-bar').textContent;
  const panels = new Panels(controller, {
    onPlacementArmed(type) {
      $('hint-bar').textContent = type
        ? `点击台面空白处放置：${DEFS[type].label}（Esc 取消）`
        : defaultHint;
    }
  });

  // 小屏设备：两个面板初始折叠，先露出台面（可用「元件」「资料」按钮展开）
  if (matchMedia('(max-width: 800px)').matches) {
    $('library-panel').classList.add('collapsed');
    $('inspector-panel').classList.add('collapsed');
    $('library-reopen').hidden = false;
    $('inspector-reopen').hidden = false;
  }

  // —— 底部运输条 ——
  attachTransport(ui, {
    onFlowChange(mode) {
      flow.rebuild(mode, controller.results, view, controller.bench);
      if (mode !== 'off' && ui.view !== 'bench') {
        $('hint-bar').textContent = '流向演示显示在实物台视图中';
        setTimeout(() => { if (!panels.placementType) $('hint-bar').textContent = defaultHint; }, 2200);
      }
    },
    onPotentialChange(on) {
      if (on) potential.enable(controller.results);
      else potential.disable();
      $('potential-legend').hidden = !(on && ui.view === 'bench');
      if (on) {
        $('hint-bar').textContent = '电势模式：点击任意两个接线柱或导线，测量两点间的电势差（电压）';
      } else {
        $('hint-bar').textContent = defaultHint;
      }
    },
    onViewChange() { applyView(); },
    onReset() {
      controller.clear();
      panels.records.clear();
      panels.renderDataTable();
      panels.renderPlot();
      dismissedSig = null;
      banner.hidden = true;
    }
  });
  attachDialog();

  // —— 主循环：只驱动动画层，物理求解由事件触发 ——
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * ui.speed;
    last = now;
    if (!document.hidden) {
      if (ui.view === 'bench') flow.frame(dt, ui.playing, reducedMotion());
      else if (ui.view === 'water') water.frame(dt, ui.playing, reducedMotion());
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.addEventListener('resize', () => { if (ui.view === 'water') { water.resize(); water.frame(0, false, reducedMotion()); } });

  // —— 初始状态：支持 ?preset=good-simple 直达某个演示 ——
  const presetId = new URLSearchParams(location.search).get('preset');
  if (presetId) controller.loadPreset(presetId);
  else controller.solve();
  applyView();

  // —— 就绪闸门 ——
  window.__cb = { controller, view, ui, flow, potential, water }; // 调试与自动化测试句柄
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
