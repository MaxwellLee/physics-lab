// 元件电学行为定义：端子、可调参数、在 MNA 中的印记方式。
// 纯数据与函数，无 DOM。文案与外观数据在 data.js / render 层。
//
// 统一理想化约定（界面模型说明中披露）：
// - 导线、闭合开关、电流表、完好保险丝：残余电阻 WIRE_R = 1 mΩ，
//   使每条支路电流可解、短路电流有限且可被检测；
// - 电压表：理想开路，仅读取两节点电势差；
// - 每个节点对地接 LEAK_R = 1 GΩ 泄漏，保证悬空节点电势有定义（物理影响可忽略）；
// - 电源：理想电压源，忽略内阻。

export const WIRE_R = 1e-3;
export const LEAK_R = 1e9;
export const SHORT_CURRENT = 100; // 任何支路 |I| 超过此值（A）判定为短路
export const OPEN_R = 1e9;

// 非线性灯泡经验模型：R(U) = R0 * (1 + K * (U / Ue)^2)
// 标定：额定电压 Ue 下 R(Ue) = Ue / Ie（即 R0 = (Ue/Ie) / (1+K)，K=9 时热态约为冷态 10 倍），
// 符合白炽灯冷热态电阻量级；作为教学模型在界面与 SOURCES.md 中披露。
export const NL_K = 9;
export function nlBulbColdR(ratedU, ratedI) {
  return (ratedU / ratedI) / (1 + NL_K);
}
export function nlBulbResistance(u, ratedU, ratedI) {
  const r0 = nlBulbColdR(ratedU, ratedI);
  const x = u / ratedU;
  return r0 * (1 + NL_K * x * x);
}

