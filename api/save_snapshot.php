<?php
/**
 * Benggala API - Save Snapshot & CCTV Evidence
 * Menerima snapshot webcam (Base64 JPEG/PNG), mencatat ke MySQL, dan mengirim ke Telegram
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'security.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'db.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'telegram.php';

// Wajibkan POST dan validasi header X-CSRF-Token
$env = verifyRequest(true);

// Baca input JSON atau Form Data
$rawInput = (php_sapi_name() === 'cli') ? '' : (file_get_contents('php://input') ?: '');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

$isCctv = !empty($input['is_cctv']);
$objects = $input['objects'] ?? [];

$imageData = trim((string)($input['image'] ?? ''));
if ($imageData === '') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Data gambar (Base64) wajib disertakan.'
    ]);
    exit;
}

// Ekstrak base64 data jika menggunakan data URI scheme
if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
    $imageType = strtolower($type[1]);
    $imageData = substr($imageData, strpos($imageData, ',') + 1);
    $imageData = base64_decode($imageData);

    if ($imageData === false) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Format Base64 gambar tidak valid.'
        ]);
        exit;
    }
} else {
    $imageData = base64_decode($imageData);
    $imageType = 'jpg';
    if ($imageData === false) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Gagal mendekode data gambar.'
        ]);
        exit;
    }
}

// Validasi ukuran (Maksimal 5MB)
if (strlen($imageData) > 5 * 1024 * 1024) {
    http_response_code(413);
    echo json_encode([
        'status' => 'error',
        'message' => 'Ukuran gambar melebihi batas maksimal 5MB.'
    ]);
    exit;
}

// Verifikasi integritas gambar menggunakan getimagesizefromstring
$imageInfo = @getimagesizefromstring($imageData);
if ($imageInfo === false) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Data yang dikirim bukan format gambar yang valid.'
    ]);
    exit;
}

$allowedExtensions = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp'
];

$mime = $imageInfo['mime'] ?? '';
$ext = $allowedExtensions[$mime] ?? 'jpg';

$uploadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'snapshots';
if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0755, true);
}

// Nama file aman dan teracak
$filename = 'snapshot_' . date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;

// Simpan file ke server
if (@file_put_contents($targetPath, $imageData, LOCK_EX) === false) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Gagal menyimpan snapshot ke penyimpanan server.'
    ]);
    exit;
}

// -----------------------------------------------------------------------------
// PENGIRIMAN NOTIFIKASI TELEGRAM & PENCATATAN KE DATABASE
// -----------------------------------------------------------------------------
$telegramSent = false;

try {
    $pdo = getDbConnection();
    $settings = getAppSettings();

    // 1. Cek konfigurasi Telegram jika request berasal dari Mode CCTV
    $tgEnabled = ($settings['telegram_enabled'] ?? '0') === '1';
    $tgToken   = trim((string)($settings['telegram_bot_token'] ?? ''));
    $tgChatId  = trim((string)($settings['telegram_chat_id'] ?? ''));

    if ($isCctv && $tgEnabled && $tgToken !== '' && $tgChatId !== '') {
        $timeStr = date('d/m/Y H:i:s');
        $objectNamesList = [];

        if (is_array($objects)) {
            foreach ($objects as $obj) {
                if (is_array($obj)) {
                    $name = $obj['name'] ?? $obj['class'] ?? $obj['name_id'] ?? '';
                    $size = !empty($obj['ukuran']) ? " [{$obj['ukuran']}]" : '';
                    if ($name !== '') {
                        $objectNamesList[] = "• {$name}{$size}";
                    }
                } elseif (is_string($obj) && trim($obj) !== '') {
                    $objectNamesList[] = "• " . trim($obj);
                }
            }
        }

        $objSummary = !empty($objectNamesList) ? implode("\n", $objectNamesList) : "• Objek terdeteksi";

        $caption = "🚨 *PERINGATAN CCTV BENGGALA!*\n"
                 . "📅 *Waktu:* {$timeStr}\n"
                 . "🎯 *Objek Terdeteksi:*\n{$objSummary}\n"
                 . "📁 *Berkas:* `{$filename}`";

        $telegramSent = sendTelegramPhoto($tgToken, $tgChatId, $targetPath, $caption);
    }

    // 2. Simpan Riwayat Deteksi ke Tabel detection_logs
    $objectsJson = is_array($objects) ? json_encode($objects, JSON_UNESCAPED_UNICODE) : (string)$objects;
    $objectCount = is_array($objects) ? count($objects) : 0;

    $stmt = $pdo->prepare("
        INSERT INTO detection_logs (filename, file_path, detected_objects, object_count, is_cctv, telegram_sent) 
        VALUES (:fn, :fp, :objs, :cnt, :cctv, :tg)
    ");

    $stmt->execute([
        ':fn' => $filename,
        ':fp' => 'uploads/snapshots/' . $filename,
        ':objs' => $objectsJson,
        ':cnt' => $objectCount,
        ':cctv' => $isCctv ? 1 : 0,
        ':tg' => $telegramSent ? 1 : 0
    ]);

    $logId = (int)$pdo->lastInsertId();

} catch (Throwable $dbErr) {
    // Database / Telegram error tidak menggagalkan penyimpanan lokal
    error_log("Database/Telegram error in save_snapshot: " . $dbErr->getMessage());
}

echo json_encode([
    'status' => 'success',
    'message' => 'Snapshot berhasil disimpan',
    'filename' => $filename,
    'path' => 'uploads/snapshots/' . $filename,
    'log_id' => $logId ?? 0,
    'is_cctv' => $isCctv,
    'telegram_sent' => $telegramSent
]);
