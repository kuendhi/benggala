<?php
header('Content-Type: text/plain; charset=utf-8');

$set_env = '/home/sikemban1/virtualenv/public_html/benggala/3.9/bin/set_env_vars.py';
if (file_exists($set_env)) {
    echo "Found set_env_vars.py! Permissions: " . substr(sprintf('%o', fileperms($set_env)), -4) . "\n";
    $c = file_get_contents($set_env);
    echo "Line 55-75 preview:\n";
    $lines = explode("\n", $c);
    for ($i = 50; $i < min(count($lines), 75); $i++) {
        echo ($i + 1) . ": " . $lines[$i] . "\n";
    }
    
    // Jika ada os.environ['HOME'], patch menjadi os.environ.get('HOME', '/home/sikemban1')
    if (strpos($c, "os.environ['HOME']") !== false) {
        $c_fixed = str_replace("os.environ['HOME']", "os.environ.get('HOME', '/home/sikemban1')", $c);
        $w = file_put_contents($set_env, $c_fixed);
        echo "\nPATCHED set_env_vars.py! Bytes written: $w\n";
    } else {
        echo "\nos.environ['HOME'] already patched or not found directly.\n";
    }
} else {
    echo "set_env_vars.py not found!\n";
}

// Tes jalankan wrapper python sekarang
$out = shell_exec('/home/sikemban1/virtualenv/public_html/benggala/3.9/bin/python -c "import os; print(\'WRAPPER PYTHON TEST SUCCESS!\')" 2>&1');
echo "\nWrapper python execution test:\n$out\n";
?>