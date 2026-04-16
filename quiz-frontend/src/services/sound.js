/**
 * sound.js — Web Audio API ses motoru (Kahoot-style)
 *
 * Safari/iOS fix:
 *  - AudioContext her zaman kullanıcı etkileşimi sonrası oluşturulur
 *  - suspend durumunda resume için persistent document listener
 *
 * Mute davranışı:
 *  - localStorage'da 'quiz_mute' yoksa → sesli (muted = false) [yeni oyuncular]
 *  - localStorage'da '0' varsa → sesli
 *  - localStorage'da '1' varsa → sessiz
 *
 * Debug logging:
 *  - [SND] prefix ile console.log çıkışları
 *  - ctx state, mute durumu ve tetikleyen olay loglanır
 */

const N = {
  G2: 97.99,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99,
  G4: 392,    A4: 440,    Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880,
  C6: 1046.5, D6: 1174.66, E6: 1318.5,
};

class SoundService {
  constructor() {
    this.ctx          = null;
    this.master       = null;
    this.compressor   = null;
    this._bgStop      = null;
    this._lastBgMethod = null; // 'lobby' | 'question' | null
    // Varsayılan: sesli (localStorage yoksa muted=false)
    const saved = localStorage.getItem('quiz_mute');
    this._muted = saved === null ? false : saved !== '0';
    console.log(`[SND] constructor: saved=${saved}, muted=${this._muted}`);
    this._resumeBound = null;
  }

  get muted() { return this._muted; }

