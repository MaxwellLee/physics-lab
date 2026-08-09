// 简化 UI：窄图标元件栏 + 选中对象的参数/删除条。
import { DEFS, HORIZONTALLY_FLIPPABLE } from '../physics/components.js';
import { CATEGORIES, CATALOG, WIRE_SPECIMENS } from '../../data.js';

const $ = id => document.getElementById(id);

export class Panels {
  constructor(controller, hooks) {
    this.controller = controller;
    this.hooks = hooks;
    this.placementType = null;
    this.buildLibrary();
    this.attachCollapse();
    controller.subscribe(type => {
      if (type === 'select' || type === 'topology' || type === 'preset' || type === 'param-structure') {
        this.renderSelectionBar();
      }
    });
    this.renderSelectionBar();
  }

  buildLibrary() {
    const list = $('component-list');
    list.replaceChildren();
    for (const category of CATEGORIES) {
      const types = Object.keys(CATALOG).filter(type => CATALOG[type].category === category.id);
      if (!types.length) continue;
      const group = document.createElement('section');
      group.className = 'part-group';
      const heading = document.createElement('small');
      heading.textContent = category.label;
      group.appendChild(heading);
      for (const type of types) {
        const button = document.createElement('button');
        button.className = 'comp-item';
        button.dataset.type = type;
        button.type = 'button';
        button.title = DEFS[type].label;
        button.setAttribute('aria-label', `选择${DEFS[type].label}`);
        button.innerHTML = `<i class="part-icon">${paletteIcon(type)}</i><b>${shortLabel(type)}</b>`;
        this.attachLibraryDrag(button, type);
        group.appendChild(button);
      }
      list.appendChild(group);
    }
  }

