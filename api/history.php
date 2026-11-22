<?php
/**
 * Benggala API - Detection History Gallery & Management
 * Menyediakan aksi list riwayat dan hapus aman (anti-path traversal)
 */

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'security.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'db.php';

// Verifikasi keamanan dasar (POST only, Security Headers, Rate Limiter)
$env = verifyRequest();

$rawInput = (php_sapi_name() === 'cli') ? '' : (file_get_contents('php://input') ?: '');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = $_POST;
}

$action = strtolower(trim((string)($input['action'] ?? 'list')));

try {
    $pdo = getDbConnection();

    // -------------------------------------------------------------------------
    // AKSI 1: LIST (Ambil 24 riwayat deteksi terbaru)
    // -------------------------------------------------------------------------
    if ($action === 'list') {
        $stmt = $pdo->query("
            SELECT id, filename, file_path, detected_objects, object_count, is_cctv, telegram_sent, ai_provider, analysis_result, created_at 
            FROM detection_logs 
            ORDER BY created_at DESC 
            LIMIT 24
        ");
        $rows = $stmt->fetchAll();

        $data = array_map(function ($row) {
            $parsedObjects = [];
            if (!empty($row['detected_objects'])) {
                $decoded = json_decode($row['detected_objects'], true);
                $parsedObjects = is_array($decoded) ? $decoded : $row['detected_objects'];
            }

            return [
                'id' => (int)$row['id'],
                'filename' => basename((string)$row['filename']),
                'file_path' => (string)$row['file_path'],
                'detected_objects' => $parsedObjects,
                'object_count' => (int)$row['object_count'],
                'is_cctv' => (bool)$row['is_cctv'],
                'telegram_sent' => (bool)$row['telegram_sent'],
                'ai_provider' => $row['ai_provider'] ?? '',
                'analysis_result' => $row['analysis_result'] ?? '',
                'created_at' => (string)$row['created_at']
            ];
        }, $rows);

        echo json_encode([
            'status' => 'success',
            'data' => $data
        ]);
        exit;
    }

    // -------------------------------------------------------------------------
    // AKSI 2: DELETE (Hapus riwayat dan berkas gambar secara aman)
    // -------------------------------------------------------------------------
    if ($action === 'delete') {
        $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id === null || $id <= 0) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Parameter ID tidak valid.'
            ]);
            exit;
        }

        // Cari record terlebih dahulu
        $stmtFind = $pdo->prepare("SELECT filename FROM detection_logs WHERE id = :id LIMIT 1");
        $stmtFind->execute([':id' => $id]);
        $row = $stmtFind->fetch();

        if ($row) {
            // WAJIB gunakan basename() untuk mencegah Path Traversal
            $safeFilename = basename((string)$row['filename']);
            $uploadDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'snapshots';
            $filePath = $uploadDir . DIRECTORY_SEPARATOR . $safeFilename;

            if (file_exists($filePath) && is_file($filePath)) {
                @unlink($filePath);
            }

            // Hapus baris dari database
            $stmtDel = $pdo->prepare("DELETE FROM detection_logs WHERE id = :id");
            $stmtDel->execute([':id' => $id]);
        }

        echo json_encode([
            'status' => 'success',
            'message' => 'Data riwayat berhasil dihapus.'
        ]);
        exit;
    }

    // Aksi tidak valid
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Aksi tidak dikenal. Hanya menerima list atau delete.'
    ]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Terjadi kesalahan sistem: ' . $e->getMessage()
    ]);
    exit;
}
