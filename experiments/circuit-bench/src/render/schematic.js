// 电路图生成层：把实物台拓扑规整为标准电路图。
// 方法：导线合并等势组 → 组节点吸附到网格 → 元件符号按几何方向摆放 → 横平竖直走线。
// 生成的是拓扑整理图，布局可能与标准画法不同（界面已注明）。

import { el, text, fmtR } from './bench.js';
import { DEFS } from '../physics/components.js';

const GRID = 60;
const HL = 40; // 符号半长

export function renderSchematic(svg, bench, view, viewport) {
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
    // 节点占位冲突时优先横向挪（保持同一水平高度），其次下移，避免把节点顶到元件下方形成下垂绕线
    if (used.has(`${gx},${gy}`)) {
      const cand = [];
      for (let d = 1; d <= 6; d++) {
        cand.push([gx + d * GRID, gy], [gx - d * GRID, gy]);
        if (d <= 3) cand.push([gx, gy + d * GRID]);
      }
      const spot = cand.find(([x, y]) => x >= 100 && x <= 1500 && y <= 900 && !used.has(`${x},${y}`));
      if (spot) [gx, gy] = spot;
    }
    used.add(`${gx},${gy}`);
    groups.set(root, { x: gx, y: gy, count: 0 });
  }
  const pointOf = (c, t) => groups.get(find(key(c, t)));
  // 端子是否实际接了导线（未接线的端子不在电路图中引线）
  const isTermWired = (compId, term) => bench.wires.some(w =>
    (w.a.comp === compId && w.a.term === term) || (w.b.comp === compId && w.b.term === term));

  // 3. 元件符号与走线
  const wireLayer = el('g', {}, svg);
  const symLayer = el('g', {}, svg);
  const labelLayer = el('g', {}, svg);
  const placedM = []; // 已放置符号的中点，用于并联分支错位
  const placedBB = []; // 已放置符号的包围盒，用于走线避让（导线不能穿过符号）
  const placements = []; // 两端元件的引线归属，绘制前统一校正

  const connect = (P, ST, horizontal) => {
    const d = horizontal
      ? `M ${P.x} ${P.y} L ${P.x} ${ST.y} L ${ST.x} ${ST.y}`
      : `M ${P.x} ${P.y} L ${ST.x} ${P.y} L ${ST.x} ${ST.y}`;
    el('path', { d, class: 'sch-wire' }, wireLayer);
  };
  // 轴对齐线段是否穿过符号包围盒内部（端点所在的两个符号除外）
  const segHitsBB = (p, q, bb) => {
    const t = 2;
    if (p.y === q.y) return p.y > bb.y1 + t && p.y < bb.y2 - t && Math.max(Math.min(p.x, q.x), bb.x1 + t) < Math.min(Math.max(p.x, q.x), bb.x2 - t);
    if (p.x === q.x) return p.x > bb.x1 + t && p.x < bb.x2 - t && Math.max(Math.min(p.y, q.y), bb.y1 + t) < Math.min(Math.max(p.y, q.y), bb.y2 - t);
    return false;
  };
  const bump = (P) => { const g = [...groups.values()].find(v => v.x === P.x && v.y === P.y); if (g) g.count++; };
  // 连线请求先收集，最后再统一绘制：
  // 只有 2 个连接点的等势组（纯串联过路）直接画引线到引线，不绕行组节点，避免难看的下垂/绕线
  const reqs = new Map(); // root -> [{ st, h, sym, ex }]
  const rootOf = (c, t) => find(key(c, t));
  const addReq = (root, ST, horizontal, sym, exit = null) => {
    let list = reqs.get(root);
    if (!list) { list = []; reqs.set(root, list); }
    const r = { st: ST, h: horizontal, sym, ex: exit };
    list.push(r);
    return r;
  };
  // 符号占位防重叠：与已放符号距离过近时沿垂直（或水平）方向逐格错开
  const nudgeM = (base, horizontal = true) => {
    let M = base, shift = 0;
    while (placedM.some(q => Math.abs(q.x - M.x) < 30 && Math.abs(q.y - M.y) < 30) && shift < 8) {
      shift++;
      const k = Math.ceil(shift / 2) * GRID * (shift % 2 ? 1 : -1);
      M = { x: base.x + (horizontal ? 0 : k), y: base.y + (horizontal ? k : 0) };
    }
    return M;
  };
  // 登记符号包围盒并返回其索引（接线请求引用；走线避让时端点符号只豁免引线区、不豁免本体）
  const pushBB = (outer, body) => { placedBB.push({ o: outer, b: body ?? outer }); return placedBB.length - 1; };

  for (const comp of bench.components) {
    const def = DEFS[comp.type];
    let terms = def.terminals;

    // 三接线柱电表：电路图只画实际接入的两个端子（− 与已接的量程柱）
    if (def.kind === 'meter') {
      const isWired = (t) => bench.wires.some(w =>
        (w.a.comp === comp.id && w.a.term === t) || (w.b.comp === comp.id && w.b.term === t));
      const pos = isWired('low') ? 'low' : isWired('high') ? 'high' : 'low';
      terms = ['minus', pos];
    }

    if (terms.length === 2) {
      let P1 = pointOf(comp.id, terms[0]);
      let P2 = pointOf(comp.id, terms[1]);
      const sameNode = P1 === P2;
      if (sameNode) P2 = { x: P1.x, y: P1.y };
      const horizontal = sameNode ? true : Math.abs(P2.x - P1.x) >= Math.abs(P2.y - P1.y);
      const baseM = sameNode
        ? { x: P1.x, y: P1.y - 90 }
        : { x: snapG((P1.x + P2.x) / 2, 30), y: snapG((P1.y + P2.y) / 2, 30) };
      // 并联分支：同一对节点间的多个元件，符号沿垂直方向错开
      let M = baseM;
      if (!sameNode) M = nudgeM(baseM, horizontal);
      placedM.push(M);
      // A 侧（左/上）对应哪个端子
      let aTerm = terms[0], bTerm = terms[1], PA = P1, PB = P2;
      if (!sameNode) {
        const firstIsA = horizontal ? P1.x <= P2.x : P1.y <= P2.y;
        if (!firstIsA) { aTerm = terms[1]; bTerm = terms[0]; PA = P2; PB = P1; }
      }
      const g = el('g', { transform: `translate(${M.x}, ${M.y})${horizontal ? '' : ' rotate(90)'}` }, symLayer);
      drawSymbol(g, comp, aTerm, !horizontal);
      const sym = pushBB(
        horizontal
          ? { x1: M.x - HL - 8, y1: M.y - 26, x2: M.x + HL + 8, y2: M.y + 26 }
          : { x1: M.x - 26, y1: M.y - HL - 8, x2: M.x + 26, y2: M.y + HL + 8 },
        horizontal
          ? { x1: M.x - 22, y1: M.y - 17, x2: M.x + 22, y2: M.y + 17 }
          : { x1: M.x - 17, y1: M.y - 22, x2: M.x + 17, y2: M.y + 22 });
      const STA = { x: M.x + (horizontal ? -HL : 0), y: M.y + (horizontal ? 0 : -HL) };
      const STB = { x: M.x + (horizontal ? HL : 0), y: M.y + (horizontal ? 0 : HL) };
      if (sameNode) {
        addReq(rootOf(comp.id, aTerm), STA, true, sym);
        addReq(rootOf(comp.id, aTerm), STB, true, sym);
        bump(PA); bump(PA);
      } else {
        const rA = addReq(rootOf(comp.id, aTerm), STA, horizontal, sym);
        const rB = addReq(rootOf(comp.id, bTerm), STB, horizontal, sym);
        placements.push({ comp, g, sym, aTerm, bTerm, rA, rB, horizontal });
        bump(PA); bump(PB);
      }
      drawLabel(labelLayer, comp, M, horizontal ? 34 : 46);
    } else if (comp.type === 'rheostat') {
      const PA = pointOf(comp.id, 'a'), PB = pointOf(comp.id, 'b'), PC = pointOf(comp.id, 'c');
      const M = nudgeM({ x: snapG(comp.x + 130, 30), y: snapG(comp.y + 70, 30) }, true);
      placedM.push(M);
      // 滑片朝向 c 节点一侧，避免连线穿过电阻体
      const flipY = isTermWired(comp.id, 'c') && PC.y > M.y;
      const g = el('g', { transform: `translate(${M.x}, ${M.y})${flipY ? ' scale(1, -1)' : ''}` }, symLayer);
      drawRheostat(g);
      const sym = pushBB({ x1: M.x - HL - 8, y1: M.y - (flipY ? 16 : 32), x2: M.x + HL + 8, y2: M.y + (flipY ? 32 : 16) },
        { x1: M.x - 30, y1: M.y - 11, x2: M.x + 30, y2: M.y + 11 });
      // 只画实际接线的端子连线，未接线的端子不引出悬空线
      if (isTermWired(comp.id, 'a')) { addReq(rootOf(comp.id, 'a'), { x: M.x - HL, y: M.y }, true, sym); bump(PA); }
      if (isTermWired(comp.id, 'b')) { addReq(rootOf(comp.id, 'b'), { x: M.x + HL, y: M.y }, true, sym); bump(PB); }
      if (isTermWired(comp.id, 'c')) { addReq(rootOf(comp.id, 'c'), { x: M.x, y: M.y + (flipY ? 26 : -26) }, false, sym, { dx: 0, dy: flipY ? 26 : -26 }); bump(PC); }
      drawLabel(labelLayer, comp, M, 40);
    } else if (comp.type === 'spdt-switch') {
      const PC = pointOf(comp.id, 'com'), PX = pointOf(comp.id, 'x'), PY = pointOf(comp.id, 'y');
      // 符号放在 com 节点与 x/y 节点之间的连线上，并按节点方位镜像：
      // com 朝自己的节点一侧，x/y 触点朝对方开关一侧，x 触点尽量与 x 节点同侧
      const midXY = { x: (PX.x + PY.x) / 2, y: (PX.y + PY.y) / 2 };
      const M = nudgeM({ x: snapG((PC.x + midXY.x) / 2, 30), y: snapG((PC.y + midXY.y) / 2, 30) }, true);
      placedM.push(M);
      const flipX = PC.x > midXY.x;
      const flipY = PX.y > PY.y;
      const g = el('g', { transform: `translate(${M.x}, ${M.y}) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }, symLayer);
      drawSpdt(g, comp.params.position === 'y');
      const sym = pushBB({ x1: M.x - HL - 16, y1: M.y - 26, x2: M.x + HL + 16, y2: M.y + 26 },
        { x1: M.x - 16, y1: M.y - 18, x2: M.x + 16, y2: M.y + 18 });
      const cx = flipX ? HL : -HL;
      const tx = flipX ? -HL : HL;
      const ty = flipY ? 16 : -16;
      // 引线先向符号外侧水平引出一小段，避免导线贴着刀口/触点穿回符号区域
      const exC = { dx: Math.sign(cx) * 26, dy: 0 }, exT = { dx: Math.sign(tx) * 26, dy: 0 };
      if (isTermWired(comp.id, 'com')) { addReq(rootOf(comp.id, 'com'), { x: M.x + cx, y: M.y }, true, sym, exC); bump(PC); }
      if (isTermWired(comp.id, 'x')) { addReq(rootOf(comp.id, 'x'), { x: M.x + tx, y: M.y + ty }, true, sym, exT); bump(PX); }
      if (isTermWired(comp.id, 'y')) { addReq(rootOf(comp.id, 'y'), { x: M.x + tx, y: M.y - ty }, true, sym, exT); bump(PY); }
      drawLabel(labelLayer, comp, M, 40);
    }
  }

  // 端子方位校正：两端元件若交换左/右（上/下）引线归属能减少穿符号，则交换并重画符号
  const cornerScore = (A, B, owners, corner) => placedBB.reduce((n, bb, i) => {
    const box = owners.includes(i) ? bb.b : bb.o;
    return n + (segHitsBB(A, corner, box) ? 1 : 0) + (segHitsBB(corner, B, box) ? 1 : 0);
  }, 0);
  const minHits = (A, B, owners) => Math.min(
    cornerScore(A, B, owners, { x: A.x, y: B.y }),
    cornerScore(A, B, owners, { x: B.x, y: A.y }));
  const counterOf = (req, root) => {
    const others = reqs.get(root).filter(r => r !== req);
    if (others.length === 1) return { st: others[0].st, sym: others[0].sym };
    const g = groups.get(root);
    return { st: { x: g.x, y: g.y }, sym: -1 };
  };
  for (const p of placements) {
    const rootA = rootOf(p.comp.id, p.aTerm), rootB = rootOf(p.comp.id, p.bTerm);
    const cA = counterOf(p.rA, rootA), cB = counterOf(p.rB, rootB);
    const cur = minHits(p.rA.st, cA.st, [p.sym, cA.sym]) + minHits(p.rB.st, cB.st, [p.sym, cB.sym]);
    const swp = minHits(p.rB.st, cA.st, [p.sym, cA.sym]) + minHits(p.rA.st, cB.st, [p.sym, cB.sym]);
    if (swp < cur) {
      const st = p.rA.st; p.rA.st = p.rB.st; p.rB.st = st;
      p.g.replaceChildren();
      drawSymbol(p.g, p.comp, p.bTerm, !p.horizontal); // 交换后 bTerm 位于 A 侧（左/上）
    }
  }

  // 统一绘制连线：2 连接点的组直连引线，3 个及以上的组走星形到组节点（节点处画接点）
  // L 形拐角选择：优先不穿过任何符号（端点自身符号只豁免引线区，不豁免本体）
  const drawSeg = (P, Q) => el('path', { d: `M ${P.x} ${P.y} L ${Q.x} ${Q.y}`, class: 'sch-wire' }, wireLayer);
  const withExit = (r) => r.ex ? { x: r.st.x + r.ex.dx, y: r.st.y + r.ex.dy } : r.st;
  const route = (P, ST, owners, preferH = null) => {
    const hH = cornerScore(P, ST, owners, { x: P.x, y: ST.y });
    const hV = cornerScore(P, ST, owners, { x: ST.x, y: P.y });
    const horiz = hH < hV ? true : hH > hV ? false
      : (preferH ?? (Math.abs(ST.x - P.x) >= Math.abs(ST.y - P.y)));
    connect(P, ST, horiz);
  };
  for (const [root, list] of reqs) {
    if (list.length === 2) {
      const [r1, r2] = list;
      if (r1.sym === r2.sym && !r1.ex && !r2.ex) {
        // 元件两端被同一节点短接：短接线绕到符号外侧（U 形），不穿过本体
        const M = { x: (r1.st.x + r2.st.x) / 2, y: (r1.st.y + r2.st.y) / 2 };
        const scoreU = (yy) => placedBB.reduce((n, bb) => n +
          (segHitsBB(r1.st, { x: r1.st.x, y: yy }, bb.o) ? 1 : 0) +
          (segHitsBB({ x: r1.st.x, y: yy }, { x: r2.st.x, y: yy }, bb.o) ? 1 : 0) +
          (segHitsBB({ x: r2.st.x, y: yy }, r2.st, bb.o) ? 1 : 0), 0);
        const yy = scoreU(M.y - 70) <= scoreU(M.y + 70) ? M.y - 70 : M.y + 70;
        el('path', { d: `M ${r1.st.x} ${r1.st.y} L ${r1.st.x} ${yy} L ${r2.st.x} ${yy} L ${r2.st.x} ${r2.st.y}`, class: 'sch-wire' }, wireLayer);
      } else {
        const E1 = withExit(r1), E2 = withExit(r2);
        route(E1, E2, [r1.sym, r2.sym]);
        if (E1 !== r1.st) drawSeg(r1.st, E1);
        if (E2 !== r2.st) drawSeg(r2.st, E2);
      }
    } else {
      const g = groups.get(root);
      for (const r of list) {
        const E = withExit(r);
        route(g, E, [r.sym], r.h);
        if (E !== r.st) drawSeg(E, r.st);
      }
    }
  }

  // 4. 三叉及以上节点：实心点
  for (const g of groups.values()) {
    if (g.count >= 3) el('circle', { cx: g.x, cy: g.y, r: 3.6, class: 'sch-junction' }, symLayer);
  }

  // 5. 自适应取景：按实际内容收紧 viewBox，并把内容限定在未被面板遮挡的可视区内
  try {
    const bb = svg.getBBox();
    if (bb.width > 10 && bb.height > 10) {
      const m = 56;
      const W = svg.clientWidth || 1600, H = svg.clientHeight || 1000;
      const vp = viewport || { L: 0, T: 0, R: W, B: H };
      const availW = Math.max(vp.R - vp.L, 240), availH = Math.max(vp.B - vp.T, 200);
      // 缩放比 s：内容恰好放进可视区；同时限制放大上限，小电路的符号不至于过大
      const s = Math.min(availW / (bb.width + 2 * m), availH / (bb.height + 2 * m), W / 560, H / 400);
      const vw = W / s, vh = H / s;
      // preserveAspectRatio="xMidYMid meet" 下 viewBox 恰好铺满 SVG，把内容中心对齐可视区中心
      const vx = bb.x + bb.width / 2 - (vp.L + vp.R) / 2 / s;
      const vy = bb.y + bb.height / 2 - (vp.T + vp.B) / 2 / s;
      svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
      // 取景缩小后文字等比缩回，保持屏幕上的字号稳定（内联样式才能压过 CSS 类规则）
      const fs = vw / 1600;
      if (fs < 0.98) {
        for (const t of svg.querySelectorAll('.sch-label')) {
          const base = parseFloat(t.getAttribute('font-size')) || 10;
          t.style.fontSize = `${(base * fs).toFixed(1)}px`;
        }
      }
    }
  } catch { /* getBBox 不可用时保留默认取景 */ }
}

function snapG(v, grid = GRID) { return Math.round(v / grid) * grid; }

// —— 标准符号绘制（教材画法；aTerm 为左侧/上侧对应的端子） ——
// uprightText：符号整体被 rotate(90) 放竖时，把文字反向转回，保持字母与 +/− 标记正立
function drawSymbol(g, comp, aTerm, uprightText = false) {
  const line = (x1, y1, x2, y2, extra = {}) => el('line', { x1, y1, x2, y2, class: 'sch-sym', ...extra }, g);
  const lead = () => { line(-HL, 0, -14, 0); line(14, 0, HL, 0); };
  const glyph = (s, attrs) => {
    const t = text(g, s, attrs);
    if (uprightText) t.setAttribute('transform', `rotate(-90 ${attrs.x} ${attrs.y})`);
    return t;
  };
  const value = symbolValue(comp);

  switch (comp.type) {
    case 'student-supply': case 'battery-pack': case 'accumulator': {
      // 电池：左/右极板，+ 在 aTerm==='pos' 一侧
      const posLeft = aTerm === 'pos';
      const px = posLeft ? -8 : 8, nx = posLeft ? 8 : -8;
      line(-HL, 0, px, 0); line(nx, 0, HL, 0);
      line(px, -16, px, 16);                       // 长极板
      line(nx, -7, nx, 7, { 'stroke-width': 5 });  // 短极板
      glyph('+', { x: px, y: -22, class: 'sch-label', 'font-size': 12 });
      glyph('−', { x: nx, y: -22, class: 'sch-label', 'font-size': 12 });
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
      glyph(letter, { x: 0, y: 5, class: 'sch-label', 'font-size': 14, 'text-anchor': 'middle' });
      // “+” 标在量程接线柱（非 − 柱）一侧
      if (aTerm !== 'minus') glyph('+', { x: -22, y: -18, class: 'sch-label' });
      else glyph('+', { x: 22, y: -18, class: 'sch-label' });
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
      glyph('M', { x: 0, y: 5, class: 'sch-label', 'font-size': 13, 'text-anchor': 'middle' });
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
