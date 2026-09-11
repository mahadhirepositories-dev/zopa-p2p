import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatRadioModule } from '@angular/material/radio';
import { AdminService, DatabaseDumpLog, DatabaseDumpResponse } from '../services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-database-dump',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDividerModule, MatRadioModule,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Page Header -->
      <div class="page-header">
        <div>
          <div class="header-badge-row">
            <h2 class="page-title">Database Backup &amp; Dump</h2>
            <span class="role-badge">Super Admin Only</span>
          </div>
          <p class="page-subtitle">
            Generate and securely download a complete snapshot of the database. Every download is recorded with an audit trail.
          </p>
        </div>
        <button mat-stroked-button (click)="loadData()" [disabled]="loading()" class="refresh-btn">
          <mat-icon [class.spin]="loading()">refresh</mat-icon> Refresh
        </button>
      </div>

      <!-- Last Dump Downloaded Card / Banner -->
      <div class="last-dump-banner" [class.has-dump]="lastDownload()" [class.no-dump]="!lastDownload()">
        <div class="banner-icon-box">
          <mat-icon>{{ lastDownload() ? 'cloud_done' : 'history_toggle_off' }}</mat-icon>
        </div>
        <div class="banner-content">
          <div class="banner-title">
            {{ lastDownload() ? 'Last Dump Downloaded' : 'No Database Dumps Yet' }}
          </div>
          @if (lastDownload()) {
            <div class="banner-details">
              <span class="detail-item">
                <mat-icon class="inline-icon">schedule</mat-icon>
                <strong>{{ lastDownload()!.relative_time }}</strong> ({{ lastDownload()!.created_at | date:'dd MMM yyyy, hh:mm a' }})
              </span>
              <span class="detail-sep">•</span>
              <span class="detail-item">
                <mat-icon class="inline-icon">person</mat-icon>
                <strong>{{ lastDownload()!.user_name }}</strong> ({{ lastDownload()!.user_email }})
              </span>
              <span class="detail-sep">•</span>
              <span class="detail-item">
                <mat-icon class="inline-icon">attach_file</mat-icon>
                <code>{{ lastDownload()!.file_name }}</code> ({{ lastDownload()!.formatted_size }})
              </span>
            </div>
          } @else {
            <div class="banner-details text-muted">
              No database dump has been downloaded yet. Use the download action below to generate the initial snapshot.
            </div>
          }
        </div>
        @if (totalDownloads() > 0) {
          <div class="banner-stat">
            <div class="stat-number">{{ totalDownloads() }}</div>
            <div class="stat-label">Total Downloads</div>
          </div>
        }
      </div>

      <!-- Action Panel & Download Options -->
      <mat-card class="action-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="title-icon">download_for_offline</mat-icon>
            Download Fresh Database Snapshot
          </mat-card-title>
        </mat-card-header>
        <mat-divider></mat-divider>
        <mat-card-content class="action-body">
          <div class="format-selection">
            <label class="format-label">Select Dump Format:</label>
            <mat-radio-group [(ngModel)]="selectedFormat" class="format-radios">
              <mat-radio-button value="gz" color="primary">
                <div class="radio-content">
                  <span class="format-name">Compressed SQL (.sql.gz)</span>
                  <span class="format-badge recommended">Recommended</span>
                  <span class="format-desc">Fast download &amp; 80-90% smaller file size via Gzip compression</span>
                </div>
              </mat-radio-button>
              <mat-radio-button value="sql" color="primary">
                <div class="radio-content">
                  <span class="format-name">Plain SQL (.sql)</span>
                  <span class="format-desc">Uncompressed plain-text SQL script</span>
                </div>
              </mat-radio-button>
            </mat-radio-group>
          </div>

          <div class="download-trigger-row">
            <button
              mat-raised-button
              color="primary"
              (click)="triggerDownload()"
              [disabled]="downloading()"
              class="download-cta"
            >
              @if (downloading()) {
                <mat-spinner diameter="20" class="btn-spinner"></mat-spinner>
                <span>Generating &amp; Downloading Dump...</span>
              } @else {
                <mat-icon>cloud_download</mat-icon>
                <span>Download Database Dump (.{{ selectedFormat === 'gz' ? 'sql.gz' : 'sql' }})</span>
              }
            </button>
            <div class="security-note">
              <mat-icon class="inline-icon warn-icon">shield</mat-icon>
              <span>This dump includes all tables, schema, and rows. Please store downloaded copies in a secure, encrypted repository.</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Audit History Card -->
      <mat-card class="history-card">
        <mat-card-header>
          <div class="history-header">
            <mat-card-title>
              <mat-icon class="title-icon">history</mat-icon>
              Dump Download History
            </mat-card-title>
            <span class="record-count">{{ logs().length }} record{{ logs().length !== 1 ? 's' : '' }}</span>
          </div>
        </mat-card-header>
        <mat-divider></mat-divider>

        <mat-card-content style="padding: 0;">
          @if (loading() && logs().length === 0) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <span>Loading dump history...</span>
            </div>
          } @else if (logs().length === 0) {
            <div class="empty-state">
              <mat-icon class="empty-icon">folder_open</mat-icon>
              <p>No dump download logs found</p>
              <span class="empty-hint">Downloads initiated by Super Admins will be logged here.</span>
            </div>
          } @else {
            <div class="table-responsive">
              <table mat-table [dataSource]="logs()" class="dump-table">

                <!-- Date & Time -->
                <ng-container matColumnDef="created_at">
                  <th mat-header-cell *matHeaderCellDef>Date &amp; Time (IST)</th>
                  <td mat-cell *matCellDef="let row" class="cell-datetime">
                    <div class="datetime-primary">{{ row.created_at | date:'dd MMM yyyy, hh:mm a' }}</div>
                    <div class="datetime-relative">{{ row.created_at | date:'EEE' }}</div>
                  </td>
                </ng-container>

                <!-- Downloaded By -->
                <ng-container matColumnDef="user">
                  <th mat-header-cell *matHeaderCellDef>Downloaded By</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="user-cell">
                      <div class="user-avatar">{{ (row.user_name || 'A')[0].toUpperCase() }}</div>
                      <div>
                        <div class="user-name">{{ row.user_name }}</div>
                        <div class="user-email">{{ row.user_email }}</div>
                      </div>
                    </div>
                  </td>
                </ng-container>

                <!-- File Name -->
                <ng-container matColumnDef="file_name">
                  <th mat-header-cell *matHeaderCellDef>File Name</th>
                  <td mat-cell *matCellDef="let row">
                    <code class="file-code">{{ row.file_name }}</code>
                  </td>
                </ng-container>

                <!-- File Size -->
                <ng-container matColumnDef="file_size">
                  <th mat-header-cell *matHeaderCellDef>Size</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="size-text">{{ row.formatted_size }}</span>
                  </td>
                </ng-container>

                <!-- Format -->
                <ng-container matColumnDef="format">
                  <th mat-header-cell *matHeaderCellDef>Format</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="format-pill" [class.gz]="row.format === 'sql.gz'">
                      {{ row.format }}
                    </span>
                  </td>
                </ng-container>

                <!-- IP Address -->
                <ng-container matColumnDef="ip_address">
                  <th mat-header-cell *matHeaderCellDef>IP Address</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="ip-text">{{ row.ip_address || '—' }}</span>
                  </td>
                </ng-container>

                <!-- Status -->
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let row">
                    @if (row.status === 'completed') {
                      <span class="status-pill completed">
                        <mat-icon class="status-icon">check_circle</mat-icon> Completed
                      </span>
                    } @else {
                      <span class="status-pill failed" [matTooltip]="row.error_message || 'Download failed'">
                        <mat-icon class="status-icon">error</mat-icon> Failed
                      </span>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
            </div>
          }
        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .page-wrapper {
      padding: 24px 32px;
      max-width: 1300px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .header-badge-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }

    .role-badge {
      display: inline-block;
      padding: 3px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-radius: 12px;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }

    .page-subtitle {
      margin: 6px 0 0 0;
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
    }

    .refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* ── Last Dump Banner ─────────────────────────────────── */
    .last-dump-banner {
      display: flex;
      align-items: center;
      padding: 16px 22px;
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid transparent;
      gap: 18px;
    }

    .last-dump-banner.has-dump {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .last-dump-banner.no-dump {
      background: #f8fafc;
      border-color: #e2e8f0;
    }

    .banner-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .has-dump .banner-icon-box {
      background: #dcfce7;
      color: #15803d;
    }

    .no-dump .banner-icon-box {
      background: #f1f5f9;
      color: #64748b;
    }

    .banner-content {
      flex: 1;
    }

    .banner-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .banner-details {
      font-size: 13px;
      color: #334155;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .inline-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      vertical-align: -3px;
      margin-right: 3px;
      color: #64748b;
    }

    .detail-sep {
      color: #94a3b8;
    }

    .banner-stat {
      text-align: center;
      padding-left: 20px;
      border-left: 1px solid #bbf7d0;
    }

    .stat-number {
      font-size: 24px;
      font-weight: 800;
      color: #15803d;
      line-height: 1;
    }

    .stat-label {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }

    /* ── Action Card ─────────────────────────────────────── */
    .action-card {
      margin-bottom: 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .title-icon {
      vertical-align: middle;
      margin-right: 8px;
      color: #2563eb;
    }

    .action-body {
      padding: 22px 24px;
    }

    .format-selection {
      margin-bottom: 20px;
    }

    .format-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 10px;
    }

    .format-radios {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .radio-content {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .format-name {
      font-weight: 600;
      font-size: 14px;
      color: #0f172a;
    }

    .format-badge.recommended {
      background: #dbeafe;
      color: #1e40af;
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      text-transform: uppercase;
    }

    .format-desc {
      font-size: 12.5px;
      color: #64748b;
    }

    .download-trigger-row {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }

    .download-cta {
      padding: 8px 24px;
      font-size: 14.5px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-spinner {
      display: inline-block;
      margin-right: 6px;
    }

    .security-note {
      font-size: 12.5px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
      max-width: 600px;
    }

    .warn-icon {
      color: #f59e0b;
    }

    /* ── History Card ────────────────────────────────────── */
    .history-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .record-count {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .dump-table {
      width: 100%;
    }

    .dump-table th {
      background: #f8fafc;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      padding: 12px 16px;
    }

    .dump-table td {
      padding: 12px 16px;
      font-size: 13px;
      color: #1e293b;
      border-bottom: 1px solid #f1f5f9;
    }

    .cell-datetime .datetime-primary {
      font-weight: 600;
      color: #0f172a;
    }

    .cell-datetime .datetime-relative {
      font-size: 11.5px;
      color: #64748b;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-name {
      font-weight: 600;
      font-size: 13px;
      color: #0f172a;
    }

    .user-email {
      font-size: 11.5px;
      color: #64748b;
    }

    .file-code {
      font-size: 12px;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #334155;
    }

    .size-text {
      font-weight: 600;
      color: #0f172a;
    }

    .format-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
    }

    .format-pill.gz {
      background: #e0e7ff;
      color: #3730a3;
    }

    .ip-text {
      font-family: monospace;
      font-size: 12px;
      color: #64748b;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .status-pill.completed {
      background: #dcfce7;
      color: #166534;
    }

    .status-pill.failed {
      background: #fee2e2;
      color: #991b1b;
      cursor: help;
    }

    .status-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .loading-state, .empty-state {
      padding: 48px 24px;
      text-align: center;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .empty-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
      color: #cbd5e1;
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }

    .empty-hint {
      font-size: 12.5px;
      color: #94a3b8;
    }
  `]
})
export class DatabaseDumpComponent implements OnInit {
  private adminService = inject(AdminService);
  private notify = inject(NotificationService);

  loading = signal<boolean>(false);
  downloading = signal<boolean>(false);
  logs = signal<DatabaseDumpLog[]>([]);
  lastDownload = signal<DatabaseDumpResponse['last_download']>(null);
  totalDownloads = signal<number>(0);

  selectedFormat: 'gz' | 'sql' = 'gz';

  displayedColumns: string[] = [
    'created_at',
    'user',
    'file_name',
    'file_size',
    'format',
    'ip_address',
    'status',
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.adminService.getDatabaseDumpLogs().subscribe({
      next: (res) => {
        this.logs.set(res.logs?.data || []);
        this.lastDownload.set(res.last_download);
        this.totalDownloads.set(res.total_downloads || 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Failed to load database dump history: ' + (err.error?.message || err.message));
      }
    });
  }

  triggerDownload(): void {
    if (this.downloading()) return;

    this.downloading.set(true);
    const format = this.selectedFormat;

    this.adminService.downloadDatabaseDump(format).subscribe({
      next: (blob) => {
        this.downloading.set(false);

        // Generate download filename if not in header
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const fileName = `zopa_db_dump_${timestamp}.${format === 'gz' ? 'sql.gz' : 'sql'}`;

        // Trigger browser file download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        this.notify.success(`Database dump (.${format}) downloaded successfully.`);

        // Refresh log table immediately
        this.loadData();
      },
      error: (err) => {
        this.downloading.set(false);
        this.notify.error('Failed to generate database dump: ' + (err.error?.message || 'Server error'));
        this.loadData();
      }
    });
  }
}
