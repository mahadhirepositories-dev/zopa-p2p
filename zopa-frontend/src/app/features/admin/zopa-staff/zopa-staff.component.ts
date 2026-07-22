import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService } from '../services/admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService, Role } from '../../../services/role.service';

@Component({
  selector: 'app-zopa-staff',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>ZOPA Staff</h2>
          <p>{{ staff().length }} internal user{{ staff().length !== 1 ? 's' : '' }}</p>
        </div>
        <button mat-raised-button color="primary" (click)="openDialog()" class="cta-btn">
          <mat-icon>person_add</mat-icon> Add Staff
        </button>
      </div>

      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:60px;">
          <mat-spinner diameter="36" />
        </div>
      } @else if (staff().length === 0) {
        <mat-card>
          <mat-card-content>
            <div class="empty-state">
              <mat-icon>group</mat-icon>
              <h3>No ZOPA staff yet</h3>
              <p>Add internal team members who will manage client accounts.</p>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        <div class="staff-grid">
          @for (s of staff(); track s.id) {
            <mat-card class="staff-card">
              <div class="staff-row">
                <div class="staff-avatar">{{ s.name?.[0]?.toUpperCase() }}</div>
                <div class="staff-info">
                  <div class="staff-name">{{ s.name }}</div>
                  <div class="staff-email">{{ s.email }}</div>
                </div>
                <div class="staff-right">
                  @if (s.zopa_role) {
                    <span class="role-pill role-{{ s.zopa_role }}">
                      {{ getRoleName(s.zopa_role) }}
                    </span>
                  }
                  @if (!isSelf(s.id)) {
                    <button mat-icon-button color="warn" title="Deactivate"
                            (click)="deactivate(s)" [disabled]="deactivating() === s.id">
                      @if (deactivating() === s.id) {
                        <mat-spinner diameter="16" />
                      } @else {
                        <mat-icon style="font-size:18px;">person_off</mat-icon>
                      }
                    </button>
                  }
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>

    @if (showDialog()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <mat-card class="modal-card" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-head">
              <div class="modal-icon"><mat-icon>person_add</mat-icon></div>
              <div>
                <mat-card-title>Add ZOPA Staff</mat-card-title>
                <p class="modal-sub">New user will be enrolled in the ZOPA internal org</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="form" class="modal-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Full Name *</mat-label>
                <input matInput formControlName="name" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email *</mat-label>
                <input matInput formControlName="email" type="email" />
                @if (form.get('email')?.errors?.['email'] && form.get('email')?.touched) {
                  <mat-error>Invalid email address</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Password *</mat-label>
                <input matInput formControlName="password" type="password" />
                @if (form.get('password')?.errors?.['minlength'] && form.get('password')?.touched) {
                  <mat-error>At least 8 characters</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Role *</mat-label>
                <mat-select formControlName="role">
                  @for (role of zopaRoles(); track role.slug) {
                    <mat-option [value]="role.slug">{{ role.name }}</mat-option>
                  }
                </mat-select>
                <mat-hint>Role within the ZOPA internal org</mat-hint>
              </mat-form-field>
            </form>
            @if (saveError()) {
              <div class="save-error">
                <mat-icon>error_outline</mat-icon>
                {{ saveError() }}
              </div>
            }
          </mat-card-content>
          <mat-card-actions style="padding:0 20px 20px;display:flex;gap:8px;justify-content:flex-end;">
            <button mat-button (click)="closeDialog()">Cancel</button>
            <button mat-raised-button color="primary"
                    [disabled]="form.invalid || saving()"
                    (click)="save()">
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Create Staff }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .cta-btn { height:40px!important; }

    .staff-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px; }

    .staff-card { padding:0!important; }
    .staff-row { display:flex;align-items:center;gap:14px;padding:16px; }
    .staff-avatar {
      width:44px;height:44px;border-radius:12px;flex-shrink:0;
      background:linear-gradient(135deg,var(--brand),var(--brand-hover));
      color:white;font-size:18px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
    }
    .staff-info { flex:1;min-width:0; }
    .staff-name  { font-size:14px;font-weight:600;color:var(--text-1); }
    .staff-email { font-size:11px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .staff-right { display:flex;align-items:center;gap:6px; }

    .role-pill {
      padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;
      background:#f1f5f9;color:#475569;
    }
    .role-pill.role-zopa_super_admin { background:#fef3c7;color:#b45309; }
    .role-pill.role-zopa_buyer       { background:#dbeafe;color:#2563eb; }
    .role-pill.role-zopa_pr          { background:#e0f2fe;color:#0ea5e9; }
    .role-pill.role-zopa_grn         { background:#e0f2fe;color:#0ea5e9; }
    .role-pill.role-zopa_approver_l1 { background:#dcfce7;color:#16a34a; }
    .role-pill.role-zopa_approver_l2 { background:#f5f3ff;color:#7c3aed; }
    .role-pill.role-zopa_approver_l3 { background:#fff1f2;color:#dc2626; }

    .empty-state {
      display:flex;flex-direction:column;align-items:center;
      gap:8px;padding:60px 24px;text-align:center;
    }
    .empty-state mat-icon { font-size:48px;width:48px;height:48px;color:var(--border); }
    .empty-state h3 { margin:0;font-size:16px;font-weight:600;color:var(--text-2); }
    .empty-state p  { margin:0;font-size:13px;color:var(--text-3); }

    /* Modal */
    .modal-overlay {
      position:fixed;inset:0;
      background:rgba(15,23,42,0.45);
      z-index:9999;
      display:flex;align-items:center;justify-content:center;
      backdrop-filter:blur(2px);
    }
    .modal-card { width:460px;max-width:90vw; }
    .modal-head { display:flex;align-items:center;gap:12px; }
    .modal-icon {
      width:40px;height:40px;border-radius:10px;
      background:var(--brand-light);
      display:flex;align-items:center;justify-content:center;
    }
    .modal-icon mat-icon { color:var(--brand); }
    .modal-sub { margin:4px 0 0;font-size:12px;color:var(--text-3); }
    .modal-form { display:flex;flex-direction:column;gap:8px; }
    .full-width { width:100%; }
    .save-error {
      display:flex;align-items:center;gap:8px;
      background:#fff1f2;border:1px solid #fecdd3;
      color:#e11d48;padding:10px 14px;border-radius:8px;font-size:13px;
      margin-top:12px;
    }
    .save-error mat-icon { font-size:16px;width:16px;height:16px; }
  `],
})
export class ZopaStaffComponent implements OnInit {
  private adminService = inject(AdminService);
  private notify = inject(NotificationService);
  private fb = inject(FormBuilder);
  private roleService = inject(RoleService);

  staff = signal<any[]>([]);
  zopaRoles = signal<Role[]>([]);
  
  loading = signal(true);
  showDialog = signal(false);
  saving = signal(false);
  saveError = signal('');
  deactivating = signal<number | null>(null);

  // Current user id — to prevent self-deactivation
  private currentUserId = signal<number | null>(null);

  form: FormGroup = this.fb.group({
    name:     ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role:     ['', Validators.required],
  });

  ngOnInit() {
    this.loadStaff();
  }

  loadStaff() {
    this.loading.set(true);
    this.adminService.getZopaStaff().subscribe({
      next: data => { 
        this.staff.set(data); 
        
        this.roleService.getRoles().subscribe({
          next: roles => {
            this.zopaRoles.set(roles.filter(r => r.type === 'zopa'));
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false),
    });
  }

  getRoleName(slug: string): string {
    const roles = this.zopaRoles();
    const role = roles.find(r => r.slug === slug);
    if (role) return role.name;
    
    return slug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  isSelf(userId: number): boolean {
    return this.currentUserId() === userId;
  }

  openDialog() {
    this.form.reset({ role: '' });
    this.saveError.set('');
    this.showDialog.set(true);
  }

  closeDialog() { this.showDialog.set(false); }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saveError.set('');
    this.adminService.createZopaStaff(this.form.value).subscribe({
      next: member => {
        this.staff.update(list => [...list, member]);
        this.notify.success(`${member.name} added as ZOPA staff.`);
        this.closeDialog();
        this.saving.set(false);
      },
      error: err => {
        this.saveError.set(err?.error?.message || 'Failed to create staff member.');
        this.saving.set(false);
      },
    });
  }

  deactivate(s: any) {
    if (!confirm(`Deactivate ${s.name}? They will lose access to all tenants.`)) return;
    this.deactivating.set(s.id);
    this.adminService.deactivateZopaStaff(s.id).subscribe({
      next: () => {
        this.staff.update(list => list.filter(m => m.id !== s.id));
        this.notify.success(`${s.name} deactivated.`);
        this.deactivating.set(null);
      },
      error: () => {
        this.notify.error('Failed to deactivate.');
        this.deactivating.set(null);
      },
    });
  }
}
