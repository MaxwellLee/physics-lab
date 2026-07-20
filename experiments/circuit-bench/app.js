// 电学实验台 · 应用装配层
// 把物理引擎、实物台渲染、接线交互、面板、运输条与流向动画层连接到一起。

import { Controller } from './src/sim/controller.js';
import { BenchView, fmtA } from './src/render/bench.js';
import { attachWiring } from './src/ui/wiring.js';
import { Panels } from './src/ui/panels.js';
import { attachTransport } from './src/ui/transport.js';
import { attachDialog } from './src/ui/dialog.js';
import { FlowView } from './src/render/flow.js';
import { renderSchematic } from './src/render/schematic.js';
import { DEFS, SHORT_CURRENT } from './src/physics/components.js';

const $ = id => document.getElementById(id);

function boot() {
  // —— 全局 UI 状态（运输条直接读写）——
  const ui = { flowMode: 'off', view: 'bench' };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // —— 分层实例 ——
  const controller = new Controller();
  const view = new BenchView($('bench-svg'));
  const flow = new FlowView(view.flowLayer);
  const schFlow = new FlowView(null); // 电路图每次全量重画，renderSch 时再 setLayer 指向新图层

  // —— 事件横幅：短路 / 熔断 / 超功率 / 超量程 / 求解失败 ——
  const banner = $('event-banner');
  let dismissedSig = null;
  const BANNER_ORDER = ['short', 'fuse-blown', 'overpower', 'overrange', 'unsolvable', 'nonconverged'];
  const BANNER_TEXT = {
    short: () => ['检测到短路',
      `电源被近似零电阻的通路直接连通，支路电流已超过 ${SHORT_CURRENT} A 的短路判据（读数按导线 1 mΩ 的教学模型估算）。真实电路中这会烧坏电源或导线——请检查接线，或串联用电器 / 保险丝。`],
    'fuse-blown': e => ['保险丝熔断',
      `电流 ${fmtA(e.current)} 超过了保险丝额定值，保险丝已熔断、电路断开。排除故障后，选中保险丝并「更换保险丝」。`],
    overpower: e => ['用电器功率过大',
      `「${DEFS[controller.getComp(e.id)?.type]?.label ?? '元件'}」实际功率 ${e.power.toFixed(2)} W，已明显超过额定 ${e.ratedP.toFixed(2)} W——真实情况下会烧毁。请降低电源电压或增大电阻。`],
    overrange: e => ['电表超过量程',
      `${e.meter === 'voltmeter' ? '电压表' : '电流表'}读数 ${Math.abs(e.reading).toFixed(2)} 超过所接量程 ${e.range}。请换接更大量程的接线柱，真实电表超量程可能损坏。`],
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
      shortShownSig = null; // 短路排除后，下次再短路时重新弹窗
      const dlg = $('short-dialog');
      if (dlg.open) dlg.close(); // 短路已排除，自动收起弹窗
      return;
    }
    const events = results.events;
    const sig = events.map(e => `${e.type}:${e.id ?? ''}`).sort().join('|');
    const top = BANNER_ORDER.map(t => events.find(e => e.type === t)).find(Boolean);
    const isShort = events.some(e => e.type === 'short');
    $('status-dot').classList.toggle('warn', isShort);
    $('sim-status').textContent = isShort ? 'SHORT CIRCUIT' : 'CIRCUIT READY';
    if (isShort && sig !== shortShownSig) {
      // 短路红字弹窗：每种短路形态只弹一次，排除后再短路会重新弹
      shortShownSig = sig;
      $('short-detail').textContent = BANNER_TEXT.short()[1];
      const dlg = $('short-dialog');
      if (!dlg.open) dlg.showModal();
    }
    if (!top || sig === dismissedSig) { banner.hidden = true; return; }
    const [title, detail] = BANNER_TEXT[top.type](top);
    $('event-title').textContent = title;
    $('event-detail').textContent = detail;
    banner.hidden = false;
    $('event-dismiss').onclick = () => { dismissedSig = sig; banner.hidden = true; };
  }
  let shortShownSig = null;
  $('short-ok').addEventListener('click', () => $('short-dialog').close());

  // —— 视图切换（实物台 ⇄ 电路图） ——
  // 注意：SVG 元素没有 .hidden 反射属性，必须用 toggleAttribute 才能真正隐藏
  // 计算未被顶栏/面板/运输条遮挡的可视区域（CSS 像素），供电路图取景使用
  function stageViewport() {
    const W = innerWidth, H = innerHeight;
    const lp = $('library-panel'), rp = $('inspector-panel');
    const L = lp.classList.contains('collapsed') ? 0 : lp.getBoundingClientRect().right + 10;
    const Rraw = rp.classList.contains('collapsed') ? W - 64 : rp.getBoundingClientRect().left - 10;
    return { L, T: 84, R: Math.max(Rraw, L + 240), B: H - 100 };
  }
  // 电路图重渲染 + 流向层重建（符号每次全量重画，流向层指向新图层）
  function renderSch() {
    const { flowLinks, flowLayer } = renderSchematic($('schematic-svg'), controller.bench, view, stageViewport(), controller.results);
    schFlow.setLayer(flowLayer);
    schFlow.buildFromLinks(ui.flowMode, flowLinks);
  }
  function applyView() {
    const v = ui.view;
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
      view.setBench(ctrl.bench);
      view.setSelected(ctrl.selected?.kind, ctrl.selected?.id);
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
      if (ui.view === 'schematic') renderSch();
    }
  });

  // —— 垃圾桶：拖动元件时浮现，丢入删除 ——
  const trash = $('trash-bin');
  const trashHit = (x, y) => {
    const r = trash.getBoundingClientRect();
    const pad = 14;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  };

  // —— 接线交互 ——
  attachWiring($('bench-svg'), view, controller, {
    getPlacementType: () => panels.placementType,
    clearPlacement: () => panels.clearPlacement(),
    onDragStart() { trash.classList.add('show'); },
    onDragHover(x, y) { trash.classList.toggle('hover', trashHit(x, y)); },
    onTrashDrop(x, y) { return trash.classList.contains('show') && trashHit(x, y); },
    onDragEnd() { trash.classList.remove('show', 'hover'); }
  });

  // —— 左右面板 ——
  const defaultHint = $('hint-bar').textContent;
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
      if (comp) controller.select('comp', comp.id);
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
      if (ui.view === 'schematic') renderSch();
      else flow.rebuild(mode, controller.results, view, controller.bench);
    },
    onViewChange() { applyView(); },
    onReset() {
      controller.clear();
      panels.records.clear();
      panels.renderDataTable();
      panels.renderPlot();
      dismissedSig = null;
      banner.hidden = true;
      view.resetView();
    },
    onZoom(factor) { view.zoomAt(factor); },
    onZoomReset() { view.resetView(); }
  });
  attachDialog();

  // 滚轮缩放（以指针为中心）
  $('stage').addEventListener('wheel', (event) => {
    if (ui.view !== 'bench') return;
    event.preventDefault();
    view.zoomAt(event.deltaY > 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
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
  window.__cb = { controller, view, ui, flow, schFlow }; // 调试与自动化测试句柄
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
