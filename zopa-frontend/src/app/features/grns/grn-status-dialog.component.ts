import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-grn-status-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatIconModule, FormsModule, DecimalPipe,
  ],
  template: `
    <div style="padding:4px 0;">
      <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px;margin:0 0 12px 0;font-size:18px;font-weight:600;">
        <mat-icon style="color:var(--brand);font-size:24px;width:24px;height:24px;">edit_note</mat-icon>
        Complete GRN &amp; Verify Line Items
      </h2>

      <mat-dialog-content style="padding-top:12px!important;max-height:75vh;overflow-y:auto;">
        <!-- Status Select -->
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:12px;">
          <mat-label>GRN Status *</mat-label>
          <mat-select [(ngModel)]="status">
            <mat-option value="confirmed">GRN Captured &amp; Goods Verified</mat-option>
            <mat-option value="pending">Pending GRN (Awaiting Verification)</mat-option>
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
        <mat-form-field appearance="outline" style="width:100%;margin-bottom:14px;">
          <mat-label>Physical Receipt Remarks</mat-label>
          <textarea matInput [(ngModel)]="remarks" rows="2" placeholder="e.g. Goods physically received and checked against vendor DC..."></textarea>
        </mat-form-field>

        <!-- Line Items Quantities Section -->
        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
            <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--brand);">inventory_2</mat-icon>
            Item Quantities Delivered &amp; Accepted
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            @for (item of items; track item.id; let i = $index) {
              <div style="padding:10px 12px;border-bottom:1px solid #f1f5f9;background:#fafafa;">
                <div style="font-weight:600;font-size:12.5px;color:#1e293b;margin-bottom:6px;">
                  {{ i + 1 }}. {{ item.po_item?.description || 'Item' }}
                  <span style="font-size:11px;color:#64748b;font-weight:normal;margin-left:6px;">
                    (Ordered: {{ item.po_item?.qty | number:'1.0-3' }})
                  </span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                  <div>
                    <label style="font-size:10px;color:#64748b;font-weight:600;display:block;margin-bottom:2px;">RECEIVED QTY</label>
                    <input type="number" [(ngModel)]="item.received_qty" (ngModelChange)="onReceivedQtyChange(item)"
                           style="width:100%;padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;font-weight:600;" min="0" />
                  </div>
                  <div>
                    <label style="font-size:10px;color:#15803d;font-weight:600;display:block;margin-bottom:2px;">ACCEPTED QTY</label>
                    <input type="number" [(ngModel)]="item.accepted_qty" (ngModelChange)="onAcceptedQtyChange(item)"
                           style="width:100%;padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;font-weight:600;color:#15803d;" min="0" />
                  </div>
                  <div>
                    <label style="font-size:10px;color:#dc2626;font-weight:600;display:block;margin-bottom:2px;">REJECTED QTY</label>
                    <input type="number" [(ngModel)]="item.rejected_qty" (ngModelChange)="onRejectedQtyChange(item)"
                           style="width:100%;padding:4px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;font-weight:600;color:#dc2626;" min="0" />
                  </div>
                </div>

                <!-- Rejection / Defect Reason Dropdown -->
                @if (+item.rejected_qty > 0) {
                  <div style="margin-top:6px;">
                    <label style="font-size:10px;color:#dc2626;font-weight:700;display:block;margin-bottom:2px;">REJECTION REASON</label>
                    <select [(ngModel)]="item.rejection_reason" style="width:100%;padding:4px 8px;border:1px solid #fecdd3;border-radius:4px;font-size:12px;background:#fff1f2;color:#991b1b;">
                      <option value="Damaged">Damaged in Transit</option>
                      <option value="Not as per specification">Not as per specification</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                }
              </div>
            }
          </div>
        </div>

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
          <mat-icon style="margin-right:6px;">save</mat-icon> Save &amp; Update Status
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class GrnStatusDialogComponent {
  data: any = inject(MAT_DIALOG_DATA) || {};
  private dialogRef = inject(MatDialogRef<GrnStatusDialogComponent>);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  grnId = this.data.grn?.id;
  status = this.data.grn?.status || 'confirmed';
  grnNumber = this.data.grn?.grn_number || '';
  dcNumber = this.data.grn?.dc_number || '';
  invoiceNumber = this.data.grn?.invoice_number || '';
  remarks = this.data.grn?.remarks || '';
  items: any[] = (this.data.grn?.items || []).map((i: any) => ({
    id: i.id,
    po_item: i.po_item,
    received_qty: +i.received_qty,
    accepted_qty: +i.accepted_qty,
    rejected_qty: +i.rejected_qty,
    rejection_reason: i.remarks || 'Not as per specification',
    remarks: i.remarks || '',
  }));

  selectedFile: File | null = null;
  saving = false;

  onReceivedQtyChange(item: any) {
    const maxQty = +(item.po_item?.qty || 999999);
    if (+item.received_qty > maxQty) {
      this.notify.error(`Received Qty cannot exceed ordered quantity (${maxQty}).`);
      item.received_qty = maxQty;
    }
    item.accepted_qty = Math.max(0, +item.received_qty - (+item.rejected_qty || 0));
  }

  onAcceptedQtyChange(item: any) {
    if (+item.accepted_qty > +item.received_qty) {
      this.notify.error(`Accepted Qty cannot exceed Received Qty (${item.received_qty}).`);
      item.accepted_qty = item.received_qty;
    }
    item.rejected_qty = Math.max(0, +item.received_qty - +item.accepted_qty);
  }

  onRejectedQtyChange(item: any) {
    if (+item.rejected_qty > +item.received_qty) {
      this.notify.error(`Rejected Qty cannot exceed Received Qty (${item.received_qty}).`);
      item.rejected_qty = item.received_qty;
    }
    item.accepted_qty = Math.max(0, +item.received_qty - +item.rejected_qty);
  }

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
      items: this.items.map(i => ({
        id: i.id,
        received_qty: +i.received_qty,
        accepted_qty: +i.accepted_qty,
        rejected_qty: +i.rejected_qty,
        remarks: +i.rejected_qty > 0 ? (i.rejection_reason || 'Rejected') : undefined,
      })),
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
