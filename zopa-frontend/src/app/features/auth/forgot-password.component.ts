import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
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

        @if (!sent()) {
          <div class="head">
            <h2>Forgot your password?</h2>
            <p>Enter your account email and we'll send you a link to reset it.</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email address</mat-label>
              <input matInput formControlName="email" type="email"
                     autocomplete="email" placeholder="you@company.com" />
              <mat-icon matSuffix>alternate_email</mat-icon>
            </mat-form-field>

            @if (error()) {
              <div class="error-banner">
                <mat-icon>error_outline</mat-icon><span>{{ error() }}</span>
              </div>
            }

            <button mat-raised-button color="primary" type="submit"
                    class="submit-btn" [disabled]="loading()">
              @if (loading()) { <mat-spinner diameter="20" style="display:inline-block;" /> }
              @else { <mat-icon>send</mat-icon> <span>Send reset link</span> }
            </button>
          </form>
        } @else {
          <div class="success">
            <div class="success-icon"><mat-icon>mark_email_read</mat-icon></div>
            <h2>Check your inbox</h2>
            <p>{{ message() }}</p>
            <p class="muted">The link expires in 60 minutes. Don't forget to check your spam folder.</p>
          </div>
        }

        <a routerLink="/login" class="back-link">
          <mat-icon>arrow_back</mat-icon> Back to sign in
        </a>
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
    .head { margin-bottom: 22px; }
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
    .success p { font-size: 14px; color: #475569; margin: 0 0 8px; line-height: 1.5; }
    .success .muted { font-size: 12.5px; color: #94a3b8; }
    .back-link {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 24px; font-size: 13.5px; color: #64748b; text-decoration: none; font-weight: 600;
    }
    .back-link:hover { color: #ea580c; }
    .back-link mat-icon { font-size: 17px; width: 17px; height: 17px; }
  `],
})
export class ForgotPasswordComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = signal(false);
  error   = signal('');
  sent    = signal(false);
  message = signal('');

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.form.value.email!).subscribe({
      next: res => {
        this.message.set(res?.message ?? 'If an account exists for that email, a password reset link has been sent.');
        this.sent.set(true);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.error?.message ?? 'Something went wrong. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
