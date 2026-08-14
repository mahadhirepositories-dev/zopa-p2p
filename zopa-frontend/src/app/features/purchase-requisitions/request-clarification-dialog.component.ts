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
  selector: 'app-request-clarification-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, FormsModule, DecimalPipe],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 8px 0;font-size:18px;font-weight:600;color:#d97706;">
        <mat-icon style="color:#d97706;font-size:24px;width:24px;height:24px;">help_outline</mat-icon>
        Request PR Clarification from Requester
      </h2>

      <mat-dialog-content style="padding-top:10px!important;">
        <p style="font-size:13px;color:#64748b;margin:0 0 14px 0;">
          Specify the missing information, incomplete specifications, or queries required from the client/requester.
          PR TAT calculation will be paused while awaiting clarification response.
        </p>

        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>Clarification Query / Missing Details *</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="4" placeholder="e.g. Please clarify item 2 specification, size, brand preference, or delivery site requirements..."></textarea>
        </mat-form-field>

        <!-- Attachment upload section -->
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
            <div style="font-size:11px;color:#94a3b8;">Max 10MB per file (PDF, Excel, Word, Images, etc.)</div>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:12px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="warning" [disabled]="!notes.trim() || submitting" (click)="submit()" style="background:#d97706;color:#fff;padding:0 20px;">
          <mat-icon style="margin-right:6px;">send</mat-icon> Send Clarification Request
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class RequestClarificationDialogComponent {
  data: { prId: number; prNumber?: string } = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<RequestClarificationDialogComponent>);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  notes = '';
  submitting = false;
  selectedFiles: File[] = [];

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFiles.push(...Array.from(input.files));
      input.value = '';
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  submit() {
    if (!this.notes.trim()) return;
    this.submitting = true;

    const fd = new FormData();
    fd.append('notes', this.notes.trim());
    this.selectedFiles.forEach(f => fd.append('files[]', f));

    this.http.post<any>(`${environment.apiUrl}/purchase-requisitions/${this.data.prId}/request-clarification`, fd).subscribe({
      next: (res) => {
        this.notify.success('Clarification request sent successfully.');
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error(err?.error?.error || 'Could not send clarification request.');
      },
    });
  }
}
