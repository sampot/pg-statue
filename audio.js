/**
 * Original playground SFX via Web Audio — no commercial samples.
 */

export class StatueAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.26;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  setEnabled(on) {
    this.enabled = on;
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   */
  tone(freq, dur, type = "square", gain = 0.12, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  start() {
    this.tone(392, 0.08, "square", 0.1);
    this.tone(523, 0.1, "triangle", 0.09, 0.07);
  }

  /** @param {number} i 0..2 */
  count(i) {
    const freqs = [440, 494, 554];
    this.tone(freqs[i] ?? 440, 0.12, "square", 0.11);
    this.tone((freqs[i] ?? 440) * 1.5, 0.08, "triangle", 0.06, 0.04);
  }

  wood() {
    this.tone(880, 0.06, "square", 0.14);
    this.tone(660, 0.14, "sawtooth", 0.08, 0.05);
    this.tone(220, 0.2, "triangle", 0.07, 0.08);
  }

  away() {
    this.tone(330, 0.07, "sine", 0.06);
  }

  step() {
    this.tone(180 + Math.random() * 30, 0.03, "triangle", 0.04);
  }

  caught() {
    this.tone(150, 0.1, "sawtooth", 0.12);
    this.tone(90, 0.18, "square", 0.08, 0.06);
  }

  hurt() {
    this.tone(200, 0.08, "triangle", 0.07);
  }

  win() {
    this.tone(523, 0.1, "square", 0.11);
    this.tone(659, 0.1, "triangle", 0.1, 0.1);
    this.tone(784, 0.14, "sine", 0.09, 0.2);
    this.tone(1047, 0.18, "square", 0.08, 0.32);
  }

  lose() {
    this.tone(392, 0.12, "triangle", 0.08);
    this.tone(311, 0.16, "sine", 0.07, 0.12);
    this.tone(220, 0.22, "triangle", 0.06, 0.24);
  }
}
