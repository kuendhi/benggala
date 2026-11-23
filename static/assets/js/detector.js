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

  const historyGrid = document.getElementById('historyGrid');
  const btnRefreshHistory = document.getElementById('btnRefreshHistory');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const historyCountBadge = document.getElementById('historyCountBadge');

  const cameraStage = document.getElementById('cameraStage');
  const hudZoomControl = document.getElementById('hudZoomControl');
  const zoomSlider = document.getElementById('zoomSlider');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const zoomValue = document.getElementById('zoomValue');

  const btnVoiceCmd = document.getElementById('btnVoiceCmd');
  const btnStopSpeak = document.getElementById('btnStopSpeak');
  const missionBadge = document.getElementById('missionBadge');
  const missionButtons = document.querySelectorAll('.mission-selector [data-mission]');

  const btnOpenDossier = document.getElementById('btnOpenDossier');
  const btnCloseDossier = document.getElementById('btnCloseDossier');
  const btnDownloadDossier = document.getElementById('btnDownloadDossier');
  const btnShareDossier = document.getElementById('btnShareDossier');
  const dossierBackdrop = document.getElementById('dossierBackdrop');

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
  let currentZoom = 1.0;
  let lastDossierData = null;
  let smoothedBoxesMap = new Map();
  let lastStatsUpdate = 0;
  const STATS_THROTTLE_MS = 250; // Batasi update DOM statistik live max 4x/detik (anti layout thrashing)

  // State Hook Pengetahuan Objek Kustom (Task 16B: MobileNet v2 + KNN Classifier)
  let lastKnnCheckTime = 0;
  let lastKnnMatch = null;
  let lastKnnMatchTime = 0;
  let isKnnClassifying = false;
  let latestActivePrediction = null;

  // State Fokus Kustom (Task 15)
  const focusState = {
    active: false,
    canvasX: null,
    canvasY: null,
    targetClass: null
  };
  const focusReticle = document.getElementById('focusReticle');
  const btnResetFocus = document.getElementById('btnResetFocus');

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

  // Helper untuk membaca CSRF token dari window.CSRF_TOKEN atau tag <meta name="csrf-token">
  function getCsrfToken() {
    if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  // Helper untuk mendapatkan URL endpoint / aset yang memperhitungkan subfolder (window.BASE_PATH)
  function getApiUrl(endpoint) {
    if (typeof window.resolveUrl === 'function') {
      return window.resolveUrl(endpoint);
    }
    const base = (window.BASE_PATH || '').replace(/\/+$/, '');
    if (!base) return endpoint;
    const clean = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    if (clean.startsWith(base + '/')) return clean;
    return base + clean;
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
  // Helper & Fungsi Kontrol Titik Fokus Dinamis (Task 15)
  // =========================================================================
  function updateFocusReticlePosition(screenX, screenY) {
    if (!focusReticle) return;
    const viewport = document.querySelector('.cockpit-viewport');
    if (!viewport) return;
    const vpRect = viewport.getBoundingClientRect();
    const leftPx = screenX - vpRect.left;
    const topPx = screenY - vpRect.top;
    focusReticle.style.left = `${leftPx}px`;
    focusReticle.style.top = `${topPx}px`;
    focusReticle.classList.add('is-custom-focus');
  }

  function resetCameraFocus() {
    focusState.active = false;
    focusState.canvasX = null;
    focusState.canvasY = null;
    focusState.targetClass = null;

    if (focusReticle) {
      focusReticle.style.left = '50%';
      focusReticle.style.top = '50%';
      focusReticle.classList.remove('is-custom-focus');
    }

    if (btnResetFocus) {
      btnResetFocus.classList.add('hidden');
    }

    if (window.BenggalaAutoLock && typeof window.BenggalaAutoLock.reset === 'function') {
      window.BenggalaAutoLock.reset();
    }
  }

  /**
   * Mengonversi koordinat client (layar) ke koordinat internal canvas (0..canvas.width, 0..canvas.height)
   * dengan memperhitungkan penyesuaian object-fit (contain vs cover) dan panggung kamera.
   */
  function clientToCanvasCoords(clientX, clientY) {
    if (!overlay || !video || !video.videoWidth || !video.videoHeight) {
      return { x: 0, y: 0 };
    }

    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const boxW = rect.width;
    const boxH = rect.height;

    const srcAspect = srcW / srcH;
    const boxAspect = boxW / boxH;

    let scale, offsetX = 0, offsetY = 0;

    if (cameraDisplayMode === 'fit') {
      // MODE FIT (object-fit: contain): Skala ditentukan oleh dimensi terkecil agar tidak terpotong
      scale = Math.min(boxW / srcW, boxH / srcH);
      const renderedW = srcW * scale;
      const renderedH = srcH * scale;
      offsetX = (boxW - renderedW) / 2;
      offsetY = (boxH - renderedH) / 2;

      const relX = clientX - rect.left - offsetX;
      const relY = clientY - rect.top - offsetY;

      return {
        x: Math.max(0, Math.min(srcW, relX / scale)),
        y: Math.max(0, Math.min(srcH, relY / scale))
      };
    } else {
      // MODE FILL (object-fit: cover): Skala ditentukan oleh dimensi terbesar untuk penuhi layar
      if (boxAspect > srcAspect) {
        scale = boxW / srcW;
        const renderedH = srcH * scale;
        offsetY = (renderedH - boxH) / 2;
        const relX = clientX - rect.left;
        const relY = (clientY - rect.top) + offsetY;
        return {
          x: Math.max(0, Math.min(srcW, relX / scale)),
          y: Math.max(0, Math.min(srcH, relY / scale))
        };
      } else {
        scale = boxH / srcH;
        const renderedW = srcW * scale;
        offsetX = (renderedW - boxW) / 2;
        const relX = (clientX - rect.left) + offsetX;
        const relY = clientY - rect.top;
        return {
          x: Math.max(0, Math.min(srcW, relX / scale)),
          y: Math.max(0, Math.min(srcH, relY / scale))
        };
      }
    }
  }

  /**
   * Mengonversi koordinat internal canvas ke koordinat layar presisi untuk pointer #focusReticle
   */
  function canvasToClientCoords(canvasX, canvasY) {
    if (!overlay || !video || !video.videoWidth || !video.videoHeight) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const boxW = rect.width;
    const boxH = rect.height;

    const srcAspect = srcW / srcH;
    const boxAspect = boxW / boxH;

    let scale, offsetX = 0, offsetY = 0;

    if (cameraDisplayMode === 'fit') {
      // MODE FIT (object-fit: contain)
      scale = Math.min(boxW / srcW, boxH / srcH);
      const renderedW = srcW * scale;
      const renderedH = srcH * scale;
      offsetX = (boxW - renderedW) / 2;
      offsetY = (boxH - renderedH) / 2;

      return {
        x: rect.left + offsetX + (canvasX * scale),
        y: rect.top + offsetY + (canvasY * scale)
      };
    } else {
      // MODE FILL (object-fit: cover)
      if (boxAspect > srcAspect) {
        scale = boxW / srcW;
        const renderedH = srcH * scale;
        offsetY = (renderedH - boxH) / 2;
        return {
          x: rect.left + canvasX * scale,
          y: rect.top + canvasY * scale - offsetY
        };
      } else {
        scale = boxH / srcH;
        const renderedW = srcW * scale;
        offsetX = (renderedW - boxW) / 2;
        return {
          x: rect.left + canvasX * scale - offsetX,
          y: rect.top + canvasY * scale
        };
      }
    }
  }

  function handleDoubleTapFocus(clientX, clientY) {
    if (!overlay || !canvas) return;

    // Konversi koordinat presisi dari layar ke koordinat internal canvas (anti-geser saat zoom & widescreen)
    const tapCoords = clientToCanvasCoords(clientX, clientY);
    const tapX = tapCoords.x;
    const tapY = tapCoords.y;

    // Cek apakah (tapX, tapY) mengenai salah satu bbox objek dari lastPredictions (toleransi margin 20px)
    let hit = null;
    const tolerance = 20;

    if (lastPredictions && lastPredictions.length > 0) {
      for (const pred of lastPredictions) {
        const [bx, by, bw, bh] = pred.bbox;
        if (
          tapX >= (bx - tolerance) &&
          tapX <= (bx + bw + tolerance) &&
          tapY >= (by - tolerance) &&
          tapY <= (by + bh + tolerance)
        ) {
          hit = pred;
          break;
        }
      }
    }

    if (hit) {
      const [bx, by, bw, bh] = hit.bbox;
      const bboxCenterX = bx + bw / 2;
      const bboxCenterY = by + bh / 2;

      focusState.active = true;
      focusState.canvasX = bboxCenterX;
      focusState.canvasY = bboxCenterY;
      focusState.targetClass = hit.class;

      const objName = typeof window.translateLabel === 'function' ? window.translateLabel(hit.class) : hit.class;
      showToast(`🎯 Target [${objName}] Terpilih! Memulai Kuncian & Auto-Snapshot...`, 'success');

      // Posisikan #focusReticle ke koordinat layar objek secara presisi
      const screenCoords = canvasToClientCoords(bboxCenterX, bboxCenterY);
      updateFocusReticlePosition(screenCoords.x, screenCoords.y);

      // Tampilkan tombol reset fokus
      if (btnResetFocus) {
        btnResetFocus.classList.remove('hidden');
      }

      // Reset timer Auto-Lock agar siklus kuncian dimulai ulang dengan bersih untuk objek terpilih
      if (window.BenggalaAutoLock && typeof window.BenggalaAutoLock.reset === 'function') {
        window.BenggalaAutoLock.reset();
      }
    } else {
      // Menyentuh area kosong: Jangan kunci, kembalikan ke mode jelajah bebas
      resetCameraFocus();
      showToast('🎯 Mode Bebas: Ketuk 2x pada objek untuk mengunci & auto-snapshot', 'info');
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

      // Pada smartphone / mobile gunakan lite_mobilenet_v2 agar FPS mencapai 30+ FPS (bebas lag)
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const targetBase = isMobileDevice ? 'lite_mobilenet_v2' : 'mobilenet_v2';
      try {
        model = await cocoSsd.load({ base: targetBase });
      } catch (errLoad) {
        console.warn(`Gagal memuat ${targetBase}, fallback ke default:`, errLoad);
        model = await cocoSsd.load();
      }

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
  // 2. Kontrol Kamera, Deteksi Multi-Kamera Belakang & facingMode
  // =========================================================================
  let detectedCameras = [];
  let selectedCameraDeviceId = localStorage.getItem('benggala_selected_camera_id') || '';

  /**
   * Mengelompokkan dan memberi nama ramah untuk kamera belakang (Ultra-Wide, Wide, Telephoto, Macro) dan depan
   */
  function categorizeCamera(device, index, total) {
    const rawLabel = (device.label || '').trim();
    const labelLower = rawLabel.toLowerCase();
    let type = 'back';
    let friendlyName = rawLabel || `Kamera ${index + 1}`;

    const isFront = labelLower.includes('front') || labelLower.includes('user') || labelLower.includes('depan') || labelLower.includes('selfie') || labelLower.includes('facing front');
    const isUltraWide = labelLower.includes('ultra') || labelLower.includes('0.5') || labelLower.includes('0.6');
    const isTele = labelLower.includes('tele') || labelLower.includes('zoom') || labelLower.includes('2x') || labelLower.includes('3x') || labelLower.includes('5x') || labelLower.includes('10x');
    const isMacro = labelLower.includes('macro');
    const isWide = (labelLower.includes('wide') || labelLower.includes('main')) && !isUltraWide;

    if (isFront) {
      type = 'front';
      friendlyName = `🤳 Kamera Depan ${rawLabel ? `(${rawLabel})` : ''}`;
    } else {
      type = 'back';
      if (isUltraWide) {
        friendlyName = `📐 Kamera Belakang Ultra-Wide (0.5x) ${rawLabel ? `[${rawLabel}]` : ''}`;
      } else if (isTele) {
        friendlyName = `🔭 Kamera Belakang Telephoto / Zoom ${rawLabel ? `[${rawLabel}]` : ''}`;
      } else if (isMacro) {
        friendlyName = `🔍 Kamera Belakang Macro ${rawLabel ? `[${rawLabel}]` : ''}`;
      } else if (isWide) {
        friendlyName = `📷 Kamera Belakang Utama (1x Wide) ${rawLabel ? `[${rawLabel}]` : ''}`;
      } else {
        if (labelLower.includes('0') || index === 0) {
          friendlyName = `📷 Kamera Belakang Utama ${rawLabel ? `(${rawLabel})` : `#${index + 1}`}`;
        } else {
          friendlyName = `📷 Kamera Belakang #${index + 1} ${rawLabel ? `(${rawLabel})` : ''}`;
        }
      }
    }

    return {
      deviceId: device.deviceId,
      type,
      isBack: type === 'back',
      label: rawLabel,
      friendlyName
    };
  }

  /**
   * Mendeteksi seluruh kamera perangkat dan memperbarui opsi dropdown pilihan kamera
   */
  async function refreshCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      detectedCameras = videoDevices.map((dev, idx) => categorizeCamera(dev, idx, videoDevices.length));

      const cameraDeviceSelect = document.getElementById('cameraDeviceSelect');
      const cameraCountBadge = document.getElementById('cameraCountBadge');

      if (cameraCountBadge) {
        const backCount = detectedCameras.filter(c => c.isBack).length;
        const frontCount = detectedCameras.filter(c => !c.isBack).length;
        if (detectedCameras.length > 0) {
          cameraCountBadge.textContent = `${detectedCameras.length} Kamera (${backCount} Belakang, ${frontCount} Depan)`;
        } else {
          cameraCountBadge.textContent = 'Standar';
        }
      }

      if (cameraDeviceSelect) {
        cameraDeviceSelect.innerHTML = '';

        // Opsi Otomatis (Default Belakang)
        const optDefault = document.createElement('option');
        optDefault.value = '';
        optDefault.textContent = '⚡ Otomatis (Default Belakang)';
        if (!selectedCameraDeviceId) optDefault.selected = true;
        cameraDeviceSelect.appendChild(optDefault);

        // Kelompok Kamera Belakang (Multi-Lensa Modern)
        const backCameras = detectedCameras.filter(c => c.isBack);
        if (backCameras.length > 0) {
          const groupBack = document.createElement('optgroup');
          groupBack.label = '📷 Kamera Belakang (Pilih Lensa Spesifik)';
          backCameras.forEach(cam => {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.friendlyName;
            if (cam.deviceId === selectedCameraDeviceId) {
              opt.selected = true;
            }
            groupBack.appendChild(opt);
          });
          cameraDeviceSelect.appendChild(groupBack);
        }

        // Kelompok Kamera Depan
        const frontCameras = detectedCameras.filter(c => !c.isBack);
        if (frontCameras.length > 0) {
          const groupFront = document.createElement('optgroup');
          groupFront.label = '🤳 Kamera Depan (Selfie)';
          frontCameras.forEach(cam => {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.friendlyName;
            if (cam.deviceId === selectedCameraDeviceId) {
              opt.selected = true;
            }
            groupFront.appendChild(opt);
          });
          cameraDeviceSelect.appendChild(groupFront);
        }

        // Jika belum ada nama label (izin belum diberikan), tampilkan hint
        if (detectedCameras.length > 0 && !detectedCameras[0].label) {
          const optHint = document.createElement('option');
          optHint.value = '';
          optHint.disabled = true;
          optHint.textContent = 'ℹ️ Mulai kamera 1x untuk membuka nama lengkap lensa';
          cameraDeviceSelect.appendChild(optHint);
        }
      }
    } catch (err) {
      console.warn('Gagal mengenumerasi perangkat kamera:', err);
    }
  }

  async function startCamera() {
    hideCameraError();

    if (!model) {
      showToast('Model AI belum siap. Harap tunggu sebentar.', 'error');
      return;
    }

    if (stream) {
      stopCameraTracks();
    }

    // Resolusi Tinggi Ideal: Full HD 1080p hingga 4K
    // Sesuaikan rasio dan dimensi ideal berdasarkan orientasi yang dipilih
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let targetIdealW = 1920;
    let targetIdealH = 1080;
    let targetAspect = 1.7777777778; // 16:9 Widescreen

    if (cameraOrientation === 'portrait') {
      targetIdealW = 1080;
      targetIdealH = 1920;
      targetAspect = 0.5625; // 9:16 Portrait
    }

    const primaryVideoConstraints = {
      width: { ideal: targetIdealW, max: 3840 },
      height: { ideal: targetIdealH, max: 2160 },
      aspectRatio: { ideal: targetAspect }
    };

    if (selectedCameraDeviceId) {
      primaryVideoConstraints.deviceId = { exact: selectedCameraDeviceId };
    } else if (isMobileDevice) {
      primaryVideoConstraints.facingMode = { ideal: currentFacingMode };
    }

    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: primaryVideoConstraints
        });
      } catch (errConstraint) {
        console.warn('Resolusi 1080p / kamera spesifik tidak dapat dipenuhi kaku, mencoba fallback resolusi fleksibel:', errConstraint);
        try {
          const fallbackConstraints = {
            width: { ideal: (cameraOrientation === 'portrait' ? 720 : 1280), min: 480 },
            height: { ideal: (cameraOrientation === 'portrait' ? 1280 : 720), min: 480 },
            aspectRatio: { ideal: targetAspect }
          };
          if (selectedCameraDeviceId) {
            fallbackConstraints.deviceId = { ideal: selectedCameraDeviceId };
          } else if (isMobileDevice) {
            fallbackConstraints.facingMode = { ideal: currentFacingMode };
          }
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: fallbackConstraints
          });
        } catch (errFallback) {
          console.warn('Fallback 720p gagal, mencoba stream dasar:', errFallback);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: isMobileDevice ? { facingMode: currentFacingMode } : true
          });
        }
      }

      // Optimasi kapabilitas hardware kamera (auto-focus saja, hindari white balance lock agar warna netral alami)
      try {
        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities();
          const advanced = {};
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            advanced.focusMode = 'continuous';
          }
          if (Object.keys(advanced).length > 0 && typeof track.applyConstraints === 'function') {
            await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
          }
        }
      } catch (capErr) {
        // Abaikan jika tidak didukung perangkat
      }

      video.srcObject = stream;

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve);
        };
      });

      isStreaming = true;
      cameraPlaceholder.style.display = 'none';

      // Sembunyikan starfield latar saat kamera aktif agar tidak ada bias/gradasi biru di area sekitar kamera
      const viewportStars = document.getElementById('viewportStars');
      if (viewportStars) {
        viewportStars.style.display = 'none';
      }

      // Aktifkan glow ambient stage monitor
      const cameraStage = document.getElementById('cameraStage');
      if (cameraStage) {
        cameraStage.classList.add('active-stream');
      }

      // Terapkan filter kecerahan monitor tersimpan
      applySavedBrightness();

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

      // Perbarui daftar multi-kamera sekarang karena izin mediaDevices telah terbuka
      await refreshCameraDevices();

      const resBadge = (video.videoWidth >= 1920) ? 'FHD 1080p' : (video.videoWidth >= 1280 ? 'HD 720p' : `${video.videoWidth}×${video.videoHeight}`);
      showToast(`✨ Monitor Utama Cerah & Resolusi Tinggi: ${video.videoWidth}×${video.videoHeight} (${resBadge})`, 'success');
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

    const cameraStage = document.getElementById('cameraStage');
    if (cameraStage) {
      cameraStage.classList.remove('active-stream');
      cameraStage.style.width = '100%';
      cameraStage.style.height = '100%';
      cameraStage.style.transform = 'scale(1)';
    }

    const viewportStars = document.getElementById('viewportStars');
    if (viewportStars) {
      viewportStars.style.display = 'block';
    }

    resetCameraFocus();

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

    // Update Telemetri YOULO OS ke STANDBY
    if (window.BenggalaCockpit && typeof window.BenggalaCockpit.updateTelemetry === 'function') {
      window.BenggalaCockpit.updateTelemetry({
        fps: 0,
        predictions: [],
        threshold: Math.round(minConfidence * 100),
        pixelsPerCm: pixelsPerCm,
        isRunning: false,
        isCctv: false
      });
    }
  }

  async function switchCamera() {
    if (detectedCameras.length > 1) {
      // Jika terdeteksi multi-kamera (misal smartphone dengan banyak lensa belakang), lakukan cycling ke kamera berikutnya
      let currentIndex = -1;
      if (selectedCameraDeviceId) {
        currentIndex = detectedCameras.findIndex(c => c.deviceId === selectedCameraDeviceId);
      } else {
        currentIndex = detectedCameras.findIndex(c => (currentFacingMode === 'user' ? !c.isBack : c.isBack));
      }

      const nextIndex = (currentIndex + 1) % detectedCameras.length;
      const nextCam = detectedCameras[nextIndex];
      selectedCameraDeviceId = nextCam.deviceId;
      localStorage.setItem('benggala_selected_camera_id', selectedCameraDeviceId);
      currentFacingMode = nextCam.isBack ? 'environment' : 'user';

      const cameraDeviceSelect = document.getElementById('cameraDeviceSelect');
      if (cameraDeviceSelect) {
        cameraDeviceSelect.value = selectedCameraDeviceId;
      }

      showToast(`🔄 Beralih ke: ${nextCam.friendlyName}`, 'info');
      if (isStreaming) {
        await startCamera();
      }
    } else {
      currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
      selectedCameraDeviceId = '';
      localStorage.removeItem('benggala_selected_camera_id');
      const cameraDeviceSelect = document.getElementById('cameraDeviceSelect');
      if (cameraDeviceSelect) {
        cameraDeviceSelect.value = '';
      }
      if (isStreaming) {
        await startCamera();
      }
    }
  }

  function showCameraError(message) {
    cameraErrorMessage.textContent = message;
    cameraError.style.display = 'block';
  }

  function hideCameraError() {
    cameraError.style.display = 'none';
  }

  let cameraOrientation = localStorage.getItem('benggala_cam_orientation') || 'portrait'; // 'portrait' (9:16) default | 'widescreen' (16:9) | 'auto'
  let cameraDisplayMode = localStorage.getItem('benggala_cam_display_mode') || 'fit'; // 'fit' (proporsional tanpa potong) | 'fill' (layar penuh)

  function syncCanvasDimensions() {
    if (!video || !canvas) return;

    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Maksimalkan dimensi tampilan cameraStage sesuai orientasi & perangkat
      const container = document.getElementById('cameraContainer');
      const stage = document.getElementById('cameraStage');
      if (container && stage) {
        const contW = container.clientWidth;
        const contH = container.clientHeight;

        if (contW > 0 && contH > 0) {
          const videoAspect = video.videoWidth / video.videoHeight;
          const contAspect = contW / contH;
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                                 (('ontouchstart' in window || navigator.maxTouchPoints > 0) && Math.max(window.innerWidth, window.innerHeight) <= 1024);

          let targetW, targetH;

          // Sinkronisasi kelas CSS mode framing (Fit / Fill)
          if (cameraDisplayMode === 'fit') {
            stage.classList.add('is-fit');
            stage.classList.remove('is-fill');
          } else {
            stage.classList.add('is-fill');
            stage.classList.remove('is-fit');
          }

          if (isMobileDevice) {
            // ===================================================================
            // MODE HP / MOBILE: Responsif Penuh & Halus Saat Layar Diputar-putar
            // ===================================================================
            stage.classList.remove('is-widescreen');
            if (contW <= contH) {
              // HP posisi tegak (Portrait)
              stage.classList.add('is-portrait');
            } else {
              // HP posisi miring/tidur (Landscape)
              stage.classList.remove('is-portrait');
            }
            // Penuhi layar HP secara dinamis tanpa bar kosong
            targetW = contW;
            targetH = contH;
          } else {
            // ===================================================================
            // MODE PC: Proporsional & Tetap Portrait Memenuhi Screen
            // ===================================================================
            if (cameraOrientation === 'portrait') {
              // Tampilan Portrait Taktis di PC: Tinggi penuhi monitor (100% contH)
              stage.classList.remove('is-widescreen');
              stage.classList.add('is-portrait');

              targetH = contH;

              // Lebar proporsional portrait di monitor PC:
              // Jika sensor asli sudah portrait (kamera vertikal), ikuti rasio sensornya.
              // Jika webcam PC horizontal (4:3 atau 16:9), buat bingkai portrait 9:16 yang elegan & proporsional
              if (videoAspect < 1.0) {
                targetW = Math.round(contH * videoAspect);
              } else {
                const portAspect = 9 / 16; // 0.5625
                targetW = Math.min(contW, Math.round(contH * portAspect));
              }
            } else if (cameraOrientation === 'widescreen') {
              // Mode Widescreen (16:9 Landscape) di PC
              const wideAspect = 16 / 9; // 1.7778
              stage.classList.remove('is-portrait');
              stage.classList.add('is-widescreen');

              if (contAspect >= wideAspect) {
                targetH = contH;
                targetW = contW;
              } else {
                targetW = contW;
                targetH = contW / wideAspect;
              }
            } else {
              // Mode Auto: Sesuai Rasio Sensor Asli Kamera (100% Proporsional Murni)
              stage.classList.remove('is-widescreen', 'is-portrait');
              if (contAspect > videoAspect) {
                targetH = contH;
                targetW = contH * videoAspect;
              } else {
                targetW = contW;
                targetH = contW / videoAspect;
              }
            }
          }

          stage.style.width = `${Math.round(targetW)}px`;
          stage.style.height = `${Math.round(targetH)}px`;
        }
      }
    }
  }

  // Sinkronisasi dimensi canvas pada loadedmetadata & window resize / rotasi HP
  video.addEventListener('loadedmetadata', syncCanvasDimensions);
  window.addEventListener('resize', syncCanvasDimensions);
  window.addEventListener('orientationchange', () => {
    setTimeout(syncCanvasDimensions, 80);
    setTimeout(syncCanvasDimensions, 250);
  });
  if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
    screen.orientation.addEventListener('change', () => {
      setTimeout(syncCanvasDimensions, 80);
      setTimeout(syncCanvasDimensions, 250);
    });
  }

  // =========================================================================
  // Smooth Zoom Controller (Hardware & Digital Zoom)
  // Mendukung rentang zoom dari 0.5x (wide) hingga 3.0x (tele)
  // =========================================================================
  function applyCameraZoom(level) {
    level = Math.max(0.5, Math.min(3.0, parseFloat(level) || 1.0));
    currentZoom = level;

    // 1. Coba Hardware Zoom jika didukung oleh video track kamera (hanya untuk >= 1.0)
    let hardwareZoomSuccess = false;
    const track = stream ? stream.getVideoTracks()[0] : null;
    if (track && typeof track.getCapabilities === 'function' && level >= 1.0) {
      try {
        const caps = track.getCapabilities();
        if (caps && 'zoom' in caps) {
          const minZ = caps.zoom.min || 1;
          const maxZ = caps.zoom.max || 3;
          const mappedZoom = minZ + ((level - 1.0) / 2.0) * (maxZ - minZ);
          track.applyConstraints({
            advanced: [{ zoom: mappedZoom }]
          }).then(() => {
            if (cameraStage) cameraStage.style.transform = 'scale(1)';
          }).catch(() => {
            if (cameraStage) cameraStage.style.transform = `scale(${level})`;
          });
          hardwareZoomSuccess = true;
        }
      } catch (err) {
        hardwareZoomSuccess = false;
      }
    }

    // 2. Fallback Digital Smooth Zoom pada cameraStage jika hardware zoom tidak aktif atau level < 1.0
    if (!hardwareZoomSuccess && cameraStage) {
      cameraStage.style.transform = `scale(${level})`;
    }

    // 3. Perbarui UI Zoom Slider & Badge Nilai
    if (zoomValue) {
      zoomValue.textContent = `${level.toFixed(1)}x`;
    }
    if (zoomSlider && Math.abs(parseFloat(zoomSlider.value) - level) > 0.02) {
      zoomSlider.value = level.toString();
    }
  }

  // =========================================================================
  // 3. Loop Deteksi Real-Time dengan Class-Agnostic NMS & Containment Suppression
  // Mencegah Objek Bayangan / Kotak Bersarang di Dalam Objek Lain (Anti-Ghosting)
  // serta Menjaga Kinerja Tinggi 30+ FPS di Perangkat Mobile
  // =========================================================================
  const zoomFeedCanvas = document.createElement('canvas');
  zoomFeedCanvas.width = 640;
  zoomFeedCanvas.height = 480;
  const zoomFeedCtx = zoomFeedCanvas.getContext('2d', { willReadFrequently: true });

  /**
   * Menghitung IoU dan rasio tumpang-tindih (Containment Ratio)
   * untuk mendeteksi apakah suatu objek berada di dalam objek lain (seperti bayangan mangkuk di dalam botol).
   */
  function calculateBoxOverlap(boxA, boxB) {
    const xA = Math.max(boxA[0], boxB[0]);
    const yA = Math.max(boxA[1], boxB[1]);
    const xB = Math.min(boxA[0] + boxA[2], boxB[0] + boxB[2]);
    const yB = Math.min(boxA[1] + boxA[3], boxB[1] + boxB[3]);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    if (interArea <= 0) {
      return { iou: 0, overlapA: 0, overlapB: 0 };
    }

    const areaA = boxA[2] * boxA[3];
    const areaB = boxB[2] * boxB[3];
    const iou = interArea / (areaA + areaB - interArea);
    const overlapA = interArea / areaA; // Berapa % Box A berada di dalam Box B
    const overlapB = interArea / areaB; // Berapa % Box B berada di dalam Box A

    return { iou, overlapA, overlapB };
  }

  /**
   * Class-Agnostic Non-Maximum Suppression (NMS) & Containment Suppression.
   * Menghilangkan objek bayangan / kotak palsu yang tumpang-tindih atau bersarang di dalam objek lain
   * (seperti mangkuk atau meja makan di dalam botol).
   */
  function suppressNestedAndOverlappingBoxes(predictions, iouThreshold = 0.35, containmentThreshold = 0.50) {
    if (!predictions || predictions.length <= 1) return predictions || [];

    // Filter awal: Supresi false positive "dining table" / meja makan yang tumpang-tindih dengan objek foreground
    const cleaned = predictions.filter(p => {
      // Jika meja makan berukuran kecil atau akurasinya di bawah 0.70 saat ada objek lain
      if (p.class === 'dining table' && p.score < 0.70) {
        return false;
      }
      return true;
    });

    // Urutkan dari confidence tertinggi ke terendah
    const sorted = [...cleaned].sort((a, b) => b.score - a.score);
    const accepted = [];

    for (const cand of sorted) {
      let isDuplicateOrNested = false;

      for (const win of accepted) {
        const { iou, overlapA, overlapB } = calculateBoxOverlap(win.bbox, cand.bbox);

        // 1. IoU tinggi (kotak hampir berimpit)
        if (iou > iouThreshold) {
          isDuplicateOrNested = true;
          break;
        }

        // 2. Kotak kandidat berada di dalam objek yang sudah diterima (misal mangkuk di dalam botol)
        if (overlapB > containmentThreshold) {
          isDuplicateOrNested = true;
          break;
        }

        // 3. Kotak yang sudah diterima berada di dalam kandidat ini (kandidat membungkus objek spesifik dengan skor lebih rendah)
        if (overlapA > containmentThreshold) {
          isDuplicateOrNested = true;
          break;
        }
      }

      if (!isDuplicateOrNested) {
        accepted.push(cand);
      }
    }

    return accepted;
  }

  function startDetectionLoop() {
    let frameCount = 0;
    let currentFps = 0;
    let lastFpsUpdate = performance.now();

    const detectFrame = async () => {
      if (!isStreaming) return;

      if (!isDetecting && video.readyState >= 2 && model) {
        isDetecting = true;
        syncCanvasDimensions();

        try {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          // Sensitivitas seimbang: filter noise di bawah 0.30
          const detectMinScore = Math.max(0.30, minConfidence * 0.90);

          let scanInput = video;
          let zoomScale = 1.0;
          let zoomOffsetX = 0;
          let zoomOffsetY = 0;

          if (currentZoom > 1.05) {
            const cropW = vw / currentZoom;
            const cropH = vh / currentZoom;
            zoomOffsetX = (vw - cropW) / 2;
            zoomOffsetY = (vh - cropH) / 2;
            zoomFeedCtx.drawImage(video, zoomOffsetX, zoomOffsetY, cropW, cropH, 0, 0, zoomFeedCanvas.width, zoomFeedCanvas.height);
            scanInput = zoomFeedCanvas;
            zoomScale = cropW / zoomFeedCanvas.width;
          }

          const rawDetections = await model.detect(scanInput, 25, detectMinScore);

          let scaledDetections = rawDetections;
          if (currentZoom > 1.05) {
            scaledDetections = rawDetections.map(p => ({
              class: p.class,
              score: p.score,
              bbox: [
                zoomOffsetX + p.bbox[0] * zoomScale,
                zoomOffsetY + p.bbox[1] * zoomScale,
                p.bbox[2] * zoomScale,
                p.bbox[3] * zoomScale
              ]
            }));
          }

          // 1. Filter awal berdasarkan ambang batas keyakinan pengguna
          const confidentList = scaledDetections.filter(pred => pred.score >= minConfidence);

          // 2. Terapkan Containment Suppression & Class-Agnostic NMS
          // Menghilangkan bayangan dalam objek (seperti mangkuk / meja di dalam botol)
          const filtered = suppressNestedAndOverlappingBoxes(confidentList);

          currentPredictions = filtered;
          lastPredictions = filtered;

          // Hitung FPS Riil
          const now = performance.now();
          frameCount++;
          if (now - lastFpsUpdate >= 500) {
            currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
            frameCount = 0;
            lastFpsUpdate = now;
          }

          // Evaluasi Filter Fokus & Auto-Lock Target (HANYA AKTIF JIKA OBJEK DI-KLIK 2X)
          let displayPredictions = filtered;
          let autoLockPredictions = []; // Default KOSONG: Cegah kuncian dan auto-snapshot pasif!

          if (focusState.active && focusState.targetClass) {
            let focusedObject = null;

            if (filtered.length > 0) {
              let bestScore = Infinity;

              filtered.forEach(pred => {
                const [bx, by, bw, bh] = pred.bbox;
                const midX = bx + bw / 2;
                const midY = by + bh / 2;
                const dist = Math.hypot(midX - focusState.canvasX, midY - focusState.canvasY);

                // Cek apakah titik fokus kanvas berada di dalam bbox
                const isInside = (
                  focusState.canvasX >= bx && focusState.canvasX <= bx + bw &&
                  focusState.canvasY >= by && focusState.canvasY <= by + bh
                );
                const classMatch = (pred.class === focusState.targetClass);

                // Skor kecocokan: makin kecil makin cocok
                let score = dist;
                if (isInside) score -= 100;
                if (classMatch) score -= 200;

                if (score < bestScore) {
                  bestScore = score;
                  focusedObject = pred;
                }
              });
            }

            if (focusedObject) {
              const [fbx, fby, fbw, fbh] = focusedObject.bbox;
              const targetMidX = fbx + fbw / 2;
              const targetMidY = fby + fbh / 2;

              // Smooth tracking titik fokus ke titik tengah target (Lerp)
              const TRACK_LERP = 0.25;
              focusState.canvasX += (targetMidX - focusState.canvasX) * TRACK_LERP;
              focusState.canvasY += (targetMidY - focusState.canvasY) * TRACK_LERP;

              // Geser pointer #focusReticle mengikuti posisi target di layar secara presisi
              const screenCoords = canvasToClientCoords(focusState.canvasX, focusState.canvasY);
              updateFocusReticlePosition(screenCoords.x, screenCoords.y);

              // Isolasi visual & auto-lock: hanya objek terpilih yang dikunci dan difoto otomatis!
              displayPredictions = [focusedObject];
              autoLockPredictions = [focusedObject];
            } else {
              // Jika target tidak terdeteksi di frame ini, tetap reposisi reticle jika canvas digeser/di-zoom
              if (focusState.canvasX !== null && focusState.canvasY !== null) {
                const screenCoords = canvasToClientCoords(focusState.canvasX, focusState.canvasY);
                updateFocusReticlePosition(screenCoords.x, screenCoords.y);
              }
              displayPredictions = [];
              autoLockPredictions = [];
            }
          }

          // Simpan referensi objek aktif utama untuk modul training (Task 16B)
          latestActivePrediction = (displayPredictions && displayPredictions.length > 0) ? displayPredictions[0] : null;

          // Hook Pengetahuan Objek Kustom (Task 16B: MobileNet v2 + KNN Classifier Throttled ~350ms)
          const targetPred = latestActivePrediction;
          const nowPerf = performance.now();

          if (targetPred && window.BenggalaKnowledge && typeof window.BenggalaKnowledge.isReady === 'function' && window.BenggalaKnowledge.isReady()) {
            if (!isKnnClassifying && (nowPerf - lastKnnCheckTime > 350)) {
              lastKnnCheckTime = nowPerf;
              isKnnClassifying = true;
              window.BenggalaKnowledge.classifyBox(video, targetPred.bbox)
                .then(match => {
                  if (match && match.label) {
                    lastKnnMatch = match;
                    lastKnnMatchTime = performance.now();
                  }
                })
                .catch(err => console.warn('KNN classify error:', err))
                .finally(() => {
                  isKnnClassifying = false;
                });
            }
          }

          // Terapkan label kustom jika match masih dalam masa aktif (~800ms)
          if (targetPred && lastKnnMatch && (nowPerf - lastKnnMatchTime < 800)) {
            targetPred.customLabel = lastKnnMatch.label;
            targetPred.isCustom = true;
            targetPred.class = lastKnnMatch.label; // Teruskan ke Auto-Lock, TTS, dan Dossier
          }

          renderPredictions(displayPredictions);

          // Update & Gambar Auto-Lock Target (Fase 1: Cyan -> Fase 2: Amber -> Fase 3: Hijau)
          if (window.BenggalaAutoLock && window.BenggalaAutoLock.enabled) {
            window.BenggalaAutoLock.update(
              autoLockPredictions,
              performance.now(),
              (lockedTarget) => {
                handleAutoLockPipeline(lockedTarget);
              },
              canvas.width,
              canvas.height
            );
            window.BenggalaAutoLock.drawLockOverlay(ctx);
          }

          updateLiveStats(displayPredictions);

          // Panduan Navigasi Spasial Suara Real-Time (Khusus Mode Tunanetra)
          if (window.BenggalaMissions && typeof window.BenggalaMissions.announceSpatial === 'function') {
            window.BenggalaMissions.announceSpatial(displayPredictions, video.videoWidth || 640, video.videoHeight || 480);
          }

          // Update Telemetri & Mini Radar YOULO OS
          if (window.BenggalaCockpit && typeof window.BenggalaCockpit.updateTelemetry === 'function') {
            window.BenggalaCockpit.updateTelemetry({
              fps: currentFps,
              predictions: displayPredictions,
              videoWidth: video.videoWidth || 640,
              videoHeight: video.videoHeight || 480,
              threshold: Math.round(minConfidence * 100),
              pixelsPerCm: pixelsPerCm,
              isRunning: isStreaming,
              isCctv: window.BenggalaCCTV ? window.BenggalaCCTV.isActive : false
            });
          }

          // Update Simulasi Sinyal ESP32 jika Overlay Visi 2027 sedang terbuka (Task 13B)
          if (window.BenggalaRoadmap && typeof window.BenggalaRoadmap.updateLiveEspSim === 'function' && window.BenggalaRoadmap.isOpen()) {
            window.BenggalaRoadmap.updateLiveEspSim(filtered, video.videoWidth || 640);
          }

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
              handleSaveSnapshot(true);
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
  // 4. Render Bounding Box & Label Teks (dengan Lerp Smoothing Anti-Jitter)
  // =========================================================================
  function renderPredictions(predictions) {
    // Pastikan pembersihan canvas clearRect dilakukan tepat sebelum menggambar ulang
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!predictions || predictions.length === 0) {
      smoothedBoxesMap.clear();
      return;
    }

    const scale = Math.max(1, Math.round(canvas.width / 800));
    const fontSize = Math.max(15, 15 * scale);
    const lineWidth = Math.max(2, 2.5 * scale);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    const currentMap = new Map();
    const LERP_FACTOR = 0.65; // Interpolasi halus antar-frame untuk meredam jitter/lonjakan

    predictions.forEach((prediction, idx) => {
      const [rawX, rawY, rawW, rawH] = prediction.bbox;
      const key = `${prediction.class}_${idx}`;

      let smoothX = rawX;
      let smoothY = rawY;
      let smoothW = rawW;
      let smoothH = rawH;

      if (smoothedBoxesMap.has(key)) {
        const prev = smoothedBoxesMap.get(key);
        smoothX = prev.x + (rawX - prev.x) * LERP_FACTOR;
        smoothY = prev.y + (rawY - prev.y) * LERP_FACTOR;
        smoothW = prev.width + (rawW - prev.width) * LERP_FACTOR;
        smoothH = prev.height + (rawH - prev.height) * LERP_FACTOR;
      }

      currentMap.set(key, { x: smoothX, y: smoothY, width: smoothW, height: smoothH });

      const isSmallObj = (smoothW < 80 || smoothH < 80);
      const itemFontSize = isSmallObj ? Math.max(11, 11 * scale) : fontSize;
      ctx.font = `bold ${itemFontSize}px sans-serif`;

      const isCustomObj = Boolean(prediction.isCustom || prediction.customLabel);
      const color = isCustomObj ? '#fbbf24' : getColorForClass(prediction.class);
      const translatedName = prediction.customLabel
        ? `★ ${prediction.customLabel}`
        : (typeof window.translateLabel === 'function' ? window.translateLabel(prediction.class) : prediction.class);
      const scorePercent = Math.round(prediction.score * 100);

      // Tandai dengan ikon 🔍 jika dideteksi via pemindai detail macro
      const macroBadge = prediction.isMacro ? '🔍 ' : '';
      let labelText = `${macroBadge}${translatedName} ${prediction.score.toFixed(2)}`;
      if (pixelsPerCm && pixelsPerCm > 0) {
        const wCm = (smoothW / pixelsPerCm).toFixed(1);
        const hCm = (smoothH / pixelsPerCm).toFixed(1);
        labelText = `${macroBadge}${translatedName} ${scorePercent}% (${wCm}×${hCm} cm)`;
      }

      // Bounding Box Halus & Glowing
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur = (isSmallObj ? 8 : 5) * scale;
      ctx.strokeRect(smoothX, smoothY, smoothW, smoothH);

      // Gambar reticle sudut taktis untuk objek kecil agar bingkai lebih tegas
      if (isSmallObj) {
        const cLen = Math.max(5, Math.min(12, Math.min(smoothW, smoothH) * 0.35));
        ctx.lineWidth = lineWidth * 1.5;
        ctx.beginPath();
        // Pojok kiri atas
        ctx.moveTo(smoothX, smoothY + cLen);
        ctx.lineTo(smoothX, smoothY);
        ctx.lineTo(smoothX + cLen, smoothY);
        // Pojok kanan atas
        ctx.moveTo(smoothX + smoothW - cLen, smoothY);
        ctx.lineTo(smoothX + smoothW);
        ctx.lineTo(smoothX + smoothW, smoothY + cLen);
        // Pojok kiri bawah
        ctx.moveTo(smoothX, smoothY + smoothH - cLen);
        ctx.lineTo(smoothX, smoothY + smoothH);
        ctx.lineTo(smoothX + cLen, smoothY + smoothH);
        // Pojok kanan bawah
        ctx.moveTo(smoothX + smoothW - cLen, smoothY + smoothH);
        ctx.lineTo(smoothX + smoothW);
        ctx.lineTo(smoothX + smoothW, smoothY + smoothH - cLen);
        ctx.stroke();
        ctx.lineWidth = lineWidth;
      }
      ctx.shadowBlur = 0;

      // Label background & text kontras tinggi
      const textMetrics = ctx.measureText(labelText);
      const paddingX = (isSmallObj ? 5 : 8) * scale;
      const paddingY = (isSmallObj ? 2 : 4) * scale;
      const labelHeight = itemFontSize + (paddingY * 2);
      const labelWidth = textMetrics.width + (paddingX * 2);

      let labelY = smoothY - labelHeight;
      if (labelY < 0) {
        labelY = smoothY;
      }
      let labelX = smoothX;
      if (labelX + labelWidth > canvas.width) {
        labelX = Math.max(0, canvas.width - labelWidth);
      }

      ctx.fillStyle = color;
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(labelText, labelX + paddingX, labelY + paddingY);
    });

    smoothedBoxesMap = currentMap;
  }

  // =========================================================================
  // 5. Panel Statistik Live (Throttled DOM Anti-Layout-Thrashing & High Contrast)
  // =========================================================================
  function updateLiveStats(predictions) {
    const total = predictions.length;
    if (totalObjectsCount) {
      totalObjectsCount.textContent = `${total} Objek`;
    }

    if (total === 0) {
      resetStatsPanel();
      return;
    }

    // Batasi frekuensi pembaruan DOM (maks 4x per detik) agar animasi tetap 60 FPS
    const now = performance.now();
    if (now - lastStatsUpdate < STATS_THROTTLE_MS) {
      return;
    }
    lastStatsUpdate = now;

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
        dimensionTag = `<span class="item-dimension" style="color: #00E5FF; font-weight: 700;">${wCm}×${hCm} cm</span>`;
      }

      html += `
        <div class="detection-item telemetry-box" style="border-left-color: ${color}">
          <div class="item-left">
            <span class="item-name hud-live-stats" style="color: #FFFFFF; font-weight: 700;">${translatedName}</span>
            <span class="item-count-badge" style="color: #00E5FF; font-weight: 700;">x${data.count}</span>
            ${dimensionTag}
          </div>
          <div class="item-right">
            <span class="item-score" style="color: #00E676; font-weight: 700;">${percent}%</span>
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
  // 7. Pengiriman Snapshot ke Backend API (/api/snapshot/save)
  // =========================================================================
  async function handleSaveSnapshot(isCctv = false) {
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
    btnSnapshot.innerHTML = isCctv ? '📸 CCTV Mengambil...' : '⏳ Menyimpan...';

    try {
      const response = await fetch(getApiUrl('/api/snapshot/save'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          image: base64Image,
          objects: objectsList,
          is_cctv: isCctv
        })
      });

      const result = await response.json();

      if (response.ok && (result.status === 'success' || result.status === 'ok')) {
        let msg = `Snapshot berhasil disimpan (${result.filename})`;
        if (result.telegram_sent) {
          msg += ' ✈️ Foto terkirim ke Telegram!';
        }
        showToast(msg, 'success');
        loadHistory();
        return result;
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
  // 8. Integrasi Smart LLM Router (/api/ai/analyze)
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
    const provider = llmProviderSelect ? llmProviderSelect.value : 'gemini';

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

    const activeMissionPrompt = (window.BenggalaMissions && typeof window.BenggalaMissions.getActivePrompt === 'function')
      ? window.BenggalaMissions.getActivePrompt()
      : '';

    // Deteksi label kustom dan kategori misi (Task 16C Visual Few-Shot)
    let customLabel = '';
    const activeTarget = (typeof window.getActiveTargetPrediction === 'function' ? window.getActiveTargetPrediction() : null)
      || (currentPredictions && currentPredictions[0]) || null;
    if (activeTarget) {
      if (activeTarget.customLabel) {
        customLabel = String(activeTarget.customLabel).replace(/^★\s*/, '').trim();
      } else if (activeTarget.class && String(activeTarget.class).startsWith('★')) {
        customLabel = String(activeTarget.class).replace(/^★\s*/, '').trim();
      }
    }

    let missionCategory = '';
    if (window.BenggalaMissions && typeof window.BenggalaMissions.getActiveMission === 'function') {
      const activeMission = window.BenggalaMissions.getActiveMission();
      if (activeMission && activeMission.id) {
        missionCategory = activeMission.id;
      }
    }

    const requestPayload = {
      provider: provider,
      objects: detectedObjects
    };

    if (customLabel) {
      requestPayload.custom_label = customLabel;
    }
    if (missionCategory) {
      requestPayload.mission_category = missionCategory;
    }

    if (activeMissionPrompt) {
      requestPayload.mission_prompt = activeMissionPrompt;
    }

    if (compressedImage) {
      requestPayload.image = compressedImage;
    }

    try {
      const response = await fetch(getApiUrl('/api/ai/analyze'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(requestPayload)
      });

      const result = await response.json();

      if (response.ok && (result.status === 'success' || result.status === 'ok')) {
        if (llmProviderBadge) {
          llmProviderBadge.textContent = result.provider_used || provider;
        }
        if (llmFallbackBadge) {
          llmFallbackBadge.style.display = result.fallback_triggered ? 'inline-block' : 'none';
        }
        if (llmAnalysisContent) {
          llmAnalysisContent.textContent = result.analysis;
        }

        const llmReferencesBadge = document.getElementById('llmReferencesBadge');
        if (llmReferencesBadge) {
          if (result.references_used && result.references_used > 0) {
            const labelsList = (result.reference_labels || []).join(', ');
            llmReferencesBadge.textContent = `🧠 Referensi DB: ${result.references_used} foto (${labelsList})`;
            llmReferencesBadge.style.display = 'inline-block';
          } else {
            llmReferencesBadge.style.display = 'none';
          }
        }

        // Siapkan data kartu Target Dossier (Task 12B)
        const currentMissionProfile = (window.BenggalaMissions && typeof window.BenggalaMissions.getActiveMission === 'function')
          ? window.BenggalaMissions.getActiveMission()
          : { name: 'Umum' };
        
        const primaryObj = detectedObjects[0] || { name: 'Objek', ukuran: 'Mode Piksel' };
        const dimensionsText = primaryObj.ukuran || (pixelsPerCm ? 'Terkalibrasi' : 'Mode Piksel');

        lastDossierData = {
          imageDataUrl: captureMergedSnapshot() || compressedImage,
          objectLabel: primaryObj.name || primaryObj.class_en || 'Objek',
          dimensions: dimensionsText,
          missionName: currentMissionProfile.name || 'Umum',
          provider: result.provider_used || provider,
          analysisText: result.analysis || '',
          timestamp: new Date().toLocaleString('id-ID', { hour12: false })
        };

        if (btnOpenDossier) {
          btnOpenDossier.style.display = 'inline-flex';
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
  // Pipeline AI Otomatis (Auto-Lock -> Snapshot -> Analisis AI -> Simpan DB & Galeri)
  // =========================================================================
  let isAutoLockProcessing = false;

  async function handleAutoLockPipeline(lockedObj) {
    if (isAutoLockProcessing) return;
    isAutoLockProcessing = true;

    const objName = typeof window.translateLabel === 'function' ? window.translateLabel(lockedObj.class) : lockedObj.class;
    showToast(`🎯 Target [${objName}] terkunci! Menjalankan snapshot otomatis...`, 'info');

    try {
      // 1. Eksekusi Snapshot Otomatis
      const snapResult = await handleSaveSnapshot(false);
      const logId = (snapResult && snapResult.log_id) ? snapResult.log_id : 0;

      // 2. Eksekusi Analisis Vision AI Otomatis (dengan flag isAutoLock = true)
      showToast(`🤖 Memulai analisis AI otomatis untuk [${objName}]...`, 'info');
      await executeAiAnalysisWithLog(logId, [lockedObj], true);

      showToast(`✅ Snapshot & Analisis [${objName}] berhasil dikirim!`, 'success');
    } catch (err) {
      console.warn('Pipeline Auto-Lock gagal:', err);
      showToast('⚠️ Gagal mengirim analisis otomatis.', 'error');
    } finally {
      isAutoLockProcessing = false;
      // Kembalikan fokus ke mode jelajah bebas setelah snapshot & analisis terkirim
      setTimeout(() => {
        resetCameraFocus();
      }, 1500);
    }
  }

  async function executeAiAnalysisWithLog(logId = 0, objectsToAnalyze = null, isAutoLock = false) {
    const csrfToken = getCsrfToken();
    const provider = llmProviderSelect ? llmProviderSelect.value : 'gemini';
    const targetObjects = objectsToAnalyze || currentPredictions;

    const detectedObjects = targetObjects.map(p => {
      const objItem = {
        name: typeof window.translateLabel === 'function' ? window.translateLabel(p.class) : p.class,
        class_en: p.class,
        score: p.score
      };
      if (pixelsPerCm && pixelsPerCm > 0 && p.bbox) {
        const wCm = (p.bbox[2] / pixelsPerCm).toFixed(1);
        const hCm = (p.bbox[3] / pixelsPerCm).toFixed(1);
        objItem.ukuran = `${wCm}x${hCm} cm`;
      }
      return objItem;
    });

    const compressedImage = isStreaming ? captureCompressedFrame() : null;
    const activeMissionPrompt = (window.BenggalaMissions && typeof window.BenggalaMissions.getActivePrompt === 'function')
      ? window.BenggalaMissions.getActivePrompt()
      : '';

    let customLabelAuto = '';
    if (targetPrediction) {
      if (targetPrediction.customLabel) {
        customLabelAuto = String(targetPrediction.customLabel).replace(/^★\s*/, '').trim();
      } else if (targetPrediction.class && String(targetPrediction.class).startsWith('★')) {
        customLabelAuto = String(targetPrediction.class).replace(/^★\s*/, '').trim();
      }
    }

    let missionCategoryAuto = '';
    if (window.BenggalaMissions && typeof window.BenggalaMissions.getActiveMission === 'function') {
      const activeMission = window.BenggalaMissions.getActiveMission();
      if (activeMission && activeMission.id) {
        missionCategoryAuto = activeMission.id;
      }
    }

    const requestPayload = {
      provider: provider,
      objects: detectedObjects,
      log_id: logId
    };
    if (customLabelAuto) {
      requestPayload.custom_label = customLabelAuto;
    }
    if (missionCategoryAuto) {
      requestPayload.mission_category = missionCategoryAuto;
    }
    if (activeMissionPrompt) {
      requestPayload.mission_prompt = activeMissionPrompt;
    }
    if (compressedImage) {
      requestPayload.image = compressedImage;
    }

    try {
      const response = await fetch(getApiUrl('/api/ai/analyze'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(requestPayload)
      });

      const result = await response.json();

      if (response.ok && (result.status === 'success' || result.status === 'ok')) {
        if (llmProviderBadge) {
          llmProviderBadge.textContent = result.provider_used || provider;
        }
        if (llmFallbackBadge) {
          llmFallbackBadge.style.display = result.fallback_triggered ? 'inline-block' : 'none';
        }
        if (llmAnalysisContent) {
          llmAnalysisContent.textContent = result.analysis;
        }

        const llmReferencesBadge = document.getElementById('llmReferencesBadge');
        if (llmReferencesBadge) {
          if (result.references_used && result.references_used > 0) {
            const labelsList = (result.reference_labels || []).join(', ');
            llmReferencesBadge.textContent = `🧠 Referensi DB: ${result.references_used} foto (${labelsList})`;
            llmReferencesBadge.style.display = 'inline-block';
          } else {
            llmReferencesBadge.style.display = 'none';
          }
        }

        showToast(`Analisis AI tersimpan ke galeri (${result.provider_used})!`, 'success');

        // Buka panel AI jika pengguna belum membuka panel lain
        if (window.BenggalaCockpit && typeof window.BenggalaCockpit.openPanel === 'function') {
          window.BenggalaCockpit.openPanel('ai');
        }

        // Muat ulang riwayat agar kartu di galeri langsung menampilkan analisis AI
        loadHistory();

        // Siapkan data kartu Target Dossier (Task 12B)
        const currentMissionProfile = (window.BenggalaMissions && typeof window.BenggalaMissions.getActiveMission === 'function')
          ? window.BenggalaMissions.getActiveMission()
          : { name: 'Umum' };
        
        const primaryObj = detectedObjects[0] || { name: 'Objek', ukuran: 'Mode Piksel' };
        const dimensionsText = primaryObj.ukuran || (pixelsPerCm ? 'Terkalibrasi' : 'Mode Piksel');

        lastDossierData = {
          imageDataUrl: captureMergedSnapshot() || compressedImage,
          objectLabel: primaryObj.name || primaryObj.class_en || 'Objek',
          dimensions: dimensionsText,
          missionName: currentMissionProfile.name || 'Umum',
          provider: result.provider_used || provider,
          analysisText: result.analysis || '',
          timestamp: new Date().toLocaleString('id-ID', { hour12: false })
        };

        if (btnOpenDossier) {
          btnOpenDossier.style.display = 'inline-flex';
        }

        // Khusus jika dipicu oleh Auto-Lock: otomatis buat kartu dossier dan buka modalnya ("WOW" effect)
        if (isAutoLock && window.BenggalaDossier && typeof window.BenggalaDossier.generateCard === 'function') {
          window.BenggalaDossier.generateCard(lastDossierData).then(() => {
            if (typeof window.BenggalaDossier.openModal === 'function') {
              window.BenggalaDossier.openModal();
            }
          });
        }
      } else {
        const errorMsg = result.message || 'Gagal memproses analisis AI.';
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('Error saat analisis AI otomatis:', err);
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
    if (window.BenggalaCockpit && typeof window.BenggalaCockpit.updateTelemetry === 'function') {
      window.BenggalaCockpit.updateTelemetry({
        predictions: currentPredictions,
        threshold: parseInt(val),
        pixelsPerCm: pixelsPerCm,
        isRunning: isStreaming,
        isCctv: window.BenggalaCCTV ? window.BenggalaCCTV.isActive : false
      });
    }
  });

  // Hubungkan tombol snapshot ke backend API
  btnSnapshot.addEventListener('click', handleSaveSnapshot);

  // Hubungkan tombol analisis LLM
  if (btnAnalyzeLLM) {
    btnAnalyzeLLM.addEventListener('click', handleAnalyzeLLM);
  }

  // Hubungkan tombol analisis warna HSV (Python Superpower Task PY06)
  const btnAnalyzeHsv = document.getElementById('btnAnalyzeHsv');
  const hsvQualityBadge = document.getElementById('hsvQualityBadge');

  if (btnAnalyzeHsv) {
    btnAnalyzeHsv.addEventListener('click', async () => {
      if (!isStreaming) {
        showToast('Aktifkan sensor optik / kamera terlebih dahulu.', 'error');
        return;
      }
      const csrfToken = getCsrfToken();
      const base64Image = captureMergedSnapshot();
      if (!base64Image) {
        showToast('Gagal menangkap frame video.', 'error');
        return;
      }

      btnAnalyzeHsv.disabled = true;
      const oldHtml = btnAnalyzeHsv.innerHTML;
      btnAnalyzeHsv.innerHTML = '⏳ Menghitung HSV...';

      try {
        const response = await fetch(getApiUrl('/api/python/hsv-color'), {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            image: base64Image
          })
        });

        const res = await response.json();
        if (response.ok && res.status === 'ok') {
          showToast(res.summary, 'success');
          if (hsvQualityBadge) {
            hsvQualityBadge.textContent = `🎨 ${res.dominant_color} (${res.quality_score}%)`;
            hsvQualityBadge.style.display = 'inline-block';
          }
          if (llmAnalysisContent) {
            const hsvBox = document.createElement('div');
            hsvBox.style.padding = '8px 12px';
            hsvBox.style.marginBottom = '10px';
            hsvBox.style.background = 'rgba(56, 189, 248, 0.1)';
            hsvBox.style.border = '1px solid rgba(56, 189, 248, 0.4)';
            hsvBox.style.borderRadius = '6px';
            hsvBox.style.fontSize = '0.85rem';
            hsvBox.style.color = '#e2e8f0';
            hsvBox.innerHTML = `<strong>🎨 Analisis Warna HSV (Python):</strong><br>${res.summary}<br><small style="color: #94a3b8;">H: ${res.hsv.h}° • S: ${res.hsv.s}% • V: ${res.hsv.v}%</small>`;
            llmAnalysisContent.prepend(hsvBox);
          }
        } else {
          showToast(res.message || 'Gagal menganalisis warna HSV.', 'error');
        }
      } catch (err) {
        console.error('Error saat analisis HSV:', err);
        showToast('Koneksi ke endpoint analisis HSV gagal.', 'error');
      } finally {
        btnAnalyzeHsv.disabled = false;
        btnAnalyzeHsv.innerHTML = oldHtml;
      }
    });
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
  // Kontrol Kecerahan Layar Monitor Utama
  // =========================================================================
  const cameraBrightnessSlider = document.getElementById('cameraBrightnessSlider');
  const cameraBrightnessVal = document.getElementById('cameraBrightnessVal');
  const btnBrightnessBoost = document.getElementById('btnBrightnessBoost');

  function applySavedBrightness() {
    let saved = localStorage.getItem('benggala_cam_brightness');
    // Jika belum diset atau sebelumnya 120%, sesuaikan ke 110% (-10% dari kecerahan sebelumnya)
    if (!saved || parseInt(saved, 10) >= 120) {
      saved = '110';
      localStorage.setItem('benggala_cam_brightness', '110');
    }
    if (cameraBrightnessSlider) cameraBrightnessSlider.value = saved;
    if (cameraBrightnessVal) cameraBrightnessVal.textContent = `${saved}%`;
    if (video) {
      const brightRatio = parseFloat(saved) / 100;
      video.style.filter = `brightness(${brightRatio}) contrast(1.02)`;
    }
  }

  if (cameraBrightnessSlider) {
    cameraBrightnessSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      if (cameraBrightnessVal) cameraBrightnessVal.textContent = `${val}%`;
      const brightRatio = parseFloat(val) / 100;
      if (video) {
        video.style.filter = `brightness(${brightRatio}) contrast(1.02)`;
      }
      localStorage.setItem('benggala_cam_brightness', val);
    });
  }

  // Tombol Cepat Kecerahan Layar (110% -> 125% -> 140%)
  if (btnBrightnessBoost) {
    btnBrightnessBoost.addEventListener('click', () => {
      const current = parseInt(localStorage.getItem('benggala_cam_brightness') || '110', 10);
      let next = 125;
      if (current <= 110) {
        next = 125;
      } else if (current < 140) {
        next = 140;
      } else {
        next = 110;
      }
      if (cameraBrightnessSlider) cameraBrightnessSlider.value = next;
      if (cameraBrightnessVal) cameraBrightnessVal.textContent = `${next}%`;
      if (video) {
        video.style.filter = `brightness(${next / 100}) contrast(1.02)`;
      }
      localStorage.setItem('benggala_cam_brightness', next.toString());
      showToast(`☀️ Kecerahan Layar: ${next}%`, 'info');
    });
  }

  // Terapkan pengaturan kecerahan awal
  applySavedBrightness();

  // =========================================================================
  // Kontrol Orientasi Layar (Portrait 9:16 / Widescreen 16:9 / Auto)
  // =========================================================================
  const btnOrientation = document.getElementById('btnOrientation');
  const cameraOrientationVal = document.getElementById('cameraOrientationVal');
  const orientBtns = document.querySelectorAll('.btn-orient');

  const orientIcons = {
    portrait: '📱',
    widescreen: '🖥️',
    auto: '🔄'
  };

  const orientLabels = {
    portrait: 'Portrait (9:16 / Tegak)',
    widescreen: 'Widescreen (16:9 / Lebar)',
    auto: 'Auto (Sensor Asli / Proporsional)'
  };

  function setCameraOrientation(mode, restartStream = false) {
    if (!['portrait', 'widescreen', 'auto'].includes(mode)) {
      mode = 'portrait';
    }
    cameraOrientation = mode;
    localStorage.setItem('benggala_cam_orientation', mode);

    if (btnOrientation) {
      btnOrientation.textContent = orientIcons[mode] || '📱';
      btnOrientation.title = `Orientasi Layar: ${orientLabels[mode]} (Klik untuk ganti)`;
    }

    if (cameraOrientationVal) {
      cameraOrientationVal.textContent = orientLabels[mode] || 'Portrait (9:16 / Tegak)';
    }

    orientBtns.forEach(btn => {
      if (btn.getAttribute('data-orient') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    syncCanvasDimensions();

    showToast(`📐 Orientasi Layar: ${orientLabels[mode]}`, 'info');

    // Jika kamera sedang streaming dan restartStream diminta
    if (restartStream && isStreaming) {
      startCamera();
    }
  }

  // Terapkan status awal orientasi
  if (btnOrientation) {
    btnOrientation.textContent = orientIcons[cameraOrientation] || '📱';
    btnOrientation.title = `Orientasi Layar: ${orientLabels[cameraOrientation]} (Klik untuk ganti)`;

    btnOrientation.addEventListener('click', () => {
      let nextMode = 'portrait';
      if (cameraOrientation === 'portrait') {
        nextMode = 'widescreen';
      } else if (cameraOrientation === 'widescreen') {
        nextMode = 'auto';
      } else {
        nextMode = 'portrait';
      }
      setCameraOrientation(nextMode, false);
    });
  }

  if (cameraOrientationVal) {
    cameraOrientationVal.textContent = orientLabels[cameraOrientation] || 'Portrait (9:16 / Tegak)';
  }

  orientBtns.forEach(btn => {
    if (btn.getAttribute('data-orient') === cameraOrientation) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-orient');
      if (mode) {
        setCameraOrientation(mode, false);
      }
    });
  });

  // =========================================================================
  // Kontrol Mode Framing Layar (Proporsional Fit vs Layar Penuh Fill)
  // =========================================================================
  const btnDisplayMode = document.getElementById('btnDisplayMode');
  const cameraDisplayModeVal = document.getElementById('cameraDisplayModeVal');
  const displayModeBtns = document.querySelectorAll('.btn-display-mode');

  function setCameraDisplayMode(mode) {
    if (!['fit', 'fill'].includes(mode)) {
      mode = 'fit';
    }
    cameraDisplayMode = mode;
    localStorage.setItem('benggala_cam_display_mode', mode);

    if (btnDisplayMode) {
      btnDisplayMode.textContent = (mode === 'fit') ? '⛶' : '🔲';
      btnDisplayMode.title = (mode === 'fit')
        ? 'Mode Framing: Proporsional (Fit) • Seluruh gambar utuh tanpa terpotong (Klik untuk Layar Penuh)'
        : 'Mode Framing: Layar Penuh (Fill) • Mengisi seluruh area panggung (Klik untuk Proporsional)';
    }

    if (cameraDisplayModeVal) {
      cameraDisplayModeVal.textContent = (mode === 'fit') ? 'Proporsional (Fit)' : 'Layar Penuh (Fill)';
    }

    displayModeBtns.forEach(btn => {
      if (btn.getAttribute('data-mode') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    syncCanvasDimensions();
    showToast(`🖼️ Framing: ${(mode === 'fit' ? 'Proporsional (Fit)' : 'Layar Penuh (Fill)')}`, 'info');
  }

  if (btnDisplayMode) {
    btnDisplayMode.textContent = (cameraDisplayMode === 'fit') ? '⛶' : '🔲';
    btnDisplayMode.title = (cameraDisplayMode === 'fit')
      ? 'Mode Framing: Proporsional (Fit) • Seluruh gambar utuh tanpa terpotong (Klik untuk Layar Penuh)'
      : 'Mode Framing: Layar Penuh (Fill) • Mengisi seluruh area panggung (Klik untuk Proporsional)';

    btnDisplayMode.addEventListener('click', () => {
      const nextMode = (cameraDisplayMode === 'fit') ? 'fill' : 'fit';
      setCameraDisplayMode(nextMode);
    });
  }

  if (cameraDisplayModeVal) {
    cameraDisplayModeVal.textContent = (cameraDisplayMode === 'fit') ? 'Proporsional (Fit)' : 'Layar Penuh (Fill)';
  }

  displayModeBtns.forEach(btn => {
    if (btn.getAttribute('data-mode') === cameraDisplayMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      if (mode) {
        setCameraDisplayMode(mode);
      }
    });
  });

  // =========================================================================
  // Event Listeners Smooth Zoom (Slider, Tombol Step, Mouse Wheel, Touch Pinch)
  // =========================================================================
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      applyCameraZoom(parseFloat(e.target.value));
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      applyCameraZoom(currentZoom + 0.1);
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      applyCameraZoom(currentZoom - 0.1);
    });
  }

  if (zoomValue) {
    zoomValue.addEventListener('click', () => {
      applyCameraZoom(1.0);
      showToast('Zoom di-reset ke 1.0x', 'info');
    });
  }

  // =========================================================================
  // Pemilihan Perangkat Kamera Spesifik (Multi-Kamera Belakang & Depan)
  // =========================================================================
  const cameraDeviceSelect = document.getElementById('cameraDeviceSelect');
  if (cameraDeviceSelect) {
    cameraDeviceSelect.addEventListener('change', async (e) => {
      const devId = e.target.value;
      selectedCameraDeviceId = devId;
      if (devId) {
        localStorage.setItem('benggala_selected_camera_id', devId);
        const camObj = detectedCameras.find(c => c.deviceId === devId);
        showToast(`📷 Memilih ${camObj ? camObj.friendlyName : 'Kamera'}...`, 'info');
      } else {
        localStorage.removeItem('benggala_selected_camera_id');
        showToast('📷 Kamera diatur ke Otomatis (Default Belakang)', 'info');
      }

      if (isStreaming) {
        await startCamera();
      }
    });
  }

  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
    navigator.mediaDevices.addEventListener('devicechange', refreshCameraDevices);
  }

  // =========================================================================
  // Triple-Click / Triple-Tap untuk Mulai Kamera Cepat di Landing Page
  // =========================================================================
  let landingTapCount = 0;
  let landingTapTimer = null;
  const TRIPLE_CLICK_INTERVAL = 850; // ms

  function handleLandingTripleTap() {
    landingTapCount++;
    const badge = document.getElementById('placeholderTripleClickBadge');

    if (badge) {
      badge.classList.add('active-pulse');
      setTimeout(() => badge.classList.remove('active-pulse'), 180);
    }

    if (landingTapTimer) {
      clearTimeout(landingTapTimer);
    }

    if (landingTapCount === 1) {
      if (badge) badge.innerHTML = '<span class="badge-icon">⚡</span> Klik 3x untuk Mulai Cepat (1/3)';
    } else if (landingTapCount === 2) {
      if (badge) badge.innerHTML = '<span class="badge-icon">⚡</span> Klik 3x untuk Mulai Cepat (2/3)';
    } else if (landingTapCount >= 3) {
      landingTapCount = 0;
      if (badge) badge.innerHTML = '<span class="badge-icon">🚀</span> Mengaktifkan Sensor... (3/3)';
      showToast('🚀 Mengaktifkan sensor kamera via Klik 3x...', 'success');
      startCamera();
      return;
    }

    landingTapTimer = setTimeout(() => {
      landingTapCount = 0;
      if (badge) badge.innerHTML = '<span class="badge-icon">⚡</span> Klik 3x Layar untuk Mulai Cepat';
    }, TRIPLE_CLICK_INTERVAL);
  }

  const placeholderTripleClickBadge = document.getElementById('placeholderTripleClickBadge');
  if (placeholderTripleClickBadge) {
    placeholderTripleClickBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLandingTripleTap();
    });
  }

  // Dukungan Mouse Wheel Zoom (PC) pada area Viewport
  const viewportEl = document.querySelector('.cockpit-viewport');
  if (viewportEl) {
    viewportEl.addEventListener('wheel', (e) => {
      if (e.target.closest('.cockpit-panel') || e.target.closest('.cockpit-dock') || e.target.closest('#hudZoomControl')) {
        return;
      }
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      applyCameraZoom(currentZoom + delta);
    }, { passive: false });

    // Dukungan Pinch-to-Zoom 2 Jari (HP)
    let initialPinchDist = null;
    let initialPinchZoom = 1.0;

    // Deteksi Double-Tap Aman (Task 15 - HP & PC)
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    viewportEl.addEventListener('pointerdown', (e) => {
      // 1. Abaikan jika target klik berada di elemen kontrol, dock, panel, atau tombol
      if (
        e.target.closest('.cockpit-panel') ||
        e.target.closest('.cockpit-dock') ||
        e.target.closest('.hud-header') ||
        e.target.closest('#hudZoomControl') ||
        e.target.closest('#btnResetFocus') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('select') ||
        e.target.closest('.cockpit-modal') ||
        e.target.closest('.hud-telemetry') ||
        e.target.closest('.hud-radar') ||
        e.target.closest('.dossier-overlay') ||
        e.target.closest('.roadmap-overlay')
      ) {
        return;
      }

      // 2. WAJIB cek e.isPrimary (1 jari saja) dan klik kiri jika mouse
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
        return;
      }

      // 3. Jika kamera belum aktif (!isStreaming), pantau triple-click untuk mulai kamera di landing page
      if (!isStreaming) {
        handleLandingTripleTap();
        return;
      }

      const now = performance.now();
      const timeDiff = now - lastTapTime;
      const dist = Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY);

      if (timeDiff > 0 && timeDiff <= 350 && dist <= 35) {
        // Double-tap terdeteksi!
        lastTapTime = 0;
        handleDoubleTapFocus(e.clientX, e.clientY);
      } else {
        lastTapTime = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
      }
    });

    viewportEl.addEventListener('touchstart', (e) => {
      // Jika sentuhan lebih dari 1 jari (pinch-to-zoom), batalkan timer double-tap
      if (e.touches.length > 1) {
        lastTapTime = 0;
      }
      if (e.touches.length === 2 && !e.target.closest('.cockpit-panel')) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
        initialPinchZoom = currentZoom;
      }
    }, { passive: true });

    viewportEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDist && !e.target.closest('.cockpit-panel')) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const scaleRatio = currentDist / initialPinchDist;
        applyCameraZoom(initialPinchZoom * scaleRatio);
      }
    }, { passive: true });

    viewportEl.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        initialPinchDist = null;
      }
    }, { passive: true });
  }

  // Tombol Reset Fokus Kamera (Task 15)
  if (btnResetFocus) {
    btnResetFocus.addEventListener('click', (e) => {
      e.stopPropagation();
      resetCameraFocus();
      showToast('🎯 Fokus dikembalikan ke tengah', 'info');
    });
  }

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

      if (window.BenggalaCockpit && typeof window.BenggalaCockpit.updateTelemetry === 'function') {
        window.BenggalaCockpit.updateTelemetry({
          predictions: currentPredictions,
          threshold: Math.round(minConfidence * 100),
          pixelsPerCm: pixelsPerCm,
          isRunning: isStreaming,
          isCctv: window.BenggalaCCTV.isActive
        });
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

  // =========================================================================
  // 11. Modal Pengaturan & Notifikasi Telegram
  // =========================================================================
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');

  const setLlmProvider = document.getElementById('setLlmProvider');
  const setDeepSeekKey = document.getElementById('setDeepSeekKey');
  const setGeminiKey = document.getElementById('setGeminiKey');
  const setTelegramEnabled = document.getElementById('setTelegramEnabled');
  const setTelegramToken = document.getElementById('setTelegramToken');
  const setTelegramChatId = document.getElementById('setTelegramChatId');

  async function loadSettings() {
    try {
      const res = await fetch(getApiUrl('/api/settings'), {
        method: 'GET',
        credentials: 'same-origin'
      });
      const json = await res.json();
      const settingsData = json.settings || json.data;
      if ((json.status === 'success' || json.status === 'ok') && settingsData) {
        const d = settingsData;
        if (setLlmProvider && (d.llm_default_provider || d.llm_provider)) {
          setLlmProvider.value = d.llm_default_provider || d.llm_provider;
        }
        if (llmProviderSelect && (d.llm_default_provider || d.llm_provider)) {
          llmProviderSelect.value = d.llm_default_provider || d.llm_provider;
        }
        if (setDeepSeekKey && d.deepseek_api_key) {
          setDeepSeekKey.value = d.deepseek_api_key;
        }
        if (setGeminiKey && d.gemini_api_key) {
          setGeminiKey.value = d.gemini_api_key;
        }
        if (setTelegramEnabled) {
          setTelegramEnabled.checked = (d.telegram_enabled === '1');
        }
        if (setTelegramToken && d.telegram_bot_token) {
          setTelegramToken.value = d.telegram_bot_token;
        }
        if (setTelegramChatId && d.telegram_chat_id) {
          setTelegramChatId.value = d.telegram_chat_id;
        }
        if (d.detection_threshold || d.confidence_threshold) {
          const tVal = parseInt(d.detection_threshold || d.confidence_threshold);
          if (!isNaN(tVal) && thresholdSlider) {
            thresholdSlider.value = tVal;
            if (thresholdVal) thresholdVal.textContent = `${tVal}%`;
            minConfidence = tVal / 100;
          }
        }
      }
    } catch (e) {
      console.warn('Gagal memuat pengaturan database:', e);
    }
  }

  async function saveSettings() {
    if (!btnSaveSettings) return;

    const csrfToken = getCsrfToken();
    btnSaveSettings.disabled = true;
    const oldText = btnSaveSettings.innerHTML;
    btnSaveSettings.innerHTML = '⏳ Menyimpan...';

    const payload = {
      action: 'save',
      settings: {
        llm_default_provider: setLlmProvider ? setLlmProvider.value : 'deepseek',
        deepseek_api_key: setDeepSeekKey ? setDeepSeekKey.value : '',
        gemini_api_key: setGeminiKey ? setGeminiKey.value : '',
        telegram_enabled: setTelegramEnabled && setTelegramEnabled.checked ? '1' : '0',
        telegram_bot_token: setTelegramToken ? setTelegramToken.value : '',
        telegram_chat_id: setTelegramChatId ? setTelegramChatId.value : ''
      }
    };

    try {
      const res = await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (res.ok && (json.status === 'success' || json.status === 'ok')) {
        showToast('Pengaturan sistem & Telegram berhasil disimpan!', 'success');
        if (settingsModal) settingsModal.style.display = 'none';
        loadSettings();
      } else {
        showToast(json.message || 'Gagal menyimpan pengaturan.', 'error');
      }
    } catch (err) {
      console.error('Error saat menyimpan pengaturan:', err);
      showToast('Koneksi ke /api/settings gagal.', 'error');
    } finally {
      btnSaveSettings.disabled = false;
      btnSaveSettings.innerHTML = oldText;
    }
  }

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      loadSettings();
      if (settingsModal) settingsModal.style.display = 'flex';
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      if (settingsModal) settingsModal.style.display = 'none';
    });
  }

  if (btnCancelSettings) {
    btnCancelSettings.addEventListener('click', () => {
      if (settingsModal) settingsModal.style.display = 'none';
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', saveSettings);
  }

  // =========================================================================
  // 12. Galeri Riwayat Deteksi & Export CSV (Task 09A)
  // =========================================================================
  async function loadHistory() {
    if (!historyGrid) return;

    try {
      const response = await fetch(getApiUrl('/api/history'), {
        method: 'GET',
        credentials: 'same-origin'
      });

      const result = await response.json();
      if (!response.ok || (result.status !== 'success' && result.status !== 'ok')) {
        console.error('Gagal memuat riwayat:', result.message);
        return;
      }

      const list = result.data || [];
      if (historyCountBadge) {
        historyCountBadge.textContent = `${list.length} Riwayat`;
      }

      historyGrid.innerHTML = '';

      if (list.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.style.gridColumn = '1 / -1';
        emptyDiv.style.padding = '2rem';
        
        const iconSpan = document.createElement('span');
        iconSpan.textContent = '📂';
        
        const pTag = document.createElement('p');
        pTag.textContent = 'Belum ada riwayat snapshot tersimpan.';
        
        emptyDiv.appendChild(iconSpan);
        emptyDiv.appendChild(pTag);
        historyGrid.appendChild(emptyDiv);
        return;
      }

      list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';

        // 1. Thumbnail Wrapper
        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'history-thumb-wrapper';

        const rawPath = item.file_path || '';
        const cleanPath = rawPath.startsWith('/') ? rawPath : ('/' + rawPath);
        const formattedPath = getApiUrl(cleanPath);
        const img = document.createElement('img');
        img.className = 'history-thumb';
        img.src = formattedPath;
        img.alt = item.filename;
        img.loading = 'lazy';
        img.onerror = () => {
          img.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = 'history-thumb-placeholder';
          placeholder.textContent = '🖼️ Gambar tidak ditemukan';
          thumbWrapper.appendChild(placeholder);
        };
        thumbWrapper.appendChild(img);

        // Time badge
        const timeBadge = document.createElement('span');
        timeBadge.className = 'history-time-badge';
        timeBadge.textContent = `🕒 ${item.created_at}`;
        thumbWrapper.appendChild(timeBadge);

        // CCTV badge jika is_cctv
        if (item.is_cctv) {
          const cctvBadge = document.createElement('span');
          cctvBadge.className = 'history-cctv-badge';
          cctvBadge.textContent = '🚨 CCTV';
          thumbWrapper.appendChild(cctvBadge);
        }

        card.appendChild(thumbWrapper);

        // 2. Card Body
        const cardBody = document.createElement('div');
        cardBody.className = 'history-card-body';

        // Filename
        const fnameDiv = document.createElement('div');
        fnameDiv.className = 'history-filename';
        fnameDiv.title = item.filename;
        fnameDiv.textContent = item.filename;
        cardBody.appendChild(fnameDiv);

        // Objects summary (Anti-XSS via textContent)
        const objSummaryDiv = document.createElement('div');
        objSummaryDiv.className = 'history-objects-summary';

        if (Array.isArray(item.detected_objects) && item.detected_objects.length > 0) {
          item.detected_objects.forEach(obj => {
            const tag = document.createElement('span');
            tag.className = 'history-obj-tag';
            let label = '';
            if (typeof obj === 'string') {
              label = obj;
            } else if (obj && typeof obj === 'object') {
              label = obj.name_id || obj.name || obj.class || 'Objek';
              if (obj.ukuran) {
                label += ` (${obj.ukuran})`;
              }
            }
            tag.textContent = label;
            objSummaryDiv.appendChild(tag);
          });
        } else if (typeof item.detected_objects === 'string' && item.detected_objects.trim() !== '') {
          const tag = document.createElement('span');
          tag.className = 'history-obj-tag';
          tag.textContent = item.detected_objects;
          objSummaryDiv.appendChild(tag);
        } else {
          const noObj = document.createElement('span');
          noObj.className = 'history-no-obj';
          noObj.textContent = 'Tidak ada objek';
          objSummaryDiv.appendChild(noObj);
        }
        cardBody.appendChild(objSummaryDiv);

        // AI Provider & Analysis jika ada
        if (item.ai_provider && item.analysis_result) {
          const aiBox = document.createElement('div');
          aiBox.className = 'history-ai-box';
          aiBox.title = `${item.ai_provider.toUpperCase()}: ${item.analysis_result}`;
          aiBox.textContent = `🤖 [${item.ai_provider.toUpperCase()}]: ${item.analysis_result}`;
          cardBody.appendChild(aiBox);
        }

        card.appendChild(cardBody);

        // 3. Card Footer
        const cardFooter = document.createElement('div');
        cardFooter.className = 'history-card-footer';

        // View image link
        const viewLink = document.createElement('a');
        viewLink.className = 'btn-view-image';
        viewLink.href = formattedPath;
        viewLink.target = '_blank';
        viewLink.rel = 'noopener noreferrer';
        viewLink.textContent = '🔍 Lihat Foto';
        cardFooter.appendChild(viewLink);

        // PDF Report link (Task PY06)
        const pdfLink = document.createElement('a');
        pdfLink.className = 'btn-report-pdf';
        pdfLink.href = getApiUrl(`/api/python/report-pdf/${item.id}`);
        pdfLink.target = '_blank';
        pdfLink.rel = 'noopener noreferrer';
        pdfLink.textContent = '📄 PDF';
        pdfLink.title = 'Unduh Laporan Forensik PDF';
        cardFooter.appendChild(pdfLink);

        // Delete button
        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn-delete-history';
        btnDelete.textContent = '🗑️ Hapus';
        btnDelete.title = 'Hapus riwayat dan foto ini';
        btnDelete.addEventListener('click', async () => {
          if (!confirm(`Hapus foto ${item.filename} dan riwayatnya secara permanen?`)) {
            return;
          }
          btnDelete.disabled = true;
          btnDelete.textContent = '⏳';
          await deleteHistoryItem(item.id);
        });
        cardFooter.appendChild(btnDelete);

        card.appendChild(cardFooter);

        historyGrid.appendChild(card);
      });

    } catch (err) {
      console.error('Error saat mengambil riwayat deteksi:', err);
      showToast('Gagal memuat galeri riwayat.', 'error');
    }
  }

  async function deleteHistoryItem(id) {
    try {
      const csrfToken = getCsrfToken();
      const response = await fetch(getApiUrl('/api/history/delete'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          id: id
        })
      });

      const result = await response.json();
      if (response.ok && (result.status === 'success' || result.status === 'ok')) {
        showToast('Foto dan riwayat berhasil dihapus.', 'success');
        loadHistory();
      } else {
        showToast(result.message || 'Gagal menghapus riwayat.', 'error');
      }
    } catch (err) {
      console.error('Error saat menghapus riwayat:', err);
      showToast('Gagal terhubung ke server untuk menghapus riwayat.', 'error');
    }
  }

  // Event Listeners untuk Refresh & Export CSV
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      window.location.href = getApiUrl('/api/history/export-csv');
    });
  }

  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', () => {
      btnRefreshHistory.disabled = true;
      const oldHtml = btnRefreshHistory.innerHTML;
      btnRefreshHistory.innerHTML = '⏳ Memuat...';
      loadHistory().finally(() => {
        btnRefreshHistory.disabled = false;
        btnRefreshHistory.innerHTML = oldHtml;
      });
    });
  }

  // =========================================================================
  // Integrasi Mode Misi AI Cepat & Suara Tunanetra (Task 12A)
  // =========================================================================
  if (missionButtons && missionButtons.length > 0) {
    missionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const missionKey = btn.getAttribute('data-mission');
        if (window.BenggalaMissions && typeof window.BenggalaMissions.setMission === 'function') {
          const profile = window.BenggalaMissions.setMission(missionKey);
          
          // Perbarui kelas active pada tombol misi
          missionButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          // Perbarui badge misi di HUD header
          if (missionBadge && profile) {
            missionBadge.textContent = profile.tag || profile.name.toUpperCase();
          }

          showToast(`Mode Misi: ${profile.name}`, 'info');
        }
      });
    });
  }

  if (btnVoiceCmd) {
    btnVoiceCmd.addEventListener('click', () => {
      if (window.BenggalaMissions && typeof window.BenggalaMissions.setVoiceEnabled === 'function') {
        window.BenggalaMissions.setVoiceEnabled(true);
      }
      if (window.BenggalaVoice) {
        if (currentPredictions && currentPredictions.length > 0) {
          const summary = currentPredictions.map(p => {
            const name = typeof window.translateLabel === 'function' ? window.translateLabel(p.class) : p.class;
            return name;
          }).join(', ');
          window.BenggalaVoice.speak(`Terdeteksi: ${summary}`);
        } else {
          window.BenggalaVoice.speak('Panduan suara aktif. Belum ada objek terdeteksi di depan kamera.');
        }
      }
      showToast('🔊 Panduan suara diaktifkan', 'info');
    });
  }

  if (btnStopSpeak) {
    btnStopSpeak.addEventListener('click', () => {
      if (window.BenggalaVoice && typeof window.BenggalaVoice.stop === 'function') {
        window.BenggalaVoice.stop();
      }
      if (window.BenggalaMissions && typeof window.BenggalaMissions.setVoiceEnabled === 'function') {
        window.BenggalaMissions.setVoiceEnabled(false);
      }
      showToast('🔇 Suara dihentikan & dibisukan', 'info');
    });
  }

  // =========================================================================
  // Integrasi Generator Kartu Laporan Forensik / Target Dossier (Task 12B)
  // =========================================================================
  if (btnOpenDossier) {
    btnOpenDossier.addEventListener('click', async () => {
      if (!lastDossierData) {
        showToast('Belum ada data analisis untuk kartu dossier.', 'info');
        return;
      }
      btnOpenDossier.disabled = true;
      const oldHtml = btnOpenDossier.innerHTML;
      btnOpenDossier.innerHTML = '⏳ Menyiapkan Dossier...';
      try {
        if (window.BenggalaDossier && typeof window.BenggalaDossier.generateCard === 'function') {
          await window.BenggalaDossier.generateCard(lastDossierData);
          if (typeof window.BenggalaDossier.openModal === 'function') {
            window.BenggalaDossier.openModal();
          }
        }
      } catch (e) {
        console.error('Error saat membuat kartu dossier:', e);
        showToast('Gagal membuat kartu dossier.', 'error');
      } finally {
        btnOpenDossier.disabled = false;
        btnOpenDossier.innerHTML = oldHtml;
      }
    });
  }

  if (btnCloseDossier) {
    btnCloseDossier.addEventListener('click', () => {
      if (window.BenggalaDossier && typeof window.BenggalaDossier.closeModal === 'function') {
        window.BenggalaDossier.closeModal();
      }
    });
  }

  if (dossierBackdrop) {
    dossierBackdrop.addEventListener('click', () => {
      if (window.BenggalaDossier && typeof window.BenggalaDossier.closeModal === 'function') {
        window.BenggalaDossier.closeModal();
      }
    });
  }

  if (btnDownloadDossier) {
    btnDownloadDossier.addEventListener('click', () => {
      if (window.BenggalaDossier && typeof window.BenggalaDossier.downloadCard === 'function') {
        window.BenggalaDossier.downloadCard();
      }
    });
  }

  if (btnShareDossier) {
    btnShareDossier.addEventListener('click', () => {
      if (window.BenggalaDossier && typeof window.BenggalaDossier.shareCard === 'function') {
        window.BenggalaDossier.shareCard();
      }
    });
  }

  // Expose global methods untuk modul Cockpit & Knowledge
  window.loadHistory = loadHistory;
  window.loadSettings = loadSettings;
  window.getActiveTargetPrediction = () => latestActivePrediction;

  // Muat pengaturan awal dari database
  loadSettings();

  // Muat galeri riwayat awal
  loadHistory();

  // Muat model saat halaman pertama kali dibuka
  loadModel();

  // Inisialisasi deteksi multi-kamera perangkat
  refreshCameraDevices();
});
