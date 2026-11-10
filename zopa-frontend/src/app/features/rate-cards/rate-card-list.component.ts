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
  net_rate: string | number;
  updated_at: string;
  vendor?: { id: number; name: string; global_vendor_code?: string };
  product?: { id: number; name: string; code?: string; unit?: string; net_rate?: string | number };
  updater?: { id: number; name: string } | null;
}

interface LogEntry {
  id: number;
  action: 'created' | 'updated' | 'deleted';
  created_at: string;
  user?: { name: string } | null;
  meta: {
    vendor_id: number; vendor?: string; product_id: number; product?: string; product_code?: string;
    changes: { net_rate: { old: number | null; new: number | null } };
  };
}

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
          <p>Each vendor's agreed rate per product. POs for that vendor use it, and it can't be changed on the PO.</p>
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
                <p>{{ search() ? 'Try a different search term.' : 'Add a vendor\\'s rate for a product. Until then, POs use the product master rate.' }}</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table mat-table [dataSource]="filtered()">
                  <ng-container matColumnDef="vendor">
                    <th mat-header-cell *matHeaderCellDef>Vendor</th>
                    <td mat-cell *matCellDef="let c">
                      <div class="name-primary">{{ c.vendor?.name }}</div>
                      @if (c.vendor?.global_vendor_code) { <div class="name-sub">{{ c.vendor.global_vendor_code }}</div> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="product">
                    <th mat-header-cell *matHeaderCellDef>Product</th>
                    <td mat-cell *matCellDef="let c">
                      <div class="name-primary">{{ c.product?.name }}</div>
                      @if (c.product?.code) { <div class="name-sub">{{ c.product.code }}</div> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="rate">
                    <th mat-header-cell *matHeaderCellDef>Rate</th>
                    <td mat-cell *matCellDef="let c">
                      <span class="amount">₹{{ +c.net_rate | number:'1.2-2' }}</span>
                      @if (c.product?.unit) { <span class="name-sub"> / {{ c.product.unit }}</span> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="master">
                    <th mat-header-cell *matHeaderCellDef>Product master</th>
                    <td mat-cell *matCellDef="let c" class="muted">₹{{ +(c.product?.net_rate ?? 0) | number:'1.2-2' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="updated">
                    <th mat-header-cell *matHeaderCellDef>Last changed</th>
                    <td mat-cell *matCellDef="let c">
                      <div>{{ c.updated_at | date:'dd MMM yyyy, h:mm a' }}</div>
                      @if (c.updater) { <div class="name-sub">{{ c.updater.name }}</div> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let c" class="actions-cell">
                      <button mat-icon-button matTooltip="Change history" aria-label="Change history"
                              (click)="showLog({ vendor_id: c.vendor_id, product_id: c.product_id, vendor: c.vendor?.name, product: c.product?.name })">
                        <mat-icon>history</mat-icon>
                      </button>
                      @if (auth.canDo('rate_cards','edit')) {
                        <button mat-icon-button matTooltip="Edit rate" aria-label="Edit rate" (click)="openForm(c)"><mat-icon>edit</mat-icon></button>
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
                <p>Every new rate, rate change and deletion is listed here.</p>
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
                  <ng-container matColumnDef="old">
                    <th mat-header-cell *matHeaderCellDef>Old rate</th>
                    <td mat-cell *matCellDef="let e" class="muted">{{ e.meta.changes.net_rate.old != null ? '₹' + (e.meta.changes.net_rate.old | number:'1.2-2') : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="new">
                    <th mat-header-cell *matHeaderCellDef>New rate</th>
                    <td mat-cell *matCellDef="let e" class="amount">{{ e.meta.changes.net_rate.new != null ? '₹' + (e.meta.changes.net_rate.new | number:'1.2-2') : '—' }}</td>
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
    .actions-cell { text-align:right; white-space:nowrap; }
    .load-more { display:flex; justify-content:center; padding:16px; }
    .action-created { background:#dcfce7; color:#166534; }
    .action-updated { background:#f3f2ed; color:var(--text-1); }
    .action-deleted { background:#fee2e2; color:#991b1b; }
    @media (max-width: 600px) {
      .mat-column-master, .mat-column-updated, .mat-column-who, .mat-column-old { display:none; }
      .search-field { width:100%; }
    }
  `],
})
export class RateCardListComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  readonly auth = inject(AuthService);

  readonly cardColumns = ['vendor', 'product', 'rate', 'master', 'updated', 'actions'];
  readonly logColumns = ['when', 'who', 'item', 'change', 'old', 'new'];
  readonly actionLabel: Record<string, string> = { created: 'Added', updated: 'Rate changed', deleted: 'Deleted' };

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
    this.dialog.open(RateCardFormDialogComponent, { width: '460px', maxWidth: '94vw', data: { card: card ?? null } })
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
