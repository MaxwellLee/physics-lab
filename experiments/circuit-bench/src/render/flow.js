// 流向演示层：单模式动画。
// current  —— 传统电流方向：琥珀色箭头沿导线前进方向流动；
// electron —— 电子定向移动：蓝色圆点沿相反方向流动。
// 速率为教学示意（随 |I| 变化），界面与模型说明中已披露。

import { el } from './bench.js';

const I_REF = 0.5;      // 参考电流：达到此值时流动最快
const MIN_I = 0.003;    // 低于此电流不显示流动（视为断路）
const ARROW_GAP = 46;   // 箭头沿导线的间距（bench 坐标）

export class FlowView {
  constructor(layer) {
    this.layer = layer;
    this.items = [];
  }

  rebuild(mode, results, view, bench) {
    this.layer.replaceChildren();
    this.items = [];
    if (mode !== 'current' && mode !== 'electron') return;
    if (!results?.ok) return;

    for (const w of bench.wires) {
      const r = results.wires.get(w.id);
      if (!r || Math.abs(r.I) < MIN_I) continue;
      const d = view.wirePath(w);
      if (!d) continue;
      const dir = Math.sign(r.I) || 1; // 电流正方向：wire.a → wire.b
      const speed = (34 + 66 * Math.min(1, Math.abs(r.I) / I_REF)) * (mode === 'electron' ? -dir : dir);

      const path = el('path', { d, fill: 'none', stroke: 'none' }, this.layer);
      const len = path.getTotalLength();
      if (len < 20) { path.remove(); continue; }

      if (mode === 'current') {
        // 箭头：沿路径均匀分布，按切线方向旋转
        const n = Math.max(1, Math.round(len / ARROW_GAP));
        const marks = [];
        for (let i = 0; i < n; i++) {
          marks.push(el('path', { d: 'M -7 -5 L 7 0 L -7 5 Z', class: 'flow-arrow' }, this.layer));
        }
        this.items.push({ kind: 'current', path, len, marks, speed, phase: 0 });
      } else {
        // 电子：小圆点反向移动
        const n = Math.max(2, Math.round(len / 34));
        const dots = [];
        for (let i = 0; i < n; i++) {
          dots.push(el('circle', { r: 4.2, class: 'flow-dot' }, this.layer));
        }
        this.items.push({ kind: 'electron', path, len, dots, speed, phase: 0 });
      }
    }
  }

  frame(dt, playing, reducedMotion) {
    for (const item of this.items) {
      if (playing && !reducedMotion) {
        item.phase = (item.phase + item.speed * dt / item.len) % 1;
      }
      const phase = ((item.phase % 1) + 1) % 1;
      if (item.kind === 'current') {
        const flip = item.speed < 0 ? 180 : 0; // 电流反向时箭头掉头
        item.marks.forEach((m, i) => {
          const t = (i / item.marks.length + phase) % 1;
          const L = t * item.len;
          const p = item.path.getPointAtLength(L);
          const p2 = item.path.getPointAtLength(Math.min(item.len, L + 1.5));
          const p0 = item.path.getPointAtLength(Math.max(0, L - 1.5));
          const ang = Math.atan2(p2.y - p0.y, p2.x - p0.x) * 180 / Math.PI + flip;
          m.setAttribute('transform', `translate(${p.x}, ${p.y}) rotate(${ang})`);
        });
      } else {
        item.dots.forEach((dot, i) => {
          const t = (i / item.dots.length + phase) % 1;
          const p = item.path.getPointAtLength(t * item.len);
          dot.setAttribute('cx', p.x);
          dot.setAttribute('cy', p.y);
        });
      }
    }
  }

  clear() {
    this.layer.replaceChildren();
    this.items = [];
  }
}
