// 电路图生成层：把实物台拓扑规整为标准电路图。
// 方法：导线合并等势组 → 组节点吸附到网格 → 元件符号按几何方向摆放 → 横平竖直走线。
// 生成的是拓扑整理图，布局可能与标准画法不同（界面已注明）。

import { el, text, fmtR } from './bench.js';
import { DEFS } from '../physics/components.js';

const GRID = 60;
const HL = 40; // 符号半长

export function renderSchematic(svg, bench, view) {
  svg.setAttribute('viewBox', '0 0 1600 1000');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.replaceChildren();
  if (!bench.components.length) {
    text(svg, '台面上还没有元件', { x: 800, y: 500, class: 'sch-label', 'font-size': 18, 'text-anchor': 'middle' });
    return;
  }

  // 1. 用导线把端子合并为等势组
  const parent = new Map();
  const key = (c, t) => `${c}:${t}`;
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => parent.set(find(a), find(b));
  for (const c of bench.components) for (const t of DEFS[c.type].terminals) parent.set(key(c.id, t), key(c.id, t));
  for (const w of bench.wires) {
    const a = key(w.a.comp, w.a.term), b = key(w.b.comp, w.b.term);
    if (parent.has(a) && parent.has(b)) union(a, b);
  }

  // 2. 组节点坐标：端子质心吸附到网格
  const groups = new Map(); // root -> { x, y, count }
  const acc = new Map();
  for (const c of bench.components) {
    for (const t of DEFS[c.type].terminals) {
      const root = find(key(c.id, t));
      const p = view.terminalPos(c.id, t);
      const a = acc.get(root) ?? { sx: 0, sy: 0, n: 0 };
      a.sx += p.x; a.sy += p.y; a.n++;
      acc.set(root, a);
    }
  }
  const used = new Set();
  for (const [root, a] of acc) {
    let gx = snapG(a.sx / a.n), gy = snapG(a.sy / a.n);
    gx = Math.min(1500, Math.max(100, gx));
    gy = Math.min(900, Math.max(120, gy));
    let guard = 0;
    while (used.has(`${gx},${gy}`) && guard++ < 12) gy = Math.min(900, gy + GRID);
    used.add(`${gx},${gy}`);
    groups.set(root, { x: gx, y: gy, count: 0 });
  }
  const pointOf = (c, t) => groups.get(find(key(c, t)));

  // 3. 元件符号与走线
  const wireLayer = el('g', {}, svg);
  const symLayer = el('g', {}, svg);
  const labelLayer = el('g', {}, svg);

  const connect = (P, ST, horizontal) => {
    const d = horizontal
      ? `M ${P.x} ${P.y} L ${P.x} ${ST.y} L ${ST.x} ${ST.y}`
      : `M ${P.x} ${P.y} L ${ST.x} ${P.y} L ${ST.x} ${ST.y}`;
    el('path', { d, class: 'sch-wire' }, wireLayer);
  };
  const bump = (P) => { const g = [...groups.values()].find(v => v.x === P.x && v.y === P.y); if (g) g.count++; };

  for (const comp of bench.components) {
    const def = DEFS[comp.type];
    const terms = def.terminals;

    if (terms.length === 2) {
      let P1 = pointOf(comp.id, terms[0]);
      let P2 = pointOf(comp.id, terms[1]);
      const sameNode = P1 === P2;
      if (sameNode) P2 = { x: P1.x, y: P1.y };
      const horizontal = sameNode ? true : Math.abs(P2.x - P1.x) >= Math.abs(P2.y - P1.y);
      const M = sameNode
        ? { x: P1.x, y: P1.y - 90 }
        : { x: snapG((P1.x + P2.x) / 2, 30), y: snapG((P1.y + P2.y) / 2, 30) };
      // A 侧（左/上）对应哪个端子
      let aTerm = terms[0], bTerm = terms[1], PA = P1, PB = P2;
      if (!sameNode) {
        const firstIsA = horizontal ? P1.x <= P2.x : P1.y <= P2.y;
        if (!firstIsA) { aTerm = terms[1]; bTerm = terms[0]; PA = P2; PB = P1; }
      }
      const g = el('g', { transform: `translate(${M.x}, ${M.y})${horizontal ? '' : ' rotate(90)'}` }, symLayer);
      drawSymbol(g, comp, aTerm);
      const STA = { x: M.x + (horizontal ? -HL : 0), y: M.y + (horizontal ? 0 : -HL) };
      const STB = { x: M.x + (horizontal ? HL : 0), y: M.y + (horizontal ? 0 : HL) };
      if (sameNode) {
        connect(PA, { x: STA.x, y: STA.y }, true);
        connect(PA, { x: STB.x, y: STB.y }, true);
        bump(PA);
      } else {
        connect(PA, STA, horizontal);
        connect(PB, STB, horizontal);
        bump(PA); bump(PB);
      }
      drawLabel(labelLayer, comp, M, horizontal ? 34 : 46);
    } else if (comp.type === 'rheostat') {
      const PA = pointOf(comp.id, 'a'), PB = pointOf(comp.id, 'b'), PC = pointOf(comp.id, 'c');
      const M = { x: snapG(comp.x + 130, 30), y: snapG(comp.y + 70, 30) };
      const g = el('g', { transform: `translate(${M.x}, ${M.y})` }, symLayer);
      drawRheostat(g);
      connect(PA, { x: M.x - 45, y: M.y }, true);
      connect(PB, { x: M.x + 45, y: M.y }, true);
      connect(PC, { x: M.x, y: M.y - 26 }, false);
      bump(PA); bump(PB); bump(PC);
      drawLabel(labelLayer, comp, M, 40);
    } else if (comp.type === 'spdt-switch') {
      const PC = pointOf(comp.id, 'com'), PX = pointOf(comp.id, 'x'), PY = pointOf(comp.id, 'y');
      const M = { x: snapG(comp.x + 105, 30), y: snapG(comp.y + 65, 30) };
      const g = el('g', { transform: `translate(${M.x}, ${M.y})` }, symLayer);
      drawSpdt(g, comp.params.position === 'y');
      connect(PC, { x: M.x - HL, y: M.y }, true);
      connect(PX, { x: M.x + HL, y: M.y - 16 }, true);
      connect(PY, { x: M.x + HL, y: M.y + 16 }, true);
      bump(PC); bump(PX); bump(PY);
      drawLabel(labelLayer, comp, M, 40);
    }
  }

  // 4. 三叉及以上节点：实心点
  for (const g of groups.values()) {
    if (g.count >= 3) el('circle', { cx: g.x, cy: g.y, r: 3.6, class: 'sch-junction' }, symLayer);
  }
}

