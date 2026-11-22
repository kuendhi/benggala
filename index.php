<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benggala AI Object Detection</title>
  
  <!-- TensorFlow.js & COCO-SSD CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"></script>
  
  <!-- Custom Styles -->
  <link rel="stylesheet" href="assets/css/style.css">
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

          <button type="button" id="btnSnapshot" class="btn btn-action">
            📸 Ambil Snapshot
          </button>
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

  <!-- Detector Script -->
  <script src="assets/js/detector.js"></script>
</body>
</html>
