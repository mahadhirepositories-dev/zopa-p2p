import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
    DatePipe, DecimalPipe, TitleCasePipe, FormsModule, RouterLink,
    MatTableModule, MatButtonModule, MatChipsModule, MatIconModule,
    MatProgressSpinnerModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatPaginatorModule, MatTooltipModule, MatDialogModule,
    SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">
      
      <!-- Page Header matching PO / PR list -->
      <div class="page-header">
        <div>
          <h2>Sourcing &amp; Price Discovery</h2>
          <p>{{ currentTabCount() }} item{{ currentTabCount() !== 1 ? 's' : '' }} found · ZOPA Internal Workbench</p>
        </div>

        <div style="display: flex; gap: 12px; align-items: center;">
          <button mat-stroked-button (click)="exportExcel()" [disabled]="exporting()">
            @if (exporting()) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px;" /> }
            @else { <mat-icon>download</mat-icon> }
            Export
          </button>

          <button mat-raised-button color="primary" class="cta-btn" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> New Sourcing Request
          </button>
        </div>
      </div>

      <!-- Toolbar Bar matching PO / PR list -->
      <div class="toolbar-bar">
        <app-search-field class="search-field" [value]="search()" (valueChange)="setSearch($event)"
                          placeholder="Search items, specifications, PR ref, vendors…" />

        <div class="filter-chips">
          <button class="filter-chip" [class.active]="activeTab() === 'all'" (click)="setTab('all')">
            All ({{ stats().total }})
          </button>
          <button class="filter-chip open" [class.active]="activeTab() === 'open'" (click)="setTab('open')">
            Open ({{ stats().open }})
          </button>
          <button class="filter-chip pr-stream" [class.active]="activeTab() === 'pr_queue'" (click)="setTab('pr_queue')">
            <mat-icon style="font-size:14px;width:14px;height:14px;vertical-align:middle;margin-right:2px;">auto_awesome</mat-icon>
            Uncatalogued PR Items ({{ prQueueItems().length }})
          </button>
          <button class="filter-chip closed" [class.active]="activeTab() === 'closed'" (click)="setTab('closed')">
            Closed ({{ stats().closed }})
          </button>
        </div>

        <!-- Organization / Client Selector -->
        <mat-form-field appearance="outline" style="width: 220px; margin-left: auto;">
          <mat-label>All Organizations</mat-label>
          <mat-select [(ngModel)]="selectedTenant" (selectionChange)="onTenantChange()">
            <mat-option value="all">All Organizations</mat-option>
            @for (c of auth.clients(); track c.tenant_id) {
              <mat-option [value]="c.tenant_id">{{ c.tenant_name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Main Content Card -->
      <mat-card class="table-card" style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">

          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (activeTab() === 'pr_queue') {
            
            <!-- ── UNCATALOGUED PR STREAM (Auto-Detected from Client PRs) ── -->
            @if (filteredPrQueue().length === 0) {
              <div class="empty-state">
                <mat-icon>auto_awesome</mat-icon>
                <h3>No uncatalogued PR items pending</h3>
                <p>All items in active PRs are linked to the master catalog or already in sourcing.</p>
              </div>
            } @else {
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>PR &amp; Client</th>
                      <th>Custom Item Name in PR</th>
                      <th>Smart Master Match / Typo Check</th>
                      <th>Qty &amp; UOM</th>
                      <th>Target Price</th>
                      <th style="text-align:right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of paginatedPrQueue(); track item.id) {
                      <tr class="table-row">
                        <td>
                          <div style="font-weight:700;font-size:13px;color:var(--text-1);">{{ item.client_name }}</div>
                          <a [routerLink]="['/purchase-requisitions', item.pr_id]" target="_blank" class="link-sub" (click)="$event.stopPropagation()">
                            {{ item.pr_number }}
                          </a>
                        </td>

                        <td>
                          <div style="font-weight:600;font-size:13.5px;color:var(--text-1);">{{ item.description }}</div>
                          @if (item.category_name) {
                            <div style="font-size:11px;color:var(--text-3);">Cat: {{ item.category_name }}</div>
                          }
                          @if (item.remarks) {
                            <div style="font-size:11px;color:var(--text-2);font-style:italic;">"{{ item.remarks }}"</div>
                          }
                        </td>

                        <td>
                          @if (item.best_match) {
                            <div class="match-card" [class.high-match]="item.best_match.score >= 70">
                              <div class="match-header">
                                <span class="match-score-badge">{{ item.best_match.score }}% Match</span>
                                <span class="match-code">{{ item.best_match.code || 'Master Item' }}</span>
                              </div>
                              <div class="match-title">{{ item.best_match.name }}</div>
                              <div class="match-details">
                                Standard Rate: <strong>₹{{ item.best_match.net_rate | number:'1.2-2' }}</strong> / {{ item.best_match.unit }}
                              </div>
                              <button mat-flat-button color="accent" class="btn-xs-map" (click)="mapPrItemToMaster(item, item.best_match)" [disabled]="mapping()">
                                <mat-icon style="font-size:12px;width:12px;height:12px;margin-right:2px;">link</mat-icon> Map &amp; Resolve Typo
                              </button>
                            </div>
                          } @else {
                            <span class="no-match-badge">New / Uncatalogued Item</span>
                          }
                        </td>

                        <td>
                          <strong>{{ item.qty }}</strong> <span style="font-size:12px;color:var(--text-3);">{{ item.unit }}</span>
                        </td>

                        <td>
                          @if (item.estimated_price > 0) {
                            <span class="price-val">₹{{ item.estimated_price | number:'1.2-2' }}</span>
                          } @else {
                            <span style="color:#94a3b8;font-size:12px;">Unpriced</span>
                          }
                        </td>

                        <td style="text-align:right;">
                          <div style="display:inline-flex;gap:6px;">
                            @if (item.has_sourcing) {
                              <a mat-stroked-button color="primary" class="btn-xs" [routerLink]="['/sourcing', item.active_sourcing?.id || '']">
                                <mat-icon style="font-size:13px;width:13px;height:13px;margin-right:2px;">visibility</mat-icon> In Sourcing
                              </a>
                            } @else {
                              <button mat-raised-button color="primary" class="btn-xs" (click)="sourcePrItem(item)">
                                <mat-icon style="font-size:13px;width:13px;height:13px;margin-right:2px;">travel_explore</mat-icon> Source Item
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Paginator for PR Queue -->
              <mat-paginator [length]="filteredPrQueue().length"
                             [pageSize]="pageSize()"
                             [pageIndex]="pageIndex()"
                             [pageSizeOptions]="[10, 25, 50]"
                             (page)="onPageChange($event)">
              </mat-paginator>
            }

          } @else {

            <!-- ── SOURCING REQUESTS LIST (All / Open / Closed) ── -->
            @if (filteredRequests().length === 0) {
              <div class="empty-state">
                <mat-icon>travel_explore</mat-icon>
                <h3>No sourcing requests found</h3>
                <p>{{ search() ? 'Try adjusting your search filters.' : 'Create a sourcing request or review the Uncatalogued PR Items stream.' }}</p>
                @if (!search()) {
                  <button mat-raised-button color="primary" (click)="openCreateDialog()">
                    <mat-icon>add</mat-icon> Create Sourcing Request
                  </button>
                }
              </div>
            } @else {
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Sourcing #</th>
                      <th>Organization &amp; Source</th>
                      <th>Item Description &amp; Specification</th>
                      <th>Category</th>
                      <th>Qty &amp; UOM</th>
                      <th>Target Price</th>
                      <th>Vendors &amp; Quotes</th>
                      <th>Status</th>
                      <th style="text-align:right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (req of paginatedRequests(); track req.id) {
                      <tr class="table-row clickable-row" (click)="view(req.id)">
                        
                        <!-- Sourcing Number & Date -->
                        <td>
                          <div class="po-number-cell">
                            <div class="sourcing-icon">
                              <mat-icon>travel_explore</mat-icon>
                            </div>
                            <div>
                              <div class="sourcing-num">{{ req.sourcing_number }}</div>
                              <div class="sourcing-date">{{ req.created_at | date:'dd MMM yyyy' }}</div>
                            </div>
                          </div>
                        </td>

                        <!-- Organization & Source -->
                        <td>
                          <div class="client-title">
                            {{ req.client_name || req.tenant?.name || 'All Organizations' }}
                          </div>
                          @if (req.source_type === 'pr') {
                            <span class="source-pill pr" (click)="$event.stopPropagation()">
                              PR: {{ req.pr_ref || ('#' + req.pr_id) }}
                            </span>
                          } @else {
                            <span class="source-pill direct">Direct</span>
                          }
                        </td>

                        <!-- Item Description & Specification -->
                        <td>
                          <div class="item-title">{{ req.item_name }}</div>
                          @if (req.specification) {
                            <div class="spec-preview">{{ req.specification }}</div>
                          }
                          @if (req.delivery_location) {
                            <div class="loc-preview">
                              <mat-icon>location_on</mat-icon> {{ req.delivery_location }}
                            </div>
                          }
                        </td>

                        <!-- Category -->
                        <td>
                          <span class="category-tag">{{ req.category?.name || req.category_name || '—' }}</span>
                        </td>

                        <!-- Qty -->
                        <td>
                          <strong>{{ req.qty }}</strong> <span style="font-size:12px;color:var(--text-3);">{{ req.unit }}</span>
                        </td>

                        <!-- Target Price -->
                        <td>
                          @if (req.target_price && req.target_price > 0) {
                            <span class="price-val">₹{{ req.target_price | number:'1.2-2' }}</span>
                          } @else {
                            <span style="color:#94a3b8;font-size:12px;">—</span>
                          }
                        </td>

                        <!-- Vendor Quotes -->
                        <td>
                          @if (req.vendor_contacts?.length) {
                            <div class="vendor-summary">
                              <span class="vendor-count">
                                <mat-icon>store</mat-icon> {{ req.vendor_contacts!.length }} Quote{{ req.vendor_contacts!.length > 1 ? 's' : '' }}
                              </span>
                              @if (bestQuote(req)) {
                                <div class="best-price">Best: ₹{{ bestQuote(req) | number:'1.2-2' }}</div>
                              }
                            </div>
                          } @else {
                            <span class="add-quote-link" (click)="$event.stopPropagation(); openContactDialog(req)">+ Add Quote</span>
                          }
                        </td>

                        <!-- Status Badge -->
                        <td>
                          <span class="status-badge" [class.status-approved]="req.status === 'closed'" [class.status-submitted]="req.status === 'open'">
                            {{ req.status === 'open' ? 'Open' : 'Closed' }}
                          </span>
                        </td>

                        <!-- Actions -->
                        <td style="text-align:right;" (click)="$event.stopPropagation()">
                          <div style="display:inline-flex;gap:4px;">
                            <button mat-icon-button color="primary" [routerLink]="['/sourcing', req.id]" matTooltip="View Workspace">
                              <mat-icon>visibility</mat-icon>
                            </button>
                            <button mat-icon-button (click)="openContactDialog(req)" matTooltip="Add Vendor Quote">
                              <mat-icon style="color:#10b981;">person_add</mat-icon>
                            </button>
                          </div>
                        </td>

                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Paginator for Sourcing Requests -->
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
      display: inline-flex;
      align-items: center;
    }
    .filter-chip:hover { border-color: var(--text-3); color: var(--text-1); }
    .filter-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }
    .filter-chip.open.active { background: #2563eb; border-color: #2563eb; }
    .filter-chip.pr-stream.active { background: #7c3aed; border-color: #7c3aed; }
    .filter-chip.closed.active { background: #16a34a; border-color: #16a34a; }

    .table-card { border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { background: #f8fafc; color: var(--text-3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding: 10px 16px; border-bottom: 1px solid var(--border); text-align: left; }
    .data-table td { padding: 12px 16px; font-size: 13px; color: var(--text-1); border-bottom: 1px solid var(--border); vertical-align: middle; }
    .table-row:hover { background: var(--surface-hover); }
    .clickable-row { cursor: pointer; }

    .po-number-cell { display: flex; align-items: center; gap: 12px; }
    .sourcing-icon {
      width: 36px; height: 36px;
      background: #eff6ff;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #2563eb;
    }
    .sourcing-num { font-size: 14px; font-weight: 600; color: var(--text-1); }
    .sourcing-date { font-size: 12px; color: var(--text-3); }

    .client-title { font-weight: 600; color: var(--text-1); }
    .source-pill { display: inline-block; font-size: 10.5px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-top: 2px; }
    .source-pill.pr { background: #eff6ff; color: #2563eb; }
    .source-pill.direct { background: #fdf4ff; color: #a855f7; }

    .item-title { font-weight: 600; color: var(--text-1); }
    .spec-preview { font-size: 11.5px; color: var(--text-2); max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .loc-preview { font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 2px; margin-top: 2px; }
    .loc-preview mat-icon { font-size: 12px; width: 12px; height: 12px; }

    .category-tag { background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
    .price-val { font-weight: 600; color: var(--text-1); }

    .vendor-summary { display: flex; flex-direction: column; gap: 1px; }
    .vendor-count { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; font-weight: 600; color: #059669; }
    .vendor-count mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .best-price { font-size: 11px; font-weight: 700; color: #15803d; }
    .add-quote-link { font-size: 11.5px; color: var(--primary); font-weight: 600; cursor: pointer; }
    .add-quote-link:hover { text-decoration: underline; }

    /* Match Suggestion Card */
    .match-card { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px 10px; max-width: 280px; }
    .match-card.high-match { background: #eff6ff; border-color: #93c5fd; }
    .match-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
    .match-score-badge { font-size: 10px; font-weight: 700; background: #2563eb; color: #fff; padding: 1px 5px; border-radius: 4px; }
    .match-code { font-size: 10.5px; color: var(--text-3); font-weight: 600; }
    .match-title { font-size: 12px; font-weight: 700; color: var(--text-1); margin: 2px 0; }
    .match-details { font-size: 11px; color: var(--text-2); margin-bottom: 6px; }
    .btn-xs-map { height: 24px!important; font-size: 10.5px!important; padding: 0 8px!important; line-height: 24px!important; }
    .no-match-badge { font-size: 11px; color: #94a3b8; font-style: italic; }

    .link-sub { font-size: 11.5px; color: #2563eb; text-decoration: none; font-weight: 600; }
    .link-sub:hover { text-decoration: underline; }
    .btn-xs { height: 28px!important; font-size: 11px!important; padding: 0 10px!important; line-height: 28px!important; }

    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .status-submitted { background: #eff6ff; color: #2563eb; }
    .status-approved  { background: #f0fdf4; color: #16a34a; }

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
  exporting = signal(false);
  mapping = signal(false);

  requests = signal<SourcingRequest[]>([]);
  prQueueItems = signal<any[]>([]);
  stats = signal({ total: 0, open: 0, closed: 0, from_pr: 0, direct: 0, pr_queue_count: 0 });

  search = signal('');
  activeTab = signal<'all' | 'open' | 'pr_queue' | 'closed'>('all');
  selectedTenant: any = 'all';

  pageIndex = signal(0);
  pageSize = signal(25);

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
      return this.filteredPrQueue().length;
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

  onTenantChange() {
    this.pageIndex.set(0);
    this.loadData();
    this.loadPrQueue();
  }

  onPageChange(event: any) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  loadData() {
    this.loading.set(true);
    let params: any = {};
    if (this.selectedTenant !== 'all') params.tenant_id = this.selectedTenant;

    this.http.get<{ data: SourcingRequest[]; stats: any }>(
      `${environment.apiUrl}/sourcing`,
      { params }
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
    let params: any = {};
    if (this.selectedTenant !== 'all') params.tenant_id = this.selectedTenant;

    this.http.get<any[]>(`${environment.apiUrl}/sourcing/pr-queue`, { params }).subscribe({
      next: res => this.prQueueItems.set(res),
      error: () => {}
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
    if (this.selectedTenant !== 'all') params.tenant_id = this.selectedTenant;

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