function snapG(v, grid = GRID) { return Math.round(v / grid) * grid; }

// —— 标准符号绘制（教材画法；aTerm 为左侧/上侧对应的端子） ——
function drawSymbol(g, comp, aTerm) {
  const line = (x1, y1, x2, y2, extra = {}) => el('line', { x1, y1, x2, y2, class: 'sch-sym', ...extra }, g);
  const lead = () => { line(-HL, 0, -14, 0); line(14, 0, HL, 0); };
  const value = symbolValue(comp);

  switch (comp.type) {
    case 'student-supply': case 'battery-pack': case 'accumulator': {
      // 电池：左/右极板，+ 在 aTerm==='pos' 一侧
      const posLeft = aTerm === 'pos';
      const px = posLeft ? -8 : 8, nx = posLeft ? 8 : -8;
      line(-HL, 0, px, 0); line(nx, 0, HL, 0);
      line(px, -16, px, 16);                       // 长极板
      line(nx, -7, nx, 7, { 'stroke-width': 5 });  // 短极板
      text(g, '+', { x: px, y: -22, class: 'sch-label', 'font-size': 12 });
      text(g, '−', { x: nx, y: -22, class: 'sch-label', 'font-size': 12 });
      break;
    }
    case 'resistor': case 'resistance-box': case 'wire-board': {
      lead();
      el('rect', { x: -28, y: -9, width: 56, height: 18, class: 'sch-sym' }, g);
      break;
    }
    case 'bulb': case 'bulb-nl': {
      lead();
      el('circle', { cx: 0, cy: 0, r: 15, class: 'sch-sym' }, g);
      line(-10, -10, 10, 10); line(-10, 10, 10, -10);
      break;
    }
    case 'switch': {
      const closed = comp.params.closed;
      line(-HL, 0, -12, 0);
      el('circle', { cx: -12, cy: 0, r: 2.4, class: 'sch-fill' }, g);
      el('circle', { cx: 14, cy: 0, r: 2.4, class: 'sch-fill' }, g);
      line(14, 0, HL, 0);
      line(-12, 0, closed ? 14 : 12, closed ? 0 : -17);
      break;
    }
    case 'ammeter': case 'voltmeter': case 'galvanometer': {
      lead();
      el('circle', { cx: 0, cy: 0, r: 15, class: 'sch-sym' }, g);
      const letter = comp.type === 'ammeter' ? 'A' : comp.type === 'voltmeter' ? 'V' : 'G';
      text(g, letter, { x: 0, y: 5, class: 'sch-label', 'font-size': 14, 'text-anchor': 'middle' });
      if (aTerm === 'plus') text(g, '+', { x: -22, y: -18, class: 'sch-label' });
      else text(g, '+', { x: 22, y: -18, class: 'sch-label' });
      break;
    }
    case 'diode': case 'led': {
      // 阳极在 aTerm==='an' 一侧；三角指向阴极
      const flip = aTerm !== 'an';
      const sub = el('g', { transform: flip ? 'scale(-1, 1)' : '' }, g);
      line(-HL, 0, -10, 0, {}, ); line(10, 0, HL, 0);
      el('path', { d: 'M -10 -10 L -10 10 L 9 0 Z', class: 'sch-fill' }, sub);
      line(10, -11, 10, 11);
      if (comp.type === 'led') {
        line(2, -12, 10, -22); line(4, -20, 12, -14);
        line(10, -12, 18, -22); line(12, -20, 20, -14);
      }
      break;
    }
    case 'fuse': {
      lead();
      el('rect', { x: -14, y: -6, width: 28, height: 12, class: 'sch-sym' }, g);
      line(-28, 0, -14, 0); line(14, 0, 28, 0);
      break;
    }
    case 'bell': {
      lead();
      el('path', { d: 'M -14 4 A 14 14 0 0 1 14 4 Z', class: 'sch-sym' }, g);
      el('circle', { cx: 0, cy: 7, r: 2, class: 'sch-fill' }, g);
      break;
    }
    case 'motor': {
      lead();
      el('circle', { cx: 0, cy: 0, r: 15, class: 'sch-sym' }, g);
      text(g, 'M', { x: 0, y: 5, class: 'sch-label', 'font-size': 13, 'text-anchor': 'middle' });
      break;
    }
    default: {
      lead();
      el('rect', { x: -28, y: -9, width: 56, height: 18, class: 'sch-sym' }, g);
    }
  }
  void value;
}

