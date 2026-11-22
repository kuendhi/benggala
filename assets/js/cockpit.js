/**
 * BENGGALA // YOULO OS Cockpit Controller
 * Modul Interaksi Click-to-Reveal, Radar Objek Riil, Telemetri HUD & Mode Khusus
 */

(function () {
  'use strict';

  // State Internal Cockpit
  let activePanel = null;
  let activeDockBtn = null;
  let startTime = Date.now();
  let radarAnimationFrame = null;

  // State Telemetri & Radar
  let currentRadarData = {
    predictions: [],
    videoWidth: 640,
    videoHeight: 480,
    isCctv: false,
    isRunning: false
  };

  let sweepAngle = 0;

  // =========================================================================
  // 1. State Machine Click-to-Reveal (Maksimal 1 Panel Aktif)
  // =========================================================================
  function closeAllPanels() {
    if (activePanel) {
      activePanel.hidden = true;
      activePanel.classList.remove('active');
      activePanel = null;
    }
    if (activeDockBtn) {
      activeDockBtn.classList.remove('active');
      activeDockBtn = null;
    }
    // Pastikan semua panel tersembunyi
    document.querySelectorAll('.cockpit-panel').forEach(p => {
      p.hidden = true;
      p.classList.remove('active');
    });
    document.querySelectorAll('.cockpit-dock .dock-btn').forEach(b => {
      b.classList.remove('active');
    });
  }

  function openPanel(targetId) {
    const targetPanel = document.querySelector(`.cockpit-panel[data-panel="${targetId}"]`);
    const targetBtn = document.querySelector(`.cockpit-dock .dock-btn[data-target="${targetId}"]`);

    if (!targetPanel) return;

    // Jika panel yang sama diklik lagi -> tutup
    if (activePanel === targetPanel) {
      closeAllPanels();
      return;
    }

    // Tutup panel sebelumnya
    closeAllPanels();

    // Buka panel baru
    targetPanel.hidden = false;
    targetPanel.classList.add('active');
    if (targetBtn) {
      targetBtn.classList.add('active');
      activeDockBtn = targetBtn;
    }
    activePanel = targetPanel;

    // Aksi otomatis per panel
    if (targetId === 'galeri' && typeof window.loadHistory === 'function') {
      window.loadHistory();
    }
    if (targetId === 'sistem' && typeof window.loadSettings === 'function') {
      window.loadSettings();
    }
  }

  // =========================================================================
  // 2. Jam Uptime Misi (T+ HH:MM:SS)
  // =========================================================================
  function initMissionClock() {
    const clockEl = document.getElementById('missionClock');
    if (!clockEl) return;

    setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const h = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
      const s = String(elapsedSec % 60).padStart(2, '0');
      clockEl.textContent = `T+ ${h}:${m}:${s}`;
    }, 1000);
  }

  // =========================================================================
  // 3. Mini Radar HUD Berbasis Objek Riil (#radarCanvas)
  // =========================================================================
  function initRadar() {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const renderRadar = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = cx - 4;

      // Bersihkan canvas
      ctx.clearRect(0, 0, w, h);

      // Gambar grid lingkaran konsentris
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.lineWidth = 1;

      // Lingkaran luar, tengah, dalam
      [0.35, 0.68, 1.0].forEach(factor => {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * factor, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Sumbu koordinat X & Y
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.stroke();

      // Animasi Garis Sapuan Radar (Sweep Line)
      sweepAngle = (sweepAngle + 0.04) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxR * Math.cos(sweepAngle), cy + maxR * Math.sin(sweepAngle));
      ctx.stroke();

      // Sektor gradien tipis di belakang garis sweep
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, sweepAngle - 0.45, sweepAngle);
      ctx.closePath();
      ctx.fill();

      // Plot Titik Objek Riil
      const isEmergency = document.body.classList.contains('mode-emergency');
      const isCctv = currentRadarData.isCctv;
      const predictions = currentRadarData.predictions || [];
      const vidW = currentRadarData.videoWidth || 640;
      const vidH = currentRadarData.videoHeight || 480;

      predictions.forEach((pred, idx) => {
        if (!pred.bbox) return;

        // Ambil titik tengah bounding box objek
        const [bx, by, bw, bh] = pred.bbox;
        const midX = bx + bw / 2;
        const midY = by + bh / 2;

        // Normalisasi ke rentang [-1, 1] terhadap pusat video
        const normX = (midX - vidW / 2) / (vidW / 2);
        const normY = (midY - vidH / 2) / (vidH / 2);

        // Petakan ke bidang lingkaran radar
        let px = cx + normX * (maxR * 0.82);
        let py = cy + normY * (maxR * 0.82);

        // Pastikan titik tidak keluar dari batas lingkaran radar
        const distFromCenter = Math.hypot(px - cx, py - cy);
        if (distFromCenter > maxR - 5) {
          px = cx + ((px - cx) / distFromCenter) * (maxR - 5);
          py = cy + ((py - cy) / distFromCenter) * (maxR - 5);
        }

        // Tentukan warna titik (Cyan normal, Merah jika CCTV / Darurat)
        const dotColor = (isEmergency || isCctv) ? '#FF1744' : '#00E5FF';
        const glowColor = (isEmergency || isCctv) ? 'rgba(255, 23, 68, 0.5)' : 'rgba(0, 229, 255, 0.5)';

        // Efek ping / denyut di sekitar titik
        const pulseR = 3.5 + Math.sin(Date.now() / 150 + idx) * 1.5;

        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(px, py, pulseR + 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = dotColor;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      radarAnimationFrame = requestAnimationFrame(renderRadar);
    };

    renderRadar();
  }

  // =========================================================================
  // 4. Update Telemetri & Status Misi
  // =========================================================================
  function updateTelemetry(data) {
    if (!data) return;

    currentRadarData = {
      predictions: data.predictions || [],
      videoWidth: data.videoWidth || 640,
      videoHeight: data.videoHeight || 480,
      isCctv: Boolean(data.isCctv),
      isRunning: Boolean(data.isRunning)
    };

    const teleFps = document.getElementById('teleFps');
    const teleObjCount = document.getElementById('teleObjCount');
    const teleThreshold = document.getElementById('teleThreshold');
    const teleScale = document.getElementById('teleScale');
    const missionStatus = document.getElementById('missionStatus');

    if (teleFps) {
      teleFps.textContent = `${data.fps || 0} FPS`;
    }

    if (teleObjCount) {
      teleObjCount.textContent = (data.predictions && data.predictions.length) || 0;
    }

    if (teleThreshold && data.threshold !== undefined) {
      teleThreshold.textContent = `${data.threshold}%`;
    }

    if (teleScale) {
      teleScale.textContent = (data.pixelsPerCm && data.pixelsPerCm > 0) ? 'CM' : 'PX';
    }

    if (missionStatus) {
      if (document.body.classList.contains('mode-emergency')) {
        missionStatus.textContent = '🚨 DARURAT';
      } else if (data.isCctv) {
        missionStatus.textContent = 'CCTV AKTIF';
      } else if (data.isRunning) {
        missionStatus.textContent = 'SCANNING';
      } else {
        missionStatus.textContent = 'STANDBY';
      }
    }
  }

  // =========================================================================
  // 5. Mode Khusus (Mode Tenang & Mode Darurat)
  // =========================================================================
  function toggleQuietMode() {
    const isQuiet = document.body.classList.toggle('mode-quiet');
    if (isQuiet) {
      closeAllPanels();
    }
    const btn = document.getElementById('btnQuietMode');
    if (btn) {
      btn.style.color = isQuiet ? 'var(--cyan)' : '';
      btn.style.borderColor = isQuiet ? 'var(--cyan)' : '';
    }
  }

  function toggleEmergencyMode() {
    const isEmergency = document.body.classList.toggle('mode-emergency');
    const missionStatus = document.getElementById('missionStatus');

    if (isEmergency) {
      if (missionStatus) missionStatus.textContent = '🚨 DARURAT';

      // Bunyikan sirine peringatan jika modul CCTV tersedia
      if (window.BenggalaCCTV && typeof window.BenggalaCCTV.playSiren === 'function') {
        window.BenggalaCCTV.playSiren();
      }
    } else {
      // Pulihkan status misi normal
      if (missionStatus) {
        if (currentRadarData.isCctv) {
          missionStatus.textContent = 'CCTV AKTIF';
        } else if (currentRadarData.isRunning) {
          missionStatus.textContent = 'SCANNING';
        } else {
          missionStatus.textContent = 'STANDBY';
        }
      }
    }
  }

  // =========================================================================
  // 6. Inisialisasi Event Listeners Global
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Jam Uptime & Radar
    initMissionClock();
    initRadar();

    // 2. Tombol Dock Kapsul
    const dockButtons = document.querySelectorAll('.cockpit-dock .dock-btn');
    dockButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-target');
        if (target) {
          openPanel(target);
        }
      });
    });

    // 3. Tombol Tutup Panel (✕)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-close-panel') || e.target.closest('[data-close-panel]')) {
        closeAllPanels();
      }
    });

    // 4. Klik Area Kosong di Luar Panel -> Tutup Panel Aktif
    document.addEventListener('click', (e) => {
      if (!activePanel) return;
      const clickedInsidePanel = e.target.closest('.cockpit-panel');
      const clickedInsideDock = e.target.closest('.cockpit-dock');
      const clickedHudBtn = e.target.closest('.hud-btn');

      if (!clickedInsidePanel && !clickedInsideDock && !clickedHudBtn) {
        closeAllPanels();
      }
    });

    // 5. Tombol Escape di Keyboard -> Tutup Panel Aktif
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activePanel) {
        closeAllPanels();
      }
    });

    // 6. Tombol Header Quick Action
    const btnQuiet = document.getElementById('btnQuietMode');
    if (btnQuiet) {
      btnQuiet.addEventListener('click', toggleQuietMode);
    }

    const btnEmergency = document.getElementById('btnEmergencyMode');
    if (btnEmergency) {
      btnEmergency.addEventListener('click', toggleEmergencyMode);
    }

    const btnOpenSettings = document.getElementById('btnOpenSettings');
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        openPanel('sistem');
      });
    }
  });

  // Expose API ke Window
  window.BenggalaCockpit = {
    openPanel,
    closeAllPanels,
    updateTelemetry,
    toggleQuietMode,
    toggleEmergencyMode
  };

})();
