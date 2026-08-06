// High-quality procedural WebAudio sound synthesizer (Zero assets required)
export class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxGain!: GainNode;
  bgmGain!: GainNode;
  noise!: AudioBuffer;
  muted = false;
  bgmVolume = 0.45;
  sfxVolume = 0.65;

  private bgmIntervalId: number | null = null;

  init() {
    if (this.ctx) return;
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 1.0;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;
    this.bgmGain.connect(this.master);

    // High quality white noise buffer
    const len = this.ctx.sampleRate * 2.0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = Math.random() * 2 - 1;
    }
    this.noise = buf;

    this.startAmbientDrone();
    this.startProceduralBgm();
  }

  resume() {
    this.ctx?.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setValueAtTime(m ? 0 : 1.0, this.ctx?.currentTime || 0);
    }
  }

  setVolume(sfxVol: number, bgmVol: number) {
    this.sfxVolume = sfxVol;
    this.bgmVolume = bgmVol;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.muted ? 0 : sfxVol, this.ctx.currentTime);
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.muted ? 0 : bgmVol, this.ctx.currentTime);
    }
  }

  private now() {
    return this.ctx!.currentTime;
  }

  private burst(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = "lowpass", dest: AudioNode = this.sfxGain) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, this.now());
    f.Q.setValueAtTime(q, this.now());
    const g = c.createGain();
    const t = this.now();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = "sine", dest: AudioNode = this.sfxGain) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    const g = c.createGain();
    const t = this.now();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Realistic metallic, cracking gunshots
  shot(tone: number, boom: number, quiet?: boolean) {
    if (!this.ctx || this.muted) return;
    if (quiet) {
      this.burst(0.09, 1000, 1.2, 0.28, "bandpass");
      this.tone(tone * 1.1, tone * 0.4, 0.08, 0.15, "triangle");
      return;
    }
    // Body boom
    this.burst(0.35 * boom + 0.1, 150 + tone * 0.3, 1.5, 0.8, "lowpass");
    // Crack/Snap of muzzle velocity
    this.burst(0.06, 2800, 2.5, 0.9, "highpass");
    // Gun body echo
    this.tone(tone * 1.5, tone * 0.25, 0.15 + boom * 0.4, 0.45, "sawtooth");
  }

  remoteShot(tone: number, boom: number, dist: number, quiet?: boolean) {
    if (!this.ctx || this.muted) return;
    const att = Math.max(0.02, 1.0 - dist / 80) * (quiet ? 0.35 : 1);
    this.burst(0.08 + boom * 0.25, 450 + tone * 0.5, 1.0, 0.45 * att, "bandpass");
    this.tone(tone * 0.8, tone * 0.25, 0.1 + boom * 0.3, 0.25 * att, "triangle");
  }

  click() {
    if (!this.ctx || this.muted) return;
    this.burst(0.04, 3100, 4, 0.35, "highpass");
  }

  reload(stage: number) {
    if (!this.ctx || this.muted) return;
    if (stage === 0) {
      this.burst(0.09, 1100, 2.5, 0.35, "bandpass");
      this.tone(220, 120, 0.08, 0.18, "sawtooth");
    } else if (stage === 1) {
      this.burst(0.12, 1400, 3, 0.3, "bandpass");
      this.tone(310, 150, 0.1, 0.15, "triangle");
    } else {
      this.burst(0.08, 2100, 4, 0.4, "highpass");
      this.tone(140, 240, 0.09, 0.2, "sawtooth");
    }
  }

  footstep(surface: "grass" | "wood" | "stone" | "sand") {
    if (!this.ctx || this.muted) return;
    if (surface === "grass") {
      this.burst(0.08, 350, 0.7, 0.18, "lowpass");
      this.burst(0.05, 1800, 1.1, 0.07, "bandpass");
    } else if (surface === "wood") {
      this.burst(0.12, 220, 1.2, 0.24, "lowpass");
      this.tone(180, 90, 0.07, 0.14, "triangle");
    } else if (surface === "stone") {
      this.burst(0.09, 450, 2.0, 0.26, "bandpass");
      this.burst(0.04, 2500, 3.0, 0.12, "highpass");
    } else { // sand
      this.burst(0.14, 600, 0.6, 0.28, "bandpass");
    }
  }

  slide() {
    if (!this.ctx || this.muted) return;
    this.burst(0.35, 450, 0.8, 0.35, "bandpass");
  }

  jump() {
    if (!this.ctx || this.muted) return;
    this.tone(160, 240, 0.14, 0.22, "triangle");
    this.burst(0.1, 500, 1.0, 0.12, "lowpass");
  }

  land(surface: "grass" | "wood" | "stone" | "sand") {
    if (!this.ctx || this.muted) return;
    this.footstep(surface);
    this.burst(0.18, 250, 1.5, 0.35, "lowpass");
    this.tone(110, 60, 0.12, 0.22, "triangle");
  }

  hit() {
    if (!this.ctx || this.muted) return;
    this.tone(1100, 700, 0.07, 0.24, "sawtooth");
  }

  headshot() {
    if (!this.ctx || this.muted) return;
    this.tone(2600, 1500, 0.12, 0.35, "square");
    this.burst(0.05, 3400, 3.5, 0.25, "highpass");
  }

  kill() {
    if (!this.ctx || this.muted) return;
    this.tone(680, 1280, 0.15, 0.22, "triangle");
    this.burst(0.18, 900, 1.0, 0.28, "bandpass");
  }

  hurt() {
    if (!this.ctx || this.muted) return;
    this.tone(210, 50, 0.3, 0.45, "sawtooth");
    this.burst(0.24, 380, 1.2, 0.35, "lowpass");
  }

  boom() {
    if (!this.ctx || this.muted) return;
    // deep low boom
    this.burst(0.8, 120, 1.2, 0.95, "lowpass");
    this.tone(90, 20, 0.6, 0.65, "sawtooth");
    // high frequency blast wave
    this.burst(0.25, 1800, 0.5, 0.55, "highpass");
  }

  pickup() {
    if (!this.ctx || this.muted) return;
    this.tone(520, 1040, 0.14, 0.25, "sine");
    this.tone(780, 1560, 0.18, 0.2, "sine");
  }

  wave() {
    if (!this.ctx || this.muted) return;
    const f = [262, 330, 392, 523];
    f.forEach((freq, idx) => {
      setTimeout(() => {
        this.tone(freq, freq * 1.5, 0.25, 0.2, "triangle");
      }, idx * 110);
    });
  }

  over() {
    if (!this.ctx || this.muted) return;
    const f = [392, 311, 262, 196];
    f.forEach((freq, idx) => {
      setTimeout(() => {
        this.tone(freq, freq * 0.7, 0.4, 0.3, "sawtooth");
      }, idx * 190);
    });
  }

  private startAmbientDrone() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(62, this.now());

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, this.now());

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.04, this.now());

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(0);
  }

  // Purely procedural, nostalgic synthesizer music generator!
  private startProceduralBgm() {
    if (!this.ctx) return;
    if (this.bgmIntervalId) return;

    let step = 0;
    // Energetic retro-modern defense synth bass line + lead
    const bass = [55, 55, 65.4, 65.4, 73.4, 73.4, 82.4, 82.4]; // A, C, D, E notes
    const lead = [
      220, 261.6, 293.7, 329.6, 220, 261.6, 293.7, 329.6,
      392, 329.6, 293.7, 261.6, 329.6, 293.7, 261.6, 220
    ];

    const playStep = () => {
      if (this.muted || this.bgmVolume < 0.01) return;
      const t = this.now();
      
      // Plucky, fat analog bass synthesizer sound
      const bFreq = bass[step % bass.length];
      const bOsc = this.ctx!.createOscillator();
      bOsc.type = "triangle";
      bOsc.frequency.setValueAtTime(bFreq, t);
      
      const bFilter = this.ctx!.createBiquadFilter();
      bFilter.type = "lowpass";
      bFilter.frequency.setValueAtTime(350, t);
      
      const bGain = this.ctx!.createGain();
      bGain.gain.setValueAtTime(0.24, t);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      
      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.bgmGain);
      bOsc.start(t);
      bOsc.stop(t + 0.3);

      // Procedural cyberpunk melody synth lead, triggered every 2 beats
      if (step % 2 === 0) {
        const lFreq = lead[(step / 2) % lead.length];
        const lOsc = this.ctx!.createOscillator();
        lOsc.type = "sine";
        lOsc.frequency.setValueAtTime(lFreq, t);

        const lGain = this.ctx!.createGain();
        lGain.gain.setValueAtTime(0.08, t);
        lGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        lOsc.connect(lGain);
        lGain.connect(this.bgmGain);
        lOsc.start(t);
        lOsc.stop(t + 0.5);
      }

      step++;
    };

    // Tempo of 140 BPM, beat is every 0.214 seconds
    this.bgmIntervalId = window.setInterval(playStep, 214);
  }
}
