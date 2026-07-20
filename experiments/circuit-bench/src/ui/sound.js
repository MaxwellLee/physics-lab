// 电铃音效：通电后按打铃节奏连续敲击（WebAudio 程序合成，无外部素材）。
// 浏览器自动播放策略要求 AudioContext 在用户手势后创建/恢复，
// 因此 unlock() 由首次 pointerdown 触发，setActive(true) 才真正出声。

export class BellSound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.active = false;
    this.timer = 0;
  }

  // 首次用户手势时调用：创建并解锁音频上下文
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // 单次敲击：基频 + 泛音，快速起音、指数衰减，模拟小铃
  strike() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime;
    for (const [freq, amp] of [[1568, 0.16], [2093, 0.1], [3136, 0.05]]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(amp, t0);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.16);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }
  }

  // 电铃得电/失电：得电后每 0.3 s 敲一次（与锤子摆动动画同节奏）
  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    clearTimeout(this.timer);
    if (!on) return;
    const loop = () => {
      if (!this.active) return;
      if (!document.hidden) this.strike();
      this.timer = setTimeout(loop, 300);
    };
    loop();
  }
}
