// 实物台渲染层：拟真元件 pictorial（SVG 程序绘制）、接线柱几何、导线贝塞尔。
// 只负责“画”，物理求解在 physics 层，交互事件通过 hooks 回调给 ui 层。

import { WIRE_SPECIMENS } from '../../data.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}
export function text(parent, str, attrs = {}) {
  const t = el('text', attrs, parent);
  t.textContent = str;
  return t;
}

// —— 元件几何与绘制定义 ——
// terms: 端子相对坐标；pos/neg 决定接线柱颜色；label 为 +/− 标注
const T = (x, y, cls = 'plain', label = '') => ({ x, y, cls, label });

export const GEOMETRY = {
  'student-supply': {
    w: 230, h: 150,
    terms: { pos: T(206, 92, 'pos', '+'), neg: T(206, 124, 'neg', '−') },
    draw(g, comp) {
      frame(g, 230, 150);
      text(g, '学生电源', { x: 14, y: 26, class: 'comp-sub', 'text-anchor': 'start' });
      el('rect', { x: 18, y: 40, width: 92, height: 34, rx: 3, class: 'meter-face' }, g);
      text(g, '', { x: 64, y: 62, class: 'meter-text supply-volt', 'font-size': 13 });
      text(g, '直流输出 DC', { x: 18, y: 90, class: 'comp-sub', 'text-anchor': 'start' });
      const knob = el('g', { class: 'supply-knob' }, g);
      el('circle', { cx: 70, cy: 118, r: 17, class: 'meter-face' }, knob);
      el('line', { x1: 70, y1: 118, x2: 70, y2: 105, class: 'needle' }, knob);
      text(g, '调压', { x: 100, y: 122, class: 'comp-sub', 'text-anchor': 'start' });
      // 接线柱基座
      el('rect', { x: 190, y: 80, width: 30, height: 58, rx: 4, fill: 'rgba(138,198,218,.08)' }, g);
    },
    update(g, comp) {
      const v = comp.params.voltage ?? 3;
      g.querySelector('.supply-volt').textContent = `${v.toFixed(1)} V`;
      const frac = (v - 1.5) / (15 - 1.5);
      g.querySelector('.supply-knob').setAttribute('transform', `rotate(${-135 + frac * 270} 70 118)`);
    }
  },
  'battery-pack': {
    w: 220, h: 130,
    terms: { pos: T(198, 44, 'pos', '+'), neg: T(198, 92, 'neg', '−') },
    draw(g, comp) {
      frame(g, 220, 130);
      const cells = comp.params.cells ?? 2;
      for (let i = 0; i < cells; i++) {
        const cx = 22 + i * 40;
        el('rect', { x: cx, y: 46, width: 34, height: 40, rx: 5, fill: 'rgba(96,221,255,.08)', stroke: 'rgba(138,198,218,.35)' }, g);
        el('rect', { x: cx + 12, y: 40, width: 10, height: 6, rx: 1.5, fill: 'rgba(138,198,218,.4)' }, g);
        text(g, '+', { x: cx + 17, y: 68, class: 'term-label pos' });
      }
      text(g, `干电池组 ×${cells}`, { x: 14, y: 26, class: 'comp-sub', 'text-anchor': 'start' });
      text(g, `${((comp.params.cells ?? 2) * 1.5).toFixed(1)} V`, { x: 14, y: 112, class: 'comp-sub', 'text-anchor': 'start' });
    }
  },
  accumulator: {
    w: 170, h: 130,
    terms: { pos: T(148, 44, 'pos', '+'), neg: T(148, 92, 'neg', '−') },
    draw(g, comp) {
      frame(g, 170, 130);
      el('rect', { x: 20, y: 40, width: 104, height: 62, rx: 4, fill: 'rgba(96,221,255,.05)', stroke: 'rgba(138,198,218,.3)' }, g);
      for (let i = 0; i < 4; i++) {
        el('line', { x1: 34 + i * 24, y1: 52, x2: 34 + i * 24, y2: 90, stroke: i % 2 ? 'rgba(255,157,138,.55)' : 'rgba(127,183,204,.55)', 'stroke-width': 5 }, g);
      }
      text(g, '蓄电池', { x: 14, y: 26, class: 'comp-sub', 'text-anchor': 'start' });
      text(g, `${comp.params.voltage ?? 2} V`, { x: 14, y: 118, class: 'comp-sub', 'text-anchor': 'start' });
    }
  },
  switch: {
    w: 180, h: 110,
    terms: { a: T(16, 62), b: T(164, 62) },
    draw(g, comp) {
      frame(g, 180, 110);
      el('rect', { x: 12, y: 48, width: 156, height: 34, rx: 4, fill: 'rgba(138,198,218,.06)' }, g);
      post(g, 30, 62); post(g, 150, 62);
      const blade = el('g', { class: 'blade' }, g);
      el('line', { x1: 30, y1: 62, x2: 146, y2: 62, stroke: '#c8cfd4', 'stroke-width': 5, 'stroke-linecap': 'round' }, blade);
      el('circle', { cx: 143, cy: 62, r: 5, fill: '#c8cfd4' }, blade);
      text(g, '开关', { x: 90, y: 26, class: 'comp-sub' });
      text(g, comp.params.closed ? '闭合' : '断开', { x: 90, y: 100, class: 'comp-sub switch-state' });
    },
    update(g, comp) {
      const closed = comp.params.closed;
      g.querySelector('.blade').setAttribute('transform', closed ? '' : `rotate(-32 30 62)`);
      const st = g.querySelector('.switch-state');
      if (st) st.textContent = closed ? '闭合' : '断开';
    }
  },
  'spdt-switch': {
    w: 210, h: 130,
    terms: { com: T(16, 92), x: T(194, 44), y: T(194, 92) },
    draw(g, comp) {
      frame(g, 210, 130);
      post(g, 32, 92); post(g, 176, 44); post(g, 176, 92);
      const blade = el('g', { class: 'blade' }, g);
      el('line', { x1: 32, y1: 92, x2: 172, y2: 46, stroke: '#c8cfd4', 'stroke-width': 5, 'stroke-linecap': 'round' }, blade);
      text(g, '单刀双掷', { x: 105, y: 26, class: 'comp-sub' });
      text(g, 'X', { x: 190, y: 30, class: 'comp-sub' });
      text(g, 'Y', { x: 190, y: 118, class: 'comp-sub' });
    },
    update(g, comp) {
      const toY = comp.params.position === 'y';
      // 刀闸从 com(32,92) 出发：x 触点指向 (172,46)，y 触点指向 (172,92)
      const angle = toY ? 17.5 : -17.5;
      g.querySelector('.blade').setAttribute('transform', `rotate(${angle} 32 92)`);
    }
  },
  resistor: {
    w: 170, h: 90,
    terms: { a: T(10, 45), b: T(160, 45) },
    draw(g, comp) {
      el('rect', { x: 24, y: 28, width: 122, height: 34, rx: 16, fill: 'rgba(255,213,150,.1)', stroke: 'rgba(255,213,150,.4)' }, g);
      for (let i = 0; i < 4; i++) {
        el('line', { x1: 46 + i * 22, y1: 28, x2: 46 + i * 22, y2: 62, stroke: ['#c96', '#444', '#d4af37', '#8ab'][i], 'stroke-width': 5 }, g);
      }
      text(g, `${fmtR(comp.params.resistance ?? 10)}`, { x: 85, y: 80, class: 'comp-label' });
    }
  },
  rheostat: {
    w: 260, h: 140,
    terms: { a: T(14, 72), b: T(246, 72), c: T(130, 14) },
    draw(g, comp) {
      frame(g, 260, 140);
      // 瓷筒与电阻丝
      el('rect', { x: 26, y: 58, width: 208, height: 28, rx: 12, fill: 'rgba(138,198,218,.08)', stroke: 'rgba(138,198,218,.3)' }, g);
      let d = 'M 32 72';
      for (let i = 0; i < 24; i++) d += ` l 4.2 ${i % 2 ? 10 : -10}`;
      el('path', { d, fill: 'none', stroke: 'rgba(255,213,150,.5)', 'stroke-width': 1.4 }, g);
      // 金属杆与滑片
      el('line', { x1: 26, y1: 30, x2: 234, y2: 30, stroke: '#8fa9b6', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      const slider = el('g', { class: 'rheo-slider' }, g);
      el('rect', { x: -8, y: 24, width: 16, height: 40, rx: 3, fill: '#3d5468', stroke: 'rgba(96,221,255,.5)' }, slider);
      text(g, '滑动变阻器', { x: 130, y: 118, class: 'comp-sub' });
      text(g, '', { x: 130, y: 132, class: 'comp-sub rheo-val' });
    },
    update(g, comp) {
      const x = comp.params.x ?? 0.5;
      const max = comp.params.max ?? 50;
      g.querySelector('.rheo-slider').setAttribute('transform', `translate(${26 + x * 208}, 0)`);
      g.querySelector('.rheo-val').textContent = `接入 ${(x * max).toFixed(0)} Ω / ${max} Ω`;
    }
  },
  'resistance-box': {
    w: 180, h: 120,
    terms: { a: T(14, 66), b: T(166, 66) },
    draw(g, comp) {
      frame(g, 180, 120);
      el('rect', { x: 20, y: 26, width: 140, height: 36, rx: 3, class: 'meter-face' }, g);
      text(g, '', { x: 90, y: 49, class: 'meter-text box-val', 'font-size': 13 });
      el('circle', { cx: 90, cy: 88, r: 14, class: 'meter-face' }, g);
      el('line', { x1: 90, y1: 88, x2: 90, y2: 78, class: 'needle' }, g);
      text(g, '电阻箱', { x: 130, y: 93, class: 'comp-sub' });
    },
    update(g, comp) {
      g.querySelector('.box-val').textContent = `${comp.params.resistance ?? 5} Ω`;
    }
  },
  'wire-board': {
    w: 280, h: 110,
    terms: { a: T(14, 55), b: T(266, 55) },
    draw(g, comp) {
      frame(g, 280, 110);
      post(g, 26, 55); post(g, 254, 55);
      let d = 'M 26 55';
      for (let i = 0; i < 28; i++) d += ` l 8.15 ${i % 2 ? 7 : -7}`;
      el('path', { d, fill: 'none', stroke: 'rgba(255,213,150,.55)', 'stroke-width': 1.6 }, g);
      text(g, '电阻丝实验板', { x: 140, y: 24, class: 'comp-sub' });
      text(g, '', { x: 140, y: 96, class: 'comp-sub specimen-label' });
    },
    update(g, comp) {
      const spec = WIRE_SPECIMENS.find(s => s.id === comp.params.specimen) ?? WIRE_SPECIMENS[1];
      g.querySelector('.specimen-label').textContent = `${spec.label} ≈ ${spec.R} Ω`;
    }
  },
  diode: {
    w: 130, h: 90,
    terms: { an: T(8, 45), ka: T(122, 45) },
    draw(g, comp) {
      el('rect', { x: 22, y: 33, width: 86, height: 24, rx: 11, fill: 'rgba(150,170,190,.14)', stroke: 'rgba(150,170,190,.45)' }, g);
      el('rect', { x: 88, y: 33, width: 10, height: 24, fill: 'rgba(237,248,251,.6)' }, g);
      el('path', { d: 'M 50 38 L 66 45 L 50 52 Z', fill: 'rgba(96,221,255,.5)' }, g);
      el('line', { x1: 68, y1: 37, x2: 68, y2: 53, stroke: 'rgba(96,221,255,.5)', 'stroke-width': 2 }, g);
      text(g, '二极管', { x: 65, y: 80, class: 'comp-sub' });
    }
  },
  led: {
    w: 130, h: 110,
    terms: { an: T(30, 96), ka: T(100, 96) },
    draw(g, comp) {
      el('line', { x1: 46, y1: 58, x2: 34, y2: 90, stroke: '#8fa9b6', 'stroke-width': 2.4 }, g);
      el('line', { x1: 84, y1: 58, x2: 96, y2: 90, stroke: '#8fa9b6', 'stroke-width': 2.4 }, g);
      el('path', { d: 'M 42 58 A 23 23 0 0 1 88 58 L 84 62 L 46 62 Z', class: 'led-dome', fill: 'rgba(96,221,255,.12)', stroke: 'rgba(96,221,255,.45)' }, g);
      el('path', { d: 'M 55 48 L 63 40 M 61 52 L 71 46', stroke: 'rgba(255,213,150,.7)', 'stroke-width': 1.4 }, g);
      text(g, 'LED', { x: 65, y: 84, class: 'comp-sub' });
    },
    update(g, comp, result) {
      g.querySelector('.led-dome').classList.toggle('lit', !!result?.lit);
    }
  },
  bulb: {
    w: 150, h: 140,
    terms: { a: T(18, 124), b: T(132, 124) },
    draw: drawBulb,
    update: updateBulb
  },
  'bulb-nl': {
    w: 150, h: 140,
    terms: { a: T(18, 124), b: T(132, 124) },
    draw: drawBulb,
    update: updateBulb
  },
  ammeter: meterGeometry('A', '电流表', a => `${fmtA(a)}`),
  voltmeter: meterGeometry('V', '电压表', v => `${fmtV(v)}`),
  galvanometer: meterGeometry('G', '灵敏电流计', a => `${fmtA(a)}`, true),
  fuse: {
    w: 150, h: 90,
    terms: { a: T(8, 45), b: T(142, 45) },
    draw(g, comp) {
      el('rect', { x: 20, y: 33, width: 110, height: 24, rx: 11, fill: 'rgba(180,220,240,.07)', stroke: 'rgba(180,220,240,.4)' }, g);
      el('line', { x1: 24, y1: 45, x2: 126, y2: 45, class: 'fuse-wire', stroke: '#d8a75e', 'stroke-width': 2 }, g);
      const broken = el('g', { class: 'fuse-broken', visibility: 'hidden' }, g);
      el('line', { x1: 24, y1: 45, x2: 66, y2: 45, stroke: '#d8a75e', 'stroke-width': 2 }, broken);
      el('line', { x1: 84, y1: 45, x2: 126, y2: 45, stroke: '#d8a75e', 'stroke-width': 2 }, broken);
      el('path', { d: 'M 70 40 l 6 -6 M 74 46 l 8 -3 M 70 50 l 7 5', stroke: '#ff9f74', 'stroke-width': 1.6 }, broken);
      text(g, `保险丝 ${comp.params.rating ?? 2}A`, { x: 75, y: 78, class: 'comp-sub' });
    },
    update(g, comp, result) {
      const blown = !!result?.blown;
      g.querySelector('.fuse-wire').setAttribute('visibility', blown ? 'hidden' : 'visible');
      g.querySelector('.fuse-broken').setAttribute('visibility', blown ? 'visible' : 'hidden');
    }
  },
  bell: {
    w: 150, h: 130,
    terms: { a: T(18, 112), b: T(132, 112) },
    draw(g, comp) {
      el('path', { d: 'M 35 78 A 40 40 0 0 1 115 78 L 110 84 L 40 84 Z', fill: 'rgba(255,213,150,.12)', stroke: 'rgba(255,213,150,.45)' }, g);
      el('circle', { cx: 75, cy: 44, r: 5, fill: 'rgba(255,213,150,.45)' }, g);
      const hammer = el('g', { class: 'bell-hammer' }, g);
      el('line', { x1: 118, y1: 92, x2: 100, y2: 72, stroke: '#8fa9b6', 'stroke-width': 2.4 }, hammer);
      el('circle', { cx: 99, cy: 70, r: 5, fill: '#8fa9b6' }, hammer);
      text(g, '电铃', { x: 75, y: 108, class: 'comp-sub' });
    },
    update(g, comp, result) {
      g.classList.toggle('active-load', !!result?.active);
    }
  },
  motor: {
    w: 160, h: 140,
    terms: { a: T(18, 122), b: T(142, 122) },
    draw(g, comp) {
      el('circle', { cx: 80, cy: 62, r: 38, fill: 'rgba(96,221,255,.06)', stroke: 'rgba(138,198,218,.4)' }, g);
      el('circle', { cx: 80, cy: 62, r: 38, fill: 'none', stroke: 'rgba(138,198,218,.15)', 'stroke-dasharray': '4 6' }, g);
      const fan = el('g', { class: 'motor-fan' }, g);
      for (const a of [0, 90, 180, 270]) {
        el('line', { x1: 80, y1: 62, x2: 80, y2: 36, stroke: '#9fc3d4', 'stroke-width': 5, 'stroke-linecap': 'round', transform: `rotate(${a} 80 62)` }, fan);
      }
      el('circle', { cx: 80, cy: 62, r: 7, fill: '#3d5468', stroke: 'rgba(96,221,255,.5)' }, fan);
      text(g, '电动机', { x: 80, y: 122, class: 'comp-sub' });
    },
    update(g, comp, result) {
      g.classList.toggle('active-load', !!result?.active);
    }
  }
};

function frame(g, w, h) {
  el('rect', { x: 1, y: 1, width: w - 2, height: h - 2, rx: 8, class: 'comp-frame' }, g);
}
function post(g, x, y) {
  el('circle', { cx: x, cy: y, r: 6, fill: '#22303e', stroke: 'rgba(138,198,218,.5)', 'stroke-width': 1.4 }, g);
  el('circle', { cx: x, cy: y, r: 2.4, fill: 'rgba(138,198,218,.5)' }, g);
}

function drawBulb(g, comp) {
  const nl = comp.type === 'bulb-nl';
  if (nl) el('rect', { x: 1, y: 1, width: 148, height: 138, rx: 8, class: 'comp-frame bulb-nl-frame' }, g);
  // 灯座
  el('rect', { x: 58, y: 96, width: 34, height: 20, rx: 3, fill: '#22303e', stroke: 'rgba(138,198,218,.4)' }, g);
  el('path', { d: 'M 60 100 l 30 0 M 60 105 l 30 0 M 60 110 l 30 0', stroke: 'rgba(138,198,218,.3)', 'stroke-width': 1 }, g);
  // 引线
  el('line', { x1: 24, y1: 120, x2: 60, y2: 108, stroke: '#8fa9b6', 'stroke-width': 2 }, g);
  el('line', { x1: 126, y1: 120, x2: 90, y2: 108, stroke: '#8fa9b6', 'stroke-width': 2 }, g);
  // 玻璃泡与灯丝
  el('circle', { cx: 75, cy: 62, r: 34, class: 'bulb-glass', 'stroke-width': 1.4 }, g);
  el('path', { d: 'M 60 96 L 66 70 M 90 96 L 84 70', stroke: '#8fa9b6', 'stroke-width': 1.6, fill: 'none' }, g);
  el('path', { d: 'M 62 70 q 3 -7 6 0 q 3 7 6 0 q 3 -7 6 0 q 3 7 6 0 q 3 -7 6 0', class: 'filament' }, g);
  const label = nl ? '小灯泡 · 非线性' : '小灯泡';
  text(g, label, { x: 75, y: 134, class: 'comp-sub' });
  if (nl) text(g, 'R 随温度变化', { x: 75, y: 12, class: 'comp-sub', dy: 2 });
}
function updateBulb(g, comp, result) {
  const glass = g.querySelector('.bulb-glass');
  const b = result?.brightness ?? 0;
  glass.classList.toggle('on', b > 0.03);
  glass.style.opacity = b > 0.03 ? String(Math.min(1, 0.25 + b * 0.75)) : '';
}

function meterGeometry(symbol, name, fmt, centerZero = false) {
  return {
    w: 170, h: 150,
    terms: { plus: T(30, 134, 'pos', '+'), minus: T(140, 134, 'neg', centerZero ? '−' : '−') },
    draw(g, comp) {
      frame(g, 170, 150);
      // 半圆表盘
      el('path', { d: 'M 27 92 A 58 58 0 0 1 143 92 Z', class: 'meter-face' }, g);
      const range = comp.params.range ?? (centerZero ? 0.3 : 0.6);
      for (let i = 0; i <= 10; i++) {
        const ang = (-62 + i * 12.4) * Math.PI / 180;
        const x1 = 85 + Math.sin(ang) * 50, y1 = 92 - Math.cos(ang) * 50;
        const x2 = 85 + Math.sin(ang) * 56, y2 = 92 - Math.cos(ang) * 56;
        el('line', { x1, y1, x2, y2, class: 'meter-tick' }, g);
      }
      text(g, centerZero ? '0' : '0', { x: centerZero ? 85 : 33, y: centerZero ? 46 : 78, class: 'meter-text' });
      if (!centerZero) text(g, `${range}`, { x: 137, y: 78, class: 'meter-text' });
      else { text(g, `${range}`, { x: 137, y: 78, class: 'meter-text' }); text(g, `${range}`, { x: 33, y: 78, class: 'meter-text' }); }
      text(g, symbol, { x: 85, y: 66, class: 'meter-text', 'font-size': 15, fill: '#9fc3d4' });
      const needle = el('g', { class: 'needle-g' }, g);
      el('line', { x1: 85, y1: 92, x2: 85, y2: 42, class: 'needle' }, needle);
      el('circle', { cx: 85, cy: 92, r: 4, fill: '#ff8f6a' }, g);
      text(g, name, { x: 85, y: 116, class: 'comp-sub' });
      text(g, '', { x: 85, y: 146, class: 'comp-sub meter-val' });
    },
    update(g, comp, result) {
      const range = comp.params.range ?? 1;
      const reading = result?.reading ?? 0;
      let frac = reading / range;
      let angle;
      if (centerZero) angle = Math.max(-1, Math.min(1, frac)) * 58;
      else angle = frac < 0 ? Math.max(frac, -0.12) * 58 : -58 + Math.min(1.04, frac) * 116;
      g.querySelector('.needle-g').setAttribute('transform', `rotate(${angle} 85 92)`);
      g.querySelector('.meter-val').textContent = result ? fmt(reading) : '';
      g.classList.toggle('overrange', !!result?.overrange);
    }
  };
}

export function fmtR(r) { return r >= 1000 ? `${(r / 1000).toFixed(r % 1000 ? 1 : 0)} kΩ` : `${r} Ω`; }
export function fmtA(a) { const v = Math.abs(a); return v < 0.01 && v > 0 ? `${(a * 1000).toFixed(1)} mA` : `${a.toFixed(3)} A`; }
export function fmtV(v) { return `${v.toFixed(2)} V`; }

// —— 实物台视图 ——
export class BenchView {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', '0 0 1600 1000');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.wireLayer = el('g', { class: 'wires-layer' }, svg);
    this.compLayer = el('g', { class: 'comps-layer' }, svg);
    this.flowLayer = el('g', { class: 'flow-layer' }, svg);
    this.potentialLayer = el('g', { class: 'potential-layer' }, svg);
    this.overlayLayer = el('g', { class: 'overlay-layer' }, svg);
    this.bench = { components: [], wires: [] };
    this.draft = null;
  }

  setBench(bench) {
    this.bench = bench;
    this.wireLayer.replaceChildren();
    this.compLayer.replaceChildren();
    this.flowLayer.replaceChildren();
    this.potentialLayer.replaceChildren();
    for (const w of bench.wires) this.addWireView(w);
    for (const c of bench.components) this.addComponentView(c);
  }

  geometryOf(comp) { return GEOMETRY[comp.type]; }

  terminalPos(compId, term) {
    const comp = this.bench.components.find(c => c.id === compId);
    if (!comp) return null;
    const geo = this.geometryOf(comp);
    const t = geo.terms[term];
    return t ? { x: comp.x + t.x, y: comp.y + t.y } : null;
  }

  addComponentView(comp) {
    const geo = this.geometryOf(comp);
    const g = el('g', {
      class: `comp comp-${comp.type}${comp.type === 'bulb-nl' ? ' bulb-nl' : ''}`,
      id: `comp-${comp.id}`,
      transform: `translate(${comp.x}, ${comp.y})`,
      tabindex: '0', role: 'button',
      'aria-label': DEFS_LABEL[comp.type] ?? comp.type
    }, this.compLayer);
    // 命中底板（无框元件也需要可拖动区域）
    el('rect', { x: -6, y: -6, width: geo.w + 12, height: geo.h + 12, fill: 'transparent', class: 'comp-hit' }, g);
    geo.draw(g, comp);
    geo.update?.(g, comp, null);
    // 接线柱
    for (const [term, t] of Object.entries(geo.terms)) {
      const tg = el('g', { class: 'terminal-g' }, g);
      el('circle', { cx: t.x, cy: t.y, r: 17, fill: 'transparent', class: 'terminal-hit', 'data-comp': comp.id, 'data-term': term }, tg);
      el('circle', { cx: t.x, cy: t.y, r: 7.5, class: `terminal ${t.cls}`, 'data-comp': comp.id, 'data-term': term }, tg);
      if (t.label) text(tg, t.label, { x: t.x, y: t.y - 13, class: `term-label ${t.cls}` });
    }
    return g;
  }

  removeComponentView(id) {
    this.compLayer.querySelector(`#comp-${CSS.escape(id)}`)?.remove();
  }

  redrawComponent(comp) {
    const old = this.compLayer.querySelector(`#comp-${CSS.escape(comp.id)}`);
    if (!old) return;
    const selected = old.classList.contains('selected');
    old.remove();
    const g = this.addComponentView(comp);
    // 保持图层顺序稳定：移到原位置近似（简单放到末尾即可）
    if (selected) g.classList.add('selected');
  }

  moveComponent(id, x, y) {
    const comp = this.bench.components.find(c => c.id === id);
    if (!comp) return;
    comp.x = x; comp.y = y;
    this.compLayer.querySelector(`#comp-${CSS.escape(id)}`)?.setAttribute('transform', `translate(${x}, ${y})`);
    for (const w of this.bench.wires) {
      if (w.a.comp === id || w.b.comp === id) this.updateWirePath(w);
    }
  }

  wirePath(w) {
    const p1 = this.terminalPos(w.a.comp, w.a.term);
    const p2 = this.terminalPos(w.b.comp, w.b.term);
    if (!p1 || !p2) return '';
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const slack = Math.min(90, Math.max(26, dist * 0.14));
    return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + slack}, ${p2.x} ${p2.y + slack}, ${p2.x} ${p2.y}`;
  }

  addWireView(w) {
    const g = el('g', { class: 'wire', id: `wire-${w.id}` }, this.wireLayer);
    el('path', { d: this.wirePath(w), class: 'wire-hit', 'data-wire': w.id }, g);
    el('path', { d: this.wirePath(w), class: 'wire-path' }, g);
  }

  removeWireView(id) {
    this.wireLayer.querySelector(`#wire-${CSS.escape(id)}`)?.remove();
  }

  updateWirePath(w) {
    const g = this.wireLayer.querySelector(`#wire-${CSS.escape(w.id)}`);
    if (!g) return;
    const d = this.wirePath(w);
    g.querySelector('.wire-path').setAttribute('d', d);
    g.querySelector('.wire-hit').setAttribute('d', d);
  }

  updateDynamic(results, bench) {
    for (const comp of bench.components) {
      const g = this.compLayer.querySelector(`#comp-${CSS.escape(comp.id)}`);
      if (!g) continue;
      const geo = this.geometryOf(comp);
      geo.update?.(g, comp, results?.comps.get(comp.id) ?? null);
    }
  }

  setSelected(kind, id) {
    this.compLayer.querySelectorAll('.comp.selected').forEach(n => n.classList.remove('selected'));
    this.wireLayer.querySelectorAll('.wire.selected').forEach(n => n.classList.remove('selected'));
    if (kind === 'comp' && id) this.compLayer.querySelector(`#comp-${CSS.escape(id)}`)?.classList.add('selected');
    if (kind === 'wire' && id) this.wireLayer.querySelector(`#wire-${CSS.escape(id)}`)?.classList.add('selected');
  }

  // 连线草稿
  showDraft(from, to) {
    this.hideDraft();
    const d = to
      ? (() => { const dist = Math.hypot(to.x - from.x, to.y - from.y); const s = Math.min(90, Math.max(26, dist * 0.14)); return `M ${from.x} ${from.y} C ${from.x} ${from.y + s}, ${to.x} ${to.y + s}, ${to.x} ${to.y}`; })()
      : '';
    this.draft = el('path', { d, class: 'wire-draft' }, this.overlayLayer);
  }
  updateDraft(to) {
    if (!this.draft) return;
    const from = this.draftFrom;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const s = Math.min(90, Math.max(26, dist * 0.14));
    this.draft.setAttribute('d', `M ${from.x} ${from.y} C ${from.x} ${from.y + s}, ${to.x} ${to.y + s}, ${to.x} ${to.y}`);
  }
  hideDraft() {
    this.draft?.remove();
    this.draft = null;
  }

  setTerminalArmed(compId, term) {
    this.clearTerminalStates();
    if (compId) {
      this.compLayer.querySelector(`.terminal[data-comp="${CSS.escape(compId)}"][data-term="${CSS.escape(term)}"]`)?.classList.add('armed');
    }
  }
  setTerminalSnap(compId, term) {
    this.compLayer.querySelectorAll('.terminal.snap').forEach(n => n.classList.remove('snap'));
    if (compId) {
      this.compLayer.querySelector(`.terminal[data-comp="${CSS.escape(compId)}"][data-term="${CSS.escape(term)}"]`)?.classList.add('snap');
    }
  }
  clearTerminalStates() {
    this.compLayer.querySelectorAll('.terminal.armed, .terminal.snap').forEach(n => n.classList.remove('armed', 'snap'));
  }

  // 坐标换算：屏幕 → bench 坐标系
  toBench(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
}

// 元件中文名（aria 用），与 physics/components.js 的 label 保持一致
const DEFS_LABEL = {
  'student-supply': '学生电源', 'battery-pack': '干电池组', accumulator: '蓄电池',
  switch: '开关', 'spdt-switch': '单刀双掷开关',
  resistor: '定值电阻', rheostat: '滑动变阻器', 'resistance-box': '电阻箱', 'wire-board': '电阻丝实验板',
  ammeter: '电流表', voltmeter: '电压表', galvanometer: '灵敏电流计',
  diode: '二极管', led: '发光二极管',
  bulb: '小灯泡（普通）', 'bulb-nl': '小灯泡（非线性）',
  fuse: '保险丝', bell: '电铃', motor: '电动机'
};
