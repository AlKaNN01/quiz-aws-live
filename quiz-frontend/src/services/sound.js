/**
 * sound.js — Web Audio API ses motoru
 * Harici dosya yok — tüm sesler synthesizer ile üretiliyor.
 * Kullanım: sound.init() → kullanıcı etkileşimi sonrası çağır
 */

const N = {
  G2: 97.99,
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, Fs4: 369.99,
  G4: 392,    A4: 440,    B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880,
  C6: 1046.5, D6: 1174.66,
};

class SoundService {
  constructor() {
    this.ctx    = null;
    this.master = null;
    this._bgStop = null;
    this._muted  = localStorage.getItem('quiz_mute') === '1';
  }

  get muted() { return this._muted; }

  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem('quiz_mute', this._muted ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this._muted ? 0 : 1,
        this.ctx.currentTime,
        0.05,
      );
    }
    return this._muted;
  }

  /** AudioContext'i başlat — kullanıcı etkileşimi sonrası çağrılmalı */
  init() {
    if (this.ctx) return;
    try {
      this.ctx    = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API desteklenmiyor:', e);
    }
  }

  _resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** Tek nota */
  _n(freq, t, dur, type = 'sine', vol = 0.2, attack = 0.02, release = 0.12) {
    if (!this.ctx || !this.master) return;
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const rs = Math.max(t + attack + 0.001, t + dur - release);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, rs);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.01);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.06);
    } catch (_) {}
  }

  stopBg() {
    if (this._bgStop) { this._bgStop(); this._bgStop = null; }
  }

  // ─────────────────────────────────────────────────────────────
  //  LOBİ MÜZİĞİ  — G majör, 100 BPM, sakin arpej döngüsü
  // ─────────────────────────────────────────────────────────────
  startLobby() {
    if (!this.ctx) return;
    this._resume();
    this.stopBg();

    const b = 60 / 100; // 0.6 s/beat

    const melody = [
      [N.E5,  0,    0.5], [N.D5,  0.5, 0.5], [N.B4,  1,   1  ], [N.G4,  2,   2  ],
      [N.A4,  4,    0.5], [N.B4,  4.5, 0.5], [N.D5,  5,   1  ], [N.E5,  6,   2  ],
      [N.D5,  8,    0.5], [N.E5,  8.5, 0.5], [N.G5,  9,   1  ], [N.D5, 10,   2  ],
      [N.B4, 12,    0.5], [N.A4, 12.5, 0.5], [N.G4, 13,   3  ],
    ];
    const bass = [
      [N.G3,  0, 4], [N.D3, 4, 4], [N.C3, 8, 4], [N.G3, 12, 4],
    ];
    const chords = [
      [N.G4,  0, 2, .055], [N.B4,  0, 2, .045],
      [N.G4,  2, 2, .055], [N.B4,  2, 2, .045],
      [N.D4,  4, 2, .055], [N.Fs4, 4, 2, .045],
      [N.D4,  6, 2, .055], [N.Fs4, 6, 2, .045],
      [N.C4,  8, 2, .055], [N.E4,  8, 2, .045],
      [N.C4, 10, 2, .055], [N.E4, 10, 2, .045],
      [N.G3, 12, 2, .055], [N.B3, 12, 2, .045],
      [N.G3, 14, 2, .055], [N.B3, 14, 2, .045],
    ];

    const loopMs = 16 * b * 1000;
    let stopped = false;
    let tid;

    const play = () => {
      if (stopped || !this.ctx) return;
      const now = this.ctx.currentTime + 0.05;
      melody.forEach(([f, bt, bd])     => this._n(f, now + bt*b, bd*b, 'sine',     0.12,  0.05, 0.20));
      bass.forEach(([f, bt, bd])       => this._n(f, now + bt*b, bd*b, 'triangle', 0.10,  0.06, 0.35));
      chords.forEach(([f, bt, bd, v])  => this._n(f, now + bt*b, bd*b, 'sine',     v,     0.12, 0.45));
      tid = setTimeout(play, loopMs - 150);
    };

    play();
    this._bgStop = () => { stopped = true; clearTimeout(tid); };
  }

  // ─────────────────────────────────────────────────────────────
  //  SORU ARKAPLAN — hafif ambient pad, dikkat dağıtmaz
  // ─────────────────────────────────────────────────────────────
  startQuestion() {
    if (!this.ctx) return;
    this._resume();
    this.stopBg();

    const b = 60 / 110;
    const pads = [
      [N.G4,  0, 4], [N.B4,  0, 4],
      [N.D5,  4, 4], [N.G5,  4, 4],
      [N.E5,  8, 4], [N.B4,  8, 4],
      [N.D5, 12, 4], [N.A4, 12, 4],
    ];
    const loopMs = 16 * b * 1000;
    let stopped = false;
    let tid;

    const play = () => {
      if (stopped || !this.ctx) return;
      const now = this.ctx.currentTime + 0.05;
      pads.forEach(([f, bt, bd]) => this._n(f, now + bt*b, bd*b, 'sine', 0.033, 0.15, 0.60));
      tid = setTimeout(play, loopMs - 100);
    };

    play();
    this._bgStop = () => { stopped = true; clearTimeout(tid); };
  }

  // ─────────────────────────────────────────────────────────────
  //  TİK SESİ — son 5 saniye, her saniye bir kez çağır
  // ─────────────────────────────────────────────────────────────
  tick(secondsLeft) {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    if (secondsLeft <= 3) {
      this._n(N.A5, now,        0.055, 'square', 0.18, 0.004, 0.04);
      this._n(N.A5, now + 0.08, 0.055, 'square', 0.13, 0.004, 0.04);
    } else {
      this._n(N.E5, now, 0.07, 'square', 0.13, 0.004, 0.055);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  GERİ SAYIM — countdown state değerini ver (5..1 ve 0=GO)
  // ─────────────────────────────────────────────────────────────
  countdown(n) {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    if (n > 0) {
      const f = ({ 5: N.C5, 4: N.D5, 3: N.E5, 2: N.G5, 1: N.A5 })[n] ?? N.C5;
      this._n(f, now, 0.18, 'sine', 0.20, 0.01, 0.10);
    } else {
      // GO! — yükselen fanfare
      this._n(N.C5, now,        0.12, 'triangle', 0.22, 0.01, 0.06);
      this._n(N.E5, now + 0.12, 0.12, 'triangle', 0.22, 0.01, 0.06);
      this._n(N.G5, now + 0.24, 0.12, 'triangle', 0.22, 0.01, 0.06);
      this._n(N.C6, now + 0.36, 0.40, 'triangle', 0.25, 0.01, 0.14);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  DOĞRU CEVAP — yükselen arpej
  // ─────────────────────────────────────────────────────────────
  correct() {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) =>
      this._n(f, now + i * 0.09, 0.22, 'triangle', 0.22, 0.01, 0.12));
  }

  // ─────────────────────────────────────────────────────────────
  //  YANLIŞ CEVAP — inen vızıltı
  // ─────────────────────────────────────────────────────────────
  wrong() {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    this._n(N.B4,  now,        0.12, 'sawtooth', 0.13, 0.01, 0.08);
    this._n(N.Eb4, now + 0.12, 0.22, 'sawtooth', 0.11, 0.01, 0.14);
    this._n(N.G3,  now + 0.24, 0.20, 'sawtooth', 0.09, 0.01, 0.13);
  }

  // ─────────────────────────────────────────────────────────────
  //  SKOR AÇIKLAMASI — küçük fanfare
  // ─────────────────────────────────────────────────────────────
  scoreReveal() {
    if (!this.ctx) return;
    this._resume();
    this.stopBg();
    const now = this.ctx.currentTime;
    [[N.C5, 0.00, 0.13], [N.G4, 0.13, 0.13], [N.C5, 0.26, 0.13],
     [N.E5, 0.39, 0.20], [N.G5, 0.59, 0.44]]
      .forEach(([f, t, d]) => this._n(f, now + t, d, 'triangle', 0.22, 0.01, 0.09));
    this._n(N.C3, now,        0.28, 'triangle', 0.13, 0.01, 0.18);
    this._n(N.G3, now + 0.59, 0.44, 'triangle', 0.11, 0.01, 0.20);
  }

  // ─────────────────────────────────────────────────────────────
  //  OYUN SONU — zafer fanfare
  // ─────────────────────────────────────────────────────────────
  victory() {
    if (!this.ctx) return;
    this._resume();
    this.stopBg();
    const now = this.ctx.currentTime;

    [[N.C5, 0.00, 0.13], [N.C5, 0.13, 0.13], [N.C5, 0.26, 0.13],
     [N.G5, 0.39, 0.46],
     [N.F5, 0.90, 0.13], [N.E5, 1.03, 0.13], [N.D5, 1.16, 0.13],
     [N.C6, 1.29, 0.70],
     [N.G5, 2.04, 0.13], [N.G5, 2.17, 0.13],
     [N.F5, 2.30, 0.13], [N.E5, 2.43, 0.13], [N.D5, 2.56, 0.13],
     [N.C6, 2.69, 0.70]]
      .forEach(([f, t, d]) => this._n(f, now + t, d, 'triangle', 0.23, 0.01, 0.09));

    [[N.C4, 0.00, 0.45], [N.G4, 0.90, 0.46], [N.C4, 1.29, 0.75],
     [N.G3, 2.04, 0.46], [N.C4, 2.69, 0.75]]
      .forEach(([f, t, d]) => this._n(f, now + t, d, 'sine', 0.13, 0.01, 0.14));
  }

  // ─────────────────────────────────────────────────────────────
  //  YENİ OYUNCU katıldı (lobi)
  // ─────────────────────────────────────────────────────────────
  playerJoin() {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    this._n(N.G5, now,        0.07, 'sine', 0.09, 0.005, 0.05);
    this._n(N.D6, now + 0.07, 0.10, 'sine', 0.07, 0.005, 0.07);
  }
}

export const sound = new SoundService();
