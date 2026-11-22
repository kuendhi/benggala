/**
 * BENGGALA // YOULO OS - 1-Click Mission Modes & Mode Mata Kedua Tunanetra
 * Modul Multi-Sector Mission Profiles & Spatial Audio Guide for Visually Impaired
 */

(function () {
  'use strict';

  // 1. Profil 5 Misi (1 Default + 4 Misi Lomba)
  const MISSION_PROFILES = {
    default: {
      key: 'default',
      name: 'Umum',
      tag: 'UMUM',
      icon: '🎯',
      prompt: '' // Gunakan system prompt bawaan database / sistem
    },
    tunanetra: {
      key: 'tunanetra',
      name: '👁️ Mata Kedua (Tunanetra)',
      tag: 'TUNANETRA',
      icon: '👁️',
      prompt: 'Kamu adalah asisten visual untuk penyandang tunanetra. Jelaskan objek di foto dengan sangat jelas, sebutkan teks/nominal/merek jika ada, kondisi fisik, dan potensi bahaya di sekitarnya dalam 2-3 kalimat Bahasa Indonesia yang ramah.'
    },
    sampah: {
      key: 'sampah',
      name: '♻️ Pilah Sampah',
      tag: 'SAMPAH',
      icon: '♻️',
      prompt: 'Klasifikasikan benda di foto ke kategori Organik, Anorganik, atau B3. Jelaskan cara pembuangan atau potensi daur ulangnya secara singkat dan praktis dalam Bahasa Indonesia.'
    },
    qc: {
      key: 'qc',
      name: '📦 QC UMKM',
      tag: 'QC UMKM',
      icon: '📦',
      prompt: 'Bertindaklah sebagai inspektor Quality Control UMKM. Berikan penilaian Grade (A/B/C) berdasarkan kondisi visual benda di foto, sebutkan kelebihan atau cacat fisik yang terlihat, dan saran singkat perbaikan kualitas dalam Bahasa Indonesia.'
    },
    edukasi: {
      key: 'edukasi',
      name: '🎓 Edukasi 3 Bahasa',
      tag: 'EDUKASI',
      icon: '🎓',
      prompt: 'Sebutkan nama benda utama di foto dalam 3 bahasa (Indonesia, Inggris, dan Arab/Jepang beserta cara bacanya), lalu jelaskan 1 fakta menarik atau fungsinya dalam 1 kalimat singkat.'
    }
  };

  // State Internal Modul
  let currentMission = 'default';
  let voiceEnabled = true;
  let lastSpatialTime = 0;
  const SPATIAL_COOLDOWN_MS = 3500;

  // Helper Speech Synthesis Suara Bahasa Indonesia
  function speakText(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      // Hentikan ujaran sebelumnya agar tidak bertumpuk
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Cari suara berbahasa Indonesia jika ada di sistem
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang === 'id-ID' || v.lang.startsWith('id'));
      if (idVoice) {
        utterance.voice = idVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // Modul Global BenggalaVoice jika belum didefinisikan
  if (!window.BenggalaVoice) {
    window.BenggalaVoice = {
      speak: speakText,
      stop: function () {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      }
    };
  }

  const BenggalaMissions = {
    profiles: MISSION_PROFILES,

    /**
     * Set mode misi aktif
     * @param {string} key Key misi: default | tunanetra | sampah | qc | edukasi
     */
    setMission: function (key) {
      if (MISSION_PROFILES[key]) {
        currentMission = key;
      } else {
        currentMission = 'default';
      }

      // Beritahu suara jika masuk ke mode tunanetra
      if (currentMission === 'tunanetra') {
        speakText('Mode Mata Kedua untuk Tunanetra aktif. Arahkan kamera ke depan.');
      }

      return this.getActiveMission();
    },

    /**
     * Dapatkan profil misi yang sedang aktif
     */
    getActiveMission: function () {
      return MISSION_PROFILES[currentMission] || MISSION_PROFILES.default;
    },

    /**
     * Dapatkan system prompt misi aktif untuk dikirim ke LLM
     */
    getActivePrompt: function () {
      const active = this.getActiveMission();
      return active.prompt || '';
    },

    /**
     * Toggle status aktif suara panduan spasial
     */
    setVoiceEnabled: function (enabled) {
      voiceEnabled = Boolean(enabled);
      if (!voiceEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    },

    isVoiceEnabled: function () {
      return voiceEnabled;
    },

    /**
     * Panduan Navigasi Spasial Suara Real-Time untuk Mode Tunanetra
     * @param {Array} predictions Daftar objek terdeteksi
     * @param {number} videoWidth Lebar frame video kamera
     * @param {number} videoHeight Tinggi frame video kamera
     */
    announceSpatial: function (predictions, videoWidth = 640, videoHeight = 480) {
      // Hanya aktif jika mode tunanetra aktif dan suara diizinkan
      if (currentMission !== 'tunanetra' || !voiceEnabled) {
        return;
      }

      const now = performance.now();
      if (now - lastSpatialTime < SPATIAL_COOLDOWN_MS) {
        return; // Masih dalam masa jeda agar tidak berisik
      }

      if (!predictions || predictions.length === 0) {
        return;
      }

      // Ambil objek terdekat/terbesar (area bounding box terbesar)
      let primaryObj = predictions[0];
      let maxArea = (primaryObj.bbox[2] || 0) * (primaryObj.bbox[3] || 0);

      for (let i = 1; i < predictions.length; i++) {
        const area = (predictions[i].bbox[2] || 0) * (predictions[i].bbox[3] || 0);
        if (area > maxArea) {
          maxArea = area;
          primaryObj = predictions[i];
        }
      }

      if (!primaryObj || !primaryObj.bbox) return;

      const [bx, by, bw, bh] = primaryObj.bbox;
      const centerX = bx + bw / 2;

      // 1. Tentukan Arah Spasial (Kiri / Tengah Depan / Kanan)
      let posisi = 'di tengah depan';
      if (centerX < videoWidth * 0.35) {
        posisi = 'di sebelah kiri';
      } else if (centerX > videoWidth * 0.65) {
        posisi = 'di sebelah kanan';
      }

      // 2. Estimasi Jarak Kasar Berdasarkan Rasio Tinggi Objek
      const heightRatio = bh / (videoHeight || 480);
      let jarak = 'agak jauh';
      if (heightRatio > 0.50) {
        jarak = 'sangat dekat';
      } else if (heightRatio > 0.25) {
        jarak = 'jarak sedang';
      }

      // 3. Nama Objek dalam Bahasa Indonesia
      const labelId = typeof window.translateLabel === 'function' 
        ? window.translateLabel(primaryObj.class) 
        : primaryObj.class;

      lastSpatialTime = now;

      // Ucapkan panduan navigasi spasial
      const speechSentence = `Ada ${labelId} ${posisi}, ${jarak}`;
      speakText(speechSentence);
    }
  };

  // Expose ke Global Window
  window.BenggalaMissions = BenggalaMissions;

})();
