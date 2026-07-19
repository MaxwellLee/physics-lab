// 流向演示层：传统电流（琥珀色流动线段）与电子定向移动（青色小点，方向相反）。
// 速率为教学示意（随 |I| 变化），界面与模型说明中已披露。

import { el } from './bench.js';

const I_REF = 0.5;      // 参考电流：达到此值时流动最快
const MIN_I = 0.003;    // 低于此电流不显示流动（视为断路）

export class FlowView {
  constructor(layer) {
    this.layer = layer;
    this.items = [];
    this.phase = 0;
  }

  rebuild(mode, results, view, bench) {
    this.layer.replaceChildren();
    this.items = [];
    if (mode === 'off' || !results?.ok) return;
    const showCurrent = mode === 'current' || mode === 'both';
    const showElectron = mode === 'electron' || mode === 'both';

    for (const w of bench.wires) {
      const r = results.wires.get(w.id);
      if (!r || Math.abs(r.I) < MIN_I) continue;
      const d = view.wirePath(w);
      if (!d) continue;
      const dir = Math.sign(r.I) || 1; // 电流正方向：wire.a → wire.b
      const speed = 30 + 70 * Math.min(1, Math.abs(r.I) / I_REF);

      if (showCurrent) {
        const path = el('path', {
          d, fill: 'none', class: 'flow-current',
          stroke: 'rgba(255, 202, 122, .9)', 'stroke-width': 3.2,
          'stroke-linecap': 'round', 'stroke-dasharray': '11 16'
        }, this.layer);
        this.items.push({ kind: 'current', path, dir, speed, offset: 0 });
      }
      if (showElectron) {
        const path = el('path', { d, fill: 'none', stroke: 'none' }, this.layer);
        const len = path.getTotalLength();
        const n = Math.max(1, Math.min(5, Math.round(Math.abs(r.I) / I_REF * 4)));
        const dots = [];
        for (let i = 0; i < n; i++) {
          dots.push(el('circle', { r: 2.6, fill: 'rgba(96, 221, 255, .95)', class: 'flow-dot' }, this.layer));
        }
        // 电子方向与电流相反
        this.items.push({ kind: 'electron', path, len, dots, dir: -dir, speed });
      }
    }
  }

  frame(dt, playing, reducedMotion) {
    for (const item of this.items) {
      if (item.kind === 'current') {
        if (playing && !reducedMotion) item.offset -= item.dir * item.speed * dt;
        item.path.style.strokeDashoffset = String(item.offset);
        continue;
      }
      // electron：沿路径均匀分布并移动；reducedMotion 时静止展示
      if (playing && !reducedMotion) item.phase = (item.phase ?? 0) + item.dir * item.speed * dt / Math.max(item.len, 1);
      const phase = ((item.phase ?? 0) % 1 + 1) % 1;
      item.dots.forEach((dot, i) => {
        const t = ((i / item.dots.length) + phase) % 1;
        // dir>0 表示电子沿路径正方向（即电流为负方向时）
        const L = item.dir > 0 ? t * item.len : (1 - t) * item.len;
        const p = item.path.getPointAtLength(L);
        dot.setAttribute('cx', p.x);
        dot.setAttribute('cy', p.y);
      });
    }
  }

  clear() {
    this.layer.replaceChildren();
    this.items = [];
  }
}
