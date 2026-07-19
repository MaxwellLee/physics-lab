// 电路编排层：把台面状态（元件 + 导线）编译成 MNA 网络表，
// 处理非线性灯泡、二极管状态、保险丝熔断的迭代求解，
// 并输出求解结果与教学事件（短路、超量程、熔断等）。
// 纯逻辑，无 DOM。

import { solveMNA } from './mna.js';
import {
  DEFS, WIRE_R, LEAK_R, SHORT_CURRENT,
  nlBulbColdR, nlBulbResistance
} from './components.js';

const MAX_ITER = 80;
const CONVERGE_V = 1e-9;

// bench = {
//   components: [{ id, type, params: {...}, blown?: bool, resistance?: number }],
//   wires: [{ id, a: { comp, term }, b: { comp, term } }]
// }
export function solveBench(bench) {
  const events = [];
  const comps = bench.components.filter(c => DEFS[c.type]);
  if (comps.length === 0) {
    return { ok: true, empty: true, events, comps: new Map(), wires: new Map(), v: null, nodeOf: new Map(), pMin: 0, pMax: 0 };
  }

  // 1. 每个元件端子一个节点
  const nodeOf = new Map(); // "compId:term" -> nodeIdx
  let nodeCount = 0;
  const compState = new Map(); // comp.id -> { def, params, nodes: {term: idx}, type }
  for (const comp of comps) {
    const def = DEFS[comp.type];
    const nodes = {};
    for (const term of def.terminals) {
      nodes[term] = nodeCount;
      nodeOf.set(`${comp.id}:${term}`, nodeCount);
      nodeCount++;
    }
    compState.set(comp.id, { id: comp.id, type: comp.type, def, params: comp.params ?? {}, nodes, blown: !!comp.blown, resistance: comp.resistance });
  }

  // 2. 参考地：优先取第一个电源的负极端子
  let ground = -1;
  for (const comp of comps) {
    if (DEFS[comp.type].kind === 'source') { ground = compState.get(comp.id).nodes.neg; break; }
  }
  if (ground < 0) ground = 0;

  // 3. 跨迭代状态：二极管导通态、非线性灯泡当前电阻
  const state = {
    diodeOn: new Map(),
    bulbR: new Map()
  };
  for (const comp of comps) {
    if (comp.type === 'diode' || comp.type === 'led') state.diodeOn.set(comp.id, false);
    if (comp.type === 'bulb-nl') {
      const p = comp.params ?? {};
      state.bulbR.set(comp.id, nlBulbColdR(p.ratedU ?? 2.5, p.ratedI ?? 0.3));
    }
  }
  // 熔断来自台面持久状态（comp.blown），求解中熔断后写回 benchBlown
  const blownNow = new Set(comps.filter(c => c.blown).map(c => c.id));

  const buildSystem = () => {
    const resistors = [];
    const vSources = [];
    const ctxFor = (cs) => ({
      node: (term) => cs.nodes[term],
      resistor: (a, b, r) => resistors.push({ a, b, r }),
      vsource: (p, n, e) => vSources.push({ p, n, e, id: cs.id }),
      state
    });
    for (const cs of compState.values()) {
      if (cs.def.kind === 'source') {
        vSources.push({ p: cs.nodes.pos, n: cs.nodes.neg, e: cs.def.emf(cs.params), id: cs.id });
        continue;
      }
      if (cs.type === 'fuse' && blownNow.has(cs.id)) continue; // 已熔断：开路
      cs.def.stamp?.(ctxFor(cs), { id: cs.id, params: cs.params, blown: blownNow.has(cs.id), resistance: cs.resistance });
    }
    // 导线：残余电阻 WIRE_R
    for (const w of bench.wires) {
      const na = nodeOf.get(`${w.a.comp}:${w.a.term}`);
      const nb = nodeOf.get(`${w.b.comp}:${w.b.term}`);
      if (na === undefined || nb === undefined || na === nb) continue;
      resistors.push({ a: na, b: nb, r: WIRE_R, wireId: w.id });
    }
    // 节点对地泄漏（数值稳定，物理影响可忽略）
    for (let i = 0; i < nodeCount; i++) {
      if (i !== ground) resistors.push({ a: i, b: ground, r: LEAK_R, leak: true });
    }
    return { resistors, vSources };
  };

  // 4. 迭代求解（非线性灯泡 + 二极管状态 + 保险丝熔断）
  let v = null, j = null, singular = false, converged = false, lastSystem = null;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const system = buildSystem();
    lastSystem = system;
    const out = solveMNA(nodeCount, system.resistors, system.vSources, ground);
    if (out.singular) { singular = true; break; }
    const vPrev = v;
    v = out.v; j = out.j;

    let changed = false;
    // 二极管 / LED 状态更新
    for (const cs of compState.values()) {
      if (cs.type !== 'diode' && cs.type !== 'led') continue;
      const on = state.diodeOn.get(cs.id);
      const van = v[cs.nodes.an], vka = v[cs.nodes.ka];
      if (on) {
        if ((van - vka) / WIRE_R < -1e-9) { state.diodeOn.set(cs.id, false); changed = true; }
      } else if (van - vka > 1e-6) {
        state.diodeOn.set(cs.id, true); changed = true;
      }
    }
    // 非线性灯泡电阻更新（含松弛，保证稳定）
    for (const cs of compState.values()) {
      if (cs.type !== 'bulb-nl') continue;
      const u = Math.abs(v[cs.nodes.a] - v[cs.nodes.b]);
      const target = nlBulbResistance(u, cs.params.ratedU ?? 2.5, cs.params.ratedI ?? 0.3);
      const prev = state.bulbR.get(cs.id);
      const next = prev + 0.5 * (target - prev);
      if (Math.abs(next - prev) / Math.max(target, 1e-9) > 1e-7) changed = true;
      state.bulbR.set(cs.id, next);
    }
    // 保险丝：超过熔断电流即断开（单调，不会恢复）
    for (const cs of compState.values()) {
      if (cs.type !== 'fuse' || blownNow.has(cs.id)) continue;
      const i = Math.abs(v[cs.nodes.a] - v[cs.nodes.b]) / WIRE_R;
      if (i > (cs.params.rating ?? 2)) {
        blownNow.add(cs.id);
        events.push({ type: 'fuse-blown', id: cs.id, current: i });
        changed = true;
      }
    }
    // 收敛判定：电压向量稳定且无状态变化
    if (!changed && vPrev && maxAbsDiff(v, vPrev) < CONVERGE_V) { converged = true; break; }
  }

  if (singular) {
    return { ok: false, error: 'singular', events: [{ type: 'unsolvable' }], comps: new Map(), wires: new Map(), v: null, nodeOf, pMin: 0, pMax: 0 };
  }
  if (!converged) events.push({ type: 'nonconverged' });

  // 5. 汇总结果
  const results = new Map();
  let pMin = Infinity, pMax = -Infinity;
  for (let i = 0; i < nodeCount; i++) {
    if (v[i] < pMin) pMin = v[i];
    if (v[i] > pMax) pMax = v[i];
  }
  if (!isFinite(pMin)) { pMin = 0; pMax = 0; }

  const vsIndex = new Map(); // compId -> source index in j
  lastSystem.vSources.forEach((s, k) => vsIndex.set(s.id, k));

  let shorted = false;
  const shortIds = [];
  const registerShort = (id, i) => {
    if (Math.abs(i) > SHORT_CURRENT) { shorted = true; shortIds.push(id); return true; }
    return false;
  };

  for (const cs of compState.values()) {
    const out = { U: 0, I: 0, P: 0 };
    const nv = cs.nodes;
    if (cs.def.kind === 'source') {
      const k = vsIndex.get(cs.id);
      const delivered = k === undefined ? 0 : -j[k];
      out.U = cs.def.emf(cs.params);
      out.I = delivered;
      out.P = out.U * delivered;
      registerShort(cs.id, delivered);
    } else if (cs.type === 'rheostat') {
      const max = cs.params.max ?? 50;
      const x = Math.min(1, Math.max(0, cs.params.x ?? 0.5));
      const rac = Math.max(x * max, 1e-6), rbc = Math.max((1 - x) * max, 1e-6);
      const iac = (v[nv.a] - v[nv.c]) / rac;
      const ibc = (v[nv.b] - v[nv.c]) / rbc;
      out.U = v[nv.a] - v[nv.b];
      out.I = Math.abs(iac) > Math.abs(ibc) ? iac : ibc;
      out.Iac = iac; out.Ibc = ibc;
      out.P = (v[nv.a] - v[nv.c]) * iac + (v[nv.b] - v[nv.c]) * ibc;
      registerShort(cs.id, iac); registerShort(cs.id, ibc);
    } else if (cs.def.kind === 'meter') {
      cs.def.measure?.({ nodes: nv, params: cs.params }, v, out);
      out.I = cs.type === 'voltmeter' ? 0 : out.reading;
      out.U = cs.type === 'voltmeter' ? out.reading : (v[nv.plus] - v[nv.minus]);
      out.P = out.U * out.I;
      const range = cs.params.range ?? 1;
      if (Math.abs(out.reading ?? 0) > range) {
        events.push({ type: 'overrange', id: cs.id, reading: out.reading, range, meter: cs.type });
        out.overrange = true;
      }
      if (cs.type !== 'voltmeter') registerShort(cs.id, out.reading ?? 0);
    } else if (cs.type === 'spdt-switch') {
      const to = cs.params.position === 'y' ? 'y' : 'x';
      out.I = (v[nv.com] - v[nv[to]]) / WIRE_R;
      out.U = 0; out.P = 0;
      registerShort(cs.id, out.I);
    } else {
      // 二端元件：电阻、灯泡、二极管、保险丝、开关、电铃、电动机、电阻箱、电阻丝板
      const [t1, t2] = (cs.type === 'diode' || cs.type === 'led') ? ['an', 'ka'] : ['a', 'b'];
      const rEff = effectiveResistance(cs, state, blownNow);
      out.U = v[nv[t1]] - v[nv[t2]];
      out.I = rEff ? out.U / rEff : 0;
      out.P = out.U * out.I;
      if (cs.type === 'diode' || cs.type === 'led') {
        out.conducting = state.diodeOn.get(cs.id) && out.I > -1e-9;
        if (cs.type === 'led') out.lit = out.conducting && out.I >= (cs.params.litThreshold ?? 0.01);
      }
      if (cs.type === 'bulb' || cs.type === 'bulb-nl') {
        const ratedP = cs.type === 'bulb'
          ? (cs.params.ratedP ?? 1)
          : (cs.params.ratedU ?? 2.5) * (cs.params.ratedI ?? 0.3);
        out.brightness = Math.max(0, Math.min(1.3, out.P / Math.max(ratedP, 1e-9)));
        if (out.P > 2 * ratedP) events.push({ type: 'overpower', id: cs.id, power: out.P, ratedP });
        if (cs.type === 'bulb-nl') out.rNow = state.bulbR.get(cs.id);
      }
      if (cs.type === 'bell' || cs.type === 'motor') {
        out.active = Math.abs(out.I) >= (cs.params.threshold ?? 0.1);
      }
      if (cs.type === 'fuse') out.blown = blownNow.has(cs.id);
      if (cs.type === 'switch' && !cs.params.closed) { out.I = 0; }
      registerShort(cs.id, out.I);
    }
    results.set(cs.id, out);
  }

  // 导线电流（正方向：wire.a → wire.b）
  const wireResults = new Map();
  for (const w of bench.wires) {
    const na = nodeOf.get(`${w.a.comp}:${w.a.term}`);
    const nb = nodeOf.get(`${w.b.comp}:${w.b.term}`);
    if (na === undefined || nb === undefined) continue;
    const i = (v[na] - v[nb]) / WIRE_R;
    wireResults.set(w.id, { I: i, aNode: na, bNode: nb });
    if (registerShort(w.id, i)) shortIds.push(w.id);
  }

  if (shorted) {
    events.unshift({ type: 'short', ids: shortIds });
  }

  return {
    ok: true, empty: false, events, comps: results, wires: wireResults,
    v, j, nodeOf, ground, pMin, pMax,
    blown: [...blownNow],
    converged
  };
}

