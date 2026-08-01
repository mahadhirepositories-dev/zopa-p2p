import { Component, OnInit, inject, signal, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { GrnStatusDialogComponent } from './grn-status-dialog.component';

@Component({
  selector: 'app-grn-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink,
    MatButtonModule, MatIconModule, MatCardModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule, MatTooltipModule, MatDialogModule],

  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;"><mat-spinner diameter="48" /></div>
      } @else if (grn()) {

        <!-- ── Header ── -->
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <button mat-icon-button routerLink="/grns"><mat-icon>arrow_back</mat-icon></button>
            <div>
              <h2 style="margin:0;font-size:20px;font-weight:700;">{{ grn()!.grn_number }}</h2>
              <div style="font-size:12px;color:var(--text-3);margin-top:2px;">
                Against PO:
                <a [routerLink]="['/purchase-orders', grn()!.purchase_order?.id]"
                   style="color:var(--brand);font-weight:600;text-decoration:none;">
                  {{ grn()!.purchase_order?.po_number ?? '—' }}
                </a>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <mat-chip [class]="'status-' + grn()!.status" [highlighted]="true">{{ grn()!.status }}</mat-chip>
            <button mat-raised-button color="primary" (click)="openStatusDialog()">
              <mat-icon>edit_note</mat-icon> Update Status / Vendor Doc
            </button>
            <button mat-stroked-button (click)="downloadPdf()" [disabled]="pdfLoading()">
              @if (pdfLoading()) { <mat-spinner diameter="16" /> }
              @else { <mat-icon>picture_as_pdf</mat-icon> }
              Download GRN PDF
            </button>
          </div>

        </div>

        <!-- ── Info Card ── -->
        <mat-card style="margin-bottom:16px;">
          <mat-card-content style="padding-top:16px;">
            <div class="detail-grid">
              <div><span class="label">PO Number</span>{{ grn()!.purchase_order?.po_number ?? '—' }}</div>
              <div><span class="label">Vendor</span>{{ grn()!.purchase_order?.vendor?.name ?? '—' }}</div>
              <div><span class="label">Received Date</span>{{ grn()!.received_date | date:'dd MMM yyyy' }}</div>
              <div><span class="label">Received By</span>{{ grn()!.received_by?.name ?? '—' }}</div>
            </div>
            <div class="detail-grid" style="margin-top:16px;">
              <div>
                <span class="label">DC Number</span>
                {{ grn()!.dc_number ?? '—' }}
                @if (grn()!.dc_date) {
                  <div style="font-size:11px;color:var(--text-3);margin-top:2px;">{{ grn()!.dc_date | date:'dd MMM yyyy' }}</div>
                }
              </div>
              <div>
                <span class="label">DC Date</span>
                {{ grn()!.dc_date ? (grn()!.dc_date | date:'dd MMM yyyy') : '—' }}
              </div>
              <div>
                <span class="label">Invoice Number</span>
                {{ grn()!.invoice_number ?? '—' }}
              </div>
              <div>
                <span class="label">Invoice Date</span>
                {{ grn()!.invoice_date ? (grn()!.invoice_date | date:'dd MMM yyyy') : '—' }}
              </div>
            </div>
            @if (grn()!.remarks) {
              <div style="margin-top:16px;padding:10px 14px;background:#f8fafc;border-left:3px solid var(--brand);border-radius:6px;font-size:13px;">
                <span class="label">Remarks</span>{{ grn()!.remarks }}
              </div>
            }
            <div style="margin-top:16px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span class="label">Vendor Documents & Attachments</span>
                <label class="upload-btn">
                  <mat-icon style="font-size:16px;width:16px;height:16px;">cloud_upload</mat-icon>
                  Upload Vendor Doc / Photo / PDF
                  <input type="file" (change)="onUploadFile($event)" accept="image/*,application/pdf" style="display:none;" />
                </label>
              </div>
              @if (grn()!.attachments?.length > 0) {
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                  @for (a of grn()!.attachments; track a.id) {
                    <div class="attachment-pill" (click)="downloadAttachment(a)" [title]="'Click to view ' + a.original_name">
                      <mat-icon>insert_drive_file</mat-icon>
                      {{ a.original_name }}
                    </div>
                  }
                </div>
              } @else {
                <div style="font-size:12px;color:#94a3b8;margin-top:6px;font-style:italic;">
                  No vendor GRN photo / PDF uploaded yet. Click above to attach vendor document.
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>


        <!-- ── Items Table ── -->
        <mat-card>
          <mat-card-header>
            <mat-card-title style="font-size:15px;">
              <mat-icon style="vertical-align:middle;margin-right:6px;font-size:18px;color:var(--brand);">inventory_2</mat-icon>
              Items
              <span style="font-size:11px;background:#e2e8f0;color:#334155;padding:2px 8px;border-radius:99px;font-weight:700;margin-left:8px;">
                {{ grn()!.items?.length ?? 0 }}
              </span>
            </mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding:0 !important;">
            <div style="overflow-x:auto;">
              <table class="grn-items-table">
                <colgroup>
                  <col style="width:32px;">
                  <col style="min-width:220px;">
                  <col style="width:80px;">
                  <col style="width:100px;">
                  <col style="width:110px;">
                  <col style="width:100px;">
                  <col style="min-width:140px;">
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th class="ta-c">Ordered</th>
                    <th class="ta-c">Received</th>
                    <th class="ta-c">Accepted</th>
                    <th class="ta-c">Rejected</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of grn()!.items; track item.id; let i = $index) {
                    <tr>
                      <td class="ta-c sno">{{ i + 1 }}</td>
                      <td>
                        <div class="item-name">{{ item.po_item?.description }}</div>
                        @if (item.po_item?.product?.code) {
                          <div class="item-meta">Code: {{ item.po_item.product.code }}</div>
                        }
                        @if (item.po_item?.product?.hsn_code) {
                          <div class="item-meta">HSN: {{ item.po_item.product.hsn_code }}</div>
                        }
                      </td>
                      <td class="ta-c">
                        <span class="qty-badge ordered">{{ item.po_item?.qty | number:'1.0-3' }}</span>
                      </td>
                      <td class="ta-c">
                        <span class="qty-badge received">{{ item.received_qty | number:'1.0-3' }}</span>
                      </td>
                      <td class="ta-c">
                        <span class="qty-badge accepted">{{ item.accepted_qty | number:'1.0-3' }}</span>
                      </td>
                      <td class="ta-c">
                        @if (+item.rejected_qty > 0) {
                          <span class="qty-badge rejected">{{ item.rejected_qty | number:'1.0-3' }}</span>
                        } @else {
                          <span style="color:#94a3b8;">—</span>
                        }
                      </td>
                      <td class="remarks-cell">{{ item.remarks ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card-content>
        </mat-card>

      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 24px; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px;
    }
    .detail-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
    .label {
      font-size: 10px; color: #94a3b8; text-transform: uppercase;
      letter-spacing: .05em; display: block; margin-bottom: 3px; font-weight: 600;
    }

    .attachment-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 12px; border-radius: 16px;
      background: #f1f5f9; border: 1px solid #e2e8f0;
      font-size: 12px; color: #334155; cursor: pointer; transition: all 0.2s;
    }
    .attachment-pill:hover { background: #e2e8f0; }
    .attachment-pill mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }

    .upload-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; background: #eff6ff; color: #1d4ed8;
      border: 1px solid #bfdbfe; border-radius: 8px; font-size: 12px;
      font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .upload-btn:hover { background: #dbeafe; border-color: #93c5fd; }

    /* Items table */
    .grn-items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .grn-items-table thead tr { background: #f8fafc; border-bottom: 2px solid var(--border); }
    .grn-items-table th {
      padding: 10px 14px; font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: .06em;
      color: var(--text-3); text-align: left; white-space: nowrap;
    }
    .grn-items-table th.ta-c { text-align: center; }
    .grn-items-table tbody tr { border-bottom: 1px solid #f0f4f8; }
    .grn-items-table tbody tr:hover { background: #fafbff; }
    .grn-items-table td { padding: 10px 14px; vertical-align: middle; }
    .ta-c { text-align: center; }
    .sno { color: var(--text-3); font-size: 12px; }

    .item-name { font-weight: 600; color: var(--text-1); }
    .item-meta { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .remarks-cell { font-size: 12px; color: var(--text-3); }

    .qty-badge {
      display: inline-block; padding: 3px 10px; border-radius: 99px;
      font-size: 12px; font-weight: 700; min-width: 48px; text-align: center;
    }
    .qty-badge.ordered  { background: #eff6ff; color: #1d4ed8; }
    .qty-badge.received { background: #fff7ed; color: #c2410c; }
    .qty-badge.accepted { background: #f0fdf4; color: #15803d; }
    .qty-badge.rejected { background: #fff1f2; color: #dc2626; }

    .status-confirmed { background: #f0fdf4; color: #15803d; }
  `],
})
export class GrnDetailComponent implements OnInit {
  id = input.required<string>();
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  grn = signal<any>(null);
  loading = signal(true);
  pdfLoading = signal(false);

  ngOnInit() {
    this.loadGrn();
  }

  openStatusDialog() {
    const ref = this.dialog.open(GrnStatusDialogComponent, {
      width: '520px',
      data: { grn: this.grn() },
    });

    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.notify.success('GRN status & details updated.');
        this.loadGrn();
      }
    });
  }

  loadGrn() {

    this.http.get<any>(`${environment.apiUrl}/grns/${this.id()}`).subscribe({
      next: g => { this.grn.set(g); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onUploadFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const formData = new FormData();
      formData.append('file', file);

      this.http.post(`${environment.apiUrl}/grns/${this.id()}/upload`, formData).subscribe({
        next: () => {
          this.notify.success('Vendor document / photo attached successfully.');
          this.loadGrn();
        },
        error: () => this.notify.error('Could not upload vendor document.')
      });
    }
  }

  downloadPdf() {
    this.pdfLoading.set(true);
    this.http.get<any>(`${environment.apiUrl}/grns/${this.id()}/pdf-url`).subscribe({
      next: res => {
        this.pdfLoading.set(false);
        window.open(res.url, '_blank');
      },
      error: () => {
        this.pdfLoading.set(false);
        this.notify.error('Could not generate GRN PDF.');
      },
    });
  }

  downloadAttachment(attachment: any) {
    this.http.get(`${environment.apiUrl}/grns/${this.grn().id}/attachments/${attachment.id}`, { responseType: 'blob' })
      .subscribe(blob => {
        const url = window.URL.createObjectURL(new Blob([blob], { type: blob.type }));
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      });
  }
}

