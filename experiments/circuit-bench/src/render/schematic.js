// 电路图生成层：把实物台拓扑规整为标准电路图。
// 方法：导线合并等势组 → 组节点吸附到网格 → 元件符号按几何方向摆放 → 横平竖直走线。
// 生成的是拓扑整理图，布局可能与标准画法不同（界面已注明）。

import { el, text, fmtR } from './bench.js';
import { DEFS } from '../physics/components.js';

const GRID = 60;
const HL = 40; // 符号半长

export function renderSchematic(svg, bench, view, viewport, results) {
  svg.setAttribute('viewBox', '0 0 1600 1000');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.replaceChildren();
  if (!bench.components.length) {
    text(svg, '台面上还没有元件', { x: 800, y: 500, class: 'sch-label', 'font-size': 18, 'text-anchor': 'middle' });
    return { flowLinks: [], flowLayer: null };
  }

  // 各端子「流入元件」的电流：求解结果的导线电流 I 正方向为 a→b，则 a 端流出（−I）、b 端流入（+I）。
  // 流向动画以此为每段引线定向定大小（KCL：同一等势组各端子流入之和为 0）。
  const termIn = new Map();
  if (results?.ok && results.wires) {
    for (const w of bench.wires) {
      const r = results.wires.get(w.id);
      if (!r) continue;
      const ka = `${w.a.comp}:${w.a.term}`, kb = `${w.b.comp}:${w.b.term}`;
      termIn.set(ka, (termIn.get(ka) ?? 0) - r.I);
      termIn.set(kb, (termIn.get(kb) ?? 0) + r.I);
    }
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

  // 每个等势组的接线点数（2 = 串联过路；≥3 = 分叉节点）
  const connCount = new Map();
  for (const c of bench.components) {
    const def = DEFS[c.type];
    let ts = def.terminals;
    if (def.kind === 'meter') {
      ts = ['minus', isTermWired(c.id, 'low') ? 'low' : isTermWired(c.id, 'high') ? 'high' : 'low'];
    } else if (c.type === 'rheostat' || c.type === 'spdt-switch') {
      ts = ts.filter(t => isTermWired(c.id, t));
    }
    for (const t of ts) {
      const r = find(key(c.id, t));
      connCount.set(r, (connCount.get(r) ?? 0) + 1);
    }
  }

  // 串联共线：被「2 点组」串起来的两端元件，符号尽量摆在同一条水平/竖直线上，
  // 让组内走线退化成一条直线，消除成排的 L 形拐角（对齐幅度限制在一格以内，
  // 偏差太大说明实物摆位本身错落，保留 L 形更真实）
  const twoTermInfo = new Map(); // compId -> { rootA, rootB, horizontal, baseM }
  for (const c of bench.components) {
    const def = DEFS[c.type];
    let ts = def.terminals;
    if (def.kind === 'meter') {
      ts = ['minus', isTermWired(c.id, 'low') ? 'low' : isTermWired(c.id, 'high') ? 'high' : 'low'];
    }
    if (ts.length !== 2 || c.type === 'rheostat' || c.type === 'spdt-switch') continue;
    const rA = find(key(c.id, ts[0])), rB = find(key(c.id, ts[1]));
    if (rA === rB) continue;
    const P1 = pointOf(c.id, ts[0]), P2 = pointOf(c.id, ts[1]);
    twoTermInfo.set(c.id, {
      rootA: rA, rootB: rB,
      horizontal: Math.abs(P2.x - P1.x) >= Math.abs(P2.y - P1.y),
      baseM: { x: snapG((P1.x + P2.x) / 2, 30), y: snapG((P1.y + P2.y) / 2, 30) }
    });
  }
  const rootComps = new Map(); // root -> [compId]（仅电路图中按两端处理的元件）
  for (const [id, info] of twoTermInfo) {
    for (const r of [info.rootA, info.rootB]) {
      const l = rootComps.get(r) ?? []; l.push(id); rootComps.set(r, l);
    }
  }
  const aligned = new Map(); // compId -> { horizontal, coord }
  // 串联对共线：由「2 点组」直接相连的两个两端元件，若符号基本在同一水平/竖直线附近
  // （偏差 ≤ 1 格），把两者对齐到同一直线，组内走线退化成一条直线，消除小台阶。
  // 只微调相邻元件对，不做整链对齐——避免把回路首尾拉到同一直线上造成跨元件穿线。
  const pairs = [];
  for (const [r, ids] of rootComps) {
    if ((connCount.get(r) ?? 0) !== 2 || ids.length !== 2) continue;
    const A = twoTermInfo.get(ids[0]), B = twoTermInfo.get(ids[1]);
    if (A.horizontal !== B.horizontal) continue;
    const horiz = A.horizontal;
    const ca = horiz ? A.baseM.y : A.baseM.x;
    const cb = horiz ? B.baseM.y : B.baseM.x;
    const d = Math.abs(ca - cb);
    if (d > GRID) continue;
    pairs.push({ a: ids[0], b: ids[1], horiz, coord: snapG((ca + cb) / 2, 30), d });
  }
  // 偏差小的对优先；一个元件只参与一次对齐，避免多对拉扯
  pairs.sort((p, q) => p.d - q.d);
  for (const p of pairs) {
    if (aligned.has(p.a) || aligned.has(p.b)) continue;
    aligned.set(p.a, { horizontal: p.horiz, coord: p.coord });
    aligned.set(p.b, { horizontal: p.horiz, coord: p.coord });
  }

  // 3. 元件符号与走线
  const wireLayer = el('g', {}, svg);
  const symLayer = el('g', {}, svg);
  const labelLayer = el('g', {}, svg);
  const placedM = []; // 已放置符号的中点，用于并联分支错位
  const placedBB = []; // 已放置符号的包围盒，用于走线避让（导线不能穿过符号）
  const placements = []; // 两端元件的引线归属，绘制前统一校正
  const drawnSegs = []; // 已绘导线线段（供标签避让检测）
  const labels = [];    // 已绘标签（元件名/参数），绘制后统一做导线避让

  const connect = (P, ST, horizontal) => {
    const d = horizontal
      ? `M ${P.x} ${P.y} L ${P.x} ${ST.y} L ${ST.x} ${ST.y}`
      : `M ${P.x} ${P.y} L ${ST.x} ${P.y} L ${ST.x} ${ST.y}`;
    el('path', { d, class: 'sch-wire' }, wireLayer);
    const corner = horizontal ? { x: P.x, y: ST.y } : { x: ST.x, y: P.y };
    drawnSegs.push([P, corner], [corner, ST]);
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
  const reqs = new Map(); // root -> [{ st, h, sym, ex, compId, term }]
  const rootOf = (c, t) => find(key(c, t));
  const addReq = (root, ST, horizontal, sym, exit = null, compId = null, term = null) => {
    let list = reqs.get(root);
    if (!list) { list = []; reqs.set(root, list); }
    const r = { st: ST, h: horizontal, sym, ex: exit, compId, term };
    list.push(r);
    return r;
  };
  // 端子处「流入元件」电流（流向动画用）
  const inAt = (r) => (r.compId ? termIn.get(`${r.compId}:${r.term}`) : 0) ?? 0;
  // 折线路径（供流向动画跟踪），去掉相邻重复点
  const polyD = (pts) => {
    const clean = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
    return 'M ' + clean.map(p => `${p.x} ${p.y}`).join(' L ');
  };
  // 流向路径收集：可见导线段（绘制循环追加）+ 穿过元件本体的段（元件循环追加）
  const flowLinks = [];
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
      // 串联链共线：同链元件符号对齐到同一坐标，组内走线拉成直线
      let M = baseM;
      const al = !sameNode && aligned.get(comp.id);
      if (al && al.horizontal === horizontal) {
        M = horizontal ? { x: baseM.x, y: al.coord } : { x: al.coord, y: baseM.y };
      }
      // 并联分支：同一对节点间的多个元件，符号沿垂直方向错开
      if (!sameNode) M = nudgeM(M, horizontal);
      placedM.push(M);
      // A 侧（左/上）对应哪个端子
      let aTerm = terms[0], bTerm = terms[1], PA = P1, PB = P2;
      if (!sameNode) {
        const firstIsA = horizontal ? P1.x <= P2.x : P1.y <= P2.y;
        if (!firstIsA) { aTerm = terms[1]; bTerm = terms[0]; PA = P2; PB = P1; }
      }
      const g = el('g', { transform: `translate(${M.x}, ${M.y})${horizontal ? '' : ' rotate(90)'}` }, symLayer);
      // 引线长度：接线节点比 HL 更近时（如并联支路）缩短引线，让引线尖端恰好落在节点上，
      // 避免导线伸进引线区、避免节点外留下出头线段
      const bodyH = BODY_HALF[comp.type] ?? 15;
      const gapA = sameNode ? HL : (horizontal ? Math.abs(PA.x - M.x) : Math.abs(PA.y - M.y));
      const gapB = sameNode ? HL : (horizontal ? Math.abs(PB.x - M.x) : Math.abs(PB.y - M.y));
      const leadA = Math.max(bodyH + 2, Math.min(HL, gapA));
      const leadB = Math.max(bodyH + 2, Math.min(HL, gapB));
      const internalPath = drawSymbol(g, comp, aTerm, !horizontal, leadA, leadB);
      const sym = pushBB(
        horizontal
          ? { x1: M.x - HL - 8, y1: M.y - 26, x2: M.x + HL + 8, y2: M.y + 26 }
          : { x1: M.x - 26, y1: M.y - HL - 8, x2: M.x + 26, y2: M.y + HL + 8 },
        horizontal
          ? { x1: M.x - 22, y1: M.y - 17, x2: M.x + 22, y2: M.y + 17 }
          : { x1: M.x - 17, y1: M.y - 22, x2: M.x + 17, y2: M.y + 22 });
      const STA = { x: M.x + (horizontal ? -leadA : 0), y: M.y + (horizontal ? 0 : -leadA) };
      const STB = { x: M.x + (horizontal ? leadB : 0), y: M.y + (horizontal ? 0 : leadB) };
      // 穿过元件本体的流向路径：电流从 aTerm 引线进、bTerm 引线出；
      // 符号有内部绕行路径（如电铃沿短柱上铃罩）时沿内部路径走
      const loc = ([lx, ly]) => horizontal ? { x: M.x + lx, y: M.y + ly } : { x: M.x - ly, y: M.y + lx };
      const bodyFlow = { d: polyD([STA, ...(internalPath ?? []).map(loc), STB]), I: inAt({ compId: comp.id, term: aTerm }) };
      flowLinks.push(bodyFlow);
      if (sameNode) {
        addReq(rootOf(comp.id, aTerm), STA, true, sym, null, comp.id, aTerm);
        addReq(rootOf(comp.id, aTerm), STB, true, sym, null, comp.id, bTerm);
        bump(PA); bump(PA);
      } else {
        const rA = addReq(rootOf(comp.id, aTerm), STA, horizontal, sym, null, comp.id, aTerm);
        const rB = addReq(rootOf(comp.id, bTerm), STB, horizontal, sym, null, comp.id, bTerm);
        placements.push({ comp, g, sym, aTerm, bTerm, rA, rB, horizontal, leadA, leadB, bodyFlow });
        bump(PA); bump(PB);
      }
      drawLabel(labelLayer, comp, M, horizontal ? 34 : 46, labels);
    } else if (comp.type === 'rheostat') {
      const PA = pointOf(comp.id, 'a'), PB = pointOf(comp.id, 'b'), PC = pointOf(comp.id, 'c');
      const M = nudgeM({ x: snapG(comp.x + 130, 30), y: snapG(comp.y + 70, 30) }, true);
      placedM.push(M);
      // 人教版标准画法：滑杆固定在电阻丝上方，不随节点方位镜像；c 从滑杆靠节点的一端引出，
      // 节点在下方时由走线自己折下去，符号本体始终保持正向
      const wiredC = isTermWired(comp.id, 'c');
      const cLeft = wiredC && PC.x < M.x;
      const g = el('g', { transform: `translate(${M.x}, ${M.y})` }, symLayer);
      drawRheostat(g, comp, wiredC ? cLeft : null);
      const sym = pushBB({ x1: M.x - HL - 8, y1: M.y - 34, x2: M.x + HL + 8, y2: M.y + 14 },
        { x1: M.x - 30, y1: M.y - 26, x2: M.x + 30, y2: M.y + 11 });
      // 只画实际接线的端子连线，未接线的端子不引出悬空线
      if (isTermWired(comp.id, 'a')) { addReq(rootOf(comp.id, 'a'), { x: M.x - HL, y: M.y }, true, sym, null, comp.id, 'a'); bump(PA); }
      if (isTermWired(comp.id, 'b')) { addReq(rootOf(comp.id, 'b'), { x: M.x + HL, y: M.y }, true, sym, null, comp.id, 'b'); bump(PB); }
      if (wiredC) { addReq(rootOf(comp.id, 'c'), { x: M.x + (cLeft ? -HL : HL), y: M.y - 22 }, true, sym, null, comp.id, 'c'); bump(PC); }
      // 流向路径：沿电阻丝到滑片、再沿滑杆到 c 端；未接 c 时电流贯穿整根电阻丝
      const tInR = (t) => termIn.get(`${comp.id}:${t}`) ?? 0;
      const slx = M.x - 28 + 56 * Math.max(0, Math.min(1, comp.params.x ?? 0.5));
      const rodY = M.y - 22;
      if (wiredC) {
        flowLinks.push({ d: polyD([{ x: M.x - HL, y: M.y }, { x: slx, y: M.y }]), I: tInR('a') });
        flowLinks.push({ d: polyD([{ x: M.x + HL, y: M.y }, { x: slx, y: M.y }]), I: tInR('b') });
        flowLinks.push({ d: polyD([{ x: slx, y: M.y }, { x: slx, y: rodY }, { x: M.x + (cLeft ? -HL : HL), y: rodY }]), I: -tInR('c') });
      } else {
        flowLinks.push({ d: polyD([{ x: M.x - HL, y: M.y }, { x: M.x + HL, y: M.y }]), I: tInR('a') });
      }
      drawLabel(labelLayer, comp, M, 44, labels);
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
      if (isTermWired(comp.id, 'com')) { addReq(rootOf(comp.id, 'com'), { x: M.x + cx, y: M.y }, true, sym, exC, comp.id, 'com'); bump(PC); }
      if (isTermWired(comp.id, 'x')) { addReq(rootOf(comp.id, 'x'), { x: M.x + tx, y: M.y + ty }, true, sym, exT, comp.id, 'x'); bump(PX); }
      if (isTermWired(comp.id, 'y')) { addReq(rootOf(comp.id, 'y'), { x: M.x + tx, y: M.y - ty }, true, sym, exT, comp.id, 'y'); bump(PY); }
      // 流向路径：com → 刀口 → 当前合上的触点（未合上的触点电流为 0，不显示）
      const tInS = (t) => termIn.get(`${comp.id}:${t}`) ?? 0;
      flowLinks.push({ d: polyD([{ x: M.x + cx, y: M.y }, { x: M.x, y: M.y }]), I: tInS('com') });
      flowLinks.push({ d: polyD([{ x: M.x, y: M.y }, { x: M.x + tx, y: M.y + ty }]), I: -tInS('x') });
      flowLinks.push({ d: polyD([{ x: M.x, y: M.y }, { x: M.x + tx, y: M.y - ty }]), I: -tInS('y') });
      drawLabel(labelLayer, comp, M, 40, labels);
    }
  }

  // 端子方位校正：两端元件若交换左/右（上/下）引线归属能减少穿符号，则交换并重画符号
  // 拐角代价：穿过任何符号本体（内框）重罚 100，仅擦过非端点符号外框（引线区）罚 1，
  // 避免「擦球而过」与「穿心而过」被判同分，导致走线穿过元件本体
  const cornerScore = (A, B, owners, corner) => placedBB.reduce((n, bb, i) => {
    const own = owners.includes(i);
    const body = segHitsBB(A, corner, bb.b) ? 1 : 0;
    const outer = !own && segHitsBB(A, corner, bb.o) ? 1 : 0;
    const body2 = segHitsBB(corner, B, bb.b) ? 1 : 0;
    const outer2 = !own && segHitsBB(corner, B, bb.o) ? 1 : 0;
    return n + (body + body2) * 100 + outer + outer2;
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
      drawSymbol(p.g, p.comp, p.bTerm, !p.horizontal, p.leadB, p.leadA); // 交换后 bTerm 位于 A 侧（左/上），引线长度随侧交换
      p.bodyFlow.I = -p.bodyFlow.I; // 端子归属换侧，穿过本体的流向同步取反
    }
  }

  // 星形节点对齐：组节点向辐条引线的轴线靠拢（±24 内），对应辐条从 L 形拉成一条直线
  for (const [root, list] of reqs) {
    if (list.length < 3) continue;
    const g = groups.get(root);
    const straighten = (vals, cur) => {
      let best = cur, bestN = vals.filter(v => v === cur).length;
      for (const v of vals) {
        if (Math.abs(v - cur) > 24) continue;
        const n = vals.filter(x => x === v).length;
        if (n > bestN) { bestN = n; best = v; }
      }
      return best;
    };
    const ny = straighten(list.filter(r => r.h).map(r => (r.ex ? r.st.y + r.ex.dy : r.st.y)), g.y);
    const nx = straighten(list.filter(r => !r.h).map(r => (r.ex ? r.st.x + r.ex.dx : r.st.x)), g.x);
    if ((nx !== g.x || ny !== g.y) && !used.has(`${nx},${ny}`)) {
      used.delete(`${g.x},${g.y}`);
      g.x = nx; g.y = ny;
      used.add(`${nx},${ny}`);
    }
  }

  // 统一绘制连线：2 连接点的组直连引线，3 个及以上的组走星形到组节点（节点处画接点）
  // L 形拐角选择：优先不穿过任何符号（端点自身符号只豁免引线区，不豁免本体）
  const drawSeg = (P, Q) => {
    el('path', { d: `M ${P.x} ${P.y} L ${Q.x} ${Q.y}`, class: 'sch-wire' }, wireLayer);
    drawnSegs.push([P, Q]);
  };
  const withExit = (r) => r.ex ? { x: r.st.x + r.ex.dx, y: r.st.y + r.ex.dy } : r.st;
  const route = (P, ST, owners, preferH = null) => {
    const hH = cornerScore(P, ST, owners, { x: P.x, y: ST.y });
    const hV = cornerScore(P, ST, owners, { x: ST.x, y: P.y });
    const horiz = hH < hV ? true : hH > hV ? false
      : (preferH ?? (Math.abs(ST.x - P.x) >= Math.abs(ST.y - P.y)));
    connect(P, ST, horiz);
    return horiz ? { x: P.x, y: ST.y } : { x: ST.x, y: P.y }; // L 形拐角点
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
        const d = `M ${r1.st.x} ${r1.st.y} L ${r1.st.x} ${yy} L ${r2.st.x} ${yy} L ${r2.st.x} ${r2.st.y}`;
        el('path', { d, class: 'sch-wire' }, wireLayer);
        drawnSegs.push([r1.st, { x: r1.st.x, y: yy }], [{ x: r1.st.x, y: yy }, { x: r2.st.x, y: yy }], [{ x: r2.st.x, y: yy }, r2.st]);
        flowLinks.push({ d, I: inAt(r2) });
      } else {
        const E1 = withExit(r1), E2 = withExit(r2);
        const corner = route(E1, E2, [r1.sym, r2.sym]);
        if (E1 !== r1.st) drawSeg(r1.st, E1);
        if (E2 !== r2.st) drawSeg(r2.st, E2);
        // 画线方向 r1 → r2；流入 r2 端子的电流即沿此方向
        flowLinks.push({ d: polyD([r1.st, E1, corner, E2, r2.st]), I: inAt(r2) });
      }
    } else {
      const g = groups.get(root);
      for (const r of list) {
        const E = withExit(r);
        const corner = route(g, E, [r.sym], r.h);
        if (E !== r.st) drawSeg(E, r.st);
        // 星形辐条画线方向 端子 → 组节点；流入元件的电流与此相反
        flowLinks.push({ d: polyD([r.st, E, corner, { x: g.x, y: g.y }]), I: -inAt(r) });
      }
    }
  }

  // 4. 三叉及以上节点：实心点
  for (const g of groups.values()) {
    if (g.count >= 3) el('circle', { cx: g.x, cy: g.y, r: 3.6, class: 'sch-junction' }, symLayer);
  }

  // 4b. 标签避让：标签被导线穿过时翻到符号另一侧；仍被撞再外移半格（极少数情况接受残留）
  for (const { t, M, dy } of labels) {
    try {
      const pad = 3;
      let bb = t.getBBox();
      const hit = () => drawnSegs.some(([p, q]) =>
        segHitsBB(p, q, { x1: bb.x - pad, y1: bb.y - pad, x2: bb.x + bb.width + pad, y2: bb.y + bb.height + pad }));
      if (!hit()) continue;
      t.setAttribute('y', M.y - dy);
      bb = t.getBBox();
      if (hit()) t.setAttribute('y', M.y - dy - GRID / 2);
    } catch { /* getBBox 不可用时保持原位 */ }
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

  // 6. 流向动画层：最顶层，路径与可见导线重合（由 app.js 的 FlowView 填充）
  const flowLayer = el('g', { class: 'sch-flow-layer' }, svg);
  return { flowLinks, flowLayer };
}

