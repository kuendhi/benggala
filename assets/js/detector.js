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

  const refWidthCm = document.getElementById('refWidthCm');
  const btnCalibrate = document.getElementById('btnCalibrate');
  const btnResetCalibrate = document.getElementById('btnResetCalibrate');
  const calibrationStatus = document.getElementById('calibrationStatus');

  // --- State Variables ---
  let model = null;
  let stream = null;
  let isStreaming = false;
  let isDetecting = false;
  let animationFrameId = null;
  let currentFacingMode = 'user'; // 'user' (depan/webcam) atau 'environment' (belakang di HP)
  let minConfidence = parseFloat(thresholdSlider.value) / 100;
  let currentPredictions = [];
  let lastPredictions = [];
  let pixelsPerCm = parseFloat(localStorage.getItem('benggala_px_per_cm')) || null;

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

  // Helper untuk memperbarui tampilan status kalibrasi piksel ke cm
  function updateCalibrationUI() {
    if (!calibrationStatus) return;
    if (pixelsPerCm && pixelsPerCm > 0) {
      calibrationStatus.textContent = `Terkalibrasi (1 cm ≈ ${pixelsPerCm.toFixed(1)} px)`;
      calibrationStatus.classList.add('calibrated');
    } else {
      calibrationStatus.textContent = 'Belum dikalibrasi (mode piksel)';
      calibrationStatus.classList.remove('calibrated');
    }
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

    // Nonaktifkan CCTV jika kamera dimatikan
    if (window.BenggalaCCTV && window.BenggalaCCTV.isActive) {
      window.BenggalaCCTV.isActive = false;
      const btnToggleCCTV = document.getElementById('btnToggleCCTV');
      const cctvStatusBadge = document.getElementById('cctvStatusBadge');
      if (btnToggleCCTV) {
        btnToggleCCTV.classList.remove('active');
        btnToggleCCTV.innerHTML = '▶ Aktifkan CCTV';
      }
      if (cctvStatusBadge) {
        cctvStatusBadge.className = 'cctv-badge off';
        cctvStatusBadge.textContent = 'OFF';
      }
    }

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
          lastPredictions = filtered;

          renderPredictions(filtered);
          updateLiveStats(filtered);

          // Pengecekan Otomatis Mode CCTV Pintar
          if (window.BenggalaCCTV && window.BenggalaCCTV.isActive && filtered.length > 0) {
            const translatedForCCTV = filtered.map(p => ({
              translated_name: typeof window.translateLabel === 'function' ? window.translateLabel(p.class) : p.class,
              class: p.class,
              score: p.score,
              bbox: p.bbox
            }));

            window.BenggalaCCTV.checkDetections(translatedForCCTV, (matchedTarget) => {
              showToast(`🚨 CCTV: Target [${matchedTarget}] terdeteksi! Mengambil snapshot bukti...`, 'error');
              handleSaveSnapshot();
            });
          }
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
      const translatedName = typeof window.translateLabel === 'function' ? window.translateLabel(prediction.class) : prediction.class;
      const scorePercent = Math.round(prediction.score * 100);

      let labelText = `${translatedName} ${prediction.score.toFixed(2)}`;
      if (pixelsPerCm && pixelsPerCm > 0) {
        const wCm = (width / pixelsPerCm).toFixed(1);
        const hCm = (height / pixelsPerCm).toFixed(1);
        labelText = `${translatedName} ${scorePercent}% (${wCm}×${hCm} cm)`;
      }

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
        grouped[p.class] = { count: 0, maxScore: 0, bbox: p.bbox };
      }
      grouped[p.class].count += 1;
      if (p.score > grouped[p.class].maxScore) {
        grouped[p.class].maxScore = p.score;
        grouped[p.class].bbox = p.bbox;
      }
    });

    let html = '';
    const sortedClasses = Object.keys(grouped).sort((a, b) => grouped[b].count - grouped[a].count);

    sortedClasses.forEach(className => {
      const data = grouped[className];
      const percent = Math.round(data.maxScore * 100);
      const color = getColorForClass(className);
      const translatedName = typeof window.translateLabel === 'function' ? window.translateLabel(className) : className;

      let dimensionTag = '';
      if (pixelsPerCm && pixelsPerCm > 0 && data.bbox) {
        const wCm = (data.bbox[2] / pixelsPerCm).toFixed(1);
        const hCm = (data.bbox[3] / pixelsPerCm).toFixed(1);
        dimensionTag = `<span class="item-dimension">${wCm}×${hCm} cm</span>`;
      }

      html += `
        <div class="detection-item" style="border-left-color: ${color}">
          <div class="item-left">
            <span class="item-name">${translatedName}</span>
            <span class="item-count-badge">x${data.count}</span>
            ${dimensionTag}
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

  /**
   * Helper ringan untuk mengambil frame terkompresi dari video (lebar maks 640px)
   * untuk Gemini Multimodal Vision analysis
   */
  function captureCompressedFrame() {
    if (!video || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    const maxW = 640;
    let targetW = video.videoWidth;
    let targetH = video.videoHeight;

    if (targetW > maxW) {
      targetH = Math.round((targetH * maxW) / targetW);
      targetW = maxW;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tempCtx = tempCanvas.getContext('2d');

    // Ambil frame murni dari video
    tempCtx.drawImage(video, 0, 0, targetW, targetH);

    return tempCanvas.toDataURL('image/jpeg', 0.7);
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
    const objectsList = currentPredictions.map(p => {
      const objItem = {
        class: p.class,
        name_id: typeof window.translateLabel === 'function' ? window.translateLabel(p.class) : p.class,
        score: p.score
      };
      if (pixelsPerCm && pixelsPerCm > 0) {
        const wCm = (p.bbox[2] / pixelsPerCm).toFixed(1);
        const hCm = (p.bbox[3] / pixelsPerCm).toFixed(1);
        objItem.ukuran = `${wCm}x${hCm} cm`;
      }
      return objItem;
    });

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

    // Format objek untuk dikirim ke LLM (menggunakan terjemahan Bahasa Indonesia dan perkiraan ukuran cm)
    const detectedObjects = currentPredictions.map(p => {
      const objItem = {
        name: typeof window.translateLabel === 'function' ? window.translateLabel(p.class) : p.class,
        class_en: p.class,
        score: p.score
      };
      if (pixelsPerCm && pixelsPerCm > 0) {
        const wCm = (p.bbox[2] / pixelsPerCm).toFixed(1);
        const hCm = (p.bbox[3] / pixelsPerCm).toFixed(1);
        objItem.ukuran = `${wCm}x${hCm} cm`;
      }
      return objItem;
    });

    btnAnalyzeLLM.disabled = true;
    const originalText = btnAnalyzeLLM.innerHTML;
    btnAnalyzeLLM.innerHTML = '🧠 Menganalisis AI...';

    // Buka tampilan card LLM
    if (llmCard) {
      llmCard.style.display = 'block';
      llmAnalysisContent.innerHTML = '<p class="llm-placeholder">Sedang memproses analisis konteks visual melalui Smart LLM Router...</p>';
    }

    showToast(`Mengirim ke AI (${provider})...`, 'info');

    // Tangkap foto terkompresi dari video (maks 640px JPEG 0.7) untuk Gemini Vision
    const compressedImage = isStreaming ? captureCompressedFrame() : null;

    const requestPayload = {
      provider: provider,
      objects: detectedObjects
    };

    if (compressedImage) {
      requestPayload.image = compressedImage;
    }

    try {
      const response = await fetch('api/analyze_llm.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(requestPayload)
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

  // Event Kalibrasi Ukuran Real-Time (cm)
  if (btnCalibrate) {
    btnCalibrate.addEventListener('click', () => {
      if (!lastPredictions || lastPredictions.length === 0) {
        showToast('Arahkan kamera ke 1 benda referensi terlebih dahulu', 'error');
        return;
      }

      const refWidthInput = parseFloat(refWidthCm ? refWidthCm.value : 8.56);
      if (isNaN(refWidthInput) || refWidthInput <= 0) {
        showToast('Masukkan lebar referensi yang valid (cm)', 'error');
        return;
      }

      // Ambil objek dengan akurasi tertinggi dari lastPredictions
      let bestObj = lastPredictions[0];
      for (let i = 1; i < lastPredictions.length; i++) {
        if (lastPredictions[i].score > bestObj.score) {
          bestObj = lastPredictions[i];
        }
      }

      const bboxWidth = bestObj.bbox[2];
      pixelsPerCm = bboxWidth / refWidthInput;
      localStorage.setItem('benggala_px_per_cm', pixelsPerCm.toString());

      updateCalibrationUI();
      const objName = typeof window.translateLabel === 'function' ? window.translateLabel(bestObj.class) : bestObj.class;
      showToast(`Kalibrasi sukses via ${objName}! 1 cm ≈ ${pixelsPerCm.toFixed(1)} px`, 'success');
    });
  }

  // Reset Kalibrasi ke Mode Piksel
  if (btnResetCalibrate) {
    btnResetCalibrate.addEventListener('click', () => {
      pixelsPerCm = null;
      localStorage.removeItem('benggala_px_per_cm');
      updateCalibrationUI();
      showToast('Kalibrasi di-reset ke mode piksel', 'info');
    });
  }

  // Inisialisasi status kalibrasi dari localStorage
  updateCalibrationUI();

  // =========================================================================
  // 10. Event Listeners Mode CCTV Pintar
  // =========================================================================
  const btnToggleCCTV = document.getElementById('btnToggleCCTV');
  const cctvStatusBadge = document.getElementById('cctvStatusBadge');
  const cctvTargetSelect = document.getElementById('cctvTarget');
  const cctvCooldownInput = document.getElementById('cctvCooldown');
  const cctvAlarmCheckbox = document.getElementById('cctvAlarm');

  if (btnToggleCCTV && window.BenggalaCCTV) {
    btnToggleCCTV.addEventListener('click', () => {
      if (!isStreaming && !window.BenggalaCCTV.isActive) {
        showToast('Mulai kamera terlebih dahulu sebelum mengaktifkan Mode CCTV', 'error');
        return;
      }

      window.BenggalaCCTV.isActive = !window.BenggalaCCTV.isActive;

      if (cctvTargetSelect) {
        window.BenggalaCCTV.targetLabel = cctvTargetSelect.value;
      }
      if (cctvCooldownInput) {
        window.BenggalaCCTV.cooldownSec = Math.max(3, parseInt(cctvCooldownInput.value) || 15);
      }
      if (cctvAlarmCheckbox) {
        window.BenggalaCCTV.alarmEnabled = cctvAlarmCheckbox.checked;
      }

      if (window.BenggalaCCTV.isActive) {
        btnToggleCCTV.classList.add('active');
        btnToggleCCTV.innerHTML = '⏹ Matikan CCTV';
        if (cctvStatusBadge) {
          cctvStatusBadge.className = 'cctv-badge on';
          cctvStatusBadge.textContent = 'REC';
        }
        showToast(`Mode CCTV Aktif (Target: ${window.BenggalaCCTV.targetLabel})`, 'success');
      } else {
        btnToggleCCTV.classList.remove('active');
        btnToggleCCTV.innerHTML = '▶ Aktifkan CCTV';
        if (cctvStatusBadge) {
          cctvStatusBadge.className = 'cctv-badge off';
          cctvStatusBadge.textContent = 'OFF';
        }
        showToast('Mode CCTV Dinonaktifkan', 'info');
      }
    });

    if (cctvTargetSelect) {
      cctvTargetSelect.addEventListener('change', (e) => {
        window.BenggalaCCTV.targetLabel = e.target.value;
      });
    }

    if (cctvCooldownInput) {
      cctvCooldownInput.addEventListener('change', (e) => {
        window.BenggalaCCTV.cooldownSec = Math.max(3, parseInt(e.target.value) || 15);
      });
    }

    if (cctvAlarmCheckbox) {
      cctvAlarmCheckbox.addEventListener('change', (e) => {
        window.BenggalaCCTV.alarmEnabled = e.target.checked;
      });
    }
  }

  // Muat model saat halaman pertama kali dibuka
  loadModel();
});
