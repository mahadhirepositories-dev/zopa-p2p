<?php
header('Content-Type: text/plain');

$logFile = __DIR__ . '/../storage/logs/laravel.log';
if (!file_exists($logFile)) {
    echo "Log file does not exist at: $logFile\n";
    exit;
}

$lines = file($logFile);
$lastLines = array_slice($lines, -150);

foreach ($lastLines as $line) {
    echo $line;
}
