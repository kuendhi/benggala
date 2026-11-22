<?php
/**
 * Benggala API Security Layer
 * Environment loader, Rate Limiter, and Request Verification
 */

declare(strict_types=1);

/**
 * Muat konfigurasi dari file .env di root proyek
 */
function loadEnv(): array {
    $envPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
    $env = [];

    if (!file_exists($envPath) || !is_readable($envPath)) {
        return $env;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // Lewati komentar
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Bersihkan tanda petik pembungkus jika ada
            if ((str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
                $val = substr($val, 1, -1);
            }

            $env[$key] = $val;
        }
    }

    return $env;
}

/**
 * Mendapatkan IP Client yang aman
 */
function getClientIp(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $candidate = trim($forwarded[0]);
        if (filter_var($candidate, FILTER_VALIDATE_IP)) {
            $ip = $candidate;
        }
    }

    return $ip;
}

/**
 * Rate Limiter sederhana berbasis sliding window per IP
 */
function checkRateLimit(array $env): bool {
    $maxRequests = (int)($env['RATE_LIMIT_MAX'] ?? 15);
    $windowSeconds = (int)($env['RATE_LIMIT_WINDOW'] ?? 60);

    if ($maxRequests <= 0 || $windowSeconds <= 0) {
        return true;
    }

    $clientIp = getClientIp();
    $storageDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'snapshots';
    
    // Pastikan folder storage ada
    if (!is_dir($storageDir)) {
        @mkdir($storageDir, 0755, true);
    }

    $ipHash = md5($clientIp);
    $rateFile = $storageDir . DIRECTORY_SEPARATOR . ".rate_{$ipHash}.json";
    $currentTime = time();

    $timestamps = [];
    if (file_exists($rateFile)) {
        $content = @file_get_contents($rateFile);
        if ($content) {
            $data = json_decode($content, true);
            if (is_array($data)) {
                $timestamps = $data;
            }
        }
    }

    // Filter timestamp hanya dalam rentang window
    $validTimestamps = array_filter($timestamps, function ($ts) use ($currentTime, $windowSeconds) {
        return ($currentTime - $ts) < $windowSeconds;
    });

    if (count($validTimestamps) >= $maxRequests) {
        return false;
    }

    // Tambah request baru dan simpan
    $validTimestamps[] = $currentTime;
    @file_put_contents($rateFile, json_encode(array_values($validTimestamps)), LOCK_EX);

    return true;
}

/**
 * Verifikasi Header CSRF Token
 */
function verifyCsrfToken(): bool {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($headers['X-CSRF-Token'] ?? ($headers['x-csrf-token'] ?? ''));

    if (empty($token)) {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'Akses ditolak: Header X-CSRF-Token wajib disertakan.'
        ]);
        exit;
    }

    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }

    if (!empty($_SESSION['csrf_token']) && !hash_equals($_SESSION['csrf_token'], (string)$token)) {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'Akses ditolak: Token CSRF tidak valid.'
        ]);
        exit;
    }

    return true;
}

/**
 * Verifikasi keamanan request awal (Method, Headers, Rate Limit, dan opsional CSRF)
 */
function verifyRequest(bool $requireCsrf = false): array {
    // Set Security Headers
    header('Content-Type: application/json; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');

    // 1. Cek Metode HTTP (Hanya izinkan POST)
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(405);
        echo json_encode([
            'status' => 'error',
            'message' => 'Metode HTTP tidak diizinkan. Hanya menerima request POST.'
        ]);
        exit;
    }

    // 2. Cek Token CSRF jika diwajibkan
    if ($requireCsrf) {
        verifyCsrfToken();
    }

    // 2. Muat Environment
    $env = loadEnv();

    // 3. Cek Rate Limiting
    if (!checkRateLimit($env)) {
        http_response_code(429);
        echo json_encode([
            'status' => 'error',
            'message' => 'Terlalu banyak permintaan (Rate limit exceeded). Harap tunggu beberapa saat.'
        ]);
        exit;
    }

    return $env;
}
