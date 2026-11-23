<?php
/**
 * Benggala OS - Auto-Cleanup Legacy PHP Files
 * Menghapus sisa berkas PHP lama di cPanel hosting agar Apache otomatis
 * mengalihkan eksekusi ke Phusion Passenger (passenger_wsgi.py / Flask).
 */

$legacyFiles = [
    'save_snapshot.php',
    'analyze_llm.php',
    'settings.php',
    'history.php',
    'export_csv.php',
    'db.php',
    'security.php',
    'telegram.php'
];

foreach ($legacyFiles as $file) {
    $filePath = __DIR__ . '/' . $file;
    if (file_exists($filePath)) {
        @unlink($filePath);
    }
}

// Sentuh file restart Passenger
$restartDir = __DIR__ . '/tmp';
if (!is_dir($restartDir)) {
    @mkdir($restartDir, 0755, true);
}
@file_put_contents($restartDir . '/restart.txt', date('c'));

// Hapus berkas index.php ini sendiri
if (file_exists(__FILE__)) {
    @unlink(__FILE__);
}

// Redirect ke root URL agar Apache mengeksekusi Phusion Passenger
header("Location: ./");
exit;
