import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="logo">
          <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="#f97316"/>
            <text x="22" y="31" text-anchor="middle" font-family="Arial,sans-serif"
                  font-size="24" font-weight="900" fill="white" letter-spacing="-1">Z</text>
          </svg>
          <span>ZOPA</span>
        </div>

        @if (!token || !email) {
          <div class="head">
            <h2>Invalid reset link</h2>
            <p>This password reset link is missing information or has been altered. Please request a new one.</p>
          </div>
          <a routerLink="/forgot-password" class="back-link"><mat-icon>refresh</mat-icon> Request a new link</a>

        } @else if (done()) {
          <div class="success">
            <div class="success-icon"><mat-icon>check_circle</mat-icon></div>
            <h2>Password updated</h2>
            <p>{{ message() }}</p>
          </div>
          <a routerLink="/login" class="back-link"><mat-icon>login</mat-icon> Go to sign in</a>

        } @else {
          <div class="head">
            <h2>Set a new password</h2>
            <p>Resetting the password for <strong>{{ email }}</strong>.</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>New password</mat-label>
              <input matInput formControlName="password"
                     [type]="showPass() ? 'text' : 'password'" autocomplete="new-password" />
              <button mat-icon-button matSuffix type="button"
                      (click)="showPass.set(!showPass())" tabindex="-1">
                <mat-icon>{{ showPass() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-hint>At least 8 characters</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Confirm new password</mat-label>
              <input matInput formControlName="password_confirmation"
                     [type]="showPass() ? 'text' : 'password'" autocomplete="new-password" />
              @if (form.hasError('mismatch') && form.get('password_confirmation')?.touched) {
                <mat-error>Passwords don't match</mat-error>
              }
            </mat-form-field>

            @if (error()) {
              <div class="error-banner">
                <mat-icon>error_outline</mat-icon><span>{{ error() }}</span>
              </div>
            }

            <button mat-raised-button color="primary" type="submit"
                    class="submit-btn" [disabled]="loading()">
              @if (loading()) { <mat-spinner diameter="20" style="display:inline-block;" /> }
              @else { <mat-icon>lock_reset</mat-icon> <span>Reset password</span> }
            </button>
          </form>

          <a routerLink="/login" class="back-link"><mat-icon>arrow_back</mat-icon> Back to sign in</a>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-shell {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 24px;
      background: radial-gradient(1200px 600px at 80% -10%, #fff7ed 0%, #ffffff 55%);
    }
    .auth-card {
      width: 100%; max-width: 410px; background: #fff; padding: 38px 34px;
      border-radius: 16px; box-shadow: 0 10px 40px rgba(15,23,42,.08); border: 1px solid #f1f5f9;
    }
    .logo { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 26px; }
    .head { margin-bottom: 20px; }
    .head h2 { font-size: 23px; font-weight: 800; color: #0f172a; margin: 0 0 6px; letter-spacing: -.4px; }
    .head p { font-size: 14px; color: #94a3b8; margin: 0; line-height: 1.5; }
    .form { display: flex; flex-direction: column; gap: 6px; }
    .full-width { width: 100%; }
    .form mat-icon[matSuffix] { color: #94a3b8; font-size: 19px; }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48;
      padding: 10px 14px; border-radius: 10px; font-size: 13px; margin: 4px 0;
    }
    .error-banner mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .submit-btn {
      width: 100%; height: 48px !important; font-size: 15px !important; font-weight: 700 !important;
      border-radius: 12px !important; margin-top: 8px;
      display: flex !important; align-items: center; justify-content: center; gap: 9px;
      box-shadow: 0 6px 18px rgba(249,115,22,.30) !important;
    }
    .success { text-align: center; padding: 6px 0 4px; }
    .success-icon {
      width: 64px; height: 64px; border-radius: 50%; background: #ecfdf5;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
    }
    .success-icon mat-icon { color: #16a34a; font-size: 32px; width: 32px; height: 32px; }
    .success h2 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 8px; }
    .success p { font-size: 14px; color: #475569; margin: 0; line-height: 1.5; }
    .back-link {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 24px; font-size: 13.5px; color: #64748b; text-decoration: none; font-weight: 600;
    }
    .back-link:hover { color: #ea580c; }
    .back-link mat-icon { font-size: 17px; width: 17px; height: 17px; }
  `],
})
export class ResetPasswordComponent {
  private fb    = inject(FormBuilder);
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Token + email come from the emailed link's query string.
  token = this.route.snapshot.queryParamMap.get('token') ?? '';
  email = this.route.snapshot.queryParamMap.get('email') ?? '';

  form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
    },
    { validators: [this.passwordsMatch] },
  );

  loading  = signal(false);
  error    = signal('');
  done     = signal(false);
  message  = signal('');
  showPass = signal(false);

  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const p = group.get('password')?.value;
    const c = group.get('password_confirmation')?.value;
    return p && c && p !== c ? { mismatch: true } : null;
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.auth.resetPassword({
      token: this.token,
      email: this.email,
      password: this.form.value.password!,
      password_confirmation: this.form.value.password_confirmation!,
    }).subscribe({
      next: res => {
        this.message.set(res?.message ?? 'Your password has been reset. You can now sign in.');
        this.done.set(true);
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: err => {
        this.error.set(err.error?.errors?.email?.[0] ?? err.error?.message ?? 'This reset link is invalid or has expired.');
        this.loading.set(false);
      },
    });
  }
}
