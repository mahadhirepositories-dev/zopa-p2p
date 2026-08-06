<?php
header('Content-Type: text/plain');

$logFile = __DIR__ . '/../storage/logs/laravel.log';
if (!file_exists($logFile)) {
    echo "Log file does not exist.\n";
    exit;
}

$lines = file($logFile);
// Search lines from bottom for "product" or "store" or "validation" or database exceptions
$count = 0;
$out = [];
for ($i = count($lines) - 1; $i >= 0; $i--) {
    $line = $lines[$i];
    if (stripos($line, 'error') !== false || stripos($line, 'exception') !== false || stripos($line, 'products') !== false || stripos($line, 'duplicate') !== false) {
        // Collect this line and some surrounding lines
        $start = max(0, $i - 2);
        $end = min(count($lines) - 1, $i + 15);
        $block = "";
        for ($j = $start; $j <= $end; $j++) {
            $block .= "[Line $j] " . $lines[$j];
        }
        $out[] = $block;
        $count++;
        if ($count > 5) break; // Get the last 5 relevant blocks
    }
}

echo implode("\n=========================================\n", array_reverse($out));
