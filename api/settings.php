<?php
/**
 * Benggala API - Dynamic Settings Management
 * Mendukung pembacaan (dengan masking token rahasia) dan penyimpanan pengaturan aplikasi
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'security.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'db.php';

// Set standard security headers
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$rawInput = (php_sapi_name() === 'cli') ? '' : (file_get_contents('php://input') ?: '');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_REQUEST;
}

$action = strtolower(trim((string)($input['action'] ?? ($method === 'GET' ? 'get' : 'save'))));

try {
    $pdo = getDbConnection();

    // -------------------------------------------------------------------------
    // AKSI 1: GET (Ambil pengaturan dengan masking token rahasia)
    // -------------------------------------------------------------------------
    if ($action === 'get') {
        $settings = getAppSettings();

        // Masking Telegram Bot Token
        $token = (string)($settings['telegram_bot_token'] ?? '');
        if ($token !== '') {
            $settings['telegram_bot_token'] = '****' . substr($token, -6);
        }

        // Masking DeepSeek API Key
        $dsKey = (string)($settings['deepseek_api_key'] ?? '');
        if ($dsKey !== '') {
            $settings['deepseek_api_key'] = '****' . substr($dsKey, -6);
        }

        // Masking Gemini API Key
        $gemKey = (string)($settings['gemini_api_key'] ?? '');
        if ($gemKey !== '') {
            $settings['gemini_api_key'] = '****' . substr($gemKey, -6);
        }

        echo json_encode([
            'status' => 'success',
            'data' => $settings
        ]);
        exit;
    }

    // -------------------------------------------------------------------------
    // AKSI 2: SAVE (Simpan pengaturan ke database)
    // -------------------------------------------------------------------------
    if ($action === 'save') {
        // Validasi keamanan: Wajib POST & CSRF Token
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode([
                'status' => 'error',
                'message' => 'Metode HTTP tidak diizinkan. Gunakan POST.'
            ]);
            exit;
        }

        verifyCsrfToken();

        // Whitelist field pengaturan yang diizinkan
        $allowedKeys = [
            'llm_default_provider',
            'deepseek_api_key',
            'deepseek_model',
            'gemini_api_key',
            'gemini_model',
            'detection_threshold',
            'sound_enabled',
            'system_prompt',
            'telegram_enabled',
            'telegram_bot_token',
            'telegram_chat_id'
        ];

        // Ambil data lama dari database untuk perbandingan token
        $currentSettings = getAppSettings();

        $stmt = $pdo->prepare("
            INSERT INTO settings (setting_key, setting_value) 
            VALUES (:key, :val) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");

        $dataToSave = is_array($input['settings'] ?? null) ? $input['settings'] : $input;

        foreach ($allowedKeys as $key) {
            if (!array_key_exists($key, $dataToSave)) {
                continue;
            }

            $value = trim((string)$dataToSave[$key]);

            // Logika Masking: jika input kosong atau diawali '****', pertahankan nilai lama
            if (in_array($key, ['telegram_bot_token', 'deepseek_api_key', 'gemini_api_key'], true)) {
                if ($value === '' || str_starts_with($value, '****')) {
                    $value = (string)($currentSettings[$key] ?? '');
                }
            }

            $stmt->execute([
                ':key' => $key,
                ':val' => $value
            ]);
        }

        echo json_encode([
            'status' => 'success',
            'message' => 'Pengaturan berhasil disimpan ke database.'
        ]);
        exit;
    }

    // Aksi tidak dikenal
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Aksi tidak valid. Hanya menerima get atau save.'
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Gagal memproses pengaturan: ' . $e->getMessage()
    ]);
    exit;
}
