import type { LayerKey, LevelState } from "./scenes";

const LAYER_MAX: Record<LayerKey, number> = {
  rain: 0.55,
  wind: 0.4,
  cafe: 0.2,
  fire: 0.6,
  keys: 0.5,
  thunder: 0.8,
};

type LoopKey = "rain" | "wind" | "fire";
type SampleKey = "keys" | "thunder";

const LOOP_FILES: Record<LoopKey, string> = {
  rain: "/audio/rain.mp3",
  wind: "/audio/wind.mp3",
  fire: "/audio/fire.mp3",
};

const SAMPLE_FILES: Record<SampleKey, string> = {
  keys: "/audio/keys.mp3",
  thunder: "/audio/thunder.mp3",
};

interface ContinuousNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

type Ctor = typeof AudioContext;

const MASTER_FADE_SEC = 0.4;

// Rain, wind and fire are real CC0 recordings (see public/audio/CREDITS.md),
// looped through the Web Audio API. Café has no clean CC0 source, so it stays
// synthesized (filtered noise). Keys and thunder are real one-shot samples
// triggered at randomized intervals instead of played as loops.
export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private loopBuffers: Partial<Record<LoopKey, AudioBuffer>> = {};
  private sampleBuffers: Partial<Record<SampleKey, AudioBuffer>> = {};
  private bufferLoadPromise: Promise<void> | null = null;

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

  private async loadBuffers(): Promise<void> {
    if (this.bufferLoadPromise) return this.bufferLoadPromise;
    const ctx = this.getCtx();
    const load = async (url: string) => {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      return ctx.decodeAudioData(arr);
    };
    this.bufferLoadPromise = (async () => {
      await Promise.all([
        ...(Object.entries(LOOP_FILES) as [LoopKey, string][]).map(async ([key, url]) => {
          try {
            this.loopBuffers[key] = await load(url);
          } catch {
            console.warn(`cozy-focus: failed to load ambient loop "${key}"`);
          }
        }),
        ...(Object.entries(SAMPLE_FILES) as [SampleKey, string][]).map(async ([key, url]) => {
          try {
            this.sampleBuffers[key] = await load(url);
          } catch {
            console.warn(`cozy-focus: failed to load ambient sample "${key}"`);
          }
        }),
      ]);
    })();
    return this.bufferLoadPromise;
  }

  private buildLoopLayer(key: LoopKey) {
    const buffer = this.loopBuffers[key];
    if (!buffer || this.continuous[key]) return;
    const ctx = this.getCtx();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = (this.levels[key] / 100) * LAYER_MAX[key];
    source.connect(gain);
    gain.connect(this.master!);
    source.start();
    this.continuous[key] = { source, gain };
  }

  private buildCafeSynth() {
    if (this.continuous.cafe) return;
    const ctx = this.getCtx();
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer!;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
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
    const gain = ctx.createGain();
    gain.gain.value = (this.levels.cafe / 100) * LAYER_MAX.cafe;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start();
    this.continuous.cafe = { source, gain };
  }

  private playSample(key: SampleKey, opts: { gain: number; rate?: number; offset?: number; duration?: number }) {
    const buffer = this.sampleBuffers[key];
    if (!buffer) return;
    const ctx = this.getCtx();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(this.master!);
    const now = ctx.currentTime;
    const attack = 0.015;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(opts.gain, now + attack);
    const dur = opts.duration ?? buffer.duration - (opts.offset ?? 0);
    g.gain.setValueAtTime(opts.gain, Math.max(now, now + dur - 0.03));
    g.gain.linearRampToValueAtTime(0, now + dur);
    src.start(now, opts.offset ?? 0, dur);
    src.stop(now + dur + 0.02);
    src.onended = () => {
      src.disconnect();
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

  private keysTick = (level: number): number => {
    if (level > 0) {
      const buffer = this.sampleBuffers.keys;
      if (buffer) {
        const duration = Math.min(0.5, buffer.duration * 0.3);
        const offset = Math.random() * Math.max(0, buffer.duration - duration);
        this.playSample("keys", {
          gain: LAYER_MAX.keys * (level / 100) * (0.5 + Math.random() * 0.5),
          rate: 0.9 + Math.random() * 0.3,
          offset,
          duration,
        });
      }
    }
    return level <= 0 ? 900 : Math.max(500, 1400 + Math.random() * (2600 - level * 16));
  };

  private thunderTick = (level: number): number => {
    if (level > 0 && Math.random() < 0.85) {
      this.playSample("thunder", {
        gain: LAYER_MAX.thunder * (level / 100) * (0.7 + Math.random() * 0.3),
        rate: 0.85 + Math.random() * 0.3,
      });
    }
    if (level <= 0) return 5000;
    const base = 22000 - level * 140;
    return Math.max(6000, base + Math.random() * 18000);
  };

  start() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    this.master!.gain.cancelScheduledValues(now);
    this.master!.gain.setValueAtTime(this.master!.gain.value, now);
    this.master!.gain.linearRampToValueAtTime(1, now + MASTER_FADE_SEC);
    if (ctx.state === "suspended") ctx.resume();
    this.playing = true;
    void this.loadBuffers().then(() => {
      if (!this.playing || this.built) return;
      this.buildLoopLayer("rain");
      this.buildLoopLayer("wind");
      this.buildLoopLayer("fire");
      this.buildCafeSynth();
      this.built = true;
    });
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
    const ctx = this.ctx;
    if (ctx && ctx.state === "running" && this.master) {
      const now = ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + MASTER_FADE_SEC);
      window.setTimeout(() => {
        if (!this.playing && ctx.state === "running") ctx.suspend();
      }, MASTER_FADE_SEC * 1000 + 30);
    }
  }

  isPlaying() {
    return this.playing;
  }

  setLevel(key: LayerKey, value: number) {
    this.levels[key] = value;
    const cont = this.continuous[key];
    if (cont && this.ctx) {
      const target = (value / 100) * LAYER_MAX[key];
      cont.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      cont.gain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.25);
    }
  }

  setLevels(levels: LevelState) {
    (Object.keys(levels) as LayerKey[]).forEach((k) => this.setLevel(k, levels[k]));
  }

  playChime() {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // soft ascending triad, C5-E5-G5
    notes.forEach((freq, i) => {
      const start = now + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.2);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.continuous = {};
    this.built = false;
    this.bufferLoadPromise = null;
  }
}

export const ambientEngine = new AmbientEngine();
