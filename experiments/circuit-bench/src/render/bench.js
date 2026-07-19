// 实物台渲染层：拟真元件（SVG 程序绘制，参考人教版实验器材实物）、
// 接线柱几何、加粗导线贝塞尔、画布平移与缩放。
// 只负责“画”与视图状态，物理求解在 physics 层，交互事件通过 hooks 回调给 ui 层。

import { WIRE_SPECIMENS } from '../../data.js';
import { DEFS } from '../physics/components.js';

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

// —— 视图世界范围：元件可摆放区域（bench 坐标）——
export const WORLD = { x: -600, y: -400, w: 2400, h: 1500 };
const DEFAULT_VIEW = { x: -60, y: -70, w: 1720 };
const MIN_W = 420, MAX_W = 3400;

// —— 元件几何与绘制定义 ——
// terms: 端子相对坐标；cls 决定接线柱颜色（pos 红 / neg 黑 / plain 铜）；below 表示标注在接线柱下方
const T = (x, y, cls = 'plain', label = '', below = false) => ({ x, y, cls, label, below });

// 共享小件
const rect = (g, x, y, w, h, rx, fill, stroke, sw = 1.2) =>
  el('rect', { x, y, width: w, height: h, rx, fill, stroke, 'stroke-width': sw }, g);
const line = (g, x1, y1, x2, y2, stroke, sw = 1.4, cap = 'round') =>
  el('line', { x1, y1, x2, y2, stroke, 'stroke-width': sw, 'stroke-linecap': cap }, g);
const circle = (g, cx, cy, r, fill, stroke, sw = 1.2) =>
  el('circle', { cx, cy, r, fill, stroke, 'stroke-width': sw }, g);
const label = (g, str, x, y, size = 10, fill = '#33414f', anchor = 'middle', extra = {}) =>
  text(g, str, { x, y, 'font-size': size, fill, 'text-anchor': anchor, class: 'comp-ink', ...extra });

