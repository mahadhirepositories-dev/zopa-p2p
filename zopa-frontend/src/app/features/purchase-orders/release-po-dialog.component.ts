import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-release-po-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, FormsModule],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 8px 0;font-size:18px;font-weight:600;">
        <mat-icon style="color:var(--brand);font-size:24px;width:24px;height:24px;">send</mat-icon>
        {{ data.title || 'Release Purchase Order' }}
      </h2>

      <mat-dialog-content style="padding-top:12px!important;">
        <!-- Vendor Info Preview -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:4px;">
            Target Vendor
          </div>
          <div style="font-size:14px;font-weight:600;color:#1e293b;">
            {{ data.vendorName || 'Vendor' }}
          </div>
          @if (data.vendorEmail) {
            <div style="font-size:12px;color:#0284c7;display:flex;align-items:center;gap:4px;margin-top:2px;">
              <mat-icon style="font-size:14px;width:14px;height:14px;">email</mat-icon>
              {{ data.vendorEmail }}
            </div>
          } @else {
            <div style="font-size:12px;color:#d97706;margin-top:2px;">
              No vendor email on file. Add CC emails below to send the PO.
            </div>
          }
        </div>

        <!-- CC Emails Input -->
        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>Additional CC Email Addresses (Optional)</mat-label>
          <input matInput [(ngModel)]="ccEmails" placeholder="e.g. accounts@client.com, manager@client.com" />
          <mat-icon matSuffix style="color:#64748b;">mail_outline</mat-icon>
          <mat-hint>Separate multiple email addresses with commas</mat-hint>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:16px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" (click)="confirm()" style="padding:0 20px;">
          <mat-icon style="margin-right:6px;">send</mat-icon>
          {{ data.confirmText || 'Release & Send PO' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class ReleasePoDialogComponent {
  data: { poNumber?: string; vendorName?: string; vendorEmail?: string; title?: string; confirmText?: string } = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<ReleasePoDialogComponent>);
  ccEmails = '';

  confirm() {
    this.dialogRef.close({ ccEmails: this.ccEmails.trim() });
  }
}
