// 接线与台面交互层：拖动元件、拖线吸附、点按连线、开关切换、
// 滑片/旋钮调节、空白处拖动平移画布、拖入垃圾桶删除、选择与键盘操作。

const GRID = 20;
const SNAP_DIST = 30;   // 接线吸附半径（bench 坐标）
const DRAG_TOL = 5;     // 超过视为拖动（屏幕像素）
const touchMode = () =>
  (globalThis.navigator?.maxTouchPoints ?? 0) > 0 ||
  globalThis.matchMedia?.('(pointer: coarse)').matches;

export function attachWiring(svg, view, controller, hooks) {
  let mode = null; // 'move' | 'wire' | 'wiremove' | 'slider' | 'knob' | 'pan'
  let dragComp = null, dragWire = null, dragOffset = null, downPos = null, moved = false;
  let panLast = null, trashShown = false;
  let wireFrom = null; // { comp, term }
  let armedTerminal = null; // 点按连线：已选中的第一个接线柱
  let solveScheduled = false;
  const activeTouches = new Map();
  let pinch = null, pinchActive = false;

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
  const terminalAt = (event) => {
    let best = null;
    // 起线必须更靠近可见接线柱；拖线结束仍由 nearestTerminal 提供较宽松的吸附。
    let bestDistance = touchMode() ? 20 : 22;
    for (const node of svg.querySelectorAll('.terminal')) {
      const rect = node.getBoundingClientRect();
      const distance = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { comp: node.dataset.comp, term: node.dataset.term };
      }
    }
    return best ?? terminalOf(event.target);
  };
  const wireAt = (event) =>
    event.target.closest?.('.wire-hit') ??
    document.elementsFromPoint(event.clientX, event.clientY)
      .find(node => node.classList?.contains('wire-hit')) ??
    null;
  const componentAt = (event) => {
    let best = null;
    for (const node of svg.querySelectorAll('.comp')) {
      const hit = node.querySelector('.comp-hit')?.getBoundingClientRect() ?? node.getBoundingClientRect();
      if (event.clientX < hit.left || event.clientX > hit.right || event.clientY < hit.top || event.clientY > hit.bottom) continue;
      const area = hit.width * hit.height;
      if (!best || area < best.area) best = { node, rect: hit, area };
    }
    return best;
  };
  const isCentralComponentTap = (hit, event) => {
    if (!hit) return false;
    const insetX = Math.min(18, hit.rect.width * 0.28);
    const insetY = Math.min(15, hit.rect.height * 0.24);
    return event.clientX >= hit.rect.left + insetX && event.clientX <= hit.rect.right - insetX &&
      event.clientY >= hit.rect.top + insetY && event.clientY <= hit.rect.bottom - insetY;
  };

  const nearestTerminal = (p, exclude) => {
    const rect = svg.getBoundingClientRect();
    const worldPerPx = view.viewState.w / Math.max(1, rect.width);
    let best = null, bestD = (touchMode() ? 34 : 22) * worldPerPx;
    for (const comp of controller.bench.components) {
      // 从某个元件开始拖线时，不把该元件的其他接线柱作为吸附目标。
      // 这样既保留 48 px 级触控命中区，也不会因接线柱靠得近而误吸附成自连接。
      if (exclude?.comp === comp.id) continue;
      const geo = view.geometryOf(comp);
      for (const term of Object.keys(geo.terms)) {
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

  const rejectSelfConnection = (from, target) => {
    if (!from || !target || from.comp !== target.comp) return false;
    view.flashInvalidConnection(from.comp);
    hooks.onInvalidWire?.('同一元件的接线柱不能用外部导线直接互连');
    return true;
  };

  const hideTrash = () => {
    if (trashShown) { trashShown = false; hooks.onDragEnd?.(); }
  };

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.pointerType === 'touch') {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size === 2) {
        const [a, b] = [...activeTouches.values()];
        pinch = {
          distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2
        };
        pinchActive = true;
        cancelWire();
        hideTrash();
        mode = 'pinch';
        dragComp = null; dragWire = null; panLast = null;
        svg.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
    }
    const p = view.toBench(event.clientX, event.clientY);
    downPos = { x: event.clientX, y: event.clientY };
    moved = false;

    // 1. 接线柱：开始拖线（若已有点按连线的起点，则直接完成连线）
    const componentHit = componentAt(event);
    const wireHit = wireAt(event);
    const directNode = event.target.closest?.('.terminal-hit, .terminal');
    let directTerm = terminalAt(event);
    // On compact touch layouts, transparent hit circles from adjacent meter
    // terminals can overlap. Use the nearest visible terminal centre instead
    // of DOM paint order whenever the hit came from an enlarged touch target.
    if (directNode?.classList.contains('terminal-hit')) {
      directTerm = terminalAt(event);
    }
    const directTerminalDistance = (() => {
      if (!directTerm) return Infinity;
      const node = svg.querySelector(`.terminal[data-comp="${CSS.escape(directTerm.comp)}"][data-term="${CSS.escape(directTerm.term)}"]`);
      const rect = node?.getBoundingClientRect();
      return rect
        ? Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2))
        : Infinity;
    })();
    const directHitNearVisiblePost = directTerminalDistance <= (touchMode() ? 12 : 10);
    // 透明触控圈可能覆盖紧贴电表底部的导线。点在接线柱圆心附近仍接线；
    // 点在触控圈外缘且下方确有导线时，把操作交给导线选择/删除。
    const transparentTermOverWire =
      !!directTerm && directNode?.classList.contains('terminal-hit') && !!wireHit && !directHitNearVisiblePost;
    const transparentTermOverComponent =
      !!directTerm && directNode?.classList.contains('terminal-hit') &&
      isCentralComponentTap(componentHit, event) && !directHitNearVisiblePost;
    if (transparentTermOverWire || transparentTermOverComponent) directTerm = null;
    // 真实点中接线柱时优先接线；只有“靠近接线柱”的模糊命中才让元件中心点击优先。
    const term = transparentTermOverWire || transparentTermOverComponent
      ? null
      : directTerm ?? (isCentralComponentTap(componentHit, event) ? null : terminalAt(event));
    if (term) {
      if (armedTerminal) {
        if (term.comp === armedTerminal.comp && term.term !== armedTerminal.term) {
          rejectSelfConnection(armedTerminal, term);
          view.setTerminalArmed(armedTerminal.comp, armedTerminal.term);
          event.preventDefault();
          return;
        }
        if (!(term.comp === armedTerminal.comp && term.term === armedTerminal.term)) {
          controller.addWire(armedTerminal, term);
          disarm();
          event.preventDefault();
          return;
        }
      }
      disarm();
      mode = 'wire';
      wireFrom = term;
      view.draftFrom = view.terminalPos(term.comp, term.term);
      view.showDraft(view.draftFrom, p);
      view.setTerminalArmed(term.comp, term.term);
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    // 2. 导线：位于元件上方，必须先于元件本体判定，否则贴着电表底部的故障导线无法选中。
    if (wireHit) {
      controller.select('wire', wireHit.dataset.wire);
      disarm();
      mode = 'wiremove';
      dragWire = wireHit.dataset.wire;
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    // 3. 滑片 / 旋钮 / 元件本体
    const compEl = event.target.closest?.('.comp') ?? componentHit?.node;
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
        // 元件本体：拖动（移动超过阈值后显示垃圾桶）
        mode = 'move';
        dragComp = comp;
        dragOffset = { x: p.x - comp.x, y: p.y - comp.y };
        svg.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    // 4. 空台面：放置模式优先，否则进入画布平移
    const placeType = hooks.getPlacementType?.();
    if (placeType) {
      const geo = view.geometryOf({ type: placeType });
      const comp = controller.addComponent(placeType, snap(p.x - geo.w / 2), snap(p.y - geo.h / 2));
      hooks.clearPlacement?.();
      // 新放入元件只完成放置，不立刻弹参数；再次点选元件时才显示参数与删除。
      if (comp) controller.select(null);
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
    if (event.pointerType === 'touch' && activeTouches.has(event.pointerId)) {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinchActive) {
      if (activeTouches.size >= 2 && pinch) {
        const [a, b] = [...activeTouches.values()];
        const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const x = (a.x + b.x) / 2;
        const y = (a.y + b.y) / 2;
        const factor = Math.max(.72, Math.min(1.38, pinch.distance / distance));
        view.zoomAt(factor, x, y);
        pinch = { distance, x, y };
      }
      return;
    }
    const p = view.toBench(event.clientX, event.clientY);
    const dragTol = touchMode() ? 11 : DRAG_TOL;
    if (downPos && Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y) > dragTol) moved = true;

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
    if (event.pointerType === 'touch') activeTouches.delete(event.pointerId);
    if (pinchActive) {
      if (activeTouches.size < 2) { mode = null; pinch = null; }
      if (activeTouches.size === 0) pinchActive = false;
      return;
    }
    const p = view.toBench(event.clientX, event.clientY);

    if (mode === 'pan') {
      mode = null; panLast = null;
      return;
    }

    if (mode === 'wire' && wireFrom) {
      const from = wireFrom;
      const target = nearestTerminal(p, from) ?? terminalAt(event);
      cancelWire();
      if (target && target.comp === from.comp && target.term !== from.term) {
        rejectSelfConnection(from, target);
        disarm();
      } else if (target && target.comp !== from.comp) {
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
      const term = terminalAt(event);
      if (term && term.comp === armedTerminal.comp && term.term !== armedTerminal.term) {
        rejectSelfConnection(armedTerminal, term);
        view.setTerminalArmed(armedTerminal.comp, armedTerminal.term);
        return;
      }
      if (term && term.comp !== armedTerminal.comp) {
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

  svg.addEventListener('pointercancel', (event) => {
    if (event.pointerType === 'touch') activeTouches.delete(event.pointerId);
    if (activeTouches.size === 0) { pinchActive = false; pinch = null; }
    cancelWire();
    hideTrash();
    if (dragWire) view.svg.querySelector(`#wire-${dragWire}`)?.classList.remove('dragging');
    mode = null; dragComp = null; dragWire = null; panLast = null;
  });

  // 键盘操作
  window.addEventListener('keydown', (event) => {
    if (event.target?.matches?.('input, select, textarea')) return;
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
