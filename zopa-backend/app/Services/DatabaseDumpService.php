<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PDO;
use RuntimeException;

class DatabaseDumpService
{
    /**
     * Generate a full database dump.
     *
     * @param string $format 'sql' or 'gz'
     * @return array{path: string, file_name: string, size_bytes: int, format: string, duration_ms: int}
     */
    public function generateDump(string $format = 'gz'): array
    {
        @ini_set('memory_limit', '512M');
        @set_time_limit(300);

        $startTime = microtime(true);
        $dumpDir = storage_path('app/dumps');
        if (!file_exists($dumpDir)) {
            @mkdir($dumpDir, 0777, true);
        }
        @chmod($dumpDir, 0777);

        $timestamp = now()->format('Y-m-d_His');
        $baseName  = 'zopa_db_dump_' . $timestamp;
        $sqlPath   = $dumpDir . '/' . $baseName . '.sql';

        $connection = DB::connection();
        $driver = $connection->getDriverName();

        try {
            if ($driver === 'mysql' && $this->canUseMysqldump()) {
                $this->dumpWithMysqldump($sqlPath);
            } elseif ($driver === 'mysql') {
                $this->dumpMysqlWithPhp($sqlPath);
            } elseif ($driver === 'sqlite') {
                $this->dumpSqliteWithPhp($sqlPath);
            } else {
                throw new RuntimeException("Unsupported database driver for dump: {$driver}");
            }

            if (!file_exists($sqlPath) || filesize($sqlPath) === 0) {
                throw new RuntimeException("Database dump file was not generated or is empty.");
            }

            // Gzip compression if requested
            if ($format === 'gz') {
                $gzPath = $dumpDir . '/' . $baseName . '.sql.gz';
                $this->gzipFile($sqlPath, $gzPath);
                @unlink($sqlPath); // remove uncompressed sql file

                $finalPath = $gzPath;
                $fileName  = $baseName . '.sql.gz';
                $outFormat = 'sql.gz';
            } else {
                $finalPath = $sqlPath;
                $fileName  = $baseName . '.sql';
                $outFormat = 'sql';
            }

            $durationMs = (int) round((microtime(true) - $startTime) * 1000);
            $sizeBytes  = filesize($finalPath);

            return [
                'path'        => $finalPath,
                'file_name'   => $fileName,
                'size_bytes'  => $sizeBytes,
                'format'      => $outFormat,
                'duration_ms' => $durationMs,
            ];
        } catch (\Throwable $e) {
            @unlink($sqlPath);
            if (isset($gzPath)) {
                @unlink($gzPath);
            }
            Log::error("[DatabaseDumpService] Failed to generate database dump: " . $e->getMessage(), [
                'exception' => $e,
            ]);
            throw $e;
        }
    }

