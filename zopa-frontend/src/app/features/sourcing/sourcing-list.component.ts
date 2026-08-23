import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SourcingRequest } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';
import { SourcingFormDialogComponent } from './sourcing-form-dialog.component';
import { SourcingContactDialogComponent } from './sourcing-contact-dialog.component';

@Component({
  selector: 'app-sourcing-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatChipsModule, MatIconModule,
    MatProgressSpinnerModule, MatCardModule, MatPaginatorModule, MatTooltipModule,
    MatDialogModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">
      
      <!-- ── Standard Page Header ──────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h2>Sourcing &amp; Price Discovery</h2>
          <p>{{ currentTabCount() }} item{{ currentTabCount() !== 1 ? 's' : '' }} found</p>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button mat-stroked-button (click)="exportExcel()" [disabled]="exporting()">
            @if (exporting()) { <mat-spinner diameter="18" /> }
            @else { <mat-icon>download</mat-icon> }
            Export
          </button>

          <button mat-raised-button color="primary" class="cta-btn" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> New Sourcing Request
          </button>
        </div>
      </div>

      <!-- ── Search & Filter Toolbar ────────────────────────────────────── -->
      <div class="toolbar-bar">
        <app-search-field class="search-field" [value]="search()" (valueChange)="setSearch($event)"
                          placeholder="Search by item name, specification, PR ref, vendor…" />

        <div class="filter-chips">
          <button class="filter-chip" [class.active]="activeTab() === 'all'" (click)="setTab('all')">
            All ({{ stats().total }})
          </button>
          <button class="filter-chip" [class.active]="activeTab() === 'open'" (click)="setTab('open')">
            Open ({{ stats().open }})
          </button>
          <button class="filter-chip uncatalogued" [class.active]="activeTab() === 'pr_queue'" (click)="setTab('pr_queue')">
            Uncatalogued PR Items ({{ stats().pr_queue_count || prQueueItems().length }})
          </button>
          <button class="filter-chip" [class.active]="activeTab() === 'closed'" (click)="setTab('closed')">
            Closed ({{ stats().closed }})
          </button>
        </div>
      </div>

      <!-- ── Main Table Card ───────────────────────────────────────────── -->
      <mat-card class="table-card" style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">

          @if (loading() || (activeTab() === 'pr_queue' && loadingPrQueue())) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (activeTab() === 'pr_queue') {
            
            <!-- ── Uncatalogued PR Stream View ────────────────────────────── -->
            @if (filteredPrQueue().length === 0) {
              <div class="empty-state">
                <mat-icon>auto_awesome</mat-icon>
                <h3>No uncatalogued PR items found</h3>
                <p>{{ search() ? 'Try adjusting your search query.' : 'All items in active PRs are linked to the master catalog or already in sourcing.' }}</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table mat-table [dataSource]="paginatedPrQueue()" class="full-width">
                  
                  <!-- Organization & PR -->
                  <ng-container matColumnDef="pr_info">
                    <th mat-header-cell *matHeaderCellDef style="width: 220px;">Organization &amp; PR</th>
                    <td mat-cell *matCellDef="let item">
                      <div class="po-number-cell">
                        <div class="po-icon" style="background:#eff6ff;color:#2563eb;">
                          <mat-icon>description</mat-icon>
                        </div>
                        <div>
                          <strong class="po-num">{{ item.client_name }}</strong>
                          <div>
                            <a [routerLink]="['/purchase-requisitions', item.pr_id]" target="_blank" class="pr-link" (click)="$event.stopPropagation()">
                              {{ item.pr_number }}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Custom Item Description -->
                  <ng-container matColumnDef="description">
                    <th mat-header-cell *matHeaderCellDef>Item Description in PR</th>
                    <td mat-cell *matCellDef="let item">
                      <div class="cell-main">{{ item.description }}</div>
                      @if (item.category_name) {
                        <div class="cell-sub">Category: {{ item.category_name }}</div>
                      }
                      @if (item.remarks) {
                        <div class="cell-sub" style="font-style:italic;">"{{ item.remarks }}"</div>
                      }
                    </td>
                  </ng-container>

                  <!-- Smart Master Match / Typo Detection -->
                  <ng-container matColumnDef="smart_match">
                    <th mat-header-cell *matHeaderCellDef style="min-width: 260px;">Catalog Match / Typo Check</th>
                    <td mat-cell *matCellDef="let item">
                      @if (item.best_match && item.best_match.score >= 50) {
                        <div class="inline-match-box">
                          <div class="match-meta">
                            <span class="match-score">{{ item.best_match.score }}% Match</span>
                            <span class="match-title">{{ item.best_match.name }}</span>
                            <span class="match-rate">₹{{ item.best_match.net_rate | number:'1.0-0' }}</span>
                          </div>
                          <button mat-button class="btn-map-action" (click)="mapPrItemToMaster(item, item.best_match)" [disabled]="mapping()">
                            <mat-icon>link</mat-icon> Map Typo
                          </button>
                        </div>
                      } @else {
                        <span class="uncatalogued-badge">Uncatalogued</span>
                      }
                    </td>
                  </ng-container>

                  <!-- Quantity & Unit -->
                  <ng-container matColumnDef="qty">
                    <th mat-header-cell *matHeaderCellDef>Qty</th>
                    <td mat-cell *matCellDef="let item">
                      <strong>{{ item.qty | number:'1.0-2' }}</strong> <span style="font-size:12px;color:var(--text-3);">{{ item.unit }}</span>
                    </td>
                  </ng-container>

                  <!-- Target Price -->
                  <ng-container matColumnDef="target_price">
                    <th mat-header-cell *matHeaderCellDef>Est. Price</th>
                    <td mat-cell *matCellDef="let item">
                      @if (item.estimated_price > 0) {
                        <strong class="amount">₹{{ item.estimated_price | number:'1.0-0' }}</strong>
                      } @else {
                        <span style="color:var(--text-3);">—</span>
                      }
                    </td>
                  </ng-container>

                  <!-- Actions -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef style="text-align:right;">Action</th>
                    <td mat-cell *matCellDef="let item" style="text-align:right;">
                      @if (item.has_sourcing) {
                        <button mat-stroked-button class="btn-table-action" [routerLink]="['/sourcing', item.active_sourcing?.id || '']">
                          <mat-icon>visibility</mat-icon> In Sourcing
                        </button>
                      } @else {
                        <button mat-raised-button color="primary" class="btn-table-action" (click)="sourcePrItem(item)">
                          <mat-icon>travel_explore</mat-icon> Source Item
                        </button>
                      }
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="prQueueColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: prQueueColumns;" class="table-row"></tr>
                </table>
              </div>

              <mat-paginator [length]="filteredPrQueue().length"
                             [pageSize]="pageSize()"
                             [pageIndex]="pageIndex()"
                             [pageSizeOptions]="[10, 25, 50]"
                             (page)="onPageChange($event)">
              </mat-paginator>
            }

          } @else {

            <!-- ── Standard Sourcing Requests List View ─────────────────────── -->
            @if (filteredRequests().length === 0) {
              <div class="empty-state">
                <mat-icon>travel_explore</mat-icon>
                <h3>No sourcing requests found</h3>
                <p>{{ search() ? 'Try adjusting your search filters.' : 'Create your first sourcing request or review the Uncatalogued PR Items tab.' }}</p>
                @if (!search()) {
                  <button mat-raised-button color="primary" (click)="openCreateDialog()">
                    <mat-icon>add</mat-icon> New Sourcing Request
                  </button>
                }
              </div>
            } @else {
              <div class="table-responsive">
                <table mat-table [dataSource]="paginatedRequests()" class="full-width">

                  <!-- Sourcing Number -->
                  <ng-container matColumnDef="sourcing_number">
                    <th mat-header-cell *matHeaderCellDef style="width: 200px;">Sourcing #</th>
                    <td mat-cell *matCellDef="let req">
                      <div class="po-number-cell">
                        <div class="po-icon">
                          <mat-icon>travel_explore</mat-icon>
                        </div>
                        <div>
                          <strong class="po-num">{{ req.sourcing_number }}</strong>
                          <div class="po-date">{{ req.created_at | date:'dd MMM yyyy' }}</div>
                        </div>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Organization & Source -->
                  <ng-container matColumnDef="client">
                    <th mat-header-cell *matHeaderCellDef>Organization &amp; Source</th>
                    <td mat-cell *matCellDef="let req">
                      <div class="cell-main">{{ req.client_name || req.tenant?.name || '—' }}</div>
                      @if (req.source_type === 'pr') {
                        <div class="cell-sub pr-link">PR: {{ req.pr_ref || ('#' + req.pr_id) }}</div>
                      } @else {
                        <div class="cell-sub">Direct Entry</div>
                      }
                    </td>
                  </ng-container>

                  <!-- Item Description & Specification -->
                  <ng-container matColumnDef="item_name">
                    <th mat-header-cell *matHeaderCellDef>Item Description</th>
                    <td mat-cell *matCellDef="let req">
                      <div class="cell-main">{{ req.item_name }}</div>
                      @if (req.specification) {
                        <div class="cell-sub text-truncate">{{ req.specification }}</div>
                      }
                      @if (req.delivery_location) {
                        <div class="cell-sub" style="display:flex;align-items:center;gap:2px;">
                          <mat-icon style="font-size:12px;width:12px;height:12px;">location_on</mat-icon>
                          {{ req.delivery_location }}
                        </div>
                      }
                    </td>
                  </ng-container>

                  <!-- Category -->
                  <ng-container matColumnDef="category">
                    <th mat-header-cell *matHeaderCellDef>Category</th>
                    <td mat-cell *matCellDef="let req" style="color:var(--text-2);">
                      {{ req.category?.name || req.category_name || '—' }}
                    </td>
                  </ng-container>

                  <!-- Quantity -->
                  <ng-container matColumnDef="qty">
                    <th mat-header-cell *matHeaderCellDef>Qty</th>
                    <td mat-cell *matCellDef="let req">
                      <strong>{{ req.qty | number:'1.0-2' }}</strong> <span style="font-size:12px;color:var(--text-3);">{{ req.unit }}</span>
                    </td>
                  </ng-container>

                  <!-- Target Price -->
                  <ng-container matColumnDef="target_price">
                    <th mat-header-cell *matHeaderCellDef>Target Price</th>
                    <td mat-cell *matCellDef="let req">
                      @if (req.target_price && req.target_price > 0) {
                        <strong class="amount">₹{{ req.target_price | number:'1.0-0' }}</strong>
                      } @else {
                        <span style="color:var(--text-3);">—</span>
                      }
                    </td>
                  </ng-container>

                  <!-- Quotes -->
                  <ng-container matColumnDef="quotes">
                    <th mat-header-cell *matHeaderCellDef>Quotes</th>
                    <td mat-cell *matCellDef="let req">
                      @if (req.vendor_contacts?.length) {
                        <div class="cell-main" style="color:#16a34a;font-weight:600;">
                          {{ req.vendor_contacts!.length }} Quote{{ req.vendor_contacts!.length > 1 ? 's' : '' }}
                        </div>
                        @if (bestQuote(req)) {
                          <div class="cell-sub" style="color:#15803d;font-weight:600;">Best: ₹{{ bestQuote(req) | number:'1.0-0' }}</div>
                        }
                      } @else {
                        <span style="color:var(--text-3);">—</span>
                      }
                    </td>
                  </ng-container>

                  <!-- Status -->
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let req">
                      <mat-chip [class]="'status-' + (req.status === 'closed' ? 'approved' : 'submitted')" [highlighted]="true">
                        {{ req.status === 'open' ? 'Open' : 'Closed' }}
                      </mat-chip>
                    </td>
                  </ng-container>

                  <!-- Arrow Column -->
                  <ng-container matColumnDef="arrow">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let req">
                      <mat-icon class="row-arrow">chevron_right</mat-icon>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="sourcingColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: sourcingColumns;"
                      class="clickable-row" (click)="view(row.id)"></tr>
                </table>
              </div>

              <mat-paginator [length]="filteredRequests().length"
                             [pageSize]="pageSize()"
                             [pageIndex]="pageIndex()"
                             [pageSizeOptions]="[10, 25, 50]"
                             (page)="onPageChange($event)">
              </mat-paginator>
            }

          }

        </mat-card-content>
      </mat-card>

    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .page-header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .page-header p  { margin: 3px 0 0; font-size: 13px; color: var(--text-3); }
    .cta-btn { height: 40px !important; }

    .toolbar-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-field { flex: 1; min-width: 260px; }
    .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-chip {
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-2);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-chip:hover { border-color: var(--text-3); color: var(--text-1); }
    .filter-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }
    .filter-chip.uncatalogued.active { background: #7c3aed; border-color: #7c3aed; }

    .table-card { border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .table-responsive {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-bottom: 8px;
    }
    .full-width { width: 100%; }

    .po-number-cell { display: flex; align-items: center; gap: 12px; }
    .po-icon {
      width: 36px; height: 36px;
      background: #eff6ff;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #2563eb;
    }
    .po-num { font-size: 14px; font-weight: 600; color: var(--text-1); }
    .po-date { font-size: 12px; color: var(--text-3); }

    .cell-main { font-size: 13.5px; font-weight: 600; color: var(--text-1); }
    .cell-sub  { font-size: 12px; color: var(--text-3); margin-top: 1px; }
    .pr-link   { color: #2563eb; font-weight: 600; text-decoration: none; }
    .pr-link:hover { text-decoration: underline; }
    .text-truncate { max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .amount { font-size: 14px; color: var(--text-1); }
    .clickable-row { cursor: pointer; transition: background 0.15s ease; }
    .clickable-row:hover { background: var(--surface-hover); }
    .row-arrow { color: var(--text-3); font-size: 20px; }

    /* Compact Inline Typo Matcher */
    .inline-match-box {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 4px 8px;
    }
    .match-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .match-score { font-size: 10.5px; font-weight: 700; background: #2563eb; color: #fff; padding: 1px 5px; border-radius: 4px; }
    .match-title { font-weight: 600; color: var(--text-1); }
    .match-rate { font-size: 11.5px; color: #16a34a; font-weight: 600; }
    .btn-map-action {
      height: 24px!important;
      font-size: 11px!important;
      padding: 0 8px!important;
      line-height: 24px!important;
      color: #7c3aed!important;
      font-weight: 700!important;
    }
    .btn-map-action mat-icon { font-size: 13px; width: 13px; height: 13px; margin-right: 2px; }
    .uncatalogued-badge { font-size: 11.5px; color: var(--text-3); font-style: italic; }

    .btn-table-action { height: 32px!important; font-size: 11.5px!important; padding: 0 12px!important; line-height: 32px!important; }
    .btn-table-action mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 3px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px 20px;
      color: var(--text-3);
      gap: 8px;
      text-align: center;
    }
    .empty-state mat-icon { font-size: 44px; width: 44px; height: 44px; color: var(--text-3); }
    .empty-state h3 { margin: 0; font-size: 16px; color: var(--text-1); font-weight: 600; }
    .empty-state p { margin: 0 0 12px; font-size: 13px; }
  `]
})
export class SourcingListComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  auth = inject(AuthService);

  loading = signal(true);
  loadingPrQueue = signal(false);
  exporting = signal(false);
  mapping = signal(false);

  requests = signal<SourcingRequest[]>([]);
  prQueueItems = signal<any[]>([]);
  stats = signal({ total: 0, open: 0, closed: 0, from_pr: 0, direct: 0, pr_queue_count: 0 });

  search = signal('');
  activeTab = signal<'all' | 'open' | 'pr_queue' | 'closed'>('all');

  pageIndex = signal(0);
  pageSize = signal(25);

  sourcingColumns = ['sourcing_number', 'client', 'item_name', 'category', 'qty', 'target_price', 'quotes', 'status', 'arrow'];
  prQueueColumns = ['pr_info', 'description', 'smart_match', 'qty', 'target_price', 'actions'];

  filteredRequests = computed(() => {
    let list = this.requests();
    const tab = this.activeTab();
    if (tab === 'open') list = list.filter(r => r.status === 'open');
    if (tab === 'closed') list = list.filter(r => r.status === 'closed');

    const s = this.search().toLowerCase().trim();
    if (s) {
      list = list.filter(r =>
        r.sourcing_number.toLowerCase().includes(s) ||
        r.item_name.toLowerCase().includes(s) ||
        (r.specification && r.specification.toLowerCase().includes(s)) ||
        (r.pr_ref && r.pr_ref.toLowerCase().includes(s)) ||
        (r.client_name && r.client_name.toLowerCase().includes(s)) ||
        (r.delivery_location && r.delivery_location.toLowerCase().includes(s))
      );
    }
    return list;
  });

  paginatedRequests = computed(() => {
    const list = this.filteredRequests();
    const start = this.pageIndex() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  filteredPrQueue = computed(() => {
    let list = this.prQueueItems();
    const s = this.search().toLowerCase().trim();
    if (s) {
      list = list.filter(it =>
        it.description.toLowerCase().includes(s) ||
        (it.pr_number && it.pr_number.toLowerCase().includes(s)) ||
        (it.client_name && it.client_name.toLowerCase().includes(s)) ||
        (it.best_match && it.best_match.name.toLowerCase().includes(s))
      );
    }
    return list;
  });

  paginatedPrQueue = computed(() => {
    const list = this.filteredPrQueue();
    const start = this.pageIndex() * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  currentTabCount = computed(() => {
    if (this.activeTab() === 'pr_queue') {
      return this.prQueueItems().length > 0 ? this.filteredPrQueue().length : this.stats().pr_queue_count;
    }
    return this.filteredRequests().length;
  });

  ngOnInit() {
    this.loadData();
    this.loadPrQueue();
  }

  setSearch(val: string) {
    this.search.set(val);
    this.pageIndex.set(0);
  }

  setTab(tab: 'all' | 'open' | 'pr_queue' | 'closed') {
    this.activeTab.set(tab);
    this.pageIndex.set(0);
  }

  onPageChange(event: any) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  loadData() {
    this.loading.set(true);
    this.http.get<{ data: SourcingRequest[]; stats: any }>(
      `${environment.apiUrl}/sourcing`
    ).subscribe({
      next: res => {
        this.loading.set(false);
        this.requests.set(res.data);
        if (res.stats) this.stats.set(res.stats);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Could not load sourcing requests.');
      }
    });
  }

  loadPrQueue() {
    this.loadingPrQueue.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/sourcing/pr-queue`).subscribe({
      next: res => {
        this.loadingPrQueue.set(false);
        this.prQueueItems.set(res);
      },
      error: () => {
        this.loadingPrQueue.set(false);
      }
    });
  }

  view(id: number) {
    this.router.navigate(['/sourcing', id]);
  }

  bestQuote(req: SourcingRequest): number | null {
    if (!req.vendor_contacts?.length) return null;
    const prices = req.vendor_contacts
      .map(c => c.quoted_price ? +c.quoted_price : null)
      .filter((p): p is number => p !== null && p > 0);
    if (!prices.length) return null;
    return Math.min(...prices);
  }

  mapPrItemToMaster(item: any, matchedProduct: any) {
    if (!confirm(`Map "${item.description}" to Master Product "${matchedProduct.name}" (Rate: ₹${matchedProduct.net_rate})? This resolves the typo and links it directly to the product catalog.`)) {
      return;
    }

    this.mapping.set(true);
    this.http.post<{ message: string }>(`${environment.apiUrl}/sourcing/map-pr-item`, {
      pr_item_id: item.id,
      product_id: matchedProduct.product_id,
    }).subscribe({
      next: res => {
        this.mapping.set(false);
        this.notify.success(res.message || 'Item successfully mapped to Master Product.');
        this.prQueueItems.update(curr => curr.filter(i => i.id !== item.id));
        this.loadData();
      },
      error: err => {
        this.mapping.set(false);
        this.notify.error(err.error?.message || 'Failed to map to master product.');
      }
    });
  }

  sourcePrItem(item: any) {
    const payload = {
      items: [{
        pr_id: item.pr_id,
        pr_item_id: item.id,
        description: item.description,
        qty: item.qty,
        unit: item.unit ?? 'Nos',
        category_id: item.category_id,
        remarks: item.remarks ?? '',
      }]
    };

    this.http.post<{ message: string; data: SourcingRequest[] }>(
      `${environment.apiUrl}/sourcing/from-pr`,
      payload
    ).subscribe({
      next: res => {
        this.notify.success(res.message || 'Item sent to Sourcing.');
        this.loadData();
        this.loadPrQueue();
        if (res.data?.[0]?.id) {
          this.view(res.data[0].id);
        }
      },
      error: err => this.notify.error(err.error?.message || 'Failed to send to Sourcing.')
    });
  }

  openCreateDialog() {
    const ref = this.dialog.open(SourcingFormDialogComponent, {
      width: '780px',
      maxHeight: '90vh',
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadData();
        this.loadPrQueue();
      }
    });
  }

  openContactDialog(req: SourcingRequest) {
    const ref = this.dialog.open(SourcingContactDialogComponent, {
      width: '600px',
      data: { sourcingRequestId: req.id, contact: null },
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadData();
      }
    });
  }

  exportExcel() {
    this.exporting.set(true);
    let params: any = {};
    if (this.search().trim()) params.search = this.search().trim();
    if (this.activeTab() === 'open') params.status = 'open';
    if (this.activeTab() === 'closed') params.status = 'closed';

    this.http.get(`${environment.apiUrl}/sourcing/export`, {
      params,
      responseType: 'blob'
    }).subscribe({
      next: blob => {
        this.exporting.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sourcing_items_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.notify.success('Export downloaded successfully.');
      },
      error: () => {
        this.exporting.set(false);
        this.notify.error('Could not export sourcing items.');
      }
    });
  }
}
