/**
 * Benggala OS - HUD AR Callout Futuristik & Garis Konektor (Task 18B)
 * Menampilkan kartu AR melayang di luar bounding box dengan interpolasi Lerp halus,
 * garis penunjuk SVG neon dinamis, dan integrasi kamus profil objek lokal/AI.
 */

(function() {
  'use strict';

  // DOM Elements
  let layerEl = null;
  let svgEl = null;
  let cardEl = null;

  // State Pelacakan & Lerp Interpolasi
  let currentX = null;
  let currentY = null;
  let lastSeenTime = 0;
  let isCardVisible = false;
  let activePredictionRef = null;
  let currentOptions = {};
  let animationFrameId = null;

  // State Khusus Pindai Titik Bidik (Task 19B: Reticle Scan Pinning)
  let reticleScanPinnedTarget = null;
  let reticleScanPinnedProfile = null;
  let reticleScanPinnedExpires = 0;
  let lastRenderedKey = '';

  // Konfigurasi
  const LERP_FACTOR = 0.22;
  const HIDE_TIMEOUT_MS = 3500;
  const SAFE_HEADER_TOP = 76;   // Jarak aman dari header atas
  const SAFE_DOCK_BOTTOM = 120; // Jarak aman dari dock bawah

  /**
   * Helper Inisialisasi DOM
   */
  function initElements() {
    if (!layerEl) layerEl = document.getElementById('arCalloutLayer');
    if (!svgEl) svgEl = document.getElementById('arConnectorSvg');
    if (!cardEl) cardEl = document.getElementById('arCalloutCard');

    if (cardEl && !cardEl._hasDetailListener) {
      // Event delegation untuk tombol detail pada kartu AR (tahan re-render 60 FPS & sentuhan HP)
      cardEl.addEventListener('click', onCardElementClick);
      cardEl.addEventListener('touchend', (e) => {
        const btn = e.target.closest('#btnOpenItemDetail') || e.target.closest('#btnArEnrichAi');
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          onCardElementClick(e);
        }
      }, { passive: false });
      cardEl._hasDetailListener = true;
    }

    return Boolean(layerEl && svgEl && cardEl);
  }

  /**
   * Sanitasi string untuk mencegah XSS saat render template HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#39;');
  }

  /**
   * Mengambil warna aksen HUD berdasarkan profil dan status
   */
  function getThemeColor(profile) {
    if (!profile) return '#00f0ff';
    if (profile.safety === 'bahaya') return '#ef4444';
    if (profile.source === 'BIDIK AI' || profile.scan_mode === 'reticle_crop') return '#00f0ff';
    if (profile.source === 'AI LIVE') return '#10b981';
    if (profile.source === 'MEMORI DB') return '#fbbf24';
    return '#00f0ff'; // LOKAL Default (Cyan Neon)
  }

  /**
   * Sembunyikan kartu AR dan bersihkan SVG
   * @param {boolean} [force=false] Jika true, paksa hide meskipun ada reticle scan yang sedang dipin
   */
  function hide(force = false) {
    if (!force && performance.now() < reticleScanPinnedExpires) {
      // Masih dalam masa pin hasil reticle scan, jangan hide otomatis
      return;
    }
    if (!cardEl && !initElements()) return;
    if (cardEl) {
      cardEl.classList.add('hidden');
    }
    if (svgEl) {
      svgEl.innerHTML = '';
    }
    isCardVisible = false;
    currentX = null;
    currentY = null;
    activePredictionRef = null;
    reticleScanPinnedTarget = null;
    reticleScanPinnedProfile = null;
    reticleScanPinnedExpires = 0;
    lastRenderedKey = '';
  }

  /**
   * Render garis konektor SVG futuristik (Leader Line)
   * Menggambar polyline bersiku/diagonal dan bulatan node di tepi kotak
   */
  function renderConnectorLine(box, cardPos, side, themeColor) {
    if (!svgEl || !layerEl) return;

    const layerRect = layerEl.getBoundingClientRect();
    const svgW = layerRect.width;
    const svgH = layerRect.height;

    // Pastikan viewBox dan ukuran SVG sinkron dengan layer
    svgEl.setAttribute('width', svgW);
    svgEl.setAttribute('height', svgH);
    svgEl.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    const cardW = cardPos.w;
    const cardH = cardPos.h;
    const cx = cardPos.x;
    const cy = cardPos.y;

    // Tentukan titik start (pada tepi bounding box) dan titik end (pada tepi kartu AR)
    if (side === 'right') {
      startX = box.x + box.w;
      startY = Math.max(box.y, Math.min(box.y + box.h, cy + cardH * 0.35));
      endX = cx;
      endY = cy + cardH * 0.35;
    } else if (side === 'left') {
      startX = box.x;
      startY = Math.max(box.y, Math.min(box.y + box.h, cy + cardH * 0.35));
      endX = cx + cardW;
      endY = cy + cardH * 0.35;
    } else if (side === 'top') {
      startX = box.x + box.w * 0.5;
      startY = box.y;
      endX = cx + cardW * 0.5;
      endY = cy + cardH;
    } else { // bottom
      startX = box.x + box.w * 0.5;
      startY = box.y + box.h;
      endX = cx + cardW * 0.5;
      endY = cy;
    }

    // Bangun jalur polyline bersiku HUD sci-fi
    let points = '';
    if (side === 'right' || side === 'left') {
      const midX = startX + (endX - startX) * 0.45;
      points = `${startX.toFixed(1)},${startY.toFixed(1)} ${midX.toFixed(1)},${startY.toFixed(1)} ${midX.toFixed(1)},${endY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
    } else {
      const midY = startY + (endY - startY) * 0.45;
      points = `${startX.toFixed(1)},${startY.toFixed(1)} ${startX.toFixed(1)},${midY.toFixed(1)} ${endX.toFixed(1)},${midY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`;
    }

    // Render node titik awal & garis glow bercahaya
    svgEl.innerHTML = `
      <defs>
        <filter id="arLineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <!-- Garis Glow -->
      <polyline points="${points}" fill="none" stroke="${themeColor}" stroke-width="3" stroke-opacity="0.38" filter="url(#arLineGlow)" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Garis Tajam Utama -->
      <polyline points="${points}" fill="none" stroke="${themeColor}" stroke-width="1.6" stroke-opacity="0.95" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Node Titik Target di Sudut/Tepi Kotak -->
      <circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="3.5" fill="${themeColor}" filter="url(#arLineGlow)" />
      <circle cx="${startX.toFixed(1)}" cy="${startY.toFixed(1)}" r="1.8" fill="#ffffff" />
      <!-- Titik Pin Masuk Kartu -->
      <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="2.2" fill="${themeColor}" />
    `;
  }

  /**
   * Handler navigasi dan buka halaman detail objek interaktif
   */
  function openItemDetailPage(prediction, profile) {
    try {
      const pred = prediction || activePredictionRef || reticleScanPinnedTarget;
      const prof = profile || reticleScanPinnedProfile || (pred && window.BenggalaObjectProfiles && typeof window.BenggalaObjectProfiles.getProfile === 'function' ? window.BenggalaObjectProfiles.getProfile(pred.class, pred.customMeta || null) : null);

      const rawLabel = (pred && (pred.customLabel || pred.class)) || (prof && prof.title) || 'objek';
      const cleanLabel = String(rawLabel).replace(/^★\s*/, '').trim();

      // 1. Ambil snapshot frame terkompresi dari kamera
      const snapshotImg = captureCompressedFrame() || '';

      // 2. Siapkan data komprehensif objek terkunci & status AI terkini
      const itemData = {
        label: cleanLabel,
        title: (prof && prof.title) || cleanLabel,
        category: (prof && prof.category) || 'OBJEK',
        utility: (prof && prof.utility) || 'Objek teridentifikasi oleh sistem kuncian taktis Benggala.',
        detail: (prof && prof.detail) || 'Profil objek aktif dari kokpit kamera.',
        extra_tip: (prof && prof.extra_tip) || '',
        safety: (prof && prof.safety) || 'aman',
        safetyNote: (prof && prof.safetyNote) || 'Aman dalam penggunaan standar.',
        dimensionsText: (currentOptions && currentOptions.dimensionsText) || '',
        source: (prof && prof.source) || 'AI LIVE',
        score: (pred && typeof pred.score === 'number') ? Math.round(pred.score * 100) : 0,
        image: snapshotImg,
        timestamp: Date.now()
      };

      // 3. Simpan ke sessionStorage agar langsung terbaca di halaman /item-detail
      try {
        sessionStorage.setItem('benggala_locked_item', JSON.stringify(itemData));
      } catch (e) {
        console.warn('Storage quota exceeded for image snapshot:', e);
        delete itemData.image;
        sessionStorage.setItem('benggala_locked_item', JSON.stringify(itemData));
      }

      // 4. Buka halaman detail item
      const base = window.BASE_PATH || '';
      window.location.href = `${base}/item-detail?label=${encodeURIComponent(cleanLabel)}`;
    } catch (err) {
      console.error('Gagal membuka halaman detail item:', err);
      if (typeof window.showToast === 'function') {
        window.showToast('⚠️ Gagal membuka detail objek', 'error');
      }
    }
  }

  /**
   * Event delegation handler untuk klik tombol pada kartu AR
   */
  function onCardElementClick(e) {
    const btn = e.target.closest('#btnOpenItemDetail') || e.target.closest('#btnArEnrichAi');
    if (!btn) return;
    e.stopPropagation();
    e.preventDefault();

    const pred = activePredictionRef || reticleScanPinnedTarget;
    let prof = (pred && pred.isReticleScan) ? reticleScanPinnedProfile : null;
    if (!prof && pred && window.BenggalaObjectProfiles && typeof window.BenggalaObjectProfiles.getProfile === 'function') {
      prof = window.BenggalaObjectProfiles.getProfile(pred.class, pred.customMeta || null);
    }
    openItemDetailPage(pred, prof);
  }

  /**
   * Render template konten HTML pada `#arCalloutCard`
   */
  function renderCardContent(prediction, profile, dimensionsText, themeColor, isLocked) {
    if (!cardEl) return;

    const rawLabel = (prediction && (prediction.customLabel || prediction.class)) || (profile && profile.title) || '';
    const scoreVal = prediction && typeof prediction.score === 'number' ? Math.round(prediction.score * 100) : 0;
    const currentKey = `${rawLabel}|${profile.title || ''}|${profile.category || ''}|${profile.utility || ''}|${profile.detail || ''}|${profile.safety || ''}|${Boolean(isLocked)}|${dimensionsText || ''}|${scoreVal}|${profile.source || ''}`;

    if (currentKey === lastRenderedKey && cardEl.querySelector('#btnOpenItemDetail')) {
      return; // Hindari manipulasi DOM berulang pada 60 FPS agar event click tidak hilang
    }
    lastRenderedKey = currentKey;

    const sourceBadgeMap = {
      'BIDIK AI': '<span class="ar-badge-source source-ai" style="background: rgba(0, 240, 255, 0.25); color: #00f0ff; border-color: rgba(0, 240, 255, 0.55); font-weight: 700;">🎯 BIDIK AI</span>',
      'AI LIVE': '<span class="ar-badge-source source-ai">✨ AI LIVE</span>',
      'MEMORI DB': '<span class="ar-badge-source source-db">★ DB</span>',
      'LOKAL': '<span class="ar-badge-source source-local">⚡ LOKAL</span>'
    };

    const isBidikAi = (profile.source === 'BIDIK AI' || profile.scan_mode === 'reticle_crop');
    const sourceHtml = isBidikAi
      ? sourceBadgeMap['BIDIK AI']
      : (sourceBadgeMap[profile.source] || '<span class="ar-badge-source source-local">⚡ LOKAL</span>');
    const categoryHtml = `<span class="ar-badge-category">${escapeHtml(profile.category || 'OBJEK')}</span>`;
    const scoreHtml = scoreVal > 0 ? `<span class="ar-badge-score">${scoreVal}%</span>` : '';

    const lockBadge = isLocked ? '<span class="ar-badge-lock" title="Target Terkunci">🔒 LOCK</span>' : '';
    const dimHtml = dimensionsText ? `<span class="ar-callout-dim">${escapeHtml(dimensionsText)}</span>` : '';

    // Status keselamatan
    const safety = profile.safety || 'aman';
    let safetyDotClass = 'safety-safe';
    let safetyLabel = 'Aman';
    if (safety === 'bahaya') {
      safetyDotClass = 'safety-danger';
      safetyLabel = 'BAHAYA';
    } else if (safety === 'waspada') {
      safetyDotClass = 'safety-warning';
      safetyLabel = 'Waspada';
    }

    cardEl.style.setProperty('--ar-theme-color', themeColor);

    cardEl.innerHTML = `
      <div class="ar-card-header">
        <div class="ar-card-badges">
          ${categoryHtml}
          ${sourceHtml}
          ${lockBadge}
        </div>
        ${scoreHtml}
      </div>

      <div class="ar-card-title-row">
        <h4 class="ar-card-title">${escapeHtml(profile.title || (prediction && prediction.class) || 'Target')}</h4>
        ${dimHtml}
      </div>

      <div class="ar-card-body">
        <div class="ar-info-line">
          <span class="ar-label">FUNGSI:</span>
          <span class="ar-val">${escapeHtml(profile.utility || '-')}</span>
        </div>
        <div class="ar-info-line">
          <span class="ar-label">INFO:</span>
          <span class="ar-val">${escapeHtml(profile.detail || '-')}</span>
        </div>
        ${profile.extra_tip ? `
        <div class="ar-info-line ar-extra-tip">
          <span class="ar-label">DETAIL:</span>
          <span class="ar-val">${escapeHtml(profile.extra_tip)}</span>
        </div>` : ''}
      </div>

      <div class="ar-card-footer">
        <div class="ar-safety-indicator ${safetyDotClass}" title="${escapeHtml(profile.safetyNote || '')}">
          <span class="ar-safety-dot"></span>
          <span class="ar-safety-text">${safetyLabel}</span>
        </div>
        <button type="button" id="btnOpenItemDetail" class="ar-btn-detail" title="Buka Detail Lengkap & Chat AI Interaktif">
          <span>💬 Detail & Chat AI ➔</span>
        </button>
      </div>
    `;

    // Pasang direct listener juga sebagai cadangan selain event delegation
    const btnDetail = cardEl.querySelector('#btnOpenItemDetail');
    if (btnDetail) {
      btnDetail.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        openItemDetailPage(prediction, profile);
      };
    }
  }

  /**
   * Menangkap frame kamera terkompresi ringan (maks 512px, JPEG 0.72) untuk efisiensi jaringan HP
   * Jika window.captureReticleCrop tersedia, gunakan pemotongan fokus titik bidik
   */
  function captureCompressedFrame() {
    try {
      const videoEl = document.getElementById('webcam');
      if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null;
      if (typeof window.captureReticleCrop === 'function') {
        return window.captureReticleCrop(videoEl, 0.5, 0.5, 0.45);
      }
      const maxW = 512;
      const scale = Math.min(1, maxW / videoEl.videoWidth);
      const cw = Math.round(videoEl.videoWidth * scale);
      const ch = Math.round(videoEl.videoHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, cw, ch);
      return canvas.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      console.warn('Gagal menangkap frame untuk Quick Detail AI:', e);
      return null;
    }
  }

  /**
   * Handler klik tombol ✨ Detail AI: Memanggil POST /api/ai/quick-detail
   */
  async function handleQuickDetailClick(btnEl) {
    if (!btnEl || btnEl.disabled) return;
    if (!activePredictionRef) return;

    const rawLabel = activePredictionRef.customLabel || activePredictionRef.class || 'objek';
    const cleanLabel = String(rawLabel).replace(/^★\s*/, '').trim();

    // 1. Ubah status tombol jadi Memindai AI... (anti double-click)
    const originalHtml = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = '⏳ Memindai AI...';
    btnEl.style.opacity = '0.75';

    // 2. Ambil snapshot frame terkompresi
    const compressedImage = captureCompressedFrame();

    // 3. Kirim ke /api/ai/quick-detail
    const payload = {
      label: cleanLabel,
      image: compressedImage
    };

    try {
      let resJson = null;
      if (typeof window.postWithCsrf === 'function') {
        resJson = await window.postWithCsrf('/api/ai/quick-detail', payload);
      } else {
        const base = window.BASE_PATH || '';
        const token = window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || '';
        const res = await fetch(`${base}/api/ai/quick-detail`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${res.status}`);
        }
        resJson = await res.json();
      }

      if (resJson && resJson.status === 'ok' && resJson.data) {
        // 4. Sukses: perbarui kartu & cache
        applyAiAnalysis(cleanLabel, null, resJson.data);
      } else {
        throw new Error(resJson.message || 'Gagal memproses detail AI');
      }
    } catch (err) {
      // 5. Gagal: tampilkan pesan error 3 detik
      console.warn('Quick Detail AI error:', err);
      btnEl.innerHTML = '⚠️ Gagal';
      btnEl.style.color = '#ef4444';
      setTimeout(() => {
        if (btnEl && cardEl && cardEl.contains(btnEl)) {
          btnEl.disabled = false;
          btnEl.innerHTML = originalHtml;
          btnEl.style.color = '';
          btnEl.style.opacity = '';
        }
      }, 3000);
    }
  }

  /**
   * Menerapkan hasil analisis AI (dari Quick Detail, Auto-Lock, atau tombol Analisis AI utama)
   * ke kartu AR di luar kotak dan menyimpan ke cache sesi (TTL 10 menit).
   * @param {string} label Nama label objek
   * @param {string} [analysisText] Teks analisis bebas dari AI Vision
   * @param {Object} [structuredData] Data profil terstruktur { title, category, utility, detail, extra_tip, safety, safetyNote }
   */
  function applyAiAnalysis(label, analysisText, structuredData) {
    if (!label) return;
    const cleanLabel = String(label).replace(/^★\s*/, '').trim();
    const cleanLower = cleanLabel.toLowerCase();

    let aiProfile = null;
    if (structuredData && typeof structuredData === 'object') {
      aiProfile = {
        title: structuredData.title || cleanLabel,
        category: (structuredData.category || 'AI ENRICHED').toUpperCase(),
        utility: structuredData.utility || 'Hasil analisis konteks visual AI.',
        detail: structuredData.detail || 'Diproses dengan Gemini Vision / DeepSeek.',
        extra_tip: structuredData.extra_tip || '',
        safety: structuredData.safety || 'aman',
        safetyNote: structuredData.safetyNote || 'Data analisis real-time terkini.',
        source: 'AI LIVE'
      };
    } else if (analysisText && typeof analysisText === 'string') {
      // Ekstrak ringkasan dari teks deskriptif
      const clean = analysisText.replace(/[*#_]/g, '').split('`').join('').trim();
      const lines = clean.split(/\n+/).map(l => l.trim()).filter(Boolean);
      const utilitySummary = lines[0] || 'Hasil analisis visual AI real-time.';
      const detailSummary = lines[1] || 'Telah diperkaya dengan pemahaman multimodal.';

      let safety = 'aman';
      const low = clean.toLowerCase();
      if (low.includes('bahaya') || low.includes('beracun') || low.includes('tajam')) {
        safety = 'bahaya';
      } else if (low.includes('waspada') || low.includes('hati-hati') || low.includes('panas')) {
        safety = 'waspada';
      }

      aiProfile = {
        title: cleanLabel,
        category: 'AI ENRICHED',
        utility: utilitySummary.slice(0, 140),
        detail: detailSummary.slice(0, 160),
        extra_tip: lines[2] ? lines[2].slice(0, 120) : '',
        safety: safety,
        safetyNote: safety === 'bahaya' ? 'Perhatikan peringatan keselamatan!' : 'Amati objek dengan saksama.',
        source: 'AI LIVE'
      };
    }

    if (aiProfile) {
      // Simpan di BenggalaObjectProfiles AI session cache
      if (window.BenggalaObjectProfiles && typeof window.BenggalaObjectProfiles.setAiCache === 'function') {
        window.BenggalaObjectProfiles.setAiCache(cleanLower, aiProfile);
      }

      // Jika kartu AR sedang aktif, langsung perbarui tampilannya ke mode AI LIVE
      if (isCardVisible && activePredictionRef) {
        const activeClass = String(activePredictionRef.customLabel || activePredictionRef.class || '').replace(/^★\s*/, '').trim().toLowerCase();
        if (activeClass === cleanLower || !activeClass) {
          const themeColor = '#10b981';
          renderCardContent(activePredictionRef, aiProfile, currentOptions.dimensionsText, themeColor, currentOptions.isLocked);
          if (svgEl) {
            const lines = svgEl.querySelectorAll('polyline, circle');
            lines.forEach(el => {
              if (el.getAttribute('stroke')) el.setAttribute('stroke', themeColor);
              if (el.getAttribute('fill') && el.getAttribute('fill') !== '#ffffff') el.setAttribute('fill', themeColor);
            });
          }
        }
      }
    }
  }

  /**
   * Menghitung posisi bounding box dalam koordinat layar aktual (CSS Pixels)
   * menggunakan getBoundingClientRect() pada overlay canvas
   */
  function computeScreenBBox(bbox, canvasEl) {
    if (!bbox || !canvasEl) return null;
    const canvasRect = canvasEl.getBoundingClientRect();
    const scaleX = canvasRect.width / (canvasEl.width || 1);
    const scaleY = canvasRect.height / (canvasEl.height || 1);

    return {
      x: canvasRect.left + (bbox[0] * scaleX),
      y: canvasRect.top + (bbox[1] * scaleY),
      w: bbox[2] * scaleX,
      h: bbox[3] * scaleY
    };
  }

  /**
   * Fungsi Utama: Update posisi dan konten AR Callout pada tiap frame
   * @param {Object} primaryPrediction Prediksi objek prioritas utama
   * @param {HTMLCanvasElement} canvasEl Elemen canvas overlay kamera
   * @param {Object} options Opsi tambahan { dimensionsText, isLocked }
   */
  function update(primaryPrediction, canvasEl, options = {}) {
    const now = performance.now();

    if (!initElements()) return;

    // Task 19B: Prioritaskan pinned target dari hasil reticle scan jika masih aktif
    if (now < reticleScanPinnedExpires && reticleScanPinnedTarget) {
      primaryPrediction = reticleScanPinnedTarget;
      options = { ...options, isLocked: true };
    }

    // WAJIB (Task 18D): Popup detail HANYA boleh muncul jika target sudah TERKUNCI STABIL 6 DETIK (atau fokus manual / reticle scan)
    const isLocked = options && options.isLocked;
    if (!isLocked) {
      if (isCardVisible) {
        hide();
      }
      return;
    }

    if (!primaryPrediction || !primaryPrediction.bbox || !canvasEl) {
      // Mekanisme anti-flicker: tunda hide selama HIDE_TIMEOUT_MS
      if (isCardVisible && (now - lastSeenTime > HIDE_TIMEOUT_MS)) {
        hide();
      }
      return;
    }

    lastSeenTime = now;
    activePredictionRef = primaryPrediction;
    currentOptions = options;

    const layerRect = layerEl.getBoundingClientRect();
    if (layerRect.width <= 0 || layerRect.height <= 0) return;

    // 1. Konversi BBox ke koordinat layer layar aktual
    const screenBox = computeScreenBBox(primaryPrediction.bbox, canvasEl);
    if (!screenBox) return;

    const box = {
      x: screenBox.x - layerRect.left,
      y: screenBox.y - layerRect.top,
      w: screenBox.w,
      h: screenBox.h
    };

    // Ambil profil objek: Jika reticle scan, gunakan profil yang dipin
    let profile = null;
    if (primaryPrediction.isReticleScan && reticleScanPinnedProfile) {
      profile = reticleScanPinnedProfile;
    } else if (window.BenggalaObjectProfiles && typeof window.BenggalaObjectProfiles.getProfile === 'function') {
      profile = window.BenggalaObjectProfiles.getProfile(primaryPrediction.class, primaryPrediction.customMeta || null);
    } else {
      profile = {
        title: primaryPrediction.class,
        category: 'OBJEK',
        utility: 'Objek terdeteksi kamera.',
        detail: 'Profil visual aktif.',
        safety: 'aman',
        safetyNote: 'Aman.',
        source: 'LOKAL'
      };
    }

    const themeColor = getThemeColor(profile);

    // 2. Render isi konten kartu
    renderCardContent(primaryPrediction, profile, options.dimensionsText, themeColor, options.isLocked);

    // Ambil ukuran kartu untuk kalkulasi penempatan presisi
    cardEl.classList.remove('hidden');
    isCardVisible = true;

    const cardWidth = cardEl.offsetWidth || 210;
    const cardHeight = cardEl.offsetHeight || 135;

    // 3. Penempatan Cerdas di Luar Kotak (Kanan -> Kiri -> Atas -> Bawah)
    const rightSpace = layerRect.width - (box.x + box.w);
    const leftSpace = box.x;
    let targetX = 0;
    let targetY = 0;
    let side = 'right';

    if (rightSpace >= cardWidth + 24) {
      // Cukup ruang di Kanan
      targetX = box.x + box.w + 18;
      targetY = box.y + (box.h - cardHeight) * 0.5;
      side = 'right';
    } else if (leftSpace >= cardWidth + 24) {
      // Cukup ruang di Kiri
      targetX = box.x - cardWidth - 18;
      targetY = box.y + (box.h - cardHeight) * 0.5;
      side = 'left';
    } else {
      // Kiri dan kanan sempit (objek lebar di HP portrait), tempatkan di Atas / Bawah
      const topSpace = box.y - SAFE_HEADER_TOP;
      if (topSpace >= cardHeight + 16) {
        targetX = box.x + (box.w - cardWidth) * 0.5;
        targetY = box.y - cardHeight - 16;
        side = 'top';
      } else {
        targetX = box.x + (box.w - cardWidth) * 0.5;
        targetY = box.y + box.h + 16;
        side = 'bottom';
      }
    }

    // 4. Clamping Posisi Aman (Anti-Menabrak Header & Dock)
    const minSafeX = 8;
    const maxSafeX = Math.max(minSafeX, layerRect.width - cardWidth - 8);
    const minSafeY = SAFE_HEADER_TOP;
    const maxSafeY = Math.max(minSafeY, layerRect.height - cardHeight - SAFE_DOCK_BOTTOM);

    targetX = Math.max(minSafeX, Math.min(maxSafeX, targetX));
    targetY = Math.max(minSafeY, Math.min(maxSafeY, targetY));

    // 5. Lerp Smoothing Interpolation (0.22) untuk pergerakan kartu meluncur halus
    if (currentX === null || currentY === null) {
      currentX = targetX;
      currentY = targetY;
    } else {
      currentX += (targetX - currentX) * LERP_FACTOR;
      currentY += (targetY - currentY) * LERP_FACTOR;
    }

    // Terapkan posisi dengan transformasi GPU 60 FPS
    cardEl.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0)`;

    // 6. Gambar Garis Konektor SVG Menghubungkan BBox dan Kartu
    renderConnectorLine(box, { x: currentX, y: currentY, w: cardWidth, h: cardHeight }, side, themeColor);
  }

  /**
   * Menampilkan hasil pindai titik bidik (Reticle Scan) pada kartu AR tertambat ke titik bidik
   * @param {Object} scanData Data JSON hasil Gemini Vision
   * @param {Object} targetCoords Koordinat canvas { x, y } titik bidik
   * @param {HTMLCanvasElement} [canvasEl] Elemen overlay canvas
   */
  function showReticleScanResult(scanData, targetCoords, canvasEl) {
    if (!initElements() || !scanData) return;
    const now = performance.now();
    const cEl = canvasEl || document.getElementById('overlay');
    const cx = (targetCoords && typeof targetCoords.x === 'number') ? targetCoords.x : ((cEl?.width || 640) / 2);
    const cy = (targetCoords && typeof targetCoords.y === 'number') ? targetCoords.y : ((cEl?.height || 480) / 2);

    const rSize = 36;
    reticleScanPinnedTarget = {
      class: scanData.title || 'Objek Terpindai',
      score: 0.99,
      bbox: [cx - rSize / 2, cy - rSize / 2, rSize, rSize],
      isReticleScan: true
    };

    reticleScanPinnedProfile = {
      title: scanData.title || 'Objek Terpindai',
      category: scanData.category || 'BARANG',
      utility: scanData.utility || 'Objek visual teridentifikasi.',
      detail: scanData.detail || 'Hasil analisis Gemini Vision dari titik bidik.',
      extra_tip: scanData.extra_tip || '',
      safety: scanData.safety || 'aman',
      safetyNote: scanData.safetyNote || 'Amati secara saksama.',
      source: 'BIDIK AI',
      scan_mode: 'reticle_crop'
    };

    // Pin hasil selama 15 detik atau hingga di-reset
    reticleScanPinnedExpires = now + 15000;
    activePredictionRef = reticleScanPinnedTarget;

    // Simpan ke cache sesi jika BenggalaObjectProfiles tersedia
    if (window.BenggalaObjectProfiles && typeof window.BenggalaObjectProfiles.setAiCache === 'function') {
      window.BenggalaObjectProfiles.setAiCache(reticleScanPinnedProfile.title.toLowerCase(), reticleScanPinnedProfile);
    }

    update(reticleScanPinnedTarget, cEl, { isLocked: true });
  }

  // =========================================================================
  // Expose API Global
  // =========================================================================
  window.BenggalaArCallout = {
    update,
    hide,
    applyAiAnalysis,
    applyAiDetail: applyAiAnalysis,
    showReticleScanResult,
    isVisible: () => isCardVisible,
    getTarget: () => activePredictionRef
  };

})();
