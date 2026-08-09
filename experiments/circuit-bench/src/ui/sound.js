// 电铃音效：通电后按打铃节奏连续敲击（WebAudio 程序合成，无外部素材）。
// 浏览器自动播放策略要求 AudioContext 在用户手势后创建/恢复，
// 因此 unlock() 由首次 pointerdown 触发，setActive(true) 才真正出声。

export class BellSound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.active = false;
    this.timer = 0;
    this.strikeCount = 0;
  }

  // 首次用户手势时调用：创建并解锁音频上下文
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.14;
      this.master.gain.value = 1.5;
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    try {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      // 极短静音脉冲用于完成 iOS / Android WebView 的媒体通道激活。
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      gain.gain.value = 0.00001;
      osc.connect(gain).connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + .012);
      if (this.active) this.strike();
    } catch {}
    return this.ctx?.state === 'running';
  }

  // 单次敲击：基频 + 泛音，快速起音、指数衰减，模拟小铃
  strike() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.strikeCount += 1;
    const t0 = this.ctx.currentTime;
    // 降低主频并保留泛音，手机小扬声器上比原先的高频铃声更容易听见。
    for (const [freq, amp, wave] of [[720, 0.28, 'triangle'], [1080, 0.13, 'square'], [1440, 0.065, 'triangle']]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(amp, t0);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.12);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.14);
    }
  }

  // 电铃得电/失电：得电后每 0.15 s 敲一次，节奏为旧版两倍。
  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    clearTimeout(this.timer);
    if (!on) return;
    const loop = () => {
      if (!this.active) return;
      if (!document.hidden) this.strike();
      this.timer = setTimeout(loop, 150);
    };
    loop();
  }
}