  toggleMute() {
    this._muted = !this._muted;
    localStorage.setItem('quiz_mute', this._muted ? '1' : '0');
    console.log(`[SND] toggleMute: muted=${this._muted}, ctx=${!!this.ctx}, state=${this.ctx?.state}`);
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this._muted ? 0 : 0.85,
        this.ctx.currentTime,
        0.05,
      );
    }
    if (!this._muted) this.restartCurrentBg();
    return this._muted;
  }

  /** Mevcut ekran için bg müziğini yeniden başlatır (unmute / init sonrası) */
  restartCurrentBg() {
    if (this._lastBgMethod === 'lobby')    this.startLobby();
    else if (this._lastBgMethod === 'question') this.startQuestion();
  }

  /**
   * AudioContext başlat — MUTLAKA kullanıcı etkileşimi içinden çağır.
   * Safari/iOS: AudioContext sadece gesture handler içinde oluşturulabilir.
   */
  init() {
    if (this.ctx) {
      // Zaten var — sadece resume et (Safari suspend eder)
      console.log(`[SND] init: ctx zaten var, state=${this.ctx.state}, muted=${this._muted}`);
      this._resume();
      return;
    }
    console.log(`[SND] init: AudioContext oluşturuluyor, muted=${this._muted}, lastBg=${this._lastBgMethod}`);
    try {
      this.ctx        = new (window.AudioContext || window.webkitAudioContext)();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value      = 8;
      this.compressor.ratio.value     = 4;
      this.compressor.attack.value    = 0.003;
      this.compressor.release.value   = 0.18;

      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.85;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // Safari: suspend durumlarına karşı persistent resume listener
      this._resumeBound = () => this._resume();
      document.addEventListener('click',      this._resumeBound);
      document.addEventListener('touchstart', this._resumeBound, { passive: true });

      this._resume();
      console.log(`[SND] init: ctx oluşturuldu, state=${this.ctx.state}, muted=${this._muted}, lastBg=${this._lastBgMethod}`);
      // Yeni ctx oluşturuldu — mute değilse mevcut ekranın sesini başlat
      if (!this._muted) this.restartCurrentBg();
      else console.log('[SND] init: muted=true olduğu için restartCurrentBg atlandı');
    } catch (e) {
      console.warn('[SND] init: Web Audio API desteklenmiyor:', e);
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      console.log('[SND] _resume: ctx suspended, resume çağrılıyor...');
      this.ctx.resume()
        .then(() => console.log(`[SND] _resume: başarılı, state=${this.ctx.state}`))
        .catch((e) => console.warn('[SND] _resume: hata', e));
    }
  }

  /** Tek nota: freq, startTime, duration, oscillatorType, volume, attack, release */
  _n(freq, t, dur, type = 'sine', vol = 0.2, attack = 0.005, release = 0.10) {
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

  /** Beyaz gürültü patlaması — davul/vurucu efektler için */
  _noise(t, dur, vol = 0.08, hipass = 800) {
    if (!this.ctx || !this.master) return;
    try {
      const bufSize   = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf       = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data      = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const src    = this.ctx.createBufferSource();
      src.buffer   = buf;
      const hp     = this.ctx.createBiquadFilter();
      hp.type      = 'highpass';
      hp.frequency.value = hipass;
      const g      = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(hp);
      hp.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.01);
    } catch (_) {}
  }

  stopBg() {
    if (this._bgStop) { this._bgStop(); this._bgStop = null; }
    this._lastBgMethod = null;
  }

  // ─────────────────────────────────────────────────────────────
  //  LOBİ MÜZİĞİ — 128 BPM, enerjik major, Kahoot tarzı
  // ─────────────────────────────────────────────────────────────
  startLobby() {
    console.log(`[SND] startLobby: ctx=${!!this.ctx}, state=${this.ctx?.state}, muted=${this._muted}`);
    if (!this.ctx) { this._lastBgMethod = 'lobby'; return; }
    this._resume();
    this.stopBg();
    this._lastBgMethod = 'lobby';

    const b   = 60 / 128;         // beat = 0.469s
    const e   = b / 2;            // eighth note
    const now = () => this.ctx.currentTime + 0.05;

    // Melodi: C majör, staccato
    const mel = [
      [N.E5, 0], [N.G5, 1], [N.E5, 2], [N.D5, 3],
      [N.C5, 4], [N.E5, 5], [N.G5, 6], [N.C6, 7],
      [N.B4, 8], [N.G5, 9], [N.E5,10], [N.D5,11],
      [N.C5,12], [N.D5,13], [N.E5,14], [N.C5,15],
    ];
    // Bas: root oktavları
    const bas = [
      [N.C3, 0, 2], [N.G3, 2, 2], [N.F3, 4, 2], [N.G3, 6, 2],
      [N.C3, 8, 2], [N.G3,10, 2], [N.F3,12, 2], [N.G3,14, 2],
    ];
    // Pad akorları
    const pad = [
      [N.C4, 0, 4, .040], [N.E4, 0, 4, .035], [N.G4, 0, 4, .030],
      [N.G4, 4, 4, .040], [N.B4, 4, 4, .035], [N.D5, 4, 4, .030],
      [N.F4, 8, 4, .040], [N.A4, 8, 4, .035], [N.C5, 8, 4, .030],
      [N.G4,12, 4, .040], [N.B4,12, 4, .035], [N.D5,12, 4, .030],
    ];

    const loopMs = 16 * e * 1000;
    let stopped = false;
    let tid;

    const play = () => {
      if (stopped || !this.ctx) return;
      const n0 = now();
      // Melodi: staccato 8th notes
      mel.forEach(([f, ei]) =>
        this._n(f, n0 + ei * e, e * 0.55, 'square', 0.13, 0.004, 0.06));
      // Bass: triangle
      bas.forEach(([f, ei, bd]) =>
        this._n(f, n0 + ei * e, bd * e * 0.8, 'triangle', 0.14, 0.01, 0.20));
      // Pad: soft sine
      pad.forEach(([f, ei, bd, v]) =>
        this._n(f, n0 + ei * e, bd * e, 'sine', v, 0.15, 0.40));
      // Hihat: her 8th notada gürültü patlaması
      for (let i = 0; i < 16; i++)
        this._noise(n0 + i * e, e * 0.25, i % 2 === 0 ? 0.04 : 0.02, 4000);
      // Kick: 0, 4, 8, 12
      [0, 4, 8, 12].forEach(i =>
        this._n(N.C3 * 0.7, n0 + i * e, e * 0.4, 'sine', 0.18, 0.002, 0.20));

      tid = setTimeout(play, loopMs - 120);
    };

    play();
    this._bgStop = () => { stopped = true; clearTimeout(tid); };
  }

  // ─────────────────────────────────────────────────────────────
  //  SORU ARKAPLAN — gergin ambient, dikkat odaklar
  // ─────────────────────────────────────────────────────────────
  startQuestion() {
    console.log(`[SND] startQuestion: ctx=${!!this.ctx}, state=${this.ctx?.state}, muted=${this._muted}`);
    if (!this.ctx) { this._lastBgMethod = 'question'; return; }
    this._resume();
    this.stopBg();
    this._lastBgMethod = 'question';

    const b = 60 / 115;
    const pads = [
      [N.G4,  0, 2], [N.B4,  0, 2],
      [N.A4,  2, 2], [N.D5,  2, 2],
      [N.G4,  4, 2], [N.E5,  4, 2],
      [N.Fs4, 6, 2], [N.D5,  6, 2],
      [N.G4,  8, 2], [N.B4,  8, 2],
      [N.A4, 10, 2], [N.E5, 10, 2],
      [N.F4, 12, 2], [N.C5, 12, 2],
      [N.G4, 14, 2], [N.D5, 14, 2],
    ];
    const loopMs = 16 * b * 1000;
    let stopped = false;
    let tid;

    const play = () => {
      if (stopped || !this.ctx) return;
      const now = this.ctx.currentTime + 0.05;
      pads.forEach(([f, bt, bd]) =>
        this._n(f, now + bt * b, bd * b, 'sine', 0.030, 0.18, 0.65));
      tid = setTimeout(play, loopMs - 100);
    };

    play();
    this._bgStop = () => { stopped = true; clearTimeout(tid); };
  }

  // ─────────────────────────────────────────────────────────────
  //  TİK SESİ — Kahoot'un karakteristik sayaç sesi
  // ─────────────────────────────────────────────────────────────
  tick(secondsLeft) {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    if (secondsLeft <= 3) {
      // Son 3 saniye: çift hızlı, yüksek, acil
      this._n(N.C6, now,        0.04, 'square', 0.20, 0.002, 0.025);
      this._n(N.C6, now + 0.10, 0.04, 'square', 0.15, 0.002, 0.025);
      this._noise(now, 0.04, 0.05, 6000);
    } else if (secondsLeft <= 5) {
      // Son 5 saniye: hızlı, uyarı tonu
      this._n(N.G5, now, 0.06, 'square', 0.18, 0.002, 0.04);
      this._noise(now, 0.05, 0.04, 5000);
    } else {
      // Normal: temiz tık
      this._n(N.E5, now, 0.07, 'square', 0.14, 0.002, 0.05);
      this._noise(now, 0.04, 0.03, 4000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  GERİ SAYIM — yükselen, enerjik beep'ler
  // ─────────────────────────────────────────────────────────────
  countdown(n) {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    if (n > 0) {
      const freqs = { 5: N.C5, 4: N.D5, 3: N.E5, 2: N.G5, 1: N.A5 };
      const f = freqs[n] ?? N.C5;
      this._n(f, now,        0.12, 'square',   0.22, 0.003, 0.07);
      this._n(f, now,        0.12, 'triangle', 0.12, 0.003, 0.07);
      this._noise(now, 0.06, 0.06, 3000);
    } else {
      // GO! — Kahoot tarzı üçlü zıplama + fanfare
      [[N.C5, 0.00, 0.08], [N.E5, 0.08, 0.08], [N.G5, 0.16, 0.08], [N.C6, 0.24, 0.35]]
        .forEach(([f, t, d]) => {
          this._n(f, now + t, d, 'square',   0.22, 0.003, 0.05);
          this._n(f, now + t, d, 'triangle', 0.14, 0.003, 0.05);
        });
      this._noise(now, 0.08, 0.08, 2000);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  DOĞRU CEVAP — parlak yükselen arpej (Kahoot yeşil)
  // ─────────────────────────────────────────────────────────────
  correct() {
    console.log(`[SND] correct: ctx=${!!this.ctx}, state=${this.ctx?.state}, muted=${this._muted}`);
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    // Ana arpej
    [[N.C5, 0.00, 0.10], [N.E5, 0.07, 0.10], [N.G5, 0.14, 0.10], [N.C6, 0.21, 0.30]]
      .forEach(([f, t, d]) => {
        this._n(f, now + t, d, 'triangle', 0.24, 0.003, 0.06);
        this._n(f, now + t, d, 'sine',     0.14, 0.003, 0.06);
      });
    // Parlak hihat vuruşu
    this._noise(now, 0.05, 0.07, 5000);
    // Bas güçlendirme
    this._n(N.C4, now, 0.25, 'triangle', 0.16, 0.003, 0.10);
  }

  // ─────────────────────────────────────────────────────────────
  //  YANLIŞ CEVAP — inen vızıltı buzzer (Kahoot kırmızı)
  // ─────────────────────────────────────────────────────────────
  wrong() {
    console.log(`[SND] wrong: ctx=${!!this.ctx}, state=${this.ctx?.state}, muted=${this._muted}`);
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    // İnen sawtooth vızıltı
    const osc = this.ctx.createOscillator();
    const g   = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.45);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.01);
    g.gain.setValueAtTime(0.22, now + 0.30);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.50);
    try {
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.55);
    } catch (_) {}
    // Kısa gürültü
    this._noise(now, 0.06, 0.08, 200);
  }

  // ─────────────────────────────────────────────────────────────
  //  SKOR AÇIKLAMASI — tanıdık Kahoot fanfare
  // ─────────────────────────────────────────────────────────────
  scoreReveal() {
    if (!this.ctx) return;
    this._resume();
    this.stopBg();
    const now = this.ctx.currentTime;

    // Melodi
    [[N.C5,0.00,0.10],[N.G4,0.10,0.10],[N.C5,0.20,0.10],
     [N.E5,0.30,0.14],[N.G5,0.46,0.40]]
      .forEach(([f, t, d]) => {
        this._n(f, now + t, d, 'triangle', 0.22, 0.003, 0.07);
        this._n(f, now + t, d, 'square',   0.09, 0.003, 0.07);
      });
    // Bas
    this._n(N.C3, now,        0.28, 'triangle', 0.14, 0.004, 0.14);
    this._n(N.G3, now + 0.46, 0.40, 'triangle', 0.12, 0.004, 0.18);
    this._noise(now, 0.06, 0.08, 3000);
  }

  // ─────────────────────────────────────────────────────────────
  //  OYUN SONU — zafer fanfare (daha uzun ve coşkulu)
  // ─────────────────────────────────────────────────────────────
  victory() {
    if (!this.ctx) return;
    this._resume();
    this.stopBg();
    const now = this.ctx.currentTime;

    const mel = [
      [N.C5, 0.00, 0.10], [N.C5, 0.10, 0.10], [N.C5, 0.20, 0.10],
      [N.G5, 0.32, 0.38],
      [N.F5, 0.76, 0.10], [N.E5, 0.88, 0.10], [N.D5, 1.00, 0.10],
      [N.C6, 1.12, 0.55],
      [N.G5, 1.74, 0.10], [N.G5, 1.86, 0.10],
      [N.F5, 1.98, 0.10], [N.E5, 2.10, 0.10], [N.D5, 2.22, 0.10],
      [N.C6, 2.34, 0.70],
    ];
    mel.forEach(([f, t, d]) => {
      this._n(f, now + t, d, 'triangle', 0.24, 0.003, 0.07);
      this._n(f, now + t, d, 'square',   0.10, 0.003, 0.07);
    });

    // Harmony
    [[N.C4,0.00,0.38],[N.G4,0.76,0.38],[N.C4,1.12,0.55],
     [N.G3,1.74,0.38],[N.C4,2.34,0.70]]
      .forEach(([f, t, d]) =>
        this._n(f, now + t, d, 'sine', 0.14, 0.003, 0.12));

    // Davul vuruşları
    [0, 0.76, 1.12, 1.74, 2.34].forEach(t =>
      this._noise(now + t, 0.07, 0.10, 2500));
  }

  // ─────────────────────────────────────────────────────────────
  //  YENİ OYUNCU katıldı (lobi)
  // ─────────────────────────────────────────────────────────────
  playerJoin() {
    if (!this.ctx) return;
    this._resume();
    const now = this.ctx.currentTime;
    this._n(N.G5, now,        0.06, 'triangle', 0.10, 0.003, 0.04);
    this._n(N.D6, now + 0.06, 0.09, 'triangle', 0.08, 0.003, 0.06);
    this._noise(now, 0.04, 0.03, 5000);
  }
}

export const sound = new SoundService();
