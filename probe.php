<?php
header('Content-Type: text/plain; charset=utf-8');

echo "=== ERROR LOG SEARCH ===\n";
$log_files = [
    'error_log',
    '../error_log',
    '../../error_log',
    'tmp/passenger_error.log',
];

foreach ($log_files as $lf) {
    if (file_exists($lf)) {
        echo "Found $lf (size: " . filesize($lf) . "):\n";
        if (is_file($lf)) {
            $lines = file($lf);
            $last_lines = array_slice($lines, -30);
            echo implode("", $last_lines) . "\n";
        }
    } else {
        echo "$lf not found\n";
    }
}

echo "\n=== PASSENGER PROCESSES / PYTHON WRAPPER ===\n";
$py_wrapper = '/home/sikemban1/virtualenv/public_html/benggala/3.9/bin/python';
if (file_exists($py_wrapper)) {
    echo "Wrapper content:\n" . file_get_contents($py_wrapper) . "\n";
}

echo "\n=== BIN FOLDER CONTENTS ===\n";
$bin_dir = '/home/sikemban1/virtualenv/public_html/benggala/3.9/bin';
if (is_dir($bin_dir)) {
    print_r(scandir($bin_dir));
}
