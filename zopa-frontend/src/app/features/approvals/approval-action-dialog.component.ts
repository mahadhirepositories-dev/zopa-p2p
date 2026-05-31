import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-approval-action-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.label }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width:100%;margin-top:8px;">
        <mat-label>{{ data.action === 'reject' ? 'Reason for Rejection *' : 'Comments (optional)' }}</mat-label>
        <textarea matInput [(ngModel)]="comments" rows="4" placeholder="Enter your comments..."></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button [color]="data.action === 'reject' ? 'warn' : 'primary'"
        [disabled]="data.action === 'reject' && !comments.trim()"
        (click)="confirm()">
        {{ data.label }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ApprovalActionDialogComponent {
  data: { label: string; action: string } = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ApprovalActionDialogComponent>);
  comments = '';

  confirm() {
    this.dialogRef.close(this.comments);
  }
}
