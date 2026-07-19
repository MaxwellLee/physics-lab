// UI 层：底部运输条（播放/速度/流向/电势/视图/复位）。

const $ = id => document.getElementById(id);

const FLOW_MODES = [
  ['off', '流向 · 关'],
  ['current', '流向 · 电流'],
  ['electron', '流向 · 电子'],
  ['both', '流向 · 对比']
];
const SPEEDS = [0.5, 1, 2];
const VIEWS = [
  ['bench', '实物台'],
  ['schematic', '电路图'],
  ['water', '水路类比']
];

export function attachTransport(ui, hooks) {
  const playBtn = $('play-button');
  const speedBtn = $('speed-button');
  const flowBtn = $('flow-button');
  const potBtn = $('potential-button');
  const viewBtn = $('view-button');
  const resetBtn = $('reset-button');

  playBtn.addEventListener('click', () => {
    ui.playing = !ui.playing;
    playBtn.querySelector('span').textContent = ui.playing ? 'Ⅱ' : '▶';
    playBtn.querySelector('small').textContent = ui.playing ? '暂停' : '播放';
    hooks.onPlayChange?.(ui.playing);
  });

  speedBtn.addEventListener('click', () => {
    const next = SPEEDS[(SPEEDS.indexOf(ui.speed) + 1) % SPEEDS.length];
    ui.speed = next;
    speedBtn.querySelector('b').textContent = `${next}×`;
  });

  flowBtn.addEventListener('click', () => {
    const idx = (FLOW_MODES.findIndex(([m]) => m === ui.flowMode) + 1) % FLOW_MODES.length;
    ui.flowMode = FLOW_MODES[idx][0];
    flowBtn.querySelector('b').textContent = FLOW_MODES[idx][1];
    flowBtn.classList.toggle('active', ui.flowMode !== 'off');
    hooks.onFlowChange?.(ui.flowMode);
  });

  potBtn.addEventListener('click', () => {
    ui.potential = !ui.potential;
    potBtn.classList.toggle('active', ui.potential);
    potBtn.setAttribute('aria-pressed', String(ui.potential));
    hooks.onPotentialChange?.(ui.potential);
  });

  viewBtn.addEventListener('click', () => {
    const idx = (VIEWS.findIndex(([v]) => v === ui.view) + 1) % VIEWS.length;
    ui.view = VIEWS[idx][0];
    viewBtn.querySelector('b').textContent = VIEWS[idx][1];
    hooks.onViewChange?.(ui.view);
  });

  // 复位：两段确认，防误触
  let arming = false, timer = 0;
  resetBtn.addEventListener('click', () => {
    if (!arming) {
      arming = true;
      resetBtn.querySelector('small').textContent = '再按一次确认';
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
}
