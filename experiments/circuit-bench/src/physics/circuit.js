// 电路编排层：把台面状态（元件 + 导线）编译成 MNA 网络表，
// 处理非线性灯泡、二极管状态、保险丝熔断的迭代求解，
// 并输出求解结果与教学事件（短路、超量程、熔断等）。
// 纯逻辑，无 DOM。

import { solveMNA } from './mna.js';
import {
  DEFS, WIRE_R, LEAK_R, SHORT_CURRENT, OPEN_R,
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
  const meterConnection = (cs) => {
    const minusUsed = wired.has(`${cs.id}:minus`);
    const lowUsed = wired.has(`${cs.id}:low`);
    const highUsed = wired.has(`${cs.id}:high`);
    const positiveCount = Number(lowUsed) + Number(highUsed);
    return {
      minusUsed, lowUsed, highUsed, positiveCount,
      valid: minusUsed && positiveCount === 1,
      active: lowUsed && !highUsed ? 'low' : highUsed && !lowUsed ? 'high' : null
    };
  };

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
      if (cs.def.kind === 'meter') {
        // 学校三接线柱电表必须使用公共负柱 + 恰好一个正量程柱。
        // 接法无效时不把内部量程支路接入求解，避免“两正柱”或漏接负柱仍产生假读数。
        const connection = meterConnection(cs);
        if (connection.valid) {
          const resistance = cs.type === 'voltmeter' ? OPEN_R : WIRE_R;
          resistors.push({ a: cs.nodes[connection.active], b: cs.nodes.minus, r: resistance, meterId: cs.id });
        }
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
      const irod = (v[nv.d] - v[nv.c]) / 1e-3; // 金属滑杆 c-d 直通段电流
      out.U = v[nv.a] - v[nv.b];
      out.I = Math.abs(iac) > Math.abs(ibc) ? iac : ibc;
      out.Iac = iac; out.Ibc = ibc;
      out.P = (v[nv.a] - v[nv.c]) * iac + (v[nv.b] - v[nv.c]) * ibc;
      registerShort(cs.id, iac); registerShort(cs.id, ibc); registerShort(cs.id, irod);
    } else if (cs.def.kind === 'meter') {
      const connection = meterConnection(cs);
      const { lowUsed, highUsed } = connection;
      const t = connection.active ?? (lowUsed ? 'low' : highUsed ? 'high' : 'low');
      const range = cs.def.ranges[t];
      out.range = range;
      out.connected = connection.valid;
      out.rangeLabel = cs.type === 'galvanometer'
        ? (t === 'low' ? 'G0 挡' : 'G1 挡')
        : `0–${cs.def.termLabels[t]} ${cs.type === 'voltmeter' ? 'V' : 'A'}`;
      if (!connection.valid) {
        out.reading = 0;
        out.I = 0;
        out.U = 0;
        out.P = 0;
        out.rangeLabel = null;
        const usedCount = Number(connection.minusUsed) + connection.positiveCount;
        out.connectionError = usedCount >= 2;
        if (usedCount >= 2) {
          events.push({
            type: 'meter-terminal',
            id: cs.id,
            meter: cs.type,
            minusUsed: connection.minusUsed,
            lowUsed,
            highUsed,
            wireIds: meterWireIds(bench, cs.id)
          });
        }
      } else if (cs.type === 'voltmeter') {
        out.reading = v[nv[t]] - v[nv.minus];
        out.I = 0;
        out.U = out.reading;
        out.P = 0;
      } else {
        const iActive = (v[nv[t]] - v[nv.minus]) / WIRE_R;
        out.reading = iActive;
        out.I = out.reading;
        out.U = v[nv[t]] - v[nv.minus];
        out.P = out.U * out.I;
        registerShort(cs.id, out.reading ?? 0);
      }
      if (connection.valid && Math.abs(out.reading ?? 0) > range) {
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
        const anodeWired = wired.has(`${cs.id}:an`);
        const cathodeWired = wired.has(`${cs.id}:ka`);
        if (anodeWired && cathodeWired && out.U < -0.05) {
          events.push({
            type: 'diode-reversed', id: cs.id, diode: cs.type,
            voltage: out.U, wireIds: meterWireIds(bench, cs.id)
          });
        }
      }
      if (cs.type === 'bulb' || cs.type === 'bulb-nl') {
        const ratedP = cs.type === 'bulb'
          ? (cs.params.ratedP ?? 1)
          : (cs.params.ratedU ?? 2.5) * (cs.params.ratedI ?? 0.3);
        // 人眼对亮度感知近似非线性：低于额定功率时使用平方根映射，
        // 让“已经有电流但较暗”的灯泡仍清晰可见；零功率仍严格不亮。
        const powerRatio = Math.max(0, out.P / Math.max(ratedP, 1e-9));
        out.brightness = Math.max(0, Math.min(1.3, Math.sqrt(powerRatio)));
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

  // 用电器被「纯导通路径」短接的判定：导线、闭合开关、电流表、完好保险丝、滑变金属杆
  // 在教学模型中都是近理想导体（1 mΩ）。若用电器两端被这类路径直接连通，按理想化
  // 处理其端电压视为 0——灯泡不亮、电铃不响、电动机不转（电流几乎全部抄近路走导线）。
  const bp = new Map();
  const bfind = (x) => {
    if (!bp.has(x)) bp.set(x, x);
    let r = x;
    while (bp.get(r) !== r) r = bp.get(r);
    let y = x;
    while (bp.get(y) !== y) { const n = bp.get(y); bp.set(y, r); y = n; }
    return r;
  };
  const bunion = (a, b) => bp.set(bfind(a), bfind(b));
  for (const w of bench.wires) {
    bunion(`${w.a.comp}:${w.a.term}`, `${w.b.comp}:${w.b.term}`);
  }
  for (const c of bench.components) {
    const k = (t) => `${c.id}:${t}`;
    if (c.type === 'switch' && c.params.closed) bunion(k('a'), k('b'));
    else if (c.type === 'spdt-switch') bunion(k('com'), k(c.params.position === 'y' ? 'y' : 'x'));
    else if (c.type === 'ammeter' || c.type === 'galvanometer') { bunion(k('minus'), k('low')); bunion(k('minus'), k('high')); }
    else if (c.type === 'fuse' && !c.blown && !blownNow.has(c.id)) bunion(k('a'), k('b'));
    else if (c.type === 'rheostat') bunion(k('c'), k('d'));
  }
  for (const cs of compState.values()) {
    const out = results.get(cs.id);
    if (!out) continue;
    const isLoad = cs.type === 'bulb' || cs.type === 'bulb-nl' || cs.type === 'bell' || cs.type === 'motor' || cs.type === 'led';
    if (!isLoad) continue;
    const [t1, t2] = cs.type === 'led' ? ['an', 'ka'] : ['a', 'b'];
    if (bfind(`${cs.id}:${t1}`) !== bfind(`${cs.id}:${t2}`)) continue;
    if (out.brightness !== undefined) out.brightness = 0;
    if (out.active !== undefined) out.active = false;
    if (out.lit !== undefined) out.lit = false;
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

  diagnoseMeters(bench, compState, results, events, meterConnection);

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

function meterWireIds(bench, meterId) {
  return bench.wires
    .filter(w => w.a.comp === meterId || w.b.comp === meterId)
    .map(w => w.id);
}

// 电表教学诊断建立在“导线等势结点 + 元件支路”拓扑上，不改变 MNA 求解结果。
// 目标是识别初中实验中最常见、且肉眼容易误判的三类错误：
// 反接、把电流表并联、把电压表串联。
function diagnoseMeters(bench, compState, results, events, meterConnection) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cursor = x;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a, b) => parent.set(find(b), find(a));
  const key = (id, term) => `${id}:${term}`;
  for (const cs of compState.values()) {
    for (const term of cs.def.terminals) find(key(cs.id, term));
  }
  for (const wire of bench.wires) {
    union(key(wire.a.comp, wire.a.term), key(wire.b.comp, wire.b.term));
  }

  const edges = [];
  const addEdge = (cs, a, b) => edges.push({
    id: cs.id, type: cs.type,
    a: find(key(cs.id, a)), b: find(key(cs.id, b))
  });
  for (const cs of compState.values()) {
    if (cs.def.kind === 'source') addEdge(cs, 'pos', 'neg');
    else if (cs.def.kind === 'meter') {
      const connection = meterConnection(cs);
      if (connection.valid) addEdge(cs, connection.active, 'minus');
    } else if (cs.type === 'rheostat') {
      addEdge(cs, 'a', 'c'); addEdge(cs, 'b', 'c'); addEdge(cs, 'c', 'd');
    } else if (cs.type === 'spdt-switch') {
      addEdge(cs, 'com', cs.params.position === 'y' ? 'y' : 'x');
    } else if (cs.type === 'switch') {
      if (cs.params.closed) addEdge(cs, 'a', 'b');
    } else if (cs.type === 'diode' || cs.type === 'led') {
      addEdge(cs, 'an', 'ka');
    } else if (cs.def.terminals.includes('a') && cs.def.terminals.includes('b')) {
      addEdge(cs, 'a', 'b');
    }
  }

  const degree = new Map();
  for (const edge of edges) {
    degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
    degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
  }
  const samePair = (x, y) =>
    (x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a);

  for (const cs of compState.values()) {
    if (cs.type !== 'ammeter' && cs.type !== 'voltmeter' && cs.type !== 'galvanometer') continue;
    const connection = meterConnection(cs);
    if (!connection.valid) continue;
    const result = results.get(cs.id);
    if (!result) continue;
    const edge = edges.find(item => item.id === cs.id);
    if (!edge) continue;
    const wireIds = meterWireIds(bench, cs.id);

    if ((result.reading ?? 0) < -1e-6) {
      result.reversed = true;
      events.push({ type: 'meter-reversed', id: cs.id, meter: cs.type, reading: result.reading, wireIds });
    }

    const exactParallel = edges.some(item => item.id !== cs.id && samePair(item, edge));
    const bothJunctions = (degree.get(edge.a) ?? 0) >= 3 && (degree.get(edge.b) ?? 0) >= 3;
    if ((cs.type === 'ammeter' || cs.type === 'galvanometer') && (exactParallel || bothJunctions)) {
      events.push({ type: 'ammeter-parallel', id: cs.id, meter: cs.type, wireIds });
      continue;
    }
    // 串联支路的两个结点都只有“进、出”两条支路；正确并联至少会与被测对象共享一对结点。
    if (cs.type === 'voltmeter' && !exactParallel &&
      (degree.get(edge.a) ?? 0) === 2 && (degree.get(edge.b) ?? 0) === 2) {
      events.push({ type: 'voltmeter-series', id: cs.id, wireIds });
    }
  }
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
