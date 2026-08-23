import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SourcingRequest } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { SourcingFormDialogComponent } from './sourcing-form-dialog.component';
import { SourcingContactDialogComponent } from './sourcing-contact-dialog.component';

@Component({
  selector: 'app-sourcing-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TitleCasePipe,
    MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTooltipModule, MatDialogModule, MatButtonToggleModule,
  ],
  template: `
    <div class="page-wrapper">
      
      <!-- Top Title & Action Bar -->
      <div class="page-header">
        <div>
          <div class="title-with-badge">
            <h2>Sourcing &amp; Price Discovery</h2>
            <span class="internal-tag">ZOPA Internal Workbench</span>
          </div>
          <p class="subtitle">
            Centralized price discovery, vendor negotiations, and supplier sourcing across all client organizations
          </p>
        </div>

        <div class="header-actions">
          <button mat-stroked-button (click)="exportExcel()" [disabled]="exporting()" class="action-btn">
            @if (exporting()) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px;" /> }
            @else { <mat-icon>download</mat-icon> }
            Export Excel
          </button>

          <button mat-raised-button color="primary" (click)="openCreateDialog()" class="action-btn-primary">
            <mat-icon>add</mat-icon> New Sourcing Request
          </button>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stats-grid">
        <div class="stat-card stat-total">
          <div class="stat-icon"><mat-icon>travel_explore</mat-icon></div>
          <div>
            <div class="stat-value">{{ stats().total }}</div>
            <div class="stat-label">Total Sourcing Items</div>
          </div>
        </div>

        <div class="stat-card stat-open">
          <div class="stat-icon"><mat-icon>pending_actions</mat-icon></div>
          <div>
            <div class="stat-value">{{ stats().open }}</div>
            <div class="stat-label">Active / Open Sourcing</div>
          </div>
        </div>

        <div class="stat-card stat-closed">
          <div class="stat-icon"><mat-icon>verified</mat-icon></div>
          <div>
            <div class="stat-value">{{ stats().closed }}</div>
            <div class="stat-label">Completed / Price Finalized</div>
          </div>
        </div>

        <div class="stat-card stat-sources">
          <div class="stat-icon"><mat-icon>hub</mat-icon></div>
          <div>
            <div class="stat-value">{{ stats().from_pr }} <span style="font-size:13px;font-weight:400;color:var(--text-3);">from PR</span> · {{ stats().direct }} <span style="font-size:13px;font-weight:400;color:var(--text-3);">Direct</span></div>
            <div class="stat-label">Source Breakdown</div>
          </div>
        </div>
      </div>

      <!-- Filter Controls -->
      <mat-card class="filter-card">
        <div class="filter-bar">
          
          <!-- Search Field -->
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search items, specifications, PR ref, RFQ ref, vendors, remarks...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="loadData()" />
            <mat-icon matPrefix>search</mat-icon>
            @if (searchTerm) {
              <button mat-icon-button matSuffix (click)="searchTerm = ''; loadData()"><mat-icon>close</mat-icon></button>
            }
          </mat-form-field>

          <!-- Organization / Client Filter -->
          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Organization / Client</mat-label>
            <mat-select [(ngModel)]="selectedTenant" (selectionChange)="loadData()">
              <mat-option value="all">All Organizations</mat-option>
              @for (c of auth.clients(); track c.tenant_id) {
                <mat-option [value]="c.tenant_id">{{ c.tenant_name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Status Toggle Filter -->
          <mat-button-toggle-group [(ngModel)]="selectedStatus" (change)="loadData()" class="toggle-group">
            <mat-button-toggle value="all">All</mat-button-toggle>
            <mat-button-toggle value="open">Open ({{ stats().open }})</mat-button-toggle>
            <mat-button-toggle value="closed">Closed ({{ stats().closed }})</mat-button-toggle>
          </mat-button-toggle-group>

          <!-- Source Toggle Filter -->
          <mat-button-toggle-group [(ngModel)]="selectedSource" (change)="loadData()" class="toggle-group">
            <mat-button-toggle value="all">All Sources</mat-button-toggle>
            <mat-button-toggle value="pr">From PR</mat-button-toggle>
            <mat-button-toggle value="direct">Direct</mat-button-toggle>
          </mat-button-toggle-group>

        </div>
      </mat-card>

      <!-- Main Sourcing Data Table -->
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:60px;">
          <mat-spinner diameter="40" />
        </div>
      } @else if (requests().length === 0) {
        <div class="empty-table-state">
          <mat-icon>travel_explore</mat-icon>
          <h3>No Sourcing Requests Found</h3>
          <p>Create a direct sourcing item or select line items from client PRs to begin sourcing.</p>
          <button mat-raised-button color="primary" (click)="openCreateDialog()">
            <mat-icon>add</mat-icon> Create First Sourcing Request
          </button>
        </div>
      } @else {
        <div class="table-card">
          <table class="sourcing-table">
            <thead>
              <tr>
                <th>Sourcing #</th>
                <th>Organization &amp; Source</th>
                <th>Item &amp; Specification</th>
                <th>Category</th>
                <th>Qty &amp; UOM</th>
                <th>Target Price</th>
                <th>Vendors &amp; Quotes</th>
                <th>Latest Remark / Call Log</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (req of requests(); track req.id) {
                <tr class="table-row">
                  
                  <!-- Sourcing Number -->
                  <td>
                    <a [routerLink]="['/sourcing', req.id]" class="sourcing-no-link">
                      {{ req.sourcing_number }}
                    </a>
                    <div style="font-size:11px;color:var(--text-3);margin-top:2px;">
                      {{ req.created_at | date:'dd MMM yyyy' }}
                    </div>
                  </td>

                  <!-- Organization & Source -->
                  <td>
                    <div class="client-title">
                      {{ req.client_name || req.tenant?.name || 'All Clients' }}
                    </div>
                    @if (req.source_type === 'pr') {
                      <span class="badge-source pr" [matTooltip]="'Linked to PR ' + (req.pr_ref || req.pr_id)">
                        PR: {{ req.pr_ref || ('#' + req.pr_id) }}
                      </span>
                    } @else {
                      <span class="badge-source direct">Direct</span>
                    }
                  </td>

                  <!-- Item & Specification -->
                  <td>
                    <a [routerLink]="['/sourcing', req.id]" class="item-title">
                      {{ req.item_name }}
                    </a>
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
                    <span class="category-chip">{{ req.category?.name || req.category_name || '—' }}</span>
                  </td>

                  <!-- Required Quantity -->
                  <td>
                    <strong>{{ req.qty }}</strong> <span style="font-size:12px;color:var(--text-3);">{{ req.unit }}</span>
                  </td>

                  <!-- Target Price -->
                  <td>
                    @if (req.target_price && req.target_price > 0) {
                      <span class="target-price">₹{{ req.target_price | number:'1.2-2' }}</span>
                    } @else {
                      <span style="color:#94a3b8;font-size:12px;">—</span>
                    }
                  </td>

                  <!-- Vendor Contacts & Quotes -->
                  <td>
                    @if (req.vendor_contacts?.length) {
                      <div class="vendor-quotes-summary">
                        <span class="quotes-count-badge">
                          <mat-icon>store</mat-icon> {{ req.vendor_contacts!.length }} Contact{{ req.vendor_contacts!.length > 1 ? 's' : '' }}
                        </span>
                        @if (bestQuote(req)) {
                          <div class="best-quote">Best: ₹{{ bestQuote(req) | number:'1.2-2' }}</div>
                        }
                      </div>
                    } @else {
                      <span class="no-quotes" (click)="openContactDialog(req)">+ Add Vendor</span>
                    }
                  </td>

                  <!-- Latest Remark / Call Log -->
                  <td>
                    @if (req.remarks?.length) {
                      <div class="remark-preview" [matTooltip]="req.remarks![0].remark">
                        <span class="remark-by">{{ req.remarks![0].user?.name || 'Buyer' }}:</span>
                        "{{ req.remarks![0].remark }}"
                      </div>
                    } @else {
                      <span style="color:#94a3b8;font-size:12px;font-style:italic;">No remarks yet</span>
                    }
                  </td>

                  <!-- Status -->
                  <td>
                    <span class="status-pill" [class.status-open]="req.status === 'open'" [class.status-closed]="req.status === 'closed'">
                      <mat-icon>{{ req.status === 'open' ? 'play_circle' : 'check_circle' }}</mat-icon>
                      {{ req.status | titlecase }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:4px;align-items:center;">
                      <button mat-icon-button color="primary" [routerLink]="['/sourcing', req.id]" matTooltip="Open Workspace / Details">
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
      }

    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
    .title-with-badge { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    h2 { margin:0; font-size:22px; font-weight:800; }
    .internal-tag { background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; }
    .subtitle { margin:4px 0 0; font-size:13px; color:var(--text-3); }
    .header-actions { display:flex; align-items:center; gap:10px; }
    .action-btn { height:40px!important; }
    .action-btn-primary { height:40px!important; font-weight:700!important; background:linear-gradient(135deg, var(--brand), var(--brand-hover))!important; }

    .stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px; }
    .stat-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; display:flex; align-items:center; gap:14px; box-shadow:0 1px 3px rgba(0,0,0,0.02); }
    .stat-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; }
    .stat-total .stat-icon { background:#f0f9ff; color:#0284c7; }
    .stat-open .stat-icon { background:#ecfdf5; color:#059669; }
    .stat-closed .stat-icon { background:#f1f5f9; color:#475569; }
    .stat-sources .stat-icon { background:#fdf4ff; color:#a855f7; }
    .stat-value { font-size:22px; font-weight:800; color:var(--text-1); line-height:1.2; }
    .stat-label { font-size:12px; color:var(--text-3); margin-top:2px; font-weight:500; }

    .filter-card { border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.02); margin-bottom:20px; padding:14px 16px; }
    .filter-bar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
    .search-field { flex:1; min-width:280px; }
    .select-field { width:200px; }
    .toggle-group { height:52px; display:flex; align-items:center; }

    .table-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow-x:auto; box-shadow:0 1px 3px rgba(0,0,0,0.02); }
    .sourcing-table { width:100%; border-collapse:collapse; font-size:13px; }
    .sourcing-table th { background:#f8fafc; padding:12px 14px; text-align:left; font-weight:700; color:#475569; border-bottom:1px solid #e2e8f0; white-space:nowrap; }
    .sourcing-table td { padding:12px 14px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .table-row:hover { background:#f8fafc; }

    .sourcing-no-link { font-weight:800; color:#0284c7; text-decoration:none; }
    .sourcing-no-link:hover { text-decoration:underline; }
    .client-title { font-weight:700; color:var(--text-1); font-size:12.5px; }
    .badge-source { display:inline-block; font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:4px; margin-top:2px; }
    .badge-source.pr { background:#eff6ff; color:#2563eb; }
    .badge-source.direct { background:#fdf4ff; color:#a855f7; }

    .item-title { font-weight:700; color:var(--text-1); text-decoration:none; display:inline-block; }
    .item-title:hover { color:var(--brand); text-decoration:underline; }
    .spec-preview { font-size:11.5px; color:var(--text-2); max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
    .loc-preview { font-size:11px; color:#64748b; display:flex; align-items:center; gap:2px; margin-top:2px; }
    .loc-preview mat-icon { font-size:12px; width:12px; height:12px; }

    .category-chip { background:#f1f5f9; color:#475569; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; white-space:nowrap; }
    .target-price { font-weight:700; color:#0284c7; }

    .vendor-quotes-summary { display:flex; flex-direction:column; gap:2px; }
    .quotes-count-badge { display:inline-flex; align-items:center; gap:3px; font-size:11.5px; font-weight:700; color:#059669; }
    .quotes-count-badge mat-icon { font-size:13px; width:13px; height:13px; }
    .best-quote { font-size:11px; font-weight:700; color:#15803d; }
    .no-quotes { font-size:11.5px; color:#0284c7; font-weight:600; cursor:pointer; }
    .no-quotes:hover { text-decoration:underline; }

    .remark-preview { font-size:12px; color:var(--text-2); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .remark-by { font-weight:700; color:#0369a1; }

    .status-pill { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:99px; font-size:11px; font-weight:700; }
    .status-open { background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; }
    .status-closed { background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; }
    .status-pill mat-icon { font-size:13px; width:13px; height:13px; }

    .empty-table-state { display:flex; flex-direction:column; align-items:center; padding:60px 20px; color:#94a3b8; gap:10px; text-align:center; background:#fff; border:1px solid #e2e8f0; border-radius:12px; }
    .empty-table-state mat-icon { font-size:48px; width:48px; height:48px; color:#cbd5e1; }
    .empty-table-state h3 { margin:0; font-size:18px; color:var(--text-1); font-weight:700; }
    .empty-table-state p { margin:0 0 8px; font-size:13px; }
  `]
})
export class SourcingListComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  auth = inject(AuthService);

  loading = signal(true);
  exporting = signal(false);
  requests = signal<SourcingRequest[]>([]);
  stats = signal({ total: 0, open: 0, closed: 0, from_pr: 0, direct: 0 });

  searchTerm = '';
  selectedStatus = 'all';
  selectedSource = 'all';
  selectedTenant: any = 'all';

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    let params: any = {};
    if (this.searchTerm.trim()) params.search = this.searchTerm.trim();
    if (this.selectedStatus !== 'all') params.status = this.selectedStatus;
    if (this.selectedSource !== 'all') params.source_type = this.selectedSource;
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

  bestQuote(req: SourcingRequest): number | null {
    if (!req.vendor_contacts?.length) return null;
    const prices = req.vendor_contacts
      .map(c => c.quoted_price ? +c.quoted_price : null)
      .filter((p): p is number => p !== null && p > 0);
    if (!prices.length) return null;
    return Math.min(...prices);
  }

  openCreateDialog() {
    const ref = this.dialog.open(SourcingFormDialogComponent, {
      width: '780px',
      maxHeight: '90vh',
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.loadData();
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
    if (this.searchTerm.trim()) params.search = this.searchTerm.trim();
    if (this.selectedStatus !== 'all') params.status = this.selectedStatus;
    if (this.selectedSource !== 'all') params.source_type = this.selectedSource;
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
        this.notify.success('Sourcing export downloaded successfully.');
      },
      error: () => {
        this.exporting.set(false);
        this.notify.error('Could not export sourcing items.');
      }
    });
  }
}
