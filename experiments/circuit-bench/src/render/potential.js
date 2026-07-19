// 电势标尺层：按求解得到的节点电势为导线和接线柱着色（理想模型下为精确值），
// 支持点击任意两点测量电势差（= 电压表在这两点间的读数）。

import { el, text } from './bench.js';

const LOW = [62, 198, 240];   // #3ec6f0
const HIGH = [255, 213, 150]; // #ffd596

export class PotentialView {
  constructor(view, legend) {
    this.view = view;      // BenchView
    this.legend = legend;  // { root, max, mid, min }
    this.enabled = false;
    this.pins = [];
    this.results = null;
    this.onPick = null;    // ui 注入：点击接线柱/导线时调用
  }

  enable(results) {
    this.enabled = true;
    this.legend.root.hidden = false;
    this.apply(results);
  }

  disable() {
    this.enabled = false;
    this.pins = [];
    this.legend.root.hidden = true;
    this.view.potentialLayer.replaceChildren();
    // 还原导线与接线柱颜色
    this.view.wireLayer.querySelectorAll('.wire-path').forEach(p => {
      p.style.stroke = '';
      p.classList.remove('pot-wire');
    });
    this.view.compLayer.querySelectorAll('.terminal').forEach(t => { t.style.fill = ''; });
  }

  apply(results) {
    if (!this.enabled || !results?.ok || !results.v) return;
    this.results = results;
    const { v, pMin, pMax } = results;
    this.legend.max.textContent = `${pMax.toFixed(1)}`;
    this.legend.mid.textContent = `${((pMax + pMin) / 2).toFixed(1)}`;
    this.legend.min.textContent = `${pMin.toFixed(1)}`;

    for (const [wid, wr] of results.wires) {
      const g = this.view.wireLayer.querySelector(`#wire-${CSS.escape(wid)}`);
      if (!g) continue;
      const avg = (v[wr.aNode] + v[wr.bNode]) / 2;
      const path = g.querySelector('.wire-path');
      path.style.stroke = potColor(avg, pMin, pMax);
      path.classList.add('pot-wire');
    }
    for (const t of this.view.compLayer.querySelectorAll('.terminal')) {
      const node = results.nodeOf.get(`${t.dataset.comp}:${t.dataset.term}`);
      if (node === undefined) continue;
      t.style.fill = potColor(v[node], pMin, pMax);
    }
    this.redrawPins();
  }

  // 点击接线柱或导线：钉下电势点；两点后显示电势差
  pick(benchPoint, nodeIdx) {
    if (!this.enabled || !this.results?.v || nodeIdx === undefined) return;
    if (this.pins.length >= 2) this.pins = [];
    this.pins.push({ x: benchPoint.x, y: benchPoint.y, phi: this.results.v[nodeIdx] });
    this.redrawPins();
  }

  redrawPins() {
    const layer = this.view.potentialLayer;
    layer.replaceChildren();
    for (const pin of this.pins) {
      el('circle', { cx: pin.x, cy: pin.y, r: 9, class: 'pot-pin' }, layer);
      el('circle', { cx: pin.x, cy: pin.y, r: 3, fill: 'var(--text)' }, layer);
      text(layer, `φ = ${pin.phi.toFixed(2)} V`, { x: pin.x + 14, y: pin.y - 10, class: 'pot-readout' });
    }
    if (this.pins.length === 2) {
      const [a, b] = this.pins;
      const d = a.phi - b.phi;
      el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--text)', 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: .6 }, layer);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const bg = el('rect', { x: mx - 86, y: my - 34, width: 172, height: 24, rx: 4, fill: 'rgba(4,10,18,.85)', stroke: 'var(--line)' }, layer);
      text(layer, `电势差（电压）= ${d.toFixed(2)} V`, { x: mx, y: my - 18, class: 'pot-readout', 'text-anchor': 'middle' });
      void bg;
    }
  }
}

function potColor(phi, min, max) {
  const t = max - min < 1e-6 ? 0.5 : (phi - min) / (max - min);
  const c = LOW.map((lo, i) => Math.round(lo + (HIGH[i] - lo) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
