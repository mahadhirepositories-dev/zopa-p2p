import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';
import { RateCardFormDialogComponent } from './rate-card-form-dialog.component';

export interface RateCard {
  id: number;
  vendor_id: number;
  product_id: number;
  uom: string | null;
  moq: string | number | null;
  mrp: string | number | null;
  net_rate: string | number;
  lead_time_days: number | null;
  updated_at: string;
  vendor?: { id: number; name: string; global_vendor_code?: string };
  product?: { id: number; name: string; code?: string; unit?: string; net_rate?: string | number; gst_rate?: string | number };
  updater?: { id: number; name: string } | null;
}

/** Net price plus GST, to the paisa. The backend's MRP check rounds the same way. */
export function grossPrice(net: string | number, gstRate: string | number): number {
  return Math.round(+net * (1 + +gstRate / 100) * 100) / 100;
}

type Change = { old: string | number | null; new: string | number | null };

interface LogEntry {
  id: number;
  action: 'created' | 'updated' | 'deleted';
  created_at: string;
  user?: { name: string } | null;
  meta: {
    vendor_id: number; vendor?: string; product_id: number; product?: string; product_code?: string;
    changes: Record<string, Change>;
  };
}

const TERM_LABELS: Record<string, string> = {
  uom: 'UOM', moq: 'MOQ', mrp: 'MRP', net_rate: 'Net Price', lead_time_days: 'Lead Time',
};

