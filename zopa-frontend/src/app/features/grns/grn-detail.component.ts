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
            @if (grn()!.remarks) {
              <div style="margin-top:12px;"><span class="label">Remarks</span>{{ grn()!.remarks }}</div>
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
  styles: [`.page-wrapper{padding:24px} .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px} .full-width{width:100%} .detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px} .label{font-size:10px;color:#888;text-transform:uppercase;display:block;margin-bottom:2px}`],
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
}
