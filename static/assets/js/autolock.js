/**
 * BENGGALA // YOULO OS - Air-to-Air Missile Style Radar Lock-On System (Task 18D)
 * - Kamera berfungsi sebagai radar pencari objek (Radar Scanning)
 * - Target terdeteksi dibidik (Acquiring)
 * - Jika target stabil/tidak bergerak selama 6 DETIK penuh -> KUNCI (Target Locked)!
 * - Popup detail AR HANYA muncul setelah target terkunci dalam 6 detik.
 * - Dilengkapi efek audio radar & missile lock (Web Audio API)
 */

(function () {
  'use strict';

  const BenggalaAutoLock = {
    // Konfigurasi Kuncian Rudal Udara (Air-to-Air Missile Radar Lock)
    enabled: true,
    acquireMs: 1500,     // 1.5s Fase Akuisisi Radar (Membidik target)
    lockMs: 4500,        // 4.5s Fase Mengunci Aktif (Total 1.5s + 4.5s = 6.0 DETIK)
    totalLockMs: 6000,   // 6.0 DETIK kuncian stabil mutlak
    cooldownMs: 1500,    // 1.5s jeda cooldown objek sama (objek baru langsung dibidik)
    maxMovePx: 50,       // Toleransi pergeseran objek (px)
    lerpFactor: 0.22,    // Faktor kehalusan lerp reticle

    // State Internal: IDLE | ACQUIRING | LOCKING | LOCKED | COOLDOWN
    state: 'IDLE',
    trackingTarget: null,
    lockedTarget: null,
    lockStartTime: 0,
    lastLockedTime: 0,
    lastLockedClass: '',
    lastMidPoint: { x: 0, y: 0 },
    hasTriggered: false,

    // Audio State
    lastAudioPingTime: 0,
    audioCtx: null,

    // Smooth Bounding Box (Lerp)
    smoothBox: { x: 0, y: 0, w: 0, h: 0, initialized: false },
    currentProgress: 0,
    currentLabel: '',
    currentColor: '#00E5FF',

    /**
     * Inisialisasi Audio Context aman
     */
    getAudioCtx: function () {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtx();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
      } catch (e) {
        return null;
      }
    },

    /**
     * Suara Ping Radar Pencari (Acquisition Phase)
     */
    playRadarPing: function () {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
      } catch (e) {}
    },

    /**
     * Suara Chirp Mengunci Rudal (Lock-On Pulse: Frekuensi naik seiring progress)
     */
    playLockingPulse: function (progressPct) {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Frekuensi naik dari 600Hz hingga 1100Hz
        const freq = 600 + (progressPct * 5);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
      } catch (e) {}
    },

    /**
     * Suara Kuncian Mutlak (Air-to-Air Missile Lock Acquired Beep)
     */
    playLockConfirmed: function () {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1800, now + 0.10);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    },

    /**
     * Status apakah target saat ini sudah TERKUNCI STABIL 6 DETIK
     */
    isTargetLocked: function () {
      return this.state === 'LOCKED' && !!this.lockedTarget;
    },

    /**
     * Ambil data target yang sedang terkunci
     */
    getLockedTarget: function () {
      return (this.state === 'LOCKED') ? this.lockedTarget : null;
    },

    /**
     * Reset status kuncian dan timer
     */
    reset: function () {
      this.state = 'IDLE';
      this.trackingTarget = null;
      this.lockedTarget = null;
      this.lockStartTime = 0;
      this.lastLockedTime = 0;
      this.lastMidPoint = { x: 0, y: 0 };
      this.hasTriggered = false;
      this.smoothBox = { x: 0, y: 0, w: 0, h: 0, initialized: false };
      this.currentProgress = 0;
      this.currentLabel = '';
      if (window.BenggalaArCallout && typeof window.BenggalaArCallout.hide === 'function') {
        window.BenggalaArCallout.hide();
      }
    },

    /**
     * Reset koordinat interpolasi halus tanpa membatalkan progress kuncian
     * Digunakan saat orientasi layar atau ukuran viewport berubah mendadak
     */
    resetTrackingCoords: function () {
      this.smoothBox.initialized = false;
      this.lastMidPoint = { x: 0, y: 0 };
    },

    /**
     * Update state auto-lock setiap frame deteksi
     * @param {Array} predictions Array objek terdeteksi dari model COCO-SSD
     * @param {number} now Timestamp saat ini
     * @param {Function} onLockedCallback Callback yang dipanggil saat target terkunci stabil 6s
     * @param {number} canvasWidth Lebar canvas overlay
     * @param {number} canvasHeight Tinggi canvas overlay
     */
    update: function (predictions, now, onLockedCallback, canvasWidth = 640, canvasHeight = 480) {
      if (!this.enabled) {
        this.state = 'IDLE';
        this.trackingTarget = null;
        this.lockedTarget = null;
        return;
      }

      // 1. Pilih 1 Objek Utama: Dekat dengan Crosshair Tengah & Akurasi Tertinggi
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      let primary = null;
      let minDistance = Infinity;

      if (predictions && predictions.length > 0) {
        predictions.forEach(pred => {
          const [bx, by, bw, bh] = pred.bbox;
          const mx = bx + bw / 2;
          const my = by + bh / 2;
          // Jarak Euclidean ke pusat layar
          const dist = Math.hypot(mx - centerX, my - centerY);
          // Beri bobot kombinasi jarak (70%) dan confidence (30%)
          const score = dist - (pred.score * 120);

          if (score < minDistance) {
            minDistance = score;
            primary = pred;
          }
        });
      }

      // Jika tidak ada objek yang valid di viewport
      if (!primary) {
        this.state = 'IDLE';
        this.trackingTarget = null;
        this.lockedTarget = null;
        this.hasTriggered = false;
        if (window.BenggalaArCallout && typeof window.BenggalaArCallout.hide === 'function') {
          window.BenggalaArCallout.hide();
        }
        return;
      }

      // Cek Masa Cooldown (1.5 detik) khusus jika objek yang sama persis baru saja selesai dikunci
      if (this.lastLockedTime > 0 && (now - this.lastLockedTime < this.cooldownMs) && this.state !== 'LOCKED') {
        if (this.lastLockedClass && primary.class === this.lastLockedClass) {
          this.state = 'COOLDOWN';
          return;
        }
      }

      const [px, py, pw, ph] = primary.bbox;
      const midX = px + pw / 2;
      const midY = py + ph / 2;

      // 2. Smooth Lerp Koordinat Bounding Box
      if (!this.smoothBox.initialized) {
        this.smoothBox = { x: px, y: py, w: pw, h: ph, initialized: true };
      } else {
        this.smoothBox.x += (px - this.smoothBox.x) * this.lerpFactor;
        this.smoothBox.y += (py - this.smoothBox.y) * this.lerpFactor;
        this.smoothBox.w += (pw - this.smoothBox.w) * this.lerpFactor;
        this.smoothBox.h += (ph - this.smoothBox.h) * this.lerpFactor;
      }

      // 3. Evaluasi Pergeseran Objek (Stability Check: Anti Gerak Berlebih)
      // Toleransi dinamis: Berikan ruang toleransi gerakan alami tangan ~12% ukuran layar atau 55% ukuran objek
      const dynamicTolerance = Math.max(85, Math.min(pw, ph) * 0.55, Math.min(canvasWidth, canvasHeight) * 0.12);

      if (!this.trackingTarget || this.trackingTarget.class !== primary.class) {
        // Mulai membidik objek baru
        this.trackingTarget = primary;
        this.lockedTarget = null;
        this.lockStartTime = now;
        this.lastMidPoint = { x: midX, y: midY };
        this.hasTriggered = false;
        this.state = 'ACQUIRING';
      } else {
        // Cek toleransi pergeseran titik tengah
        const shift = Math.hypot(midX - this.lastMidPoint.x, midY - this.lastMidPoint.y);
        if (shift > dynamicTolerance) {
          // Objek berpindah jauh (kamera dipindahkan ke area lain) -> reset timer
          this.lockStartTime = now;
          this.lastMidPoint = { x: midX, y: midY };
          this.state = 'ACQUIRING';
          this.lockedTarget = null;
          this.hasTriggered = false;
        } else {
          // Objek stabil / jitter tangan wajar: perbarui titik tengah secara perlahan
          this.lastMidPoint.x += (midX - this.lastMidPoint.x) * 0.15;
          this.lastMidPoint.y += (midY - this.lastMidPoint.y) * 0.15;
          this.trackingTarget = primary;
        }
      }

      const elapsed = now - this.lockStartTime;
      const rawLabel = primary.customLabel || primary.class;
      const objLabel = typeof window.translateLabel === 'function' ? window.translateLabel(rawLabel) : rawLabel;

      // 4. State Machine Kuncian Rudal Udara (Air-to-Air Missile Radar 6 Detik)
      if (elapsed < this.acquireMs) {
        // FASE 1: RADAR TRACKING / MEMBIDIK (0.0s - 1.5s)
        this.state = 'ACQUIRING';
        this.lockedTarget = null;
        this.currentColor = '#00E5FF'; // Cyan Radar
        const sec = (elapsed / 1000).toFixed(1);
        this.currentLabel = `📡 RADAR: ${objLabel.toUpperCase()} [${sec}s/6.0s]`;
        this.currentProgress = Math.floor((elapsed / this.totalLockMs) * 100);

        // Suara ping radar setiap 420ms
        if (now - this.lastAudioPingTime > 420) {
          this.lastAudioPingTime = now;
          this.playRadarPing();
        }
      } else if (elapsed < this.totalLockMs) {
        // FASE 2: MISSILE LOCK-ON IN PROGRESS / MENGUNCI (1.5s - 6.0s)
        this.state = 'LOCKING';
        this.lockedTarget = null;
        this.currentColor = '#FF9100'; // Amber Laser
        const pct = Math.min(99, Math.floor((elapsed / this.totalLockMs) * 100));
        const remSec = Math.max(0.1, (this.totalLockMs - elapsed) / 1000).toFixed(1);
        this.currentProgress = pct;
        this.currentLabel = `🔒 MENGUNCI: ${objLabel.toUpperCase()} ${pct}% [−${remSec}s]`;

        // Suara chirp radar yang semakin cepat seiring progress
        const pulseInterval = Math.max(110, 350 - (pct * 2.4));
        if (now - this.lastAudioPingTime > pulseInterval) {
          this.lastAudioPingTime = now;
          this.playLockingPulse(pct);
        }
      } else {
        // FASE 3: TARGET TERKUNCI STABIL (>= 6.0 DETIK)
        this.state = 'LOCKED';
        this.lockedTarget = primary;
        this.currentColor = '#00E676'; // Neon Green
        this.currentProgress = 100;
        this.currentLabel = `⚡ TARGET LOCKED: ${objLabel.toUpperCase()} (6.0s)`;

        // Panggil Callback Eksekusi 1 KALI saja
        if (!this.hasTriggered) {
          this.hasTriggered = true;
          this.lastLockedTime = now;
          this.lastLockedClass = primary.class;
          this.playLockConfirmed();

          if (typeof onLockedCallback === 'function') {
            onLockedCallback(primary);
          }
        }
      }
    },

    /**
     * Gambar HUD Reticle Rudal Tempur (Air-to-Air Missile Reticle) di Canvas
     * @param {CanvasRenderingContext2D} ctx Context 2D canvas overlay
     */
    drawLockOverlay: function (ctx) {
      if (!this.enabled || this.state === 'IDLE' || this.state === 'COOLDOWN') {
        return;
      }

      const { x, y, w, h } = this.smoothBox;
      if (w <= 0 || h <= 0) return;

      const cx = x + w / 2;
      const cy = y + h / 2;
      const rad = Math.max(w, h) * 0.58;

      ctx.save();

      // Efek Glow Sesuai Warna Fase
      ctx.shadowColor = this.currentColor;
      ctx.shadowBlur = (this.state === 'LOCKED') ? 16 : 8;
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = (this.state === 'LOCKED') ? 2.5 : 1.8;

      // 1. Gambar Garis Kotak Bounding Halus
      ctx.strokeRect(x, y, w, h);

      // 2. Gambar Reticle Corner Brackets (Siku Sudut Rudal)
      const bracketLen = Math.min(22, w / 4, h / 4);
      // Sudut menyempit halus pada fase LOCKING (offset menyempit dari 10px ke 0px)
      const bracketOffset = (this.state === 'LOCKING') 
        ? 10 * (1 - this.currentProgress / 100) 
        : (this.state === 'LOCKED' ? 0 : 8);

      const bx1 = x - bracketOffset;
      const by1 = y - bracketOffset;
      const bx2 = x + w + bracketOffset;
      const by2 = y + h + bracketOffset;

      ctx.lineWidth = (this.state === 'LOCKED') ? 3.5 : 2.5;

      // Sudut Kiri-Atas
      ctx.beginPath();
      ctx.moveTo(bx1, by1 + bracketLen);
      ctx.lineTo(bx1, by1);
      ctx.lineTo(bx1 + bracketLen, by1);
      ctx.stroke();

      // Sudut Kanan-Atas
      ctx.beginPath();
      ctx.moveTo(bx2 - bracketLen, by1);
      ctx.lineTo(bx2, by1);
      ctx.lineTo(bx2, by1 + bracketLen);
      ctx.stroke();

      // Sudut Kiri-Bawah
      ctx.beginPath();
      ctx.moveTo(bx1, by2 - bracketLen);
      ctx.lineTo(bx1, by2);
      ctx.lineTo(bx1 + bracketLen, by2);
      ctx.stroke();

      // Sudut Kanan-Bawah
      ctx.beginPath();
      ctx.moveTo(bx2 - bracketLen, by2);
      ctx.lineTo(bx2, by2);
      ctx.lineTo(bx2, by2 - bracketLen);
      ctx.stroke();

      // 3. Lingkaran Bidik Rudal Udara (Air-to-Air Missile Lock Ring)
      if (this.state === 'LOCKING' || this.state === 'LOCKED') {
        ctx.save();
        // Lingkaran luar putus-putus
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();

        // Arc Progress Penguncian (0 ke 360 derajat)
        ctx.setLineDash([]);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * (this.currentProgress / 100));
        ctx.arc(cx, cy, rad, startAngle, endAngle);
        ctx.stroke();

        // 4 Titik Crosshair Seeker (N, E, S, W)
        ctx.fillStyle = this.currentColor;
        const pipLen = 6;
        ctx.fillRect(cx - 1, cy - rad - pipLen, 2, pipLen);
        ctx.fillRect(cx + rad, cy - 1, pipLen, 2);
        ctx.fillRect(cx - 1, cy + rad, 2, pipLen);
        ctx.fillRect(cx - rad - pipLen, cy - 1, pipLen, 2);

        ctx.restore();
      }

      // 4. Label Header Status Bidikan
      ctx.font = '700 11px "JetBrains Mono", monospace, sans-serif';
      const textWidth = ctx.measureText(this.currentLabel).width;
      const badgeH = 20;
      const badgeW = textWidth + 16;
      const badgeX = x;
      const badgeY = Math.max(0, y - badgeH - 6);

      // Background Kapsul Label
      ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      // Teks Label
      ctx.fillStyle = this.currentColor;
      ctx.fillText(this.currentLabel, badgeX + 8, badgeY + 14);

      // 5. Progress Bar Kuncian (Fase LOCKING & LOCKED)
      if (this.state === 'LOCKING' || this.state === 'LOCKED') {
        const barH = 4;
        const barY = y + h + 6;
        const fillW = Math.max(0, (w * (this.currentProgress / 100)));

        // Background Bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x, barY, w, barH);

        // Fill Progress Bar
        ctx.fillStyle = this.currentColor;
        ctx.fillRect(x, barY, fillW, barH);
      }

      ctx.restore();
    },

    /**
     * Mendorong hasil analisis AI ke modul AR Callout luar kotak (Task 18C)
     */
    applyAiAnalysis: function (label, analysisText, structuredData) {
      if (window.BenggalaArCallout && typeof window.BenggalaArCallout.applyAiAnalysis === 'function') {
        window.BenggalaArCallout.applyAiAnalysis(label, analysisText, structuredData);
      }
    }
  };

  // Expose ke Global Window
  window.BenggalaAutoLock = BenggalaAutoLock;

})();
