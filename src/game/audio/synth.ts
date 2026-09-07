/**
 * VAIN — procedural audio engine.
 * Zero audio files: every sound (SFX + the adaptive BGM loop) is synthesised with
 * Web Audio API oscillators / noise buffers. Safe for offline APK packaging.
 */

export type MusicTheme = 'menu' | 'battle' | 'boss' | 'gacha' | 'victory';

type Ctx = AudioContext;

const SCALE: Record<MusicTheme, { root: number; bpm: number; prog: number[][]; arp: number; drums: boolean }> = {
  menu: { root: 57, bpm: 76, prog: [[0, 4, 7, 11], [-3, 2, 5, 9], [-5, 0, 3, 7], [-7, -3, 0, 4]], arp: 0.5, drums: false },
  battle: { root: 45, bpm: 132, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [-2, 3, 5, 10]], arp: 0.25, drums: true },
  boss: { root: 40, bpm: 148, prog: [[0, 3, 6, 10], [0, 3, 7, 11], [-4, 1, 3, 8], [-2, 2, 5, 9]], arp: 0.166, drums: true },
  gacha: { root: 62, bpm: 104, prog: [[0, 4, 7, 11], [2, 5, 9, 12], [4, 7, 11, 14], [5, 9, 12, 16]], arp: 0.25, drums: false },
  victory: { root: 55, bpm: 118, prog: [[0, 4, 7], [2, 5, 9], [4, 7, 11], [0, 4, 7, 12]], arp: 0.33, drums: true },
};

