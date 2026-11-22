<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
  <meta name="theme-color" content="#020617">
  <title>BENGGALA // YOULO OS Spacecraft Controller</title>
  
  <!-- Google Fonts: Orbitron, Rajdhani, JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Orbitron:wght@600;700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">

  <!-- TensorFlow.js & COCO-SSD CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"></script>
  
  <!-- YOULO OS Cockpit Styles (Anti-Cache) -->
  <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime('assets/css/style.css') ?>">
</head>
<body class="youlo-os">
  <div class="cockpit-shell">
    
    <!-- 1. Header HUD (.hud-header) -->
    <header class="hud-header">
      <!-- Kiri: Logo + OS Badge + Model Status -->
      <div class="hud-header-left">
        <div class="hud-brand">
          <span class="hud-logo-icon">👁️</span>
          <span class="hud-logo-text">BENGGALA</span>
          <span class="hud-os-badge">OS v2.0</span>
        </div>
        <span id="modelStatus" class="status-badge loading">
          <span class="status-dot"></span> Memuat Model AI...
        </span>
      </div>

      <!-- Tengah: Status Misi Dinamis + Jam Uptime Orbitron -->
      <div class="hud-header-center">
        <span id="missionStatus" class="mission-status-badge">STANDBY</span>
        <span id="missionClock" class="mission-clock">T+ 00:00:00</span>
      </div>

      <!-- Kanan: Tombol Cepat (Mode Tenang, Mode Darurat, Settings, Install PWA) -->
      <div class="hud-header-right">
        <button type="button" id="btnQuietMode" class="hud-btn" title="Toggle Mode Tenang (Sembunyikan HUD)">
          🌙
        </button>
        <button type="button" id="btnEmergencyMode" class="hud-btn hud-btn-danger" title="Toggle Mode Darurat">
          🚨
        </button>
        <button type="button" id="btnOpenSettings" class="hud-btn" title="Buka Pengaturan Sistem">
          ⚙️
        </button>
        <button type="button" id="btnInstallPwa" class="hud-btn hud-btn-pwa" style="display: none;" title="Pasang YOULO OS PWA">
          📲
        </button>
      </div>
    </header>

    <!-- 2. Viewport Full-Bleed (.cockpit-viewport) -->
    <main class="cockpit-viewport">
      <div class="camera-container" id="cameraContainer">
        <video id="webcam" autoplay playsinline muted></video>
        <canvas id="overlay"></canvas>

        <!-- Starfield animasi latar saat kamera mati -->
        <div class="viewport-stars" id="viewportStars"></div>

        <!-- Placeholder saat kamera belum aktif -->
        <div id="cameraPlaceholder" class="camera-placeholder">
          <div class="placeholder-content">
            <div class="placeholder-icon">🚀</div>
            <h3 class="placeholder-title">KOKPIT SIAP TEMPUR</h3>
            <p class="placeholder-desc">Sensor optik belum aktif. Tekan <strong>Mulai Kamera</strong> pada panel sensor untuk inisialisasi pemindaian.</p>
          </div>
        </div>

        <!-- Overlay Pesan Error Kamera -->
        <div id="cameraError" class="camera-error" style="display: none;">
          <div class="error-content">
            <span class="error-icon">⚠️</span>
            <p id="cameraErrorMessage">Gagal mengakses kamera.</p>
          </div>
        </div>
      </div>

      <!-- Sci-Fi Cockpit Reticle Overlays (Non-interaktif) -->
      <div class="hud-reticle-overlay">
        <div class="hud-corner-frame corner-tl"></div>
        <div class="hud-corner-frame corner-tr"></div>
        <div class="hud-corner-frame corner-bl"></div>
        <div class="hud-corner-frame corner-br"></div>
        <div class="hud-crosshair">
          <div class="crosshair-center"></div>
          <div class="crosshair-axis axis-x"></div>
          <div class="crosshair-axis axis-y"></div>
        </div>
        <div class="hud-scanlines"></div>
      </div>

      <!-- Pojok Kiri Atas: HUD Radar Mini (.hud-radar) -->
      <div class="hud-radar" id="hudRadar">
        <div class="radar-sweep"></div>
        <div class="radar-grid"></div>
        <canvas id="radarCanvas" width="110" height="110"></canvas>
        <div class="radar-tag">RADAR 360°</div>
      </div>

      <!-- Pojok Kanan Atas: HUD Telemetri (.hud-telemetry) -->
      <div class="hud-telemetry" id="hudTelemetry">
        <div class="tele-title">TELEMETRI</div>
        <div class="tele-row">
          <span class="tele-label">FPS</span>
          <span id="teleFps" class="tele-val">--</span>
        </div>
        <div class="tele-row">
          <span class="tele-label">OBJEK</span>
          <span id="teleObjCount" class="tele-val">0</span>
        </div>
        <div class="tele-row">
          <span class="tele-label">AKURASI</span>
          <span id="teleThreshold" class="tele-val">50%</span>
        </div>
        <div class="tele-row">
          <span class="tele-label">SKALA</span>
          <span id="teleScale" class="tele-val">px</span>
        </div>
      </div>

      <!-- Floating Toast Notifications -->
      <div id="statusToast" class="status-toast-wrapper">
        <div id="toastContainer" class="toast-notification"></div>
      </div>
    </main>

    <!-- 3. 6 Panel Click-to-Reveal (.cockpit-panel) -->

    <!-- PANEL 1: SENSOR KAMERA -->
    <section class="cockpit-panel" id="panelSensor" data-panel="sensor" hidden>
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">🎥</span>
          <h3 class="panel-title">Sensor Optik Kamera</h3>
        </div>
        <button type="button" class="btn-close-panel" data-close-panel title="Tutup Panel">✕</button>
      </div>
      <div class="panel-body">
        <p class="panel-description">Kontrol umpan video langsung dari modul sensor optik.</p>
        <div class="button-group">
          <button type="button" id="btnStart" class="btn btn-primary" disabled>
            ▶ Mulai Kamera
          </button>
          <button type="button" id="btnStop" class="btn btn-danger" disabled>
            ⏹ Hentikan
          </button>
          <button type="button" id="btnSwitch" class="btn btn-secondary" disabled>
            🔄 Ganti Kamera
          </button>
        </div>
        <div class="action-divider"></div>
        <button type="button" id="btnSnapshot" class="btn btn-action" disabled>
          📸 Ambil Snapshot
        </button>
      </div>
    </section>

    <!-- PANEL 2: KALIBRASI & UKURAN -->
    <section class="cockpit-panel" id="panelKalibrasi" data-panel="kalibrasi" hidden>
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">📏</span>
          <h3 class="panel-title">Kalibrasi & Statistik</h3>
        </div>
        <button type="button" class="btn-close-panel" data-close-panel title="Tutup Panel">✕</button>
      </div>
      <div class="panel-body">
        <!-- Akurasi Minimal Slider -->
        <div class="control-item">
          <div class="slider-header">
            <label for="thresholdSlider">Akurasi Minimal Deteksi</label>
            <span id="thresholdVal" class="slider-value">50%</span>
          </div>
          <input type="range" id="thresholdSlider" min="30" max="90" value="50" step="1">
        </div>

        <div class="action-divider"></div>

        <!-- Kalibrasi Dimensi cm -->
        <div class="control-item calibration-box">
          <div class="calibration-header">
            <label for="refWidthCm">Lebar Referensi (cm)</label>
            <span class="calibration-hint">KTP/ATM = 8.56 cm</span>
          </div>
          <div class="calibration-inputs">
            <input type="number" id="refWidthCm" class="form-input" value="8.56" step="0.1" min="1" max="100">
            <button type="button" id="btnCalibrate" class="btn btn-calibrate" title="Kalibrasi menggunakan objek terdeteksi">
              📏 Kalibrasi
            </button>
            <button type="button" id="btnResetCalibrate" class="btn btn-reset-calibrate" title="Reset kalibrasi ke mode piksel">
              🔄
            </button>
          </div>
          <div id="calibrationStatus" class="calibration-status">
            Belum dikalibrasi (mode piksel)
          </div>
        </div>

        <div class="action-divider"></div>

        <!-- Statistik Objek Live -->
        <div class="stats-header">
          <span class="section-subtitle">Objek Terdeteksi Saat Ini</span>
          <span id="totalObjectsCount" class="badge-count">0 Objek</span>
        </div>
        <div id="statsList" class="stats-list">
          <div class="empty-state">
            <span>🔍</span>
            <p>Belum ada objek terdeteksi.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- PANEL 3: AI VISION & LLM -->
    <section class="cockpit-panel" id="panelAi" data-panel="ai" hidden>
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">🤖</span>
          <h3 class="panel-title">AI Vision & LLM</h3>
        </div>
        <button type="button" class="btn-close-panel" data-close-panel title="Tutup Panel">✕</button>
      </div>
      <div class="panel-body">
        <div class="control-item">
          <label for="llmProvider">Pilihan Provider AI</label>
          <select id="llmProvider" class="form-select">
            <option value="deepseek" selected>DeepSeek (Auto-Fallback Gemini)</option>
            <option value="gemini">Google Gemini (Auto-Fallback DeepSeek)</option>
          </select>
        </div>

        <div class="action-buttons-stack">
          <button type="button" id="btnAnalyzeLLM" class="btn btn-llm" disabled>
            ✨ Analisis Cerdas (Vision AI)
          </button>
          <div class="voice-cmd-row">
            <button type="button" id="btnVoiceCmd" class="btn btn-secondary" title="Perintah Suara">
              🎙️ Perintah Suara
            </button>
            <button type="button" id="btnStopSpeak" class="btn btn-secondary" title="Hentikan Suara">
              🔇 Diam
            </button>
          </div>
        </div>

        <!-- Kotak Hasil Analisis AI -->
        <div class="card llm-card" id="llmCard">
          <div class="llm-header">
            <span class="llm-title">Hasil Analisis Visual</span>
            <div class="llm-badges">
              <span id="llmProviderBadge" class="provider-badge">deepseek</span>
              <span id="llmFallbackBadge" class="fallback-badge" style="display: none;">⚡ Auto-Fallback</span>
            </div>
          </div>
          <div id="llmAnalysisContent" class="llm-content">
            <p class="llm-placeholder">Tekan tombol <strong>Analisis Cerdas</strong> untuk memproses visual kamera dengan Vision AI.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- PANEL 4: MODE CCTV PINTAR -->
    <section class="cockpit-panel" id="panelCctv" data-panel="cctv" hidden>
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">🛡️</span>
          <h3 class="panel-title">Mode CCTV Pintar</h3>
        </div>
        <div class="header-badges">
          <span id="cctvStatusBadge" class="cctv-badge off">OFF</span>
          <button type="button" class="btn-close-panel" data-close-panel title="Tutup Panel">✕</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="cctv-settings">
          <div class="cctv-row">
            <label for="cctvTarget">Target Pemantauan:</label>
            <select id="cctvTarget" class="form-select cctv-select">
              <option value="Orang" selected>Orang (Person)</option>
              <option value="Mobil">Mobil (Car)</option>
              <option value="Motor">Motor (Motorcycle)</option>
              <option value="Kucing">Kucing (Cat)</option>
              <option value="Anjing">Anjing (Dog)</option>
              <option value="SEMUA">Semua Objek</option>
            </select>
          </div>

          <div class="cctv-row">
            <label for="cctvCooldown">Jeda Waktu Cooldown (detik):</label>
            <input type="number" id="cctvCooldown" class="form-input cctv-input-num" value="15" min="3" max="120" step="1">
          </div>

          <div class="cctv-checkbox-row">
            <label class="checkbox-container">
              <input type="checkbox" id="cctvAlarm" checked>
              <span class="checkbox-label">🔊 Bunyikan Sirine Lokal</span>
            </label>
          </div>
        </div>

        <div class="action-divider"></div>

        <button type="button" id="btnToggleCCTV" class="btn btn-cctv">
          ▶ Aktifkan CCTV
        </button>
      </div>
    </section>

    <!-- PANEL 5: GALERI RIWAYAT DETEKSI -->
    <section class="cockpit-panel" id="panelGaleri" data-panel="galeri" hidden>
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">🖼️</span>
          <h3 class="panel-title">Galeri Riwayat Deteksi</h3>
          <span id="historyCountBadge" class="badge-count">0 Riwayat</span>
        </div>
        <button type="button" class="btn-close-panel" data-close-panel title="Tutup Panel">✕</button>
      </div>
      <div class="panel-body">
        <div class="history-actions-bar">
          <button type="button" id="btnRefreshHistory" class="btn btn-secondary">
            🔄 Muat Ulang
          </button>
          <button type="button" id="btnExportCsv" class="btn btn-primary">
            📥 Export Excel (CSV)
          </button>
        </div>
        <div id="historyGrid" class="history-grid">
          <div class="empty-state">
            <span>📂</span>
            <p>Memuat riwayat deteksi...</p>
          </div>
        </div>
      </div>
    </section>

    <!-- PANEL 6: PENGATURAN SISTEM DATABASE -->
    <section class="cockpit-panel" id="panelSistem" data-panel="sistem" hidden>
      <!-- ID settingsModal dipasang di sini untuk kompatibilitas penuh dengan detector.js -->
      <div id="settingsModal" class="settings-modal-inner">
        <div class="panel-header">
          <div class="panel-title-wrapper">
            <span class="panel-icon">⚙️</span>
            <h3 class="panel-title">Pengaturan Dinamis Sistem</h3>
          </div>
          <button type="button" id="btnCloseSettings" class="btn-close-panel" data-close-panel title="Tutup Panel">✕</button>
        </div>
        <div class="panel-body">
          <!-- Konfigurasi LLM -->
          <div class="settings-section">
            <h4 class="section-title">Konfigurasi AI & LLM</h4>
            <div class="form-group">
              <label for="setLlmProvider">Provider Default</label>
              <select id="setLlmProvider" class="form-select">
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div class="form-group">
              <label for="setDeepSeekKey">DeepSeek API Key</label>
              <input type="password" id="setDeepSeekKey" class="form-input" placeholder="Masukkan DeepSeek API Key">
            </div>
            <div class="form-group">
              <label for="setGeminiKey">Gemini API Key</label>
              <input type="password" id="setGeminiKey" class="form-input" placeholder="Masukkan Gemini API Key">
            </div>
          </div>

          <div class="action-divider"></div>

          <!-- Notifikasi Telegram (CCTV) -->
          <div class="settings-section">
            <h4 class="section-title">Notifikasi Telegram (CCTV)</h4>
            <div class="form-group checkbox-group">
              <label class="checkbox-container">
                <input type="checkbox" id="setTelegramEnabled">
                <span class="checkbox-label" style="font-weight: 600; color: var(--text);">Aktifkan Notifikasi Telegram</span>
              </label>
            </div>
            <div class="form-group">
              <label for="setTelegramToken">Telegram Bot Token</label>
              <input type="password" id="setTelegramToken" class="form-input" placeholder="Contoh: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ">
            </div>
            <div class="form-group">
              <label for="setTelegramChatId">Telegram Chat ID</label>
              <input type="text" id="setTelegramChatId" class="form-input" placeholder="Contoh: 987654321">
            </div>
          </div>
        </div>
        <div class="panel-footer">
          <button type="button" id="btnCancelSettings" class="btn btn-secondary" data-close-panel>Batal</button>
          <button type="button" id="btnSaveSettings" class="btn btn-primary">💾 Simpan Pengaturan</button>
        </div>
      </div>
    </section>

    <!-- 4. Dock Kapsul Melayang Bawah (.cockpit-dock) -->
    <nav class="cockpit-dock" id="cockpitDock">
      <button type="button" class="dock-btn" data-target="sensor" title="Sensor Kamera">
        <span class="dock-icon">🎥</span>
        <span class="dock-label">Sensor</span>
      </button>
      <button type="button" class="dock-btn" data-target="kalibrasi" title="Kalibrasi & Ukuran">
        <span class="dock-icon">📏</span>
        <span class="dock-label">Kalibrasi</span>
      </button>
      <button type="button" class="dock-btn" data-target="ai" title="Vision AI & LLM">
        <span class="dock-icon">🤖</span>
        <span class="dock-label">AI</span>
      </button>
      <button type="button" class="dock-btn" data-target="cctv" title="Mode CCTV Pintar">
        <span class="dock-icon">🛡️</span>
        <span class="dock-label">CCTV</span>
      </button>
      <button type="button" class="dock-btn" data-target="galeri" title="Galeri Riwayat">
        <span class="dock-icon">🖼️</span>
        <span class="dock-label">Galeri</span>
      </button>
      <button type="button" class="dock-btn" data-target="sistem" title="Pengaturan Sistem">
        <span class="dock-icon">⚙️</span>
        <span class="dock-label">Sistem</span>
      </button>
    </nav>

  </div>

  <!-- Kamus Bahasa Indonesia COCO-SSD (Anti-Cache) -->
  <script src="assets/js/coco_id.js?v=<?= filemtime('assets/js/coco_id.js') ?>"></script>

  <!-- Modul Mode CCTV Pintar (Anti-Cache) -->
  <script src="assets/js/cctv.js?v=<?= filemtime('assets/js/cctv.js') ?>"></script>

  <!-- Detector Script (Anti-Cache) -->
  <script src="assets/js/detector.js?v=<?= filemtime('assets/js/detector.js') ?>"></script>
</body>
</html>
