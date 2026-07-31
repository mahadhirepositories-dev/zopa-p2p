import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delivery-status-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, FormsModule],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 8px 0;font-size:18px;font-weight:600;">
        <mat-icon style="color:#059669;font-size:24px;width:24px;height:24px;">local_shipping</mat-icon>
        Mark PO Delivery Status
      </h2>

      <mat-dialog-content style="padding-top:12px!important;">
        <p style="font-size:13px;color:#64748b;margin:0 0 16px 0;">
          Updating delivery status will automatically send a GRN nudge notification to store managers and GRN handlers.
        </p>

        <!-- Status Select -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>Delivery Status *</mat-label>
          <mat-select [(ngModel)]="status">
            <mat-option value="partially_delivered">Partially Delivered</mat-option>
            <mat-option value="delivered">Delivered (Fully Received)</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Notes Input -->
        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>Delivery Notes / Invoice / Transporter Details (Optional)</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="3" placeholder="Enter delivery remarks or dispatch reference..."></textarea>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:16px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!status" (click)="confirm()" style="padding:0 20px;">
          <mat-icon style="margin-right:6px;">check_circle</mat-icon> Update Delivery Status
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class DeliveryStatusDialogComponent {
  data: { status?: 'partially_delivered' | 'delivered'; notes?: string } = inject(MAT_DIALOG_DATA) || {};
  private dialogRef = inject(MatDialogRef<DeliveryStatusDialogComponent>);

  status: 'partially_delivered' | 'delivered' = this.data.status || 'delivered';
  notes = this.data.notes || '';

  confirm() {
    this.dialogRef.close({ status: this.status, notes: this.notes.trim() });
  }
}
