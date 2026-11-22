/**
 * Benggala Smart CCTV Mode
 * Pemantauan otomatis objek target, Web Audio siren, dan auto-capture snapshot
 */

window.BenggalaCCTV = {
  isActive: false,
  targetLabel: 'Orang',
  alarmEnabled: true,
  cooldownSec: 15,
  lastTriggerTime: 0,
  audioCtx: null,

  /**
   * Membunyikan sirine lokal menggunakan Web Audio API murni (tanpa file MP3 eksternal)
   * Frekuensi osilasi naik-turun 600Hz - 1200Hz selama ~1.2 detik
   */
  playSiren: function() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        this.audioCtx = new AudioContext();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';

      // Frekuensi naik-turun 600Hz - 1200Hz
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
      osc.frequency.linearRampToValueAtTime(600, now + 0.6);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.9);
      osc.frequency.linearRampToValueAtTime(600, now + 1.2);

      // Volume envelope (fade-in & fade-out)
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.setValueAtTime(0.25, now + 1.0);
      gain.gain.linearRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.25);
    } catch (e) {
      console.warn('Gagal memutar audio sirine:', e);
    }
  },

  /**
   * Cek objek deteksi aktif apakah cocok dengan target CCTV
   * @param {Array<string|Object>} translatedObjects Daftar objek yang terdeteksi
   * @param {Function} onTriggerCallback Callback yang dipanggil jika lolos cooldown
   */
  checkDetections: function(translatedObjects, onTriggerCallback) {
    if (!this.isActive) return;
    if (!translatedObjects || translatedObjects.length === 0) return;

    // Normalisasi daftar nama objek
    const objectNames = translatedObjects.map(obj => {
      if (typeof obj === 'string') return obj;
      return obj.translated_name || obj.name || obj.class || '';
    });

    let isMatched = false;
    let matchedLabel = '';

    if (this.targetLabel === 'SEMUA') {
      isMatched = true;
      matchedLabel = objectNames[0];
    } else {
      const targetLower = this.targetLabel.toLowerCase().trim();
      const match = objectNames.find(name => name.toLowerCase().trim() === targetLower);
      if (match) {
        isMatched = true;
        matchedLabel = match;
      }
    }

    if (!isMatched) return;

    // Cek jeda cooldown
    const now = Date.now();
    if (now - this.lastTriggerTime < this.cooldownSec * 1000) {
      return; // Dalam jeda waktu cooldown
    }

    // Trigger aksi CCTV
    this.lastTriggerTime = now;

    if (this.alarmEnabled) {
      this.playSiren();
    }

    if (typeof onTriggerCallback === 'function') {
      onTriggerCallback(matchedLabel);
    }
  }
};
