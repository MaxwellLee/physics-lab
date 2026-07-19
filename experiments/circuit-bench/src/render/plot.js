// I-U 伏安特性图像：数据面板记录的多组 (U, I) 自动描点连线。

import { el, text } from './bench.js';

export function drawPlot(svg, records, targetLabel) {
  const W = 340, H = 190;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();

  const ml = 38, mr = 12, mt = 14, mb = 30;
  const pw = W - ml - mr, ph = H - mt - mb;

  // 边框与坐标轴
  el('rect', { x: 0.5, y: 0.5, width: W - 1, height: H - 1, fill: 'none', stroke: 'rgba(138,198,218,.14)' }, svg);
  el('line', { x1: ml, y1: mt + ph, x2: ml + pw, y2: mt + ph, stroke: 'rgba(138,198,218,.4)', 'stroke-width': 1 }, svg);
  el('line', { x1: ml, y1: mt, x2: ml, y2: mt + ph, stroke: 'rgba(138,198,218,.4)', 'stroke-width': 1 }, svg);
  text(svg, 'U / V', { x: ml + pw, y: H - 8, class: 'sch-label', 'text-anchor': 'end', 'font-size': 9 });
  text(svg, 'I / A', { x: ml - 4, y: mt - 4, class: 'sch-label', 'text-anchor': 'end', 'font-size': 9 });

  const pts = (records ?? []).filter(r => isFinite(r.u) && isFinite(r.i));
  if (!pts.length) {
    text(svg, '调整参数后点「记录 (U, I)」，这里会自动描点连线', { x: W / 2, y: H / 2, class: 'sch-label', 'text-anchor': 'middle', 'font-size': 9.5 });
    return;
  }

  const maxU = Math.max(1, ...pts.map(p => Math.abs(p.u))) * 1.15;
  const maxI = Math.max(0.1, ...pts.map(p => Math.abs(p.i))) * 1.15;
  const X = u => ml + (Math.abs(u) / maxU) * pw;
  const Y = i => mt + ph - (Math.abs(i) / maxI) * ph;

  // 刻度
  for (let k = 1; k <= 4; k++) {
    const u = maxU * k / 4;
    text(svg, trim(u), { x: X(u), y: mt + ph + 12, class: 'sch-label', 'text-anchor': 'middle', 'font-size': 8 });
    el('line', { x1: X(u), y1: mt + ph, x2: X(u), y2: mt + ph + 3, stroke: 'rgba(138,198,218,.4)' }, svg);
    const i = maxI * k / 4;
    text(svg, trim(i), { x: ml - 4, y: Y(i) + 3, class: 'sch-label', 'text-anchor': 'end', 'font-size': 8 });
    el('line', { x1: ml - 3, y1: Y(i), x2: ml, y2: Y(i), stroke: 'rgba(138,198,218,.4)' }, svg);
  }
  text(svg, '0', { x: ml - 4, y: mt + ph + 12, class: 'sch-label', 'text-anchor': 'end', 'font-size': 8 });

  // 连线 + 描点
  const sorted = [...pts].sort((a, b) => Math.abs(a.u) - Math.abs(b.u));
  const d = sorted.map((p, i2) => `${i2 ? 'L' : 'M'} ${X(p.u)} ${Y(p.i)}`).join(' ');
  el('path', { d, fill: 'none', stroke: 'rgba(96,221,255,.65)', 'stroke-width': 1.6 }, svg);
  for (const p of sorted) {
    el('circle', { cx: X(p.u), cy: Y(p.i), r: 3, fill: '#60ddff' }, svg);
  }
  if (targetLabel) {
    text(svg, targetLabel, { x: W - mr, y: mt + 2, class: 'sch-label', 'text-anchor': 'end', 'font-size': 9 });
  }
}

function trim(v) {
  return v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
}
