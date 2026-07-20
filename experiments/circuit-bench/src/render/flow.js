// 流向演示层：单模式动画，实物台与电路图共用。
// current  —— 传统电流方向：琥珀色箭头沿导线前进方向流动；
// electron —— 电子定向移动：蓝色圆点沿相反方向流动。
// 速率为教学示意（随 |I| 变化），界面与模型说明中已披露。

import { el } from './bench.js';

const I_REF = 0.5;      // 参考电流：达到此值时流动最快
const MIN_I = 2e-4;     // 低于 0.2 mA 视为断路不显示（节点泄漏电流为 nA 级，不会误显）
const ARROW_GAP = 46;   // 箭头沿导线的间距（bench 坐标）

// 流速模型：与电流大小正相关（漂移速率 ∝ I 的教学化）。
// 大电流支路全速，小电流支路缓慢蠕动——并联中高阻支路也能看到微流，
// 只是明显更慢，对比本身就是教学点。断路（~nA）则不显示。
function flowSpeed(i) {
  const t = Math.min(1, Math.abs(i) / I_REF);
  return 12 + 88 * Math.pow(t, 0.7);
}

export class FlowView {
  constructor(layer) {
    this.layer = layer;
    this.items = [];
  }

  // 电路图每次重渲染都会重建图层，用 setLayer 指向最新图层
  setLayer(layer) {
    this.layer = layer;
    this.items = [];
  }

  // 实物台：从求解结果逐根导线生成流动链接
  rebuild(mode, results, view, bench) {
    if (!results?.ok) { this.clear(); return; }
    const links = [];
    for (const w of bench.wires) {
      const r = results.wires.get(w.id);
      if (!r) continue;
      links.push({ d: view.wirePath(w), I: r.I }); // I 正方向 = wire.a → wire.b = 路径方向
    }
    this.buildFromLinks(mode, links);
  }

  // 通用入口：links = [{ d, I }]，I 的正方向即路径 d 的画线方向
  buildFromLinks(mode, links) {
    if (!this.layer) { this.items = []; return; }
    this.layer.replaceChildren();
    this.items = [];
    if (mode !== 'current' && mode !== 'electron') return;

    for (const link of links) {
      if (!link.d || Math.abs(link.I) < MIN_I) continue;
      const dir = Math.sign(link.I) || 1;
      const speed = flowSpeed(link.I) * (mode === 'electron' ? -dir : dir);

      const path = el('path', { d: link.d, fill: 'none', stroke: 'none' }, this.layer);
      const len = path.getTotalLength();
      if (len < 10) { path.remove(); continue; }

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
    this.layer?.replaceChildren();
    this.items = [];
  }
}
