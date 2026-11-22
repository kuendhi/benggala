/**
 * Benggala AI Object Detection
 * Real-Time Browser Object Detection Engine (TensorFlow.js + COCO-SSD)
 * Integrated with Backend Snapshot & Smart Auto-Fallback LLM Router
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
  const btnAnalyzeLLM = document.getElementById('btnAnalyzeLLM');
  const llmProviderSelect = document.getElementById('llmProvider');
  
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdVal = document.getElementById('thresholdVal');
  
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const cameraError = document.getElementById('cameraError');
  const cameraErrorMessage = document.getElementById('cameraErrorMessage');
  
  const totalObjectsCount = document.getElementById('totalObjectsCount');
  const statsList = document.getElementById('statsList');
  
  const llmCard = document.getElementById('llmCard');
  const llmProviderBadge = document.getElementById('llmProviderBadge');
  const llmFallbackBadge = document.getElementById('llmFallbackBadge');
  const llmAnalysisContent = document.getElementById('llmAnalysisContent');
  const toastContainer = document.getElementById('toastContainer');

  // --- State Variables ---
  let model = null;
  let stream = null;
  let isStreaming = false;
  let isDetecting = false;
  let animationFrameId = null;
  let currentFacingMode = 'user'; // 'user' (depan/webcam) atau 'environment' (belakang di HP)
  let minConfidence = parseFloat(thresholdSlider.value) / 100;
  let currentPredictions = [];

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
  // 0. Toast Notification UI Helper
  // =========================================================================
  function showToast(message, type = 'info') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Animasi muncul
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Otomatis hilang setelah 4 detik
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 4000);
  }

  // Helper untuk membaca CSRF token dari tag <meta name="csrf-token">
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
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
      showToast('Model AI belum siap. Harap tunggu sebentar.', 'error');
      return;
    }

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

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve);
        };
      });

      isStreaming = true;
      cameraPlaceholder.style.display = 'none';

      // Sinkronkan dimensi canvas
      syncCanvasDimensions();

      // Perbarui tombol UI
      btnStart.disabled = true;
      btnStop.disabled = false;
      btnSwitch.disabled = false;
      btnSnapshot.disabled = false;
      if (btnAnalyzeLLM) btnAnalyzeLLM.disabled = false;

      // Mulai loop deteksi real-time
      startDetectionLoop();
      showToast('Kamera aktif. Deteksi real-time berjalan.', 'info');
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

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    stopCameraTracks();
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cameraPlaceholder.style.display = 'flex';

    btnStart.disabled = model === null;
    btnStop.disabled = true;
    btnSnapshot.disabled = true;
    if (btnAnalyzeLLM) btnAnalyzeLLM.disabled = true;

    currentPredictions = [];
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
          const predictions = await model.detect(video);
          const filtered = predictions.filter(pred => pred.score >= minConfidence);
          currentPredictions = filtered;

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
      const labelText = `${prediction.class} ${prediction.score.toFixed(2)}`;

      // Bounding Box
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6 * scale;
      ctx.strokeRect(x, y, width, height);
      ctx.shadowBlur = 0;

      // Label background & text
      const textMetrics = ctx.measureText(labelText);
      const paddingX = 8 * scale;
      const paddingY = 4 * scale;
      const labelHeight = fontSize + (paddingY * 2);
      const labelWidth = textMetrics.width + (paddingX * 2);

      let labelY = y - labelHeight;
      if (labelY < 0) {
        labelY = y;
      }
      let labelX = x;
      if (labelX + labelWidth > canvas.width) {
        labelX = Math.max(0, canvas.width - labelWidth);
      }

      ctx.fillStyle = color;
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
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

    const grouped = {};
    predictions.forEach(p => {
      if (!grouped[p.class]) {
        grouped[p.class] = { count: 0, maxScore: 0 };
      }
      grouped[p.class].count += 1;
      if (p.score > grouped[p.class].maxScore) {
        grouped[p.class].maxScore = p.score;
      }
    });

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
  // 6. Tangkap Frame Gabungan Video + Canvas Bounding Box
  // =========================================================================
  function captureMergedSnapshot() {
    if (!isStreaming || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth;
    offCanvas.height = video.videoHeight;
    const offCtx = offCanvas.getContext('2d');

    // 1. Gambar frame video
    offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

    // 2. Gambar overlay bounding box di atas video
    offCtx.drawImage(canvas, 0, 0, offCanvas.width, offCanvas.height);

    // 3. Konversi ke Base64 Data URL (JPEG, kualitas 0.92)
    return offCanvas.toDataURL('image/jpeg', 0.92);
  }

  // =========================================================================
  // 7. Pengiriman Snapshot ke Backend API (api/save_snapshot.php)
  // =========================================================================
  async function handleSaveSnapshot() {
    if (!isStreaming) {
      showToast('Kamera belum aktif.', 'error');
      return;
    }

    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      showToast('Token CSRF tidak ditemukan. Refresh halaman.', 'error');
      return;
    }

    const base64Image = captureMergedSnapshot();
    if (!base64Image) {
      showToast('Gagal menangkap frame video.', 'error');
      return;
    }

    // Persiapkan data objek terdeteksi
    const objectsList = currentPredictions.map(p => ({
      class: p.class,
      score: p.score
    }));

    btnSnapshot.disabled = true;
    const originalText = btnSnapshot.innerHTML;
    btnSnapshot.innerHTML = '⏳ Menyimpan...';

    try {
      const response = await fetch('api/save_snapshot.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          image: base64Image,
          objects: objectsList
        })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        showToast(`Snapshot berhasil disimpan (${result.filename})`, 'success');
      } else {
        showToast(result.message || 'Gagal menyimpan snapshot.', 'error');
      }
    } catch (err) {
      console.error('Error saat menyimpan snapshot:', err);
      showToast('Gagal terhubung ke endpoint penyimpanan snapshot.', 'error');
    } finally {
      btnSnapshot.disabled = false;
      btnSnapshot.innerHTML = originalText;
    }
  }

  // =========================================================================
  // 8. Integrasi Smart LLM Router (api/analyze_llm.php)
  // =========================================================================
  async function handleAnalyzeLLM() {
    if (!btnAnalyzeLLM) return;

    if (!isStreaming) {
      showToast('Aktifkan kamera terlebih dahulu untuk mendeteksi objek.', 'error');
      return;
    }

    if (!currentPredictions || currentPredictions.length === 0) {
      showToast('Belum ada objek terdeteksi untuk dianalisis oleh AI.', 'info');
      return;
    }

    const csrfToken = getCsrfToken();
    const provider = llmProviderSelect ? llmProviderSelect.value : 'deepseek';

    // Format objek untuk dikirim ke LLM
    const detectedObjects = currentPredictions.map(p => ({
      name: p.class,
      score: p.score
    }));

    btnAnalyzeLLM.disabled = true;
    const originalText = btnAnalyzeLLM.innerHTML;
    btnAnalyzeLLM.innerHTML = '🧠 Menganalisis AI...';

    // Buka tampilan card LLM
    if (llmCard) {
      llmCard.style.display = 'block';
      llmAnalysisContent.innerHTML = '<p class="llm-placeholder">Sedang memproses analisis konteks visual melalui Smart LLM Router...</p>';
    }

    showToast(`Mengirim ke AI (${provider})...`, 'info');

    try {
      const response = await fetch('api/analyze_llm.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          provider: provider,
          objects: detectedObjects
        })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        if (llmProviderBadge) {
          llmProviderBadge.textContent = result.provider_used || provider;
        }
        if (llmFallbackBadge) {
          llmFallbackBadge.style.display = result.fallback_triggered ? 'inline-block' : 'none';
        }
        if (llmAnalysisContent) {
          llmAnalysisContent.textContent = result.analysis;
        }

        const msg = result.fallback_triggered 
          ? `Analisis selesai via Fallback (${result.provider_used})`
          : `Analisis sukses via ${result.provider_used}`;
        showToast(msg, 'success');
      } else {
        const errorMsg = result.message || 'Gagal memproses analisis LLM.';
        if (llmAnalysisContent) {
          llmAnalysisContent.innerHTML = `<p style="color: var(--accent-danger);">⚠️ ${errorMsg}</p>`;
        }
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('Error saat memanggil LLM router:', err);
      if (llmAnalysisContent) {
        llmAnalysisContent.innerHTML = '<p style="color: var(--accent-danger);">⚠️ Terjadi kesalahan koneksi ke server LLM.</p>';
      }
      showToast('Koneksi ke backend LLM gagal.', 'error');
    } finally {
      btnAnalyzeLLM.disabled = false;
      btnAnalyzeLLM.innerHTML = originalText;
    }
  }

  // =========================================================================
  // 9. Event Listeners Kontrol & Interaksi
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

  // Hubungkan tombol snapshot ke backend API
  btnSnapshot.addEventListener('click', handleSaveSnapshot);

  // Hubungkan tombol analisis LLM
  if (btnAnalyzeLLM) {
    btnAnalyzeLLM.addEventListener('click', handleAnalyzeLLM);
  }

  // Muat model saat halaman pertama kali dibuka
  loadModel();
});