@Component({
  selector: 'app-rate-card-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, MatTableModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDialogModule, MatCardModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <div class="page-header">
        <div>
          <h2>Rate Cards</h2>
          <p>Each vendor's agreed terms per product. POs for that vendor use its price and unit, which can't be changed on the PO.</p>
        </div>
        <div class="header-actions">
          @if (view() === 'rates') {
            <app-search-field class="search-field" [value]="search()" (valueChange)="search.set($event)"
                              placeholder="Search vendor or product…" />
          }
          @if (auth.canDo('rate_cards','create')) {
            <button mat-raised-button color="primary" class="cta-btn" (click)="openForm()">
              <mat-icon>add</mat-icon> New Rate Card
            </button>
          }
        </div>
      </div>

      <div class="filter-row">
        <button class="filter-chip" [class.active]="view() === 'rates'" (click)="view.set('rates')">Rates ({{ cards().length }})</button>
        <button class="filter-chip" [class.active]="view() === 'log' && !logFilter()" (click)="showLog(null)">Change log</button>
        @if (view() === 'log' && logFilter(); as f) {
          <button class="filter-chip active" (click)="showLog(null)" matTooltip="Show the whole change log">
            {{ f.vendor }} · {{ f.product }} <mat-icon class="chip-x">close</mat-icon>
          </button>
        }
      </div>

      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (view() === 'rates') {
            @if (loading()) {
              <div class="loading-state"><mat-spinner diameter="36" /></div>
            } @else if (filtered().length === 0) {
              <div class="empty-state">
                <mat-icon>sell</mat-icon>
                <h3>No rate cards found</h3>
                <p>{{ search() ? 'Try a different search term.' : 'Add a vendor\\'s terms for a product. Until then, POs use the product master rate.' }}</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table mat-table [dataSource]="filtered()">
                  <ng-container matColumnDef="code">
                    <th mat-header-cell *matHeaderCellDef>Product Code</th>
                    <td mat-cell *matCellDef="let c" class="mono">{{ c.product?.code || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="product">
                    <th mat-header-cell *matHeaderCellDef>Product</th>
                    <td mat-cell *matCellDef="let c"><div class="name-primary">{{ c.product?.name }}</div></td>
                  </ng-container>
                  <ng-container matColumnDef="vendor">
                    <th mat-header-cell *matHeaderCellDef>Vendor</th>
                    <td mat-cell *matCellDef="let c">
                      <div class="name-primary">{{ c.vendor?.name }}</div>
                      @if (c.vendor?.global_vendor_code) { <div class="name-sub">{{ c.vendor.global_vendor_code }}</div> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="uom">
                    <th mat-header-cell *matHeaderCellDef>UOM</th>
                    <td mat-cell *matCellDef="let c">{{ c.uom || c.product?.unit || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="moq">
                    <th mat-header-cell *matHeaderCellDef class="num">MOQ</th>
                    <td mat-cell *matCellDef="let c" class="num">{{ c.moq != null ? (+c.moq | number:'1.0-3') : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="mrp">
                    <th mat-header-cell *matHeaderCellDef class="num">MRP (incl GST)</th>
                    <td mat-cell *matCellDef="let c" class="num">{{ c.mrp != null ? '₹' + (+c.mrp | number:'1.2-2') : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="net">
                    <th mat-header-cell *matHeaderCellDef class="num">Net Price (excl tax)</th>
                    <td mat-cell *matCellDef="let c" class="num amount">₹{{ +c.net_rate | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="gross">
                    <th mat-header-cell *matHeaderCellDef class="num">Gross Price (incl tax)</th>
                    <td mat-cell *matCellDef="let c" class="num">
                      ₹{{ gross(c) | number:'1.2-2' }}
                      <div class="name-sub">GST {{ +(c.product?.gst_rate ?? 0) }}%</div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="lead">
                    <th mat-header-cell *matHeaderCellDef class="num">Lead Time</th>
                    <td mat-cell *matCellDef="let c" class="num">{{ c.lead_time_days != null ? c.lead_time_days + ' day' + (c.lead_time_days === 1 ? '' : 's') : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let c" class="actions-cell">
                      <button mat-icon-button matTooltip="Change history" aria-label="Change history"
                              (click)="showLog({ vendor_id: c.vendor_id, product_id: c.product_id, vendor: c.vendor?.name, product: c.product?.name })">
                        <mat-icon>history</mat-icon>
                      </button>
                      @if (auth.canDo('rate_cards','edit')) {
                        <button mat-icon-button matTooltip="Edit" aria-label="Edit" (click)="openForm(c)"><mat-icon>edit</mat-icon></button>
                      }
                      @if (auth.canDo('rate_cards','delete')) {
                        <button mat-icon-button matTooltip="Delete" aria-label="Delete" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="cardColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: cardColumns;"></tr>
                </table>
              </div>
            }
          } @else {
            @if (log().length === 0 && logLoading()) {
              <div class="loading-state"><mat-spinner diameter="36" /></div>
            } @else if (log().length === 0) {
              <div class="empty-state">
                <mat-icon>history</mat-icon>
                <h3>No changes yet</h3>
                <p>Every new rate card, change and deletion is listed here.</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table mat-table [dataSource]="log()">
                  <ng-container matColumnDef="when">
                    <th mat-header-cell *matHeaderCellDef>When</th>
                    <td mat-cell *matCellDef="let e">{{ e.created_at | date:'dd MMM yyyy, h:mm a' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="who">
                    <th mat-header-cell *matHeaderCellDef>Changed by</th>
                    <td mat-cell *matCellDef="let e">{{ e.user?.name ?? '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="item">
                    <th mat-header-cell *matHeaderCellDef>Vendor · Product</th>
                    <td mat-cell *matCellDef="let e">
                      <div class="name-primary">{{ e.meta.vendor }}</div>
                      <div class="name-sub">{{ e.meta.product_code ? e.meta.product_code + ' · ' : '' }}{{ e.meta.product }}</div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="change">
                    <th mat-header-cell *matHeaderCellDef>Change</th>
                    <td mat-cell *matCellDef="let e">
                      <span [class]="'status-pill action-' + e.action">{{ actionLabel[e.action] }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="details">
                    <th mat-header-cell *matHeaderCellDef>Old → New</th>
                    <td mat-cell *matCellDef="let e">
                      @for (f of changedFields(e); track f.label) {
                        <div class="change-line">
                          <span class="change-label">{{ f.label }}</span>
                          <span class="muted">{{ f.old }}</span> → <span class="amount">{{ f.new }}</span>
                        </div>
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="logColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: logColumns;"></tr>
                </table>
              </div>
              @if (logPage() < logLastPage()) {
                <div class="load-more">
                  <button mat-stroked-button [disabled]="logLoading()" (click)="loadLog(logPage() + 1)">
                    @if (logLoading()) { <mat-spinner diameter="18" /> } @else { Load older changes }
                  </button>
                </div>
              }
            }
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .search-field { width:240px; }
    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper { display:none; }
    .filter-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
    .chip-x { font-size:14px; width:14px; height:14px; vertical-align:middle; margin-left:4px; }
    .name-primary { font-size:13px; font-weight:600; color:var(--text-1); }
    .name-sub { font-size:11px; color:var(--text-3); margin-top:1px; }
    .amount { font-size:13px; font-weight:600; color:var(--text-1); }
    .muted { color:var(--text-3); }
    .num { text-align:right; }
    td.num { white-space:nowrap; }
    .mono, th.mat-column-code { font-family:monospace; font-size:12px; white-space:nowrap; }
    .change-line { font-size:12.5px; line-height:1.6; white-space:nowrap; }
    .change-label { display:inline-block; min-width:72px; color:var(--text-2); font-weight:500; }
    .actions-cell { text-align:right; white-space:nowrap; }
    .load-more { display:flex; justify-content:center; padding:16px; }
    .action-created { background:#dcfce7; color:#166534; }
    .action-updated { background:#f3f2ed; color:var(--text-1); }
    .action-deleted { background:#fee2e2; color:#991b1b; }
    @media (max-width: 600px) {
      .mat-column-code, .mat-column-moq, .mat-column-mrp, .mat-column-lead, .mat-column-who { display:none; }
      .search-field { width:100%; }
    }
  `],
})
export class RateCardListComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  readonly auth = inject(AuthService);

  readonly cardColumns = ['code', 'product', 'vendor', 'uom', 'moq', 'mrp', 'net', 'gross', 'lead', 'actions'];
  readonly logColumns = ['when', 'who', 'item', 'change', 'details'];
  readonly actionLabel: Record<string, string> = { created: 'Added', updated: 'Changed', deleted: 'Deleted' };

  view = signal<'rates' | 'log'>('rates');
  cards = signal<RateCard[]>([]);
  loading = signal(true);
  search = signal('');

  log = signal<LogEntry[]>([]);
  logLoading = signal(false);
  logPage = signal(0);
  logLastPage = signal(0);
  logFilter = signal<{ vendor_id: number; product_id: number; vendor?: string; product?: string } | null>(null);

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return this.cards();
    return this.cards().filter(c =>
      [c.vendor?.name, c.vendor?.global_vendor_code, c.product?.name, c.product?.code]
        .some(s => (s ?? '').toLowerCase().includes(q)));
  });

  ngOnInit() { this.load(); }

  gross(c: RateCard) { return grossPrice(c.net_rate, c.product?.gst_rate ?? 0); }

  /** Each logged field as label, old and new text, in the order of the rate card form. */
  changedFields(e: LogEntry) {
    const fmt = (field: string, v: string | number | null) => {
      if (v == null) return '—';
      if (field === 'net_rate' || field === 'mrp') return '₹' + (+v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (field === 'lead_time_days') return `${v} day${+v === 1 ? '' : 's'}`;
      return String(v);
    };
    return Object.keys(TERM_LABELS)
      .filter(f => e.meta.changes?.[f])
      .map(f => ({ label: TERM_LABELS[f], old: fmt(f, e.meta.changes[f].old), new: fmt(f, e.meta.changes[f].new) }));
  }

  load() {
    this.loading.set(true);
    this.http.get<RateCard[]>(`${environment.apiUrl}/rate-cards`).subscribe({
      next: res => { this.cards.set(res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  showLog(filter: { vendor_id: number; product_id: number; vendor?: string; product?: string } | null) {
    this.logFilter.set(filter);
    this.view.set('log');
    this.log.set([]);
    this.loadLog(1);
  }

  loadLog(page: number) {
    const f = this.logFilter();
    const params: Record<string, string | number> = { page, per_page: 50 };
    if (f) { params['vendor_id'] = f.vendor_id; params['product_id'] = f.product_id; }
    this.logLoading.set(true);
    this.http.get<{ data: LogEntry[]; current_page: number; last_page: number }>(
      `${environment.apiUrl}/rate-cards/log`, { params },
    ).subscribe({
      next: res => {
        this.log.set(page === 1 ? res.data : [...this.log(), ...res.data]);
        this.logPage.set(res.current_page);
        this.logLastPage.set(res.last_page);
        this.logLoading.set(false);
      },
      error: () => { this.logLoading.set(false); this.notify.error('Could not load the change log.'); },
    });
  }

  openForm(card?: RateCard) {
    this.dialog.open(RateCardFormDialogComponent, { width: '600px', maxWidth: '94vw', data: { card: card ?? null } })
      .afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  remove(card: RateCard) {
    if (!confirm(`Delete the rate card for ${card.product?.name} from ${card.vendor?.name}? New POs will use the product master rate. The change log keeps this rate.`)) return;
    this.http.delete(`${environment.apiUrl}/rate-cards/${card.id}`).subscribe({
      next: () => { this.notify.success('Rate card deleted.'); this.load(); },
      error: (err: any) => this.notify.error(err.error?.message || 'Delete failed.'),
    });
  }
}
