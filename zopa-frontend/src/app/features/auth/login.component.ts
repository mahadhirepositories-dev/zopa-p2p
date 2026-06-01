import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-shell">

      <!-- ── Brand panel (left) ─────────────────────────────── -->
      <aside class="brand-panel">
        <div class="brand-top">
          <div class="brand-logo">
            <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="12" fill="#ffffff"/>
              <text x="22" y="31" text-anchor="middle"
                    font-family="Arial,sans-serif" font-size="24"
                    font-weight="900" fill="#f97316" letter-spacing="-1">Z</text>
            </svg>
            <span>ZOPA</span>
          </div>
        </div>

        <div class="brand-mid">
          <h1>Procurement,<br>simplified end&#8209;to&#8209;end.</h1>
          <p>Requisitions, purchase orders, approvals, GRNs and invoices — one secure, multi-organization platform.</p>

          <ul class="brand-features">
            <li><span class="fi"><mat-icon>verified_user</mat-icon></span> Multi-level approvals with full audit trail</li>
            <li><span class="fi"><mat-icon>insights</mat-icon></span> Real-time budgets &amp; spend intelligence</li>
            <li><span class="fi"><mat-icon>bolt</mat-icon></span> One-click approvals, right from your inbox</li>
          </ul>
        </div>

        <div class="brand-bottom">&copy; {{ year }} ZOPA Procurement Suite</div>

        <!-- decorative glows -->
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
      </aside>

      <!-- ── Form panel (right) ─────────────────────────────── -->
      <main class="form-panel">
        <div class="form-card">

          <!-- compact logo for mobile -->
          <div class="mobile-logo">
            <svg width="38" height="38" viewBox="0 0 44 44" fill="none">
              <rect width="44" height="44" rx="12" fill="#f97316"/>
              <text x="22" y="31" text-anchor="middle" font-family="Arial,sans-serif"
                    font-size="24" font-weight="900" fill="white" letter-spacing="-1">Z</text>
            </svg>
            <span>ZOPA</span>
          </div>

          <div class="card-header">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your workspace</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email address</mat-label>
              <input matInput formControlName="email" type="email"
                     autocomplete="email" placeholder="you@company.com" />
              <mat-icon matSuffix>alternate_email</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput formControlName="password"
                     [type]="showPass() ? 'text' : 'password'"
                     autocomplete="current-password" />
              <button mat-icon-button matSuffix type="button"
                      (click)="showPass.set(!showPass())" tabindex="-1">
                <mat-icon>{{ showPass() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            <div class="forgot-row">
              <a routerLink="/forgot-password" class="forgot-link">Forgot password?</a>
            </div>

            @if (error()) {
              <div class="error-banner">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <button mat-raised-button color="primary" type="submit"
                    class="submit-btn" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20" style="display:inline-block;" />
              } @else {
                <mat-icon>login</mat-icon>
                <span class="btn-label">Sign In</span>
              }
            </button>

          </form>

          <div class="secure-note">
            <mat-icon>lock</mat-icon>
            <span>Encrypted connection &middot; Your data stays private</span>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .login-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      background: #fff;
    }

    /* ── Brand panel ───────────────────────────────────── */
    .brand-panel {
      position: relative;
      overflow: hidden;
      color: #fff;
      padding: 44px 56px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: linear-gradient(150deg, #ea580c 0%, #f97316 45%, #fb923c 100%);
    }
    .brand-logo { display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 900; letter-spacing: 1px; }
    .brand-logo svg { filter: drop-shadow(0 2px 6px rgba(0,0,0,.15)); }

    .brand-mid { max-width: 460px; position: relative; z-index: 2; }
    .brand-mid h1 { font-size: 38px; line-height: 1.15; font-weight: 800; margin: 0 0 16px; letter-spacing: -.5px; }
    .brand-mid > p { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,.92); margin: 0 0 30px; }

    .brand-features { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 16px; }
    .brand-features li { display: flex; align-items: center; gap: 13px; font-size: 14.5px; font-weight: 500; }
    .fi {
      width: 38px; height: 38px; flex-shrink: 0; border-radius: 11px;
      background: rgba(255,255,255,.18); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      border: 1px solid rgba(255,255,255,.25);
    }
    .fi mat-icon { font-size: 19px; width: 19px; height: 19px; color: #fff; }

    .brand-bottom { font-size: 12px; color: rgba(255,255,255,.8); position: relative; z-index: 2; }

    .glow { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; }
    .glow-1 { width: 320px; height: 320px; background: #fdba74; top: -90px; right: -80px; }
    .glow-2 { width: 260px; height: 260px; background: #c2410c; bottom: -70px; left: -60px; opacity: .4; }

    /* ── Form panel ────────────────────────────────────── */
    .form-panel {
      display: flex; align-items: center; justify-content: center;
      padding: 40px 24px;
      background: radial-gradient(1200px 600px at 80% -10%, #fff7ed 0%, #ffffff 55%);
    }
    .form-card { width: 100%; max-width: 400px; }

    .mobile-logo { display: none; align-items: center; gap: 10px; font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 26px; }

    .card-header { margin-bottom: 26px; }
    .card-header h2 { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 6px; letter-spacing: -.4px; }
    .card-header p { font-size: 14px; color: #94a3b8; margin: 0; }

    .login-form { display: flex; flex-direction: column; gap: 6px; }
    .full-width { width: 100%; }
    .login-form mat-icon[matSuffix] { color: #94a3b8; font-size: 19px; }

    .forgot-row { display: flex; justify-content: flex-end; margin: -2px 0 2px; }
    .forgot-link { font-size: 13px; color: #ea580c; font-weight: 600; text-decoration: none; }
    .forgot-link:hover { text-decoration: underline; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48;
      padding: 10px 14px; border-radius: 10px; font-size: 13px; margin: 4px 0;
    }
    .error-banner mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .submit-btn {
      width: 100%; height: 50px !important;
      font-size: 15px !important; font-weight: 700 !important;
      border-radius: 12px !important; margin-top: 10px;
      display: flex !important; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 6px 18px rgba(249,115,22,.30) !important;
    }

    .secure-note {
      margin-top: 26px; display: flex; align-items: center; justify-content: center; gap: 7px;
      font-size: 12px; color: #94a3b8;
    }
    .secure-note mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* ── Responsive ────────────────────────────────────── */
    @media (max-width: 880px) {
      .login-shell { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
      .mobile-logo { display: flex; }
      .form-panel { padding: 32px 22px; align-items: flex-start; padding-top: 8vh; }
    }
  `],
})
export class LoginComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  year = new Date().getFullYear();

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  loading  = signal(false);
  error    = signal('');
  showPass = signal(false);

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error.set(err.error?.message ?? 'Invalid email or password');
        this.loading.set(false);
      },
    });
  }
}
