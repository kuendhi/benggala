<?php
/**
 * Benggala API - Export Detection History to CSV/Excel
 * Menghasilkan file CSV dengan BOM UTF-8, anti-CSV injection, dan validasi CSRF
 */

declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . DIRECTORY_SEPARATOR . 'db.php';

// Validasi CSRF Token via GET query parameter, POST, atau Request Header
$headers = function_exists('getallheaders') ? getallheaders() : [];
$token = $_REQUEST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($headers['X-CSRF-Token'] ?? ($headers['x-csrf-token'] ?? '')));

if (empty($token) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], (string)$token)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Akses ditolak: Token CSRF tidak valid atau telah kedaluwarsa.';
    exit;
}

try {
    $pdo = getDbConnection();

    // Query semua data detection_logs terurut dari yang terbaru
    $stmt = $pdo->query("
        SELECT id, created_at, filename, detected_objects, ai_provider, analysis_result 
        FROM detection_logs 
        ORDER BY created_at DESC
    ");
    $rows = $stmt->fetchAll();

    // Helper Anti-CSV Injection
    $sanitizeCsv = function ($val): string {
        $str = (string)($val ?? '');
        if ($str !== '' && in_array($str[0], ['=', '+', '-', '@'], true)) {
            return "'" . $str;
        }
        return $str;
    };

    // Set Header HTTP untuk Pengunduhan Berkas CSV
    $filenameDate = date('Ymd');
    $csvFilename = "benggala_laporan_{$filenameDate}.csv";

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $csvFilename . '"');
    header('Pragma: no-cache');
    header('Expires: 0');

    // Buka output stream
    $output = fopen('php://output', 'wb');

    // Tulis BOM UTF-8 agar Microsoft Excel mengenali encoding karakter Indonesia / UTF-8
    fwrite($output, "\xEF\xBB\xBF");

    // Tulis Baris Header Kolom CSV
    fputcsv($output, [
        'ID',
        'Waktu',
        'Nama File',
        'Objek Terdeteksi',
        'Provider AI',
        'Hasil Analisis'
    ]);

    // Tulis Baris Data
    foreach ($rows as $row) {
        // Format ringkasan objek
        $objSummary = '-';
        if (!empty($row['detected_objects'])) {
            $decoded = json_decode((string)$row['detected_objects'], true);
            if (is_array($decoded)) {
                $items = [];
                foreach ($decoded as $item) {
                    if (is_array($item)) {
                        $name = $item['name'] ?? $item['class'] ?? $item['name_id'] ?? '';
                        $size = !empty($item['ukuran']) ? " ({$item['ukuran']})" : '';
                        if ($name !== '') {
                            $items[] = $name . $size;
                        }
                    } elseif (is_string($item) && trim($item) !== '') {
                        $items[] = trim($item);
                    }
                }
                if (!empty($items)) {
                    $objSummary = implode(', ', $items);
                }
            } else {
                $objSummary = (string)$row['detected_objects'];
            }
        }

        fputcsv($output, [
            $sanitizeCsv($row['id'] ?? ''),
            $sanitizeCsv($row['created_at'] ?? ''),
            $sanitizeCsv(basename((string)($row['filename'] ?? ''))),
            $sanitizeCsv($objSummary),
            $sanitizeCsv($row['ai_provider'] ?: '-'),
            $sanitizeCsv($row['analysis_result'] ?: '-')
        ]);
    }

    fclose($output);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Gagal mengekspor laporan CSV: ' . $e->getMessage();
    exit;
}
