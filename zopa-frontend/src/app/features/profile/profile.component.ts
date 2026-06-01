import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule, MatChipsModule, MatDividerModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">

      <div class="page-header">
        <div>
          <h2>My Profile</h2>
          <p>Manage your personal details, security, and see where you have access.</p>
        </div>
      </div>

      <!-- ── Identity banner ─────────────────────────────────────────── -->
      <div class="identity-card">
        <div class="avatar">{{ initials() }}</div>
        <div class="identity-info">
          <div class="identity-name">{{ auth.user()?.name || 'Unnamed user' }}</div>
          <div class="identity-email">
            <mat-icon>mail</mat-icon>{{ auth.user()?.email }}
          </div>
          @if (auth.user()?.phone) {
            <div class="identity-email"><mat-icon>call</mat-icon>{{ auth.user()?.phone }}</div>
          }
        </div>
        <div class="identity-meta">
          <span class="acct-chip" [class.zopa]="auth.isZopaStaff()">
            <mat-icon>{{ auth.isZopaStaff() ? 'verified_user' : 'business' }}</mat-icon>
            {{ auth.isZopaStaff() ? 'ZOPA Staff' : 'Client User' }}
          </span>
          @if (auth.user()?.created_at) {
            <span class="member-since">Member since {{ auth.user()?.created_at | date:'MMM yyyy' }}</span>
          }
        </div>
      </div>

      <div class="grid">

        <!-- ── Personal details ─────────────────────────────────────── -->
        <mat-card>
          <mat-card-header>
            <mat-card-title><mat-icon class="ct-icon">badge</mat-icon> Personal Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="form-col">
              <mat-form-field appearance="outline">
                <mat-label>Full name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Priya Sharma" />
                <mat-icon matSuffix>person</mat-icon>
                @if (profileForm.controls.name.hasError('required') && profileForm.controls.name.touched) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone (optional)</mat-label>
                <input matInput formControlName="phone" placeholder="e.g. +91 98765 43210" />
                <mat-icon matSuffix>call</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput [value]="auth.user()?.email" disabled />
                <mat-icon matSuffix matTooltip="Email is your login ID and can't be changed here">lock</mat-icon>
              </mat-form-field>

              <div class="actions">
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="profileForm.invalid || profileForm.pristine || savingProfile()">
                  @if (savingProfile()) {
                    <mat-spinner diameter="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" />
                  } @else { <mat-icon>save</mat-icon> }
                  Save Changes
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <!-- ── Security ─────────────────────────────────────────────── -->
        <mat-card>
          <mat-card-header>
            <mat-card-title><mat-icon class="ct-icon">lock</mat-icon> Security</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="passwordForm" (ngSubmit)="savePassword()" class="form-col">
              <mat-form-field appearance="outline">
                <mat-label>Current password</mat-label>
                <input matInput [type]="show('cur') ? 'text' : 'password'" formControlName="current_password" autocomplete="current-password" />
                <button mat-icon-button matSuffix type="button" (click)="toggle('cur')" tabindex="-1">
                  <mat-icon>{{ show('cur') ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>New password</mat-label>
                <input matInput [type]="show('new') ? 'text' : 'password'" formControlName="password" autocomplete="new-password" />
                <button mat-icon-button matSuffix type="button" (click)="toggle('new')" tabindex="-1">
                  <mat-icon>{{ show('new') ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (passwordForm.controls.password.hasError('minlength') && passwordForm.controls.password.touched) {
                  <mat-error>At least 8 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Confirm new password</mat-label>
                <input matInput [type]="show('conf') ? 'text' : 'password'" formControlName="password_confirmation" autocomplete="new-password" />
                <button mat-icon-button matSuffix type="button" (click)="toggle('conf')" tabindex="-1">
                  <mat-icon>{{ show('conf') ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (passwordForm.hasError('mismatch') && passwordForm.controls.password_confirmation.touched) {
                  <mat-error>Passwords do not match</mat-error>
                }
              </mat-form-field>

              <div class="actions">
                <button mat-flat-button color="primary" type="submit"
                        [disabled]="passwordForm.invalid || savingPassword()">
                  @if (savingPassword()) {
                    <mat-spinner diameter="18" style="display:inline-block;vertical-align:middle;margin-right:6px;" />
                  } @else { <mat-icon>key</mat-icon> }
                  Update Password
                </button>
              </div>
              <p class="hint">For your security, changing your password signs you out of all other devices.</p>
            </form>
          </mat-card-content>
        </mat-card>

        <!-- ── Access / organizations ───────────────────────────────── -->
        <mat-card class="span-2">
          <mat-card-header>
            <mat-card-title><mat-icon class="ct-icon">apartment</mat-icon> Your Access</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (auth.clients().length) {
              @if (auth.clients().length > 1) {
                <p class="hint" style="margin-bottom:8px;">Click another organization to switch into it.</p>
              }
              <div class="access-list">
                @for (c of auth.clients(); track c.tenant_id) {
                  @let isCurrent = c.tenant_id === auth.currentTenantId();
                  <div class="access-row" [class.current]="isCurrent" [class.switchable]="!isCurrent"
                       (click)="!isCurrent && switchOrg(c.tenant_id)">
                    <div class="org-avatar">{{ c.tenant_name?.[0]?.toUpperCase() }}</div>
                    <div class="org-info">
                      <div class="org-name">
                        {{ c.tenant_name }}
                        @if (isCurrent) { <span class="active-tag">Active</span> }
                      </div>
                      <div class="org-role">{{ roleLabel(c.role) }}</div>
                    </div>
                    @if (!isCurrent) {
                      <span class="switch-hint"><mat-icon>swap_horiz</mat-icon> Switch</span>
                    }
                  </div>
                }
              </div>
            } @else {
              <p class="hint">You are not assigned to any organization yet.</p>
            }
          </mat-card-content>
        </mat-card>

      </div>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; max-width: 980px; }
    .page-header { margin-bottom: 22px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .page-header p { margin: 4px 0 0; font-size: 13px; color: var(--text-3); }

    .identity-card {
      display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
      background: linear-gradient(120deg, #fff7ed 0%, #ffffff 60%);
      border: 1px solid var(--border); border-radius: 16px; padding: 22px 24px; margin-bottom: 22px;
    }
    .avatar {
      width: 64px; height: 64px; border-radius: 18px; flex-shrink: 0;
      background: linear-gradient(135deg, #f97316, #fb923c); color: #fff;
      display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800;
      box-shadow: 0 4px 14px rgba(249,115,22,.35);
    }
    .identity-info { flex: 1; min-width: 200px; }
    .identity-name { font-size: 20px; font-weight: 700; color: var(--text-1); }
    .identity-email { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3); margin-top: 3px; }
    .identity-email mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .identity-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .acct-chip {
      display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
      padding: 5px 12px; border-radius: 99px; background: #eff6ff; color: #2563eb;
    }
    .acct-chip.zopa { background: #f5f3ff; color: #7c3aed; }
    .acct-chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .member-since { font-size: 11px; color: var(--text-3); }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    .span-2 { grid-column: 1 / -1; }
    mat-card { border-radius: 14px !important; }
    .ct-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; color: var(--text-3); }
    mat-card-title { font-size: 15px !important; display: flex; align-items: center; }

    .form-col { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .form-col mat-form-field { width: 100%; }
    .actions { margin-top: 6px; }
    .hint { font-size: 12px; color: var(--text-3); margin: 10px 0 0; }

    .access-list { display: flex; flex-direction: column; gap: 4px; padding-top: 6px; }
    .access-row { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 10px; transition: background .12s; }
    .access-row:hover { background: #f8fafc; }
    .access-row.current { background: #fff7ed; }
    .access-row.switchable { cursor: pointer; }
    .access-row.switchable:hover { background: var(--brand-light, #fff1e6); }
    .switch-hint { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--brand, #f97316); opacity: 0; transition: opacity .12s; }
    .access-row.switchable:hover .switch-hint { opacity: 1; }
    .switch-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .org-avatar {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: var(--brand-light, #fff1e6); color: var(--brand, #f97316);
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px;
    }
    .org-name { font-size: 14px; font-weight: 600; color: var(--text-1); display: flex; align-items: center; gap: 8px; }
    .org-role { font-size: 12px; color: var(--text-3); margin-top: 1px; }
    .active-tag { font-size: 10px; font-weight: 700; color: #16a34a; background: #dcfce7; padding: 1px 7px; border-radius: 99px; text-transform: uppercase; letter-spacing: .04em; }
  `],
})
export class ProfileComponent {
  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);
  private router = inject(Router);

  savingProfile = signal(false);
  savingPassword = signal(false);
  private visible = signal<Record<string, boolean>>({});

  profileForm = this.fb.group({
    name:  [this.auth.user()?.name ?? '', [Validators.required, Validators.maxLength(255)]],
    phone: [this.auth.user()?.phone ?? ''],
  });

  passwordForm = this.fb.group(
    {
      current_password:      ['', Validators.required],
      password:              ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', Validators.required],
    },
    { validators: (g) => g.get('password')?.value === g.get('password_confirmation')?.value ? null : { mismatch: true } },
  );

  initials = computed(() => {
    const n = this.auth.user()?.name?.trim() || this.auth.user()?.email || '?';
    const parts = n.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || n[0].toUpperCase();
  });

  show(k: string) { return !!this.visible()[k]; }
  toggle(k: string) { this.visible.update(v => ({ ...v, [k]: !v[k] })); }

  saveProfile() {
    if (this.profileForm.invalid) return;
    this.savingProfile.set(true);
    const { name, phone } = this.profileForm.getRawValue();
    this.auth.updateProfile({ name: name!, phone: phone || null }).subscribe({
      next: () => {
        this.savingProfile.set(false);
        this.profileForm.markAsPristine();
        this.notify.success('Profile updated.');
      },
      error: (err) => {
        this.savingProfile.set(false);
        this.notify.error(err?.error?.message ?? 'Could not update profile.');
      },
    });
  }

  savePassword() {
    if (this.passwordForm.invalid) return;
    this.savingPassword.set(true);
    this.auth.changePassword(this.passwordForm.getRawValue() as any).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.notify.success('Password changed.');
      },
      error: (err) => {
        this.savingPassword.set(false);
        const msg = err?.error?.errors?.current_password?.[0] ?? err?.error?.message ?? 'Could not change password.';
        this.notify.error(msg);
      },
    });
  }

  roleLabel(role: string): string {
    return role
      .replace(/^zopa_/, 'ZOPA ')
      .replace(/^client_/, '')
      .replace(/_/g, ' ')
      .replace(/\bl(\d)\b/i, 'L$1')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Switch active organization and re-enter its context — IN-APP (no browser
   *  reload, which could load a stale cached index.html and bounce to login). */
  switchOrg(tenantId: number): void {
    if (tenantId === this.auth.currentTenantId()) return;
    this.auth.switchClient(tenantId);
    this.router.navigate(['/dashboard']);
  }
}
