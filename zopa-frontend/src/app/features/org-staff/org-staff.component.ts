import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { RoleService, Role } from '../../services/role.service';

interface StaffMember {
  id: number;
  utr_id: number;
  name: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-org-staff',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatCardModule, MatChipsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>Staff Management</h2>
          <p>{{ allUsers().length }} user{{ allUsers().length !== 1 ? 's' : '' }} in your organisation</p>
        </div>
        @if (isAdmin()) {
          <button mat-raised-button color="primary" (click)="openDialog()" class="cta-btn">
            <mat-icon>person_add</mat-icon> Add Staff
          </button>
        }
      </div>

      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:60px;">
          <mat-spinner diameter="36" />
        </div>
      } @else {

        <!-- ZOPA Assigned Staff section -->
        <div class="section-header">
          <div class="section-icon zopa-icon"><mat-icon>verified_user</mat-icon></div>
          <div>
            <div class="section-title">ZOPA Assigned Staff</div>
            <div class="section-sub">ZOPA team members managing your account</div>
          </div>
          <span class="count-badge">{{ zopaStaff().length }}</span>
        </div>

        @if (zopaStaff().length === 0) {
          <div class="empty-band">
            <mat-icon>info_outline</mat-icon>
            No ZOPA staff assigned to your account yet.
          </div>
        } @else {
          <div class="staff-grid" style="margin-bottom:32px;">
            @for (s of zopaStaff(); track s.id) {
              <div class="staff-card zopa-card">
                <div class="staff-avatar zopa-avatar">{{ s.name?.[0]?.toUpperCase() }}</div>
                <div class="staff-info">
                  <div class="staff-name">{{ s.name }}</div>
                  <div class="staff-email">{{ s.email }}</div>
                </div>
                <span class="role-pill role-zopa-{{ roleKey(s.role) }}">
                  {{ getRoleName(s.role) }}
                </span>
              </div>
            }
          </div>
        }

        <mat-divider style="margin-bottom:28px;" />

        <!-- Client's Own Staff section -->
        <div class="section-header">
          <div class="section-icon org-icon"><mat-icon>business</mat-icon></div>
          <div>
            <div class="section-title">Your Organisation Staff</div>
            <div class="section-sub">Team members in your company</div>
          </div>
          <span class="count-badge">{{ ownStaff().length }}</span>
        </div>

        @if (ownStaff().length === 0) {
          <div class="empty-band">
            <mat-icon>info_outline</mat-icon>
            No staff members added yet.
          </div>
        } @else {
          <div class="staff-grid">
            @for (s of ownStaff(); track s.id) {
              <div class="staff-card org-card">
                <div class="staff-avatar org-avatar">{{ s.name?.[0]?.toUpperCase() }}</div>
                <div class="staff-info">
                  <div class="staff-name flex-align">
                    {{ s.name }}
                    @if (s.id === currentUserId()) { <span class="badge badge-me">You</span> }
                  </div>
                  <div class="staff-email">{{ s.email }}</div>
                </div>
                <span class="role-pill role-client-{{ roleKey(s.role) }}">
                  {{ getRoleName(s.role) }}
                </span>
                
                @if (isAdmin() && s.id !== currentUserId()) {
                  <button mat-icon-button class="action-btn remove-btn" 
                          (click)="remove(s)" [disabled]="removingId() === s.id"
                          title="Remove user">
                    @if (removingId() === s.id) { <mat-spinner diameter="16"/> } @else { <mat-icon>person_remove</mat-icon> }
                  </button>
                }
              </div>
            }
          </div>
        }
      }
    </div>

    @if (showDialog()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <mat-card class="modal-card" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-head">
              <div class="modal-icon"><mat-icon>person_add</mat-icon></div>
              <div>
                <mat-card-title>Add Staff Member</mat-card-title>
                <p class="modal-sub">Create a new user account for your organisation</p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="form" class="modal-form">
              <div class="form-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Full Name *</mat-label>
                  <input matInput formControlName="name" />
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Role *</mat-label>
                  <mat-select formControlName="role">
                    @for (role of clientRoles(); track role.slug) {
                      <mat-option [value]="role.slug">{{ role.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
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
                <mat-hint>At least 8 characters</mat-hint>
                @if (form.get('password')?.errors?.['minlength'] && form.get('password')?.touched) {
                  <mat-error>At least 8 characters required</mat-error>
                }
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
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Create User }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .cta-btn { height:40px!important; }

    /* Section headers */
    .section-header {
      display:flex;align-items:center;gap:12px;margin-bottom:16px;
    }
    .section-icon {
      width:38px;height:38px;border-radius:10px;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .section-icon mat-icon { font-size:20px;width:20px;height:20px; }
    .zopa-icon { background:#f0fdf4; }
    .zopa-icon mat-icon { color:#16a34a; }
    .org-icon { background:#eff6ff; }
    .org-icon mat-icon { color:#2563eb; }
    .section-title { font-size:15px;font-weight:700;color:var(--text-1); }
    .section-sub   { font-size:12px;color:var(--text-3);margin-top:2px; }
    .count-badge {
      margin-left:auto;
      background:#f1f5f9;color:var(--text-2);
      font-size:12px;font-weight:600;
      padding:2px 10px;border-radius:99px;
    }

    /* Staff grid */
    .staff-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px; }

    .staff-card {
      display:flex;align-items:center;gap:12px;
      padding:14px 16px;border-radius:12px;
      background:var(--surface);border:1px solid var(--border);
    }
    .zopa-card { border-left:3px solid #16a34a; }
    .staff-avatar {
      width:40px;height:40px;border-radius:10px;flex-shrink:0;
      background:linear-gradient(135deg,var(--brand),var(--brand-hover));
      color:white;font-size:16px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
    }
    .zopa-avatar {
      background:linear-gradient(135deg,#16a34a,#15803d);
    }
    .staff-info { flex:1;min-width:0; }
    .staff-name  { font-size:13px;font-weight:600;color:var(--text-1); }
    .staff-email { font-size:11px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }

    /* Role pills */
    .role-pill {
      padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;
      white-space:nowrap;flex-shrink:0;
      background:#f1f5f9;color:#475569;
    }
    .role-pill.role-client_admin        { background:#fff7ed;color:#c2410c; }
    .role-pill.role-client_buyer        { background:#eff6ff;color:#2563eb; }
    .role-pill.role-client_pr           { background:#e0f2fe;color:#0ea5e9; }
    .role-pill.role-client_grn          { background:#e0f2fe;color:#0ea5e9; }
    .role-pill.role-client_approver_l1  { background:#f0fdf4;color:#16a34a; }
    .role-pill.role-client_approver_l2  { background:#f5f3ff;color:#7c3aed; }
    .role-pill.role-client_approver_l3  { background:#fff1f2;color:#dc2626; }
    .role-pill.role-zopa-buyer          { background:#eff6ff;color:#2563eb; }
    .role-pill.role-zopa-approver_l1    { background:#f0fdf4;color:#16a34a; }
    .role-pill.role-zopa-approver_l2    { background:#f5f3ff;color:#7c3aed; }
    .role-pill.role-zopa-approver_l3    { background:#fff1f2;color:#dc2626; }
    .role-pill.role-zopa-super_admin    { background:#fef3c7;color:#b45309; }

    .empty-band {
      display:flex;align-items:center;gap:8px;
      padding:16px 20px;border-radius:10px;
      background:#f8fafc;border:1px dashed var(--border);
      font-size:13px;color:var(--text-3);margin-bottom:8px;
    }
    .empty-band mat-icon { font-size:18px;width:18px;height:18px;color:var(--border); }

    /* Modal */
    .modal-overlay {
      position:fixed;inset:0;
      background:rgba(15,23,42,0.45);
      z-index:9999;
      display:flex;align-items:center;justify-content:center;
      backdrop-filter:blur(2px);
    }
    .modal-card { width:500px;max-width:90vw; }
    .modal-head { display:flex;align-items:center;gap:12px; }
    .modal-icon {
      width:40px;height:40px;border-radius:10px;
      background:var(--brand-light);
      display:flex;align-items:center;justify-content:center;
    }
    .modal-icon mat-icon { color:var(--brand); }
    .modal-sub { margin:4px 0 0;font-size:12px;color:var(--text-3); }
    .modal-form { display:flex;flex-direction:column;gap:8px; }
    .form-row { display:flex;gap:12px; }
    .full-width { width:100%; }
    .save-error {
      display:flex;align-items:center;gap:8px;
      background:#fff1f2;border:1px solid #fecdd3;
      color:#e11d48;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;
    }
    .save-error mat-icon { font-size:16px;width:16px;height:16px; }
  `],
})
export class OrgStaffComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private fb = inject(FormBuilder);
  private roleService = inject(RoleService);

  allUsers = signal<StaffMember[]>([]);
  clientRoles = signal<Role[]>([]);
  
  loading = signal(true);
  showDialog = signal(false);
  saving = signal(false);
  saveError = signal('');
  removingId = signal<number | null>(null);

  zopaStaff = computed(() => this.allUsers().filter(u => u.role.startsWith('zopa_')));
  ownStaff  = computed(() => this.allUsers().filter(u => u.role.startsWith('client_') || u.role && !u.role.startsWith('zopa_')));

  isAdmin = computed(() => this.auth.hasRole('client_admin'));
  currentUserId = computed(() => this.auth.user()?.id ?? null);

  form: FormGroup = this.fb.group({
    name:     ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role:     ['', Validators.required],
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    
    // Fetch both users and dynamic roles
    this.http.get<StaffMember[]>(`${environment.apiUrl}/users`).subscribe({
      next: data => { 
        this.allUsers.set(data); 
        
        this.roleService.getRoles().subscribe({
          next: roles => {
            this.clientRoles.set(roles.filter(r => r.type === 'client'));
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false),
    });
  }

  getRoleName(slug: string): string {
    // If we loaded roles, try to find it
    const roles = this.clientRoles();
    const role = roles.find(r => r.slug === slug);
    if (role) return role.name;
    
    // Fallback formatting for ZOPA or unknown roles
    return slug.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  roleKey(role: string): string { return role.replace('zopa_', '').replace('client_', ''); }

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
    this.http.post<StaffMember>(`${environment.apiUrl}/users`, this.form.value).subscribe({
      next: member => {
        this.allUsers.update(list => [...list, member]);
        this.notify.success(`${member.name} added successfully.`);
        this.closeDialog();
        this.saving.set(false);
      },
      error: err => {
        this.saveError.set(err?.error?.message || 'Failed to create user.');
        this.saving.set(false);
      },
    });
  }

  remove(s: StaffMember) {
    if (!confirm(`Remove ${s.name} from your organisation?`)) return;
    this.removingId.set(s.id);
    this.http.delete(`${environment.apiUrl}/users/${s.id}`).subscribe({
      next: () => {
        this.allUsers.update(list => list.filter(u => u.id !== s.id));
        this.notify.success(`${s.name} removed.`);
        this.removingId.set(null);
      },
      error: err => {
        this.notify.error(err?.error?.message || 'Failed to remove user.');
        this.removingId.set(null);
      },
    });
  }
}