  // Pointer Events 同时覆盖鼠标与触摸：横向拖出即直接放置；普通点按仍保留“点选—放置”。
  attachLibraryDrag(button, type) {
    let gesture = null;
    let suppressClick = false;
    const cleanup = () => {
      gesture?.ghost?.remove();
      button.classList.remove('dragging-out');
      gesture = null;
    };
    button.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      gesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        active: false,
        scrolling: false,
        ghost: null
      };
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointermove', event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      const stepY = event.clientY - gesture.lastY;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      if (gesture.scrolling) {
        button.closest('.library-scroll').scrollTop -= stepY;
        event.preventDefault();
        return;
      }
      if (!gesture.active) {
        if (Math.hypot(dx, dy) < 9) return;
        // 触摸时自行区分方向，避免浏览器滚动手势触发 pointercancel 中断横向拖放。
        if (event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) {
          gesture.scrolling = true;
          suppressClick = true;
          button.closest('.library-scroll').scrollTop -= stepY;
          event.preventDefault();
          return;
        }
        gesture.active = true;
        suppressClick = true;
        button.classList.add('dragging-out');
        const ghost = document.createElement('div');
        ghost.className = 'drag-ghost';
        ghost.innerHTML = `<i>${paletteIcon(type)}</i><b>${shortLabel(type)}</b>`;
        document.body.appendChild(ghost);
        gesture.ghost = ghost;
      }
      gesture.ghost.style.left = `${event.clientX}px`;
      gesture.ghost.style.top = `${event.clientY}px`;
      event.preventDefault();
    });
    button.addEventListener('pointerup', event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      if (gesture.active) {
        // 某些移动浏览器在 touchend 对应的 pointerup 中把坐标清空，使用最后一次 move 坐标更可靠。
        const x = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : gesture.lastX;
        const y = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : gesture.lastY;
        const bench = document.getElementById('bench-svg')?.getBoundingClientRect();
        const target = document.elementFromPoint(x, y);
        const blocked = target?.closest?.('.library-panel, .topbar, .transport, .param-bar, .event-banner');
        const insideBench = bench && x >= bench.left && x <= bench.right && y >= bench.top && y <= bench.bottom;
        if (insideBench && !blocked) this.hooks.onDropPlace?.(type, x, y);
        event.preventDefault();
      }
      cleanup();
    });
    button.addEventListener('pointercancel', cleanup);
    button.addEventListener('click', event => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      this.armPlacement(type, button);
    });
  }

  armPlacement(type, button) {
    const turnOff = this.placementType === type;
    this.placementType = turnOff ? null : type;
    document.querySelectorAll('.comp-item').forEach(item =>
      item.classList.toggle('armed', !turnOff && item === button));
    this.controller.select(null);
    this.hooks.onPlacementArmed?.(this.placementType);
  }

  clearPlacement() {
    this.placementType = null;
    document.querySelectorAll('.comp-item').forEach(item => item.classList.remove('armed'));
    this.hooks.onPlacementArmed?.(null);
  }

  renderSelectionBar() {
    const selected = this.controller.selected;
    if (selected?.kind === 'comp') {
      const comp = this.controller.getComp(selected.id);
      if (comp) return this.renderComponentBar(comp);
    }
    if (selected?.kind === 'wire' && this.controller.getWire(selected.id)) {
      return this.renderWireBar(selected.id);
    }
    $('param-bar').hidden = true;
  }

  renderComponentBar(comp) {
    const bar = $('param-bar');
    this.panelOpenedAt = performance.now();
    bar.replaceChildren();
    bar.className = 'param-bar';
    const def = DEFS[comp.type];
    const title = document.createElement('b');
    title.className = 'param-title';
    title.textContent = def.label;
    bar.appendChild(title);

    const entries = Object.entries(def.params);
    if (!entries.length) {
      const note = document.createElement('span');
      note.className = 'param-note';
      note.textContent = def.kind === 'meter' ? '量程由接线柱决定' : '此元件没有可调参数';
      bar.appendChild(note);
    }
    for (const [key, config] of entries) {
      if (comp.type === 'wire-board' && key === 'specimen') {
        bar.appendChild(this.selectRow(comp, key, config.label,
          WIRE_SPECIMENS.map(spec => ({ value: spec.id, label: `${spec.label} ≈${spec.R} Ω` })),
          comp.params.specimen));
      } else if (config.type === 'bool') {
        const label = document.createElement('label');
        label.className = 'param-check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(comp.params[key]);
        input.addEventListener('change', () =>
          this.controller.setParam(comp.id, key, input.checked, { redraw: false }));
        label.append(input, document.createTextNode(config.label));
        bar.appendChild(label);
      } else if (config.options) {
        bar.appendChild(this.selectRow(comp, key, config.label,
          config.options.map(value => ({ value, label: `${value} ${config.unit ?? ''}` })),
          comp.params[key]));
      } else {
        const row = document.createElement('div');
        row.className = 'param-row';
        row.dataset.param = key;
        const name = document.createElement('span');
        name.textContent = config.label;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = config.min;
        input.max = config.max;
        input.step = config.step;
        input.value = comp.params[key];
        const output = document.createElement('output');
        const updateOutput = () => {
          if (comp.type === 'rheostat' && key === 'x') {
            const state = this.rheostatResistanceState(comp);
            output.textContent = state.valid ? `${state.value} Ω` : '— Ω';
          } else {
            output.textContent = `${comp.params[key]} ${config.unit ?? ''}`;
          }
        };
        updateOutput();
        input.addEventListener('input', () => {
          const value = Number(input.value);
          comp.params[key] = value;
          updateOutput();
          this.controller.setParam(comp.id, key, value, { redraw: key === 'cells' });
          if (comp.type === 'rheostat' && key === 'max') {
            const resistanceOutput = bar.querySelector('.param-row[data-param="x"] output');
            const state = this.rheostatResistanceState(comp);
            if (resistanceOutput) resistanceOutput.textContent = state.valid ? `${state.value} Ω` : '— Ω';
          }
        });
        row.append(name, input, output);
        bar.appendChild(row);
      }
    }

    if (comp.type === 'fuse' && comp.blown) {
      const replace = document.createElement('button');
      replace.className = 'param-action';
      replace.textContent = '更换保险丝';
      replace.addEventListener('click', () => this.controller.replaceFuse(comp.id));
      bar.appendChild(replace);
    }
    if (HORIZONTALLY_FLIPPABLE.has(comp.type)) {
      const flip = document.createElement('button');
      flip.className = 'param-action param-flip';
      flip.type = 'button';
      flip.title = '左右镜像元件';
      flip.setAttribute('aria-label', `左右翻转${def.label}`);
      flip.setAttribute('aria-pressed', String(Boolean(comp.flipped)));
      flip.innerHTML = '<span aria-hidden="true">⇆</span>左右翻转';
      flip.addEventListener('click', () => this.controller.toggleHorizontalFlip(comp.id));
      bar.appendChild(flip);
    }
    bar.appendChild(this.deleteButton('删除元件', () => this.controller.removeComponent(comp.id)));
    bar.appendChild(this.closeButton());
    bar.hidden = false;
  }

  rheostatResistanceState(comp) {
    const isConnected = terminal => this.controller.bench.wires.some(wire =>
      (wire.a.comp === comp.id && wire.a.term === terminal) ||
      (wire.b.comp === comp.id && wire.b.term === terminal));
    const hasC = isConnected('c');
    const hasD = isConnected('d');
    const hasLeft = isConnected('a');
    const hasRight = isConnected('b');
    const upperCount = Number(hasC) + Number(hasD);
    const lowerCount = Number(hasLeft) + Number(hasRight);
    const connectionCount = upperCount + lowerCount;
    const valid = upperCount === 1 && lowerCount === 1;
    const signature = `${Number(hasLeft)}${Number(hasRight)}${Number(hasC)}${Number(hasD)}`;
    if (!valid) return { valid: false, shouldWarn: connectionCount >= 2, signature };
    const max = Number(comp.params.max ?? 50);
    const x = Math.min(1, Math.max(0, Number(comp.params.x ?? 0.5)));
    const resistance = max * (hasLeft ? x : 1 - x);
    const rounded = Math.round(resistance * 100) / 100;
    return { valid: true, value: rounded, signature };
  }

  renderWireBar(id) {
    const bar = $('param-bar');
    bar.replaceChildren();
    bar.className = 'param-bar wire-params';
    const title = document.createElement('b');
    title.className = 'param-title';
    title.textContent = '导线';
    const note = document.createElement('span');
    note.className = 'param-note';
    note.textContent = '已选中导线';
    bar.append(title, note, this.deleteButton('删除导线', () => this.controller.removeWire(id)), this.closeButton());
    bar.hidden = false;
  }

  deleteButton(label, action) {
    const button = document.createElement('button');
    button.className = 'param-delete';
    button.type = 'button';
    button.innerHTML = `<span>×</span>${label}`;
    button.addEventListener('click', event => {
      // A touch that selected a component must not fall through onto the newly
      // mounted delete button in the same gesture.
      if (event.isTrusted && performance.now() - (this.panelOpenedAt ?? 0) < 350) return;
      action();
    });
    return button;
  }

  closeButton() {
    const button = document.createElement('button');
    button.className = 'param-close';
    button.type = 'button';
    button.setAttribute('aria-label', '关闭参数条');
    button.textContent = '×';
    button.addEventListener('click', () => this.controller.select(null));
    return button;
  }

  selectRow(comp, key, labelText, options, current) {
    const row = document.createElement('div');
    row.className = 'param-row select-param';
    const name = document.createElement('span');
    name.textContent = labelText;
    const select = document.createElement('select');
    for (const option of options) {
      const item = document.createElement('option');
      item.value = String(option.value);
      item.textContent = option.label;
      item.selected = String(option.value) === String(current);
      select.appendChild(item);
    }
    select.addEventListener('change', () => this.controller.setParam(comp.id, key, select.value));
    row.append(name, select);
    return row;
  }

  attachCollapse() {
    const changed = () => this.hooks.onLayoutChange?.();
    $('library-close').addEventListener('click', () => {
      $('library-panel').classList.add('collapsed');
      $('library-reopen').hidden = false;
      changed();
    });
    $('library-reopen').addEventListener('click', () => {
      $('library-panel').classList.remove('collapsed');
      $('library-reopen').hidden = true;
      changed();
    });
  }
}

