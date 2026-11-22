<?php
/**
 * Benggala Database Connection Layer (MySQL PDO)
 */

declare(strict_types=1);

function getDbConnection(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $host = 'localhost';
    $db   = 'sikemban1_benggala';
    $user = 'sikemban1_sd';
    $pass = 'Ary4saTy4';
    $charset = 'utf8mb4';

    $dsn = "mysql:host={$host};dbname={$db};charset={$charset}";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
    } catch (PDOException $e) {
        try {
            // Fallback koneksi root lokal jika kredensial khusus bermasalah
            $pdo = new PDO("mysql:host={$host};dbname={$db};charset={$charset}", 'root', '', $options);
        } catch (PDOException $ex) {
            throw new Exception("Koneksi database gagal: " . $e->getMessage());
        }
    }

    return $pdo;
}

/**
 * Mengambil semua setting aplikasi dalam bentuk array asosiatif [key => value]
 */
function getAppSettings(): array {
    try {
        $pdo = getDbConnection();
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings");
        $rows = $stmt->fetchAll();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'] ?? '';
        }
        return $settings;
    } catch (Throwable $t) {
        return [];
    }
}
