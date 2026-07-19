// UI 层：底部运输条（流向三态 / 视图切换 / 复位）与视图缩放按钮。

const $ = id => document.getElementById(id);

const FLOW_MODES = [
  ['off', '流向 · 关'],
  ['current', '流向 · 电流'],
  ['electron', '流向 · 电子']
];
const VIEWS = [
  ['bench', '实物台'],
  ['schematic', '电路图']
];

export function attachTransport(ui, hooks) {
  const flowBtn = $('flow-button');
  const viewBtn = $('view-button');
  const resetBtn = $('reset-button');

  flowBtn.addEventListener('click', () => {
    const idx = (FLOW_MODES.findIndex(([m]) => m === ui.flowMode) + 1) % FLOW_MODES.length;
    ui.flowMode = FLOW_MODES[idx][0];
    flowBtn.querySelector('b').textContent = FLOW_MODES[idx][1];
    flowBtn.classList.toggle('active', ui.flowMode !== 'off');
    hooks.onFlowChange?.(ui.flowMode);
  });

  viewBtn.addEventListener('click', () => {
    const idx = (VIEWS.findIndex(([v]) => v === ui.view) + 1) % VIEWS.length;
    ui.view = VIEWS[idx][0];
    viewBtn.querySelector('b').textContent = VIEWS[idx][1];
    viewBtn.classList.toggle('active', ui.view === 'schematic');
    hooks.onViewChange?.(ui.view);
  });

  // 复位：两段确认，防误触
  let arming = false, timer = 0;
  resetBtn.addEventListener('click', () => {
    if (!arming) {
      arming = true;
      resetBtn.querySelector('small').textContent = '再按一次清空';
      resetBtn.classList.add('active');
      timer = setTimeout(() => {
        arming = false;
        resetBtn.querySelector('small').textContent = '复位';
        resetBtn.classList.remove('active');
      }, 2600);
      return;
    }
    clearTimeout(timer);
    arming = false;
    resetBtn.querySelector('small').textContent = '复位';
    resetBtn.classList.remove('active');
    hooks.onReset?.();
  });

  // 视图缩放
  $('zoom-in')?.addEventListener('click', () => hooks.onZoom?.(0.8));
  $('zoom-out')?.addEventListener('click', () => hooks.onZoom?.(1.25));
  $('zoom-reset')?.addEventListener('click', () => hooks.onZoomReset?.());
}
