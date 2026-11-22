/**
 * BENGGALA // YOULO OS - Instant Forensic Target Dossier PNG Generator
 * Browser-side HTML5 Canvas High-Tech Card Generator with Web Share API
 */

(function () {
  'use strict';

  let currentDataUrl = null;
  let currentBlob = null;
  let currentCardData = null;

  /**
   * Helper untuk menggambar kotak dengan sudut terpotong (chamfered / clipped corners)
   */
  function drawChamferedRect(ctx, x, y, w, h, cut, strokeColor, fillColor, lineWidth = 1) {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();

    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Helper wrap text untuk canvas agar rapi dan tidak tumpang tindih
   */
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 11) {
    if (!text) return y;
    
    // Hilangkan format markdown tebal/miring sederhana jika ada
    const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    const paragraphs = cleanText.split('\n');
    let currentY = y;
    let lineCount = 0;

    for (let p = 0; p < paragraphs.length; p++) {
      const paragraph = paragraphs[p].trim();
      if (!paragraph) {
        currentY += lineHeight * 0.5;
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = currentLine ? currentLine + ' ' + words[n] : words[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(currentLine, x, currentY);
          currentLine = words[n];
          currentY += lineHeight;
          lineCount++;

          if (lineCount >= maxLines - 1) {
            ctx.fillText(currentLine + ' ... [Laporan Lengkap Tersimpan di Database]', x, currentY);
            return currentY;
          }
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        ctx.fillText(currentLine, x, currentY);
        currentY += lineHeight;
        lineCount++;
        if (lineCount >= maxLines) break;
      }
    }

    return currentY;
  }

  /**
   * Helper konversi DataURL ke Blob
   */
  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  }

  /**
   * Generate nama file unik berformat benggala_dossier_YYYYMMDD_HHMMSS.png
   */
  function generateFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `benggala_dossier_${yyyy}${mm}${dd}_${hh}${min}${ss}.png`;
  }

  const BenggalaDossier = {
    /**
     * Generate Kartu Target Dossier di Canvas Offscreen (800x1050)
     */
    generateCard: function (data) {
      return new Promise((resolve) => {
        const {
          imageDataUrl,
          objectLabel = 'Objek Terdeteksi',
          dimensions = 'Mode Piksel',
          missionName = 'Umum',
          provider = 'deepseek',
          analysisText = 'Analisis belum tersedia.',
          timestamp = new Date().toLocaleString('id-ID', { hour12: false })
        } = data || {};

        currentCardData = data;

        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1050;
        const ctx = canvas.getContext('2d');

        // 1. Background Gradasi Navy Pekat
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 1050);
        bgGrad.addColorStop(0, '#020617');
        bgGrad.addColorStop(0.4, '#061021');
        bgGrad.addColorStop(1, '#0A1628');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 800, 1050);

        // Cyber Grid Lines Halus
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 40; x < 760; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 1050);
          ctx.stroke();
        }
        for (let y = 40; y < 1050; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(800, y);
          ctx.stroke();
        }

        // Frame Luar Sudut Terpotong dengan Glow Neon Cyan
        ctx.save();
        ctx.shadowColor = 'rgba(0, 229, 255, 0.45)';
        ctx.shadowBlur = 14;
        drawChamferedRect(ctx, 20, 20, 760, 1010, 20, '#00E5FF', null, 2);
        ctx.restore();

        // Garis aksen tipis interior frame
        drawChamferedRect(ctx, 24, 24, 752, 1002, 18, 'rgba(0, 229, 255, 0.25)', null, 1);

        // 2. Header Kartu YOULO OS
        // Kiri
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00E5FF';
        ctx.fillText('YOULO OS // FORENSIC INTELLIGENCE', 45, 48);

        ctx.font = '700 22px "Orbitron", "Rajdhani", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('TARGET DOSSIER', 45, 72);

        // Kanan (Timestamp & Misi)
        ctx.textAlign = 'right';
        ctx.font = '500 11.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(timestamp, 755, 48);

        ctx.font = '700 13px "Rajdhani", sans-serif';
        ctx.fillStyle = '#00E676';
        ctx.fillText('MISI: ' + missionName.toUpperCase(), 755, 70);
        ctx.textAlign = 'left'; // Reset alignment

        // 3. Area Foto Target (720 x 420 px, diposisikan di x: 40, y: 88)
        const photoX = 40;
        const photoY = 88;
        const photoW = 720;
        const photoH = 420;

        // Background Area Foto
        ctx.fillStyle = '#010409';
        ctx.fillRect(photoX, photoY, photoW, photoH);

        const renderAfterImage = () => {
          // Border Foto
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(photoX, photoY, photoW, photoH);

          // Corner Reticles Hijau Neon (#00E676)
          const reticleLen = 22;
          ctx.strokeStyle = '#00E676';
          ctx.lineWidth = 3;

          // Top-Left
          ctx.beginPath();
          ctx.moveTo(photoX, photoY + reticleLen);
          ctx.lineTo(photoX, photoY);
          ctx.lineTo(photoX + reticleLen, photoY);
          ctx.stroke();

          // Top-Right
          ctx.beginPath();
          ctx.moveTo(photoX + photoW - reticleLen, photoY);
          ctx.lineTo(photoX + photoW, photoY);
          ctx.lineTo(photoX + photoW, photoY + reticleLen);
          ctx.stroke();

          // Bottom-Left
          ctx.beginPath();
          ctx.moveTo(photoX, photoY + photoH - reticleLen);
          ctx.lineTo(photoX, photoY + photoH);
          ctx.lineTo(photoX + reticleLen, photoY + photoH);
          ctx.stroke();

          // Bottom-Right
          ctx.beginPath();
          ctx.moveTo(photoX + photoW - reticleLen, photoY + photoH);
          ctx.lineTo(photoX + photoW, photoY + photoH);
          ctx.lineTo(photoX + photoW, photoY + photoH - reticleLen);
          ctx.stroke();

          // Reticle Crosshair di Tengah Foto
          const cx = photoX + photoW / 2;
          const cy = photoY + photoH / 2;
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cx, cy, 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - 36, cy); ctx.lineTo(cx - 10, cy);
          ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 36, cy);
          ctx.moveTo(cx, cy - 36); ctx.lineTo(cx, cy - 10);
          ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 36);
          ctx.stroke();

          // Badge "✓ TARGET TERKUNCI" di Pojok Kiri Atas Foto
          const badgeX = photoX + 14;
          const badgeY = photoY + 14;
          ctx.save();
          ctx.shadowColor = 'rgba(0, 230, 118, 0.5)';
          ctx.shadowBlur = 8;
          drawChamferedRect(ctx, badgeX, badgeY, 150, 26, 6, '#00E676', 'rgba(0, 230, 118, 0.95)');
          ctx.restore();

          ctx.font = '700 10.5px "Orbitron", sans-serif';
          ctx.fillStyle = '#020617';
          ctx.fillText('✓ TARGET TERKUNCI', badgeX + 12, badgeY + 17);

          // 4. Baris Telemetri (3 Kotak Sejajar)
          const boxY = 522;
          const boxH = 70;
          const boxW = 230;
          const boxGap = 15;

          // Box 1: Objek
          const b1X = 40;
          drawChamferedRect(ctx, b1X, boxY, boxW, boxH, 8, 'rgba(0, 229, 255, 0.35)', 'rgba(10, 22, 40, 0.85)');
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#00E5FF';
          ctx.fillText('[ 01 ] OBJEK UTAMA', b1X + 12, boxY + 22);
          ctx.font = '700 18px "Rajdhani", sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(objectLabel.length > 18 ? objectLabel.slice(0, 17) + '…' : objectLabel, b1X + 12, boxY + 50);

          // Box 2: Dimensi
          const b2X = b1X + boxW + boxGap;
          drawChamferedRect(ctx, b2X, boxY, boxW, boxH, 8, 'rgba(0, 229, 255, 0.35)', 'rgba(10, 22, 40, 0.85)');
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#00E5FF';
          ctx.fillText('[ 02 ] ESTIMASI UKURAN', b2X + 12, boxY + 22);
          ctx.font = '700 18px "Rajdhani", sans-serif';
          ctx.fillStyle = '#00E676';
          ctx.fillText(dimensions || 'Mode Piksel', b2X + 12, boxY + 50);

          // Box 3: AI Engine
          const b3X = b2X + boxW + boxGap;
          drawChamferedRect(ctx, b3X, boxY, boxW, boxH, 8, 'rgba(0, 229, 255, 0.35)', 'rgba(10, 22, 40, 0.85)');
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#00E5FF';
          ctx.fillText('[ 03 ] VISION ENGINE', b3X + 12, boxY + 22);
          ctx.font = '700 18px "Rajdhani", sans-serif';
          ctx.fillStyle = '#7C4DFF';
          ctx.fillText(provider.toUpperCase(), b3X + 12, boxY + 50);

          // 5. Kotak Hasil Analisis AI
          const anX = 40;
          const anY = 606;
          const anW = 720;
          const anH = 376;

          drawChamferedRect(ctx, anX, anY, anW, anH, 12, 'rgba(0, 229, 255, 0.4)', 'rgba(10, 22, 40, 0.9)');

          // Header Bar Kotak Analisis
          ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
          ctx.fillRect(anX + 1, anY + 1, anW - 2, 34);
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
          ctx.beginPath();
          ctx.moveTo(anX, anY + 35);
          ctx.lineTo(anX + anW, anY + 35);
          ctx.stroke();

          ctx.font = '700 11.5px "Orbitron", sans-serif';
          ctx.fillStyle = '#00E5FF';
          ctx.fillText('🧠 HASIL ANALISIS VISUAL (AI INFERENCE)', anX + 14, anY + 23);

          ctx.textAlign = 'right';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#64748B';
          ctx.fillText('CONFIDENTIAL // FORENSIC LOG', anX + anW - 14, anY + 23);
          ctx.textAlign = 'left';

          // Teks Analisis AI (Word-Wrap)
          ctx.font = '500 16px "Rajdhani", "Segoe UI", sans-serif';
          ctx.fillStyle = '#E2E8F0';
          wrapText(ctx, analysisText, anX + 18, anY + 64, anW - 36, 25, 11);

          // 6. Footer Kartu
          const footerY = 998;
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(40, footerY);
          ctx.lineTo(760, footerY);
          ctx.stroke();

          ctx.font = '500 10.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#64748B';
          ctx.fillText('Hybrid Edge-Cloud AI • Real-Time Detection System', 42, footerY + 18);

          ctx.textAlign = 'right';
          ctx.fillStyle = '#00E5FF';
          const randHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
          ctx.fillText(`SEC-ID: BG-${randHex} • BENGGALA OS`, 758, footerY + 18);
          ctx.textAlign = 'left';

          // Konversi hasil canvas ke PNG Data URL
          currentDataUrl = canvas.toDataURL('image/png');
          currentBlob = dataUrlToBlob(currentDataUrl);

          // Pasang hasil ke elemen modal pratinjau jika ada
          const previewImg = document.getElementById('dossierPreviewImg');
          if (previewImg) {
            previewImg.src = currentDataUrl;
          }

          resolve(currentDataUrl);
        };

        // Render Gambar Target ke Canvas jika ada
        if (imageDataUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(photoX, photoY, photoW, photoH);
            ctx.clip();

            // Skalakan foto dengan cover proporsional
            const imgAspect = img.width / img.height;
            const boxAspect = photoW / photoH;
            let drawW, drawH, drawX, drawY;

            if (imgAspect > boxAspect) {
              drawH = photoH;
              drawW = photoH * imgAspect;
              drawX = photoX + (photoW - drawW) / 2;
              drawY = photoY;
            } else {
              drawW = photoW;
              drawH = photoW / imgAspect;
              drawX = photoX;
              drawY = photoY + (photoH - drawH) / 2;
            }

            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();

            renderAfterImage();
          };
          img.onerror = () => {
            ctx.font = '500 14px "JetBrains Mono", monospace';
            ctx.fillStyle = '#64748B';
            ctx.textAlign = 'center';
            ctx.fillText('[Gambar Target Tidak Dapat Dimuat]', photoX + photoW / 2, photoY + photoH / 2);
            ctx.textAlign = 'left';
            renderAfterImage();
          };
          img.src = imageDataUrl;
        } else {
          ctx.font = '500 14px "JetBrains Mono", monospace';
          ctx.fillStyle = '#64748B';
          ctx.textAlign = 'center';
          ctx.fillText('[Tidak Ada Gambar Target]', photoX + photoW / 2, photoY + photoH / 2);
          ctx.textAlign = 'left';
          renderAfterImage();
        }
      });
    },

    /**
     * Buka modal pratinjau kartu dossier
     */
    openModal: function () {
      const modal = document.getElementById('dossierModal');
      if (modal) {
        modal.style.display = 'flex';
      }
    },

    /**
     * Tutup modal pratinjau kartu dossier
     */
    closeModal: function () {
      const modal = document.getElementById('dossierModal');
      if (modal) {
        modal.style.display = 'none';
      }
    },

    /**
     * Unduh kartu dossier sebagai PNG
     */
    downloadCard: function (filename) {
      if (!currentDataUrl) {
        if (typeof window.showToast === 'function') {
          window.showToast('Belum ada kartu dossier yang dibuat.', 'error');
        }
        return;
      }
      const fname = filename || generateFilename();
      const a = document.createElement('a');
      a.href = currentDataUrl;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (typeof window.showToast === 'function') {
        window.showToast(`Kartu dossier diunduh: ${fname}`, 'success');
      }
    },

    /**
     * Bagikan kartu dossier via Web Share API (Mobile) atau fallback unduh (PC)
     */
    shareCard: async function () {
      if (!currentDataUrl) {
        if (typeof window.showToast === 'function') {
          window.showToast('Belum ada kartu dossier yang dibuat.', 'error');
        }
        return;
      }

      const fname = generateFilename();
      const blob = currentBlob || dataUrlToBlob(currentDataUrl);
      const file = new File([blob], fname, { type: 'image/png' });

      // Cek apakah browser mendukung Web Share API untuk file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Benggala Target Dossier',
            text: `Hasil Analisis Target Dossier (${currentCardData?.objectLabel || 'Objek'}) - Benggala OS`
          });
          return;
        } catch (err) {
          if (err.name === 'AbortError') {
            return;
          }
          console.warn('Web Share API error, fallback ke unduh:', err);
        }
      }

      // Fallback untuk desktop / browser yang tidak mendukung Web Share file
      this.downloadCard(fname);
    }
  };

  window.BenggalaDossier = BenggalaDossier;
})();
