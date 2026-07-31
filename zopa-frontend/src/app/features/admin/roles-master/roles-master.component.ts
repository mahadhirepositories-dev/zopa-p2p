import { Component, inject, OnInit, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService, Role } from '../../../services/role.service';
import { SearchFieldComponent } from '../../../shared/components/search-field.component';

@Component({
  selector: 'app-roles-master',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    SearchFieldComponent
  ],
  template: `
    <div class="page-wrapper">
      <!-- ── Header ──────────────────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h2>Roles Master</h2>
          <p>Define role definitions, system keys, and organization classification for user access control.</p>
        </div>

        <div class="header-actions">
          <app-search-field
            class="search-field"
            [value]="searchQuery()"
            (valueChange)="searchQuery.set($event)"
            placeholder="Search roles or slugs..."
          />
          <button mat-raised-button color="primary" class="cta-btn" (click)="openDialog()">
            <mat-icon>add</mat-icon> Add Role
          </button>
        </div>
      </div>

      <!-- ── Quick Metrics Strip ─────────────────────────────────────────────── -->
      <div class="metrics-strip">
        <div class="metric-pill">
          <mat-icon class="text-gray-500">admin_panel_settings</mat-icon>
          <span class="metric-label">Total Roles:</span>
          <span class="metric-value">{{ roles().length }}</span>
        </div>
        <div class="metric-pill client-pill">
          <span class="role-dot client-dot"></span>
          <span class="metric-label">Client Roles:</span>
          <span class="metric-value">{{ clientRoleCount() }}</span>
        </div>
        <div class="metric-pill zopa-pill">
          <span class="role-dot zopa-dot"></span>
          <span class="metric-label">ZOPA Internal Roles:</span>
          <span class="metric-value">{{ zopaRoleCount() }}</span>
        </div>
      </div>

      <!-- ── Main Table Card ─────────────────────────────────────────────────── -->
      <div class="table-card">
        @if (loading()) {
          <div class="center-spinner">
            <mat-spinner diameter="40" />
          </div>
        } @else {
          <table mat-table [dataSource]="filteredRoles()">
            
            <!-- Role Name Column -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef> ROLE NAME </th>
              <td mat-cell *matCellDef="let role">
                <div class="role-name-cell">
                  <span class="role-avatar" [style.background]="getRoleBadgeColor(role)">
                    {{ getInitials(role.name) }}
                  </span>
                  <div class="role-meta">
                    <span class="role-title">{{ role.name }}</span>
                    <span class="role-sub">ID: {{ role.id ?? 'System' }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Slug Column -->
            <ng-container matColumnDef="slug">
              <th mat-header-cell *matHeaderCellDef> SYSTEM SLUG </th>
              <td mat-cell *matCellDef="let role">
                <code class="slug-badge">{{ role.slug }}</code>
              </td>
            </ng-container>

            <!-- Type Column -->
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef> TYPE </th>
              <td mat-cell *matCellDef="let role">
                <span
                  class="type-chip"
                  [class.zopa-chip]="role.type === 'zopa'"
                  [class.client-chip]="role.type === 'client'"
                >
                  <mat-icon class="chip-icon">{{ role.type === 'zopa' ? 'verified_user' : 'business' }}</mat-icon>
                  {{ role.type === 'zopa' ? 'ZOPA Internal' : 'Client Org' }}
                </span>
              </td>
            </ng-container>

            <!-- System Role Column -->
            <ng-container matColumnDef="is_system">
              <th mat-header-cell *matHeaderCellDef> ACCESS TYPE </th>
              <td mat-cell *matCellDef="let role">
                @if (role.is_system) {
                  <span class="access-badge protected" matTooltip="System role required for core workflows. Cannot be deleted.">
                    <mat-icon>lock</mat-icon> Protected System Role
                  </span>
                } @else {
                  <span class="access-badge custom" matTooltip="Custom role created by administrator.">
                    <mat-icon>tune</mat-icon> Custom Role
                  </span>
                }
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right"> ACTIONS </th>
              <td mat-cell *matCellDef="let role" class="text-right">
                <div class="action-buttons">
                  <button
                    mat-icon-button
                    color="primary"
                    matTooltip="Edit role details"
                    (click)="openDialog(role)"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    color="warn"
                    [disabled]="role.is_system"
                    [matTooltip]="role.is_system ? 'System roles cannot be deleted' : 'Delete role'"
                    (click)="deleteRole(role.slug)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>

            <!-- Empty Row -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state">
                  <mat-icon>search_off</mat-icon>
                  <p>No matching roles found for "{{ searchQuery() }}"</p>
                </div>
              </td>
            </tr>
          </table>
        }
      </div>
    </div>

    <!-- ── Dialog Template for Add/Edit Role ─────────────────────────────────── -->
    <ng-template #roleDialog>
      <div class="dialog-container">
        <div class="dialog-header">
          <div class="dialog-header-title">
            <mat-icon color="primary">{{ editingRole() ? 'edit' : 'add_moderator' }}</mat-icon>
            <h2>{{ editingRole() ? 'Edit Role' : 'Add New Role' }}</h2>
          </div>
          <button mat-icon-button mat-dialog-close>
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-dialog-content>
          <form [formGroup]="roleForm" class="dialog-form">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Role Name</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Finance Approver L4">
              <mat-error *ngIf="roleForm.get('name')?.hasError('required')">Role name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full" *ngIf="!editingRole()">
              <mat-label>Role Slug (System Key)</mat-label>
              <input matInput formControlName="slug" placeholder="e.g. client_finance_l4">
              <mat-hint>Must be unique, lowercase, underscores only.</mat-hint>
              <mat-error *ngIf="roleForm.get('slug')?.hasError('required')">Slug is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Role Classification / Scope</mat-label>
              <mat-select formControlName="type">
                <mat-option value="client">
                  <div class="option-item">
                    <mat-icon class="text-green-600">business</mat-icon>
                    <span>Client Organization</span>
                  </div>
                </mat-option>
                <mat-option value="zopa">
                  <div class="option-item">
                    <mat-icon class="text-purple-600">verified_user</mat-icon>
                    <span>ZOPA Internal</span>
                  </div>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </form>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-stroked-button mat-dialog-close [disabled]="saving()">Cancel</button>
          <button
            mat-raised-button
            color="primary"
            class="cta-btn"
            [disabled]="roleForm.invalid || saving()"
            (click)="saveRole()"
          >
            @if (saving()) {
              <mat-spinner diameter="18" class="inline-spinner" />
            } @else {
              <mat-icon>save</mat-icon>
            }
            {{ editingRole() ? 'Update Role' : 'Create Role' }}
          </button>
        </mat-dialog-actions>
      </div>
    </ng-template>
  `,
  styles: [`
    .page-wrapper {
      padding: 28px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ── Header ────────────────────────────────────────────────────────────── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 20px;
    }
    .page-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }
    .page-header p {
      margin: 6px 0 0;
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
    }
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-shrink: 0;
    }

    .cta-btn {
      border-radius: 8px;
      font-weight: 600;
      height: 42px;
      padding: 0 20px;
    }

    /* ── Metrics Strip ─────────────────────────────────────────────────────── */
    .metrics-strip {
      display: flex;
      gap: 14px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .metric-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid #e2e8f0;
      padding: 8px 16px;
      border-radius: 99px;
      font-size: 13px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .metric-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .metric-label {
      color: #64748b;
      font-weight: 500;
    }
    .metric-value {
      color: #0f172a;
      font-weight: 700;
    }
    .role-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .client-dot { background: #16a34a; }
    .zopa-dot { background: #7c3aed; }
    .client-pill { border-color: #dcfce7; background: #f0fdf4; }
    .zopa-pill { border-color: #f3e8ff; background: #faf5ff; }

    /* ── Table Card ────────────────────────────────────────────────────────── */
    .table-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .center-spinner {
      display: flex;
      justify-content: center;
      padding: 80px;
    }

    table {
      width: 100%;
    }

    th.mat-header-cell {
      background: #f8fafc;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 14px 20px;
      border-bottom: 2px solid #e2e8f0;
    }

    td.mat-cell {
      padding: 14px 20px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      color: #1e293b;
    }

    .table-row {
      transition: background 0.15s ease;
    }
    .table-row:hover {
      background: #f8fafc;
    }

    /* ── Cell Specific Styles ──────────────────────────────────────────────── */
    .role-name-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .role-avatar {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      color: white;
      font-weight: 700;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .role-meta {
      display: flex;
      flex-direction: column;
    }
    .role-title {
      font-weight: 600;
      color: #0f172a;
      font-size: 14px;
    }
    .role-sub {
      font-size: 11px;
      color: #94a3b8;
    }

    .slug-badge {
      font-family: 'Fira Code', monospace, inherit;
      background: #f1f5f9;
      color: #475569;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      border: 1px solid #e2e8f0;
    }

    .type-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 600;
    }
    .chip-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .client-chip {
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .zopa-chip {
      background: #f5f3ff;
      color: #6b21a8;
      border: 1px solid #e9d5ff;
    }

    .access-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 6px;
    }
    .access-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .access-badge.protected {
      background: #fff7ed;
      color: #c2410c;
      border: 1px solid #ffedd5;
    }
    .access-badge.custom {
      background: #f8fafc;
      color: #64748b;
      border: 1px solid #e2e8f0;
    }

    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }

    .empty-cell {
      padding: 40px !important;
      text-align: center;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
    }
    .empty-state mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    /* ── Dialog ────────────────────────────────────────────────────────────── */
    .dialog-container {
      padding: 24px;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .dialog-header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dialog-header-title h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 8px;
    }
    .option-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dialog-actions {
      padding-top: 20px;
    }
    .inline-spinner {
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
    }
  `]
})
export class RolesMasterComponent implements OnInit {
  private roleService = inject(RoleService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  roles = signal<Role[]>([]);
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  searchQuery = signal<string>('');

  displayedColumns = ['name', 'slug', 'type', 'is_system', 'actions'];

  @ViewChild('roleDialog') roleDialogTemplate: any;
  editingRole = signal<Role | null>(null);

  roleForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    type: ['client', Validators.required]
  });

  filteredRoles = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.roles();
    return this.roles().filter(r =>
      r.name.toLowerCase().includes(query) ||
      r.slug.toLowerCase().includes(query) ||
      r.type.toLowerCase().includes(query)
    );
  });

  clientRoleCount = computed(() => this.roles().filter(r => r.type === 'client').length);
  zopaRoleCount = computed(() => this.roles().filter(r => r.type === 'zopa').length);

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.loading.set(true);
    this.roleService.getAdminRoles().subscribe({
      next: (res) => {
        this.roles.set(res);
        this.loading.set(false);
      },
      error: () => {
        console.error("Failed to load admin roles");
        this.notify.error('Failed to load roles');
        this.loading.set(false);
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'R';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getRoleBadgeColor(role: Role): string {
    if (role.type === 'zopa') return '#7c3aed';
    return '#15803d';
  }

  openDialog(role?: Role) {
    if (role) {
      this.editingRole.set(role);
      this.roleForm.patchValue(role);
      this.roleForm.get('slug')?.disable();
    } else {
      this.editingRole.set(null);
      this.roleForm.reset({ type: 'client' });
      this.roleForm.get('slug')?.enable();
    }

    this.dialog.open(this.roleDialogTemplate, { width: '460px' });
  }

  saveRole() {
    if (this.roleForm.invalid) return;

    this.saving.set(true);
    const roleData = this.roleForm.getRawValue();
    const editing = this.editingRole();

    const req$ = editing
      ? this.roleService.updateRole(editing.slug, roleData)
      : this.roleService.createRole(roleData);

    req$.subscribe({
      next: () => {
        this.notify.success(`Role ${editing ? 'updated' : 'created'} successfully`);
        this.saving.set(false);
        this.dialog.closeAll();
        this.loadRoles();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.notify.error(err.error?.message || 'Error saving role');
      }
    });
  }

  deleteRole(slug: string) {
    if (confirm('Are you sure you want to delete this role? All users with this role will lose their permissions.')) {
      this.roleService.deleteRole(slug).subscribe({
        next: () => {
          this.notify.success('Role deleted');
          this.loadRoles();
        },
        error: (err: any) => this.notify.error(err.error?.message || 'Failed to delete role')
      });
    }
  }
}
