import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ModulePermissions, PermissionsMatrix } from '../../../core/models';
import { RoleService } from '../../../services/role.service';

// ── Local display metadata ────────────────────────────────────────────────────

interface ModuleMeta {
  key: string;
  label: string;
  icon: string;
  description: string;
  group: 'procurement' | 'master' | 'admin';
}

interface RoleMeta {
  key: string;
  label: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  isProtected: boolean;  // true for zopa_super_admin — read-only
  group: 'zopa' | 'client';
}

const MODULE_META: ModuleMeta[] = [
  { key: 'purchase_requisitions', label: 'Purchase Requisitions', icon: 'description',           description: 'Create and manage PR documents',       group: 'procurement' },
  { key: 'purchase_orders',       label: 'Purchase Orders',       icon: 'receipt_long',          description: 'Manage PO lifecycle and approval flow', group: 'procurement' },
  { key: 'grns',                  label: 'Goods Receipt (GRN)',    icon: 'inventory_2',           description: 'Record goods received against POs',     group: 'procurement' },
  { key: 'invoices',              label: 'Invoices',              icon: 'request_quote',          description: 'Create and approve vendor invoices',    group: 'procurement' },
  { key: 'approvals',             label: 'Approvals',             icon: 'task_alt',               description: 'Approve, return or reject documents',   group: 'procurement' },
  { key: 'vendors',               label: 'Vendors',               icon: 'business',               description: 'Manage vendor master records',          group: 'master'      },
  { key: 'products',              label: 'Products & Catalogue',  icon: 'inventory',              description: 'Product catalogue, HSN codes, rates',   group: 'master'      },
  { key: 'cost_centers',          label: 'Cost Centers & Budget', icon: 'account_balance_wallet', description: 'Budget limits, approval configs',       group: 'master'      },
  { key: 'org_masters',           label: 'Org Masters',           icon: 'corporate_fare',         description: 'Departments, projects, locations',      group: 'master'      },
  { key: 'reports',               label: 'Reports',               icon: 'bar_chart',              description: 'Analytics and TAT reports',             group: 'admin'       },
  { key: 'org_staff',             label: 'Staff Management',      icon: 'group',                  description: 'Add/remove users and assign roles',     group: 'admin'       },
];