function effectiveResistance(cs, state, blownNow) {
  switch (cs.type) {
    case 'resistor': return cs.params.resistance;
    case 'resistance-box': return Math.max(cs.params.resistance ?? 5, 1e-6);
    case 'wire-board': return Math.max(cs.resistance ?? 1, 1e-6);
    case 'bulb': return cs.params.resistance;
    case 'bulb-nl': return state.bulbR.get(cs.id);
    case 'diode': case 'led': return state.diodeOn.get(cs.id) ? WIRE_R : null;
    case 'fuse': return blownNow.has(cs.id) ? null : WIRE_R;
    case 'switch': return cs.params.closed ? WIRE_R : null;
    case 'ammeter': case 'galvanometer': return WIRE_R;
    case 'bell': case 'motor': return cs.params.resistance;
    default: return null;
  }
}

function maxAbsDiff(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) m = d;
  }
  return m;
}

// —— 供水路类比使用的拓扑约化 ——
// 若电路可约化为「一个电源 + 一组纯串联或纯并联负载（≤3）」，返回结构描述，否则 null。
// 负载：电阻/灯泡/电阻箱/电阻丝板/电铃/电动机；开关须闭合；电流表视为导线；电压表忽略。
export function reduceForWater(bench) {
  const comps = bench.components.filter(c => DEFS[c.type]);
  const sources = comps.filter(c => DEFS[c.type].kind === 'source');
  if (sources.length !== 1) return null;
  const source = sources[0];
  const loadTypes = new Set(['resistor', 'resistance-box', 'wire-board', 'bulb', 'bulb-nl', 'bell', 'motor']);
  const loads = comps.filter(c => loadTypes.has(c.type));
  if (loads.length < 1 || loads.length > 3) return null;
  const pass = new Set(['ammeter', 'galvanometer', 'switch', 'fuse']); // 视为导通的元件（开关须闭合、保险丝须完好）
  const ignored = new Set(['voltmeter']); // 理想开路，不影响拓扑
  const others = comps.filter(c => c.id !== source.id && !loadTypes.has(c.type) && !pass.has(c.type) && !ignored.has(c.type));
  if (others.length) return null;
  if (comps.some(c => (c.type === 'switch' && !c.params.closed) || (c.type === 'fuse' && c.blown))) return null;

  // 建端子图：导线 + 导通元件 合并等势区；负载与电源为支路边
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { parent.set(find(a), find(b)); };
  const key = (c, t) => `${c}:${t}`;
  const ensure = (x) => { if (!parent.has(x)) parent.set(x, x); };
  for (const c of comps) for (const t of DEFS[c.type].terminals) ensure(key(c.id, t));
  for (const w of bench.wires) {
    const a = key(w.a.comp, w.a.term), b = key(w.b.comp, w.b.term);
    if (parent.has(a) && parent.has(b)) union(a, b);
  }
  for (const c of comps) {
    if (c.type === 'ammeter' || c.type === 'galvanometer') union(key(c.id, 'plus'), key(c.id, 'minus'));
    if (c.type === 'switch' && c.params.closed) union(key(c.id, 'a'), key(c.id, 'b'));
    if (c.type === 'fuse' && !c.blown) union(key(c.id, 'a'), key(c.id, 'b'));
  }
  const sp = find(key(source.id, 'pos')), sn = find(key(source.id, 'neg'));

  // 每个负载必须直接跨接在两个等势区之间；收集 (from,to) 边
  const edges = loads.map(l => ({ id: l.id, type: l.type, from: find(key(l.id, 'a')), to: find(key(l.id, 'b')) }));
  // 串联判定优先（单负载电路同属两种形态，教学上按单回路处理）：
  // 把负载当作边，等势区当作点，存在一条经过全部负载、从 sp 到 sn 且不重复的链
  if (isSeriesChain(edges, sp, sn, loads.length)) {
    return { mode: 'series', sourceId: source.id, loadIds: loads.map(l => l.id) };
  }
  // 并联判定：所有负载都跨接在 (sp, sn) 之间
  const parallel = edges.every(e =>
    (e.from === sp && e.to === sn) || (e.from === sn && e.to === sp));
  if (parallel) {
    return { mode: 'parallel', sourceId: source.id, loadIds: loads.map(l => l.id) };
  }
  return null;
}

function isSeriesChain(edges, sp, sn, count) {
  // 从 sp 出发，每步沿一条负载边走到另一端；要求恰好经过 count 条边后到达 sn，且不重复
  let node = sp;
  const used = new Set();
  for (let step = 0; step < count; step++) {
    const next = edges.find(e => !used.has(e.id) && (e.from === node || e.to === node));
    if (!next) return false;
    used.add(next.id);
    node = next.from === node ? next.to : next.from;
  }
  return node === sn && used.size === count;
}
