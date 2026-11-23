/**
 * BENGGALA // YOULO OS - Auto-Lock Target Super Halus & Pipeline AI Otomatis
 * Modul Tracking Halus (Lerp), State Machine Multiphase & Automated Vision Trigger
 */

(function () {
  'use strict';

  const BenggalaAutoLock = {
    // Konfigurasi
    enabled: true,
    acquireMs: 1000,     // 1.0s Fase Membidik (Snappy pada target terpilih)
    lockMs: 1500,        // 1.5s Fase Mengunci (Total 2.5s)
    cooldownMs: 8000,    // 8s Jeda Cooldown
    maxMovePx: 45,       // Toleransi Pergeseran Posisi (px)
    lerpFactor: 0.22,    // Faktor Kehalusan Lerp

    // State Internal
    state: 'IDLE',       // IDLE | ACQUIRING | LOCKING | LOCKED | COOLDOWN
    trackingTarget: null,
    lockStartTime: 0,
    lastLockedTime: 0,
    lastMidPoint: { x: 0, y: 0 },
    hasTriggered: false,

    // Smooth Bounding Box (Lerp)
    smoothBox: { x: 0, y: 0, w: 0, h: 0, initialized: false },
    currentProgress: 0,
    currentLabel: '',
    currentColor: '#00E5FF',

    /**
     * Membunyikan suara beep konfirmasi penguncian via Web Audio API
     */
    playLockBeep: function () {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1760, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.24);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {
        // Abaikan audio error jika autoplay diblokir
      }
    },

    /**
     * Reset status kuncian dan timer target auto-lock (Task 15)
     */
    reset: function () {
      this.state = 'IDLE';
      this.trackingTarget = null;
      this.lockStartTime = 0;
      this.lastLockedTime = 0;
      this.lastMidPoint = { x: 0, y: 0 };
      this.hasTriggered = false;
      this.smoothBox = { x: 0, y: 0, w: 0, h: 0, initialized: false };
      this.currentProgress = 0;
      this.currentLabel = '';
    },

    /**
     * Update state auto-lock setiap frame deteksi
     * @param {Array} predictions Array objek terdeteksi dari model COCO-SSD
     * @param {number} now Timestamp saat ini (performance.now() atau Date.now())
     * @param {Function} onLockedCallback Callback yang dipanggil saat target terkunci stabil 4s
     * @param {number} canvasWidth Lebar canvas overlay
     * @param {number} canvasHeight Tinggi canvas overlay
     */
    update: function (predictions, now, onLockedCallback, canvasWidth = 640, canvasHeight = 480) {
      if (!this.enabled) {
        this.state = 'IDLE';
        this.trackingTarget = null;
        return;
      }

      // Cek Masa Cooldown
      if (this.lastLockedTime > 0 && now - this.lastLockedTime < this.cooldownMs) {
        this.state = 'COOLDOWN';
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

      // Jika tidak ada objek yang valid
      if (!primary) {
        this.state = 'IDLE';
        this.trackingTarget = null;
        this.hasTriggered = false;
        return;
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

      // 3. Evaluasi Pergeseran Objek (Stability Check)
      if (!this.trackingTarget || this.trackingTarget.class !== primary.class) {
        // Mulai membidik objek baru
        this.trackingTarget = primary;
        this.lockStartTime = now;
        this.lastMidPoint = { x: midX, y: midY };
        this.hasTriggered = false;
        this.state = 'ACQUIRING';
      } else {
        // Cek toleransi pergeseran titik tengah
        const shift = Math.hypot(midX - this.lastMidPoint.x, midY - this.lastMidPoint.y);
        if (shift > this.maxMovePx) {
          // Objek bergerak terlalu cepat -> reset timer
          this.lockStartTime = now;
          this.lastMidPoint = { x: midX, y: midY };
          this.state = 'ACQUIRING';
          this.hasTriggered = false;
        } else {
          // Objek stabil: perbarui titik tengah secara perlahan
          this.lastMidPoint.x += (midX - this.lastMidPoint.x) * 0.1;
          this.lastMidPoint.y += (midY - this.lastMidPoint.y) * 0.1;
        }
      }

      const elapsed = now - this.lockStartTime;
      const objLabel = typeof window.translateLabel === 'function' ? window.translateLabel(primary.class) : primary.class;

      // 4. State Machine Sesuai Durasi
      if (elapsed < this.acquireMs) {
        // FASE 1: MEMBIDIK (0 - 1.5 detik)
        this.state = 'ACQUIRING';
        this.currentColor = '#00E5FF'; // Cyan
        this.currentLabel = `MEMBIDIK: ${objLabel.toUpperCase()}...`;
        this.currentProgress = 0;
      } else if (elapsed < this.acquireMs + this.lockMs) {
        // FASE 2: MENGUNCI (1.5 - 4.0 detik)
        this.state = 'LOCKING';
        this.currentColor = '#FFAB00'; // Amber / Oranye
        const lockElapsed = elapsed - this.acquireMs;
        const pct = Math.min(100, Math.floor((lockElapsed / this.lockMs) * 100));
        this.currentProgress = pct;
        this.currentLabel = `MENGUNCI: ${objLabel.toUpperCase()} ${pct}%`;
      } else {
        // FASE 3: TERKUNCI STABIL (>= 4.0 detik)
        this.state = 'LOCKED';
        this.currentColor = '#00E676'; // Hijau Neon
        this.currentProgress = 100;
        this.currentLabel = `✓ TERKUNCI: ${objLabel.toUpperCase()} - MENGANALISA...`;

        // Panggil Callback Eksekusi 1 KALI saja
        if (!this.hasTriggered) {
          this.hasTriggered = true;
          this.lastLockedTime = now;
          this.playLockBeep();

          if (typeof onLockedCallback === 'function') {
            onLockedCallback(primary);
          }
        }
      }
    },

    /**
     * Gambar overlay bidikan, sudut siku reticle, dan progress bar di canvas
     * @param {CanvasRenderingContext2D} ctx Context 2D canvas overlay
     */
    drawLockOverlay: function (ctx) {
      if (!this.enabled || this.state === 'IDLE' || this.state === 'COOLDOWN') {
        return;
      }

      const { x, y, w, h } = this.smoothBox;
      if (w <= 0 || h <= 0) return;

      ctx.save();

      // Efek Glow Sesuai Warna Fase
      ctx.shadowColor = this.currentColor;
      ctx.shadowBlur = (this.state === 'LOCKED') ? 16 : 8;
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = (this.state === 'LOCKED') ? 2.5 : 1.8;

      // 1. Gambar Garis Kotak Bounding Halus
      ctx.strokeRect(x, y, w, h);

      // 2. Gambar Reticle Corner Brackets (Siku Sudut Futuristik)
      const bracketLen = Math.min(22, w / 4, h / 4);
      // Sudut menyempit halus pada fase LOCKING (offset menyempit dari 8px ke 0px)
      const bracketOffset = (this.state === 'LOCKING') 
        ? 8 * (1 - this.currentProgress / 100) 
        : (this.state === 'LOCKED' ? 0 : 6);

      const bx1 = x - bracketOffset;
      const by1 = y - bracketOffset;
      const bx2 = x + w + bracketOffset;
      const by2 = y + h + bracketOffset;

      ctx.lineWidth = 3;

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

      // 3. Gambar Label Header Bidikan
      ctx.font = '600 11px "JetBrains Mono", monospace, sans-serif';
      const textWidth = ctx.measureText(this.currentLabel).width;
      const badgeH = 20;
      const badgeW = textWidth + 16;
      const badgeX = x;
      const badgeY = Math.max(0, y - badgeH - 4);

      // Background Kapsul Label
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      // Teks Label
      ctx.fillStyle = this.currentColor;
      ctx.fillText(this.currentLabel, badgeX + 8, badgeY + 14);

      // 4. Progress Bar Kuncian (Fase LOCKING & LOCKED)
      if (this.state === 'LOCKING' || this.state === 'LOCKED') {
        const barH = 4;
        const barY = y + h + 6;
        const fillW = Math.max(0, (w * (this.currentProgress / 100)));

        // Background Bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
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