const ACTION_COLS = [
  { key: 'can_view',   label: 'View',   icon: 'visibility',   color: '#2563eb' },
  { key: 'can_create', label: 'Create', icon: 'add_circle',   color: '#16a34a' },
  { key: 'can_edit',   label: 'Edit',   icon: 'edit',         color: '#d97706' },
  { key: 'can_delete', label: 'Delete', icon: 'delete',       color: '#dc2626' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-access-control',
  standalone: true,
  imports: [
    FormsModule,
    MatTabsModule, MatTableModule, MatSlideToggleModule, MatButtonModule,
    MatIconModule, MatCardModule, MatProgressSpinnerModule, MatTooltipModule,
    MatChipsModule, MatDividerModule, MatBadgeModule,
  ],
  template: `
<div class="page-wrapper">

  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <div class="page-header">
    <div>
      <h2>Access Control</h2>
      <p>Define what each role can view, create, edit, and delete across all modules.<br>
         Changes take effect immediately for all users holding that role.</p>
    </div>
    <div class="header-actions">
      <div class="info-pill">
        <mat-icon>shield</mat-icon>
        <span>Super Admin is always unrestricted</span>
      </div>
    </div>
  </div>

  @if (loading()) {
    <div class="center-spinner"><mat-spinner diameter="40" /></div>
  } @else {

    <!-- ── Role Tabs ──────────────────────────────────────────────────────── -->
    <mat-tab-group
      animationDuration="150ms"
      [(selectedIndex)]="selectedTabIndex"
      class="role-tabs">

      @for (role of roleMeta; track role.key) {
        <mat-tab>
          <ng-template mat-tab-label>
            <div class="tab-label">
              <span class="role-badge" [style.background]="role.badgeColor">{{ role.badge }}</span>
              <span class="tab-text">{{ role.shortLabel }}</span>
              @if (dirtyRoles().has(role.key)) {
                <span class="dirty-dot" matTooltip="Unsaved changes"></span>
              }
            </div>
          </ng-template>

          <div class="tab-content">

            <!-- Role description strip -->
            <div class="role-info-strip">
              <div class="role-info-left">
                <span class="role-full-badge" [style.background]="role.badgeColor">{{ role.badge }}</span>
                <div>
                  <div class="role-full-name">{{ role.label }}</div>
                  <div class="role-group-label">{{ role.group === 'zopa' ? 'ZOPA Internal Role' : 'Client Organisation Role' }}</div>
                </div>
              </div>

              @if (role.isProtected) {
                <div class="protected-notice">
                  <mat-icon>lock</mat-icon>
                  <span>Super Admin has unrestricted access to all modules. This cannot be changed.</span>
                </div>
              } @else {
                <div class="tab-save-row">
                  <button mat-stroked-button (click)="resetRole(role.key)" [disabled]="saving()">
                    <mat-icon>restart_alt</mat-icon> Reset to Defaults
                  </button>
                  <button mat-flat-button color="primary"
                          (click)="saveRole(role.key)"
                          [disabled]="saving() || !dirtyRoles().has(role.key)">
                    @if (saving() && savingRole() === role.key) {
                      <mat-spinner diameter="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" />
                    } @else {
                      <mat-icon>save</mat-icon>
                    }
                    Save Changes
                  </button>
                </div>
              }
            </div>

            <!-- Permission matrix table -->
            <div class="matrix-card">

              <!-- Action column headers -->
              <div class="matrix-header-row">
                <div class="module-col-header">Module</div>
                @for (action of actionCols; track action.key) {
                  <div class="action-col-header">
                    <mat-icon [style.color]="action.color">{{ action.icon }}</mat-icon>
                    <span>{{ action.label }}</span>
                  </div>
                }
              </div>

              <!-- Module groups -->
              @for (group of moduleGroups; track group.label) {
                <div class="group-header">
                  <mat-icon class="group-icon">{{ group.icon }}</mat-icon>
                  {{ group.label }}
                </div>

                @for (mod of group.modules; track mod.key) {
                  <div class="matrix-row" [class.protected-row]="role.isProtected">
                    <div class="module-cell">
                      <mat-icon class="module-icon">{{ mod.icon }}</mat-icon>
                      <div class="module-text">
                        <span class="module-label">{{ mod.label }}</span>
                        <span class="module-desc">{{ mod.description }}</span>
                      </div>
                    </div>

                    @for (action of actionCols; track action.key) {
                      <div class="action-cell"
                           [matTooltip]="role.isProtected ? 'Super Admin always has ' + action.label + ' access' : ''">
                        <mat-slide-toggle
                          [checked]="getPermission(role.key, mod.key, action.key)"
                          [disabled]="role.isProtected || saving()"
                          [color]="getToggleColor(action.key)"
                          (change)="setPermission(role.key, mod.key, action.key, $event.checked)" />
                      </div>
                    }
                  </div>
                }
              }

            </div><!-- /matrix-card -->
          </div><!-- /tab-content -->
        </mat-tab>
      }

    </mat-tab-group>

  }
</div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; gap: 20px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .page-header p  { margin: 6px 0 0; font-size: 13px; color: var(--text-3); line-height: 1.5; }
    .header-actions { flex-shrink: 0; }
    .info-pill {
      display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
      background: #f5f3ff; color: #7c3aed; border: 1px solid #e9d5ff;
      padding: 8px 14px; border-radius: 99px; font-size: 13px; font-weight: 600;
    }
    .info-pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .center-spinner { display: flex; justify-content: center; padding: 80px; }

    /* ── Tabs ─────────────────────────────────────────────────────────────── */
    ::ng-deep .role-tabs .mat-mdc-tab-header { background: white; border-bottom: 2px solid var(--border); border-radius: 12px 12px 0 0; }
    ::ng-deep .role-tabs .mat-mdc-tab-body-wrapper { background: white; border: 1px solid var(--border); border-top: none; border-radius: 0 0 12px 12px; }

    .tab-label { display: flex; align-items: center; gap: 7px; padding: 4px 2px; }
    .tab-text  { font-size: 13px; font-weight: 600; }
    .role-badge { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; color: white; font-size: 9px; font-weight: 800; letter-spacing: 0.03em; flex-shrink: 0; }
    .dirty-dot { width: 7px; height: 7px; background: #f97316; border-radius: 50%; flex-shrink: 0; }

    /* ── Tab content ─────────────────────────────────────────────────────── */
    .tab-content { padding: 20px; }

    .role-info-strip { display: flex; align-items: center; justify-content: space-between; background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
    .role-info-left { display: flex; align-items: center; gap: 12px; }
    .role-full-badge { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; color: white; font-size: 13px; font-weight: 800; flex-shrink: 0; }
    .role-full-name { font-size: 15px; font-weight: 700; color: var(--text-1); }
    .role-group-label { font-size: 11px; color: var(--text-3); font-weight: 500; margin-top: 2px; }

    .protected-notice { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #7c3aed; background: #f5f3ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 14px; }
    .protected-notice mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .tab-save-row { display: flex; gap: 10px; align-items: center; }

    /* ── Permission matrix ───────────────────────────────────────────────── */
    .matrix-card { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }

    .matrix-header-row { display: grid; grid-template-columns: 1fr repeat(4, 110px); align-items: center; background: #f1f5f9; padding: 10px 16px; gap: 4px; border-bottom: 2px solid var(--border); }
    .module-col-header { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .07em; }
    .action-col-header { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .07em; }
    .action-col-header mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .group-header { display: flex; align-items: center; gap: 8px; padding: 10px 16px 6px; font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .08em; background: #fafbfc; border-top: 1px solid var(--border); }
    .group-icon { font-size: 14px; width: 14px; height: 14px; color: var(--text-3); }

    .matrix-row { display: grid; grid-template-columns: 1fr repeat(4, 110px); align-items: center; padding: 11px 16px; gap: 4px; border-top: 1px solid #f1f5f9; transition: background .12s; }
    .matrix-row:hover { background: #fafbff; }
    .matrix-row.protected-row { opacity: 0.85; }

    .module-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .module-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-3); flex-shrink: 0; }
    .module-text { min-width: 0; }
    .module-label { font-size: 13px; font-weight: 600; color: var(--text-1); display: block; }
    .module-desc  { font-size: 11px; color: var(--text-3); display: block; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .action-cell { display: flex; justify-content: center; align-items: center; }

    /* Slide toggle colours via CSS override (Material 3) */
    ::ng-deep .mat-mdc-slide-toggle.mat-warn   .mdc-switch--selected .mdc-switch__track { background: #fecaca !important; }
    ::ng-deep .mat-mdc-slide-toggle.mat-warn   .mdc-switch--selected .mdc-switch__handle-track .mdc-switch__handle::after { background: #dc2626 !important; }
    ::ng-deep .mat-mdc-slide-toggle.mat-accent .mdc-switch--selected .mdc-switch__track { background: #bbf7d0 !important; }
    ::ng-deep .mat-mdc-slide-toggle.mat-accent .mdc-switch--selected .mdc-switch__handle-track .mdc-switch__handle::after { background: #16a34a !important; }

    @media (max-width: 760px) {
      .matrix-header-row,
      .matrix-row { grid-template-columns: 1fr repeat(4, 72px); }
      .action-col-header span { display: none; }
    }
  `],
})
export class AccessControlComponent implements OnInit {
  private adminService = inject(AdminService);
  private notify       = inject(NotificationService);

