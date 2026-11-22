<?php
/**
 * Benggala Smart LLM Router & Proxy API
 * Multi-provider support (DeepSeek & Gemini) with Auto-Fallback Mechanism
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'security.php';

// 1. Eksekusi verifikasi keamanan (Method, Security Headers, Rate Limit)
$env = verifyRequest();

// 2. Baca input request JSON atau form-data
$rawInput = (php_sapi_name() === 'cli') ? '' : (file_get_contents('php://input') ?: '');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

// 3. Tentukan prompt yang akan dianalisis
$promptText = trim((string)($input['prompt'] ?? ''));

// Jika frontend mengirim array objek terdeteksi, susun menjadi prompt analisis cerdas
if ($promptText === '' && !empty($input['objects'])) {
    if (is_array($input['objects'])) {
        $objectNames = array_map(function ($obj) {
            if (is_array($obj)) {
                $name = $obj['name'] ?? $obj['class'] ?? 'objek';
                $count = $obj['count'] ?? 1;
                return "{$name} (x{$count})";
            }
            return (string)$obj;
        }, $input['objects']);
        $objectsStr = implode(', ', $objectNames);
    } else {
        $objectsStr = (string)$input['objects'];
    }

    $promptText = "Berikut adalah daftar objek yang baru saja terdeteksi oleh kamera real-time: {$objectsStr}.\n"
                . "Berikan analisis singkat dan menarik mengenai situasi/konteks visual tersebut dalam 2-3 paragraf informatif berbahasa Indonesia.";
}

// Validasi minimal prompt
if ($promptText === '') {
    $promptText = "Berikan ringkasan analisis visual deteksi objek kamera saat ini dalam Bahasa Indonesia.";
}

// 3b. Validasi dan sanitasi parameter gambar opsional (untuk Vision multimodal)
$rawImage = trim((string)($input['image'] ?? ''));
$imageBase64 = null;

if ($rawImage !== '') {
    // Bersihkan prefix data:image/...;base64, jika ada
    if (preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/is', $rawImage, $matches)) {
        $rawImage = $matches[2];
    }
    // Cek batas panjang string base64: jika melebihi 2.000.000 karakter (~1.5 MB), abaikan gambar
    if (strlen($rawImage) <= 2000000) {
        $imageBase64 = $rawImage;
    }
}

// 4. Tentukan Provider Utama (Primary) & Cadangan (Secondary)
$requestedProvider = strtolower(trim((string)($input['provider'] ?? ($env['LLM_DEFAULT_PROVIDER'] ?? 'deepseek'))));
$primary = ($requestedProvider === 'gemini') ? 'gemini' : 'deepseek';
$secondary = ($primary === 'deepseek') ? 'gemini' : 'deepseek';

// 4b. Ambil opsional log_id untuk pipeline otomatis ke Galeri Riwayat
$logId = filter_var($input['log_id'] ?? null, FILTER_VALIDATE_INT);
$logId = ($logId !== false && $logId !== null && $logId > 0) ? (int)$logId : 0;

// Helper untuk menyimpan hasil analisis AI ke baris log di detection_logs
function saveAnalysisToLog(int $id, string $provider, string $analysis): void {
    if ($id <= 0) return;
    try {
        require_once __DIR__ . DIRECTORY_SEPARATOR . 'db.php';
        $pdo = getDbConnection();
        $stmt = $pdo->prepare("
            UPDATE detection_logs 
            SET ai_provider = :p1, analysis_result = :a1, llm_provider = :p2, llm_analysis = :a2 
            WHERE id = :id
        ");
        $stmt->execute([
            ':p1' => $provider,
            ':a1' => $analysis,
            ':p2' => $provider,
            ':a2' => $analysis,
            ':id' => $id
        ]);
    } catch (Throwable $e) {
        error_log("Database update error in analyze_llm: " . $e->getMessage());
    }
}

// =============================================================================
// FUNGSI PROVIDER 1: DeepSeek API
// =============================================================================
function callDeepSeek(string $promptText, array $env): array {
    $apiUrl = $env['DEEPSEEK_API_URL'] ?? 'https://api.deepseek.com/chat/completions';
    $model = $env['DEEPSEEK_MODEL'] ?? 'deepseek-chat';
    $apiKey = trim((string)($env['DEEPSEEK_API_KEY'] ?? ''));

    // Cek ketersediaan API key
    if ($apiKey === '' || $apiKey === 'ISI_DEEPSEEK_API_KEY_DISINI') {
        return [
            'ok' => false,
            'text' => '',
            'error' => 'DeepSeek API Key belum dikonfigurasi di file .env'
        ];
    }

    $payload = [
        'model' => $model,
        'messages' => [
            [
                'role' => 'system',
                'content' => 'Anda adalah asisten AI Benggala yang bertugas menganalisis deteksi objek visual dan memberikan ringkasan yang jelas, akurat, dan ramah dalam Bahasa Indonesia.'
            ],
            [
                'role' => 'user',
                'content' => $promptText
            ]
        ],
        'stream' => false
    ];

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ]
    ]);

    $rawResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($rawResponse === false || $curlErr !== '') {
        return [
            'ok' => false,
            'text' => '',
            'error' => "Koneksi cURL ke DeepSeek gagal: {$curlErr}"
        ];
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        return [
            'ok' => false,
            'text' => '',
            'error' => "DeepSeek merespons status HTTP {$httpCode}"
        ];
    }

    $data = json_decode($rawResponse, true);
    $text = trim((string)($data['choices'][0]['message']['content'] ?? ''));

    if ($text === '') {
        return [
            'ok' => false,
            'text' => '',
            'error' => 'Respons DeepSeek tidak memuat teks konten yang valid'
        ];
    }

    return [
        'ok' => true,
        'text' => $text,
        'error' => ''
    ];
}

// =============================================================================
// FUNGSI PROVIDER 2: Google Gemini API (Multimodal Vision Supported)
// =============================================================================
function callGemini(string $promptText, array $env, ?string $imageBase64 = null): array {
    $apiUrl = $env['GEMINI_API_URL'] ?? ($env['LLM_API_URL'] ?? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    $apiKey = trim((string)($env['GEMINI_API_KEY'] ?? ($env['LLM_API_KEY'] ?? '')));

    // Cek ketersediaan API key
    if ($apiKey === '' || $apiKey === 'ISI_GEMINI_API_KEY_DISINI' || $apiKey === 'ISI_API_KEY_ANDA_DISINI') {
        return [
            'ok' => false,
            'text' => '',
            'error' => 'Gemini API Key belum dikonfigurasi di file .env'
        ];
    }

    // Susun array parts (teks + opsional inline image data untuk Vision)
    if ($imageBase64 !== null && $imageBase64 !== '') {
        $parts = [
            [
                'text' => $promptText . "\nAnalisa juga secara visual dari foto terlampir: sebutkan merek/tulisan jika terbaca, kondisi fisik, dan perkiraan ukurannya secara singkat dalam bahasa Indonesia."
            ],
            [
                'inline_data' => [
                    'mime_type' => 'image/jpeg',
                    'data' => $imageBase64
                ]
            ]
        ];
    } else {
        $parts = [
            ['text' => $promptText]
        ];
    }

    $payload = [
        'contents' => [
            [
                'parts' => $parts
            ]
        ]
    ];

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey
        ]
    ]);

    $rawResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($rawResponse === false || $curlErr !== '') {
        return [
            'ok' => false,
            'text' => '',
            'error' => "Koneksi cURL ke Gemini gagal: {$curlErr}"
        ];
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        return [
            'ok' => false,
            'text' => '',
            'error' => "Gemini merespons status HTTP {$httpCode}"
        ];
    }

    $data = json_decode($rawResponse, true);
    $text = trim((string)($data['candidates'][0]['content']['parts'][0]['text'] ?? ''));

    if ($text === '') {
        return [
            'ok' => false,
            'text' => '',
            'error' => 'Respons Gemini tidak memuat teks konten yang valid'
        ];
    }

    return [
        'ok' => true,
        'text' => $text,
        'error' => ''
    ];
}

// =============================================================================
// ALUR ROUTING AUTO-FALLBACK
// =============================================================================

// Helper untuk mencatat log fallback secara aman tanpa mengekspos API Key
function logFallbackFailure(string $primary, string $secondary, string $reason): void {
    $logDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'snapshots';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    $logFile = $logDir . DIRECTORY_SEPARATOR . 'llm_router.log';
    $time = date('Y-m-d H:i:s');
    $sanitizedReason = preg_replace('/(key|bearer|token)\s*[:=]\s*[^\s,]+/i', '$1: [REDACTED]', $reason);
    $entry = "[{$time}] FALLBACK TRIGGERED | Primary: {$primary} GAGAL: {$sanitizedReason} | Mengalihkan ke Secondary: {$secondary}\n";
    @file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}

// 1. Eksekusi Provider Utama ($primary)
$primaryResult = ($primary === 'deepseek') ? callDeepSeek($promptText, $env) : callGemini($promptText, $env, $imageBase64);

if ($primaryResult['ok'] === true) {
    if ($logId > 0) {
        saveAnalysisToLog($logId, $primary, $primaryResult['text']);
    }

    echo json_encode([
        'status' => 'success',
        'provider_used' => $primary,
        'fallback_triggered' => false,
        'analysis' => $primaryResult['text'],
        'log_id' => $logId
    ]);
    exit;
}

// 2. Jika Primary Gagal, Catat Log & Eksekusi Provider Cadangan ($secondary)
logFallbackFailure($primary, $secondary, $primaryResult['error']);

$secondaryResult = ($secondary === 'deepseek') ? callDeepSeek($promptText, $env) : callGemini($promptText, $env, $imageBase64);

if ($secondaryResult['ok'] === true) {
    if ($logId > 0) {
        saveAnalysisToLog($logId, $secondary, $secondaryResult['text']);
    }

    echo json_encode([
        'status' => 'success',
        'provider_used' => $secondary,
        'fallback_triggered' => true,
        'analysis' => $secondaryResult['text'],
        'log_id' => $logId
    ]);
    exit;
}

// 3. Jika Kedua Provider Gagal, Kembalikan HTTP 503 dengan Pesan Aman
logFallbackFailure($secondary, 'none', $secondaryResult['error']);

http_response_code(503);
echo json_encode([
    'status' => 'error',
    'message' => 'Layanan AI sementara tidak tersedia. Silakan periksa koneksi atau API Key Anda.',
    'fallback_triggered' => true
]);
exit;