export const GEOMETRY = {
  // —— 学生电源：金属机箱 + 数显窗口 + 调压旋钮 + 红黑接线柱 ——
  'student-supply': {
    w: 230, h: 150,
    terms: { pos: T(206, 92, 'pos', '+'), neg: T(206, 124, 'neg', '−') },
    draw(g) {
      rect(g, 10, 16, 176, 118, 8, '#dde3e9', '#98a5b1', 1.6);
      rect(g, 10, 16, 176, 22, 8, '#c7d0d9', '#98a5b1', 1.2);
      label(g, '学生电源', 24, 32, 10.5, '#33414f', 'start');
      rect(g, 22, 48, 88, 34, 3, '#1f2b38', '#0f1822', 1.5);
      text(g, '', { x: 66, y: 71, class: 'supply-volt meter-read', 'font-size': 14, 'text-anchor': 'middle' });
      label(g, '直流输出 DC', 22, 100, 8, '#5a6a78', 'start');
      const knob = el('g', { class: 'supply-knob' }, g);
      circle(knob, 64, 118, 16, '#3a4552', '#232b34', 1.6);
      line(knob, 64, 118, 64, 106, '#e8edf2', 2.6);
      for (let i = 0; i <= 6; i++) {
        const a = (-135 + i * 45) * Math.PI / 180;
        line(g, 64 + Math.sin(a) * 21, 118 - Math.cos(a) * 21, 64 + Math.sin(a) * 24, 118 - Math.cos(a) * 24, '#8a97a3', 1.2);
      }
      label(g, '调压', 96, 122, 8, '#5a6a78', 'start');
      rect(g, 194, 80, 28, 58, 4, '#c7d0d9', '#98a5b1', 1.2);
      rect(g, 22, 136, 18, 6, 2, '#98a5b1', 'none');
      rect(g, 150, 136, 18, 6, 2, '#98a5b1', 'none');
    },
    update(g, comp) {
      const v = comp.params.voltage ?? 3;
      g.querySelector('.supply-volt').textContent = `${v.toFixed(1)} V`;
      const frac = (v - 1.5) / (15 - 1.5);
      g.querySelector('.supply-knob').setAttribute('transform', `rotate(${-135 + frac * 270} 64 118)`);
    }
  },

  // —— 干电池组：电池盒内 1~4 节五号电池串联 ——
  'battery-pack': {
    w: 220, h: 130,
    terms: { pos: T(198, 44, 'pos', '+'), neg: T(198, 92, 'neg', '−') },
    draw(g, comp) {
      rect(g, 14, 42, 150, 58, 6, '#343a41', '#22272c', 1.5);
      rect(g, 20, 48, 138, 46, 4, '#262b31', '#1a1e22', 1);
      el('g', { class: 'cells-g' }, g);
      line(g, 162, 58, 192, 46, '#c0453e', 2.4);
      line(g, 162, 86, 192, 90, '#3a3f46', 2.4);
      label(g, '干电池组', 16, 28, 10, '#33414f', 'start');
      text(g, '', { x: 16, y: 120, class: 'pack-volt comp-ink', 'font-size': 9, fill: '#5a6a78', 'text-anchor': 'start' });
      GEOMETRY['battery-pack'].update(g, comp);
    },
    update(g, comp) {
      const cells = Math.min(4, Math.max(1, comp.params.cells ?? 2));
      const cg = g.querySelector('.cells-g');
      cg.replaceChildren();
      const w = 30, gap = 4, total = cells * (w + gap) - gap;
      let x = 27 + (132 - total) / 2;
      for (let i = 0; i < cells; i++) {
        rect(cg, x, 52, w, 38, 5, '#eceae4', '#b9b2a4', 1.2);          // 电池皮
        rect(cg, x, 52, w, 13, 5, '#d8842a', 'none');                   // 顶部品牌色环
        rect(cg, x + w / 2 - 5, 48, 10, 5, 2, '#c9ccd2', '#9aa1a9', 1); // 正极凸头
        label(cg, '+', x + w / 2, 80, 9, '#8a4a12');
        x += w + gap;
      }
      g.querySelector('.pack-volt').textContent = `${cells} 节串联 · ${(cells * 1.5).toFixed(1)} V`;
    }
  },

  // —— 蓄电池 ——
  accumulator: {
    w: 170, h: 130,
    terms: { pos: T(148, 44, 'pos', '+'), neg: T(148, 92, 'neg', '−') },
    draw(g, comp) {
      rect(g, 18, 44, 104, 64, 5, '#40604f', '#2c4638', 1.5);
      rect(g, 18, 38, 104, 12, 4, '#2f4a3b', '#25402f', 1.2);
      for (let i = 0; i < 4; i++) {
        rect(g, 30 + i * 22, 56, 8, 40, 1, i % 2 ? '#7fae96' : '#4d7160', 'none');
      }
      circle(g, 46, 44, 4, '#22352b', 'none');
      circle(g, 94, 44, 4, '#22352b', 'none');
      line(g, 122, 52, 142, 46, '#c0453e', 2.4);
      line(g, 122, 92, 142, 92, '#3a3f46', 2.4);
      label(g, '蓄电池', 16, 28, 10, '#33414f', 'start');
      label(g, `${comp.params.voltage ?? 2} V`, 16, 122, 9, '#5a6a78', 'start');
    }
  },

  // —— 单刀开关：黑色底板 + 铜闸刀 ——
  switch: {
    w: 180, h: 110,
    terms: { a: T(16, 62), b: T(164, 62) },
    draw(g, comp) {
      rect(g, 4, 42, 172, 40, 5, '#33383f', '#20242a', 1.4);
      for (const [sx, sy] of [[12, 50], [168, 50], [12, 74], [168, 74]]) circle(g, sx, sy, 2, '#20242a', 'none');
      const blade = el('g', { class: 'blade' }, g);
      line(blade, 16, 62, 148, 62, '#c98d4b', 6);
      circle(blade, 146, 62, 5.5, '#2c3138', '#1c2025', 1.2);
      line(g, 16, 62, 16, 70, '#96742e', 3);
      line(g, 164, 62, 164, 70, '#96742e', 3);
      label(g, '开关', 90, 28, 10, '#33414f');
      text(g, '', { x: 90, y: 102, class: 'switch-state comp-ink', 'font-size': 9, fill: '#5a6a78', 'text-anchor': 'middle' });
      GEOMETRY.switch.update(g, comp);
    },
    update(g, comp) {
      const closed = comp.params.closed;
      g.querySelector('.blade').setAttribute('transform', closed ? '' : `rotate(-32 16 62)`);
      g.querySelector('.switch-state').textContent = closed ? '闭合' : '断开';
    }
  },

  // —— 单刀双掷开关 ——
  'spdt-switch': {
    w: 210, h: 130,
    terms: { com: T(16, 92), x: T(194, 44), y: T(194, 92) },
    draw(g, comp) {
      rect(g, 6, 30, 198, 80, 5, '#33383f', '#20242a', 1.4);
      line(g, 16, 92, 16, 100, '#96742e', 3);
      line(g, 194, 44, 194, 52, '#96742e', 3);
      line(g, 194, 92, 194, 100, '#96742e', 3);
      const blade = el('g', { class: 'blade' }, g);
      line(blade, 16, 92, 176, 46, '#c98d4b', 6);
      circle(blade, 172, 48, 5, '#2c3138', '#1c2025', 1.2);
      label(g, '单刀双掷', 105, 20, 10, '#33414f');
      label(g, 'X', 186, 30, 9, '#5a6a78');
      label(g, 'Y', 186, 124, 9, '#5a6a78');
      GEOMETRY['spdt-switch'].update(g, comp);
    },
    update(g, comp) {
      const toY = comp.params.position === 'y';
      g.querySelector('.blade').setAttribute('transform', `rotate(${toY ? 14.6 : 0} 16 92)`);
    }
  },

  // —— 定值电阻：色环电阻焊在底板上 ——
  resistor: {
    w: 170, h: 90,
    terms: { a: T(10, 45), b: T(160, 45) },
    draw(g, comp) {
      rect(g, 4, 26, 162, 38, 4, '#efe9dc', '#cbbfa8', 1.2);
      line(g, 14, 45, 36, 45, '#9aa4ad', 2);
      line(g, 134, 45, 156, 45, '#9aa4ad', 2);
      rect(g, 36, 33, 98, 24, 12, '#d9b06a', '#a8813e', 1.4);
      const bands = ['#5b3a29', '#20242a', '#c23b2e', '#c9a35c'];
      bands.forEach((c, i) => rect(g, 50 + i * 18, 33, 6, 24, 0, c, 'none'));
      text(g, '', { x: 85, y: 82, class: 'res-val comp-ink', 'font-size': 10, fill: '#33414f', 'text-anchor': 'middle' });
      GEOMETRY.resistor.update(g, comp);
    },
    update(g, comp) {
      g.querySelector('.res-val').textContent = `定值电阻 ${fmtR(comp.params.resistance ?? 10)}`;
    }
  },

  // —— 滑动变阻器：瓷筒绕丝 + 金属杆滑片 ——
  rheostat: {
    w: 260, h: 140,
    terms: { a: T(14, 72), b: T(246, 72), c: T(130, 14) },
    draw(g) {
      rect(g, 24, 86, 12, 18, 2, '#8b95a0', '#6d7782', 1);
      rect(g, 224, 86, 12, 18, 2, '#8b95a0', '#6d7782', 1);
      rect(g, 26, 54, 208, 32, 16, '#efe9db', '#c7bca6', 1.4);
      let d = 'M 32 70';
      for (let i = 0; i < 48; i++) d += ` l 4.1 ${i % 2 ? 9 : -9}`;
      el('path', { d, fill: 'none', stroke: '#b98a4e', 'stroke-width': 1.3 }, g);
      line(g, 24, 30, 236, 30, '#aab6bf', 5);
      line(g, 130, 30, 130, 18, '#8b95a0', 3);
      const slider = el('g', { class: 'rheo-slider' }, g);
      rect(slider, -9, 22, 18, 24, 3, '#4a5560', '#2f3942', 1.4);
      line(slider, 0, 46, 0, 56, '#2f3942', 3);
      label(g, '滑动变阻器', 130, 122, 10, '#33414f');
      text(g, '', { x: 130, y: 135, class: 'rheo-val comp-ink', 'font-size': 8.5, fill: '#5a6a78', 'text-anchor': 'middle' });
    },
    update(g, comp) {
      const x = comp.params.x ?? 0.5;
      const max = comp.params.max ?? 50;
      g.querySelector('.rheo-slider').setAttribute('transform', `translate(${26 + x * 208}, 0)`);
      g.querySelector('.rheo-val').textContent = `接入 ${(x * max).toFixed(0)} Ω / ${max} Ω（一上一下接法）`;
    }
  },

  // —— 电阻箱：旋盘式 ——
  'resistance-box': {
    w: 180, h: 120,
    terms: { a: T(14, 66), b: T(166, 66) },
    draw(g) {
      rect(g, 12, 22, 156, 80, 6, '#6b4f35', '#4c3823', 1.5);
      rect(g, 20, 30, 140, 42, 3, '#d9c9a8', '#b3a077', 1.2);
      rect(g, 32, 38, 52, 26, 2, '#f4efe2', '#b3a077', 1.2);
      text(g, '', { x: 58, y: 56, class: 'box-val comp-ink', 'font-size': 13, fill: '#33414f', 'text-anchor': 'middle' });
      circle(g, 122, 51, 14, '#3a3f46', '#23272c', 1.4);
      line(g, 122, 51, 122, 41, '#e8dcc0', 2.2);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        circle(g, 122 + Math.sin(a) * 19, 51 - Math.cos(a) * 19, 1.1, '#8a7a58', 'none');
      }
      label(g, '电阻箱', 90, 114, 10, '#33414f');
    },
    update(g, comp) {
      g.querySelector('.box-val').textContent = `${comp.params.resistance ?? 5} Ω`;
    }
  },

  // —— 电阻丝实验板（人教版“探究影响电阻大小的因素”） ——
  'wire-board': {
    w: 280, h: 110,
    terms: { a: T(14, 55), b: T(266, 55) },
    draw(g) {
      rect(g, 4, 20, 272, 72, 4, '#e0d3ae', '#bfae83', 1.4);
      rect(g, 32, 48, 10, 14, 1, '#9aa4ad', '#6d7782', 1);
      rect(g, 238, 48, 10, 14, 1, '#9aa4ad', '#6d7782', 1);
      line(g, 18, 55, 32, 55, '#9aa4ad', 2);
      line(g, 248, 55, 262, 55, '#9aa4ad', 2);
      let d = 'M 37 55';
      for (let i = 0; i < 26; i++) d += ` l 7.7 ${i % 2 ? 8 : -8}`;
      el('path', { d, fill: 'none', stroke: '#8a6d3b', 'stroke-width': 1.6 }, g);
      label(g, '电阻丝实验板', 140, 14, 10, '#33414f');
      text(g, '', { x: 140, y: 104, class: 'specimen-label comp-ink', 'font-size': 9, fill: '#5a6a78', 'text-anchor': 'middle' });
    },
    update(g, comp) {
      const spec = WIRE_SPECIMENS.find(s => s.id === comp.params.specimen) ?? WIRE_SPECIMENS[1];
      g.querySelector('.specimen-label').textContent = `${spec.label} ≈ ${spec.R} Ω`;
    }
  },

  // —— 二极管 ——
  diode: {
    w: 130, h: 90,
    terms: { an: T(8, 45), ka: T(122, 45) },
    draw(g) {
      rect(g, 2, 28, 126, 34, 4, '#efe9dc', '#cbbfa8', 1.2);
      line(g, 12, 45, 30, 45, '#9aa4ad', 2);
      line(g, 98, 45, 118, 45, '#9aa4ad', 2);
      rect(g, 30, 35, 68, 20, 9, '#2f343b', '#1e2227', 1.4);
      rect(g, 86, 35, 9, 20, 0, '#c9ccd2', 'none');
      el('path', { d: 'M 48 39 L 62 45 L 48 51 Z', fill: '#dfe5ea' }, g);
      line(g, 66, 39, 66, 51, '#dfe5ea', 1.8);
      label(g, '二极管', 65, 80, 10, '#33414f');
    }
  },

  // —— 发光二极管 ——
  led: {
    w: 130, h: 110,
    terms: { an: T(30, 96), ka: T(100, 96) },
    draw(g) {
      rect(g, 18, 84, 94, 20, 4, '#efe9dc', '#cbbfa8', 1.2);
      line(g, 44, 60, 37, 88, '#9aa4ad', 2.2);
      line(g, 86, 60, 93, 88, '#9aa4ad', 2.2);
      el('path', { d: 'M 55 46 L 63 38 M 61 52 L 71 44', stroke: '#c98d4b', 'stroke-width': 1.4, fill: 'none' }, g);
      el('path', { d: 'M 40 62 A 25 25 0 0 1 90 62 L 86 66 L 44 66 Z', class: 'led-dome', fill: 'rgba(215,238,248,.55)', stroke: '#8fb7c9', 'stroke-width': 1.4 }, g);
      line(g, 86, 40, 86, 62, '#8fb7c9', 1.6);
      el('path', { d: 'M 56 62 L 58 50 L 66 50 L 64 62 Z M 70 62 L 72 54 L 80 54 L 78 62 Z', fill: '#8fa9b6' }, g);
      label(g, 'LED', 65, 80, 10, '#33414f');
    },
    update(g, comp, result) {
      g.querySelector('.led-dome').classList.toggle('lit', !!result?.lit);
    }
  },

  // —— 小灯泡（螺旋灯口 + 灯座） ——
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

  // —— 三接线柱电表（人教版）：− 公共黑柱 + 两个红色量程柱 ——
  ammeter: meterGeometry('ammeter', 'A', '电流表', { minus: '−', low: '0.6', high: '3' }, fmtA),
  voltmeter: meterGeometry('voltmeter', 'V', '电压表', { minus: '−', low: '3', high: '15' }, fmtV),
  galvanometer: meterGeometry('galvanometer', 'G', '灵敏电流计', { minus: '−', low: 'G0', high: 'G1' }, fmtA, true),

  // —— 保险丝 ——
  fuse: {
    w: 150, h: 90,
    terms: { a: T(8, 45), b: T(142, 45) },
    draw(g, comp) {
      rect(g, 2, 28, 146, 34, 4, '#efe9dc', '#cbbfa8', 1.2);
      rect(g, 26, 36, 8, 18, 1, '#9aa4ad', '#6d7782', 1);
      rect(g, 116, 36, 8, 18, 1, '#9aa4ad', '#6d7782', 1);
      rect(g, 34, 37, 82, 16, 8, 'rgba(225,240,248,.55)', '#aebfc9', 1.2);
      line(g, 36, 45, 114, 45, '#c98d4b', 2);
      g.querySelector('line[stroke="#c98d4b"]')?.classList.add('fuse-wire');
      const broken = el('g', { class: 'fuse-broken', visibility: 'hidden' }, g);
      line(broken, 36, 45, 68, 45, '#c98d4b', 2);
      line(broken, 82, 45, 114, 45, '#c98d4b', 2);
      el('path', { d: 'M 70 40 l 6 -6 M 74 46 l 8 -3 M 70 50 l 7 5', stroke: '#d0432f', 'stroke-width': 1.6, fill: 'none' }, broken);
      text(g, '', { x: 75, y: 80, class: 'fuse-label comp-ink', 'font-size': 10, fill: '#33414f', 'text-anchor': 'middle' });
      GEOMETRY.fuse.update(g, comp, null);
    },
    update(g, comp, result) {
      g.querySelector('.fuse-label').textContent = `保险丝 ${comp.params.rating ?? 2}A`;
      const blown = !!result?.blown;
      g.querySelector('.fuse-wire').setAttribute('visibility', blown ? 'hidden' : 'visible');
      g.querySelector('.fuse-broken').setAttribute('visibility', blown ? 'visible' : 'hidden');
    }
  },

  // —— 电铃 ——
  bell: {
    w: 150, h: 130,
    terms: { a: T(18, 112), b: T(132, 112) },
    draw(g) {
      rect(g, 10, 96, 130, 22, 4, '#6b4f35', '#4c3823', 1.4);
      rect(g, 46, 74, 12, 22, 2, '#b98a4e', '#8a6d3b', 1);
      rect(g, 62, 74, 12, 22, 2, '#b98a4e', '#8a6d3b', 1);
      el('path', { d: 'M 40 90 A 36 36 0 0 1 112 90 Z', fill: '#e3c07a', stroke: '#b28a42', 'stroke-width': 1.5 }, g);
      circle(g, 76, 58, 4, '#b28a42', 'none');
      const hammer = el('g', { class: 'bell-hammer' }, g);
      line(hammer, 122, 100, 106, 80, '#4a5560', 2.5);
      circle(hammer, 105, 78, 4.5, '#4a5560', '#2f3942', 1);
      label(g, '电铃', 75, 128, 10, '#33414f');
    },
    update(g, comp, result) {
      g.classList.toggle('active-load', !!result?.active);
    }
  },

  // —— 电动机 ——
  motor: {
    w: 160, h: 140,
    terms: { a: T(18, 122), b: T(142, 122) },
    draw(g) {
      rect(g, 12, 110, 136, 20, 4, '#4a5058', '#33383f', 1.4);
      rect(g, 34, 60, 10, 42, 3, '#5b6670', '#454e56', 1.2);
      rect(g, 42, 52, 78, 58, 10, '#7d8894', '#5b6670', 1.5);
      for (let i = 0; i < 5; i++) line(g, 54 + i * 14, 56, 54 + i * 14, 106, '#6a7680', 1.6);
      line(g, 120, 81, 134, 81, '#9aa4ad', 4);
      const fan = el('g', { class: 'motor-fan' }, g);
      for (const a of [0, 90, 180, 270]) {
        el('path', { d: 'M 138 81 L 138 62 Q 146 64 144 74 Z', fill: '#c9a35c', stroke: '#96742e', 'stroke-width': 1, transform: `rotate(${a} 138 81)` }, fan);
      }
      circle(fan, 138, 81, 5, '#4a5560', '#2f3942', 1.2);
      label(g, '电动机', 78, 138, 10, '#33414f');
    },
    update(g, comp, result) {
      g.classList.toggle('active-load', !!result?.active);
    }
  }
};