function snapG(v, grid = GRID) { return Math.round(v / grid) * grid; }

// 符号本体沿轴线方向的半长：引线缩短时的下限，保证引线不缩进本体内部
const BODY_HALF = {
  'student-supply': 8, 'battery-pack': 8, accumulator: 8, switch: 15,
  resistor: 28, 'resistance-box': 28, 'wire-board': 28,
  bulb: 15, 'bulb-nl': 15, ammeter: 15, voltmeter: 15, galvanometer: 15,
  diode: 11, led: 11, fuse: 14, bell: 14, motor: 15
};

// —— 标准符号绘制（教材画法；aTerm 为左侧/上侧对应的端子） ——
// uprightText：符号整体被 rotate(90) 放竖时，把文字反向转回，保持字母与 +/− 标记正立
// 约定：引线一律画到符号本体边缘为止，不伸进本体内部（矩形电阻到 ±28，圆形电表/灯泡到 ±15）。
// leadA/leadB：左（上）/右（下）侧引线长度，默认 HL；节点更近时由调用方缩短，使引线尖端落在节点上。
function drawSymbol(g, comp, aTerm, uprightText = false, leadA = HL, leadB = HL) {
  const line = (x1, y1, x2, y2, extra = {}) => el('line', { x1, y1, x2, y2, class: 'sch-sym', ...extra }, g);
  const glyph = (s, attrs) => {
    const t = text(g, s, attrs);
    if (uprightText) t.setAttribute('transform', `rotate(-90 ${attrs.x} ${attrs.y})`);
    return t;
  };
  // 箭头头部：尖端 (tx,ty)，单位方向 (ux,uy)
  const arrowHead = (parent, tx, ty, ux, uy, size = 7) => {
    const nx = -uy, ny = ux, bx = tx - ux * size, by = ty - uy * size, hw = size * 0.45;
    el('path', {
      d: `M ${tx} ${ty} L ${(bx + nx * hw).toFixed(1)} ${(by + ny * hw).toFixed(1)} L ${(bx - nx * hw).toFixed(1)} ${(by - ny * hw).toFixed(1)} Z`,
      class: 'sch-fill'
    }, parent);
  };
  const value = symbolValue(comp);
  // 元件内部电流路径（符号局部坐标）：多数元件沿轴线直通，电铃等绕行铃罩
  let internal = null;

  switch (comp.type) {
    case 'student-supply': case 'battery-pack': case 'accumulator': {
      // 电池：左/右极板，+ 在 aTerm==='pos' 一侧
      const posLeft = aTerm === 'pos';
      const px = posLeft ? -8 : 8, nx = posLeft ? 8 : -8;
      line(-leadA, 0, px, 0); line(nx, 0, leadB, 0);
      line(px, -16, px, 16);                       // 长极板
      line(nx, -7, nx, 7, { 'stroke-width': 5 });  // 短极板
      glyph('+', { x: px, y: -22, class: 'sch-label', 'font-size': 12 });
      glyph('−', { x: nx, y: -22, class: 'sch-label', 'font-size': 12 });
      break;
    }
    case 'resistor': case 'resistance-box': case 'wire-board': {
      // 矩形电阻：引线止于矩形边缘（人教版：导线不进入符号内部）
      line(-leadA, 0, -28, 0); line(28, 0, leadB, 0);
      el('rect', { x: -28, y: -9, width: 56, height: 18, class: 'sch-sym' }, g);
      break;
    }
    case 'bulb': case 'bulb-nl': {
      line(-leadA, 0, -15, 0); line(15, 0, leadB, 0);
      el('circle', { cx: 0, cy: 0, r: 15, class: 'sch-sym' }, g);
      line(-10, -10, 10, 10); line(-10, 10, 10, -10);
      break;
    }
    case 'switch': {
      // 人教版：两端空心圆圈为接线点，刀片铰于左圈；断开向右上倾斜，闭合放平接通
      line(-leadA, 0, -14.5, 0);
      line(14.5, 0, leadB, 0);
      el('circle', { cx: -10, cy: 0, r: 4.5, class: 'sch-sym' }, g);
      el('circle', { cx: 10, cy: 0, r: 4.5, class: 'sch-sym' }, g);
      if (comp.params.closed) line(-10, 0, 10, 0);
      else line(-10, 0, 7, -15);
      break;
    }
    case 'ammeter': case 'voltmeter': case 'galvanometer': {
      line(-leadA, 0, -15, 0); line(15, 0, leadB, 0);
      el('circle', { cx: 0, cy: 0, r: 15, class: 'sch-sym' }, g);
      const letter = comp.type === 'ammeter' ? 'A' : comp.type === 'voltmeter' ? 'V' : 'G';
      glyph(letter, { x: 0, y: 5, class: 'sch-label', 'font-size': 14, 'text-anchor': 'middle' });
      // “+” 标在量程接线柱（非 − 柱）一侧
      if (aTerm !== 'minus') glyph('+', { x: -22, y: -18, class: 'sch-label' });
      else glyph('+', { x: 22, y: -18, class: 'sch-label' });
      break;
    }
    case 'diode': case 'led': {
      // 人教版：空心三角 + 竖线（阴极）；三角指向阴极。flip 时整体镜像，竖线随三角换侧
      const flip = aTerm !== 'an';
      const sub = el('g', { transform: flip ? 'scale(-1, 1)' : '' }, g);
      line(-leadA, 0, -10, 0); line(10, 0, leadB, 0);
      el('path', { d: 'M -10 -10 L -10 10 L 9 0 Z', class: 'sch-sym' }, sub);
      el('line', { x1: 10, y1: -11, x2: 10, y2: 11, class: 'sch-sym' }, sub);
      if (comp.type === 'led') {
        // 人教版：两个斜向小箭头指向外侧表示发光
        for (const [sx, sy] of [[1, -13], [8, -13]]) {
          const tx = sx + 6.5, ty = sy - 6.5;
          el('line', { x1: sx, y1: sy, x2: tx, y2: ty, class: 'sch-sym' }, sub);
          arrowHead(sub, tx, ty, Math.SQRT1_2, -Math.SQRT1_2);
        }
      }
      break;
    }
    case 'fuse': {
      // 保险丝：小矩形（熔丝管），引线止于矩形边缘
      line(-leadA, 0, -14, 0); line(14, 0, leadB, 0);
      el('rect', { x: -14, y: -6, width: 28, height: 12, class: 'sch-sym' }, g);
      break;
    }
    case 'bell': {
      // 人教版电铃（蘑菇形）：半圆铃罩（拱形+直径）架在两条短柱上，接线从短柱底端引出
      el('path', { d: 'M -13 -13 A 13 13 0 0 1 13 -13 Z', class: 'sch-sym' }, g);
      line(-6, -13, -6, 0);
      line(6, -13, 6, 0);
      line(-leadA, 0, -6, 0);
      line(6, 0, leadB, 0);
      internal = [[-6, 0], [-6, -13], [6, -13], [6, 0]];
      break;
    }
    case 'motor': {
      line(-leadA, 0, -15, 0); line(15, 0, leadB, 0);
      el('circle', { cx: 0, cy: 0, r: 15, class: 'sch-sym' }, g);
      glyph('M', { x: 0, y: 5, class: 'sch-label', 'font-size': 13, 'text-anchor': 'middle' });
      break;
    }
    default: {
      line(-leadA, 0, -28, 0); line(28, 0, leadB, 0);
      el('rect', { x: -28, y: -9, width: 56, height: 18, class: 'sch-sym' }, g);
    }
  }
  void value;
  return internal;
}

