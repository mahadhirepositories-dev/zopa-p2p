import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { animate, query, style, transition, trigger } from '@angular/animations';
import { AuthService } from './core/auth/auth.service';
import { SearchSelectDialogComponent, SearchSelectOption } from './shared/components/search-select-dialog.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  animations: [
    trigger('routePage', [
      transition('* <=> *', [
        query(':enter', [
          style({ opacity: 0 }),
          animate('200ms ease', style({ opacity: 1 }))
        ], { optional: true }),
      ])
    ])
  ],
  template: `
    @if (auth.isLoggedIn()) {
      <div class="app-layout">

        <!-- ── Sidebar ─────────────────────────────────────── -->
        <aside class="sidebar">

          <!-- Brand / Logo -->
          <div class="sidebar-brand">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style="flex-shrink:0;">
              <rect width="36" height="36" rx="10" fill="#f97316"/>
              <text x="18" y="26" text-anchor="middle"
                    font-family="Arial,sans-serif" font-size="21"
                    font-weight="900" fill="white" letter-spacing="-1">Z</text>
            </svg>
            <div>
              <div class="brand-name">ZOPA</div>
              <div class="brand-sub">P2P Suite</div>
            </div>
          </div>

          <!-- Tenant context — a switcher when the user belongs to >1 org -->
          @if (auth.clients().length > 1) {
            <button class="tenant-switcher" (click)="openOrgSwitcher()"
                    matTooltip="Switch organization (Ctrl/⌘ + K)">
              <mat-icon class="tenant-icon">corporate_fare</mat-icon>
              <span class="tenant-col">
                <span class="tenant-name">{{ auth.currentTenantName() }}</span>
                <span class="tenant-type" [class.tenant-type--internal]="auth.currentTenantIsInternal()">
                  {{ auth.currentTenantIsInternal() ? 'ZOPA Internal' : 'Client' }}
                </span>
              </span>
              <mat-icon class="tenant-caret">unfold_more</mat-icon>
            </button>
          } @else if (auth.currentTenantName()) {
            <div class="tenant-label">
              <mat-icon class="tenant-icon">corporate_fare</mat-icon>
              <span>{{ auth.currentTenantName() }}</span>
            </div>
          }

          <!-- Navigation -->
          <nav class="sidebar-nav">

            <div class="nav-section">
              <span class="nav-section-label">Main</span>
              <a class="nav-link" routerLink="/dashboard" routerLinkActive="nav-link--active"
                 [routerLinkActiveOptions]="{exact:true}">
                <mat-icon>dashboard</mat-icon><span>Dashboard</span>
              </a>
              <a class="nav-link" routerLink="/executive-dashboard" routerLinkActive="nav-link--active">
                <mat-icon>analytics</mat-icon><span>Executive Dashboard</span>
              </a>
              <a class="nav-link" routerLink="/help" routerLinkActive="nav-link--active">
                <mat-icon>help_outline</mat-icon><span>Help &amp; Manual</span>
              </a>
            </div>

            @if (auth.canDo('purchase_requisitions','view') || auth.canDo('purchase_orders','view') ||
                 auth.canDo('approvals','view') || auth.canDo('grns','view') ||
                 auth.canDo('invoices','view') || auth.canDo('reports','view')) {
              <div class="nav-section">
                <span class="nav-section-label">Procurement</span>
                @if (auth.canDo('purchase_requisitions','view')) {
                  <a class="nav-link" routerLink="/purchase-requisitions" routerLinkActive="nav-link--active">
                    <mat-icon>description</mat-icon><span>Requisitions</span>
                  </a>
                }
                @if (auth.canDo('purchase_orders','view')) {
                  <a class="nav-link" routerLink="/purchase-orders" routerLinkActive="nav-link--active">
                    <mat-icon>receipt_long</mat-icon><span>Purchase Orders</span>
                  </a>
                }
                @if (auth.canDo('approvals','view')) {
                  <a class="nav-link" routerLink="/approvals" routerLinkActive="nav-link--active">
                    <mat-icon>task_alt</mat-icon><span>Approvals</span>
                  </a>
                }
                @if (auth.canDo('grns','view')) {
                  <a class="nav-link" routerLink="/grns" routerLinkActive="nav-link--active">
                    <mat-icon>inventory_2</mat-icon><span>Goods Receipt</span>
                  </a>
                }
                @if (auth.canDo('invoices','view')) {
                  <a class="nav-link" routerLink="/invoices" routerLinkActive="nav-link--active">
                    <mat-icon>request_quote</mat-icon><span>Invoices</span>
                  </a>
                }
                @if (auth.canDo('reports','view')) {
                  <a class="nav-link" routerLink="/reports" routerLinkActive="nav-link--active">
                    <mat-icon>bar_chart</mat-icon><span>Reports</span>
                  </a>
                }
              </div>
            }

            @if (auth.canDo('vendors','view') || auth.canDo('products','view') ||
                 auth.canDo('cost_centers','view') || auth.canDo('org_masters','view')) {
              <div class="nav-section">
                <span class="nav-section-label">Master Data</span>
                @if (auth.canDo('vendors','view')) {
                  <a class="nav-link" routerLink="/vendors" routerLinkActive="nav-link--active">
                    <mat-icon>business</mat-icon><span>Vendors</span>
                  </a>
                }
                @if (auth.canDo('products','view')) {
                  <a class="nav-link" routerLink="/products" routerLinkActive="nav-link--active">
                    <mat-icon>inventory</mat-icon><span>Products</span>
                  </a>
                }
                @if (auth.canDo('products','view')) {
                  <a class="nav-link" routerLink="/categories" routerLinkActive="nav-link--active">
                    <mat-icon>category</mat-icon><span>Categories</span>
                  </a>
                }
                @if (auth.canDo('cost_centers','view')) {
                  <a class="nav-link" routerLink="/cost-centers" routerLinkActive="nav-link--active">
                    <mat-icon>account_balance_wallet</mat-icon><span>Cost Centers</span>
                  </a>
                }
                @if (auth.canDo('org_masters','view')) {
                  <a class="nav-link" routerLink="/org-masters" routerLinkActive="nav-link--active">
                    <mat-icon>corporate_fare</mat-icon><span>Org Masters</span>
                  </a>
                }
              </div>
            }

            @if (!auth.isZopaStaff() && auth.canDo('org_staff','view')) {
              <div class="nav-section">
                <span class="nav-section-label">Administration</span>
                <a class="nav-link" routerLink="/org-staff" routerLinkActive="nav-link--active">
                  <mat-icon>group</mat-icon><span>Staff Management</span>
                </a>
              </div>
            }

            <!-- Platform administration — ZOPA Super Admin only -->
            @if (auth.isSuperAdmin()) {
              <div class="nav-section">
                <span class="nav-section-label">Administration</span>
                <a class="nav-link" routerLink="/admin/dashboard" routerLinkActive="nav-link--active">
                  <mat-icon>monitor_heart</mat-icon><span>ZOPA Dashboard</span>
                </a>
                <a class="nav-link" routerLink="/admin/staff" routerLinkActive="nav-link--active">
                  <mat-icon>group</mat-icon><span>ZOPA Staff</span>
                </a>
                <a class="nav-link" routerLink="/admin/clients" routerLinkActive="nav-link--active">
                  <mat-icon>manage_accounts</mat-icon><span>Client Management</span>
                </a>
                <a class="nav-link" routerLink="/admin/settings" routerLinkActive="nav-link--active">
                  <mat-icon>tune</mat-icon><span>Platform Settings</span>
                </a>
                <a class="nav-link" routerLink="/admin/roles-master" routerLinkActive="nav-link--active">
                  <mat-icon>manage_accounts</mat-icon><span>Roles Master</span>
                </a>
                <a class="nav-link" routerLink="/admin/access-control" routerLinkActive="nav-link--active">
                  <mat-icon>admin_panel_settings</mat-icon><span>Access Control</span>
                </a>
                <a class="nav-link" routerLink="/admin/email-templates" routerLinkActive="nav-link--active">
                  <mat-icon>mail</mat-icon><span>Email Templates</span>
                </a>
              </div>
            }

          </nav>

          <!-- User footer -->
          <div class="sidebar-footer">
            <div class="user-row">
              <a class="user-link" routerLink="/profile" routerLinkActive="user-link--active" matTooltip="View profile">
                <div class="user-avatar">{{ auth.user()?.name?.[0]?.toUpperCase() }}</div>
                <div class="user-info">
                  <div class="user-name">{{ auth.user()?.name }}</div>
                  <div class="user-role">{{ auth.currentRole() }}</div>
                </div>
              </a>
              <button mat-icon-button class="logout-btn" (click)="auth.logout()" matTooltip="Sign out">
                <mat-icon>logout</mat-icon>
              </button>
            </div>
          </div>

        </aside>

        <!-- ── Main area ────────────────────────────────────── -->
        <div class="main-area">
          <header class="topbar">
            @if (auth.isImpersonating()) {
              <div class="impersonation-banner">
                <mat-icon>supervisor_account</mat-icon>
                <span>Acting on behalf of <strong>{{ auth.currentTenantName() }}</strong></span>
                <button mat-stroked-button class="exit-btn" (click)="exitImpersonation()">
                  <mat-icon>logout</mat-icon> Exit Context
                </button>
              </div>
            }
            <div class="topbar-spacer"></div>
            <div class="topbar-actions">
              <a mat-icon-button matTooltip="Help & User Manual" class="topbar-btn" routerLink="/help">
                <mat-icon>help_outline</mat-icon>
              </a>
              <button mat-icon-button matTooltip="Notifications" class="topbar-btn">
                <mat-icon>notifications_none</mat-icon>
              </button>
              <a class="topbar-avatar" (click)="router.navigate(['/profile'])" matTooltip="My Profile">{{ auth.user()?.name?.[0]?.toUpperCase() }}</a>
            </div>
          </header>

          <!-- Active-organization context bar (multi-org / super admin) so it's
               always clear WHICH org the data you add/edit belongs to. -->
          @if (auth.clients().length > 1) {
            <div class="org-context-bar" [class.org-context-bar--internal]="auth.currentTenantIsInternal()">
              <mat-icon>corporate_fare</mat-icon>
              <span class="ctx-text">Working in <strong>{{ auth.currentTenantName() }}</strong></span>
              <span class="ctx-chip" [class.ctx-chip--internal]="auth.currentTenantIsInternal()">
                {{ auth.currentTenantIsInternal() ? 'ZOPA Internal' : 'Client Organization' }}
              </span>
              <span class="ctx-note">Anything you add here belongs to this organization.</span>
            </div>
          }

          <main class="page-content" [@routePage]="routeUrl()">
            <router-outlet />
          </main>
        </div>

      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    /* ── Layout ───────────────────────────────── */
    .app-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg);
    }

    /* ── Sidebar ──────────────────────────────── */
    .sidebar {
      width: 240px;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10;
    }

    /* Brand */
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid var(--border);
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%);
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(249,115,22,0.35);
    }
    .brand-icon mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    .brand-name { font-size: 16px; font-weight: 800; color: var(--text-1); letter-spacing: 0.5px; }
    .brand-sub  { font-size: 10px; color: var(--text-3); letter-spacing: 0.8px; text-transform: uppercase; margin-top: 1px; }

    /* Tenant */
    .tenant-picker, .tenant-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      background: #fafafa;
    }
    .tenant-icon { font-size: 14px; width: 14px; height: 14px; color: var(--brand); }
    .tenant-select { flex: 1; font-size: 12px; }
    .tenant-label span { font-size: 12px; color: var(--text-2); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Organization switcher */
    .tenant-switcher {
      display: flex; align-items: center; gap: 6px; width: 100%;
      padding: 10px 16px; border: 0; border-bottom: 1px solid var(--border);
      background: #fafafa; cursor: pointer; text-align: left; transition: background .12s;
    }
    .tenant-switcher:hover { background: var(--brand-light, #fff1e6); }
    .tenant-switcher .tenant-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .tenant-switcher .tenant-name { font-size: 12px; color: var(--text-1); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tenant-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #b45309; }
    .tenant-type--internal { color: #6d28d9; }
    .tenant-caret { font-size: 16px; width: 16px; height: 16px; color: var(--text-3); flex-shrink: 0; }

    /* Active-org context bar */
    .org-context-bar {
      display: flex; align-items: center; gap: 10px; padding: 8px 22px;
      background: #fff7ed; border-bottom: 1px solid #fed7aa; color: #9a3412; font-size: 13px;
    }
    .org-context-bar--internal { background: #f5f3ff; border-bottom-color: #ddd6fe; color: #5b21b6; }
    .org-context-bar mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .org-context-bar .ctx-text strong { font-weight: 700; }
    .ctx-chip { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      background: #fdba74; color: #7c2d12; padding: 2px 9px; border-radius: 999px; }
    .ctx-chip--internal { background: #c4b5fd; color: #4c1d95; }
    .ctx-note { color: inherit; opacity: .72; font-size: 12px; margin-left: auto; }
    @media (max-width: 760px) { .org-context-bar .ctx-note { display: none; } }
    .org-menu-head { padding: 8px 16px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
    ::ng-deep .org-menu .mat-mdc-menu-item { min-height: 52px; }
    .org-mini-avatar { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; background: var(--brand-light, #fff1e6); color: var(--brand, #f97316); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; margin-right: 10px; }
    .org-mini-info { display: inline-flex; flex-direction: column; vertical-align: middle; }
    .org-mini-name { font-size: 13px; font-weight: 600; color: var(--text-1); line-height: 1.2; }
    .org-mini-role { font-size: 11px; color: var(--text-3); }
    .org-check { color: #16a34a; margin-left: auto; }

    /* Nav */
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 8px 10px;
    }
    .sidebar-nav::-webkit-scrollbar { width: 4px; }
    .sidebar-nav::-webkit-scrollbar-track { background: transparent; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

    .nav-section { margin-bottom: 4px; }
    .nav-section-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 8px 8px 4px;
      display: block;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 10px;
      border-radius: 8px;
      color: var(--text-2);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .nav-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--text-3);
      transition: color 0.15s ease;
      flex-shrink: 0;
    }
    .nav-link:hover {
      background: var(--brand-light);
      color: var(--brand);
    }
    .nav-link:hover mat-icon { color: var(--brand); }
    .nav-link--active {
      background: var(--brand-light);
      color: var(--brand) !important;
      font-weight: 600;
    }
    .nav-link--active mat-icon { color: var(--brand) !important; }

    /* Footer */
    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--border);
      background: #fafafa;
    }
    .user-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 4px;
      border-radius: 10px;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .user-link {
      display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
      padding: 4px; border-radius: 8px; text-decoration: none; cursor: pointer;
      transition: background .12s;
    }
    .user-link:hover { background: var(--brand-light, #fff1e6); }
    .user-link--active { background: var(--brand-light, #fff1e6); }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: 12px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-role { font-size: 10px; color: var(--text-3); text-transform: capitalize; }
    .logout-btn { width: 28px !important; height: 28px !important; }
    .logout-btn mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-3); }

    /* ── Main area ────────────────────────────── */
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    /* Topbar */
    .topbar {
      min-height: 52px;
      flex-shrink: 0;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 12px;
      flex-wrap: wrap;
    }

    /* Impersonation banner */
    .impersonation-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      color: #ea580c;
    }
    .impersonation-banner mat-icon { font-size: 16px; width: 16px; height: 16px; color: #ea580c; }
    .impersonation-banner strong { font-weight: 700; }
    .exit-btn {
      margin-left: 4px;
      font-size: 11px !important;
      height: 28px !important;
      line-height: 28px !important;
      border-color: #ea580c !important;
      color: #ea580c !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
    }
    .exit-btn mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    .topbar-spacer { flex: 1; }
    .topbar-actions { display: flex; align-items: center; gap: 4px; }
    .topbar-btn mat-icon { color: var(--text-2); }
    .topbar-avatar {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      margin-left: 4px;
      text-decoration: none;
      cursor: pointer;
    }

    /* Page content */
    .page-content {
      flex: 1;
      overflow-y: auto;
      background: var(--bg);
    }
    .page-content::-webkit-scrollbar { width: 6px; }
    .page-content::-webkit-scrollbar-track { background: transparent; }
    .page-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
  `],
})
export class App {
  readonly routeUrl = signal('');
  private dialog = inject(MatDialog);
  private orgSwitcherOpen = false;