function drawBulb(g, comp) {
  const nl = comp.type === 'bulb-nl';
  if (nl) label(g, '非线性 · R 随温度变', 75, 12, 8.5, '#b3692a');
  // 灯座
  rect(g, 14, 104, 122, 26, 6, '#f0ede5', '#cfc8ba', 1.4);
  line(g, 61, 96, 26, 118, '#9aa4ad', 2);
  line(g, 89, 96, 124, 118, '#9aa4ad', 2);
  // 螺旋灯口
  rect(g, 61, 84, 28, 22, 3, '#c9ccd2', '#9aa1a9', 1.3);
  line(g, 61, 90, 89, 90, '#9aa1a9', 1.2);
  line(g, 61, 96, 89, 96, '#9aa1a9', 1.2);
  line(g, 61, 102, 89, 102, '#9aa1a9', 1.2);
  // 玻璃泡与灯丝
  circle(g, 75, 58, 32, nl ? 'rgba(255,226,190,.4)' : 'rgba(255,252,240,.4)', nl ? '#d98a4e' : '#aeb9c2', 1.5)
    .classList.add('bulb-glass');
  line(g, 68, 84, 71, 66, '#8fa9b6', 1.6);
  line(g, 82, 84, 79, 66, '#8fa9b6', 1.6);
  el('path', { d: 'M 63 66 q 3 -7 6 0 q 3 7 6 0 q 3 -7 6 0 q 3 7 6 0', class: 'filament', fill: 'none', stroke: '#6b5a3e', 'stroke-width': 1.6 }, g);
  label(g, nl ? '小灯泡 · 非线性' : '小灯泡', 75, 138, 9.5, '#33414f');
}
function updateBulb(g, comp, result) {
  const glass = g.querySelector('.bulb-glass');
  const b = result?.brightness ?? 0;
  glass.classList.toggle('on', b > 0.03);
  glass.style.opacity = b > 0.03 ? String(Math.min(1, 0.35 + b * 0.65)) : '';
}

