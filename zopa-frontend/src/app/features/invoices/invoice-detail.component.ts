import { Component, OnInit, inject, signal, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatChipsModule, MatProgressSpinnerModule],
  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;"><mat-spinner diameter="48" /></div>
      } @else if (invoice()) {
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <button mat-icon-button routerLink="/invoices"><mat-icon>arrow_back</mat-icon></button>
            <h2>Invoice: {{ invoice()!.invoice_number }}</h2>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <mat-chip [class]="'status-' + invoice()!.status" [highlighted]="true">{{ invoice()!.status }}</mat-chip>
            @if (invoice()!.status === 'pending') {
              <button mat-raised-button color="primary" (click)="updateStatus('approved')">Approve</button>
              <button mat-stroked-button color="warn" (click)="updateStatus('rejected')">Reject</button>
            }
          </div>
        </div>

        <mat-card>
          <mat-card-content style="padding-top:16px;">
            <div class="detail-grid">
              <div><span class="label">PO Number</span>{{ invoice()!.purchase_order?.po_number ?? '—' }}</div>
              <div><span class="label">Vendor</span>{{ invoice()!.purchase_order?.vendor?.name ?? '—' }}</div>
              <div><span class="label">Invoice Date</span>{{ invoice()!.invoice_date | date:'dd MMM yyyy' }}</div>
              <div><span class="label">Amount</span><strong>₹{{ invoice()!.amount | number:'1.2-2' }}</strong></div>
              @if (invoice()!.grn) {
                <div><span class="label">GRN</span>{{ invoice()!.grn?.grn_number }}</div>
              }
              @if (invoice()!.vendor_invoice_ref) {
                <div><span class="label">Vendor Ref</span>{{ invoice()!.vendor_invoice_ref }}</div>
              }
              @if (invoice()!.approved_by) {
                <div><span class="label">Approved By</span>{{ invoice()!.approved_by?.name }}</div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`.page-wrapper{padding:24px} .page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px} .detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px} .label{font-size:10px;color:#888;text-transform:uppercase;display:block;margin-bottom:2px}`],
})
export class InvoiceDetailComponent implements OnInit {
  id = input.required<string>();
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  invoice = signal<any>(null);
  loading = signal(true);

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/invoices/${this.id()}`).subscribe({
      next: inv => { this.invoice.set(inv); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  updateStatus(status: string) {
    this.http.put(`${environment.apiUrl}/invoices/${this.id()}`, { status }).subscribe({
      next: inv => { this.invoice.set(inv); this.notify.success(`Invoice ${status}.`); },
      error: () => this.notify.error('Update failed.'),
    });
  }
}