export class SynthAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private wetBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private theme: MusicTheme = 'menu';
  private noiseBuf: AudioBuffer | null = null;

  muted = false;
  volume = 0.75;
  musicVolume = 0.42;

  get ready() { return !!this.ctx; }

  /** must be called from a user gesture */
  ensure(): Ctx | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC: typeof AudioContext = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 26; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.22;
      master.connect(comp); comp.connect(ctx.destination);
      this.master = master;

      const musicBus = ctx.createGain(); musicBus.gain.value = this.musicVolume;
      const sfxBus = ctx.createGain(); sfxBus.gain.value = 0.95;
      musicBus.connect(master); sfxBus.connect(master);
      this.musicBus = musicBus; this.sfxBus = sfxBus;

      // simple algorithmic reverb (feedback delay network) — no IR files
      const wet = ctx.createGain(); wet.gain.value = 0.32;
      const d1 = ctx.createDelay(1.0); d1.delayTime.value = 0.037;
      const d2 = ctx.createDelay(1.0); d2.delayTime.value = 0.053;
      const d3 = ctx.createDelay(1.0); d3.delayTime.value = 0.071;
      const fb1 = ctx.createGain(); fb1.gain.value = 0.72;
      const fb2 = ctx.createGain(); fb2.gain.value = 0.66;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3600;
      d1.connect(fb1); fb1.connect(d1);
      d2.connect(fb2); fb2.connect(d2);
      d3.connect(tone); tone.connect(d1); tone.connect(d2);
      d1.connect(wet); d2.connect(wet); d3.connect(wet);
      wet.connect(master);
      this.wetBus = wet;
      (this as never as { _delays: DelayNode[] })._delays = [d1, d2, d3];

      const len = Math.floor(ctx.sampleRate * 1.4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) { this.volume = v; if (this.master && !this.muted) this.master.gain.value = v; }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }
  setMusicVolume(v: number) { this.musicVolume = v; if (this.musicBus) this.musicBus.gain.value = v; }

  private noise(): AudioBuffer | null { return this.noiseBuf; }

  private t0(): number { return this.ctx ? this.ctx.currentTime : 0; }

  private send(node: AudioNode, amount: number) {
    if (!this.wetBus) return;
    const g = this.ctx!.createGain(); g.gain.value = amount;
    node.connect(g); g.connect(this.wetBus);
  }

  private delayNodes(): DelayNode[] { return (this as never as { _delays?: DelayNode[] })._delays ?? []; }

  /* --------------------------- primitives --------------------------- */

  private tone(o: {
    f0: number; f1?: number; type?: OscillatorType; t?: number; dur?: number; gain?: number;
    bus?: 'music' | 'sfx'; detune?: number; glideCurve?: 'exp' | 'lin'; send?: number; filter?: number;
  }) {
    const ctx = this.ctx; if (!ctx) return;
    const now = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f0), now);
    if (o.f1 && o.f1 !== o.f0) {
      const end = now + (o.dur ?? 0.2);
      if (o.glideCurve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(20, o.f1), end);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), end);
    }
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.25;
    const dur = o.dur ?? 0.2;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let last: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter;
      osc.connect(f); last = f;
    }
    last.connect(g);
    g.connect(o.bus === 'music' ? this.musicBus! : this.sfxBus!);
    if (o.send) this.send(g, o.send);
    osc.start(now); osc.stop(now + dur + 0.05);
  }

  private noiseHit(o: {
    t?: number; dur?: number; gain?: number; f0?: number; f1?: number; q?: number; type?: BiquadFilterType;
    bus?: 'music' | 'sfx'; send?: number;
  }) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const now = o.t ?? ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f0 ?? 1200, now);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1), now + (o.dur ?? 0.15));
    f.Q.value = o.q ?? 1.2;
    const g = ctx.createGain();
    const dur = o.dur ?? 0.15, peak = o.gain ?? 0.22;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g);
    g.connect(o.bus === 'music' ? this.musicBus! : this.sfxBus!);
    if (o.send) this.send(g, o.send);
    src.start(now); src.stop(now + dur + 0.05);
  }

  private kick(t: number, gain = 0.5) {
    this.tone({ f0: 130, f1: 42, type: 'sine', t, dur: 0.19, gain, bus: 'music' });
    this.noiseHit({ t, dur: 0.03, gain: gain * 0.25, f0: 2600, type: 'highpass', bus: 'music' });
  }
  private snare(t: number, gain = 0.24) {
    this.noiseHit({ t, dur: 0.14, gain, f0: 1900, f1: 700, q: 0.8, bus: 'music', send: 0.18 });
    this.tone({ f0: 190, f1: 130, type: 'triangle', t, dur: 0.1, gain: gain * 0.5, bus: 'music' });
  }
  private hat(t: number, gain = 0.1, open = false) {
    this.noiseHit({ t, dur: open ? 0.16 : 0.045, gain, f0: 8200, f1: 6200, type: 'highpass', bus: 'music' });
  }
  private bassNote(midi: number, t: number, dur: number, gain = 0.3) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    this.tone({ f0: f, f1: f * 0.995, type: 'sawtooth', t, dur, gain, bus: 'music', filter: 260, send: 0.05 });
    this.tone({ f0: f / 2, type: 'sine', t, dur: dur * 1.1, gain: gain * 0.8, bus: 'music' });
  }
  private padChord(midis: number[], t: number, dur: number, gain = 0.09) {
    for (const m of midis) {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      this.tone({ f0: f, type: 'triangle', t, dur, gain, bus: 'music', send: 0.3, detune: -6 });
      this.tone({ f0: f * 2.001, type: 'sine', t, dur, gain: gain * 0.4, bus: 'music', send: 0.4, detune: 7 });
    }
  }
  private pluck(midi: number, t: number, gain = 0.16) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    this.tone({ f0: f, f1: f, type: 'square', t, dur: 0.12, gain, bus: 'music', filter: 2400, send: 0.22 });
  }

  /* ----------------------------- music loop ----------------------------- */

  playMusic(theme: MusicTheme) {
    if (!this.ensure()) return;
    this.theme = theme;
    if (this.timer != null) return;
    this.nextNoteTime = this.t0() + 0.08;
    this.step = 0;
    const tick = () => {
      const ctx = this.ctx; if (!ctx) return;
      const cfg = SCALE[this.theme];
      const spb = 60 / cfg.bpm / 4; // 16th
      while (this.nextNoteTime < ctx.currentTime + 0.18) {
        this.scheduleStep(this.nextNoteTime, this.step, cfg);
        this.nextNoteTime += spb;
        this.step = (this.step + 1) % 64;
      }
    };
    this.timer = window.setInterval(tick, 40);
    tick();
  }
  stopMusic() { if (this.timer != null) { clearInterval(this.timer); this.timer = null; } }

  private scheduleStep(t: number, step: number, cfg: (typeof SCALE)[MusicTheme]) {
    const bar = Math.floor(step / 16) % cfg.prog.length;
    const chord = cfg.prog[bar];
    const s16 = step % 16;
    const beat = s16 % 4 === 0;

    if (cfg.drums) {
      const intensity = this.theme === 'boss' ? 1.15 : 1;
      if (s16 === 0 || s16 === 8) this.kick(t, 0.42 * intensity);
      if (this.theme === 'boss' && s16 === 11) this.kick(t, 0.3);
      if (s16 === 4 || s16 === 12) this.snare(t, 0.2 * intensity);
      if (s16 % 2 === 0) this.hat(t, s16 % 4 === 2 ? 0.09 : 0.05, s16 === 14);
    }
    if (s16 === 0) {
      this.padChord(chord.map((c) => cfg.root + 12 + c), t, (60 / cfg.bpm) * 2, this.theme === 'menu' ? 0.075 : 0.05);
    }
    if (beat || (cfg.drums && s16 % 2 === 0)) {
      const n = chord[(step / (cfg.drums ? 2 : 4)) % chord.length | 0] ?? 0;
      this.bassNote(cfg.root - 12 + n, t, cfg.drums ? 0.22 : 0.34, cfg.drums ? 0.3 : 0.22);
    }
    const arpStep = Math.round(cfg.arp * 16);
    if (arpStep > 0 && step % arpStep === 0) {
      const idx = (step / arpStep) % chord.length;
      const oct = ((step / arpStep) % 8 >= 6) ? 24 : 12;
      this.pluck(cfg.root + oct + chord[idx], t, this.theme === 'battle' || this.theme === 'boss' ? 0.12 : 0.1);
    }
    if (this.theme === 'gacha' && s16 === 15) {
      this.pluck(cfg.root + 36 + chord[step % chord.length], t, 0.08);
    }
  }

  /* -------------------------------- sfx -------------------------------- */

  sfx(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    switch (name) {
      case 'ui':
        this.tone({ f0: 880, f1: 1180, type: 'triangle', t, dur: 0.06, gain: 0.12 });
        break;
      case 'uiBack':
        this.tone({ f0: 520, f1: 340, type: 'triangle', t, dur: 0.08, gain: 0.11 });
        break;
      case 'select':
        this.tone({ f0: 1320, f1: 1980, type: 'sine', t, dur: 0.07, gain: 0.13, send: 0.12 });
        break;
      case 'error':
        this.tone({ f0: 220, f1: 150, type: 'square', t, dur: 0.16, gain: 0.14, filter: 900 });
        break;
      case 'diceShake':
        for (let i = 0; i < 9; i++) {
          this.noiseHit({ t: t + i * 0.055, dur: 0.05, gain: 0.1 + (i % 3) * 0.04, f0: 2200 + Math.random() * 2400, q: 4 });
        }
        this.tone({ f0: 300, f1: 240, type: 'triangle', t, dur: 0.4, gain: 0.05 });
        break;
      case 'diceLand':
        this.tone({ f0: 260, f1: 90, type: 'sine', t, dur: 0.24, gain: 0.3 });
        this.noiseHit({ t, dur: 0.12, gain: 0.2, f0: 1500, f1: 400 });
        this.tone({ f0: 900, f1: 1400, type: 'triangle', t: t + 0.02, dur: 0.16, gain: 0.12, send: 0.25 });
        break;
      case 'slash':
        this.noiseHit({ t, dur: 0.17, gain: 0.3, f0: 6200, f1: 900, q: 0.7, send: 0.12 });
        this.tone({ f0: 1500, f1: 260, type: 'sawtooth', t, dur: 0.12, gain: 0.1, filter: 3000 });
        break;
      case 'hit':
        this.noiseHit({ t, dur: 0.13, gain: 0.26, f0: 420, f1: 140, type: 'lowpass' });
        this.tone({ f0: 180, f1: 70, type: 'square', t, dur: 0.12, gain: 0.2, filter: 700 });
        break;
      case 'crit':
        this.noiseHit({ t, dur: 0.2, gain: 0.34, f0: 5200, f1: 700, q: 0.6, send: 0.2 });
        this.tone({ f0: 240, f1: 60, type: 'square', t, dur: 0.18, gain: 0.28, filter: 1200 });
        this.tone({ f0: 2637, f1: 1760, type: 'triangle', t: t + 0.03, dur: 0.2, gain: 0.16, send: 0.3 });
        break;
      case 'heal':
        [0, 0.07, 0.14].forEach((d, i) => this.tone({ f0: 660 + i * 220, type: 'sine', t: t + d, dur: 0.3, gain: 0.14, send: 0.4 }));
        break;
      case 'buff':
        [0, 4, 7].forEach((n, i) => this.tone({ f0: 440 * Math.pow(2, n / 12), type: 'triangle', t: t + i * 0.06, dur: 0.26, gain: 0.13, send: 0.3 }));
        break;
      case 'debuff':
        this.tone({ f0: 400, f1: 120, type: 'sawtooth', t, dur: 0.3, gain: 0.14, filter: 1400 });
        this.noiseHit({ t: t + 0.02, dur: 0.22, gain: 0.12, f0: 900, f1: 200 });
        break;
      case 'burn':
        for (let i = 0; i < 5; i++) this.noiseHit({ t: t + i * 0.05, dur: 0.2, gain: 0.1, f0: 700 + Math.random() * 900, f1: 200, q: 0.6, send: 0.2 });
        break;
      case 'freeze':
        this.tone({ f0: 2400, f1: 5200, type: 'sine', t, dur: 0.3, gain: 0.12, send: 0.4 });
        this.noiseHit({ t, dur: 0.3, gain: 0.14, f0: 7000, f1: 3000, type: 'highpass' });
        break;
      case 'shock':
        for (let i = 0; i < 4; i++) this.noiseHit({ t: t + i * 0.035, dur: 0.09, gain: 0.22, f0: 3800, f1: 900, q: 6 });
        this.tone({ f0: 90, f1: 40, type: 'square', t, dur: 0.25, gain: 0.14 });
        break;
      case 'poison':
        [0, 0.08, 0.17].forEach((d) => this.tone({ f0: 320 + Math.random() * 60, f1: 140, type: 'sine', t: t + d, dur: 0.22, gain: 0.12, filter: 800 }));
        break;
      case 'death':
        this.tone({ f0: 300, f1: 45, type: 'sawtooth', t, dur: 0.6, gain: 0.2, filter: 900, send: 0.3 });
        this.noiseHit({ t, dur: 0.45, gain: 0.2, f0: 1200, f1: 120, q: 0.5 });
        break;
      case 'magic':
        [0, 3, 7, 12, 19].forEach((n, i) => this.tone({ f0: 520 * Math.pow(2, n / 12), type: 'sine', t: t + i * 0.045, dur: 0.34, gain: 0.11, send: 0.4 }));
        this.noiseHit({ t: t + 0.05, dur: 0.3, gain: 0.1, f0: 5000, f1: 1800, type: 'bandpass' });
        break;
      case 'qteGood':
        this.tone({ f0: 1200, f1: 2400, type: 'triangle', t, dur: 0.14, gain: 0.18, send: 0.3 });
        this.tone({ f0: 1800, f1: 3600, type: 'sine', t: t + 0.05, dur: 0.16, gain: 0.12, send: 0.3 });
        break;
      case 'qteMiss':
        this.tone({ f0: 300, f1: 120, type: 'square', t, dur: 0.18, gain: 0.16, filter: 900 });
        break;
      case 'qteTick':
        this.tone({ f0: 1600, type: 'square', t, dur: 0.03, gain: 0.08 });
        break;
      case 'block':
        this.noiseHit({ t, dur: 0.1, gain: 0.3, f0: 3400, f1: 1200, q: 3 });
        this.tone({ f0: 700, f1: 300, type: 'square', t, dur: 0.1, gain: 0.18, filter: 2000 });
        break;
      case 'gacha':
        [0, 2, 4, 7, 9, 12, 14, 17].forEach((n, i) => this.tone({ f0: 440 * Math.pow(2, n / 12), type: 'triangle', t: t + i * 0.07, dur: 0.3, gain: 0.11, send: 0.35 }));
        break;
      case 'gachaRevealR':
        this.tone({ f0: 640, f1: 640, type: 'sine', t, dur: 0.18, gain: 0.15, send: 0.2 });
        break;
      case 'gachaRevealSR':
        [0, 4, 7].forEach((n, i) => this.tone({ f0: 587 * Math.pow(2, n / 12), type: 'triangle', t: t + i * 0.07, dur: 0.4, gain: 0.16, send: 0.35 }));
        break;
      case 'gachaRevealSSR':
        [0, 4, 7, 12, 16, 19].forEach((n, i) => this.tone({ f0: 523 * Math.pow(2, n / 12), type: 'sawtooth', t: t + i * 0.06, dur: 0.7, gain: 0.14, filter: 5200, send: 0.45 }));
        this.noiseHit({ t, dur: 0.7, gain: 0.16, f0: 8000, f1: 1200, type: 'highpass', send: 0.4 });
        break;
      case 'victory':
        [0, 4, 7, 12].forEach((n, i) => this.tone({ f0: 523 * Math.pow(2, n / 12), type: 'triangle', t: t + i * 0.11, dur: 0.6, gain: 0.17, send: 0.35 }));
        this.kick(t, 0.4);
        break;
      case 'defeat':
        [0, -2, -5, -9].forEach((n, i) => this.tone({ f0: 392 * Math.pow(2, n / 12), type: 'sawtooth', t: t + i * 0.16, dur: 0.8, gain: 0.15, filter: 1100, send: 0.3 }));
        break;
      case 'coin':
        this.tone({ f0: 1250, f1: 1650, type: 'square', t, dur: 0.07, gain: 0.1 });
        this.tone({ f0: 1650, f1: 2100, type: 'square', t: t + 0.06, dur: 0.09, gain: 0.09 });
        break;
      case 'forge':
        this.noiseHit({ t, dur: 0.12, gain: 0.3, f0: 2600, f1: 600, q: 2 });
        this.tone({ f0: 900, f1: 300, type: 'square', t, dur: 0.14, gain: 0.16, filter: 2200, send: 0.25 });
        this.tone({ f0: 1400, f1: 900, type: 'triangle', t: t + 0.1, dur: 0.3, gain: 0.1, send: 0.3 });
        break;
      case 'aura':
        this.tone({ f0: 120, f1: 420, type: 'sine', t, dur: 0.5, gain: 0.14, send: 0.4 });
        break;
    }
  }

  /** pitch-rising tick used by the dice roll (0..1 progress) */
  diceTick(progress: number) {
    const ctx = this.ensure(); if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    this.noiseHit({ t, dur: 0.03, gain: 0.09, f0: 1400 + progress * 2600, q: 6 });
  }

  dispose() { this.stopMusic(); if (this.ctx) { void this.ctx.close(); this.ctx = null; } }
}

export type SfxName =
  | 'ui' | 'uiBack' | 'select' | 'error'
  | 'diceShake' | 'diceLand' | 'slash' | 'hit' | 'crit' | 'heal' | 'buff' | 'debuff'
  | 'burn' | 'freeze' | 'shock' | 'poison' | 'death' | 'magic' | 'block'
  | 'qteGood' | 'qteMiss' | 'qteTick' | 'gacha' | 'gachaRevealR' | 'gachaRevealSR' | 'gachaRevealSSR'
  | 'victory' | 'defeat' | 'coin' | 'forge' | 'aura';

let instance: SynthAudio | null = null;
export function audio(): SynthAudio {
  if (!instance) instance = new SynthAudio();
  return instance;
}
