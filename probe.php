<?php
header('Content-Type: text/plain; charset=utf-8');

$py_bin = '/home/sikemban1/virtualenv/public_html/benggala/3.9/bin/python3.9_bin';
echo "Testing $py_bin:\n";
$out = shell_exec(escapeshellarg($py_bin) . ' -c "import sys; print(sys.path); from app import app; print(\'DIRECT PYTHON3.9_BIN IMPORT SUCCESS!\')" 2>&1');
echo $out . "\n";

// Update .htaccess to use python3.9_bin directly
if (file_exists('.htaccess')) {
    $ht = file_get_contents('.htaccess');
    $ht_new = preg_replace('/PassengerPython\s+"[^"]+"/', 'PassengerPython "' . $py_bin . '"', $ht);
    if ($ht_new !== $ht) {
        file_put_contents('.htaccess', $ht_new);
        echo "Updated .htaccess with direct python3.9_bin!\n";
        touch('tmp/restart.txt');
    }
}
?>