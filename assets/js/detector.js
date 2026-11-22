/**
 * Benggala AI Object Detection
 * Real-Time Browser Object Detection Engine (TensorFlow.js + COCO-SSD)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const modelStatus = document.getElementById('modelStatus');
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('overlay');
  const ctx = canvas.getContext('2d');
  
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnSwitch = document.getElementById('btnSwitch');
  const btnSnapshot = document.getElementById('btnSnapshot');
  
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdVal = document.getElementById('thresholdVal');
  
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const cameraError = document.getElementById('cameraError');
  const cameraErrorMessage = document.getElementById('cameraErrorMessage');
  
  const totalObjectsCount = document.getElementById('totalObjectsCount');
  const statsList = document.getElementById('statsList');

  // --- State Variables ---
  let model = null;
  let stream = null;
  let isStreaming = false;
  let isDetecting = false;
  let animationFrameId = null;
  let currentFacingMode = 'user'; // 'user' (depan/webcam) atau 'environment' (belakang di HP)
  let minConfidence = parseFloat(thresholdSlider.value) / 100;

  // Palet warna kontras untuk bounding box per class
  const classColors = [
    '#00f0ff', '#10b981', '#f59e0b', '#ec4899', 
    '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316'
  ];

  function getColorForClass(className) {
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % classColors.length;
    return classColors[index];
  }

  // =========================================================================
  // 1. Inisialisasi & Pemuatan Model AI (COCO-SSD)
  // =========================================================================
  async function loadModel() {
    try {
      if (typeof cocoSsd === 'undefined') {
        throw new Error('Library COCO-SSD tidak termuat. Periksa koneksi internet ke CDN.');
      }

      model = await cocoSsd.load();

      // Update badge status UI
      modelStatus.classList.remove('loading', 'error');
      modelStatus.classList.add('ready');
      modelStatus.innerHTML = '<span class="status-dot"></span> Model Siap';

      // Aktifkan tombol kontrol kamera
      btnStart.disabled = false;
      btnSwitch.disabled = false;
    } catch (error) {
      console.error('Gagal memuat model COCO-SSD:', error);
      modelStatus.classList.remove('loading', 'ready');
      modelStatus.classList.add('error');
      modelStatus.innerHTML = '<span class="status-dot"></span> Gagal Memuat Model';
      showCameraError('Gagal memuat model AI. Pastikan CDN TensorFlow.js & COCO-SSD dapat diakses.');
    }
  }

  // =========================================================================
  // 2. Kontrol Kamera (getUserMedia & facingMode)
  // =========================================================================
  async function startCamera() {
    hideCameraError();

    if (!model) {
      alert('Model AI belum siap. Harap tunggu sebentar.');
      return;
    }

    // Jika sedang streaming, hentikan track terdahulu
    if (stream) {
      stopCameraTracks();
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;

      // Tunggu video metadata termuat untuk mendapatkan videoWidth & videoHeight
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve);
        };
      });

      isStreaming = true;
      cameraPlaceholder.style.display = 'none';

      // Sinkronkan canvas
      syncCanvasDimensions();

      // Perbarui tombol UI
      btnStart.disabled = true;
      btnStop.disabled = false;
      btnSwitch.disabled = false;
      btnSnapshot.disabled = false;

      // Mulai loop deteksi real-time
      startDetectionLoop();
    } catch (err) {
      console.error('Error saat mengakses kamera:', err);
      let errorMsg = 'Gagal mengakses kamera.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Akses kamera ditolak. Harap berikan izin kamera pada browser Anda.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'Perangkat kamera tidak ditemukan.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain atau sistem operasi.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback jika facingMode spesifik tidak didukung
        errorMsg = 'Kamera yang diminta tidak mendukung konfigurasi saat ini. Coba ganti kamera.';
      }
      
      showCameraError(errorMsg);
      stopCamera();
    }
  }

  function stopCameraTracks() {
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Gagal mematikan track:', e);
        }
      });
      stream = null;
    }
  }

  function stopCamera() {
    isStreaming = false;

    // Batalkan requestAnimationFrame loop
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Hentikan semua track kamera
    stopCameraTracks();

    // Reset video source
    video.srcObject = null;

    // Bersihkan canvas overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Tampilkan kembali placeholder
    cameraPlaceholder.style.display = 'flex';

    // Reset state tombol
    btnStart.disabled = model === null;
    btnStop.disabled = true;
    btnSnapshot.disabled = true;

    // Reset panel statistik live
    resetStatsPanel();
  }

  async function switchCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    if (isStreaming) {
      await startCamera();
    }
  }

  function showCameraError(message) {
    cameraErrorMessage.textContent = message;
    cameraError.style.display = 'block';
  }

  function hideCameraError() {
    cameraError.style.display = 'none';
  }

  function syncCanvasDimensions() {
    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }
  }

  // =========================================================================
  // 3. Loop Deteksi Real-Time (requestAnimationFrame + model.detect)
  // =========================================================================
  function startDetectionLoop() {
    const detectFrame = async () => {
      if (!isStreaming) return;

      if (!isDetecting && video.readyState >= 2 && model) {
        isDetecting = true;
        syncCanvasDimensions();

        try {
          // Deteksi objek pada frame video
          const predictions = await model.detect(video);
          
          // Filter prediksi berdasarkan batas akurasi slider
          const filtered = predictions.filter(pred => pred.score >= minConfidence);
          
          // Render bounding box dan perbarui statistik live
          renderPredictions(filtered);
          updateLiveStats(filtered);
        } catch (err) {
          console.warn('Kesalahan saat deteksi frame:', err);
        } finally {
          isDetecting = false;
        }
      }

      animationFrameId = requestAnimationFrame(detectFrame);
    };

    animationFrameId = requestAnimationFrame(detectFrame);
  }

  // =========================================================================
  // 4. Render Bounding Box & Label Teks
  // =========================================================================
  function renderPredictions(predictions) {
    // Bersihkan canvas frame sebelumnya
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!predictions || predictions.length === 0) {
      return;
    }

    const scale = Math.max(1, Math.round(canvas.width / 800));
    const fontSize = Math.max(14, 14 * scale);
    const lineWidth = Math.max(2, 2.5 * scale);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    predictions.forEach(prediction => {
      const [x, y, width, height] = prediction.bbox;
      const color = getColorForClass(prediction.class);
      // Format label teks: nama_objek 0.95
      const labelText = `${prediction.class} ${prediction.score.toFixed(2)}`;

      // 1. Gambar Bounding Box (border bercahaya kontras)
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 * scale;
      ctx.strokeRect(x, y, width, height);

      // Reset bayangan untuk elemen selanjutnya
      ctx.shadowBlur = 0;

      // 2. Hitung dimensi background label
      const textMetrics = ctx.measureText(labelText);
      const paddingX = 8 * scale;
      const paddingY = 4 * scale;
      const labelHeight = fontSize + (paddingY * 2);
      const labelWidth = textMetrics.width + (paddingX * 2);

      // Posisi label di atas kotak (jika ruang cukup), atau di dalam kotak
      let labelY = y - labelHeight;
      if (labelY < 0) {
        labelY = y;
      }
      let labelX = x;
      if (labelX + labelWidth > canvas.width) {
        labelX = Math.max(0, canvas.width - labelWidth);
      }

      // 3. Gambar background label teks
      ctx.fillStyle = color;
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

      // 4. Gambar teks (kontras gelap di atas latar belakang terang/neon)
      ctx.fillStyle = '#0f172a';
      ctx.fillText(labelText, labelX + paddingX, labelY + paddingY);
    });
  }

  // =========================================================================
  // 5. Panel Statistik Live
  // =========================================================================
  function updateLiveStats(predictions) {
    const total = predictions.length;
    totalObjectsCount.textContent = `${total} Objek`;

    if (total === 0) {
      resetStatsPanel();
      return;
    }

    // Kelompokkan objek berdasarkan nama kelas
    const grouped = {};
    predictions.forEach(p => {
      if (!grouped[p.class]) {
        grouped[p.class] = {
          count: 0,
          maxScore: 0,
          scores: []
        };
      }
      grouped[p.class].count += 1;
      grouped[p.class].scores.push(p.score);
      if (p.score > grouped[p.class].maxScore) {
        grouped[p.class].maxScore = p.score;
      }
    });

    // Render daftar elemen statistik
    let html = '';
    const sortedClasses = Object.keys(grouped).sort((a, b) => grouped[b].count - grouped[a].count);

    sortedClasses.forEach(className => {
      const data = grouped[className];
      const percent = Math.round(data.maxScore * 100);
      const color = getColorForClass(className);

      html += `
        <div class="detection-item" style="border-left-color: ${color}">
          <div class="item-left">
            <span class="item-name">${className}</span>
            <span class="item-count-badge">x${data.count}</span>
          </div>
          <div class="item-right">
            <span class="item-score">${percent}%</span>
            <div class="confidence-bar-bg">
              <div class="confidence-bar-fill" style="width: ${percent}%;"></div>
            </div>
          </div>
        </div>
      `;
    });

    statsList.innerHTML = html;
  }

  function resetStatsPanel() {
    totalObjectsCount.textContent = '0 Objek';
    statsList.innerHTML = `
      <div class="empty-state">
        <span>🔍</span>
        <p>Belum ada objek terdeteksi.</p>
      </div>
    `;
  }

  // =========================================================================
  // 6. Event Listeners Kontrol & Interaksi
  // =========================================================================
  btnStart.addEventListener('click', startCamera);
  btnStop.addEventListener('click', stopCamera);
  btnSwitch.addEventListener('click', switchCamera);

  // Slider Akurasi Minimal
  thresholdSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    thresholdVal.textContent = `${val}%`;
    minConfidence = parseFloat(val) / 100;
  });

  // Tombol Snapshot (Task 03 placeholder)
  btnSnapshot.addEventListener('click', () => {
    // Akan dihubungkan ke Backend di Task 03
    alert('Akan dihubungkan ke Backend di Task 03');
  });

  // Muat model saat halaman pertama kali dibuka
  loadModel();
});
