import { Component, OnInit, inject, signal, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-grn-detail',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatTableModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;"><mat-spinner diameter="48" /></div>
      } @else if (grn()) {
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <button mat-icon-button routerLink="/grns"><mat-icon>arrow_back</mat-icon></button>
            <h2>{{ grn()!.grn_number }}</h2>
          </div>
          <mat-chip [class]="'status-' + grn()!.status" [highlighted]="true">{{ grn()!.status }}</mat-chip>
        </div>

        <mat-card style="margin-bottom:16px;">
          <mat-card-content style="padding-top:16px;">
            <div class="detail-grid">
              <div><span class="label">PO Number</span>{{ grn()!.purchase_order?.po_number ?? '—' }}</div>
              <div><span class="label">Vendor</span>{{ grn()!.purchase_order?.vendor?.name ?? '—' }}</div>
              <div><span class="label">Received Date</span>{{ grn()!.received_date | date:'dd MMM yyyy' }}</div>
              <div><span class="label">Received By</span>{{ grn()!.received_by?.name ?? '—' }}</div>
            </div>
            <div class="detail-grid" style="margin-top:16px;">
              <div><span class="label">DC Number</span>{{ grn()!.dc_number ?? '—' }}</div>
              <div><span class="label">DC Date</span>{{ grn()!.dc_date ? (grn()!.dc_date | date:'dd MMM yyyy') : '—' }}</div>
              <div><span class="label">Invoice Number</span>{{ grn()!.invoice_number ?? '—' }}</div>
              <div><span class="label">Invoice Date</span>{{ grn()!.invoice_date ? (grn()!.invoice_date | date:'dd MMM yyyy') : '—' }}</div>
            </div>
            @if (grn()!.remarks) {
              <div style="margin-top:16px;"><span class="label">Remarks</span>{{ grn()!.remarks }}</div>
            }
            @if (grn()!.attachments?.length > 0) {
              <div style="margin-top:16px;">
                <span class="label">Attachments</span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
                  @for (a of grn()!.attachments; track a.id) {
                    <div class="attachment-pill" (click)="downloadAttachment(a)">
                      <mat-icon>attach_file</mat-icon>
                      {{ a.original_name }}
                    </div>
                  }
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header><mat-card-title>Items</mat-card-title></mat-card-header>
          <mat-card-content style="padding-top:8px;">
            <table mat-table [dataSource]="grn()!.items ?? []" class="full-width">
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Item</th>
                <td mat-cell *matCellDef="let i">{{ i.po_item?.description }}</td>
              </ng-container>
              <ng-container matColumnDef="received_qty">
                <th mat-header-cell *matHeaderCellDef>Received</th>
                <td mat-cell *matCellDef="let i">{{ i.received_qty }}</td>
              </ng-container>
              <ng-container matColumnDef="accepted_qty">
                <th mat-header-cell *matHeaderCellDef>Accepted</th>
                <td mat-cell *matCellDef="let i">{{ i.accepted_qty }}</td>
              </ng-container>
              <ng-container matColumnDef="rejected_qty">
                <th mat-header-cell *matHeaderCellDef>Rejected</th>
                <td mat-cell *matCellDef="let i">{{ i.rejected_qty }}</td>
              </ng-container>
              <ng-container matColumnDef="remarks">
                <th mat-header-cell *matHeaderCellDef>Remarks</th>
                <td mat-cell *matCellDef="let i">{{ i.remarks ?? '—' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [
    `.page-wrapper{padding:24px} .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px} .full-width{width:100%} .detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px} .label{font-size:10px;color:#888;text-transform:uppercase;display:block;margin-bottom:2px}`,
    `.attachment-pill { display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:16px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:12px;color:#334155;cursor:pointer;transition:all 0.2s; }`,
    `.attachment-pill:hover { background:#e2e8f0; } .attachment-pill mat-icon { font-size:16px;width:16px;height:16px;color:#64748b; }`
  ],
})
export class GrnDetailComponent implements OnInit {
  id = input.required<string>();
  private http = inject(HttpClient);

  grn = signal<any>(null);
  loading = signal(true);
  cols = ['description', 'received_qty', 'accepted_qty', 'rejected_qty', 'remarks'];

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/grns/${this.id()}`).subscribe({
      next: g => { this.grn.set(g); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  downloadAttachment(attachment: any) {
    this.http.get(`${environment.apiUrl}/grns/${this.grn().id}/attachments/${attachment.id}`, { responseType: 'blob' })
      .subscribe(blob => {
        // Create blob URL with explicit MIME type from the response blob
        const url = window.URL.createObjectURL(new Blob([blob], { type: blob.type }));
        window.open(url, '_blank');
        // Revoke after a delay to ensure it had time to load
        setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      });
  }
}
