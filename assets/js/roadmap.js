/**
 * BENGGALA // YOULO OS - Mode Transmisi Taktis & Breaking News (Visi 2027)
 * Interactive Tactical Presentation & Live Breaking News Ticker (Client-Side, 0% Server Load)
 */

(function () {
  'use strict';

  // 1. Definisi 5 Slide Roadmap Berbasis Pendanaan & Ekosistem Google
  const SLIDES = [
    {
      num: '01',
      tag: 'FASE 1 // REAL-TIME CLOUD',
      title: 'GEMINI LIVE API (STREAMING 2 ARAH)',
      current: 'Auto-Lock 4 detik dan snapshot bertahap berbasis REST API untuk menjaga efisiensi kuota gratis server.',
      target: 'Upgrade ke Google Gemini Multimodal Live API (WebSockets). Kamera & mikrofon terhubung real-time streaming tanpa jeda; penyandang tunanetra bisa langsung mengobrol natural dua arah selayaknya berbicara dengan pemandu visual manusia.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Background Grid Taktis -->
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>
        <path d="M60 10V210M120 10V210M180 10V210M240 10V210M300 10V210" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>
        
        <!-- Kamera Optik & Lensa Reticle -->
        <circle cx="95" cy="110" r="50" stroke="#00E5FF" stroke-width="2" stroke-dasharray="8 4"/>
        <circle cx="95" cy="110" r="35" fill="rgba(0,229,255,0.08)" stroke="#00E676" stroke-width="1.5"/>
        <circle cx="95" cy="110" r="18" fill="#0A1628" stroke="#00E5FF" stroke-width="2"/>
        <circle cx="95" cy="110" r="7" fill="#00E676"/>
        <line x1="95" y1="52" x2="95" y2="68" stroke="#00E5FF" stroke-width="2"/>
        <line x1="95" y1="152" x2="95" y2="168" stroke="#00E5FF" stroke-width="2"/>
        <line x1="37" y1="110" x2="53" y2="110" stroke="#00E5FF" stroke-width="2"/>
        <line x1="137" y1="110" x2="153" y2="110" stroke="#00E5FF" stroke-width="2"/>

        <!-- Gelombang Suara Audio Dua Arah (Voice Waveforms) -->
        <rect x="160" y="98" width="4" height="24" rx="2" fill="#FFAB00"/>
        <rect x="170" y="85" width="4" height="50" rx="2" fill="#00E5FF"/>
        <rect x="180" y="70" width="4" height="80" rx="2" fill="#00E676"/>
        <rect x="190" y="88" width="4" height="44" rx="2" fill="#00E5FF"/>
        <rect x="200" y="95" width="4" height="30" rx="2" fill="#FFAB00"/>

        <!-- Google Gemini Live Cloud Node & Satelit -->
        <g transform="translate(225, 60)">
          <!-- Cloud Path -->
          <path d="M30 50C24 50 15 54 15 65C15 75 25 80 35 80H80C90 80 98 72 98 62C98 52 90 45 80 45C79 32 68 22 55 22C44 22 35 28 32 38C26 38 20 44 20 50" stroke="#00E5FF" stroke-width="2.2" fill="rgba(0,229,255,0.12)"/>
          <!-- Sinyal Streaming -->
          <circle cx="55" cy="52" r="14" stroke="#00E676" stroke-width="1.5" stroke-dasharray="3 3"/>
          <circle cx="55" cy="52" r="5" fill="#00E676"/>
          <!-- Label Satelit / Cloud -->
          <text x="55" y="96" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="9" text-anchor="middle" font-weight="bold">GEMINI 3.8 LIVE</text>
        </g>

        <!-- Panah Transmisi Streaming Dua Arah -->
        <path d="M148 102H156M208 102H220" stroke="#00E676" stroke-width="2" stroke-linecap="round"/>
        <polygon points="158,102 153,98 153,106" fill="#00E676"/>
        <polygon points="210,102 215,98 215,106" fill="#00E676"/>
        <text x="180" y="172" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle" letter-spacing="1">BIDIRECTIONAL WEBSOCKETS</text>
      </svg>`
    },
    {
      num: '02',
      tag: 'FASE 2 // SPESIALISASI INDUSTRI',
      title: 'CUSTOM AI VIA GOOGLE VERTEX AI',
      current: 'Model umum COCO-SSD bawaan (80 kelas objek standar dunia seperti orang, kursi, tas, mobil).',
      target: 'Pelatihan model visi kustom di Google Cloud Vertex AI untuk sektor spesifik lokal: klasifikasi penyakit/hama tanaman pertanian & kematangan buah, inspeksi cacat kemasan UMKM, hingga pembacaan pelat nomor kendaraan otomatis (ANPR).',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>
        <path d="M60 10V210M120 10V210M180 10V210M240 10V210M300 10V210" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>

        <!-- Chip Prosesor Neural Google Vertex AI -->
        <g transform="translate(45, 60)">
          <rect x="20" y="20" width="70" height="70" rx="8" fill="#0A1628" stroke="#00E5FF" stroke-width="2"/>
          <rect x="35" y="35" width="40" height="40" rx="4" fill="rgba(0,229,255,0.15)" stroke="#00E676" stroke-width="1.5"/>
          <!-- Core Vertex Nodes -->
          <circle cx="55" cy="55" r="6" fill="#00E5FF"/>
          <line x1="42" y1="42" x2="68" y2="68" stroke="#FFAB00" stroke-width="1.5"/>
          <line x1="68" y1="42" x2="42" y2="68" stroke="#FFAB00" stroke-width="1.5"/>
          <!-- Pin Kiri, Kanan, Atas, Bawah -->
          <path d="M20 35H10M20 55H10M20 75H10M90 35H100M90 55H100M90 75H100M35 20V10M55 20V10M75 20V10M35 90V100M55 90V100M75 90V100" stroke="#00E5FF" stroke-width="1.5"/>
          <text x="55" y="108" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle" font-weight="bold">VERTEX AI</text>
        </g>

        <!-- Jalur Bus Data & Neural Links -->
        <path d="M145 115H200M200 115L235 75M200 115L235 155" stroke="#00E676" stroke-width="2" stroke-dasharray="4 2"/>

        <!-- Node Sektor 1: Agritech / Daun & Hama -->
        <g transform="translate(235, 45)">
          <circle cx="30" cy="30" r="28" fill="#0A1628" stroke="#00E676" stroke-width="2"/>
          <!-- Daun Simbolik -->
          <path d="M20 35C20 22 32 15 42 16C42 28 34 38 20 40Z" fill="rgba(0,230,118,0.25)" stroke="#00E676" stroke-width="1.5"/>
          <path d="M20 40L38 20" stroke="#00E676" stroke-width="1.2"/>
          <text x="30" y="47" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="7.5" text-anchor="middle">AGRI-VISION</text>
        </g>

        <!-- Node Sektor 2: QC Pabrik / UMKM -->
        <g transform="translate(235, 125)">
          <circle cx="30" cy="30" r="28" fill="#0A1628" stroke="#FFAB00" stroke-width="2"/>
          <!-- Gigi Gear QC -->
          <circle cx="30" cy="30" r="10" stroke="#FFAB00" stroke-width="2" fill="none"/>
          <path d="M30 16V22M30 38V44M16 30H22M38 30H44M20 20L25 25M35 35L40 40M40 20L35 25M25 35L20 40" stroke="#FFAB00" stroke-width="2"/>
          <text x="30" y="47" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="7.5" text-anchor="middle">QC UMKM</text>
        </g>

        <text x="180" y="195" fill="#E2E8F0" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">MODEL CUSTOM: AKURASI HINGGA 99.4%</text>
      </svg>`
    },
    {
      num: '03',
      tag: 'FASE 3 // SKALA KOTA & DESA',
      title: 'COMMAND CENTER & GOOGLE MAPS 3D',
      current: '1 perangkat = 1 kamera lokal pada server Apache/PHP Shared Hosting.',
      target: 'Arsitektur Serverless Google Cloud Run & Firebase Realtime Database untuk agregasi ratusan CCTV aktif sekaligus secara terpusat, dengan titik koordinat insiden darurat langsung dipetakan pada Google Maps 3D Photorealistic Tiles.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        
        <!-- Peta Grid Isometrik 3D Google Maps -->
        <g transform="translate(180, 115) scale(1, 0.5) rotate(45)">
          <rect x="-90" y="-90" width="180" height="180" fill="#0A1628" stroke="#00E5FF" stroke-width="2"/>
          <path d="M-60 -90V90M-30 -90V90M0 -90V90M30 -90V90M60 -90V90" stroke="rgba(0,229,255,0.2)" stroke-width="1"/>
          <path d="M-90 -60H90M-90 -30H90M-90 0H90M-90 30H90M-90 60H90" stroke="rgba(0,229,255,0.2)" stroke-width="1"/>
          <!-- Gedung 3D Block -->
          <rect x="-20" y="-40" width="30" height="30" fill="rgba(0,229,255,0.3)" stroke="#00E5FF" stroke-width="1.5"/>
          <rect x="20" y="10" width="40" height="40" fill="rgba(255,171,0,0.3)" stroke="#FFAB00" stroke-width="1.5"/>
        </g>

        <!-- Titik Radar Titik Alarm Real-Time 1 -->
        <g transform="translate(140, 95)">
          <circle cx="0" cy="0" r="14" stroke="#FF1744" stroke-width="1.5" stroke-dasharray="3 3"/>
          <circle cx="0" cy="0" r="4" fill="#FF1744"/>
          <line x1="0" y1="0" x2="0" y2="-22" stroke="#FF1744" stroke-width="1.5"/>
          <rect x="-22" y="-35" width="44" height="13" rx="2" fill="#FF1744"/>
          <text x="0" y="-26" fill="#FFF" font-family="'JetBrains Mono', monospace" font-size="7" text-anchor="middle" font-weight="bold">ALARM 01</text>
        </g>

        <!-- Titik Radar Titik Alarm Real-Time 2 -->
        <g transform="translate(230, 80)">
          <circle cx="0" cy="0" r="14" stroke="#00E676" stroke-width="1.5" stroke-dasharray="3 3"/>
          <circle cx="0" cy="0" r="4" fill="#00E676"/>
          <line x1="0" y1="0" x2="0" y2="-22" stroke="#00E676" stroke-width="1.5"/>
          <rect x="-24" y="-35" width="48" height="13" rx="2" fill="#00E676"/>
          <text x="0" y="-26" fill="#020617" font-family="'JetBrains Mono', monospace" font-size="7" text-anchor="middle" font-weight="bold">SECURE 02</text>
        </g>

        <!-- Titik Radar Titik Alarm Real-Time 3 -->
        <g transform="translate(200, 140)">
          <circle cx="0" cy="0" r="10" stroke="#00E5FF" stroke-width="1.2"/>
          <circle cx="0" cy="0" r="3" fill="#00E5FF"/>
          <rect x="-20" y="-25" width="40" height="12" rx="2" fill="#00E5FF"/>
          <text x="0" y="-17" fill="#020617" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle" font-weight="bold">PATROL 03</text>
        </g>

        <!-- Satelit & Cloud Run Banner -->
        <rect x="25" y="15" width="125" height="22" rx="3" fill="rgba(10,22,40,0.8)" stroke="#00E5FF" stroke-width="1"/>
        <text x="87" y="30" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8" text-anchor="middle">GOOGLE CLOUD RUN // 3D MAPS</text>
        
        <text x="180" y="200" fill="#94A3B8" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">MULTI-CCTV SYNCHRONIZATION VIA FIREBASE REALTIME</text>
      </svg>`
    },
    {
      num: '04',
      tag: 'FASE 4 // HARDWARE EDGE AI',
      title: 'KACAMATA PINTAR & OTOMASI IOT',
      current: 'Aplikasi web-based berjalan melalui antarmuka browser smartphone dan PC desktop.',
      target: 'Pengembangan prototipe Kacamata Pintar Tunanetra (Bone-Conduction Audio, 100% hands-free) dan jembatan transmisi IoT ESP32 / Industrial PLC untuk menggerakkan servo aktuator pemilah sampah organik/anorganik dan lengan robotik sortir QC secara mekanis.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>
        
        <!-- Ilustrasi Kacamata Pintar Futuristik (Smart Glasses HUD) -->
        <g transform="translate(60, 40)">
          <!-- Frame Kacamata -->
          <path d="M20 40H80C90 40 100 48 110 65C120 48 130 40 140 40H200C215 40 225 50 220 75C215 100 195 105 175 105H145C130 105 120 85 110 85C100 85 90 105 75 105H45C25 105 5 100 0 75C-5 50 5 40 20 40Z" fill="rgba(0,229,255,0.08)" stroke="#00E5FF" stroke-width="2.5"/>
          <!-- Lensa Kiri & Kanan HUD Lines -->
          <rect x="25" y="55" width="60" height="35" rx="4" fill="rgba(0,230,118,0.15)" stroke="#00E676" stroke-width="1.2"/>
          <rect x="135" y="55" width="60" height="35" rx="4" fill="rgba(0,230,118,0.15)" stroke="#00E676" stroke-width="1.2"/>
          <line x1="35" y1="72" x2="75" y2="72" stroke="#00E676" stroke-width="1" stroke-dasharray="3 2"/>
          <line x1="145" y1="72" x2="185" y2="72" stroke="#00E676" stroke-width="1" stroke-dasharray="3 2"/>
          <!-- Bone Conduction Audio Nodes -->
          <circle cx="5" cy="50" r="9" fill="#FFAB00"/>
          <circle cx="215" cy="50" r="9" fill="#FFAB00"/>
          <path d="M-8 42C-13 46 -13 54 -8 58M228 42C233 46 233 54 228 58" stroke="#FFAB00" stroke-width="1.8"/>
          <text x="110" y="32" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle" font-weight="bold">BONE-CONDUCTION GLASSES</text>
        </g>

        <!-- Modul Mikrokontroler IoT ESP32 & Aktuator PLC -->
        <g transform="translate(110, 145)">
          <rect x="0" y="0" width="140" height="42" rx="5" fill="#0A1628" stroke="#7C4DFF" stroke-width="2"/>
          <!-- Antena Wi-Fi / Bluetooth -->
          <rect x="8" y="6" width="22" height="30" rx="2" fill="rgba(124,77,255,0.3)" stroke="#7C4DFF" stroke-width="1"/>
          <!-- Chip ESP32 -->
          <rect x="42" y="8" width="30" height="26" rx="2" fill="#020617" stroke="#00E5FF" stroke-width="1"/>
          <text x="57" y="24" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="6" text-anchor="middle">ESP32</text>
          <!-- Terminal Output Servo / PLC -->
          <circle cx="95" cy="14" r="3" fill="#00E676"/>
          <circle cx="110" cy="14" r="3" fill="#00E676"/>
          <circle cx="125" cy="14" r="3" fill="#00E676"/>
          <text x="110" y="32" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="7" text-anchor="middle">SERVO &amp; PLC RELAY</text>
        </g>

        <!-- Garis Penghubung Sinyal Wireless -->
        <path d="M180 135V145" stroke="#00E5FF" stroke-width="1.5" stroke-dasharray="2 2"/>
        <text x="180" y="208" fill="#94A3B8" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">100% HANDS-FREE WEARABLE &amp; PHYSICAL AUTOMATION</text>
      </svg>`
    },
    {
      num: '05',
      tag: 'FASE 5 // INTEGRASI INSTANSI',
      title: 'ENTERPRISE WHATSAPP & BIGQUERY',
      current: 'Notifikasi instan via Telegram Bot API dan ekspor berkas data laporan CSV/Excel.',
      target: 'Integrasi resmi WhatsApp Business Platform (API terverifikasi centang hijau), SMS Gateway broadcast darurat, dan agregasi log telemetri ke Google BigQuery & Looker Studio untuk dashboard analitik instansi pemerintah, kepolisian, & Smart Village.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>

        <!-- Grafik Batang Analitik BigQuery (Rising Bar Chart) -->
        <g transform="translate(40, 60)">
          <!-- Axis -->
          <line x1="20" y1="100" x2="140" y2="100" stroke="#00E5FF" stroke-width="1.5"/>
          <line x1="20" y1="100" x2="20" y2="10" stroke="#00E5FF" stroke-width="1.5"/>
          <!-- Bars -->
          <rect x="32" y="65" width="16" height="35" fill="rgba(0,229,255,0.4)" stroke="#00E5FF" stroke-width="1"/>
          <rect x="58" y="45" width="16" height="55" fill="rgba(0,230,118,0.4)" stroke="#00E676" stroke-width="1"/>
          <rect x="84" y="30" width="16" height="70" fill="rgba(255,171,0,0.4)" stroke="#FFAB00" stroke-width="1"/>
          <rect x="110" y="15" width="16" height="85" fill="rgba(0,229,255,0.8)" stroke="#00E5FF" stroke-width="1.5"/>
          <!-- Trend Curve Spline -->
          <path d="M40 60C60 48 85 28 118 10" stroke="#00E676" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="118" cy="10" r="3.5" fill="#00E676"/>
          <text x="80" y="118" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8" text-anchor="middle">BIGQUERY TELEMETRY</text>
        </g>

        <!-- Sinyal WhatsApp Business & Enterprise Gateway -->
        <g transform="translate(200, 60)">
          <!-- Silinder Database Google BigQuery -->
          <ellipse cx="65" cy="22" rx="35" ry="12" fill="#0A1628" stroke="#00E5FF" stroke-width="1.8"/>
          <path d="M30 22V55C30 62 45 67 65 67C85 67 100 62 100 55V22" fill="#0A1628" stroke="#00E5FF" stroke-width="1.8"/>
          <ellipse cx="65" cy="38" rx="35" ry="10" stroke="rgba(0,229,255,0.3)" stroke-width="1"/>
          <text x="65" y="50" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8" text-anchor="middle" font-weight="bold">LOOKER STUDIO</text>
          
          <!-- Badge WhatsApp Enterprise -->
          <rect x="15" y="80" width="100" height="28" rx="6" fill="#075E54" stroke="#25D366" stroke-width="1.5"/>
          <circle cx="32" cy="94" r="8" fill="#25D366"/>
          <!-- Ikon Telepon WhatsApp Sederhana -->
          <path d="M29 91C29 95 33 98 36 97" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/>
          <text x="70" y="98" fill="#FFF" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="bold">WA BUSINESS</text>
        </g>

        <!-- Jalur Sinkronisasi Data Antar-Instansi -->
        <path d="M165 105H195" stroke="#FFAB00" stroke-width="2" stroke-dasharray="3 3"/>
        <text x="180" y="200" fill="#94A3B8" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">OFFICIAL GOVERNMENT &amp; SMART CITY COMPLIANT</text>
      </svg>`
    }
  ];

  // State Modul
  let currentSlideIndex = 0;
  let isPlaying = true;
  let autoPlayTimer = null;
  const SLIDE_DURATION_MS = 8000;

  // Audio Context Ringan untuk Beep Taktis (880Hz, 0.06 detik)
  function playTacticalBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      // Volume sangat pelan (gain 0.035) agar elegan & tidak mengganggu
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.06);

      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
      }, 150);
    } catch (e) {
      // Non-blocking fallback
    }
  }

  // Render Slide ke Elemen DOM
  function renderSlide(index) {
    if (index < 0) index = SLIDES.length - 1;
    if (index >= SLIDES.length) index = 0;
    currentSlideIndex = index;

    const slide = SLIDES[currentSlideIndex];
    if (!slide) return;

    // Bunyikan beep taktis pelan
    playTacticalBeep();

    const slideNumEl = document.getElementById('roadmapSlideNum');
    const phaseTagEl = document.getElementById('roadmapPhaseTag');
    const titleEl = document.getElementById('roadmapSlideTitle');
    const currentTextEl = document.getElementById('roadmapCurrentText');
    const targetTextEl = document.getElementById('roadmapTargetText');
    const svgFrameEl = document.getElementById('roadmapSvgFrame');
    const contentColEl = document.getElementById('roadmapContentCol');

    if (slideNumEl) slideNumEl.textContent = slide.num;
    if (phaseTagEl) phaseTagEl.textContent = slide.tag;
    if (titleEl) titleEl.textContent = slide.title;
    if (currentTextEl) currentTextEl.textContent = slide.current;
    if (targetTextEl) targetTextEl.textContent = slide.target;
    if (svgFrameEl) svgFrameEl.innerHTML = slide.svg;

    // Efek Transisi Fade-In Ringan (250ms)
    if (contentColEl) {
      contentColEl.classList.remove('slide-fade-active');
      void contentColEl.offsetWidth; // Trigger reflow
      contentColEl.classList.add('slide-fade-active');
    }
    if (svgFrameEl) {
      svgFrameEl.classList.remove('slide-fade-active');
      void svgFrameEl.offsetWidth; // Trigger reflow
      svgFrameEl.classList.add('slide-fade-active');
    }
  }

  // Timer Auto-Play
  function startAutoPlay() {
    stopAutoPlay();
    if (!isPlaying) return;
    autoPlayTimer = setInterval(() => {
      renderSlide(currentSlideIndex + 1);
    }, SLIDE_DURATION_MS);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  // Modul Global BenggalaRoadmap
  const BenggalaRoadmap = {
    slides: SLIDES,

    /**
     * Tampilkan overlay mode transmisi taktis
     */
    open: function () {
      const overlay = document.getElementById('roadmapOverlay');
      if (overlay) {
        overlay.style.display = 'flex';
        renderSlide(currentSlideIndex);
        if (isPlaying) {
          startAutoPlay();
        }
      }
    },

    /**
     * Tutup overlay mode transmisi taktis
     */
    close: function () {
      const overlay = document.getElementById('roadmapOverlay');
      if (overlay) {
        overlay.style.display = 'none';
        stopAutoPlay();
      }
    },

    /**
     * Pindah ke slide berikutnya
     */
    nextSlide: function () {
      renderSlide(currentSlideIndex + 1);
      if (isPlaying) startAutoPlay();
    },

    /**
     * Pindah ke slide sebelumnya
     */
    prevSlide: function () {
      renderSlide(currentSlideIndex - 1);
      if (isPlaying) startAutoPlay();
    },

    /**
     * Toggle Play/Pause perputaran otomatis
     */
    togglePlay: function () {
      isPlaying = !isPlaying;
      const btnPause = document.getElementById('btnRoadmapPause');
      if (btnPause) {
        btnPause.innerHTML = isPlaying ? '⏸' : '▶';
        btnPause.title = isPlaying ? 'Jeda Otomatis' : 'Lanjutkan Otomatis';
      }
      if (isPlaying) {
        startAutoPlay();
      } else {
        stopAutoPlay();
      }
    },

    /**
     * Akses status aktif overlay
     */
    isOpen: function () {
      const overlay = document.getElementById('roadmapOverlay');
      return overlay ? overlay.style.display !== 'none' : false;
    }
  };

  window.BenggalaRoadmap = BenggalaRoadmap;

  // Auto-init DOM events saat halaman selesai termuat
  document.addEventListener('DOMContentLoaded', () => {
    const btnRoadmap = document.getElementById('btnRoadmap');
    if (btnRoadmap) {
      btnRoadmap.addEventListener('click', () => {
        BenggalaRoadmap.open();
      });
    }

    const btnCloseRoadmap = document.getElementById('btnCloseRoadmap');
    if (btnCloseRoadmap) {
      btnCloseRoadmap.addEventListener('click', () => {
        BenggalaRoadmap.close();
      });
    }

    const btnRoadmapPrev = document.getElementById('btnRoadmapPrev');
    if (btnRoadmapPrev) {
      btnRoadmapPrev.addEventListener('click', () => {
        BenggalaRoadmap.prevSlide();
      });
    }

    const btnRoadmapNext = document.getElementById('btnRoadmapNext');
    if (btnRoadmapNext) {
      btnRoadmapNext.addEventListener('click', () => {
        BenggalaRoadmap.nextSlide();
      });
    }

    const btnRoadmapPause = document.getElementById('btnRoadmapPause');
    if (btnRoadmapPause) {
      btnRoadmapPause.addEventListener('click', () => {
        BenggalaRoadmap.togglePlay();
      });
    }

    const backdrop = document.getElementById('roadmapBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        BenggalaRoadmap.close();
      });
    }
  });

})();
