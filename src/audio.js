export class Sound {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.ctx = null;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume();
    } catch {}
  }
  destroy() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
  play(type = "tap") {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    const notes =
      type === "win"
        ? [523, 659, 784, 1046]
        : type === "spell"
          ? [330, 494, 660]
          : type === "hit"
            ? [150, 95]
            : [440, 554];
    notes.forEach((f, i) => {
      const osc = this.ctx.createOscillator(),
        g = this.ctx.createGain(),
        t = this.ctx.currentTime + i * 0.08;
      osc.type = type === "hit" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }
}
