// 电学实验台物理引擎测试：node 直接运行（无测试框架）。
// 每个用例给出手算依据；导线等理想导体含 1 mΩ 数值残余电阻，故用相对容差判定。
// 运行：node experiments/circuit-bench/tests/solver.test.mjs

import assert from 'node:assert/strict';
import { solveBench, reduceForWater } from '../src/physics/circuit.js';
import { nlBulbColdR, isSource } from '../src/physics/components.js';
import { PRESETS, instantiatePreset, findPreset } from '../data.js';

let uid = 0;
const comp = (type, params = {}, id) => ({ id: id ?? `c${++uid}`, type, params });
const wire = (aComp, aTerm, bComp, bTerm) => ({ id: `w${++uid}`, a: { comp: aComp, term: aTerm }, b: { comp: bComp, term: bTerm } });
const near = (actual, expected, rel = 0.01, msg = '') => {
  assert.ok(Math.abs(actual - expected) <= Math.max(Math.abs(expected) * rel, 1e-9),
    `${msg} 期望 ${expected}，实际 ${actual}`);
};
const nearAbs = (actual, expected, abs, msg = '') => {
  assert.ok(Math.abs(actual - expected) <= abs, `${msg} 期望 ${expected}±${abs}，实际 ${actual}`);
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// T1 单回路：3V + 10Ω + 电流表 → I≈0.3A，U_R≈3V，能量守恒
test('T1 单回路欧姆定律与能量守恒', () => {
  const s = comp('student-supply', { voltage: 3 });
  const r = comp('resistor', { resistance: 10 });
  const a = comp('ammeter', { range: 0.6 });
  const bench = {
    components: [s, r, a],
    wires: [wire(s.id, 'pos', a.id, 'plus'), wire(a.id, 'minus', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  assert.ok(out.ok);
  near(out.comps.get(a.id).reading, 0.3, 0.01, '电流表读数');
  near(out.comps.get(r.id).U, 3, 0.01, '电阻电压');
  near(out.comps.get(s.id).I, 0.3, 0.01, '电源输出电流');
  const pSource = out.comps.get(s.id).P;
  let pOthers = out.comps.get(r.id).P + out.comps.get(a.id).P;
  for (const w of out.wires.values()) pOthers += w.I * w.I * 1e-3;
  near(pOthers, pSource, 0.01, '能量守恒 P源=ΣP耗');
});

// T2 串联分压：3V，5Ω+10Ω → I≈0.2A，U_10≈2V，U_5≈1V
test('T2 串联电流相等与分压', () => {
  const s = comp('student-supply', { voltage: 3 });
  const r1 = comp('resistor', { resistance: 5 });
  const r2 = comp('resistor', { resistance: 10 });
  const bench = {
    components: [s, r1, r2],
    wires: [wire(s.id, 'pos', r1.id, 'a'), wire(r1.id, 'b', r2.id, 'a'), wire(r2.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  near(out.comps.get(r1.id).I, 0.2, 0.01, '串联电流');
  near(out.comps.get(r2.id).I, 0.2, 0.01, '串联电流处处相等');
  near(out.comps.get(r2.id).U, 2, 0.01, '10Ω 分压');
  near(out.comps.get(r1.id).U, 1, 0.01, '5Ω 分压');
});

// T3 并联分流：6V，6Ω‖3Ω → I6≈1A，I3≈2A，I总≈3A，各支路电压相等
test('T3 并联电压相等与分流', () => {
  const s = comp('battery-pack', { cells: 4 });
  const r1 = comp('resistor', { resistance: 6 });
  const r2 = comp('resistor', { resistance: 3 });
  const bench = {
    components: [s, r1, r2],
    wires: [
      wire(s.id, 'pos', r1.id, 'a'), wire(s.id, 'pos', r2.id, 'a'),
      wire(r1.id, 'b', s.id, 'neg'), wire(r2.id, 'b', s.id, 'neg')
    ]
  };
  const out = solveBench(bench);
  near(out.comps.get(r1.id).U, 6, 0.01, '并联支路电压');
  near(out.comps.get(r2.id).U, 6, 0.01, '并联支路电压相等');
  near(out.comps.get(r1.id).I, 1, 0.01, '6Ω 支路电流');
  near(out.comps.get(r2.id).I, 2, 0.01, '3Ω 支路电流');
  near(out.comps.get(s.id).I, 3, 0.01, '干路总电流');
});

// T4 断路：开关断开 → I≈0
test('T4 断路无电流', () => {
  const s = comp('student-supply', { voltage: 3 });
  const sw = comp('switch', { closed: false });
  const r = comp('resistor', { resistance: 10 });
  const bench = {
    components: [s, sw, r],
    wires: [wire(s.id, 'pos', sw.id, 'a'), wire(sw.id, 'b', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  assert.ok(Math.abs(out.comps.get(r.id).I) < 1e-6, '断路电流应为零');
});

// T5 双控楼梯灯：两只单刀双掷，(x,x)/(y,y) 亮，(x,y)/(y,x) 灭
test('T5 双控开关四种组合', () => {
  const build = (p1, p2) => {
    const s = comp('student-supply', { voltage: 3 });
    const s1 = comp('spdt-switch', { position: p1 });
    const s2 = comp('spdt-switch', { position: p2 });
    const b = comp('bulb', { resistance: 10, ratedP: 1 });
    return {
      components: [s, s1, s2, b],
      wires: [
        wire(s.id, 'pos', s1.id, 'com'),
        wire(s1.id, 'x', s2.id, 'x'), wire(s1.id, 'y', s2.id, 'y'),
        wire(s2.id, 'com', b.id, 'a'), wire(b.id, 'b', s.id, 'neg')
      ]
    };
  };
  const on = (p1, p2) => Math.abs(solveBench(build(p1, p2)).comps.values().find(r => r.brightness !== undefined).I) > 0.1;
  assert.equal(on('x', 'x'), true, '(x,x) 应导通');
  assert.equal(on('x', 'y'), false, '(x,y) 应断开');
  assert.equal(on('y', 'x'), false, '(y,x) 应断开');
  assert.equal(on('y', 'y'), true, '(y,y) 应导通');
});

// T6 电源短路：只有导线 → 报短路事件，电流有限且远大于 100A
test('T6 短路检测', () => {
  const s = comp('student-supply', { voltage: 3 });
  const bench = { components: [s], wires: [wire(s.id, 'pos', s.id, 'neg')] };
  const out = solveBench(bench);
  assert.ok(out.events.some(e => e.type === 'short'), '应报告短路事件');
  assert.ok(Math.abs(out.comps.get(s.id).I) > 100, '短路电流应超过阈值');
  assert.ok(Number.isFinite(out.comps.get(s.id).I), '短路电流必须为有限值');
});

// T7 保险丝：短路时熔断，熔断后电流为零
test('T7 保险丝熔断保护', () => {
  const s = comp('student-supply', { voltage: 15 });
  const f = comp('fuse', { rating: 2 });
  const bench = {
    components: [s, f],
    wires: [wire(s.id, 'pos', f.id, 'a'), wire(f.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  assert.ok(out.events.some(e => e.type === 'fuse-blown' && e.id === f.id), '应报告熔断事件');
  assert.equal(out.comps.get(f.id).blown, true, '保险丝应处于熔断状态');
  assert.ok(Math.abs(out.comps.get(s.id).I) < 1e-6, '熔断后电流应为零');
});

// T8 非线性灯泡：2.5V 额定下 I≈0.3A，热态电阻明显大于冷态
test('T8 非线性灯泡收敛与冷热电阻', () => {
  const s = comp('student-supply', { voltage: 2.5 });
  const b = comp('bulb-nl', { ratedU: 2.5, ratedI: 0.3 });
  const bench = {
    components: [s, b],
    wires: [wire(s.id, 'pos', b.id, 'a'), wire(b.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  assert.ok(out.converged, '非线性求解应收敛');
  const r = out.comps.get(b.id);
  near(r.I, 0.3, 0.02, '额定电压下电流');
  const cold = nlBulbColdR(2.5, 0.3);
  assert.ok(r.rNow > cold * 5, `热态电阻 ${r.rNow} 应远大于冷态 ${cold}`);
});

// T9 二极管单向导电：正向导通，反向截止
test('T9 二极管单向导电', () => {
  const build = (forward) => {
    const s = comp('student-supply', { voltage: 3 });
    const d = comp('diode', {});
    const r = comp('resistor', { resistance: 10 });
    return {
      components: [s, d, r],
      wires: forward
        ? [wire(s.id, 'pos', d.id, 'an'), wire(d.id, 'ka', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
        : [wire(s.id, 'pos', d.id, 'ka'), wire(d.id, 'an', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
    };
  };
  const fwd = solveBench(build(true));
  const rev = solveBench(build(false));
  const rd = [...fwd.comps.values()].find(o => o.conducting !== undefined);
  near(rd.I, 0.3, 0.01, '正向电流');
  assert.equal(rd.conducting, true, '正向应导通');
  const rr = [...rev.comps.values()].find(o => o.conducting !== undefined);
  assert.ok(Math.abs(rr.I) < 1e-6, '反向电流应为零');
  assert.equal(rr.conducting, false, '反向应截止');
});

// T10 LED 正向点亮
test('T10 发光二极管点亮', () => {
  const s = comp('student-supply', { voltage: 3 });
  const l = comp('led', { litThreshold: 0.01 });
  const r = comp('resistor', { resistance: 100 });
  const bench = {
    components: [s, l, r],
    wires: [wire(s.id, 'pos', l.id, 'an'), wire(l.id, 'ka', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  const rl = out.comps.get(l.id);
  near(rl.I, 0.03, 0.01, 'LED 电流');
  assert.equal(rl.lit, true, 'LED 应点亮');
});

// T11 电流表正负接反：读数为负（指针反打）
test('T11 电流表反接读数为负', () => {
  const s = comp('student-supply', { voltage: 3 });
  const r = comp('resistor', { resistance: 10 });
  const a = comp('ammeter', { range: 0.6 });
  const bench = {
    components: [s, r, a],
    wires: [wire(s.id, 'pos', a.id, 'minus'), wire(a.id, 'plus', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  near(out.comps.get(a.id).reading, -0.3, 0.01, '反接读数应为负');
});

// T12 电压表并在断开开关两端：读数≈电源电压
test('T12 电压表测断开开关两端', () => {
  const s = comp('student-supply', { voltage: 3 });
  const sw = comp('switch', { closed: false });
  const r = comp('resistor', { resistance: 10 });
  const vm = comp('voltmeter', { range: 3 });
  const bench = {
    components: [s, sw, r, vm],
    wires: [
      wire(s.id, 'pos', sw.id, 'a'), wire(sw.id, 'b', r.id, 'a'), wire(r.id, 'b', s.id, 'neg'),
      wire(vm.id, 'plus', sw.id, 'a'), wire(vm.id, 'minus', sw.id, 'b')
    ]
  };
  const out = solveBench(bench);
  near(out.comps.get(vm.id).reading, 3, 0.01, '电压表应读出电源电压');
  assert.ok(Math.abs(out.comps.get(r.id).I) < 1e-6, '回路电流应为零');
});

// T13 电压表串入电路：电路几乎不通，电压表读数≈电源电压
test('T13 电压表串联的错误接法', () => {
  const s = comp('student-supply', { voltage: 3 });
  const vm = comp('voltmeter', { range: 3 });
  const b = comp('bulb', { resistance: 10, ratedP: 1 });
  const bench = {
    components: [s, vm, b],
    wires: [wire(s.id, 'pos', vm.id, 'plus'), wire(vm.id, 'minus', b.id, 'a'), wire(b.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  assert.ok(Math.abs(out.comps.get(b.id).I) < 1e-6, '灯泡应几乎无电流');
  near(out.comps.get(vm.id).reading, 3, 0.01, '电压表应近似读出电源电压');
});

// T14 滑动变阻器：x=0.5、max=50 → a-c 间 25Ω
test('T14 滑动变阻器分阻', () => {
  const s = comp('student-supply', { voltage: 3 });
  const rh = comp('rheostat', { max: 50, x: 0.5 });
  const bench = {
    components: [s, rh],
    wires: [wire(s.id, 'pos', rh.id, 'a'), wire(rh.id, 'c', s.id, 'neg')]
  };
  const out = solveBench(bench);
  near(out.comps.get(rh.id).Iac, 0.12, 0.01, 'a-c 支路电流 3/25');
});

// T15 水路类比拓扑约化：串联 / 并联 / 含电流表的串联
test('T15 水路类比拓扑约化', () => {
  const series = reduceForWater({
    components: [
      { id: 's', type: 'student-supply', params: { voltage: 3 } },
      { id: 'b1', type: 'bulb', params: {} },
      { id: 'b2', type: 'bulb', params: {} }
    ],
    wires: [
      { id: 'w1', a: { comp: 's', term: 'pos' }, b: { comp: 'b1', term: 'a' } },
      { id: 'w2', a: { comp: 'b1', term: 'b' }, b: { comp: 'b2', term: 'a' } },
      { id: 'w3', a: { comp: 'b2', term: 'b' }, b: { comp: 's', term: 'neg' } }
    ]
  });
  assert.equal(series?.mode, 'series', '应识别为串联');
  const parallel = reduceForWater({
    components: [
      { id: 's', type: 'student-supply', params: { voltage: 3 } },
      { id: 'b1', type: 'bulb', params: {} },
      { id: 'b2', type: 'bulb', params: {} }
    ],
    wires: [
      { id: 'w1', a: { comp: 's', term: 'pos' }, b: { comp: 'b1', term: 'a' } },
      { id: 'w2', a: { comp: 's', term: 'pos' }, b: { comp: 'b2', term: 'a' } },
      { id: 'w3', a: { comp: 'b1', term: 'b' }, b: { comp: 's', term: 'neg' } },
      { id: 'w4', a: { comp: 'b2', term: 'b' }, b: { comp: 's', term: 'neg' } }
    ]
  });
  assert.equal(parallel?.mode, 'parallel', '应识别为并联');
  const withMeter = reduceForWater({
    components: [
      { id: 's', type: 'student-supply', params: { voltage: 3 } },
      { id: 'a', type: 'ammeter', params: {} },
      { id: 'r', type: 'resistor', params: {} }
    ],
    wires: [
      { id: 'w1', a: { comp: 's', term: 'pos' }, b: { comp: 'a', term: 'plus' } },
      { id: 'w2', a: { comp: 'a', term: 'minus' }, b: { comp: 'r', term: 'a' } },
      { id: 'w3', a: { comp: 'r', term: 'b' }, b: { comp: 's', term: 'neg' } }
    ]
  });
  assert.equal(withMeter?.mode, 'series', '含电流表的串联应可约化');
  const messy = reduceForWater({
    components: [
      { id: 's1', type: 'student-supply', params: { voltage: 3 } },
      { id: 's2', type: 'battery-pack', params: { cells: 2 } }
    ],
    wires: []
  });
  assert.equal(messy, null, '双电源不可约化');
});

// T16 两个不同电压电源并联：环流巨大 → 短路事件（安全演示）
test('T16 异压电源并联环流', () => {
  const s1 = comp('battery-pack', { cells: 4 }); // 6V
  const s2 = comp('battery-pack', { cells: 2 }); // 3V
  const bench = {
    components: [s1, s2],
    wires: [wire(s1.id, 'pos', s2.id, 'pos'), wire(s1.id, 'neg', s2.id, 'neg')]
  };
  const out = solveBench(bench);
  assert.ok(out.events.some(e => e.type === 'short'), '应报告短路事件');
});

// T17 电势范围：3V 电源单回路，电势应在 [0, 3] 附近
test('T17 节点电势范围', () => {
  const s = comp('student-supply', { voltage: 3 });
  const r = comp('resistor', { resistance: 10 });
  const bench = {
    components: [s, r],
    wires: [wire(s.id, 'pos', r.id, 'a'), wire(r.id, 'b', s.id, 'neg')]
  };
  const out = solveBench(bench);
  nearAbs(out.pMin, 0, 0.005, '最低电势接近 0');
  near(out.pMax, 3, 0.01, '最高电势接近电源电压');
  // 电阻正端电势应接近 3V，负端接近 0V（导线残余电阻带来约 0.3mV 偏差）
  near(out.v[out.nodeOf.get(`${r.id}:a`)], 3, 0.01, '电阻正端电势');
  nearAbs(out.v[out.nodeOf.get(`${r.id}:b`)], 0, 0.005, '电阻负端电势');
});

// T18 全部预设：实例化（默认参数合并）+ 求解行为抽查
test('T18 预设实例化与物理行为', () => {
  assert.equal(PRESETS.length, 15, '预设数量');
  for (const preset of PRESETS) {
    const bench = instantiatePreset(preset, (p, i) => `${preset.id}-${p}${i}`);
    const out = solveBench(bench);
    assert.ok(out.ok, `${preset.id} 应可求解`);
    if (preset.group === 'good') {
      const source = bench.components.find(c => isSource(c.type));
      const srcOut = out.comps.get(source.id);
      assert.ok(srcOut && Math.abs(srcOut.I) > 0.01, `${preset.id} 好电路应导通（电源输出电流 > 10mA）`);
    }
  }
  // 默认参数合并：good-simple 的开关应默认闭合
  const simple = instantiatePreset(findPreset('good-simple'), (p, i) => `${p}${i}`);
  assert.equal(simple.components.find(c => c.type === 'switch').params.closed, true, '预设空 params 不应覆盖默认闭合');
  // 错误电路的关键行为
  const bad = (id) => solveBench(instantiatePreset(findPreset(id), (p, i) => `${p}${i}`));
  assert.ok(bad('bad-short').events.some(e => e.type === 'short'), 'bad-short 应报短路');
  assert.ok(bad('bad-short-fuse').events.some(e => e.type === 'fuse-blown'), 'bad-short-fuse 应报熔断');
  const openOut = bad('bad-open');
  assert.ok(Math.abs([...openOut.comps.values()].find(r => r.brightness !== undefined).I) < 1e-6, 'bad-open 灯泡应无电流');
  const revOut = bad('bad-ammeter-reversed');
  assert.ok([...revOut.comps.values()].find(r => r.reading !== undefined).reading < 0, 'bad-ammeter-reversed 读数应为负');
  const vmSeries = bad('bad-voltmeter-series');
  near([...vmSeries.comps.values()].find(r => r.reading !== undefined).reading, 3, 0.01, 'bad-voltmeter-series 电压表应近似电源电压');
});

let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${tests.length} 通过`);
