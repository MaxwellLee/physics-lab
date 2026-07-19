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

  // 实际被导线连接的端子集合（电表量程由接线柱决定）
  const wired = new Set();
  for (const w of bench.wires) {
    wired.add(`${w.a.comp}:${w.a.term}`);
    wired.add(`${w.b.comp}:${w.b.term}`);
  }

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
      // 三接线柱电表：量程由实际接线的正接线柱决定（low/high 都接时按 low 处理）
      const lowUsed = wired.has(`${cs.id}:low`);
      const highUsed = wired.has(`${cs.id}:high`);
      const t = lowUsed ? 'low' : (highUsed ? 'high' : 'low');
      const range = cs.def.ranges[t];
      out.range = range;
      out.rangeLabel = cs.type === 'galvanometer'
        ? (t === 'low' ? 'G0 挡' : 'G1 挡')
        : `0–${cs.def.termLabels[t]} ${cs.type === 'voltmeter' ? 'V' : 'A'}`;
      if (cs.type === 'voltmeter') {
        out.reading = v[nv[t]] - v[nv.minus];
        out.I = 0;
        out.U = out.reading;
        out.P = 0;
      } else {
        const iLow = (v[nv.low] - v[nv.minus]) / WIRE_R;
        const iHigh = (v[nv.high] - v[nv.minus]) / WIRE_R;
        out.reading = (lowUsed && highUsed) ? iLow + iHigh : (t === 'low' ? iLow : iHigh);
        out.I = out.reading;
        out.U = v[nv[t]] - v[nv.minus];
        out.P = out.U * out.I;
        registerShort(cs.id, out.reading ?? 0);
      }
      if (Math.abs(out.reading ?? 0) > range) {
        events.push({ type: 'overrange', id: cs.id, reading: out.reading, range, meter: cs.type });
        out.overrange = true;
      }
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
