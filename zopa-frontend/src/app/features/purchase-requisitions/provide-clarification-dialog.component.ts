import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-provide-clarification-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, FormsModule],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 8px 0;font-size:18px;font-weight:600;color:#0284c7;">
        <mat-icon style="color:#0284c7;font-size:24px;width:24px;height:24px;">mark_chat_read</mat-icon>
        Provide Clarification / Respond to Query
      </h2>

      <mat-dialog-content style="padding-top:10px!important;">
        @if (data.requestNotes) {
          <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:12px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
              <mat-icon style="font-size:14px;width:14px;height:14px;">person</mat-icon>
              QUERY FROM BUYER / PROCUREMENT:
            </div>
            <div style="font-size:13px;color:#1e293b;font-weight:500;">
              "{{ data.requestNotes }}"
            </div>
          </div>
        }

        <p style="font-size:13px;color:#64748b;margin:0 0 14px 0;">
          Enter your clarification response below. Providing clarification will resume the PR processing TAT calculation.
        </p>

        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>Clarification Response / Answer *</mat-label>
          <textarea matInput [(ngModel)]="responseNotes" rows="4" placeholder="Provide detailed answers, updated specs, or clarifications requested by buyer..."></textarea>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:12px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-stroked-button color="primary" (click)="editPr()" style="margin-right:8px;">
          <mat-icon>edit</mat-icon> Edit PR Line Items
        </button>
        <button mat-raised-button color="primary" [disabled]="!responseNotes.trim() || submitting" (click)="submit()" style="padding:0 20px;">
          <mat-icon style="margin-right:6px;">check_circle</mat-icon> Submit Response &amp; Resume PR
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class ProvideClarificationDialogComponent {
  data: { prId: number; requestNotes?: string } = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ProvideClarificationDialogComponent>);
  private http = inject(HttpClient);
  private router = inject(Router);
  private notify = inject(NotificationService);

  responseNotes = '';
  submitting = false;

  editPr() {
    this.dialogRef.close();
    this.router.navigate(['/purchase-requisitions', this.data.prId, 'edit']);
  }

  submit() {
    if (!this.responseNotes.trim()) return;
    this.submitting = true;

    this.http.post<any>(`${environment.apiUrl}/purchase-requisitions/${this.data.prId}/provide-clarification`, {
      response_notes: this.responseNotes.trim(),
    }).subscribe({
      next: (res) => {
        this.notify.success('Clarification response submitted. PR processing resumed.');
        this.dialogRef.close(res);
      },
      error: (err) => {
        this.submitting = false;
        this.notify.error(err?.error?.error || 'Could not submit clarification response.');
      },
    });
  }
}
