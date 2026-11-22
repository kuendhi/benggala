<?php
/**
 * Benggala Telegram Bot Notification Helper
 */

declare(strict_types=1);

/**
 * Mengirim foto snapshot ke Telegram Chat via Telegram Bot API (sendPhoto)
 *
 * @param string $botToken Token bot Telegram
 * @param string $chatId ID Chat atau User target penerima
 * @param string $filePath Path lokal file gambar yang akan dikirim
 * @param string $caption Pesan keterangan gambar
 * @return bool True jika berhasil dikirim (HTTP 200), false jika gagal
 */
function sendTelegramPhoto(string $botToken, string $chatId, string $filePath, string $caption): bool {
    $botToken = trim($botToken);
    $chatId = trim($chatId);

    // 1. Validasi parameter wajib
    if ($botToken === '' || $chatId === '' || !file_exists($filePath) || !is_readable($filePath)) {
        return false;
    }

    $url = "https://api.telegram.org/bot{$botToken}/sendPhoto";

    try {
        $cfile = new CURLFile($filePath, 'image/jpeg', basename($filePath));

        $postData = [
            'chat_id' => $chatId,
            'photo'   => $cfile,
            'caption' => mb_substr($caption, 0, 1024)
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $postData,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($response === false || $curlErr !== '' || $httpCode !== 200) {
            $logDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'snapshots';
            $logFile = $logDir . DIRECTORY_SEPARATOR . 'telegram.log';
            $time = date('Y-m-d H:i:s');
            $errMsg = "[{$time}] GAGAL kirim foto ke Telegram | HTTP Code: {$httpCode} | Error: {$curlErr}\n";
            @file_put_contents($logFile, $errMsg, FILE_APPEND | LOCK_EX);
            return false;
        }

        return true;
    } catch (Throwable $e) {
        return false;
    }
}