  constructor(public auth: AuthService, public router: Router) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.routeUrl.set(e.urlAfterRedirects));
  }

  /** Open the searchable organization switcher (scales to 100s of orgs). */
  openOrgSwitcher() {
    if (this.orgSwitcherOpen || this.auth.clients().length <= 1) return;
    this.orgSwitcherOpen = true;
    const options: SearchSelectOption[] = this.auth.clients().map(c => ({
      id: c.tenant_id,
      name: c.tenant_name,
      sub: this.roleLabel(c.role),
      badge: c.is_internal ? 'ZOPA Internal' : 'Client',
      badgeAccent: c.is_internal ? 'purple' : 'orange',
    }));
    const ref = this.dialog.open(SearchSelectDialogComponent, {
      width: '460px',
      maxWidth: '92vw',
      autoFocus: 'input',
      position: { top: '12vh' },
      data: {
        title: 'Switch organization',
        options,
        currentId: this.auth.currentTenantId(),
        searchPlaceholder: 'Search organizations…',
      },
    });
    ref.afterClosed().subscribe((tenantId?: number) => {
      this.orgSwitcherOpen = false;
      if (tenantId) this.switchOrg(tenantId);
    });
  }

  /** Ctrl/⌘ + K opens the org switcher from anywhere. */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      if (this.auth.isLoggedIn() && this.auth.clients().length > 1) {
        e.preventDefault();
        this.openOrgSwitcher();
      }
    }
  }

  exitImpersonation() {
    this.auth.exitImpersonation();
    this.router.navigate(['/admin/clients']);
  }

  /** Switch the active organization and re-enter its context — IN-APP.
   *
   * Deliberately NOT a full browser reload (window.location). A full reload
   * re-fetches index.html, which after a deploy may be a stale browser-cached
   * copy pointing at hashed JS bundles that no longer exist on the server →
   * the app fails to boot and the user lands on /login. Angular router
   * navigation keeps the already-loaded bundle and the in-memory session, so
   * switching orgs can never bounce to login. The tenant interceptor reads
   * currentTenantId() live, so every subsequent request carries the new
   * X-Tenant-ID, and routed components refetch on (re-)entry. */
  switchOrg(tenantId: number) {
    if (tenantId === this.auth.currentTenantId()) return;
    this.auth.switchClient(tenantId);
    this.router.navigate(['/dashboard']);
  }

  roleLabel(role: string): string {
    return role
      .replace(/^zopa_/, 'ZOPA ')
      .replace(/^client_/, '')
      .replace(/_/g, ' ')
      .replace(/\bl(\d)\b/i, 'L$1')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
