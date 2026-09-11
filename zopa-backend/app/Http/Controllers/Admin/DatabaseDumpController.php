<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DatabaseDumpLog;
use App\Services\DatabaseDumpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DatabaseDumpController extends Controller
{
    public function __construct(
        protected DatabaseDumpService $dumpService
    ) {}

    /**
     * Get dump download history and metadata about the last dump.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->query('per_page', 25)), 100);

        $logs = DatabaseDumpLog::latest()->paginate($perPage);

        $lastDownload = DatabaseDumpLog::where('status', 'completed')
            ->latest()
            ->first();

        $lastDownloadData = null;
        if ($lastDownload) {
            $lastDownloadData = [
                'id'              => $lastDownload->id,
                'user_name'       => $lastDownload->user_name,
                'user_email'      => $lastDownload->user_email,
                'file_name'       => $lastDownload->file_name,
                'file_size_bytes' => $lastDownload->file_size_bytes,
                'formatted_size'  => $lastDownload->formatted_size,
                'format'          => $lastDownload->format,
                'created_at'      => $lastDownload->created_at?->toIso8601String(),
                'relative_time'   => $lastDownload->created_at?->diffForHumans(),
            ];
        }

        $driver = DB::connection()->getDriverName();
        $dbName = config("database.connections.{$driver}.database", 'db');

        return response()->json([
            'logs'            => $logs,
            'last_download'   => $lastDownloadData,
            'total_downloads' => DatabaseDumpLog::where('status', 'completed')->count(),
            'database_info'   => [
                'driver'   => $driver,
                'database' => $dbName,
            ],
        ]);
    }

    /**
     * Generate and stream database dump download.
     */
    public function download(Request $request): BinaryFileResponse|JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json(['message' => 'Super admin access required.'], 403);
        }

        $format = $request->query('format', 'gz');
        if (!in_array($format, ['sql', 'gz'], true)) {
            $format = 'gz';
        }

        $startTime = microtime(true);

        try {
            $dump = $this->dumpService->generateDump($format);

            // Record audit log
            $log = DatabaseDumpLog::create([
                'user_id'         => $user->id,
                'user_name'       => $user->name,
                'user_email'      => $user->email,
                'file_name'       => $dump['file_name'],
                'file_size_bytes' => $dump['size_bytes'],
                'format'          => $dump['format'],
                'ip_address'      => $request->ip(),
                'status'          => 'completed',
                'duration_ms'     => $dump['duration_ms'],
            ]);

            // Optional activity log entry
            if (Schema::hasTable('activity_logs')) {
                try {
                    DB::table('activity_logs')->insert([
                        'tenant_id'   => null,
                        'entity_type' => 'DATABASE_DUMP',
                        'entity_id'   => $log->id,
                        'user_id'     => $user->id,
                        'action'      => 'downloaded',
                        'meta'        => json_encode([
                            'file_name'  => $dump['file_name'],
                            'size_bytes' => $dump['size_bytes'],
                            'format'     => $dump['format'],
                            'ip'         => $request->ip(),
                        ]),
                        'created_at'  => now(),
                    ]);
                } catch (\Throwable $e) {
                    Log::warning("[DatabaseDumpController] Could not log to activity_logs: " . $e->getMessage());
                }
            }

            $mime = $format === 'gz' ? 'application/gzip' : 'application/sql';

            return response()->download($dump['path'], $dump['file_name'], [
                'Content-Type'        => $mime,
                'Content-Disposition' => 'attachment; filename="' . $dump['file_name'] . '"',
                'Cache-Control'       => 'no-cache, no-store, must-revalidate',
            ])->deleteFileAfterSend(true);

        } catch (\Throwable $e) {
            $durationMs = (int) round((microtime(true) - $startTime) * 1000);

            try {
                DatabaseDumpLog::create([
                    'user_id'         => $user->id,
                    'user_name'       => $user->name,
                    'user_email'      => $user->email,
                    'file_name'       => 'failed_dump_' . now()->format('Y-m-d_His'),
                    'file_size_bytes' => 0,
                    'format'          => $format,
                    'ip_address'      => $request->ip(),
                    'status'          => 'failed',
                    'error_message'   => substr($e->getMessage(), 0, 500),
                    'duration_ms'     => $durationMs,
                ]);
            } catch (\Throwable $logEx) {
                // Ignore log save failure
            }

            Log::error("[DatabaseDumpController] Database dump download failed: " . $e->getMessage(), [
                'exception' => $e,
            ]);

            return response()->json([
                'message' => 'Failed to generate database dump: ' . $e->getMessage(),
            ], 500);
        }
    }
}
