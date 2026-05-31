import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AdminService, PlatformSettings } from '../services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDividerModule,
  ],
  template: `
    <div class="page-wrapper">

      <div class="page-header">
        <div>
          <h2 style="margin:0;font-size:22px;font-weight:700;">Platform Settings</h2>
          <div style="font-size:13px;color:var(--text-3);margin-top:3px;">
            Manage ZOPA's parent company branding. The platform logo appears in PDF footers
            and as a header fallback when a client has no logo of their own.
          </div>
        </div>
      </div>

      <div class="settings-grid">

        <!-- ── Platform Logo card ───────────────────────────── -->
        <mat-card class="logo-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon style="vertical-align:middle;margin-right:6px;color:var(--brand);">image</mat-icon>
              Platform Logo
            </mat-card-title>
          </mat-card-header>
          <mat-divider />
          <mat-card-content style="padding:24px;">

            @if (loading()) {
              <div class="center-box"><mat-spinner diameter="36" /></div>
            } @else {

              <!-- Logo preview area -->
              <div class="logo-preview-area">
                @if (settings()?.logo_url) {
                  <img [src]="settings()!.logo_url" class="logo-preview-img" alt="Platform Logo" />
                } @else {
                  <div class="logo-placeholder">
                    <mat-icon style="font-size:48px;width:48px;height:48px;color:#cbd5e1;">image</mat-icon>
                    <div style="font-size:13px;color:var(--text-3);margin-top:8px;">No logo uploaded yet</div>
                  </div>
                }
              </div>

              <!-- Upload / Remove actions -->
              <div class="logo-actions">
                <button mat-raised-button color="primary"
                        [disabled]="uploading()"
                        (click)="logoInput.click()">
                  @if (uploading()) { <mat-spinner diameter="18" style="margin-right:6px;" /> }
                  @else { <mat-icon>upload</mat-icon> }
                  {{ settings()?.logo_url ? 'Replace Logo' : 'Upload Logo' }}
                </button>

                @if (settings()?.logo_url) {
                  <button mat-stroked-button color="warn"
                          [disabled]="uploading()"
                          (click)="removeLogo()"
                          matTooltip="Remove logo">
                    <mat-icon>delete</mat-icon> Remove
                  </button>
                }

                <input #logoInput type="file" accept="image/*" style="display:none"
                       (change)="onLogoSelected($event)" />
              </div>

              <div class="logo-hint">
                Accepted: PNG, JPG, SVG, GIF, WebP &mdash; max 2 MB
              </div>
            }

          </mat-card-content>
        </mat-card>

        <!-- ── PDF Preview card ─────────────────────────────── -->
        <mat-card class="preview-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon style="vertical-align:middle;margin-right:6px;color:var(--brand);">picture_as_pdf</mat-icon>
              PDF Appearance
            </mat-card-title>
          </mat-card-header>
          <mat-divider />
          <mat-card-content style="padding:24px;">

            <div style="font-size:13px;color:var(--text-2);line-height:1.7;">
              <div class="rule-row">
                <span class="rule-icon" style="background:#dbeafe;">
                  <mat-icon style="color:#1d4ed8;font-size:16px;width:16px;height:16px;">business</mat-icon>
                </span>
                <div>
                  <strong>Client has own logo</strong>
                  <div style="color:var(--text-3);">Client logo shown in the PO header</div>
                </div>
              </div>
              <div class="rule-row">
                <span class="rule-icon" style="background:#f0fdf4;">
                  <mat-icon style="color:#16a34a;font-size:16px;width:16px;height:16px;">image</mat-icon>
                </span>
                <div>
                  <strong>Client has no logo</strong>
                  <div style="color:var(--text-3);">Platform logo shown in header as fallback</div>
                </div>
              </div>
              <div class="rule-row">
                <span class="rule-icon" style="background:#f5f3ff;">
                  <mat-icon style="color:#7c3aed;font-size:16px;width:16px;height:16px;">photo_size_select_small</mat-icon>
                </span>
                <div>
                  <strong>PDF footer</strong>
                  <div style="color:var(--text-3);">Platform logo shown small next to "ZOPA Procurement Platform"</div>
                </div>
              </div>
            </div>

            <mat-divider style="margin:20px 0;" />

            <div style="font-size:12px;color:var(--text-3);">
              To upload a client company logo, go to
              <strong style="color:var(--brand);">Client Management → select client → camera icon</strong>
              in the header.
            </div>

          </mat-card-content>
        </mat-card>

      </div>
    </div>
  `,
  styles: [`
    .page-wrapper  { padding: 28px; }
    .page-header   { margin-bottom: 28px; }

    .settings-grid {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 20px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .settings-grid { grid-template-columns: 1fr; }
    }

    .logo-card, .preview-card {
      border-radius: 14px !important;
    }

    .center-box {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .logo-preview-area {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 160px;
      background: #f8fafc;
      border: 2px dashed var(--border);
      border-radius: 10px;
      margin-bottom: 20px;
      padding: 20px;
    }
    .logo-preview-img {
      max-height: 120px;
      max-width: 320px;
      object-fit: contain;
    }
    .logo-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: var(--text-3);
    }

    .logo-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .logo-hint {
      font-size: 11px;
      color: var(--text-3);
    }

    .rule-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .rule-row:last-child { border-bottom: none; }
    .rule-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `],
})
export class PlatformSettingsComponent implements OnInit {
  @ViewChild('logoInput') logoInputRef!: ElementRef<HTMLInputElement>;

  private adminService = inject(AdminService);
  private notify       = inject(NotificationService);

  settings  = signal<PlatformSettings | null>(null);
  loading   = signal(true);
  uploading = signal(false);

  ngOnInit() {
    this.adminService.getPlatformSettings().subscribe({
      next:  s  => { this.settings.set(s);  this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.adminService.uploadPlatformLogo(file).subscribe({
      next: s => {
        this.settings.set(s);
        this.uploading.set(false);
        input.value = '';
        this.notify.success('Platform logo updated successfully.');
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
        this.notify.error('Logo upload failed. Please try again.');
      },
    });
  }

  removeLogo() {
    this.uploading.set(true);
    this.adminService.removePlatformLogo().subscribe({
      next: s => {
        this.settings.set(s);
        this.uploading.set(false);
        this.notify.success('Platform logo removed.');
      },
      error: () => { this.uploading.set(false); },
    });
  }
}
