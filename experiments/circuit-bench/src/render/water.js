// 水路类比层（Canvas 2D）：水泵 ↔ 电源，水位差 ↔ 电压，水流 ↔ 电流，
// 阀门 ↔ 电阻，水轮机 ↔ 用电器。数值与所搭建的简单/串联/并联电路实时联动。
// 类比边界见资料面板「水路类比」与模型说明。

export class WaterView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = { mode: 'empty' };
    this.phase = 0;
    this.wheelAngle = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.8);
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setData(data) { this.data = data; }

  frame(dt, playing, reducedMotion) {
    if (playing && !reducedMotion) {
      const speed = this.flowSpeed();
      this.phase = (this.phase + dt * speed) % 1;
      this.wheelAngle += dt * speed * Math.PI * 1.6;
    }
    this.draw();
  }

  flowSpeed() {
    const I = Math.abs(this.data?.I ?? 0);
    if (I < 0.003) return 0;
    return 0.12 + 0.5 * Math.min(1, I / 1);
  }

  draw() {
    const ctx = this.ctx, W = innerWidth, H = innerHeight;
    ctx.clearRect(0, 0, W, H);
    const d = this.data ?? { mode: 'empty' };

    if (d.mode === 'empty' || d.mode === 'unavailable') {
      ctx.fillStyle = '#5b707b';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      const msg = d.mode === 'empty'
        ? '先在实物台搭建一个电路，这里会同步出现对应的水路'
        : '当前电路暂不适合水路类比：需要一个电源 + 1～3 个纯串联或纯并联的用电器';
      ctx.fillText(msg, W / 2, H / 2 - 10);
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = '#455863';
      ctx.fillText('可以试试：演示电路中的「简单电路」「串联电路」「并联电路」', W / 2, H / 2 + 16);
      return;
    }

    const U = d.U ?? 0, I = Math.abs(d.I ?? 0);
    const parallel = d.mode === 'parallel';
    const loads = d.loads ?? [];

    // 几何
    const hiY = H * 0.24, loY = H * 0.70;
    const tank = { x: W * 0.07, y: H * 0.16, w: W * 0.20, h: H * 0.26 };
    const basin = { x: W * 0.70, y: H * 0.62, w: W * 0.24, h: H * 0.22 };
    const mainY = H * 0.52;
    const pump = { x: W * 0.30, y: H * 0.885, r: W * 0.026 };

    // 管道（先画管，再画水）
    const pipe = (pts, width = 11) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(150, 190, 210, .3)';
      ctx.lineWidth = width + 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(96, 221, 255, .5)';
      ctx.lineWidth = width;
      ctx.stroke();
    };

    // 出水主管：水箱底 → 站 → 水槽
    const mainPath = [[tank.x + tank.w * 0.5, tank.y + tank.h], [tank.x + tank.w * 0.5, mainY], [basin.x + basin.w * 0.5, mainY], [basin.x + basin.w * 0.5, basin.y + 4]];
    // 回水管：水槽底 → 泵 → 水箱顶
    const retPath = [[basin.x + basin.w * 0.32, basin.y + basin.h], [basin.x + basin.w * 0.32, pump.y], [pump.x, pump.y], [tank.x + tank.w * 0.22, pump.y], [tank.x + tank.w * 0.22, tank.y - 2]];
    pipe(retPath);

    if (parallel) {
      const b1 = mainY - H * 0.055, b2 = mainY + H * 0.055;
      const splitX = W * 0.26, joinX = W * 0.60;
      pipe([[splitX, mainY], [splitX, b1], [joinX, b1], [joinX, mainY]]);
      pipe([[splitX, mainY], [splitX, b2], [joinX, b2], [joinX, mainY]]);
      pipe([[tank.x + tank.w * 0.5, tank.y + tank.h], [tank.x + tank.w * 0.5, mainY], [splitX, mainY]]);
      pipe([[joinX, mainY], [basin.x + basin.w * 0.5, mainY], [basin.x + basin.w * 0.5, basin.y + 4]]);
      this.branchStation(splitX, joinX, b1, loads[0], I * splitRatio(loads, 0));
      if (loads[1]) this.branchStation(splitX, joinX, b2, loads[1], I * splitRatio(loads, 1));
    } else {
      pipe(mainPath);
      // 串联站：水轮机与阀门依次在主管上
      const stations = loads.length;
      for (let i = 0; i < stations; i++) {
        const x = W * (0.32 + i * 0.14);
        this.wheel(x, mainY, I, loads[i]?.label);
        this.valve(x + W * 0.055, mainY, loads[i]);
      }
    }

    // 水箱与水槽
    this.tankBox(tank, hiY, '高位水箱');
    this.tankBox(basin, loY, '低位水槽');

    // 水位差标注
    ctx.strokeStyle = 'rgba(255, 213, 150, .55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tank.x - 14, hiY); ctx.lineTo(tank.x - 14, loY);
    ctx.moveTo(tank.x - 19, hiY); ctx.lineTo(tank.x - 9, hiY);
    ctx.moveTo(tank.x - 19, loY); ctx.lineTo(tank.x - 9, loY);
    ctx.stroke();
    ctx.fillStyle = '#ffd596';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`水位差 Δh ↔ 电压 ${U.toFixed(1)} V`, tank.x - 22, (hiY + loY) / 2);

    // 水泵
    ctx.beginPath();
    ctx.arc(pump.x, pump.y, pump.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 213, 150, .12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 213, 150, .6)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.save();
    ctx.translate(pump.x, pump.y);
    ctx.rotate(this.wheelAngle * 1.4);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -pump.r * 0.72);
      ctx.strokeStyle = '#ffd596';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#9cb0b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('水泵 ↔ 电源', pump.x, pump.y + pump.r + 16);

    // 水流粒子
    if (this.flowSpeed() > 0) this.particles(retPath, 6);

    // 数值与规律文本
    ctx.textAlign = 'left';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#9cb0b8';
    ctx.fillText(`流量 Q ↔ 电流 ${I.toFixed(3)} A`, basin.x, basin.y - 14);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#5b707b';
    const rule = parallel
      ? '并联：各支路水位差相同，总流量等于各支路流量之和'
      : '串联：流量处处相等，水位分段下降';
    ctx.fillText(rule, basin.x, basin.y + basin.h + 22);
    ctx.textAlign = 'center';
    ctx.fillText('示意图：水位差与流量按电路数值映射绘制，不代表真实比例 · 类比有边界，详见资料面板', W / 2, H - 18);
  }

  tankBox(t, levelY, label) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 18, 30, .85)';
    ctx.strokeStyle = 'rgba(138, 198, 218, .35)';
    ctx.lineWidth = 1.2;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    // 水面
    const wl = Math.max(t.y + 6, Math.min(t.y + t.h - 6, levelY));
    ctx.fillStyle = 'rgba(96, 221, 255, .28)';
    ctx.fillRect(t.x + 2, wl, t.w - 4, t.y + t.h - wl - 2);
    ctx.strokeStyle = 'rgba(96, 221, 255, .8)';
    ctx.beginPath();
    ctx.moveTo(t.x + 2, wl); ctx.lineTo(t.x + t.w - 2, wl);
    ctx.stroke();
    ctx.fillStyle = '#7d95a0';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, t.x + t.w / 2, t.y - 8);
  }

  wheel(x, y, I, label) {
    const ctx = this.ctx, r = Math.min(innerWidth, innerHeight) * 0.026;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 18, 30, .9)';
    ctx.fill();
    ctx.strokeStyle = '#9fc3d4';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.wheelAngle);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.85);
      ctx.strokeStyle = '#9fc3d4';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#7d95a0';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`水轮机${label ? ` ↔ ${label}` : ''}`, x, y - r - 8);
  }

  valve(x, y, load) {
    const ctx = this.ctx, s = 9;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s); ctx.lineTo(x - s, y + s); ctx.lineTo(x, y); ctx.closePath();
    ctx.moveTo(x + s, y - s); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y); ctx.closePath();
    ctx.fillStyle = 'rgba(255, 213, 150, .55)';
    ctx.fill();
    ctx.fillStyle = '#7d95a0';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    const rText = load?.R ? ` ≈${load.R.toFixed(1)} Ω` : '';
    ctx.fillText(`阀门 ↔ 电阻${rText}`, x, y + s + 14);
  }

  branchStation(splitX, joinX, y, load, I) {
    const midX = (splitX + joinX) / 2;
    this.wheel(midX - 30, y, I, load?.label);
    this.valve(midX + 34, y, load);
    // 支路流量标注
    this.ctx.fillStyle = '#9cb0b8';
    this.ctx.font = '9px Inter, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${Math.abs(I).toFixed(3)} A`, joinX + 8, y + 3);
  }

  particles(path, n) {
    const ctx = this.ctx;
    // 路径折线 → 粒子位置（phase 沿总长推进）
    let total = 0;
    const segs = [];
    for (let i = 1; i < path.length; i++) {
      const [x1, y1] = path[i - 1], [x2, y2] = path[i];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len, start: total });
      total += len;
    }
    ctx.fillStyle = 'rgba(180, 235, 255, .85)';
    for (let i = 0; i < n; i++) {
      const t = ((i / n) + this.phase) % 1;
      const L = t * total;
      const seg = segs.find(s => L >= s.start && L <= s.start + s.len) ?? segs[segs.length - 1];
      const f = seg.len ? (L - seg.start) / seg.len : 0;
      const x = seg.x1 + (seg.x2 - seg.x1) * f;
      const y = seg.y1 + (seg.y2 - seg.y1) * f;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function splitRatio(loads, i) {
  if (!loads?.length) return 0;
  if (loads.length === 1) return 1;
  const gs = loads.map(l => 1 / Math.max(l?.R ?? 1, 1e-6));
  const sum = gs.reduce((a, b) => a + b, 0);
  return gs[i] / sum;
}
