import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';

interface ActivityEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  user_id: number | null;
  action: string;
  meta: Record<string, any> | null;
  created_at: string;
  user?: { id: number; name: string };
}

@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="timeline-wrap">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:24px;">
          <mat-spinner diameter="24" />
        </div>
      } @else if (entries().length === 0) {
        <div class="empty-timeline">
          <mat-icon>history</mat-icon>
          <span>No activity recorded yet.</span>
        </div>
      } @else {
        <div class="timeline">
          @for (e of entries(); track e.id) {
            <div class="tl-item">
              <div class="tl-dot" [class]="dotClass(e.action, e.meta)">
                <mat-icon>{{ actionIcon(e.action, e.meta) }}</mat-icon>
              </div>
              <div class="tl-body">
                <div class="tl-header">
                  <span class="tl-action">{{ actionLabel(e.action, e.meta) }}</span>
                  @if (e.user?.name) {
                    <span class="tl-by">by {{ e.user!.name }}</span>
                  }
                  <span class="tl-time">{{ e.created_at | date:'dd MMM yyyy, HH:mm' }}</span>
                </div>
                @if (e.meta?.['remarks']) {
                  <div class="tl-comment">{{ e.meta!['remarks'] }}</div>
                } @else if (e.meta?.['notes']) {
                  <div class="tl-comment">{{ e.meta!['notes'] }}</div>
                } @else if (e.meta?.['comments']) {
                  <div class="tl-comment">"{{ e.meta!['comments'] }}"</div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-wrap { padding: 4px 0; }
    .empty-timeline { display:flex;align-items:center;gap:8px;color:var(--text-3);font-size:13px;padding:16px 0; }
    .empty-timeline mat-icon { font-size:18px;width:18px;height:18px; }
    .timeline { display:flex;flex-direction:column;gap:0; }
    .tl-item { display:flex;gap:12px;position:relative; }
    .tl-item:not(:last-child)::before {
      content:'';position:absolute;left:11px;top:24px;bottom:-8px;width:2px;background:var(--border);
    }
    .tl-dot {
      width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      flex-shrink:0;margin-top:2px;
    }
    .tl-dot mat-icon { font-size:12px;width:12px;height:12px;color:white; }
    .dot-green  { background:#16a34a; }
    .dot-amber  { background:#d97706; }
    .dot-red    { background:#dc2626; }
    .dot-blue   { background:#2563eb; }
    .dot-gray   { background:#94a3b8; }
    .dot-purple { background:#7c3aed; }
    .tl-body { flex:1;padding-bottom:16px; }
    .tl-header { display:flex;flex-wrap:wrap;align-items:center;gap:6px; }
    .tl-action { font-size:13px;font-weight:600;color:var(--text-1); }
    .tl-by  { font-size:12px;color:var(--text-3); }
    .tl-time { font-size:11px;color:var(--text-3);margin-left:auto; }
    .tl-comment { margin-top:4px;font-size:12px;color:var(--text-2);font-style:italic;
      background:#f8fafc;padding:6px 10px;border-radius:6px;border-left:3px solid var(--border); }
  `],
})
export class ActivityTimelineComponent implements OnChanges {
  @Input() entityType!: string;
  @Input() entityId!: number;

  private http = inject(HttpClient);

  loading = signal(false);
  entries = signal<ActivityEntry[]>([]);

  ngOnChanges() {
    if (this.entityType && this.entityId) {
      this.load();
    }
  }

  load() {
    this.loading.set(true);
    const path = this.entityType === 'PR'
      ? `purchase-requisitions/${this.entityId}/activities`
      : `purchase-orders/${this.entityId}/activities`;

    this.http.get<ActivityEntry[]>(`${environment.apiUrl}/${path}`).subscribe({
      next: r => { this.entries.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  actionIcon(action: string, meta?: any): string {
    const map: Record<string, string> = {
      created: 'add_circle', submitted: 'send', approved: 'check_circle',
      rejected: 'cancel', returned: 'reply', updated: 'edit',
      rfq_created: 'request_quote', rfq_approved: 'verified',
      converted: 'transform', released: 'rocket_launch',
      delivered: 'local_shipping', delivery_status_updated: 'local_shipping',
      partially_delivered: 'local_shipping',
      invoiced: 'receipt_long', payment_released: 'payments', cancelled: 'block', deleted: 'delete',
    };
    return map[action] ?? 'circle';
  }

  actionLabel(action: string, meta?: any): string {
    if (action === 'delivery_status_updated') {
      return meta?.['delivery_status'] === 'partially_delivered' ? 'Marked Partially Delivered' : 'Marked Fully Delivered';
    }
    const map: Record<string, string> = {
      created: 'PR Created', submitted: 'Submitted for Procurement',
      approved: 'Approved', rejected: 'Rejected', returned: 'Returned with Query',
      updated: 'Updated', rfq_created: 'RFQ Created', rfq_approved: 'RFQ Approved',
      converted: 'Converted to PO', released: 'PO Released', delivered: 'Delivered',
      delivery_status_updated: 'Delivery Status Updated',
      partially_delivered: 'Marked Partially Delivered',
      invoiced: 'Invoice Processed', payment_released: 'Payment Released',
      cancelled: 'Cancelled', deleted: 'Deleted',
    };
    return map[action] ?? action.replace(/_/g, ' ');
  }

  dotClass(action: string, meta?: any): string {
    if (action === 'delivery_status_updated') {
      return meta?.['delivery_status'] === 'partially_delivered' ? 'tl-dot dot-amber' : 'tl-dot dot-green';
    }
    const green  = ['created', 'approved', 'rfq_approved', 'converted', 'delivered', 'payment_released'];
    const amber  = ['submitted', 'rfq_created', 'returned', 'updated', 'partially_delivered'];
    const red    = ['rejected', 'cancelled', 'deleted'];
    const blue   = ['released', 'invoiced'];
    const purple = ['payment_released'];

    if (purple.includes(action)) return 'tl-dot dot-purple';
    if (green.includes(action))  return 'tl-dot dot-green';
    if (amber.includes(action))  return 'tl-dot dot-amber';
    if (red.includes(action))    return 'tl-dot dot-red';
    if (blue.includes(action))   return 'tl-dot dot-blue';
    return 'tl-dot dot-gray';
  }
}
