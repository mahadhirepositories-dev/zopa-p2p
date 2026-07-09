import { Component, OnInit, inject, signal, input, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AdminService, Tenant, UserTenantRole } from '../services/admin.service';
import { AuthService } from '../../../core/auth/auth.service';
import { gstinValidator } from '../../../core/validators';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDividerModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule, MatSlideToggleModule,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Back + page header -->
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/admin/clients">
            <mat-icon>arrow_back</mat-icon>
          </button>
          @if (loading()) {
            <mat-spinner diameter="24" />
          } @else if (client()) {
            <div class="client-title-block">
              <!-- Logo / Avatar -->
              <div class="client-avatar-wrap">
                @if (client()!.logo_url) {
                  <img [src]="client()!.logo_url" class="client-logo" alt="logo" />
                } @else {
                  <div class="client-avatar">{{ client()!.name?.[0] }}</div>
                }
                <button mat-icon-button class="logo-upload-btn" matTooltip="Change logo"
                        (click)="logoInput.click()" [disabled]="uploadingLogo()">
                  @if (uploadingLogo()) { <mat-spinner diameter="16" /> }
                  @else { <mat-icon style="font-size:14px;">photo_camera</mat-icon> }
                </button>
                <input #logoInput type="file" accept="image/*" style="display:none"
                       (change)="onLogoUpload($event)" />
              </div>
              <div>
                <h2>{{ client()!.name }}</h2>
                <div class="client-meta">
                  <span class="code-tag">{{ client()!.code }}</span>
                  @if (client()!.gstin) {
                    <span class="gstin-tag">GSTIN: {{ client()!.gstin }}</span>
                  }
                  <mat-chip [highlighted]="true"
                    [class]="client()!.is_active ? 'status-approved' : 'status-rejected'">
                    {{ client()!.is_active ? 'Active' : 'Inactive' }}
                  </mat-chip>
                </div>
              </div>
            </div>
          }
        </div>

        @if (client()) {
          <div style="display:flex;gap:10px;align-items:center;">
            <button mat-stroked-button (click)="openEditDialog()">
              <mat-icon>edit</mat-icon> Edit Client
            </button>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="40" />
          <span>Loading client details…</span>
        </div>
      } @else if (loadError()) {
        <div class="error-card">
          <mat-icon>error_outline</mat-icon>
          <p>{{ loadError() }}</p>
          <button mat-stroked-button (click)="loadClientData(+id())">Retry</button>
        </div>
      } @else if (client()) {

        <!-- Info cards row -->
        <div class="info-grid">
          <div class="info-chip">
            <mat-icon>receipt_long</mat-icon>
            <span>PO Prefix: <strong>{{ client()!.po_prefix || '—' }}</strong></span>
          </div>
          <div class="info-chip">
            <mat-icon>receipt_long</mat-icon>
            <span>PO Series: <strong>{{ client()!.po_starting_series || '—' }}</strong></span>
          </div>
          <div class="info-chip">
            <mat-icon>request_quote</mat-icon>
            <span>PR Prefix: <strong>{{ client()!.pr_prefix || '—' }}</strong></span>
          </div>
          <div class="info-chip">
            <mat-icon>request_quote</mat-icon>
            <span>PR Series: <strong>{{ client()!.pr_starting_series || '—' }}</strong></span>
          </div>
          <div class="info-chip">
            <mat-icon>inventory_2</mat-icon>
            <span>Product Prefix: <strong>{{ client()!.product_prefix || '—' }}</strong></span>
          </div>
          <div class="info-chip">
            <mat-icon>calendar_today</mat-icon>
            <span>Fiscal Year Start: <strong>{{ getMonthName(client()!.fiscal_year_start) }}</strong></span>
          </div>
          <div class="info-chip">
            <mat-icon>group</mat-icon>
            <span>Total Users: <strong>{{ allUsers().length }}</strong></span>
          </div>
        </div>

        <div class="detail-grid">

          <!-- Client Users panel -->
          <mat-card class="user-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="vertical-align:middle;margin-right:6px;color:var(--brand);">people</mat-icon>
                Client Users
              </mat-card-title>
              <div style="flex:1"></div>
              <button mat-stroked-button color="primary" (click)="openCreateUserDialog()"
                      style="height:32px;font-size:12px;">
                <mat-icon>person_add</mat-icon> Add User
              </button>
            </mat-card-header>
            <mat-card-content style="padding:0!important;">
              @if (clientUsers().length === 0) {
                <div class="empty-panel">
                  <mat-icon>person_off</mat-icon>
                  <p>No client users yet</p>
                </div>
              } @else {
                <table mat-table [dataSource]="clientUsers()" class="full-width">
                  <ng-container matColumnDef="user">
                    <th mat-header-cell *matHeaderCellDef>User</th>
                    <td mat-cell *matCellDef="let rel">
                      <div class="user-row-cell">
                        <div class="user-chip">{{ rel.user?.name?.[0] }}</div>
                        <div>
                          <div class="user-cell-name">{{ rel.user?.name }}</div>
                          <div class="user-cell-email">{{ rel.user?.email }}</div>
                        </div>
                      </div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let rel">
                      <span class="role-chip">{{ roleLabel(rel.role) }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let rel" style="text-align:right;">
                      <button mat-icon-button matTooltip="Edit role" (click)="openEditRoleDialog(rel)">
                        <mat-icon style="font-size:16px;">edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" matTooltip="Remove user" (click)="removeAssignment(rel)">
                        <mat-icon style="font-size:16px;">person_off</mat-icon>
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="clientColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: clientColumns;"></tr>
                </table>
              }
            </mat-card-content>
          </mat-card>

          <!-- ZOPA Staff panel -->
          <mat-card class="user-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon style="vertical-align:middle;margin-right:6px;color:#7c3aed;">verified_user</mat-icon>
                ZOPA Staff Assigned
              </mat-card-title>
              <div style="flex:1"></div>
              <button mat-stroked-button (click)="openAssignStaffDialog()"
                      style="height:32px;font-size:12px;">
                <mat-icon>add</mat-icon> Assign
              </button>
            </mat-card-header>
            <mat-card-content style="padding:0!important;">
              @if (zopaStaff().length === 0) {
                <div class="empty-panel">
                  <mat-icon>group_off</mat-icon>
                  <p>No ZOPA staff assigned</p>
                </div>
              } @else {
                <table mat-table [dataSource]="zopaStaff()" class="full-width">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Staff Member</th>
                    <td mat-cell *matCellDef="let rel">
                      <div class="user-row-cell">
                        <div class="user-chip zopa">{{ rel.user?.name?.[0] }}</div>
                        <span>{{ rel.user?.name }}</span>
                      </div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let rel">
                      <span class="role-chip zopa">{{ roleLabel(rel.role) }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let rel" style="text-align:right;">
                      <button mat-icon-button color="warn" matTooltip="Remove" (click)="removeAssignment(rel)">
                        <mat-icon style="font-size:16px;">delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="zopaColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: zopaColumns;"></tr>
                </table>
              }
            </mat-card-content>
          </mat-card>

        </div>
      }
    </div>

    <!-- ── Assign ZOPA Staff modal ──────────────────────── -->
    @if (showAssignDialog()) {
      <div class="modal-overlay" (click)="showAssignDialog.set(false)">
        <mat-card class="modal-card" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-head">
              <div class="modal-icon" style="background:#f3e8ff;">
                <mat-icon style="color:#7c3aed;">verified_user</mat-icon>
              </div>
              <div>
                <mat-card-title>Assign ZOPA Staff</mat-card-title>
                <p class="modal-sub">Grant a ZOPA team member access to this client</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="assignForm" class="modal-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Staff Member</mat-label>
                <mat-select formControlName="user_id">
                  @for (staff of availableStaff(); track staff.id) {
                    <mat-option [value]="staff.id">{{ staff.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Role for this Client</mat-label>
                <mat-select formControlName="role">
                  <mat-option value="zopa_buyer">ZOPA Buyer</mat-option>
                  <mat-option value="zopa_approver_l1">ZOPA L1 Approver</mat-option>
                  <mat-option value="zopa_approver_l2">ZOPA L2 Approver</mat-option>
                  @if (client()?.is_internal) {
                    <mat-option value="zopa_approver_l3">ZOPA L3 Approver</mat-option>
                  }
                </mat-select>
                <mat-hint>Defines the staff member's role within this specific client org</mat-hint>
              </mat-form-field>
            </form>
          </mat-card-content>
          <mat-card-actions style="padding:0 20px 20px;display:flex;gap:8px;justify-content:flex-end;">
            <button mat-button (click)="showAssignDialog.set(false)">Cancel</button>
            <button mat-raised-button color="primary"
                    [disabled]="assignForm.invalid || saving()"
                    (click)="onAssignStaff()">
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Assign }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }

    <!-- ── Add Client User modal ────────────────────────── -->
    @if (showCreateUserDialog()) {
      <div class="modal-overlay" (click)="showCreateUserDialog.set(false)">
        <mat-card class="modal-card" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-head">
              <div class="modal-icon" style="background:var(--brand-light);">
                <mat-icon style="color:var(--brand);">person_add</mat-icon>
              </div>
              <div>
                <mat-card-title>Add Client User</mat-card-title>
                <p class="modal-sub">Create a new user for {{ client()?.name }}</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="createUserForm" class="modal-form">
              <div class="form-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Full Name *</mat-label>
                  <input matInput formControlName="name" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Role *</mat-label>
                  <mat-select formControlName="role">
                    <mat-option value="client_admin">Admin</mat-option>
                    <mat-option value="client_buyer">Buyer</mat-option>
                    <mat-option value="client_approver_l1">L1 Approver</mat-option>
                    <mat-option value="client_approver_l2">L2 Approver</mat-option>
                    <mat-option value="client_approver_l3">L3 Approver</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email *</mat-label>
                <input matInput formControlName="email" type="email" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Password *</mat-label>
                <input matInput formControlName="password" type="password" />
                <mat-hint>Minimum 8 characters</mat-hint>
              </mat-form-field>
            </form>
            @if (saveError()) {
              <div class="save-error">
                <mat-icon>error_outline</mat-icon> {{ saveError() }}
              </div>
            }
          </mat-card-content>
          <mat-card-actions style="padding:0 20px 20px;display:flex;gap:8px;justify-content:flex-end;">
            <button mat-button (click)="showCreateUserDialog.set(false)">Cancel</button>
            <button mat-raised-button color="primary"
                    [disabled]="createUserForm.invalid || saving()"
                    (click)="onCreateUser()">
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Create User }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }

    <!-- ── Edit Client modal ────────────────────────────── -->
    @if (showEditDialog()) {
      <div class="modal-overlay" (click)="showEditDialog.set(false)">
        <mat-card class="modal-card" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-head">
              <div class="modal-icon" style="background:#f0fdf4;">
                <mat-icon style="color:#16a34a;">edit</mat-icon>
              </div>
              <div>
                <mat-card-title>Edit Client</mat-card-title>
                <p class="modal-sub">Update {{ client()?.name }} details</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="editForm" class="modal-form">
              <div class="form-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Client Code *</mat-label>
                  <input matInput formControlName="code" />
                </mat-form-field>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>PO Prefix</mat-label>
                  <input matInput formControlName="po_prefix" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>PO Starting Series</mat-label>
                  <input matInput type="number" formControlName="po_starting_series" />
                </mat-form-field>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>PR Prefix</mat-label>
                  <input matInput formControlName="pr_prefix" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>PR Starting Series</mat-label>
                  <input matInput type="number" formControlName="pr_starting_series" />
                </mat-form-field>
              </div>
              <div class="form-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Product Prefix</mat-label>
                  <input matInput formControlName="product_prefix" placeholder="e.g. PRD-" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Product Series Start</mat-label>
                  <input matInput type="number" formControlName="product_series" />
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Company Name *</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>GSTIN</mat-label>
                <input matInput formControlName="gstin" style="text-transform:uppercase" />
                @if (editForm.get('gstin')?.errors?.['gstin'] && editForm.get('gstin')?.touched) {
                  <mat-error>Invalid GSTIN format</mat-error>
                }
              </mat-form-field>
              
              <div style="margin-bottom: 12px; display:flex; align-items:center; gap: 12px;">
                <button mat-stroked-button type="button" (click)="logoEditUpload.click()">
                  <mat-icon>image</mat-icon> Select Logo
                </button>
                <span style="font-size:12px; color:var(--text-3);">
                  {{ selectedFileName() || 'No file chosen (Optional)' }}
                </span>
                <input #logoEditUpload type="file" accept="image/*" style="display:none" (change)="onFileSelected($event)" />
              </div>

              <div class="internal-toggle-row">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text-1);">ZOPA Internal Org</div>
                  <div style="font-size:12px;color:var(--text-3);margin-top:2px;">ZOPA staff can be assigned L3 approver role for internal orgs</div>
                </div>
                <mat-slide-toggle formControlName="is_internal" color="primary" />
              </div>
            </form>
          </mat-card-content>
          <mat-card-actions style="padding:0 20px 20px;display:flex;gap:8px;justify-content:flex-end;">
            <button mat-button (click)="showEditDialog.set(false)">Cancel</button>
            <button mat-raised-button color="primary"
                    [disabled]="editForm.invalid || saving()"
                    (click)="onEditClient()">
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Changes }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }

    <!-- ── Edit Role modal ──────────────────────────────── -->
    @if (showEditRoleDialog()) {
      <div class="modal-overlay" (click)="showEditRoleDialog.set(false)">
        <mat-card class="modal-card" style="width:380px;" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-head">
              <div class="modal-icon" style="background:#fff7ed;">
                <mat-icon style="color:var(--brand);">manage_accounts</mat-icon>
              </div>
              <div>
                <mat-card-title>Change Role</mat-card-title>
                <p class="modal-sub">{{ editingRel()?.user?.name }}</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="editRoleForm" class="modal-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Role</mat-label>
                <mat-select formControlName="role">
                  <mat-option value="client_admin">Client Admin</mat-option>
                  <mat-option value="client_buyer">Client Buyer</mat-option>
                  <mat-option value="client_approver_l1">L1 Approver</mat-option>
                  <mat-option value="client_approver_l2">L2 Approver</mat-option>
                  <mat-option value="client_approver_l3">L3 Approver (Final)</mat-option>
                </mat-select>
              </mat-form-field>
            </form>
            @if (saveError()) {
              <div class="save-error">
                <mat-icon>error_outline</mat-icon> {{ saveError() }}
              </div>
            }
          </mat-card-content>
          <mat-card-actions style="padding:0 20px 20px;display:flex;gap:8px;justify-content:flex-end;">
            <button mat-button (click)="showEditRoleDialog.set(false)">Cancel</button>
            <button mat-raised-button color="primary"
                    [disabled]="editRoleForm.invalid || saving()"
                    (click)="onSaveRole()">
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Role }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .client-title-block { display:flex; align-items:center; gap:12px; }
    .client-avatar-wrap { position:relative; flex-shrink:0; }
    .client-avatar {
      width:52px; height:52px; border-radius:12px;
      background:linear-gradient(135deg,var(--brand),var(--brand-hover));
      color:white; font-size:22px; font-weight:800;
      display:flex; align-items:center; justify-content:center;
    }
    .client-logo {
      width:52px; height:52px; border-radius:12px;
      object-fit:contain; border:1px solid var(--border); background:#fff;
    }
    .logo-upload-btn {
      position:absolute; bottom:-6px; right:-6px;
      width:22px!important; height:22px!important;
      background:white!important; border:1px solid var(--border)!important;
      border-radius:50%!important; box-shadow:0 1px 4px rgba(0,0,0,.15);
      display:inline-flex!important; align-items:center!important; justify-content:center!important;
    }
    .logo-upload-btn .mat-icon {
      font-size:13px!important; width:13px!important; height:13px!important; line-height:13px!important;
    }
    h2 { margin:0; font-size:20px; font-weight:700; }
    .client-meta { display:flex; align-items:center; gap:8px; margin-top:4px; flex-wrap:wrap; }
    .code-tag {
      background:#f1f5f9; color:var(--text-2);
      font-family:monospace; font-size:11px; font-weight:700;
      padding:2px 8px; border-radius:5px;
    }
    .gstin-tag {
      background:#eff6ff; color:#2563eb;
      font-family:monospace; font-size:11px; font-weight:600;
      padding:2px 8px; border-radius:5px;
    }

    .raise-po-btn { height:40px!important; font-weight:700!important; }

    .loading-state {
      display:flex; flex-direction:column; align-items:center;
      gap:16px; padding:80px; color:var(--text-3);
    }
    .error-card {
      background:var(--surface); border:1px solid var(--border);
      border-radius:14px; padding:48px;
      display:flex; flex-direction:column; align-items:center;
      gap:12px; color:var(--text-3); text-align:center;
    }
    .error-card mat-icon { font-size:40px; width:40px; height:40px; color:#dc2626; }

    .info-grid {
      display:flex; gap:10px; flex-wrap:wrap;
      margin-bottom:20px;
    }
    .info-chip {
      display:flex; align-items:center; gap:6px;
      background:var(--surface); border:1px solid var(--border);
      border-radius:8px; padding:8px 14px;
      font-size:13px; color:var(--text-2);
    }
    .info-chip mat-icon { font-size:15px; width:15px; height:15px; color:var(--brand); }
    .info-chip strong { color:var(--text-1); }

    .detail-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:20px;
    }
    @media (max-width:900px) { .detail-grid { grid-template-columns:1fr; } }

    .user-card mat-card-header {
      display:flex; align-items:center; gap:0;
      padding:16px 20px 0 !important;
    }

    .user-row-cell { display:flex; align-items:center; gap:10px; }
    .user-chip {
      width:30px; height:30px; border-radius:8px;
      background:var(--brand-light); color:var(--brand);
      font-size:12px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
    }
    .user-chip.zopa {
      background:#f3e8ff; color:#7c3aed;
    }
    .user-cell-name { font-size:13px; font-weight:600; color:var(--text-1); }
    .user-cell-email { font-size:11px; color:var(--text-3); }

    .role-chip {
      display:inline-block;
      background:#f1f5f9; color:var(--text-2);
      font-size:11px; font-weight:600;
      padding:3px 9px; border-radius:6px;
    }
    .role-chip.zopa { background:#f3e8ff; color:#7c3aed; }

    .empty-panel {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:32px 24px; color:var(--text-3); text-align:center;
    }
    .empty-panel mat-icon { font-size:32px; width:32px; height:32px; color:var(--border); }
    .empty-panel p { margin:0; font-size:13px; }

    .full-width { width:100%; }

    /* Modals */
    .modal-overlay {
      position:fixed; inset:0;
      background:rgba(15,23,42,0.45);
      z-index:1000;
      display:flex; align-items:center; justify-content:center;
      backdrop-filter:blur(2px);
    }
    .modal-card { width:500px; max-width:92vw; }
    .modal-head { display:flex; align-items:center; gap:12px; }
    .modal-icon {
      width:40px; height:40px; border-radius:10px;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
    }
    .modal-sub { margin:4px 0 0; font-size:12px; color:var(--text-3); }
    .modal-form { display:flex; flex-direction:column; gap:14px; }
    .form-row { display:flex; gap:12px; }

    .save-error {
      display:flex; align-items:center; gap:8px;
      background:#fff1f2; border:1px solid #fecdd3;
      color:#e11d48; padding:10px 14px;
      border-radius:8px; font-size:13px; margin-top:8px;
    }
    .save-error mat-icon { font-size:16px; width:16px; height:16px; }
    .internal-toggle-row {
      display:flex; align-items:center; justify-content:space-between;
      background:#f8f9fa; border:1px solid var(--border);
      border-radius:8px; padding:12px 14px;
    }
  `],
})
export class ClientDetailComponent implements OnInit {
  id = input.required<string>();

  getMonthName(monthNum: number | string | null | undefined): string {
    if (!monthNum) return '—';
    const num = +monthNum;
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[num - 1] || '—';
  }

  private adminService = inject(AdminService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  client = signal<Tenant | null>(null);
  allUsers = signal<UserTenantRole[]>([]);
  zopaStaff = signal<UserTenantRole[]>([]);
  clientUsers = signal<UserTenantRole[]>([]);
  availableStaff = signal<any[]>([]);

  loading = signal(true);
  loadError = signal('');
  saving = signal(false);
  saveError = signal('');
  uploadingLogo = signal(false);

  showAssignDialog     = signal(false);
  showCreateUserDialog = signal(false);
  showEditDialog       = signal(false);
  showEditRoleDialog   = signal(false);
  editingRel           = signal<UserTenantRole | null>(null);

  zopaColumns   = ['name', 'role', 'actions'];
  clientColumns = ['user', 'role', 'actions'];

  assignForm: FormGroup = this.fb.group({
    user_id: ['', Validators.required],
    role:    ['zopa_buyer', Validators.required],
  });

  createUserForm: FormGroup = this.fb.group({
    name:     ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role:     ['client_buyer', Validators.required],
  });

  editForm: FormGroup = this.fb.group({
    code:               ['', Validators.required],
    name:               ['', Validators.required],
    gstin:              ['', gstinValidator()],
    po_prefix:          [''],
    po_starting_series: [null],
    pr_prefix:          [''],
    pr_starting_series: [null],
    product_prefix:     [''],
    product_series:     [1],
    is_internal:        [false],
  });

  editRoleForm: FormGroup = this.fb.group({
    role: ['', Validators.required],
  });

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      zopa_super_admin: 'Super Admin',
      zopa_buyer: 'ZOPA Buyer',
      zopa_approver_l1: 'ZOPA L1 Approver',
      zopa_approver_l2: 'ZOPA L2 Approver',
      zopa_approver_l3: 'ZOPA L3 Approver',
      client_admin: 'Admin',
      client_buyer: 'Buyer',
      client_approver_l1: 'L1 Approver',
      client_approver_l2: 'L2 Approver',
      client_approver_l3: 'L3 Approver',
    };
    return map[role] ?? role;
  }

  ngOnInit() { this.loadClientData(+this.id()); }

  loadClientData(id: number) {
    this.loading.set(true);
    this.loadError.set('');

    this.adminService.getClient(id).subscribe({
      next: c => {
        this.client.set(c);
        this.editForm.patchValue({ 
          code: c.code, 
          name: c.name, 
          gstin: c.gstin, 
          po_prefix: c.po_prefix, 
          po_starting_series: c.po_starting_series,
          pr_prefix: c.pr_prefix,
          pr_starting_series: c.pr_starting_series,
          product_prefix: c.product_prefix ?? '',
          product_series: c.product_series ?? 1,
          is_internal: c.is_internal 
        });
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load client details. The client may not exist.');
        this.loading.set(false);
      },
    });

    this.adminService.getClientUsers(id).subscribe({
      next: users => {
        this.allUsers.set(users);
        this.zopaStaff.set(users.filter(u => u.role.startsWith('zopa_')));
        this.clientUsers.set(users.filter(u => u.role.startsWith('client_')));
      },
    });
  }


  openAssignStaffDialog() {
    this.assignForm.reset({ role: 'zopa_buyer' });
    const clientId = this.client()?.id;
    this.adminService.getZopaStaff(clientId).subscribe({
      next: staff => {
        // Remove staff already assigned with the same role to prevent duplicates
        const alreadyAssigned = new Set(this.zopaStaff().map(z => z.user_id));
        this.availableStaff.set(staff.filter((s: any) => !alreadyAssigned.has(s.id)));
        this.showAssignDialog.set(true);
      },
      error: () => this.showAssignDialog.set(true),
    });
  }

  onAssignStaff() {
    const c = this.client();
    if (this.assignForm.invalid || !c) return;
    this.saving.set(true);
    this.adminService.assignZopaStaff(c.id, this.assignForm.value).subscribe({
      next: rel => {
        this.allUsers.update(l => [...l, rel]);
        this.zopaStaff.update(l => [...l, rel]);
        this.showAssignDialog.set(false);
        this.saving.set(false);
      },
      error: err => { alert(err.error?.message || 'Error assigning staff'); this.saving.set(false); },
    });
  }

  openCreateUserDialog() {
    this.createUserForm.reset({ role: 'client_buyer' });
    this.saveError.set('');
    this.showCreateUserDialog.set(true);
  }

  onCreateUser() {
    const c = this.client();
    if (this.createUserForm.invalid || !c) return;
    this.saving.set(true);
    this.saveError.set('');
    this.adminService.createClientUser(c.id, this.createUserForm.value).subscribe({
      next: rel => {
        this.allUsers.update(l => [...l, rel]);
        this.clientUsers.update(l => [...l, rel]);
        this.showCreateUserDialog.set(false);
        this.saving.set(false);
      },
      error: err => { this.saveError.set(err.error?.message || 'Failed to create user'); this.saving.set(false); },
    });
  }

  logoFile = signal<File | null>(null);
  selectedFileName = signal('');

  openEditDialog() {
    this.saveError.set('');
    this.logoFile.set(null);
    this.selectedFileName.set('');
    this.showEditDialog.set(true);
  }
  
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.logoFile.set(input.files[0]);
      this.selectedFileName.set(input.files[0].name);
    }
  }

  onEditClient() {
    const c = this.client();
    if (this.editForm.invalid || !c) return;
    this.saving.set(true);
    this.adminService.updateClient(c.id, this.editForm.value).subscribe({
      next: updated => {
        const file = this.logoFile();
        if (file) {
          this.adminService.uploadLogo(updated.id, file).subscribe({
            next: (withLogo) => {
              this.client.set(withLogo);
              this.showEditDialog.set(false);
              this.saving.set(false);
            },
            error: err => {
              this.saveError.set(err.error?.message || 'Updated details, but logo upload failed.');
              this.saving.set(false);
            }
          });
        } else {
          this.client.set(updated);
          this.showEditDialog.set(false);
          this.saving.set(false);
        }
      },
      error: err => { this.saveError.set(err.error?.message || 'Failed to update'); this.saving.set(false); },
    });
  }

  removeAssignment(rel: UserTenantRole) {
    const c = this.client();
    if (!c) return;
    this.adminService.removeUserAssignment(c.id, rel.user_id, rel.id).subscribe({
      next: () => {
        this.allUsers.update(l => l.filter(u => u.id !== rel.id));
        this.zopaStaff.update(l => l.filter(u => u.id !== rel.id));
        this.clientUsers.update(l => l.filter(u => u.id !== rel.id));
      },
      error: err => alert('Error removing assignment: ' + (err.error?.message || '')),
    });
  }

  onLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const c = this.client();
    if (!file || !c) return;
    this.uploadingLogo.set(true);
    this.adminService.uploadLogo(c.id, file).subscribe({
      next: updated => { this.client.set(updated); this.uploadingLogo.set(false); input.value = ''; },
      error: () => { this.uploadingLogo.set(false); input.value = ''; },
    });
  }

  openEditRoleDialog(rel: UserTenantRole) {
    this.editingRel.set(rel);
    this.editRoleForm.setValue({ role: rel.role });
    this.saveError.set('');
    this.showEditRoleDialog.set(true);
  }

  onSaveRole() {
    const c = this.client();
    const rel = this.editingRel();
    if (this.editRoleForm.invalid || !c || !rel) return;
    const newRole = this.editRoleForm.value.role;
    if (newRole === rel.role) { this.showEditRoleDialog.set(false); return; }
    this.saving.set(true);
    this.saveError.set('');
    this.adminService.updateUserRole(c.id, rel.user_id, rel.id, newRole).subscribe({
      next: updated => {
        this.allUsers.update(l => l.map(u => u.id === rel.id ? updated : u));
        this.clientUsers.update(l => l.map(u => u.id === rel.id ? updated : u));
        this.showEditRoleDialog.set(false);
        this.saving.set(false);
      },
      error: err => {
        this.saveError.set(err.error?.message || 'Failed to update role');
        this.saving.set(false);
      },
    });
  }
}