  // ── Display metadata ──────────────────────────────────────────────────────
  get roleMeta() { return this.rolesMeta(); }
  readonly actionCols  = ACTION_COLS;

  readonly moduleGroups = [
    {
      label: 'Procurement',
      icon: 'receipt_long',
      modules: MODULE_META.filter(m => m.group === 'procurement'),
    },
    {
      label: 'Master Data',
      icon: 'folder_open',
      modules: MODULE_META.filter(m => m.group === 'master'),
    },
    {
      label: 'Administration',
      icon: 'admin_panel_settings',
      modules: MODULE_META.filter(m => m.group === 'admin'),
    },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  loading     = signal(true);
  saving      = signal(false);
  savingRole  = signal<string | null>(null);
  selectedTabIndex = 0;

  private roleService = inject(RoleService);

  /** Live working copy of the matrix — mutated by the toggles. */
  private matrix = signal<PermissionsMatrix>({});

  rolesMeta = signal<RoleMeta[]>([]);
  readonly clientRoles = computed(() => this.rolesMeta().filter(r => r.group === 'client'));
  readonly zopaRoles   = computed(() => this.rolesMeta().filter(r => r.group === 'zopa'));

  /**
   * Original matrix snapshot fetched from the API.
   * Used by "Reset to Defaults" to revert uncommitted changes.
   */
  private originalMatrix: PermissionsMatrix = {};

  /** Set of role keys with uncommitted changes (drives the orange dot). */
  readonly dirtyRoles = computed(() => {
    const dirty = new Set<string>();
    const current  = this.matrix();
    const original = this.originalMatrix;

    for (const role of this.rolesMeta().map(r => r.key)) {
      if (!current[role] || !original[role]) continue;
      for (const mod of MODULE_META.map(m => m.key)) {
        const c = current[role][mod];
        const o = original[role][mod];
        if (!c || !o) continue;
        if (c.can_view   !== o.can_view   ||
            c.can_create !== o.can_create ||
            c.can_edit   !== o.can_edit   ||
            c.can_delete !== o.can_delete) {
          dirty.add(role);
          break;
        }
      }
    }
    return dirty;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.roleService.getRoles().subscribe({
      next: (roles) => {
        const mappedRoles = roles.map(r => ({
          key: r.slug,
          label: r.name,
          shortLabel: r.name,
          badge: r.name.substring(0, 2).toUpperCase(),
          badgeColor: r.type === 'zopa' ? '#2563eb' : '#15803d',
          isProtected: r.slug === 'zopa_super_admin',
          group: r.type
        })) as RoleMeta[];
        this.rolesMeta.set(mappedRoles);

        this.adminService.getRolePermissions().subscribe({
          next: ({ matrix }) => {
            this.originalMatrix = this.deepClone(matrix);
            this.matrix.set(matrix);
            this.loading.set(false);
          },
          error: () => {
            this.notify.error('Failed to load permissions.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        console.error("Failed to load roles!");
        this.notify.error('Failed to load roles.');
        this.loading.set(false);
      }
    });
  }

  // ── Toggle helpers ────────────────────────────────────────────────────────

  getPermission(role: string, module: string, action: string): boolean {
    return (this.matrix()[role]?.[module] as any)?.[action] ?? false;
  }

  setPermission(role: string, module: string, action: string, value: boolean): void {
    this.matrix.update(m => {
      const copy = this.deepClone(m);
      if (!copy[role])         copy[role]         = {} as any;
      if (!copy[role][module]) copy[role][module]  = { can_view: false, can_create: false, can_edit: false, can_delete: false };
      (copy[role][module] as any)[action] = value;

      // Business rule: create/edit/delete requires view.
      if (action !== 'can_view' && value) {
        copy[role][module].can_view = true;
      }
      // If view is turned OFF, turn off all actions.
      if (action === 'can_view' && !value) {
        copy[role][module].can_create = false;
        copy[role][module].can_edit   = false;
        copy[role][module].can_delete = false;
      }

      return copy;
    });
  }

  getToggleColor(action: string): 'primary' | 'accent' | 'warn' {
    if (action === 'can_delete') return 'warn';
    if (action === 'can_view')   return 'primary';
    return 'accent';
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  saveRole(role: string): void {
    const rolePerms = this.matrix()[role];
    if (!rolePerms) return;

    this.saving.set(true);
    this.savingRole.set(role);

    this.adminService.updateRolePermissions(role, rolePerms).subscribe({
      next: ({ message }) => {
        // Advance the original snapshot so dirty detection resets
        this.originalMatrix[role] = this.deepClone(rolePerms);
        this.matrix.update(m => ({ ...m })); // force dirty recompute
        this.saving.set(false);
        this.savingRole.set(null);
        this.notify.success(message ?? `Permissions for '${role}' saved.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.savingRole.set(null);
        this.notify.error(err?.error?.message ?? 'Failed to save permissions.');
      },
    });
  }

  resetRole(role: string): void {
    const original = this.originalMatrix[role];
    if (!original) return;
    this.matrix.update(m => ({ ...m, [role]: this.deepClone(original) }));
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
