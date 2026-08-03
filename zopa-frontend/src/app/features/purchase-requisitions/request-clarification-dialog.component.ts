import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-request-clarification-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, FormsModule],
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

  submit() {
    if (!this.notes.trim()) return;
    this.submitting = true;

    this.http.post<any>(`${environment.apiUrl}/purchase-requisitions/${this.data.prId}/request-clarification`, {
      notes: this.notes.trim(),
    }).subscribe({
      next: (res) => {
        this.notify.success('Clarification request sent to requester successfully.');
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error(err?.error?.error || 'Could not send clarification request.');
      },
    });
  }
}
