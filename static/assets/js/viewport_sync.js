/**
 * Benggala OS - Viewport & Orientation Sync (Task 20C)
 * Sinkronisasi Presisi Kanvas, Bounding Box & AR Callout Saat Rotasi HP / Resize PC
 */

(function() {
  'use strict';

  let debounceTimer = null;
  let orientationTimer = null;
  let renderedRectCache = null;

  /**
   * Hitung posisi & ukuran visual aktual video di layar
   * Mendukung object-fit: contain dan cover secara presisi
   * @param {HTMLVideoElement} videoEl
   * @returns {Object|null}
   */
  function getRenderedVideoRect(videoEl) {
    if (!videoEl) {
      videoEl = document.getElementById('webcam');
    }
    if (!videoEl) return null;

    const rect = videoEl.getBoundingClientRect();
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const cw = rect.width;
    const ch = rect.height;

    if (!vw || !vh || !cw || !ch) {
      return {
        left: rect.left,
        top: rect.top,
        width: cw,
        height: ch,
        right: rect.right,
        bottom: rect.bottom
      };
    }

    const computed = window.getComputedStyle(videoEl);
    const objectFit = computed.objectFit || 'contain';
    const videoAspect = vw / vh;
    const elemAspect = cw / ch;

    let renderedW = cw;
    let renderedH = ch;
    let renderedX = rect.left;
    let renderedY = rect.top;

    if (objectFit === 'contain') {
      if (videoAspect > elemAspect) {
        renderedW = cw;
        renderedH = cw / videoAspect;
        renderedX = rect.left;
        renderedY = rect.top + (ch - renderedH) / 2;
      } else {
        renderedH = ch;
        renderedW = ch * videoAspect;
        renderedX = rect.left + (cw - renderedW) / 2;
        renderedY = rect.top;
      }
    } else if (objectFit === 'cover') {
      if (videoAspect > elemAspect) {
        renderedH = ch;
        renderedW = ch * videoAspect;
        renderedX = rect.left + (cw - renderedW) / 2;
        renderedY = rect.top;
      } else {
        renderedW = cw;
        renderedH = cw / videoAspect;
        renderedX = rect.left;
        renderedY = rect.top + (ch - renderedH) / 2;
      }
    }

    renderedRectCache = {
      left: Math.round(renderedX),
      top: Math.round(renderedY),
      width: Math.round(renderedW),
      height: Math.round(renderedH),
      right: Math.round(renderedX + renderedW),
      bottom: Math.round(renderedY + renderedH)
    };

    return renderedRectCache;
  }

  /**
   * Proteksi Anti-Melayang: Batasi posisi elemen AR dan Reticle agar tidak keluar viewport
   */
  function clampOverlayElements() {
    // 1. Clamping Kartu AR Callout
    const card = document.getElementById('arCalloutCard');
    if (card && !card.classList.contains('hidden')) {
      const cRect = card.getBoundingClientRect();
      const maxX = Math.max(10, window.innerWidth - cRect.width - 12);
      const maxY = Math.max(50, window.innerHeight - cRect.height - 70);
      let curX = parseFloat(card.style.left) || cRect.left;
      let curY = parseFloat(card.style.top) || cRect.top;

      if (curX > maxX) card.style.left = `${maxX}px`;
      if (curY > maxY) card.style.top = `${maxY}px`;
      if (curX < 10) card.style.left = '10px';
      if (curY < 50) card.style.top = '50px';
    }

    // 2. Sinkronkan Dimensi SVG Connector Layer
    const svg = document.getElementById('arConnectorSvg');
    const layer = document.getElementById('arCalloutLayer');
    if (svg && layer) {
      const lRect = layer.getBoundingClientRect();
      svg.setAttribute('width', lRect.width);
      svg.setAttribute('height', lRect.height);
      svg.setAttribute('viewBox', `0 0 ${lRect.width} ${lRect.height}`);
    }

    // 3. Proteksi Titik Fokus Double-Tap: Reset jika keluar batas layar setelah rotasi
    const focusReticle = document.getElementById('focusReticle');
    if (focusReticle && focusReticle.classList.contains('is-custom-focus')) {
      const fr = focusReticle.getBoundingClientRect();
      if (fr.left < 0 || fr.right > window.innerWidth || fr.top < 0 || fr.bottom > window.innerHeight) {
        const btnResetFocus = document.getElementById('btnResetFocus');
        if (btnResetFocus) {
          btnResetFocus.click();
        } else {
          focusReticle.style.left = '50%';
          focusReticle.style.top = '50%';
          focusReticle.classList.remove('is-custom-focus');
        }
      }
    }
  }

  /**
   * Fungsi Sinkronisasi Utama Viewport
   */
  function syncViewport() {
    const videoEl = document.getElementById('webcam');
    const overlayEl = document.getElementById('overlay');

    // Sinkronkan resolusi internal canvas dengan resolusi asli video stream
    if (videoEl && overlayEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      if (overlayEl.width !== videoEl.videoWidth || overlayEl.height !== videoEl.videoHeight) {
        overlayEl.width = videoEl.videoWidth;
        overlayEl.height = videoEl.videoHeight;
      }
    }

    // Hitung rendered rect video
    if (videoEl) {
      getRenderedVideoRect(videoEl);
    }

    // Proteksi posisi elemen overlay AR & reticle
    clampOverlayElements();

    // Pancarkan CustomEvent 'benggala:viewport-changed'
    window.dispatchEvent(new CustomEvent('benggala:viewport-changed', {
      detail: {
        videoWidth: videoEl ? videoEl.videoWidth : 0,
        videoHeight: videoEl ? videoEl.videoHeight : 0,
        renderedRect: renderedRectCache,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        orientation: (window.screen && window.screen.orientation) 
          ? window.screen.orientation.type 
          : (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape')
      }
    }));
  }

  /**
   * Debounced sync helper
   * @param {number} delay (ms)
   */
  function debouncedSync(delay = 120) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      syncViewport();
    }, delay);
  }

  /**
   * Helper Full-screen PC (Non-Intrusif)
   */
  function toggleFullscreen() {
    try {
      const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
      if (!isFullscreen) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (e) {
      // Non-intrusive fallback
    }
  }

  /**
   * Daftarkan Event Listeners Layar & Kamera
   */
  function initListeners() {
    // 1. Resize Window
    window.addEventListener('resize', () => {
      debouncedSync(120);
    });

    // 2. Rotasi Orientasi HP (orientationchange)
    window.addEventListener('orientationchange', () => {
      debouncedSync(60);
      if (orientationTimer) clearTimeout(orientationTimer);
      // Jeda 250ms karena browser Chrome Android kadang terlambat memperbarui dimensi video
      orientationTimer = setTimeout(() => {
        debouncedSync(60);
      }, 250);
    });

    // 3. Screen Orientation API
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
      window.screen.orientation.addEventListener('change', () => {
        debouncedSync(60);
        setTimeout(() => debouncedSync(60), 250);
      });
    }

    // 4. Video Element Listeners
    const videoEl = document.getElementById('webcam');
    if (videoEl) {
      videoEl.addEventListener('resize', () => debouncedSync(80));
      videoEl.addEventListener('loadedmetadata', () => debouncedSync(50));
    }

    // 5. Shortcut Keyboard 'F' untuk Fullscreen di PC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'f' || e.key === 'F') {
        const el = document.activeElement;
        const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || (el && el.isContentEditable)) {
          return;
        }
        if (e.ctrlKey || e.altKey || e.metaKey) {
          return;
        }
        e.preventDefault();
        toggleFullscreen();
      }
    });

    // Jalankan sinkronisasi awal saat DOM siap
    debouncedSync(50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initListeners);
  } else {
    initListeners();
  }

  // Ekspos API Global
  window.BenggalaViewportSync = {
    syncViewport,
    debouncedSync,
    getRenderedVideoRect,
    toggleFullscreen,
    get renderedRect() {
      return renderedRectCache;
    }
  };

})();