function drawRheostat(g) {
  const line = (x1, y1, x2, y2, extra = {}) => el('line', { x1, y1, x2, y2, class: 'sch-sym', ...extra }, g);
  line(-HL, 0, -28, 0); line(28, 0, HL, 0);
  el('rect', { x: -28, y: -9, width: 56, height: 18, class: 'sch-sym' }, g);
  // 滑片箭头（指向电阻器）
  line(0, -26, 0, -10);
  el('path', { d: 'M -4 -12 L 0 -8 L 4 -12', fill: 'none', class: 'sch-sym' }, g);
  line(0, -26, 0, -26, {});
}

function drawSpdt(g, toY) {
  const line = (x1, y1, x2, y2, extra = {}) => el('line', { x1, y1, x2, y2, class: 'sch-sym', ...extra }, g);
  line(-HL, 0, -10, 0);
  el('circle', { cx: -10, cy: 0, r: 2.4, class: 'sch-fill' }, g);
  el('circle', { cx: HL, cy: -16, r: 2.4, class: 'sch-fill' }, g);
  el('circle', { cx: HL, cy: 16, r: 2.4, class: 'sch-fill' }, g);
  line(HL, -16, HL + 10, -16); line(HL, 16, HL + 10, 16);
  line(-10, 0, HL - 2, toY ? 14 : -14);
}

function symbolValue(comp) {
  const def = DEFS[comp.type];
  if (def.kind === 'source') return `${def.emf(comp.params).toFixed(1)} V`;
  switch (comp.type) {
    case 'resistor': return fmtR(comp.params.resistance);
    case 'resistance-box': return fmtR(comp.params.resistance);
    case 'rheostat': return `0–${comp.params.max} Ω`;
    case 'wire-board': return '电阻丝';
    case 'bulb': return `${comp.params.resistance} Ω`;
    case 'bulb-nl': return '非线性';
    case 'ammeter': case 'galvanometer': return `${comp.params.range} A`;
    case 'voltmeter': return `${comp.params.range} V`;
    case 'fuse': return `${comp.params.rating} A`;
    default: return '';
  }
}

function drawLabel(layer, comp, M, dy) {
  const def = DEFS[comp.type];
  const value = symbolValue(comp);
  const label = value ? `${def.label} ${value}` : def.label;
  text(layer, label, { x: M.x, y: M.y + dy, class: 'sch-label', 'text-anchor': 'middle' });
}
