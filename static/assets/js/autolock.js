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
    lastSeenTime: 0,
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
     * Ambil data target yang sedang terkunci (dengan koordinat aktual smoothBox)
     */
    getLockedTarget: function () {
      if (this.state === 'LOCKED' && this.lockedTarget) {
        return {
          ...this.lockedTarget,
          bbox: [this.smoothBox.x, this.smoothBox.y, this.smoothBox.w, this.smoothBox.h]
        };
      }
      return null;
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
      this.lastSeenTime = 0;
      this.lastMidPoint = { x: 0, y: 0 };
      this.hasTriggered = false;
      this.smoothBox = { x: 0, y: 0, w: 0, h: 0, initialized: false };
      this.currentProgress = 0;
      this.currentLabel = '';
      if (window.BenggalaArCallout && typeof window.BenggalaArCallout.hide === 'function') {
        window.BenggalaArCallout.hide(true);
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
        this.reset();
        return;
      }

      // =====================================================================
      // FASE KHUSUS: TARGET SUDAH TERKUNCI (PERSISTENT TARGET LOCKING)
      // Sesuai Instruksi User: Jangan hilangkan lock dan popup sampai objek
      // benar-benar hilang dari jangkauan kamera (meskipun terlihat sedikit atau bergerak).
      // =====================================================================
      if (this.state === 'LOCKED' && this.lockedTarget) {
        let matchedPred = null;

        if (predictions && predictions.length > 0) {
          // 1. Prioritas Utama: Cari objek dengan label/kelas yang sama yang paling dekat
          // dengan posisi smoothBox terakhir
          const lockedLabel = this.lockedTarget.customLabel || this.lockedTarget.class;
          const sameClassCandidates = predictions.filter(p => {
            const predLabel = p.customLabel || p.class;
            return predLabel === lockedLabel;
          });

          if (sameClassCandidates.length > 0) {
            sameClassCandidates.sort((a, b) => {
              const [ax, ay, aw, ah] = a.bbox;
              const [bx, by, bw, bh] = b.bbox;
              const distA = Math.hypot((ax + aw / 2) - (this.smoothBox.x + this.smoothBox.w / 2), (ay + ah / 2) - (this.smoothBox.y + this.smoothBox.h / 2));
              const distB = Math.hypot((bx + bw / 2) - (this.smoothBox.x + this.smoothBox.w / 2), (by + bh / 2) - (this.smoothBox.y + this.smoothBox.h / 2));
              return distA - distB;
            });
            matchedPred = sameClassCandidates[0];
          } else {
            // 2. Jika detektor berubah kelas/label sesaat (misal karena sudut kamera miring),
            // cari prediksi apa pun yang memiliki overlap / jarak terdekat dengan smoothBox terakhir
            let bestIoU = 0;
            for (const p of predictions) {
              const [bx, by, bw, bh] = p.bbox;
              const xA = Math.max(this.smoothBox.x, bx);
              const yA = Math.max(this.smoothBox.y, by);
              const xB = Math.min(this.smoothBox.x + this.smoothBox.w, bx + bw);
              const yB = Math.min(this.smoothBox.y + this.smoothBox.h, by + bh);
              const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
              const union = (this.smoothBox.w * this.smoothBox.h) + (bw * bh) - inter;
              const iou = union > 0 ? (inter / union) : 0;
              if (iou > 0.18 && iou > bestIoU) {
                bestIoU = iou;
                matchedPred = p;
              }
            }
          }
        }

        if (matchedPred) {
          // Target masih ditemukan! Perbarui koordinat dan perpanjang waktu terlihat
          this.lockedTarget = matchedPred;
          this.trackingTarget = matchedPred;
          this.lastSeenTime = now;

          const [px, py, pw, ph] = matchedPred.bbox;
          this.smoothBox.x += (px - this.smoothBox.x) * this.lerpFactor;
          this.smoothBox.y += (py - this.smoothBox.y) * this.lerpFactor;
          this.smoothBox.w += (pw - this.smoothBox.w) * this.lerpFactor;
          this.smoothBox.h += (ph - this.smoothBox.h) * this.lerpFactor;

          this.currentColor = '#00E676'; // Neon Green
          const rawLabel = matchedPred.customLabel || matchedPred.class;
          const objLabel = typeof window.translateLabel === 'function' ? window.translateLabel(rawLabel) : rawLabel;
          this.currentLabel = `🔒 TERKUNCI: ${objLabel.toUpperCase()}`;
          return;
        }

        // Jika pada frame ini tidak ada matching prediction (misal objek terpotong di tepi kamera atau deteksi kedip):
        // Cek apakah koordinat objek terakhir MASIH berada di jangkauan kamera (bahkan jika hanya tersisa sedikit pixel di tepi)
        const isStillInCameraReach = (
          (this.smoothBox.x + this.smoothBox.w > 0) &&
          (this.smoothBox.x < canvasWidth) &&
          (this.smoothBox.y + this.smoothBox.h > 0) &&
          (this.smoothBox.y < canvasHeight)
        );

        const timeSinceSeen = now - (this.lastSeenTime || now);

        if (isStillInCameraReach && timeSinceSeen < 3500) {
          // Objek masih dalam jangkauan kamera dan belum 3.5 detik hilang: JANGAN HILANGKAN LOCK & POPUP!
          this.currentColor = '#00E676';
          const rawLabel = this.lockedTarget.customLabel || this.lockedTarget.class;
          const objLabel = typeof window.translateLabel === 'function' ? window.translateLabel(rawLabel) : rawLabel;
          this.currentLabel = `🔒 TERKUNCI: ${objLabel.toUpperCase()}`;
          return;
        }

        // Objek BENAR-BENAR TELAH HILANG dari jangkauan kamera (keluar frame sepenuhnya atau > 3.5 detik tidak terdeteksi)
        this.reset();
        return;
      }

      // 1. Filter Background Besar & Smart Foreground Target Selection (Task 19A)
      // Aturan: Smallest-Box-First pada titik bidik reticle tengah, abaikan BACKGROUND_CLASSES > 0.40 jika filter aktif
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const totalArea = (canvasWidth * canvasHeight) || (640 * 480);

      const bgClasses = window.BACKGROUND_CLASSES || ['couch', 'bed', 'dining table', 'bench'];
      const isFilterBgActive = (typeof window.IGNORE_BG_MODE === 'boolean') ? window.IGNORE_BG_MODE : true;

      let primary = null;

      if (predictions && predictions.length > 0) {
        // Evaluasi dan perkaya setiap prediksi dengan metrik area & background status
        const evaluated = predictions.map(pred => {
          const [bx, by, bw, bh] = pred.bbox;
          const area = bw * bh;
          const areaRatio = totalArea > 0 ? (area / totalArea) : 0;
          const isBg = bgClasses.includes(pred.class);
          const isLargeBg = isBg && (areaRatio > 0.40);
          const isGiant = (pred.class !== 'person') && (areaRatio > 0.72);

          // Cek apakah kotak melingkupi titik bidik reticle tengah
          const enclosesCenter = (
            centerX >= bx && centerX <= (bx + bw) &&
            centerY >= by && centerY <= (by + bh)
          );

          const mx = bx + bw / 2;
          const my = by + bh / 2;
          const dist = Math.hypot(mx - centerX, my - centerY);

          return {
            pred,
            bbox: pred.bbox,
            area,
            areaRatio,
            isBg,
            isLargeBg,
            isGiant,
            enclosesCenter,
            dist,
            score: pred.score || 0
          };
        });

        // Terapkan Aturan 1: Abaikan BACKGROUND_CLASSES jika areaRatio > 0.40 saat filter aktif
        const eligible = isFilterBgActive
          ? evaluated.filter(item => !item.isLargeBg)
          : evaluated;

        if (eligible.length > 0) {
          // Pisahkan kandidat yang melingkupi titik reticle tengah
          const centerHits = eligible.filter(item => item.enclosesCenter);

          if (centerHits.length > 0) {
            // Aturan 2: Smallest-Box-First (Kotak dengan luas area terkecil / objek di depan)
            centerHits.sort((a, b) => {
              // Giant box (>0.72) ditaruh paling bawah jika ada objek yang lebih proporsional
              if (a.isGiant !== b.isGiant) return a.isGiant ? 1 : -1;
              // Utamakan kotak terkecil (foreground)
              if (Math.abs(a.area - b.area) > 10) {
                return a.area - b.area;
              }
              // Jika ukuran sangat mirip, pilih skor confidence tertinggi
              return b.score - a.score;
            });
            primary = centerHits[0].pred;
          } else {
            // Jika tidak ada kotak yang melingkupi titik tengah, pilih objek terdekat
            // dengan penalti untuk giant box dan objek besar
            eligible.sort((a, b) => {
              if (a.isGiant !== b.isGiant) return a.isGiant ? 1 : -1;
              const scoreA = a.dist + (a.areaRatio * 250) - (a.score * 80);
              const scoreB = b.dist + (b.areaRatio * 250) - (b.score * 80);
              return scoreA - scoreB;
            });
            primary = eligible[0].pred;
          }
        } else {
          // Semua objek terfilter sebagai background besar (misal hanya sofa/meja besar di depan kamera)
          // Biarkan primary = null agar Auto-Lock tidak mengunci latar belakang (siap Reticle Crop Tahap 19B)
          primary = null;
        }
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
        this.lastSeenTime = now;
        this.currentColor = '#00E676'; // Neon Green
        this.currentProgress = 100;
        const objLabel = typeof window.translateLabel === 'function' ? window.translateLabel(primary.customLabel || primary.class) : (primary.customLabel || primary.class);
        this.currentLabel = `🔒 TERKUNCI: ${objLabel.toUpperCase()}`;

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
     * Gambar HUD Reticle Taktis Presisi (Tanpa Lingkaran Besar / Anti Penuh Layar)
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

      ctx.save();

      // Efek Glow Sesuai Warna Fase
      ctx.shadowColor = this.currentColor;
      ctx.shadowBlur = (this.state === 'LOCKED') ? 14 : 6;
      ctx.strokeStyle = this.currentColor;
      ctx.fillStyle = this.currentColor;

      // 1. Siku Sudut Presisi (Precision Corner Brackets - Rapi Memeluk Sudut Objek)
      const bracketLen = Math.min(22, Math.max(10, Math.min(w, h) * 0.28));
      // Sudut menyempit halus pada fase LOCKING (offset menyempit dari 8px ke 0px)
      const bracketOffset = (this.state === 'LOCKING') 
        ? Math.round(8 * (1 - this.currentProgress / 100)) 
        : 0;

      const bx1 = Math.round(x - bracketOffset);
      const by1 = Math.round(y - bracketOffset);
      const bx2 = Math.round(x + w + bracketOffset);
      const by2 = Math.round(y + h + bracketOffset);

      ctx.lineWidth = (this.state === 'LOCKED') ? 3.0 : 2.0;

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

      // 2. Titik Node Sudut Taktis (Illuminated Vertex Nodes)
      const nodeR = (this.state === 'LOCKED') ? 2.5 : 2;
      ctx.beginPath(); ctx.arc(bx1, by1, nodeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx2, by1, nodeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx1, by2, nodeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx2, by2, nodeR, 0, Math.PI * 2); ctx.fill();

      // 3. Garis Penjajar Sisi Taktis (Edge Alignment Ticks - Memeluk Kotak Tanpa Lingkaran)
      const tickLen = Math.min(6, Math.min(w, h) * 0.15);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, by1); ctx.lineTo(cx, by1 + tickLen);
      ctx.moveTo(cx, by2); ctx.lineTo(cx, by2 - tickLen);
      ctx.moveTo(bx1, cy); ctx.lineTo(bx1 + tickLen, cy);
      ctx.moveTo(bx2, cy); ctx.lineTo(bx2 - tickLen, cy);
      ctx.stroke();

      // Titik Pusat Bidik Halus (+)
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy);
      ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3);
      ctx.stroke();

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

      // 5. Progress Bar Kuncian (HANYA saat Fase LOCKING)
      if (this.state === 'LOCKING') {
        const barH = 3;
        const barY = y + h + 5;
        const fillW = Math.max(0, (w * (this.currentProgress / 100)));

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x, barY, w, barH);

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