    /**
     * Check if mysqldump command line binary is accessible.
     */
    private function canUseMysqldump(): bool
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            // Windows local dev
            $test = @shell_exec('where mysqldump 2>NUL');
            return !empty(trim((string)$test));
        }

        // Linux / Unix
        $test = @shell_exec('which mysqldump 2>/dev/null');
        if (!empty(trim((string)$test))) {
            return true;
        }

        return file_exists('/usr/bin/mysqldump') || file_exists('/usr/local/bin/mysqldump');
    }

    /**
     * Dump MySQL database using mysqldump binary.
     */
    private function dumpWithMysqldump(string $outputPath): void
    {
        $config   = config('database.connections.mysql');
        $host     = $config['host'] ?? '127.0.0.1';
        $port     = $config['port'] ?? '3306';
        $database = $config['database'] ?? '';
        $username = $config['username'] ?? 'root';
        $password = $config['password'] ?? '';
        $socket   = $config['unix_socket'] ?? '';

        $binary = 'mysqldump';
        if (file_exists('/usr/bin/mysqldump')) {
            $binary = '/usr/bin/mysqldump';
        }

        // Build command safely
        $cmd = escapeshellcmd($binary) . ' '
            . '--single-transaction '
            . '--quick '
            . '--skip-lock-tables '
            . '--routines '
            . '--triggers '
            . '--hex-blob '
            . '--default-character-set=utf8mb4 ';

        if (!empty($socket)) {
            $cmd .= '--socket=' . escapeshellarg($socket) . ' ';
        } else {
            $cmd .= '-h ' . escapeshellarg($host) . ' -P ' . escapeshellarg($port) . ' ';
        }

        $cmd .= '-u ' . escapeshellarg($username) . ' ';

        if ($password !== '') {
            $cmd .= '-p' . escapeshellarg($password) . ' ';
        }

        $cmd .= escapeshellarg($database);
        $cmd .= ' > ' . escapeshellarg($outputPath);

        $output = [];
        $returnVar = 0;
        exec($cmd . ' 2>&1', $output, $returnVar);

        if ($returnVar !== 0) {
            $err = implode("\n", $output);
            Log::warning("[DatabaseDumpService] mysqldump command returned code {$returnVar}: {$err}. Falling back to PHP PDO dumper.");
            $this->dumpMysqlWithPhp($outputPath);
        }
    }

    /**
     * Pure-PHP fallback to dump MySQL database.
     */
    private function dumpMysqlWithPhp(string $outputPath): void
    {
        $handle = fopen($outputPath, 'w');
        if (!$handle) {
            throw new RuntimeException("Cannot open file for writing: {$outputPath}");
        }

        $database = config('database.connections.mysql.database', 'laravel');

        // Header
        fwrite($handle, "-- ZOPA Database Dump (PHP PDO Fallback)\n");
        fwrite($handle, "-- Generated: " . now()->toIso8601String() . "\n");
        fwrite($handle, "-- Database: {$database}\n\n");
        fwrite($handle, "SET NAMES utf8mb4;\n");
        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 0;\n\n");

        $tables = DB::select('SHOW TABLES');
        $tablesKey = 'Tables_in_' . $database;

        foreach ($tables as $tableObj) {
            $table = $tableObj->$tablesKey ?? (is_array($tableObj) ? reset($tableObj) : null);
            if (!$table) {
                // Fallback: extract first property
                $props = get_object_vars($tableObj);
                $table = reset($props);
            }

            if (!$table) continue;

            // Table Structure
            fwrite($handle, "-- -----------------------------------------------------\n");
            fwrite($handle, "-- Table structure for `{$table}`\n");
            fwrite($handle, "-- -----------------------------------------------------\n");
            fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");

            $createTable = DB::select("SHOW CREATE TABLE `{$table}`");
            if (!empty($createTable)) {
                $createSql = $createTable[0]->{'Create Table'} ?? null;
                if ($createSql) {
                    fwrite($handle, $createSql . ";\n\n");
                }
            }

            // Table Data
            fwrite($handle, "-- Dumping data for table `{$table}`\n");
            
            DB::table($table)->chunk(500, function ($rows) use ($handle, $table) {
                if ($rows->isEmpty()) return;

                $columns = array_keys((array) $rows->first());
                $colList = '`' . implode('`, `', $columns) . '`';

                foreach ($rows as $row) {
                    $values = [];
                    foreach ((array) $row as $val) {
                        if ($val === null) {
                            $values[] = 'NULL';
                        } elseif (is_int($val) || is_float($val)) {
                            $values[] = (string) $val;
                        } elseif (is_bool($val)) {
                            $values[] = $val ? '1' : '0';
                        } else {
                            $values[] = "'" . addslashes((string) $val) . "'";
                        }
                    }

                    $insertSql = "INSERT INTO `{$table}` ({$colList}) VALUES (" . implode(', ', $values) . ");\n";
                    fwrite($handle, $insertSql);
                }
                fwrite($handle, "\n");
            });

            fwrite($handle, "\n");
        }

        fwrite($handle, "SET FOREIGN_KEY_CHECKS = 1;\n");
        fclose($handle);
    }

    /**
     * Pure-PHP dumper for SQLite database.
     */
    private function dumpSqliteWithPhp(string $outputPath): void
    {
        $handle = fopen($outputPath, 'w');
        if (!$handle) {
            throw new RuntimeException("Cannot open file for writing: {$outputPath}");
        }

        fwrite($handle, "-- ZOPA SQLite Database Dump\n");
        fwrite($handle, "-- Generated: " . now()->toIso8601String() . "\n\n");
        fwrite($handle, "PRAGMA foreign_keys = OFF;\n\n");

        $tables = DB::select("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

        foreach ($tables as $t) {
            $tableName = $t->name;
            $createSql = $t->sql;

            fwrite($handle, "-- Table: {$tableName}\n");
            fwrite($handle, "DROP TABLE IF EXISTS \"{$tableName}\";\n");
            fwrite($handle, $createSql . ";\n\n");

            DB::table($tableName)->chunk(500, function ($rows) use ($handle, $tableName) {
                foreach ($rows as $row) {
                    $rowArr = (array) $row;
                    $cols = array_keys($rowArr);
                    $colList = '"' . implode('", "', $cols) . '"';
                    $values = [];

                    foreach ($rowArr as $val) {
                        if ($val === null) {
                            $values[] = 'NULL';
                        } elseif (is_int($val) || is_float($val)) {
                            $values[] = (string) $val;
                        } else {
                            $values[] = "'" . str_replace("'", "''", (string) $val) . "'";
                        }
                    }

                    fwrite($handle, "INSERT INTO \"{$tableName}\" ({$colList}) VALUES (" . implode(', ', $values) . ");\n");
                }
            });

            fwrite($handle, "\n");
        }

        fwrite($handle, "PRAGMA foreign_keys = ON;\n");
        fclose($handle);
    }

    /**
     * Gzip compress a file in chunks without loading entire content in memory.
     */
    private function gzipFile(string $sourcePath, string $targetPath): void
    {
        $src = fopen($sourcePath, 'rb');
        if (!$src) {
            throw new RuntimeException("Cannot open source file for gzip: {$sourcePath}");
        }

        $dst = gzopen($targetPath, 'wb9');
        if (!$dst) {
            fclose($src);
            throw new RuntimeException("Cannot open destination gzip file: {$targetPath}");
        }

        while (!feof($src)) {
            $chunk = fread($src, 1024 * 512); // 512KB chunks
            if ($chunk !== false && strlen($chunk) > 0) {
                gzwrite($dst, $chunk);
            }
        }

        fclose($src);
        gzclose($dst);
    }
}
