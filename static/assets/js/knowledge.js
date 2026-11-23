/**
 * BENGGALA OS // MODUL PENGETAHUAN & PELATIHAN OBJEK KUSTOM
 * Engine: TensorFlow.js MobileNet v2 (alpha: 0.5) + KNN Classifier + MySQL custom_objects
 * Real-Time Browser Inference (0% Beban CPU Server cPanel)
 */

(function () {
  'use strict';

  const BASE = (window.BASE_PATH || '').replace(/\/+$/, '');

  // State Internal Modul Knowledge
  let mobilenetModel = null;
  let classifier = null;
  let isModelReady = false;
  let isModelLoading = false;
  let knowledgeList = []; // Daftar sampel [{ id, label_name, category, notes, image_path, created_at, embedding }]
  let vectorMemory = {};  // Salinan vektor numerik in-memory: { [label_name]: [ [float, ...], ... ] }
  let isCapturingBurst = false;

  // DOM Elements Cache
  let panelEl = null;
  let statusTextEl = null;
  let statusDotEl = null;
  let labelInputEl = null;
  let categoryInputEl = null;
  let notesInputEl = null;
  let btnCaptureOne = null;
  let btnCaptureBurst = null;
  let listContainerEl = null;
  let itemsCountEl = null;

  // =========================================================================
  // 1. Helper Keamanan (CSRF) & UI Feedback (Toast)
  // =========================================================================
  function getCsrfToken() {
    if (window.CSRF_TOKEN) return window.CSRF_TOKEN;
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) return meta.content;
    return '';
  }

  function notifyUser(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[BenggalaKnowledge ${type.toUpperCase()}] ${message}`);
    }
  }

  function updateModelStatus(text, state = 'loading') {
    if (!statusTextEl) statusTextEl = document.getElementById('knowModelStatus');
    if (!statusDotEl) statusDotEl = document.getElementById('knowStatusDot');

    if (statusTextEl) {
      statusTextEl.textContent = text;
    }
    if (statusDotEl) {
      statusDotEl.className = 'know-status-dot ' + state;
    }
  }

  // =========================================================================
  // 2. Cosine Similarity Matematis Murni JS (Anti False-Positive KNN 1 Kelas)
  // =========================================================================
  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i];
      const b = vecB[i];
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // =========================================================================
  // 3. Inisialisasi MobileNet v2 & KNN Classifier
  // =========================================================================
  async function init() {
    if (isModelReady || isModelLoading) return;
    isModelLoading = true;
    updateModelStatus('Memuat MobileNet v2 (alpha 0.5)...', 'loading');

    try {
      if (typeof mobilenet === 'undefined' || typeof knnClassifier === 'undefined') {
        throw new Error('Library MobileNet atau KNN Classifier CDN belum siap.');
      }

      // Gunakan MobileNet v2 dengan alpha 0.5 (bobot ~2.5 MB, inferensi kilat di smartphone)
      mobilenetModel = await mobilenet.load({ version: 2, alpha: 0.5 });
      classifier = knnClassifier.create();
      isModelReady = true;
      isModelLoading = false;

      updateModelStatus('Model Siap', 'ready');
      console.log('MobileNet v2 & KNN Classifier Benggala OS siap.');

      // Muat seluruh dataset latih yang ada di MySQL
      await loadKnowledgeData();
    } catch (err) {
      console.error('Gagal memuat MobileNet / KNN Classifier:', err);
      isModelLoading = false;
      updateModelStatus('Gagal Memuat Model AI', 'error');
      notifyUser('Gagal memuat modul pengenalan objek kustom.', 'error');
    }
  }

  // =========================================================================
  // 4. Sinkronisasi Data Latih dari Backend MySQL (GET /api/knowledge/list)
  // =========================================================================
  async function loadKnowledgeData() {
    try {
      const res = await fetch(`${BASE}/api/knowledge/list?include_vectors=1`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.status === 'ok') {
        knowledgeList = json.data || [];
        rebuildClassifierFromData();
        renderKnowledgeList();
      }
    } catch (err) {
      console.warn('Gagal memuat pengetahuan objek dari MySQL:', err);
    }
  }

  /**
   * Mengisi ulang KNN Classifier dan vectorMemory in-memory dari knowledgeList
   */
  function rebuildClassifierFromData() {
    if (!classifier) return;

    // Bersihkan memori KNN sebelumnya
    classifier.clearAllClasses();
    vectorMemory = {};

    let sampleCount = 0;
    tf.tidy(() => {
      for (const item of knowledgeList) {
        const vec = item.embedding;
        if (Array.isArray(vec) && vec.length >= 128) {
          const tensor = tf.tensor1d(vec);
          classifier.addExample(tensor, item.label_name);

          if (!vectorMemory[item.label_name]) {
            vectorMemory[item.label_name] = [];
          }
          vectorMemory[item.label_name].push(vec);
          sampleCount++;
        }
      }
    });

    const classNames = Object.keys(vectorMemory);
    if (sampleCount > 0) {
      updateModelStatus(`Siap • ${classNames.length} Objek (${sampleCount} Sampel)`, 'ready');
    } else {
      updateModelStatus('Siap • 0 Objek Tersimpan', 'ready');
    }

    if (!itemsCountEl) itemsCountEl = document.getElementById('knowItemsCount');
    if (itemsCountEl) {
      itemsCountEl.textContent = `${sampleCount} Sampel (${classNames.length} Kelas)`;
    }
  }

  // =========================================================================
  // 5. Ekstraksi Area Objek (Reusable Offscreen Canvas 224x224 Anti-Leak)
  // =========================================================================
  const cachedCropCanvas = document.createElement('canvas');
  cachedCropCanvas.width = 224;
  cachedCropCanvas.height = 224;
  const cachedCropCtx = cachedCropCanvas.getContext('2d', { willReadFrequently: true });

  function getCropCanvas(videoEl, bbox) {
    const vw = videoEl.videoWidth || 640;
    const vh = videoEl.videoHeight || 480;

    let sx, sy, sw, sh;
    if (bbox && bbox.length === 4 && bbox[2] > 10 && bbox[3] > 10) {
      sx = Math.max(0, Math.min(vw - 1, bbox[0]));
      sy = Math.max(0, Math.min(vh - 1, bbox[1]));
      sw = Math.min(vw - sx, bbox[2]);
      sh = Math.min(vh - sy, bbox[3]);
    } else {
      // Potong 50% area tengah jika tidak ada bounding box aktif
      sw = Math.round(vw * 0.5);
      sh = Math.round(vh * 0.5);
      sx = Math.round((vw - sw) / 2);
      sy = Math.round((vh - sh) / 2);
    }

    cachedCropCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 224, 224);
    return cachedCropCanvas;
  }

  // =========================================================================
  // 6. Prediksi Real-Time Bounding Box (classifyBox) + Anti-False Positive
  // =========================================================================
  async function classifyBox(videoEl, bbox) {
    if (!isModelReady || !mobilenetModel || !classifier) return null;
    if (!videoEl || videoEl.readyState < 2) return null;

    const numClasses = classifier.getNumClasses();
    if (numClasses === 0) return null;

    const cropCanvas = getCropCanvas(videoEl, bbox);
    let match = null;
    let embeddingTensor = null;

    try {
      // Ekstrak fitur aktivasi embedding dari MobileNet v2 (inferensi true)
      embeddingTensor = mobilenetModel.infer(cropCanvas, true);

      // Jalankan klasifikasi KNN (Top-3 tetangga terdekat)
      const result = await classifier.predictClass(embeddingTensor, 3);
      const winningLabel = result.label;
      const knnConfidence = (result.confidences && result.confidences[winningLabel]) || 0;

      // Ambil nilai data tensor secara asynchronous tanpa memblokir thread WebGL GPU
      const currentVec = await embeddingTensor.data();

      // Hitung Cosine Similarity terhadap seluruh sampel kelas pemenang di memori
      let maxSim = 0;
      const storedSamples = vectorMemory[winningLabel] || [];
      for (let i = 0; i < storedSamples.length; i++) {
        const sim = cosineSimilarity(currentVec, storedSamples[i]);
        if (sim > maxSim) maxSim = sim;
      }

      // Validasi Ambang Batas: confidence >= 0.75 DAN similarity >= 0.68
      if (knnConfidence >= 0.75 && maxSim >= 0.68) {
        match = {
          label: winningLabel,
          confidence: knnConfidence,
          similarity: maxSim,
          isCustom: true
        };
      }
    } catch (err) {
      console.warn('Kesalahan saat classifyBox:', err);
    } finally {
      if (embeddingTensor) {
        embeddingTensor.dispose();
      }
    }

    return match;
  }

  // =========================================================================
  // 7. Simpan 1 Sampel Pelatihan ke Backend MySQL
  // =========================================================================
  async function captureAndSaveSingle(videoEl, bbox, customLabel, category = 'umum', notes = '') {
    if (!isModelReady || !mobilenetModel || !classifier) {
      throw new Error('Model MobileNet belum siap. Harap tunggu sebentar.');
    }

    const labelName = (customLabel || '').trim();
    if (!labelName || labelName.length < 2) {
      throw new Error('Nama label objek wajib diisi minimal 2 karakter.');
    }

    const cropCanvas = getCropCanvas(videoEl, bbox);
    const thumbnailDataUrl = cropCanvas.toDataURL('image/jpeg', 0.82);

    let embeddingVec = null;
    tf.tidy(() => {
      const embTensor = mobilenetModel.infer(cropCanvas, true);
      embeddingVec = Array.from(embTensor.dataSync());
    });

    const payload = {
      label_name: labelName,
      category: category || 'umum',
      notes: notes || '',
      image: thumbnailDataUrl,
      embedding: embeddingVec
    };

    const csrf = getCsrfToken();
    const res = await fetch(`${BASE}/api/knowledge/save`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Gagal menyimpan ke server (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (data.status === 'ok') {
      // Tambahkan langsung ke KNN Classifier aktif di browser
      tf.tidy(() => {
        const t = tf.tensor1d(embeddingVec);
        classifier.addExample(t, labelName);
      });

      if (!vectorMemory[labelName]) {
        vectorMemory[labelName] = [];
      }
      vectorMemory[labelName].push(embeddingVec);

      // Sisipkan item ke knowledgeList
      knowledgeList.unshift({
        id: data.id,
        label_name: labelName,
        category: category || 'umum',
        notes: notes || '',
        image_path: data.image_path,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        embedding: embeddingVec
      });

      rebuildClassifierFromData();
      renderKnowledgeList();
      return data;
    } else {
      throw new Error(data.message || 'Gagal menyimpan');
    }
  }

  // =========================================================================
  // 8. Latih 3 Sudut Otomatis (Burst Capture)
  // =========================================================================
  async function captureBurst(videoEl, bbox, customLabel, category = 'umum', notes = '') {
    if (isCapturingBurst) return;
    isCapturingBurst = true;

    if (!btnCaptureBurst) btnCaptureBurst = document.getElementById('btnCaptureBurstSample');
    if (!btnCaptureOne) btnCaptureOne = document.getElementById('btnCaptureOneSample');

    const originalText = btnCaptureBurst ? btnCaptureBurst.innerHTML : '';
    if (btnCaptureBurst) btnCaptureBurst.disabled = true;
    if (btnCaptureOne) btnCaptureOne.disabled = true;

    try {
      notifyUser('⚡ Memulai pelatihan 3 sudut: Putar objek secara perlahan...', 'info');

      for (let i = 1; i <= 3; i++) {
        if (btnCaptureBurst) {
          btnCaptureBurst.innerHTML = `📸 Sudut ${i}/3... Putar objek!`;
        }

        // Ambil target prediksi terkini di setiap jepretan
        const activePred = (typeof window.getActiveTargetPrediction === 'function')
          ? window.getActiveTargetPrediction()
          : null;
        const currentBbox = (activePred && activePred.bbox) ? activePred.bbox : bbox;

        await captureAndSaveSingle(videoEl, currentBbox, customLabel, category, notes);
        notifyUser(`✓ Sampel ${i}/3 tersimpan!`, 'success');

        if (i < 3) {
          // Jeda 600ms antar jepretan sambil objek diputar
          await new Promise(resolve => setTimeout(resolve, 600));
        }
      }

      notifyUser(`🎉 Sukses melatih 3 sudut untuk [${customLabel}]! Kamera langsung mengenali objek ini.`, 'success');
      if (labelInputEl) labelInputEl.value = '';
    } catch (err) {
      console.error('Error saat pelatihan burst:', err);
      notifyUser(`Gagal pelatihan: ${err.message}`, 'error');
    } finally {
      isCapturingBurst = false;
      if (btnCaptureBurst) {
        btnCaptureBurst.disabled = false;
        btnCaptureBurst.innerHTML = originalText || '⚡ Latih 3 Sudut (Otomatis)';
      }
      if (btnCaptureOne) {
        btnCaptureOne.disabled = false;
      }
    }
  }

  // =========================================================================
  // 9. Hapus Sampel Pelatihan (POST /api/knowledge/delete)
  // =========================================================================
  async function deleteSample(id) {
    if (!id) return;
    if (!confirm('Hapus sampel objek latih ini dari memori AI?')) return;

    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${BASE}/api/knowledge/delete`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf
        },
        body: JSON.stringify({ id: parseInt(id, 10) })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'ok') {
        notifyUser('Sampel objek latih berhasil dihapus.', 'info');
        await loadKnowledgeData();
      } else {
        throw new Error(data.message || 'Gagal menghapus');
      }
    } catch (err) {
      console.error('Gagal menghapus sampel:', err);
      notifyUser(`Gagal menghapus: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // 10. Render Daftar Objek Tersimpan di UI (#knowledgeListContainer)
  // =========================================================================
  function renderKnowledgeList() {
    if (!listContainerEl) listContainerEl = document.getElementById('knowledgeListContainer');
    if (!listContainerEl) return;

    if (!knowledgeList || knowledgeList.length === 0) {
      listContainerEl.innerHTML = '<div class="know-empty">Belum ada objek kustom yang dilatih. Masukkan nama objek dan klik tombol rekam di atas.</div>';
      return;
    }

    const html = knowledgeList.map(item => {
      const imgUrl = `${BASE}/${item.image_path}`.replace(/\/+/g, '/').replace(':/', '://');
      const categoryBadge = `<span class="know-badge know-badge-${item.category || 'umum'}">${item.category || 'umum'}</span>`;
      const notesSnippet = item.notes ? `<div class="know-item-notes" title="${escapeHtml(item.notes)}">📝 ${escapeHtml(item.notes)}</div>` : '';

      return `
        <div class="know-item-card" data-id="${item.id}">
          <img src="${imgUrl}" alt="${escapeHtml(item.label_name)}" class="know-item-thumb" onerror="this.style.opacity='0.3'">
          <div class="know-item-info">
            <div class="know-item-title-row">
              <span class="know-item-name">★ ${escapeHtml(item.label_name)}</span>
              ${categoryBadge}
            </div>
            ${notesSnippet}
            <div class="know-item-meta">${item.created_at || ''}</div>
          </div>
          <button type="button" class="btn-know-delete" data-id="${item.id}" title="Hapus Sampel">🗑️</button>
        </div>
      `;
    }).join('');

    listContainerEl.innerHTML = html;

    // Pasang event listener tombol hapus
    listContainerEl.querySelectorAll('.btn-know-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        deleteSample(id);
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // 11. Binding Event UI Panel & Tombol Pemicu
  // =========================================================================
  function bindUIEvents() {
    panelEl = document.getElementById('knowledgePanel');
    labelInputEl = document.getElementById('knowLabelInput');
    categoryInputEl = document.getElementById('knowCategoryInput');
    notesInputEl = document.getElementById('knowNotesInput');
    btnCaptureOne = document.getElementById('btnCaptureOneSample');
    btnCaptureBurst = document.getElementById('btnCaptureBurstSample');
    listContainerEl = document.getElementById('knowledgeListContainer');

    const btnOpen = document.getElementById('btnOpenKnowledge');
    const btnOpenHeader = document.getElementById('btnOpenKnowledgeHeader');
    const btnClose = document.getElementById('btnCloseKnowledge');

    function togglePanel() {
      if (!panelEl) panelEl = document.getElementById('knowledgePanel');
      if (!panelEl) return;

      const isHidden = panelEl.hidden || !panelEl.classList.contains('active');

      if (window.BenggalaCockpit && typeof window.BenggalaCockpit.openPanel === 'function') {
        if (isHidden) {
          window.BenggalaCockpit.openPanel('knowledge');
        } else {
          window.BenggalaCockpit.closeAllPanels();
        }
      } else {
        panelEl.hidden = !isHidden;
        panelEl.classList.toggle('active', isHidden);
      }

      if (isHidden && labelInputEl) {
        setTimeout(() => labelInputEl.focus(), 150);
      }
    }

    if (btnOpen) {
      btnOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
      });
    }

    if (btnOpenHeader) {
      btnOpenHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.BenggalaCockpit && typeof window.BenggalaCockpit.closeAllPanels === 'function') {
          window.BenggalaCockpit.closeAllPanels();
        } else if (panelEl) {
          panelEl.hidden = true;
          panelEl.classList.remove('active');
        }
      });
    }

    // Tombol 📸 Simpan 1 Sampel
    if (btnCaptureOne) {
      btnCaptureOne.addEventListener('click', async () => {
        const videoEl = document.getElementById('webcam');
        if (!videoEl || videoEl.readyState < 2) {
          notifyUser('Kamera belum aktif. Nyalakan kamera terlebih dahulu.', 'error');
          return;
        }

        const labelName = labelInputEl ? labelInputEl.value.trim() : '';
        if (!labelName || labelName.length < 2) {
          notifyUser('Harap isi Nama Objek Benar (minimal 2 karakter).', 'error');
          if (labelInputEl) labelInputEl.focus();
          return;
        }

        const category = categoryInputEl ? categoryInputEl.value : 'umum';
        const notes = notesInputEl ? notesInputEl.value.trim() : '';

        // Ambil target objek yang sedang dikunci/difokuskan oleh detector
        const activePred = (typeof window.getActiveTargetPrediction === 'function')
          ? window.getActiveTargetPrediction()
          : null;
        const bbox = (activePred && activePred.bbox) ? activePred.bbox : null;

        btnCaptureOne.disabled = true;
        const origText = btnCaptureOne.innerHTML;
        btnCaptureOne.innerHTML = '⏳ Menyimpan...';

        try {
          await captureAndSaveSingle(videoEl, bbox, labelName, category, notes);
          notifyUser(`✓ Sampel objek [${labelName}] berhasil disimpan ke MySQL!`, 'success');
        } catch (err) {
          notifyUser(`Gagal: ${err.message}`, 'error');
        } finally {
          btnCaptureOne.disabled = false;
          btnCaptureOne.innerHTML = origText;
        }
      });
    }

    // Tombol ⚡ Latih 3 Sudut (Otomatis)
    if (btnCaptureBurst) {
      btnCaptureBurst.addEventListener('click', async () => {
        const videoEl = document.getElementById('webcam');
        if (!videoEl || videoEl.readyState < 2) {
          notifyUser('Kamera belum aktif. Nyalakan kamera terlebih dahulu.', 'error');
          return;
        }

        const labelName = labelInputEl ? labelInputEl.value.trim() : '';
        if (!labelName || labelName.length < 2) {
          notifyUser('Harap isi Nama Objek Benar (minimal 2 karakter).', 'error');
          if (labelInputEl) labelInputEl.focus();
          return;
        }

        const category = categoryInputEl ? categoryInputEl.value : 'umum';
        const notes = notesInputEl ? notesInputEl.value.trim() : '';

        const activePred = (typeof window.getActiveTargetPrediction === 'function')
          ? window.getActiveTargetPrediction()
          : null;
        const bbox = (activePred && activePred.bbox) ? activePred.bbox : null;

        await captureBurst(videoEl, bbox, labelName, category, notes);
      });
    }
  }

  // =========================================================================
  // 12. Auto Bootstrap saat DOM Siap
  // =========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindUIEvents();
      init();
    });
  } else {
    bindUIEvents();
    init();
  }

  // =========================================================================
  // 13. Expose API Global window.BenggalaKnowledge
  // =========================================================================
  window.BenggalaKnowledge = {
    init,
    isReady: () => isModelReady,
    classifyBox,
    captureAndSave: captureAndSaveSingle,
    captureBurst,
    deleteSample,
    loadKnowledgeData,
    cosineSimilarity,
    getKnowledgeList: () => knowledgeList,
    getVectorMemory: () => vectorMemory,
    rebuildClassifier: rebuildClassifierFromData
  };

})();
