import type { LayerKey, LevelState } from "./scenes";

const LAYER_MAX: Record<LayerKey, number> = {
  rain: 0.32,
  wind: 0.28,
  cafe: 0.2,
  fire: 0.55,
  keys: 0.4,
  thunder: 0.7,
};

interface ContinuousNode {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

type Ctor = typeof AudioContext;

// All six ambient layers are synthesized in the browser with the Web Audio
// API (filtered/shaped noise) rather than streamed from audio files, so the
// app has no external audio assets to fetch, license, or ship.
export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private continuous: Partial<Record<LayerKey, ContinuousNode>> = {};
  private levels: LevelState = { rain: 0, fire: 0, cafe: 0, wind: 0, keys: 0, thunder: 0 };
  private playing = false;
  private built = false;
  private timers: Partial<Record<LayerKey, number>> = {};

  private getCtx(): AudioContext {
    if (!this.ctx) {
      const AC: Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private buildContinuous(key: "rain" | "wind" | "cafe") {
    const ctx = this.getCtx();
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const initial = (this.levels[key] / 100) * LAYER_MAX[key];
    gain.gain.value = initial;

    if (key === "rain") {
      filter.type = "highpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.7;
    } else if (key === "wind") {
      filter.type = "lowpass";
      filter.frequency.value = 500;
      filter.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    } else {
      filter.type = "bandpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 150;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    }

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start();
    this.continuous[key] = { source, filter, gain };
  }

  private burst(opts: {
    type: BiquadFilterType;
    freq: number;
    q: number;
    duration: number;
    gain: number;
    attack?: number;
  }) {
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer!;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.type;
    filt.frequency.value = opts.freq;
    filt.Q.value = opts.q;
    const g = ctx.createGain();
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master!);

    const now = ctx.currentTime;
    const offset = Math.random() * Math.max(0.01, this.noiseBuffer!.duration - opts.duration - 0.05);
    const attack = opts.attack ?? opts.duration * 0.15;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(opts.gain, now + attack);
    g.gain.linearRampToValueAtTime(0, now + opts.duration);
    src.start(now, offset, opts.duration);
    src.stop(now + opts.duration + 0.02);
    src.onended = () => {
      src.disconnect();
      filt.disconnect();
      g.disconnect();
    };
  }

  private scheduleLoop(key: LayerKey, tick: (level: number) => number) {
    const step = () => {
      if (!this.playing) return;
      const level = this.levels[key];
      const delay = tick(level);
      this.timers[key] = window.setTimeout(step, delay);
    };
    if (this.timers[key]) window.clearTimeout(this.timers[key]);
    step();
  }

  private fireTick = (level: number): number => {
    if (level > 0) {
      this.burst({
        type: "bandpass",
        freq: 900 + Math.random() * 2400,
        q: 1.4,
        duration: 0.035 + Math.random() * 0.06,
        gain: LAYER_MAX.fire * (level / 100) * (0.35 + Math.random() * 0.65),
      });
    }
    return level <= 0 ? 900 : Math.max(70, 110 + Math.random() * (700 - level * 4.5));
  };

  private keysTick = (level: number): number => {
    if (level > 0) {
      this.burst({
        type: "highpass",
        freq: 2800 + Math.random() * 1200,
        q: 0.8,
        duration: 0.016 + Math.random() * 0.014,
        gain: LAYER_MAX.keys * (level / 100) * (0.45 + Math.random() * 0.55),
      });
    }
    return level <= 0 ? 900 : Math.max(70, 90 + Math.random() * (900 - level * 6));
  };

  private thunderTick = (level: number): number => {
    if (level > 0 && Math.random() < 0.85) {
      this.burst({
        type: "lowpass",
        freq: 110 + Math.random() * 60,
        q: 0.7,
        duration: 1.3 + Math.random() * 1.8,
        gain: LAYER_MAX.thunder * (level / 100) * (0.6 + Math.random() * 0.4),
        attack: 0.35,
      });
    }
    if (level <= 0) return 5000;
    const base = 22000 - level * 140;
    return Math.max(6000, base + Math.random() * 18000);
  };

  start() {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") ctx.resume();
    if (!this.built) {
      this.buildContinuous("rain");
      this.buildContinuous("wind");
      this.buildContinuous("cafe");
      this.built = true;
    }
    this.playing = true;
    this.scheduleLoop("fire", this.fireTick);
    this.scheduleLoop("keys", this.keysTick);
    this.scheduleLoop("thunder", this.thunderTick);
  }

  stop() {
    this.playing = false;
    (Object.keys(this.timers) as LayerKey[]).forEach((k) => {
      const id = this.timers[k];
      if (id) window.clearTimeout(id);
    });
    this.timers = {};
    if (this.ctx && this.ctx.state === "running") this.ctx.suspend();
  }

  isPlaying() {
    return this.playing;
  }

  setLevel(key: LayerKey, value: number) {
    this.levels[key] = value;
    const cont = this.continuous[key as "rain" | "wind" | "cafe"];
    if (cont && this.ctx) {
      const target = (value / 100) * LAYER_MAX[key];
      cont.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      cont.gain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.25);
    }
  }

  setLevels(levels: LevelState) {
    (Object.keys(levels) as LayerKey[]).forEach((k) => this.setLevel(k, levels[k]));
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.continuous = {};
    this.built = false;
  }
}

export const ambientEngine = new AmbientEngine();