const shortLabel = type => ({
  'student-supply': '学生电源', 'battery-pack': '干电池', accumulator: '蓄电池',
  switch: '开关', 'spdt-switch': '双掷开关',
  resistor: '电阻', rheostat: '滑动变阻器', 'resistance-box': '电阻箱', 'wire-board': '电阻丝',
  ammeter: '电流表', voltmeter: '电压表', galvanometer: '电流计',
  diode: '二极管', led: '发光管', bulb: '灯泡', 'bulb-nl': '白炽灯',
  fuse: '保险丝', bell: '电铃', motor: '电动机'
}[type] ?? DEFS[type]?.label ?? type);

function paletteIcon(type) {
  const common = 'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  const shapes = {
    'student-supply': '<rect x="9" y="7" width="46" height="34" rx="5"/><path d="M17 18h17M17 25h12"/><circle cx="44" cy="25" r="7"/><path d="M41 25h6M44 22v6"/>',
    'battery-pack': '<path d="M10 24h8m28 0h8"/><rect x="18" y="12" width="28" height="24" rx="3"/><path d="M26 16v16m10-16v16"/>',
    accumulator: '<rect x="12" y="10" width="40" height="30" rx="4"/><path d="M20 10V6m24 4V6M18 24h8m-4-4v8m16-4h8"/>',
    switch: '<circle cx="10" cy="31" r="3"/><circle cx="54" cy="31" r="3"/><path d="M13 31h8l25-15M46 31h5"/>',
    'spdt-switch': '<circle cx="9" cy="24" r="3"/><circle cx="54" cy="13" r="3"/><circle cx="54" cy="35" r="3"/><path d="M12 24h10l25-11"/>',
    resistor: '<path d="M5 24h10l5-8 7 16 7-16 7 16 5-8h13"/>',
    rheostat: '<path d="M5 29h10l5-7 7 14 7-14 7 14 6-7h12M42 7L29 22m7-15h6v6"/>',
    'resistance-box': '<rect x="7" y="8" width="50" height="32" rx="4"/><path d="M15 27h7l4-7 6 14 6-14 4 7h7"/>',
    'wire-board': '<path d="M5 24h8c5-15 9 15 14 0s9 15 14 0 9 15 14 0h4"/>',
    ammeter: '<circle cx="32" cy="24" r="19"/><text x="32" y="31" text-anchor="middle" font-size="20" fill="currentColor" stroke="none">A</text>',
    voltmeter: '<circle cx="32" cy="24" r="19"/><text x="32" y="31" text-anchor="middle" font-size="20" fill="currentColor" stroke="none">V</text>',
    galvanometer: '<circle cx="32" cy="24" r="19"/><text x="32" y="31" text-anchor="middle" font-size="20" fill="currentColor" stroke="none">G</text>',
    diode: '<path d="M6 24h13m26 0h13M19 12l26 12-26 12zM45 11v26"/>',
    led: '<path d="M6 28h13m26 0h13M19 16l26 12-26 12zM45 15v26M39 9l8-6m-2 13 10-7"/>',
    bulb: '<circle cx="32" cy="21" r="15"/><path d="M24 18l16 10m0-10L24 28M25 37h14m-12 5h10"/>',
    'bulb-nl': '<circle cx="32" cy="21" r="15"/><path d="M23 25c4-13 14 13 18-2M25 37h14m-12 5h10"/>',
    fuse: '<path d="M5 24h11m32 0h11"/><rect x="16" y="17" width="32" height="14" rx="7"/><path d="M21 24h22"/>',
    bell: '<path d="M14 34h36M19 34c2-4 4-7 4-15a9 9 0 0118 0c0 8 2 11 4 15M29 40h6"/>',
    motor: '<circle cx="32" cy="24" r="19"/><text x="32" y="31" text-anchor="middle" font-size="20" fill="currentColor" stroke="none">M</text>'
  };
  return `<svg viewBox="0 0 64 48" aria-hidden="true" ${common}>${shapes[type] ?? '<circle cx="32" cy="24" r="14"/>'}</svg>`;
}
