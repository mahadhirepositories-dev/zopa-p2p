import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-grn-status-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatIconModule, FormsModule,
  ],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 12px 0;font-size:18px;font-weight:600;">
        <mat-icon style="color:var(--brand);font-size:24px;width:24px;height:24px;">edit_note</mat-icon>
        Update GRN Status & Vendor Document
      </h2>

      <mat-dialog-content style="padding-top:12px!important;">
        <!-- Status Select -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>GRN Status *</mat-label>
          <mat-select [(ngModel)]="status">
            <mat-option value="confirmed">Confirmed (Goods Received & Verified)</mat-option>
            <mat-option value="pending">Pending (Awaiting Physical Receipt / Verification)</mat-option>
            <mat-option value="rejected">Rejected / Returned</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- GRN Number -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>GRN Number</mat-label>
          <input matInput [(ngModel)]="grnNumber" placeholder="e.g. GRN-2026-0001" />
        </mat-form-field>

        <!-- DC Number & Invoice Number -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <mat-form-field appearance="outline">
            <mat-label>DC Number</mat-label>
            <input matInput [(ngModel)]="dcNumber" placeholder="Delivery Challan No." />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Invoice Number</mat-label>
            <input matInput [(ngModel)]="invoiceNumber" placeholder="Vendor Invoice No." />
          </mat-form-field>
        </div>

        <!-- Remarks -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>Physical Receipt Remarks</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="2" placeholder="e.g. Goods physically received and checked against vendor DC..."></textarea>
        </mat-form-field>

        <!-- File Upload Section -->
        <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;">
          <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#0284c7;font-weight:600;font-size:13px;">
            <mat-icon style="font-size:20px;width:20px;height:20px;">cloud_upload</mat-icon>
            {{ selectedFile ? 'Selected: ' + selectedFile.name : 'Upload Vendor Photo / PDF / Delivery Document' }}
            <input type="file" (change)="onFileChange($event)" accept="image/*,application/pdf" style="display:none;" />
          </label>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" style="margin-top:16px;padding:0;">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="saving" (click)="save()" style="padding:0 20px;">
          <mat-icon style="margin-right:6px;">save</mat-icon> Save & Update Status
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class GrnStatusDialogComponent {
  data: any = inject(MAT_DIALOG_DATA) || {};
  private dialogRef = inject(MatDialogRef<GrnStatusDialogComponent>);
  private http = inject(HttpClient);

  grnId = this.data.grn?.id;
  status = this.data.grn?.status || 'confirmed';
  grnNumber = this.data.grn?.grn_number || '';
  dcNumber = this.data.grn?.dc_number || '';
  invoiceNumber = this.data.grn?.invoice_number || '';
  remarks = this.data.grn?.remarks || '';
  selectedFile: File | null = null;
  saving = false;

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
    }
  }

  save() {
    this.saving = true;
    const payload = {
      status: this.status,
      grn_number: this.grnNumber.trim(),
      dc_number: this.dcNumber.trim() || undefined,
      invoice_number: this.invoiceNumber.trim() || undefined,
      remarks: this.remarks.trim() || undefined,
    };

    this.http.put<any>(`${environment.apiUrl}/grns/${this.grnId}`, payload).subscribe({
      next: grn => {
        if (this.selectedFile) {
          const formData = new FormData();
          formData.append('file', this.selectedFile);
          this.http.post(`${environment.apiUrl}/grns/${this.grnId}/upload`, formData).subscribe({
            next: () => this.dialogRef.close(true),
            error: () => this.dialogRef.close(true),
          });
        } else {
          this.dialogRef.close(true);
        }
      },
      error: () => {
        this.saving = false;
      },
    });
  }
}
