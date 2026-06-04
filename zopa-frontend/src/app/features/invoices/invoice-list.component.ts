import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink, MatTableModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule, MatCardModule],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>Invoices</h2>
          <p>{{ invoices().length }} invoice{{ invoices().length !== 1 ? 's' : '' }}</p>
        </div>
        @if (auth.canDo('invoices','create')) {
          <button mat-raised-button color="primary" routerLink="create" class="cta-btn">
            <mat-icon>add</mat-icon> New Invoice
          </button>
        }
      </div>

      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (invoices().length === 0) {
            <div class="empty-state">
              <mat-icon>receipt_long</mat-icon>
              <h3>No invoices yet</h3>
              <p>Create an invoice once goods have been received against a PO.</p>
              @if (auth.canDo('invoices','create')) {
                <button mat-raised-button color="primary" routerLink="create">
                  <mat-icon>add</mat-icon> New Invoice
                </button>
              }
            </div>
          } @else {
            <table mat-table [dataSource]="invoices()" class="full-width">

              <ng-container matColumnDef="invoice_number">
                <th mat-header-cell *matHeaderCellDef>Invoice #</th>
                <td mat-cell *matCellDef="let i">
                  <div class="ref-cell">
                    <div class="ref-icon"><mat-icon>receipt_long</mat-icon></div>
                    <strong>{{ i.invoice_number }}</strong>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="vendor">
                <th mat-header-cell *matHeaderCellDef>Vendor</th>
                <td mat-cell *matCellDef="let i">
                  <div class="vendor-cell">
                    <div class="vendor-chip">{{ i.purchase_order?.vendor?.name?.[0] ?? '?' }}</div>
                    {{ i.purchase_order?.vendor?.name ?? '—' }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="po">
                <th mat-header-cell *matHeaderCellDef>PO Reference</th>
                <td mat-cell *matCellDef="let i" style="color:var(--brand);font-weight:600;">
                  {{ i.purchase_order?.po_number ?? '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="invoice_date">
                <th mat-header-cell *matHeaderCellDef>Invoice Date</th>
                <td mat-cell *matCellDef="let i">{{ i.invoice_date | date:'dd MMM yyyy' }}</td>
              </ng-container>

              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef>Amount</th>
                <td mat-cell *matCellDef="let i">₹{{ i.amount | number:'1.2-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let i">
                  <mat-chip [class]="'status-' + i.status" [highlighted]="true">{{ i.status }}</mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let i">
                  @if (i.status === 'pending' && auth.isAdmin()) {
                    <button mat-button color="primary" (click)="$event.stopPropagation(); updateStatus(i, 'approved')">Approve</button>
                    <button mat-button color="warn" (click)="$event.stopPropagation(); updateStatus(i, 'rejected')">Reject</button>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="arrow">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef><mat-icon class="row-arrow">chevron_right</mat-icon></td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"
                  class="clickable-row" (click)="view(row.id)"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; }
    .page-header p  { margin:3px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .full-width { width:100%; }
    .clickable-row { cursor:pointer; }
    .ref-cell { display:flex; align-items:center; gap:10px; }
    .ref-icon {
      width:32px; height:32px;
      background:#fefce8; border-radius:8px;
      display:flex; align-items:center; justify-content:center;
    }
    .ref-icon mat-icon { font-size:16px; width:16px; height:16px; color:#ca8a04; }
    .vendor-cell { display:flex; align-items:center; gap:8px; font-size:13px; }
    .vendor-chip {
      width:26px; height:26px; border-radius:6px;
      background:#eff6ff; color:#2563eb;
      font-size:11px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      text-transform:uppercase;
    }
    .row-arrow { color:var(--text-3); font-size:18px; }
    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .empty-state p  { margin:0; font-size:13px; color:var(--text-3); }
  `],
})
export class InvoiceListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private notify = inject(NotificationService);
  readonly auth = inject(AuthService);

  columns = ['invoice_number', 'vendor', 'po', 'invoice_date', 'amount', 'status', 'actions', 'arrow'];
  invoices = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/invoices`).subscribe({
      next: res => { this.invoices.set(res.data ?? res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  view(id: number) { this.router.navigate(['/invoices', id]); }

  updateStatus(inv: any, status: string) {
    this.http.put(`${environment.apiUrl}/invoices/${inv.id}`, { status }).subscribe({
      next: () => { this.notify.success(`Invoice ${status}.`); this.load(); },
      error: () => this.notify.error('Update failed.'),
    });
  }
}