// 三接线柱学校电表：白色表箱 + 半圆表盘 + 底部 −/低/高量程接线柱
function meterGeometry(type, symbol, name, termLabels, fmt, centerZero = false) {
  return {
    w: 170, h: 168,
    terms: {
      minus: T(28, 146, 'neg', termLabels.minus, true),
      low: T(85, 146, 'pos', termLabels.low, true),
      high: T(142, 146, 'pos', termLabels.high, true)
    },
    draw(g) {
      rect(g, 8, 8, 154, 128, 10, '#f4f1e6', '#cfc6ae', 1.6);
      el('path', { d: 'M 30 96 A 55 55 0 0 1 140 96 Z', fill: '#fdfcf6', stroke: '#cfc6ae', 'stroke-width': 1.2 }, g);
      for (let i = 0; i <= 10; i++) {
        const ang = (-55 + i * 11) * Math.PI / 180;
        line(g, 85 + Math.sin(ang) * 46, 96 - Math.cos(ang) * 46,
          85 + Math.sin(ang) * 52, 96 - Math.cos(ang) * 52, '#7d8a94', i % 5 === 0 ? 1.6 : 1);
      }
      text(g, '0', { x: 38, y: 84, class: 'meter-min-t comp-ink', 'font-size': 8, fill: '#5a6a78', 'text-anchor': 'middle' });
      text(g, '', { x: 132, y: 84, class: 'meter-max-t comp-ink', 'font-size': 8, fill: '#5a6a78', 'text-anchor': 'middle' });
      if (centerZero) text(g, '0', { x: 85, y: 44, class: 'comp-ink', 'font-size': 8, fill: '#5a6a78', 'text-anchor': 'middle' });
      text(g, symbol, { x: 85, y: 74, class: 'comp-ink', 'font-size': 17, fill: '#33414f', 'text-anchor': 'middle' });
      const needle = el('g', { class: 'needle-g' }, g);
      line(needle, 85, 96, 85, 50, '#d0432f', 2);
      circle(g, 85, 96, 4, '#3a3f46', '#23272c', 1);
      label(g, name, 85, 118, 9.5, '#5a6a78');
      text(g, '', { x: 85, y: 131, class: 'meter-val comp-ink', 'font-size': 8.5, fill: '#33414f', 'text-anchor': 'middle' });
      rect(g, 8, 136, 154, 20, 6, '#e5e0cf', '#cfc6ae', 1.2);
    },
    update(g, comp, result) {
      const ranges = DEFS[type].ranges;
      const range = result?.range ?? ranges.low;
      const reading = result?.reading ?? 0;
      const minT = g.querySelector('.meter-min-t');
      const maxT = g.querySelector('.meter-max-t');
      maxT.textContent = `${range}`;
      minT.textContent = centerZero ? `−${range}` : '0';
      const frac = reading / range;
      const angle = centerZero
        ? Math.max(-1, Math.min(1, frac)) * 52
        : (frac < 0 ? Math.max(frac, -0.1) * 110 : -55 + Math.min(1.05, frac) * 110);
      g.querySelector('.needle-g').setAttribute('transform', `rotate(${angle} 85 96)`);
      g.querySelector('.meter-val').textContent = result?.rangeLabel ? `${fmt(reading)} · ${result.rangeLabel}` : '未接入电路';
      g.classList.toggle('overrange', !!result?.overrange);
    }
  };
}