// 人教版滑动变阻器：矩形电阻丝 + 上方平行滑杆，滑片箭头按实际位置指向电阻丝。
// c 端从滑杆靠接线节点的一端沿滑杆方向水平引出（cLeft 选左右；为 null 表示 c 未接线，不画引出）。
function drawRheostat(g, comp, cLeft) {
  const line = (x1, y1, x2, y2, extra = {}) => el('line', { x1, y1, x2, y2, class: 'sch-sym', ...extra }, g);
  line(-HL, 0, -28, 0); line(28, 0, HL, 0);            // a / b 引线止于矩形边缘
  el('rect', { x: -28, y: -9, width: 56, height: 18, class: 'sch-sym' }, g);
  line(-28, -22, 28, -22);                             // 滑杆（与电阻丝平行等长）
  const px = -28 + 56 * Math.max(0, Math.min(1, comp.params.x ?? 0.5));
  line(px, -22, px, -10);                              // 滑片
  el('path', { d: `M ${px - 4} -12 L ${px} -8 L ${px + 4} -12`, fill: 'none', class: 'sch-sym' }, g); // 滑片箭头
  if (cLeft !== null) line(cLeft ? -28 : 28, -22, cLeft ? -HL : HL, -22); // c 端沿滑杆引出
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

function drawLabel(layer, comp, M, dy, labels) {
  const def = DEFS[comp.type];
  const value = symbolValue(comp);
  const label = value ? `${def.label} ${value}` : def.label;
  const t = text(layer, label, { x: M.x, y: M.y + dy, class: 'sch-label', 'text-anchor': 'middle' });
  labels?.push({ t, M, dy });
  return t;
}
