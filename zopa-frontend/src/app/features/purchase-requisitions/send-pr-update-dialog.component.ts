import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-send-pr-update-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatIconModule, FormsModule, DecimalPipe,
  ],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 8px 0;font-size:18px;font-weight:700;color:#0284c7;">
        <mat-icon style="color:#0284c7;font-size:24px;width:24px;height:24px;">rate_review</mat-icon>
        Send PR Status Update
      </h2>

      <mat-dialog-content style="padding-top:6px!important;">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:#0369a1;display:flex;flex-direction:column;gap:3px;">
          <div><strong>PR Number:</strong> {{ data.prNumber || ('PR #' + data.prId) }} &mdash; {{ data.prTitle }}</div>
          <div><strong>To (PR Raiser):</strong> {{ data.requestedByName || 'PR Raiser' }} {{ data.requestedByEmail ? '(' + data.requestedByEmail + ')' : '' }}</div>
        </div>

        <p style="font-size:13px;color:#64748b;margin:0 0 14px 0;">
          Send a status update message directly to the PR raiser to keep them informed on progress, vendor negotiations, or delivery timelines.
        </p>

        <!-- CC Email Field -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>CC Email Addresses (Optional)</mat-label>
          <input matInput [(ngModel)]="ccEmails" placeholder="e.g. manager@company.com, finance@company.com" />
          <mat-hint>Tag stakeholders related to this PR (separate multiple emails with commas)</mat-hint>
        </mat-form-field>

        <!-- Message Field -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>Status Update Message *</mat-label>
          <textarea matInput [(ngModel)]="message" rows="5" placeholder="Enter status update message (e.g. We have requested quotes from vendors, vendor response expected by tomorrow. Processing is on track...)"></textarea>
        </mat-form-field>

        <!-- File Upload Section -->
        <div style="border:1px dashed #cbd5e1;border-radius:8px;padding:12px;margin-bottom:12px;background:#f8fafc;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:600;color:#475569;display:flex;align-items:center;gap:6px;">
              <mat-icon style="font-size:16px;width:16px;height:16px;color:#64748b;">attach_file</mat-icon> Attachments (Optional)
            </span>
            <button mat-stroked-button type="button" (click)="fileInput.click()" style="font-size:12px;height:32px;line-height:30px;">
              <mat-icon style="font-size:16px;width:16px;height:16px;margin-right:4px;">upload_file</mat-icon> Choose Files
            </button>
            <input #fileInput type="file" multiple hidden (change)="onFileSelect($event)" />
          </div>

          @if (selectedFiles.length > 0) {
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
              @for (file of selectedFiles; track file.name; let i = $index) {
                <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;font-size:12px;">
                  <span style="display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px;">
                    <mat-icon style="font-size:16px;width:16px;height:16px;color:#0284c7;">description</mat-icon>
                    {{ file.name }}
                    <span style="color:#94a3b8;font-size:11px;">({{ file.size / 1024 | number:'1.0-0' }} KB)</span>
                  </span>
                  <button mat-icon-button color="warn" type="button" (click)="removeFile(i)" style="width:24px;height:24px;line-height:24px;">
                    <mat-icon style="font-size:16px;width:16px;height:16px;">close</mat-icon>
                  </button>
                </div>
              }
            </div>
          } @else {
            <div style="font-size:11px;color:#94a3b8;">Attach specs, quote comparison, or vendor notes (Max 10MB per file)</div>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:12px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!message.trim() || submitting" (click)="submit()" style="padding:0 20px;">
          <mat-icon style="margin-right:6px;">send</mat-icon> Send PR Update
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class SendPrUpdateDialogComponent {
  data: {
    prId: number;
    prNumber?: string;
    prTitle?: string;
    requestedByName?: string;
    requestedByEmail?: string;
  } = inject(MAT_DIALOG_DATA);

  private dialogRef = inject(MatDialogRef<SendPrUpdateDialogComponent>);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  ccEmails = '';
  message = '';
  selectedFiles: File[] = [];
  submitting = false;

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      for (const file of files) {
        if (file.size > 10240 * 1024) {
          this.notify.error(`File "${file.name}" exceeds 10MB limit.`);
          continue;
        }
        this.selectedFiles.push(file);
      }
      input.value = '';
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  submit() {
    if (!this.message.trim()) return;

    this.submitting = true;
    const formData = new FormData();
    formData.append('message', this.message.trim());
    if (this.ccEmails.trim()) {
      formData.append('cc_emails', this.ccEmails.trim());
    }

    for (const file of this.selectedFiles) {
      formData.append('files[]', file, file.name);
    }

    this.http.post<any>(`${environment.apiUrl}/purchase-requisitions/${this.data.prId}/send-update`, formData).subscribe({
      next: (res) => {
        this.notify.success(res.message || 'PR Status Update sent successfully.');
        this.dialogRef.close(res.pr ?? true);
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error(err.error?.error || err.error?.message || 'Failed to send PR status update.');
      },
    });
  }
}
