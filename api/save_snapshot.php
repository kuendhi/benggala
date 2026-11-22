<?php
/**
 * Benggala API - Save Snapshot
 * Menerima snapshot webcam (Base64 JPEG/PNG) dan menyimpannya secara aman
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'security.php';

// Wajibkan POST dan validasi header X-CSRF-Token
$env = verifyRequest(true);

// Baca input JSON atau Form Data
$rawInput = (php_sapi_name() === 'cli') ? '' : (file_get_contents('php://input') ?: '');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

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
    $imageType = strtolower($type[1]); // jpg, jpeg, png, webp
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

// Tentukan ekstensi yang aman
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

echo json_encode([
    'status' => 'success',
    'message' => 'Snapshot berhasil disimpan',
    'filename' => $filename,
    'path' => 'uploads/snapshots/' . $filename
]);
