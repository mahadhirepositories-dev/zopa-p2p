import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-short-close-pr-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, FormsModule],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 8px 0;font-size:18px;font-weight:600;color:#dc2626;">
        <mat-icon style="color:#dc2626;font-size:24px;width:24px;height:24px;">do_not_disturb_on</mat-icon>
        Short Close Requisition
      </h2>

      <mat-dialog-content style="padding-top:12px!important;">
        <p style="font-size:13px;color:#64748b;margin:0 0 16px 0;">
          Short closing will mark remaining unconverted quantities as closed and route for cost center approval if configured.
        </p>

        <!-- Reason Input -->
        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>Reason for Short Closing *</mat-label>
          <textarea matInput [(ngModel)]="reason" rows="4" placeholder="Specify why this PR is being short closed..."></textarea>
          @if (!reason.trim()) {
            <mat-error>Reason is required</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:16px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="warn" [disabled]="!reason.trim()" (click)="confirm()" style="padding:0 20px;">
          <mat-icon style="margin-right:6px;">do_not_disturb_on</mat-icon> Submit Short Close
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class ShortClosePrDialogComponent {
  private dialogRef = inject(MatDialogRef<ShortClosePrDialogComponent>);
  reason = '';

  confirm() {
    this.dialogRef.close({ reason: this.reason.trim() });
  }
}
