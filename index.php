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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
  <title>Benggala AI Object Detection</title>
  
  <!-- TensorFlow.js & COCO-SSD CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"></script>
  
  <!-- Custom Styles (Anti-Cache) -->
  <link rel="stylesheet" href="assets/css/style.css?v=<?= filemtime('assets/css/style.css') ?>">
</head>
<body>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">
          <span class="title-icon">👁️</span> Benggala AI Object Detection
        </h1>
        <div class="status-wrapper">
          <span id="modelStatus" class="status-badge loading">
            <span class="status-dot"></span> Memuat Model AI...
          </span>
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="main-content">
      <!-- Viewport Kamera -->
      <section class="viewport-section">
        <div class="card viewport-card">
          <div class="camera-container" id="cameraContainer">
            <video id="webcam" autoplay playsinline muted></video>
            <canvas id="overlay"></canvas>
            
            <!-- Placeholder saat kamera belum aktif -->
            <div id="cameraPlaceholder" class="camera-placeholder">
              <div class="placeholder-content">
                <div class="placeholder-icon">📷</div>
                <h3>Kamera Tidak Aktif</h3>
                <p>Klik tombol <strong>Mulai Kamera</strong> di panel kontrol untuk memulai deteksi real-time.</p>
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
        </div>

        <!-- Panel Hasil Analisis Cerdas LLM -->
        <div class="card llm-card" id="llmCard" style="display: none;">
          <div class="llm-header">
            <h2 class="card-title">🤖 Analisis Cerdas AI</h2>
            <div class="llm-badges">
              <span id="llmProviderBadge" class="provider-badge">deepseek</span>
              <span id="llmFallbackBadge" class="fallback-badge" style="display: none;">⚡ Auto-Fallback Aktif</span>
            </div>
          </div>
          <div id="llmAnalysisContent" class="llm-content">
            <p class="llm-placeholder">Tekan tombol <strong>Analisis Cerdas (LLM)</strong> untuk menganalisis objek visual yang sedang terdeteksi.</p>
          </div>
        </div>
      </section>

      <!-- Sidebar: Panel Kontrol & Statistik -->
      <aside class="sidebar-section">
        <!-- Panel Kontrol -->
        <div class="card control-card">
          <h2 class="card-title">Panel Kontrol</h2>
          
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

          <div class="control-item">
            <div class="slider-header">
              <label for="thresholdSlider">Akurasi Minimal</label>
              <span id="thresholdVal" class="slider-value">50%</span>
            </div>
            <input type="range" id="thresholdSlider" min="30" max="90" value="50" step="1">
          </div>

          <div class="action-divider"></div>

          <!-- Blok Kalibrasi Ukuran (cm) -->
          <div class="control-item calibration-box">
            <div class="calibration-header">
              <label for="refWidthCm">Lebar Benda Referensi (cm)</label>
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

          <!-- Pilihan Provider LLM -->
          <div class="control-item" style="margin-bottom: 0.9rem;">
            <label for="llmProvider" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.35rem; display: block;">
              Provider LLM
            </label>
            <select id="llmProvider" class="form-select">
              <option value="deepseek" selected>DeepSeek (Auto-Fallback Gemini)</option>
              <option value="gemini">Google Gemini (Auto-Fallback DeepSeek)</option>
            </select>
          </div>

          <!-- Tombol Snapshot & Analisis LLM -->
          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            <button type="button" id="btnSnapshot" class="btn btn-action" disabled>
              📸 Ambil Snapshot
            </button>
            <button type="button" id="btnAnalyzeLLM" class="btn btn-llm" disabled>
              ✨ Analisis Cerdas (LLM)
            </button>
          </div>

          <div class="action-divider"></div>

          <!-- Blok Mode CCTV Pintar -->
          <div class="control-item cctv-box">
            <div class="cctv-header">
              <label class="cctv-label">🎥 Mode CCTV Pintar</label>
              <span id="cctvStatusBadge" class="cctv-badge off">OFF</span>
            </div>
            
            <div class="cctv-settings">
              <div class="cctv-row">
                <label for="cctvTarget">Target:</label>
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
                <label for="cctvCooldown">Jeda (detik):</label>
                <input type="number" id="cctvCooldown" class="form-input cctv-input-num" value="15" min="3" max="120" step="1">
              </div>

              <div class="cctv-checkbox-row">
                <label class="checkbox-container">
                  <input type="checkbox" id="cctvAlarm" checked>
                  <span class="checkbox-label">🔊 Bunyikan Sirine Lokal</span>
                </label>
              </div>
            </div>

            <button type="button" id="btnToggleCCTV" class="btn btn-cctv">
              ▶ Aktifkan CCTV
            </button>
          </div>
        </div>

        <!-- Panel Statistik Live -->
        <div class="card stats-card">
          <div class="stats-header">
            <h2 class="card-title">Statistik Objek Terdeteksi</h2>
            <span id="totalObjectsCount" class="badge-count">0 Objek</span>
          </div>

          <div id="statsList" class="stats-list">
            <div class="empty-state">
              <span>🔍</span>
              <p>Belum ada objek terdeteksi.</p>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <!-- Toast Notification Container -->
  <div id="toastContainer" class="toast-notification"></div>

  <!-- Kamus Bahasa Indonesia COCO-SSD (Anti-Cache) -->
  <script src="assets/js/coco_id.js?v=<?= filemtime('assets/js/coco_id.js') ?>"></script>

  <!-- Modul Mode CCTV Pintar (Anti-Cache) -->
  <script src="assets/js/cctv.js?v=<?= filemtime('assets/js/cctv.js') ?>"></script>

  <!-- Detector Script (Anti-Cache) -->
  <script src="assets/js/detector.js?v=<?= filemtime('assets/js/detector.js') ?>"></script>
</body>
</html>
