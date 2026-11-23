<?php
header('Content-Type: text/plain; charset=utf-8');

$candidates = [
    '/home/sikemban1/virtualenv/benggala/3.9/bin/python',
    '/home/sikemban1/virtualenv/public_html/benggala/3.9/bin/python',
    '/home/sikemban1/virtualenv/benggala/3.10/bin/python',
    '/home/sikemban1/virtualenv/public_html/benggala/3.10/bin/python',
    '/home/sikemban1/virtualenv/benggala/3.11/bin/python',
    '/home/sikemban1/virtualenv/public_html/benggala/3.11/bin/python',
    '/home/sikemban1/virtualenv/benggala/3.8/bin/python',
    '/home/sikemban1/virtualenv/public_html/benggala/3.8/bin/python',
];

echo "=== BENGGALA HOSTING DIAGNOSTIC PROBE ===\n";
echo "Current user: " . (function_exists('get_current_user') ? get_current_user() : 'unknown') . "\n";
echo "Current dir: " . __DIR__ . "\n\n";

echo "=== 1. VIRTUALENV CANDIDATES ===\n";
$found_py = null;
foreach ($candidates as $c) {
    $exists = file_exists($c);
    echo "$c -> " . ($exists ? "EXISTS!" : "not found") . "\n";
    if ($exists && !$found_py) {
        $found_py = $c;
    }
}

if (!$found_py) {
    $globs = glob('/home/*/virtualenv/*/*/bin/python');
    echo "\nGlob search result:\n";
    print_r($globs);
    if (!empty($globs)) {
        $found_py = $globs[0];
    }
}

echo "\nSELECTED PYTHON: " . ($found_py ?: "NONE") . "\n";

echo "\n=== 2. CURRENT .HTACCESS ===\n";
if (file_exists('.htaccess')) {
    echo file_get_contents('.htaccess') . "\n";
} else {
    echo ".htaccess not found!\n";
}

echo "\n=== 3. PASSENGER ERROR LOG ===\n";
if (file_exists('tmp/passenger_error.log')) {
    echo file_get_contents('tmp/passenger_error.log') . "\n";
} else {
    echo "No tmp/passenger_error.log found.\n";
}

// Jika python ditemukan dan .htaccess belum cocok, perbaiki .htaccess langsung!
if ($found_py && file_exists('.htaccess')) {
    $ht = file_get_contents('.htaccess');
    $ht_new = preg_replace('/PassengerPython\s+"[^"]+"/', 'PassengerPython "' . $found_py . '"', $ht);
    if ($ht_new !== $ht) {
        file_put_contents('.htaccess', $ht_new);
        echo "\n>>> UPDATED .HTACCESS with: $found_py <<<\n";
        if (!is_dir('tmp')) {
            mkdir('tmp', 0755, true);
        }
        touch('tmp/restart.txt');
        echo "Touched tmp/restart.txt\n";
    }
}

if ($found_py) {
    echo "\n=== 4. TEST EXECUTE PYTHON APP IMPORT ===\n";
    $test_cmd = escapeshellarg($found_py) . ' -c "import sys; sys.path.insert(0, \'.\'); from app import app; print(\'Flask application imported OK!\')" 2>&1';
    $out = shell_exec($test_cmd);
    echo ($out ?: "[No output from command]") . "\n";
}

echo "\n=== PROBE COMPLETE ===\n";