// 每个元件类型的电气定义：
//   terminals: 端子键列表（实物图/电路图共用）
//   params:    可调参数（range: min/max/step；select: options）
//   stamp(ctx, comp): 向求解器登记元件印记
//     ctx.resistor(a, b, r) / ctx.vsource(p, n, e) / ctx.node(termKey) -> 节点号
//     ctx.state: 跨迭代状态（二极管导通态、非线性灯泡当前电阻）
//   measure(comp, v, out): 求解后提取 U / I / P 与仪表读数
export const DEFS = {
  'student-supply': {
    label: '学生电源', kind: 'source', terminals: ['pos', 'neg'],
    params: { voltage: { label: '输出电压', min: 1.5, max: 15, step: 0.5, def: 3, unit: 'V' } },
    emf: p => p.voltage
  },
  'battery-pack': {
    label: '干电池组', kind: 'source', terminals: ['pos', 'neg'],
    params: { cells: { label: '电池节数', min: 1, max: 4, step: 1, def: 2, unit: '节' } },
    emf: p => (p.cells ?? 2) * 1.5
  },
  accumulator: {
    label: '蓄电池', kind: 'source', terminals: ['pos', 'neg'],
    params: { voltage: { label: '电压', options: [2, 4], def: 2, unit: 'V' } },
    emf: p => p.voltage ?? 2
  },

  switch: {
    label: '开关', kind: 'switch', terminals: ['a', 'b'],
    params: { closed: { label: '闭合', type: 'bool', def: true } },
    stamp(ctx, comp) {
      if (comp.params.closed) ctx.resistor(ctx.node('a'), ctx.node('b'), WIRE_R);
    }
  },
  'spdt-switch': {
    label: '单刀双掷开关', kind: 'switch', terminals: ['com', 'x', 'y'],
    params: { position: { label: '掷向', options: ['x', 'y'], def: 'x' } },
    stamp(ctx, comp) {
      const to = comp.params.position === 'y' ? 'y' : 'x';
      ctx.resistor(ctx.node('com'), ctx.node(to), WIRE_R);
    }
  },

  resistor: {
    label: '定值电阻', kind: 'resistor', terminals: ['a', 'b'],
    params: { resistance: { label: '阻值', min: 1, max: 10000, step: 1, def: 10, unit: 'Ω' } },
    stamp(ctx, comp) { ctx.resistor(ctx.node('a'), ctx.node('b'), comp.params.resistance); }
  },
  rheostat: {
    label: '滑动变阻器', kind: 'resistor', terminals: ['a', 'b', 'c', 'd'],
    params: {
      max: { label: '最大阻值', min: 5, max: 200, step: 5, def: 50, unit: 'Ω' },
      x: { label: '滑片位置', min: 0, max: 1, step: 0.01, def: 0.5 }
    },
    // a/b 为电阻丝两端，c/d 为金属滑杆两端（杆是良导体，c-d 直通）：
    // a-滑片 电阻 x·Rmax，b-滑片 电阻 (1-x)·Rmax（“一上一下”接法，c、d 任选一个即可）
    stamp(ctx, comp) {
      const max = comp.params.max ?? 50;
      const x = Math.min(1, Math.max(0, comp.params.x ?? 0.5));
      ctx.resistor(ctx.node('a'), ctx.node('c'), Math.max(x * max, 1e-6));
      ctx.resistor(ctx.node('b'), ctx.node('c'), Math.max((1 - x) * max, 1e-6));
      ctx.resistor(ctx.node('c'), ctx.node('d'), 1e-3); // 金属滑杆
    }
  },
  'resistance-box': {
    label: '电阻箱', kind: 'resistor', terminals: ['a', 'b'],
    params: { resistance: { label: '读数', min: 0, max: 9999, step: 1, def: 5, unit: 'Ω' } },
    stamp(ctx, comp) { ctx.resistor(ctx.node('a'), ctx.node('b'), Math.max(comp.params.resistance ?? 5, 1e-6)); }
  },
  'wire-board': {
    label: '电阻丝实验板', kind: 'resistor', terminals: ['a', 'b'],
    params: { specimen: { label: '电阻丝', options: [], def: 'nicr-1.0-0.2' } },
    // specimen 的 R = ρL/S 在 data.js 的 WIRE_SPECIMENS 中给出，此处只读取
    stamp(ctx, comp) {
      ctx.resistor(ctx.node('a'), ctx.node('b'), Math.max(comp.resistance ?? 1, 1e-6));
    }
  },

  bulb: {
    label: '小灯泡（普通）', kind: 'load', terminals: ['a', 'b'],
    params: {
      resistance: { label: '电阻（定值）', min: 1, max: 50, step: 0.5, def: 10, unit: 'Ω' },
      ratedP: { label: '额定功率', min: 0.2, max: 5, step: 0.1, def: 1, unit: 'W' }
    },
    stamp(ctx, comp) { ctx.resistor(ctx.node('a'), ctx.node('b'), comp.params.resistance); }
  },
  'bulb-nl': {
    label: '小灯泡（非线性）', kind: 'load', terminals: ['a', 'b'],
    params: {
      ratedU: { label: '额定电压', min: 1.5, max: 12, step: 0.5, def: 2.5, unit: 'V' },
      ratedI: { label: '额定电流', min: 0.1, max: 1, step: 0.05, def: 0.3, unit: 'A' }
    },
    nonlinear: true,
    stamp(ctx, comp) {
      const ratedU = comp.params.ratedU ?? 2.5;
      const ratedI = comp.params.ratedI ?? 0.3;
      const r = ctx.state.bulbR.get(comp.id) ?? nlBulbColdR(ratedU, ratedI);
      ctx.resistor(ctx.node('a'), ctx.node('b'), r);
    }
  },

  // 三接线柱电表（人教版样式）：公共负接线柱 minus + 两个量程正接线柱 low/high。
  // 量程由学生实际接线的接线柱决定；测量逻辑在 circuit.js 中（需要知道哪些端子被接线）。
  ammeter: {
    label: '电流表', kind: 'meter', terminals: ['minus', 'low', 'high'],
    termLabels: { minus: '−', low: '0.6', high: '3' },
    ranges: { low: 0.6, high: 3 }, // A
    params: {},
    stamp(ctx) {
      // 理想电流表：内阻取教学残余电阻
      ctx.resistor(ctx.node('low'), ctx.node('minus'), WIRE_R);
      ctx.resistor(ctx.node('high'), ctx.node('minus'), WIRE_R);
    }
  },
  galvanometer: {
    label: '灵敏电流计', kind: 'meter', terminals: ['minus', 'low', 'high'],
    termLabels: { minus: '−', low: 'G0', high: 'G1' },
    ranges: { low: 0.03, high: 0.3 }, // A（教学量程，见 SOURCES.md）
    centerZero: true,
    params: {},
    stamp(ctx) {
      ctx.resistor(ctx.node('low'), ctx.node('minus'), WIRE_R);
      ctx.resistor(ctx.node('high'), ctx.node('minus'), WIRE_R);
    }
  },
  voltmeter: {
    label: '电压表', kind: 'meter', terminals: ['minus', 'low', 'high'],
    termLabels: { minus: '−', low: '3', high: '15' },
    ranges: { low: 3, high: 15 }, // V
    params: {},
    stamp(ctx) {
      // 理想电压表：视为开路（1 GΩ 模型内阻，使串入电路时电路几乎不通）
      ctx.resistor(ctx.node('low'), ctx.node('minus'), OPEN_R);
      ctx.resistor(ctx.node('high'), ctx.node('minus'), OPEN_R);
    }
  },

  diode: {
    label: '二极管', kind: 'semiconductor', terminals: ['an', 'ka'],
    params: {},
    stamp(ctx, comp) {
      if (ctx.state.diodeOn.get(comp.id)) ctx.resistor(ctx.node('an'), ctx.node('ka'), WIRE_R);
    }
  },
  led: {
    label: '发光二极管', kind: 'semiconductor', terminals: ['an', 'ka'],
    params: { litThreshold: { label: '点亮电流', min: 0.005, max: 0.05, step: 0.005, def: 0.01, unit: 'A' } },
    stamp(ctx, comp) {
      if (ctx.state.diodeOn.get(comp.id)) ctx.resistor(ctx.node('an'), ctx.node('ka'), WIRE_R);
    }
  },

  fuse: {
    label: '保险丝', kind: 'protection', terminals: ['a', 'b'],
    params: { rating: { label: '熔断电流', options: [1, 2, 3, 5], def: 2, unit: 'A' } },
    stamp(ctx, comp) {
      if (!comp.blown) ctx.resistor(ctx.node('a'), ctx.node('b'), WIRE_R);
    }
  },

  bell: {
    label: '电铃', kind: 'load', terminals: ['a', 'b'],
    params: {
      resistance: { label: '电阻', min: 5, max: 100, step: 5, def: 20, unit: 'Ω' },
      threshold: { label: '工作电流', min: 0.02, max: 0.5, step: 0.02, def: 0.1, unit: 'A' }
    },
    stamp(ctx, comp) { ctx.resistor(ctx.node('a'), ctx.node('b'), comp.params.resistance); }
  },
  motor: {
    label: '电动机', kind: 'load', terminals: ['a', 'b'],
    params: {
      resistance: { label: '电阻', min: 1, max: 50, step: 1, def: 8, unit: 'Ω' },
      threshold: { label: '工作电流', min: 0.02, max: 0.5, step: 0.02, def: 0.1, unit: 'A' }
    },
    stamp(ctx, comp) { ctx.resistor(ctx.node('a'), ctx.node('b'), comp.params.resistance); }
  }
};

export function defaultParams(type) {
  const def = DEFS[type];
  const p = {};
  for (const [key, cfg] of Object.entries(def.params)) p[key] = cfg.def;
  return p;
}

export function isSource(type) { return DEFS[type]?.kind === 'source'; }
export function isMeter(type) { return DEFS[type]?.kind === 'meter'; }