export function fmtR(r) { return r >= 1000 ? `${(r / 1000).toFixed(r % 1000 ? 1 : 0)} kΩ` : `${r} Ω`; }
export function fmtA(a) { const v = Math.abs(a); return v < 0.01 && v > 0 ? `${(a * 1000).toFixed(1)} mA` : `${a.toFixed(3)} A`; }
export function fmtV(v) { return `${v.toFixed(2)} V`; }

// —— 实物台视图 ——
// 图层顺序（底 → 顶）：网格 → 元件 → 导线 → 流向动画 → 接线柱 → 草稿覆盖层
export class BenchView {
  constructor(svg) {
    this.svg = svg;
    this.viewState = { ...DEFAULT_VIEW };
    const defs = el('defs', {}, svg);
    const pat = el('pattern', { id: 'bench-grid-pat', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M 40 0 L 0 0 0 40', fill: 'none', stroke: 'rgba(255,255,255,.3)', 'stroke-width': 1 }, pat);
    this.gridLayer = el('g', { class: 'grid-layer' }, svg);
    el('rect', { x: WORLD.x, y: WORLD.y, width: WORLD.w, height: WORLD.h, fill: 'url(#bench-grid-pat)' }, this.gridLayer);
    this.compLayer = el('g', { class: 'comps-layer' }, svg);
    this.wireLayer = el('g', { class: 'wires-layer' }, svg);
    this.flowLayer = el('g', { class: 'flow-layer' }, svg);
    this.termLayer = el('g', { class: 'term-layer' }, svg);
    this.overlayLayer = el('g', { class: 'overlay-layer' }, svg);
    this.bench = { components: [], wires: [] };
    this.draft = null;
    this.applyViewBox();
    window.addEventListener('resize', () => this.applyViewBox());
  }

  // —— 视图平移与缩放 ——
  applyViewBox() {
    const vs = this.viewState;
    const rect = this.svg.getBoundingClientRect();
    const aspect = rect.height > 0 && rect.width > 0 ? rect.height / rect.width : 9 / 16;
    vs.h = vs.w * aspect;
    // 限制在世界范围内（视图大于世界时居中）
    vs.x = vs.w >= WORLD.w ? WORLD.x - (vs.w - WORLD.w) / 2
      : Math.min(WORLD.x + WORLD.w - vs.w, Math.max(WORLD.x, vs.x));
    vs.y = vs.h >= WORLD.h ? WORLD.y - (vs.h - WORLD.h) / 2
      : Math.min(WORLD.y + WORLD.h - vs.h, Math.max(WORLD.y, vs.y));
    this.svg.setAttribute('viewBox', `${vs.x} ${vs.y} ${vs.w} ${vs.h}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  panBy(dxPx, dyPx) {
    const rect = this.svg.getBoundingClientRect();
    if (!rect.width) return;
    const s = this.viewState.w / rect.width;
    this.viewState.x -= dxPx * s;
    this.viewState.y -= dyPx * s;
    this.applyViewBox();
  }

  zoomAt(factor, clientX, clientY) {
    const vs = this.viewState;
    const rect = this.svg.getBoundingClientRect();
    const anchor = this.toBench(clientX ?? rect.left + rect.width / 2, clientY ?? rect.top + rect.height / 2);
    const fx = ((clientX ?? rect.left + rect.width / 2) - rect.left) / Math.max(1, rect.width);
    const fy = ((clientY ?? rect.top + rect.height / 2) - rect.top) / Math.max(1, rect.height);
    vs.w = Math.min(MAX_W, Math.max(MIN_W, vs.w * factor));
    vs.h = vs.w * (rect.height / Math.max(1, rect.width));
    vs.x = anchor.x - fx * vs.w;
    vs.y = anchor.y - fy * vs.h;
    this.applyViewBox();
  }

  resetView() {
    this.viewState = { ...DEFAULT_VIEW };
    this.applyViewBox();
  }

  setBench(bench) {
    this.bench = bench;
    this.wireLayer.replaceChildren();
    this.compLayer.replaceChildren();
    this.flowLayer.replaceChildren();
    this.termLayer.replaceChildren();
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
      'aria-label': DEFS[comp.type]?.label ?? comp.type
    }, this.compLayer);
    // 选中框 + 命中底板
    el('rect', { x: -6, y: -6, width: geo.w + 12, height: geo.h + 12, rx: 10, fill: 'none', class: 'sel-ring' }, g);
    el('rect', { x: -6, y: -6, width: geo.w + 12, height: geo.h + 12, fill: 'transparent', class: 'comp-hit' }, g);
    geo.draw(g, comp);
    geo.update?.(g, comp, null);
    // 接线柱在独立顶层：盖住导线端头，始终可点
    const tg = el('g', { class: 'term-g', id: `term-${comp.id}`, transform: `translate(${comp.x}, ${comp.y})` }, this.termLayer);
    for (const [term, t] of Object.entries(geo.terms)) {
      el('circle', { cx: t.x, cy: t.y, r: 17, fill: 'transparent', class: 'terminal-hit', 'data-comp': comp.id, 'data-term': term }, tg);
      el('circle', { cx: t.x, cy: t.y, r: 8, class: `terminal ${t.cls}`, 'data-comp': comp.id, 'data-term': term }, tg);
      el('circle', { cx: t.x, cy: t.y, r: 2.6, class: 'terminal-dot', 'data-comp': comp.id, 'data-term': term }, tg);
      if (t.label) {
        text(tg, t.label, {
          x: t.x, y: t.y + (t.below ? 21 : -14), class: `term-label ${t.cls}`,
          'text-anchor': 'middle'
        });
      }
    }
    return g;
  }

  removeComponentView(id) {
    this.compLayer.querySelector(`#comp-${CSS.escape(id)}`)?.remove();
    this.termLayer.querySelector(`#term-${CSS.escape(id)}`)?.remove();
  }

  redrawComponent(comp) {
    const old = this.compLayer.querySelector(`#comp-${CSS.escape(comp.id)}`);
    if (!old) return;
    const selected = old.classList.contains('selected');
    old.remove();
    this.termLayer.querySelector(`#term-${CSS.escape(comp.id)}`)?.remove();
    const g = this.addComponentView(comp);
    if (selected) g.classList.add('selected');
  }

  moveComponent(id, x, y) {
    const comp = this.bench.components.find(c => c.id === id);
    if (!comp) return;
    comp.x = x; comp.y = y;
    this.compLayer.querySelector(`#comp-${CSS.escape(id)}`)?.setAttribute('transform', `translate(${x}, ${y})`);
    this.termLayer.querySelector(`#term-${CSS.escape(id)}`)?.setAttribute('transform', `translate(${x}, ${y})`);
    for (const w of this.bench.wires) {
      if (w.a.comp === id || w.b.comp === id) this.updateWirePath(w);
    }
  }

  wirePath(w) {
    const p1 = this.terminalPos(w.a.comp, w.a.term);
    const p2 = this.terminalPos(w.b.comp, w.b.term);
    if (!p1 || !p2) return '';
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const slack = Math.min(48, Math.max(14, dist * 0.07));
    return `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + slack}, ${p2.x} ${p2.y + slack}, ${p2.x} ${p2.y}`;
  }

  addWireView(w) {
    const g = el('g', { class: 'wire', id: `wire-${w.id}` }, this.wireLayer);
    el('path', { d: this.wirePath(w), class: 'wire-hit', 'data-wire': w.id }, g);
    el('path', { d: this.wirePath(w), class: 'wire-casing' }, g);
    el('path', { d: this.wirePath(w), class: 'wire-core' }, g);
  }

  removeWireView(id) {
    this.wireLayer.querySelector(`#wire-${CSS.escape(id)}`)?.remove();
  }

  updateWirePath(w) {
    const g = this.wireLayer.querySelector(`#wire-${CSS.escape(w.id)}`);
    if (!g) return;
    const d = this.wirePath(w);
    g.querySelector('.wire-casing').setAttribute('d', d);
    g.querySelector('.wire-core').setAttribute('d', d);
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
      ? (() => { const dist = Math.hypot(to.x - from.x, to.y - from.y); const s = Math.min(48, Math.max(14, dist * 0.07)); return `M ${from.x} ${from.y} C ${from.x} ${from.y + s}, ${to.x} ${to.y + s}, ${to.x} ${to.y}`; })()
      : '';
    this.draft = el('path', { d, class: 'wire-draft' }, this.overlayLayer);
  }
  updateDraft(to) {
    if (!this.draft) return;
    const from = this.draftFrom;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const s = Math.min(48, Math.max(14, dist * 0.07));
    this.draft.setAttribute('d', `M ${from.x} ${from.y} C ${from.x} ${from.y + s}, ${to.x} ${to.y + s}, ${to.x} ${to.y}`);
  }
  hideDraft() {
    this.draft?.remove();
    this.draft = null;
  }

  setTerminalArmed(compId, term) {
    this.clearTerminalStates();
    if (compId) {
      this.termLayer.querySelector(`.terminal[data-comp="${CSS.escape(compId)}"][data-term="${CSS.escape(term)}"]`)?.classList.add('armed');
    }
  }
  setTerminalSnap(compId, term) {
    this.termLayer.querySelectorAll('.terminal.snap').forEach(n => n.classList.remove('snap'));
    if (compId) {
      this.termLayer.querySelector(`.terminal[data-comp="${CSS.escape(compId)}"][data-term="${CSS.escape(term)}"]`)?.classList.add('snap');
    }
  }
  clearTerminalStates() {
    this.termLayer.querySelectorAll('.terminal.armed, .terminal.snap').forEach(n => n.classList.remove('armed', 'snap'));
  }

  // 坐标换算：屏幕 → bench 坐标系（viewBox 变化自动生效）
  toBench(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }
}
