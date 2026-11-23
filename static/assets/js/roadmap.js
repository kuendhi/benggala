/**
 * BENGGALA // YOULO OS - Mode Transmisi Taktis & Breaking News (Visi 2027)
 * Interactive Tactical Presentation: 6 Slides (3 Cloud AI + 3 Physical AI / ESP32 Concepts)
 * Includes Live ESP32 Signal Simulation Terminal & Juror Voice Narration
 */

(function () {
  'use strict';

  // 1. Definisi 6 Slide Tajam (3 Cloud AI + 3 Konsep Physical AI / ESP32)
  const SLIDES = [
    {
      num: '01',
      tag: 'CLOUD AI // FASE 1',
      title: 'GEMINI LIVE API (STREAMING 2 ARAH)',
      now: 'Auto-Lock 4 detik (hemat kuota gratis).',
      future: 'Upgrade ke Google Gemini Multimodal Live API (WebSockets) agar pengguna & tunanetra bisa mengobrol real-time dengan kamera tanpa jeda.',
      impact: '⚡ Respon Interaktif Tanpa Jeda',
      narration: 'Fase satu, dengan pendanaan kami upgrade ke Gemini Live API agar kamera dan suara terhubung streaming dua arah tanpa jeda.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        <!-- Gelombang Suara Audio Dua Arah Beranimasi -->
        <path class="svg-pulse-line" d="M150 110H220" stroke="#00E676" stroke-width="2.5"/>
        <rect x="160" y="98" width="4" height="24" rx="2" fill="#FFAB00"/>
        <rect x="170" y="85" width="4" height="50" rx="2" fill="#00E5FF"/>
        <rect x="180" y="70" width="4" height="80" rx="2" fill="#00E676"/>
        <rect x="190" y="88" width="4" height="44" rx="2" fill="#00E5FF"/>
        <rect x="200" y="95" width="4" height="30" rx="2" fill="#FFAB00"/>

        <!-- Google Gemini Live Cloud Node & Satelit -->
        <g transform="translate(225, 60)">
          <path d="M30 50C24 50 15 54 15 65C15 75 25 80 35 80H80C90 80 98 72 98 62C98 52 90 45 80 45C79 32 68 22 55 22C44 22 35 28 32 38C26 38 20 44 20 50" stroke="#00E5FF" stroke-width="2.2" fill="rgba(0,229,255,0.12)"/>
          <circle cx="55" cy="52" r="14" stroke="#00E676" stroke-width="1.5" stroke-dasharray="3 3"/>
          <circle cx="55" cy="52" r="5" fill="#00E676"/>
          <text x="55" y="96" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="9" text-anchor="middle" font-weight="bold">GEMINI 3.8 LIVE</text>
        </g>

        <text x="180" y="176" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle" letter-spacing="1">BIDIRECTIONAL WEBSOCKETS</text>
      </svg>`
    },
    {
      num: '02',
      tag: 'CLOUD AI // FASE 2',
      title: 'CUSTOM MODEL GOOGLE VERTEX AI',
      now: 'Model umum COCO-SSD (80 objek standar).',
      future: 'Latih model khusus di Google Vertex AI untuk hama pertanian, cacat kemasan pabrik UMKM, dan baca pelat nomor (ANPR).',
      impact: '🎯 Akurasi Spesifik Industri Lokal',
      narration: 'Fase dua, melatih model khusus di Google Vertex AI untuk mendeteksi hama pertanian, cacat kemasan UMKM, hingga pelat nomor.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>

        <!-- Chip Prosesor Neural Google Vertex AI -->
        <g transform="translate(45, 60)">
          <rect x="20" y="20" width="70" height="70" rx="8" fill="#0A1628" stroke="#00E5FF" stroke-width="2"/>
          <rect x="35" y="35" width="40" height="40" rx="4" fill="rgba(0,229,255,0.15)" stroke="#00E676" stroke-width="1.5"/>
          <circle cx="55" cy="55" r="6" fill="#00E5FF"/>
          <line x1="42" y1="42" x2="68" y2="68" stroke="#FFAB00" stroke-width="1.5"/>
          <line x1="68" y1="42" x2="42" y2="68" stroke="#FFAB00" stroke-width="1.5"/>
          <path d="M20 35H10M20 55H10M20 75H10M90 35H100M90 55H100M90 75H100M35 20V10M55 20V10M75 20V10M35 90V100M55 90V100M75 90V100" stroke="#00E5FF" stroke-width="1.5"/>
          <text x="55" y="108" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle" font-weight="bold">VERTEX AI</text>
        </g>

        <!-- Garis Bus Data Beranimasi Sinyal Pulsa -->
        <path class="svg-pulse-line" d="M145 115H200M200 115L235 65M200 115L235 115M200 115L235 165" stroke="#00E676" stroke-width="2"/>

        <!-- 3 Node Spesialisasi Industri -->
        <g transform="translate(235, 40)">
          <circle cx="25" cy="25" r="22" fill="#0A1628" stroke="#00E676" stroke-width="1.8"/>
          <path d="M17 30C17 18 27 12 35 13C35 23 28 31 17 33Z" fill="rgba(0,230,118,0.3)" stroke="#00E676" stroke-width="1.2"/>
          <text x="60" y="28" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="bold">PERTANIAN &amp; HAMA</text>
        </g>

        <g transform="translate(235, 90)">
          <circle cx="25" cy="25" r="22" fill="#0A1628" stroke="#FFAB00" stroke-width="1.8"/>
          <circle cx="25" cy="25" r="8" stroke="#FFAB00" stroke-width="1.5"/>
          <path d="M25 13V18M25 32V37M13 25H18M32 25H37" stroke="#FFAB00" stroke-width="1.8"/>
          <text x="60" y="28" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="bold">CACAT QC UMKM</text>
        </g>

        <g transform="translate(235, 140)">
          <circle cx="25" cy="25" r="22" fill="#0A1628" stroke="#00E5FF" stroke-width="1.8"/>
          <rect x="14" y="18" width="22" height="14" rx="2" stroke="#00E5FF" stroke-width="1.2"/>
          <text x="25" y="28" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="6" text-anchor="middle">ANPR</text>
          <text x="60" y="28" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="bold">PELAT NOMOR</text>
        </g>

        <text x="180" y="202" fill="#94A3B8" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">MODEL TRAINING KUSTOM // GOOGLE CLOUD VERTEX AI</text>
      </svg>`
    },
    {
      num: '03',
      tag: 'CLOUD AI // FASE 3',
      title: 'COMMAND CENTER & GOOGLE MAPS 3D',
      now: '1 perangkat = 1 kamera di Shared Hosting.',
      future: 'Migrasi ke Google Cloud Run + Firebase untuk memantau ratusan CCTV sekaligus dengan titik alarm di Google Maps 3D.',
      impact: '🗺️ Pantau Ratusan Titik Sekaligus',
      narration: 'Fase tiga, membangun Command Center berbasis Google Cloud dan Maps 3D untuk memantau ratusan kamera secara bersamaan.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        
        <!-- Peta Grid Isometrik 3D Google Maps -->
        <g transform="translate(180, 115) scale(1, 0.5) rotate(45)">
          <rect x="-90" y="-90" width="180" height="180" fill="#0A1628" stroke="#00E5FF" stroke-width="2"/>
          <path d="M-60 -90V90M-30 -90V90M0 -90V90M30 -90V90M60 -90V90" stroke="rgba(0,229,255,0.2)" stroke-width="1"/>
          <path d="M-90 -60H90M-90 -30H90M-90 0H90M-90 30H90M-90 60H90" stroke="rgba(0,229,255,0.2)" stroke-width="1"/>
          <rect x="-20" y="-40" width="30" height="30" fill="rgba(0,229,255,0.3)" stroke="#00E5FF" stroke-width="1.5"/>
          <rect x="20" y="10" width="40" height="40" fill="rgba(255,171,0,0.3)" stroke="#FFAB00" stroke-width="1.5"/>
        </g>

        <!-- Garis Uplink Beranimasi -->
        <path class="svg-pulse-line" d="M140 70V15M230 55V15M200 115V15" stroke="#00E5FF" stroke-width="1.5"/>

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

        <rect x="25" y="15" width="135" height="22" rx="3" fill="rgba(10,22,40,0.8)" stroke="#00E5FF" stroke-width="1"/>
        <text x="92" y="30" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8" text-anchor="middle">GOOGLE CLOUD RUN // 3D MAPS</text>
        
        <text x="180" y="202" fill="#94A3B8" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">MULTI-CCTV SYNCHRONIZATION VIA FIREBASE REALTIME</text>
      </svg>`
    },
    {
      num: '04',
      tag: 'KONSEP IOT ESP32 // FASE 4',
      title: 'KONSEP ESP32: AUTO-TRACKING & ACTIVE CCTV',
      now: 'Kamera diam & alarm sirine browser.',
      future: 'Koordinat objek menggerakkan Servo Pan-Tilt ESP32 (kamera pengejar target) serta Relay lampu sorot 100W & sirine 120dB.',
      impact: '🛡️ CCTV Aktif Biaya Di Bawah Rp 150 Ribu',
      narration: 'Fase empat, konsep integrasi ESP32 untuk menggerakkan kamera pengejar target otomatis serta menyalakan lampu sorot dan sirine fisik.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>

        <!-- Modul ESP32 Controller -->
        <g transform="translate(35, 65)">
          <rect x="0" y="0" width="85" height="100" rx="6" fill="#0A1628" stroke="#7C4DFF" stroke-width="2"/>
          <rect x="15" y="10" width="55" height="40" rx="3" fill="#020617" stroke="#00E5FF" stroke-width="1.2"/>
          <text x="42" y="34" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="9" text-anchor="middle" font-weight="bold">ESP32</text>
          <text x="42" y="44" fill="#7C4DFF" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle">WI-FI/BLE</text>
          <!-- Pin GPIO -->
          <circle cx="15" cy="65" r="3" fill="#00E676"/>
          <circle cx="15" cy="78" r="3" fill="#FFAB00"/>
          <circle cx="15" cy="90" r="3" fill="#00E5FF"/>
          <text x="48" y="70" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="6.5">GPIO 18: PAN</text>
          <text x="48" y="82" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="6.5">GPIO 19: TILT</text>
          <text x="48" y="93" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="6.5">GPIO 23: RELAY</text>
        </g>

        <!-- Garis Bus Sinyal PWM Beranimasi -->
        <path class="svg-pulse-line" d="M120 115H175M175 115V75H210M175 115V145H210" stroke="#00E676" stroke-width="2"/>

        <!-- Servo Pan-Tilt Gimbal Kamera -->
        <g transform="translate(210, 45)">
          <rect x="0" y="0" width="120" height="58" rx="5" fill="#0A1628" stroke="#00E5FF" stroke-width="1.5"/>
          <circle cx="35" cy="29" r="16" fill="#020617" stroke="#00E676" stroke-width="1.5"/>
          <circle cx="35" cy="29" r="6" fill="#00E5FF"/>
          <text x="75" y="25" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8" font-weight="bold">SERVO PAN-TILT</text>
          <text x="75" y="38" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="7">AUTO-TRACK 180°</text>
          <!-- Sudut Pelacakan -->
          <path d="M22 17A18 18 0 0 1 48 17" stroke="#FFAB00" stroke-width="1.5" stroke-dasharray="2 2"/>
        </g>

        <!-- Modul Relay Lampu Sorot & Sirine Fisik -->
        <g transform="translate(210, 115)">
          <rect x="0" y="0" width="120" height="58" rx="5" fill="#0A1628" stroke="#FF1744" stroke-width="1.5"/>
          <rect x="12" y="14" width="26" height="30" rx="3" fill="#020617" stroke="#FF1744" stroke-width="1.2"/>
          <text x="25" y="32" fill="#FF1744" font-family="'JetBrains Mono', monospace" font-size="7" text-anchor="middle">RELAY</text>
          <text x="72" y="24" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="7.5" font-weight="bold">LAMPU 100W</text>
          <text x="72" y="36" fill="#FF1744" font-family="'JetBrains Mono', monospace" font-size="7.5" font-weight="bold">SIRINE 120dB</text>
          <text x="72" y="47" fill="#E2E8F0" font-family="'JetBrains Mono', monospace" font-size="6.5">AKTIF OTOMATIS</text>
        </g>

        <text x="180" y="198" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">ESP32 LOW-COST HARDWARE // TARGET TRACKING MEKANIS</text>
      </svg>`
    },
    {
      num: '05',
      tag: 'KONSEP IOT ESP32 // FASE 5',
      title: 'KONSEP ESP32: MESIN SORTIR & SENSOR FUSION',
      now: 'Klasifikasi visual Sampah & QC UMKM di layar.',
      future: 'Sinyal AI menggerakkan Servo Pemilah Otomatis + membaca Timbangan Load Cell HX711 langsung masuk ke Target Dossier.',
      impact: '💰 Hemat 95% Biaya Mesin Sortir Pabrik',
      narration: 'Fase lima, menghubungkan hasil AI Pilah Sampah dan QC UMKM ke servo pemilah otomatis dan timbangan digital berbasis ESP32.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>

        <!-- Corong Pemilah Sampah & QC Mekanis -->
        <g transform="translate(30, 40)">
          <!-- Chute Ramp -->
          <polygon points="10,20 100,20 80,75 30,75" fill="rgba(0,229,255,0.12)" stroke="#00E5FF" stroke-width="1.8"/>
          <!-- Objek Jatuh -->
          <circle cx="55" cy="45" r="9" fill="#00E676"/>
          <text x="55" y="48" fill="#020617" font-family="'JetBrains Mono', monospace" font-size="7" text-anchor="middle" font-weight="bold">AI</text>
          
          <!-- Flap Servo Gate Pemilah -->
          <line x1="55" y1="75" x2="40" y2="105" stroke="#FFAB00" stroke-width="3" stroke-linecap="round"/>
          <circle cx="55" cy="75" r="4" fill="#FFAB00"/>
          
          <!-- Bak Sortir 1 (Organik/Lolos QC) -->
          <rect x="0" y="115" width="45" height="35" rx="3" fill="#0A1628" stroke="#00E676" stroke-width="1.5"/>
          <text x="22" y="136" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle">ORGANIK</text>

          <!-- Bak Sortir 2 (Anorganik/Reject QC) -->
          <rect x="60" y="115" width="45" height="35" rx="3" fill="#0A1628" stroke="#FF1744" stroke-width="1.5"/>
          <text x="82" y="136" fill="#FF1744" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle">ANORGANIK</text>
        </g>

        <!-- Garis Data Pulsa Sensor Fusion -->
        <path class="svg-pulse-line" d="M140 100H200" stroke="#00E676" stroke-width="2"/>

        <!-- Timbangan Digital Load Cell HX711 -->
        <g transform="translate(205, 55)">
          <rect x="0" y="0" width="125" height="95" rx="6" fill="#0A1628" stroke="#00E5FF" stroke-width="1.8"/>
          <!-- Layar Timbangan LCD Digital -->
          <rect x="12" y="15" width="100" height="32" rx="3" fill="#020617" stroke="#00E676" stroke-width="1.2"/>
          <text x="62" y="36" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="12" text-anchor="middle" font-weight="bold">248.5 g</text>
          
          <!-- Sensor Load Cell Bar -->
          <rect x="25" y="58" width="75" height="14" rx="2" fill="rgba(0,229,255,0.2)" stroke="#00E5FF" stroke-width="1"/>
          <text x="62" y="68" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle">HX711 LOAD CELL</text>
          <text x="62" y="84" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle">FUSION KE DOSSIER</text>
        </g>

        <text x="180" y="198" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">SENSOR FUSION // VISUAL AI + SERVO + BERAT HX711</text>
      </svg>`
    },
    {
      num: '06',
      tag: 'KONSEP IOT ESP32 // FASE 6',
      title: 'KONSEP ESP32: HAPTIC TUNANETRA & ESP-NOW MESH',
      now: 'Panduan suara HP & notifikasi Telegram (butuh internet).',
      future: 'Sabuk Getar Tunanetra (Bluetooth BLE + sensor ultrasonik anti-bising) & ESP-NOW Mesh untuk jaringan alarm desa tanpa internet.',
      impact: '📡 Jalan di Area Blank Spot Tanpa Kuota',
      narration: 'Fase enam, sabuk getar tunanetra anti bising dan jaringan alarm desa ESP-NOW yang tetap bekerja meski tanpa sinyal internet.',
      svg: `<svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="360" height="220" rx="10" fill="#020617"/>
        <path d="M20 30H340M20 70H340M20 110H340M20 150H340M20 190H340" stroke="rgba(0,229,255,0.06)" stroke-width="1"/>

        <!-- Sabuk Getar Tunanetra (Haptic Belt) -->
        <g transform="translate(30, 45)">
          <rect x="0" y="15" width="125" height="42" rx="21" fill="#0A1628" stroke="#00E5FF" stroke-width="2"/>
          <!-- Haptic Motor Kiri, Tengah, Kanan -->
          <circle cx="28" cy="36" r="12" fill="#FFAB00"/>
          <circle cx="62" cy="36" r="12" fill="#00E676"/>
          <circle cx="97" cy="36" r="12" fill="#FFAB00"/>
          <!-- Gelombang Getaran Haptic -->
          <path d="M20 20C15 26 15 46 20 52M105 20C110 26 110 46 105 52" stroke="#FFAB00" stroke-width="1.8"/>
          <text x="62" y="8" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="7.5" text-anchor="middle" font-weight="bold">SABUK HAPTIC TUNANETRA</text>
          
          <!-- Sensor Ultrasonik HC-SR04 -->
          <rect x="25" y="72" width="75" height="30" rx="4" fill="#020617" stroke="#00E676" stroke-width="1.5"/>
          <circle cx="45" cy="87" r="8" fill="#0A1628" stroke="#00E5FF" stroke-width="1.2"/>
          <circle cx="80" cy="87" r="8" fill="#0A1628" stroke="#00E5FF" stroke-width="1.2"/>
          <text x="62" y="116" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="6.5" text-anchor="middle">ULTRASONIC HC-SR04</text>
        </g>

        <!-- Garis Penghubung ESP-NOW Wireless -->
        <path class="svg-pulse-line" d="M160 85H200" stroke="#FFAB00" stroke-width="2"/>

        <!-- Jaringan Peer-to-Peer ESP-NOW Mesh (Tanpa Internet) -->
        <g transform="translate(205, 45)">
          <rect x="0" y="0" width="125" height="110" rx="6" fill="#0A1628" stroke="#7C4DFF" stroke-width="1.8"/>
          <text x="62" y="20" fill="#7C4DFF" font-family="'JetBrains Mono', monospace" font-size="8" text-anchor="middle" font-weight="bold">ESP-NOW MESH</text>
          
          <!-- Node 1 (Gerbang Desa) -->
          <circle cx="35" cy="45" r="10" fill="#020617" stroke="#00E676" stroke-width="1.5"/>
          <text x="35" y="48" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="6" text-anchor="middle">N1</text>
          
          <!-- Node 2 (Pos Ronda) -->
          <circle cx="90" cy="45" r="10" fill="#020617" stroke="#00E5FF" stroke-width="1.5"/>
          <text x="90" y="48" fill="#00E5FF" font-family="'JetBrains Mono', monospace" font-size="6" text-anchor="middle">N2</text>
          
          <!-- Node 3 (Rumah Warga) -->
          <circle cx="62" cy="85" r="10" fill="#020617" stroke="#FFAB00" stroke-width="1.5"/>
          <text x="62" y="88" fill="#FFAB00" font-family="'JetBrains Mono', monospace" font-size="6" text-anchor="middle">N3</text>

          <!-- Jalur Mesh P2P Antar-Node -->
          <line x1="35" y1="45" x2="90" y2="45" stroke="#00E5FF" stroke-width="1.2" stroke-dasharray="2 2"/>
          <line x1="35" y1="45" x2="62" y2="85" stroke="#00E676" stroke-width="1.2" stroke-dasharray="2 2"/>
          <line x1="90" y1="45" x2="62" y2="85" stroke="#FFAB00" stroke-width="1.2" stroke-dasharray="2 2"/>
          <text x="62" y="104" fill="#94A3B8" font-family="'JetBrains Mono', monospace" font-size="6" text-anchor="middle">0% KUOTA INTERNET</text>
        </g>

        <text x="180" y="198" fill="#00E676" font-family="'JetBrains Mono', monospace" font-size="8.5" text-anchor="middle">OFF-GRID BLANK SPOT ASSISTANCE // ESP-NOW PROTOCOL</text>
      </svg>`
    }
  ];

  // State Modul
  let currentSlideIndex = 0;
  let isPlaying = true;
  let isNarrating = false;
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
    const impactBadgeEl = document.getElementById('roadmapImpactBadge');
    const titleEl = document.getElementById('roadmapSlideTitle');
    const currentTextEl = document.getElementById('roadmapCurrentText');
    const targetTextEl = document.getElementById('roadmapTargetText');
    const svgFrameEl = document.getElementById('roadmapSvgFrame');
    const contentColEl = document.getElementById('roadmapContentCol');

    if (slideNumEl) slideNumEl.textContent = slide.num;
    if (phaseTagEl) phaseTagEl.textContent = slide.tag;
    if (impactBadgeEl) impactBadgeEl.textContent = slide.impact || '';
    if (titleEl) titleEl.textContent = slide.title;
    if (currentTextEl) currentTextEl.textContent = slide.now || slide.current;
    if (targetTextEl) targetTextEl.textContent = slide.future || slide.target;
    if (svgFrameEl) svgFrameEl.innerHTML = slide.svg;

    // Bacakan Narasi Suara Juri jika mode narasi aktif
    if (isNarrating && window.BenggalaVoice && typeof window.BenggalaVoice.speak === 'function') {
      window.BenggalaVoice.speak(slide.narration);
    }

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
      if (window.BenggalaCockpit && typeof window.BenggalaCockpit.closeAllPanels === 'function') {
        window.BenggalaCockpit.closeAllPanels();
      }
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
        // Hentikan suara jika sedang bernarasi
        if (window.BenggalaVoice && typeof window.BenggalaVoice.stop === 'function') {
          window.BenggalaVoice.stop();
        }
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
     * Toggle Narasi Suara Juri
     */
    toggleNarration: function () {
      isNarrating = !isNarrating;
      const btnSpeak = document.getElementById('btnRoadmapSpeak');
      if (btnSpeak) {
        btnSpeak.innerHTML = isNarrating ? '🔊' : '🔇';
        btnSpeak.title = isNarrating ? 'Matikan Narasi Juri' : 'Aktifkan Narasi Suara Juri';
        btnSpeak.classList.toggle('active', isNarrating);
      }

      if (isNarrating) {
        const slide = SLIDES[currentSlideIndex];
        if (slide && window.BenggalaVoice && typeof window.BenggalaVoice.speak === 'function') {
          window.BenggalaVoice.speak(slide.narration);
        }
      } else {
        if (window.BenggalaVoice && typeof window.BenggalaVoice.stop === 'function') {
          window.BenggalaVoice.stop();
        }
      }
    },

    /**
     * Terminal Simulasi Sinyal ESP32 Real-Time dari Kamera
     * @param {Array} predictions Daftar objek terdeteksi dari model.detect()
     * @param {number} videoWidth Lebar frame kamera
     */
    updateLiveEspSim: function (predictions, videoWidth = 640) {
      if (!this.isOpen()) return;
      const simEl = document.getElementById('roadmapEspSim');
      if (!simEl) return;

      if (!predictions || predictions.length === 0) {
        simEl.textContent = '[SIMULASI ESP32] >> STANDBY // MENUNGGU TARGET KAMERA...';
        simEl.classList.remove('active');
        return;
      }

      simEl.classList.add('active');
      const primary = predictions[0];
      const bbox = primary.bbox || [0, 0, 100, 100];
      const [bx, by, bw, bh] = bbox;
      const cx = bx + bw / 2;
      const w = videoWidth || 640;

      let pos = 'TENGAH';
      let angle = '0';
      if (cx < w * 0.35) {
        pos = 'KIRI';
        angle = '-25';
      } else if (cx > w * 0.65) {
        pos = 'KANAN';
        angle = '+25';
      }

      const labelId = (typeof window.translateLabel === 'function')
        ? window.translateLabel(primary.class)
        : primary.class;

      const labelLower = (labelId || '').toLowerCase();
      const classLower = (primary.class || '').toLowerCase();

      const isSortable = ['bottle', 'cup', 'wine glass', 'bowl', 'backpack', 'handbag', 'suitcase', 'box'].includes(classLower) ||
                         labelLower.includes('botol') || labelLower.includes('gelas') || labelLower.includes('tas') || labelLower.includes('kotak');

      const isPerson = classLower === 'person' || labelLower === 'orang';

      let output = '';
      if (isSortable) {
        output = `[SIMULASI ESP32] >> SERVO_PILAH: ${labelId.toUpperCase()} | PAN: ${angle}°`;
      } else if (isPerson) {
        output = `[SIMULASI ESP32] >> TRACK_PAN: ${angle}° | HAPTIC_${pos} | RELAY: SIAGA`;
      } else {
        output = `[SIMULASI ESP32] >> TARGET: ${labelId.toUpperCase()} (${pos}) | PAN: ${angle}°`;
      }

      simEl.textContent = output;
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

    const btnRoadmapZoom = document.getElementById('btnRoadmapZoom');
    if (btnRoadmapZoom) {
      btnRoadmapZoom.addEventListener('click', () => {
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

    const btnRoadmapSpeak = document.getElementById('btnRoadmapSpeak');
    if (btnRoadmapSpeak) {
      btnRoadmapSpeak.addEventListener('click', () => {
        BenggalaRoadmap.toggleNarration();
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
