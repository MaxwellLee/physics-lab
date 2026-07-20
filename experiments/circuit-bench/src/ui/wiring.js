// 接线与台面交互层：拖动元件、拖线吸附、点按连线、开关切换、
// 滑片/旋钮调节、空白处拖动平移画布、拖入垃圾桶删除、选择与键盘操作。

const GRID = 20;
const SNAP_DIST = 30;   // 接线吸附半径（bench 坐标）
const DRAG_TOL = 5;     // 超过视为拖动（屏幕像素）

export function attachWiring(svg, view, controller, hooks) {
  let mode = null; // 'move' | 'wire' | 'wiremove' | 'slider' | 'knob' | 'pan'
  let dragComp = null, dragWire = null, dragOffset = null, downPos = null, moved = false;
  let panLast = null, trashShown = false;
  let wireFrom = null; // { comp, term }
  let armedTerminal = null; // 点按连线：已选中的第一个接线柱
  let solveScheduled = false;

  const scheduleSolve = () => {
    if (solveScheduled) return;
    solveScheduled = true;
    requestAnimationFrame(() => { solveScheduled = false; controller.solve(); });
  };

  const terminalOf = (target) => {
    const n = target.closest?.('.terminal-hit, .terminal, .terminal-dot');
    if (!n) return null;
    return { comp: n.dataset.comp, term: n.dataset.term };
  };

  const nearestTerminal = (p, exclude) => {
    let best = null, bestD = SNAP_DIST;
    for (const comp of controller.bench.components) {
      const geo = view.geometryOf(comp);
      for (const term of Object.keys(geo.terms)) {
        if (exclude && exclude.comp === comp.id && exclude.term === term) continue;
        const tp = view.terminalPos(comp.id, term);
        const d = Math.hypot(tp.x - p.x, tp.y - p.y);
        if (d < bestD) { bestD = d; best = { comp: comp.id, term }; }
      }
    }
    return best;
  };

  const cancelWire = () => {
    wireFrom = null;
    mode = null;
    view.hideDraft();
    view.clearTerminalStates();
  };

  const disarm = () => {
    armedTerminal = null;
    view.clearTerminalStates();
  };

  const hideTrash = () => {
    if (trashShown) { trashShown = false; hooks.onDragEnd?.(); }
  };

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const p = view.toBench(event.clientX, event.clientY);
    downPos = { x: event.clientX, y: event.clientY };
    moved = false;

    // 1. 接线柱：开始拖线（若已有点按连线的起点，则直接完成连线）
    const term = terminalOf(event.target);
    if (term) {
      if (armedTerminal && !(term.comp === armedTerminal.comp && term.term === armedTerminal.term)) {
        controller.addWire(armedTerminal, term);
        disarm();
        event.preventDefault();
        return;
      }
      disarm();
      mode = 'wire';
      wireFrom = term;
      view.draftFrom = view.terminalPos(term.comp, term.term);
      view.showDraft(view.draftFrom, p);
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    // 2. 滑片 / 旋钮 / 元件本体
    const compEl = event.target.closest?.('.comp');
    if (compEl) {
      const id = compEl.id.replace(/^comp-/, '');
      const comp = controller.getComp(id);
      if (comp) {
        const local = { x: p.x - comp.x, y: p.y - comp.y };
        if (comp.type === 'rheostat' && local.y < 50) {
          mode = 'slider'; dragComp = comp;
          svg.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          return;
        }
        if (comp.type === 'student-supply' && Math.hypot(local.x - 64, local.y - 118) < 26) {
          mode = 'knob'; dragComp = comp;
          svg.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          return;
        }
        // 3. 元件本体：拖动（移动超过阈值后显示垃圾桶）
        mode = 'move';
        dragComp = comp;
        dragOffset = { x: p.x - comp.x, y: p.y - comp.y };
        svg.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    // 4. 导线：选中；若按住拖动，可拖进垃圾桶删除
    const wireHit = event.target.closest?.('.wire-hit');
    if (wireHit) {
      controller.select('wire', wireHit.dataset.wire);
      disarm();
      mode = 'wiremove';
      dragWire = wireHit.dataset.wire;
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    // 5. 空台面：放置模式优先，否则进入画布平移
    const placeType = hooks.getPlacementType?.();
    if (placeType) {
      const comp = controller.addComponent(placeType, snap(p.x - 60), snap(p.y - 40));
      hooks.clearPlacement?.();
      if (comp) controller.select('comp', comp.id);
      return;
    }
    disarm();
    controller.select(null);
    mode = 'pan';
    panLast = { x: event.clientX, y: event.clientY };
    svg.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  svg.addEventListener('pointermove', (event) => {
    const p = view.toBench(event.clientX, event.clientY);
    if (downPos && Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y) > DRAG_TOL) moved = true;

    if (mode === 'pan' && panLast) {
      view.panBy(event.clientX - panLast.x, event.clientY - panLast.y);
      panLast = { x: event.clientX, y: event.clientY };
      return;
    }
    if (mode === 'wire' && wireFrom) {
      view.updateDraft(p);
      const snapTo = nearestTerminal(p, wireFrom);
      view.setTerminalSnap(snapTo?.comp, snapTo?.term);
      return;
    }
    if (mode === 'move' && dragComp) {
      if (moved && !trashShown) { trashShown = true; hooks.onDragStart?.(); }
      view.moveComponent(dragComp.id, snap(p.x - dragOffset.x), snap(p.y - dragOffset.y));
      hooks.onDragHover?.(event.clientX, event.clientY);
      return;
    }
    if (mode === 'wiremove' && dragWire) {
      // 拖动导线：浮现垃圾桶并高亮被拖导线；松手位置在垃圾桶内则删除
      if (moved && !trashShown) {
        trashShown = true;
        hooks.onDragStart?.();
        view.svg.querySelector(`#wire-${dragWire}`)?.classList.add('dragging');
      }
      if (trashShown) hooks.onDragHover?.(event.clientX, event.clientY);
      return;
    }
    if (mode === 'slider' && dragComp) {
      const x = Math.min(1, Math.max(0, (p.x - dragComp.x - 26) / 208));
      dragComp.params.x = Math.round(x * 100) / 100;
      view.updateDynamic(controller.results, controller.bench);
      scheduleSolve();
      return;
    }
    if (mode === 'knob' && dragComp) {
      const v = Math.min(15, Math.max(1.5, Math.round((dragComp.params.voltage - (event.movementY ?? 0) * 0.05) * 2) / 2));
      dragComp.params.voltage = v;
      view.updateDynamic(controller.results, controller.bench);
      scheduleSolve();
    }
  });

  svg.addEventListener('pointerup', (event) => {
    const p = view.toBench(event.clientX, event.clientY);

    if (mode === 'pan') {
      mode = null; panLast = null;
      return;
    }

    if (mode === 'wire' && wireFrom) {
      const from = wireFrom;
      const target = nearestTerminal(p, from) ?? terminalOf(event.target);
      cancelWire();
      if (target && !(target.comp === from.comp && target.term === from.term)) {
        controller.addWire(from, target);
        disarm();
      } else if (!moved) {
        // 点按连线：选中第一个接线柱（cancelWire 会清除高亮，需在其后设置）
        armedTerminal = from;
        view.setTerminalArmed(from.comp, from.term);
      }
      return;
    }

    if (armedTerminal) {
      // 点按连线：第二个接线柱
      const term = terminalOf(event.target);
      if (term && !(term.comp === armedTerminal.comp && term.term === armedTerminal.term)) {
        controller.addWire(armedTerminal, term);
        disarm();
        return;
      }
      if (!term) disarm();
    }

    if (mode === 'move' && dragComp) {
      const comp = dragComp;
      const wasDrag = moved;
      if (trashShown) {
        // 拖入垃圾桶则删除
        if (hooks.onTrashDrop?.(event.clientX, event.clientY)) {
          hideTrash();
          controller.removeComponent(comp.id);
          dragComp = null; mode = null;
          return;
        }
        hideTrash();
      }
      if (!wasDrag) {
        // 点击：选中；开关类同时切换
        controller.select('comp', comp.id);
        if (comp.type === 'switch' || comp.type === 'spdt-switch') {
          controller.toggleSwitch(comp.id);
        }
      } else {
        controller.emit('topology');
      }
      dragComp = null; mode = null;
      return;
    }
    if (mode === 'wiremove' && dragWire) {
      const id = dragWire;
      view.svg.querySelector(`#wire-${id}`)?.classList.remove('dragging');
      if (trashShown) {
        if (hooks.onTrashDrop?.(event.clientX, event.clientY)) {
          hideTrash();
          controller.removeWire(id);
          dragWire = null; mode = null;
          return;
        }
        hideTrash();
      }
      dragWire = null; mode = null;
      return;
    }
    if ((mode === 'slider' || mode === 'knob') && dragComp) {
      controller.setParam(dragComp.id, mode === 'slider' ? 'x' : 'voltage',
        mode === 'slider' ? dragComp.params.x : dragComp.params.voltage, { redraw: false });
      dragComp = null; mode = null;
      return;
    }
    mode = null; dragComp = null;
  });

  svg.addEventListener('pointercancel', () => {
    cancelWire();
    hideTrash();
    if (dragWire) view.svg.querySelector(`#wire-${dragWire}`)?.classList.remove('dragging');
    mode = null; dragComp = null; dragWire = null; panLast = null;
  });

  // 键盘操作
  window.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea')) return;
    if (event.key === 'Escape') {
      if (armedTerminal) disarm();
      else if (hooks.getPlacementType?.()) hooks.clearPlacement?.();
      else controller.select(null);
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && controller.selected) {
      const { kind, id } = controller.selected;
      if (kind === 'comp') controller.removeComponent(id);
      else controller.removeWire(id);
      event.preventDefault();
      return;
    }
    if (event.key.startsWith('Arrow') && controller.selected?.kind === 'comp') {
      const comp = controller.getComp(controller.selected.id);
      if (!comp) return;
      const d = { ArrowLeft: [-GRID, 0], ArrowRight: [GRID, 0], ArrowUp: [0, -GRID], ArrowDown: [0, GRID] }[event.key];
      view.moveComponent(comp.id, comp.x + d[0], comp.y + d[1]);
      controller.emit('topology');
      event.preventDefault();
    }
  });

  return { cancelWire, disarm };
}

function snap(v) { return Math.round(v / GRID) * GRID; }
