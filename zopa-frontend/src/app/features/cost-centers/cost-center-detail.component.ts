import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { environment } from '../../../environments/environment';
import { Budget, BudgetAdjustment, CostCenter } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

interface ApprovalConfig {
  id?: number;
  level: number;
  user_id: number;
  user_ids?: number[] | null;
  amount_limit: number | null;
  is_active: boolean;
  user?: { id: number; name: string; email: string };
  users_detail?: { id: number; name: string; email: string }[];
}
interface TenantUser { id: number; name: string; email: string; role: string; tenant_name?: string; }

type ConfigType = 'po' | 'invoice' | 'pr';

@Component({
  selector: 'app-cost-center-detail',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, UpperCasePipe, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatCardModule, MatTableModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule, MatProgressBarModule, MatTooltipModule,
    MatChipsModule, MatDividerModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/cost-centers"><mat-icon>arrow_back</mat-icon></button>
          <h2>{{ costCenterName() }}</h2>
        </div>
      </div>

      <!-- Budget Card -->
      @if (budget()) {
        <mat-card style="margin-bottom:24px;">
          <mat-card-header>
            <mat-card-title>Budget Status</mat-card-title>
            <div style="flex:1"></div>
            @if (costCenter()?.budget_from || costCenter()?.budget_to) {
              <div style="font-size:12px;color:var(--text-3);margin-right:12px;display:flex;align-items:center;gap:4px;">
                <mat-icon style="font-size:14px;width:14px;height:14px;">date_range</mat-icon>
                {{ costCenter()!.budget_from | date:'dd MMM yyyy' }} — {{ costCenter()!.budget_to | date:'dd MMM yyyy' }}
              </div>
            }
            @if (auth.isAdmin()) {
              <button mat-stroked-button (click)="toggleAdjustForm()" style="height:34px;">
                <mat-icon>tune</mat-icon> Adjust Budget
              </button>
            }
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            <div class="budget-grid">
              <div class="budget-stat">
                <span class="stat-label">Total Budget</span>
                <span class="stat-value">₹{{ budget()!.annual | number:'1.0-0' }}</span>
              </div>
              <div class="budget-stat">
                <span class="stat-label">Frozen</span>
                <span class="stat-value warn">₹{{ budget()!.frozen | number:'1.0-0' }}</span>
              </div>
              <div class="budget-stat">
                <span class="stat-label">Consumed</span>
                <span class="stat-value danger">₹{{ budget()!.consumed | number:'1.0-0' }}</span>
              </div>
              <div class="budget-stat">
                <span class="stat-label">Available</span>
                <span class="stat-value success">₹{{ budget()!.available | number:'1.0-0' }}</span>
              </div>
            </div>
            <div style="margin-top:16px;">
              <div style="font-size:12px;color:#888;margin-bottom:4px;">
                Utilisation: {{ utilisation() | number:'1.1-1' }}%
              </div>
              <mat-progress-bar mode="determinate" [value]="utilisation()"
                [color]="utilisation() > 90 ? 'warn' : 'primary'" />
            </div>

            <!-- Budget Adjustment Form -->
            @if (showAdjustForm && auth.isAdmin()) {
              <mat-divider style="margin:16px 0;" />
              <form [formGroup]="adjustForm" (ngSubmit)="submitAdjustment()" class="adjust-form">
                <div style="font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:12px;">Adjust Budget</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <mat-form-field appearance="outline">
                    <mat-label>Action</mat-label>
                    <mat-select formControlName="action">
                      <mat-option value="add">➕ Add Budget</mat-option>
                      <mat-option value="reduce">➖ Reduce Budget</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Amount (₹)</mat-label>
                    <span matPrefix>₹&nbsp;</span>
                    <input matInput type="number" formControlName="amount" min="0.01" />
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline" style="width:100%;">
                  <mat-label>Reason / Narration *</mat-label>
                  <input matInput formControlName="narration" placeholder="e.g. Q2 budget revision" />
                </mat-form-field>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                  <button mat-button type="button" (click)="showAdjustForm=false">Cancel</button>
                  <button mat-raised-button color="primary" type="submit"
                          [disabled]="adjustForm.invalid || savingAdjust()">
                    @if (savingAdjust()) { Saving… } @else { Apply }
                  </button>
                </div>
              </form>
            }

            <!-- Budget Ledger Log -->
            @if (ledger().length > 0) {
              <mat-divider style="margin:16px 0;" />
              <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:8px;">Budget Log</div>
              <table mat-table [dataSource]="ledger()" class="full-width ledger-table">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let l">{{ l.created_at | date:'dd MMM yy' }}</td>
                </ng-container>
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef>Action</th>
                  <td mat-cell *matCellDef="let l">
                    <span [class]="'ledger-action ledger-' + l.action">{{ l.action | uppercase }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="amount">
                  <th mat-header-cell *matHeaderCellDef>Amount</th>
                  <td mat-cell *matCellDef="let l">
                    @if (l.action === 'adjust') {
                      <span [style.color]="l.adjust_amount > 0 ? '#16a34a' : '#dc2626'">
                        {{ l.adjust_amount > 0 ? '+' : '' }}₹{{ l.adjust_amount | number:'1.0-0' }}
                      </span>
                    } @else if (l.action === 'freeze') {
                      <span style="color:#d97706;">₹{{ l.freeze_amount | number:'1.0-0' }}</span>
                    } @else if (l.action === 'consume') {
                      <span style="color:#dc2626;">₹{{ l.consume_amount | number:'1.0-0' }}</span>
                    } @else {
                      <span style="color:#16a34a;">₹{{ l.freeze_amount | number:'1.0-0' }}</span>
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="narration">
                  <th mat-header-cell *matHeaderCellDef>Narration</th>
                  <td mat-cell *matCellDef="let l" style="font-size:12px;color:var(--text-2);">{{ l.narration }}</td>
                </ng-container>
                <ng-container matColumnDef="by">
                  <th mat-header-cell *matHeaderCellDef>By</th>
                  <td mat-cell *matCellDef="let l" style="font-size:12px;">{{ l.created_by?.name }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="ledgerCols"></tr>
                <tr mat-row *matRowDef="let row; columns: ledgerCols;"></tr>
              </table>
            }
          </mat-card-content>
        </mat-card>
      }

      <!-- Approval Config Card -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>Approval Configuration</mat-card-title>
          <div style="flex:1"></div>
          <!-- Tab switcher -->
          <div class="type-tabs">
            <button class="type-tab" [class.active]="configType() === 'pr'" (click)="switchType('pr')">
              <mat-icon>description</mat-icon> PR
            </button>
            <button class="type-tab" [class.active]="configType() === 'po'" (click)="switchType('po')">
              <mat-icon>receipt_long</mat-icon> PO
            </button>
            <button class="type-tab" [class.active]="configType() === 'invoice'" (click)="switchType('invoice')">
              <mat-icon>request_quote</mat-icon> Invoice
            </button>
          </div>
          @if (auth.isAdmin()) {
            <button mat-raised-button color="primary" (click)="openAddForm()" style="margin-left:12px;">
              <mat-icon>add</mat-icon> Add Level
            </button>
          }
        </mat-card-header>
        <mat-card-content style="padding-top:16px;">

          <!-- Context notice -->
          @if (configType() === 'po') {
            <div class="governance-notice">
              <mat-icon>policy</mat-icon>
              <span><strong>PO Approvals:</strong> Multi-level approval chain for Purchase Orders. First approver at each level to act advances the PO.</span>
            </div>
          } @else if (configType() === 'invoice') {
            <div class="governance-notice" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534;">
              <mat-icon>info</mat-icon>
              <span><strong>Invoice Approvals:</strong> If no levels are configured, invoices will be <strong>auto-approved</strong> on submission.</span>
            </div>
          } @else {
            <div class="governance-notice" style="background:#eff6ff;border-color:#bfdbfe;color:#1e40af;">
              <mat-icon>description</mat-icon>
              <span><strong>PR Approvals:</strong> If no levels are configured, PRs go straight to "submitted" state without routing through approvers.</span>
            </div>
          }

          @if (showConfigForm && auth.isAdmin()) {
            <form [formGroup]="configForm" (ngSubmit)="saveConfig()" class="config-form">

              <!-- Row 1: Level + Amount Limit -->
              <div class="cf-row">
                <mat-form-field appearance="outline" style="flex:0 0 180px;">
                  <mat-label>Level *</mat-label>
                  <mat-select formControlName="level">
                    <mat-option [value]="1">L1 — First Approver</mat-option>
                    <mat-option [value]="2">L2 — Second Approver</mat-option>
                    <mat-option [value]="3">L3 — Final Approver</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Amount Limit (₹, blank = unlimited)</mat-label>
                  <input matInput type="number" formControlName="amount_limit" min="0" />
                  <mat-hint>Leave blank for this level to apply to all amounts</mat-hint>
                </mat-form-field>
              </div>

              <!-- Row 2: Approvers -->
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Approvers — first to act advances the {{ configTypeLabel() }}</mat-label>
                <mat-select formControlName="user_ids" multiple>
                  @for (u of users(); track u.id) {
                    <mat-option [value]="u.id">
                      {{ u.name }}
                      <span style="font-size:11px;color:#94a3b8;margin-left:6px;">
                        ({{ u.tenant_name ?? orgLabelFallback(u.role) }})
                      </span>
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <!-- Row 3: Actions -->
              <div class="cf-actions">
                <button mat-button type="button" (click)="showConfigForm=false">Cancel</button>
                <button mat-raised-button color="primary" type="submit"
                        [disabled]="configForm.invalid || savingConfig()">
                  @if (savingConfig()) { <mat-spinner diameter="16" /> Saving… } @else { Save }
                </button>
              </div>

            </form>
          }

          <table mat-table [dataSource]="activeConfigs()" class="full-width" style="margin-top:8px;">
            <ng-container matColumnDef="level">
              <th mat-header-cell *matHeaderCellDef>Level</th>
              <td mat-cell *matCellDef="let c">
                <strong>L{{ c.level }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="approvers">
              <th mat-header-cell *matHeaderCellDef>Approvers</th>
              <td mat-cell *matCellDef="let c">
                <div class="approver-chips">
                  @for (u of resolveUsers(c); track u.id) {
                    <span class="approver-chip">{{ u.name }}</span>
                  }
                  @if (resolveUsers(c).length === 0) {
                    <span style="color:var(--text-3);font-size:12px;">— Not assigned —</span>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="amount_limit">
              <th mat-header-cell *matHeaderCellDef>Amount Limit</th>
              <td mat-cell *matCellDef="let c">{{ c.amount_limit ? ('₹' + (c.amount_limit | number:'1.0-0')) : 'Unlimited' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let c">
                @if (auth.isAdmin()) {
                  <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteConfig(c)">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="configCols"></tr>
            <tr mat-row *matRowDef="let row; columns: configCols;"></tr>
          </table>

          @if (activeConfigs().length === 0) {
            <div style="text-align:center;padding:32px;color:var(--text-3);font-size:13px;">
              No approval levels configured for {{ configTypeLabel() }}s. Add levels using the button above.
            </div>
          }

        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .budget-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:16px; }
    .budget-stat { text-align:center; }
    .stat-label { font-size:11px;color:#888;text-transform:uppercase;display:block; }
    .stat-value { font-size:20px;font-weight:700;display:block; }
    .stat-value.warn { color:#e65100; }
    .stat-value.danger { color:#c62828; }
    .stat-value.success { color:#2e7d32; }
    .adjust-form { background:#f8faff;padding:16px;border-radius:10px;border:1px solid #dbeafe;display:flex;flex-direction:column;gap:8px; }
    .ledger-table { font-size:12px; }
    .ledger-action { display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700; }
    .ledger-adjust  { background:#ecfdf5;color:#065f46; }
    .ledger-freeze  { background:#fff7ed;color:#c2410c; }
    .ledger-consume { background:#fef2f2;color:#b91c1c; }
    .ledger-release { background:#eff6ff;color:#1d4ed8; }
    .governance-notice {
      display:flex;align-items:flex-start;gap:8px;
      background:#eff6ff;border:1px solid #bfdbfe;
      color:#1d4ed8;border-radius:8px;
      padding:10px 14px;font-size:12px;margin-bottom:16px;
    }
    .governance-notice mat-icon { font-size:16px;width:16px;height:16px;flex-shrink:0;margin-top:1px; }
    .config-form { display:flex;flex-direction:column;gap:4px;margin-bottom:16px;background:#f8faff;padding:16px;border-radius:10px;border:1px solid #dbeafe; }
    .cf-row { display:flex;gap:12px;align-items:flex-start; }
    .cf-actions { display:flex;gap:8px;justify-content:flex-end;padding-top:4px; }
    .full-width { width:100%; }
    .type-tabs { display:flex;gap:4px; }
    .type-tab { display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:12px;font-weight:500;color:var(--text-2);cursor:pointer;transition:all .15s; }
    .type-tab mat-icon { font-size:15px;width:15px;height:15px; }
    .type-tab:hover { border-color:var(--brand);color:var(--brand); }
    .type-tab.active { background:var(--brand);border-color:var(--brand);color:white; }
    .approver-chips { display:flex;flex-wrap:wrap;gap:4px; }
    .approver-chip { background:#f1f5f9;color:#475569;font-size:11px;font-weight:500;padding:2px 8px;border-radius:99px; }
  `],
})
export class CostCenterDetailComponent implements OnInit {
  id = input.required<string>();
  private http   = inject(HttpClient);
  private fb     = inject(FormBuilder);
  private notify = inject(NotificationService);
  readonly auth  = inject(AuthService);

  costCenterName = signal('Cost Center');
  costCenter     = signal<CostCenter | null>(null);
  budget         = signal<Budget | null>(null);
  ledger         = signal<BudgetAdjustment[]>([]);

  configs        = signal<ApprovalConfig[]>([]); // PO
  invoiceConfigs = signal<ApprovalConfig[]>([]); // Invoice
  prConfigs      = signal<ApprovalConfig[]>([]); // PR

  configType = signal<ConfigType>('po');

  activeConfigs = computed(() => {
    if (this.configType() === 'invoice') return this.invoiceConfigs();
    if (this.configType() === 'pr')      return this.prConfigs();
    return this.configs();
  });

  users          = signal<TenantUser[]>([]);
  loading        = signal(true);
  showConfigForm = false;
  showAdjustForm = false;
  savingConfig   = signal(false);
  savingAdjust   = signal(false);
  configCols     = ['level', 'approvers', 'amount_limit', 'actions'];
  ledgerCols     = ['date', 'action', 'amount', 'narration', 'by'];

  configForm = this.fb.group({
    level:        [1, Validators.required],
    user_ids:     [[] as number[], [Validators.required, Validators.minLength(1)]],
    amount_limit: [null as number | null],
  });

  adjustForm = this.fb.group({
    action:    ['add', Validators.required],
    amount:    [null as number | null, [Validators.required, Validators.min(0.01)]],
    narration: ['', Validators.required],
  });

  utilisation = computed(() => {
    const b = this.budget();
    if (!b || !b.annual) return 0;
    return Math.min(100, ((b.consumed + b.frozen) / b.annual) * 100);
  });

  configTypeLabel(): string {
    return { po: 'Purchase Order', invoice: 'Invoice', pr: 'Purchase Requisition' }[this.configType()] ?? '';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      zopa_super_admin: 'ZOPA Super Admin',
      zopa_buyer: 'ZOPA Buyer',
      zopa_pr: 'ZOPA PR User',
      zopa_grn: 'ZOPA GRN User',
      zopa_approver_l1: 'ZOPA L1 Approver',
      zopa_approver_l2: 'ZOPA L2 Approver',
      zopa_approver_l3: 'ZOPA L3 Approver',
      client_admin: 'Client Admin',
      client_buyer: 'Client Buyer',
      client_pr: 'Client PR User',
      client_grn: 'Client GRN User',
      client_approver_l1: 'L1 Approver',
      client_approver_l2: 'L2 Approver',
      client_approver_l3: 'L3 Approver',
    };
    return map[role] ?? role;
  }

  /** Fallback label when tenant_name is not available — shows ZOPA vs Client */
  orgLabelFallback(role: string): string {
    return role.startsWith('zopa_') ? 'ZOPA Internal' : 'Client';
  }

  /** Resolve display users from config (prefers users_detail, falls back to user) */
  resolveUsers(c: ApprovalConfig): { id: number; name: string }[] {
    if (c.users_detail && c.users_detail.length > 0) return c.users_detail;
    if (c.user) return [c.user];
    return [];
  }

  ngOnInit() {
    const id  = this.id();
    const api = environment.apiUrl;

    this.http.get<CostCenter>(`${api}/cost-centers/${id}`).subscribe({
      next: cc => { this.costCenter.set(cc); this.costCenterName.set(cc.name); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    this.http.get<Budget>(`${api}/cost-centers/${id}/budget`).subscribe(b => this.budget.set(b));
    this.loadLedger();
    this.http.get<ApprovalConfig[]>(`${api}/cost-centers/${id}/approval-configs?type=po`).subscribe(c => this.configs.set(c));
    this.http.get<ApprovalConfig[]>(`${api}/cost-centers/${id}/approval-configs?type=invoice`).subscribe(c => this.invoiceConfigs.set(c));
    this.http.get<ApprovalConfig[]>(`${api}/cost-centers/${id}/approval-configs?type=pr`).subscribe(c => this.prConfigs.set(c));
    this.http.get<TenantUser[]>(`${api}/users`).subscribe(u => this.users.set(u));
  }

  loadLedger() {
    this.http.get<any>(`${environment.apiUrl}/cost-centers/${this.id()}/budget/ledger`)
      .subscribe(res => this.ledger.set(res.data ?? []));
  }

  toggleAdjustForm() {
    this.showAdjustForm = !this.showAdjustForm;
    if (this.showAdjustForm) {
      this.adjustForm.reset({ action: 'add', amount: null, narration: '' });
    }
  }

  submitAdjustment() {
    if (this.adjustForm.invalid) return;
    this.savingAdjust.set(true);
    const { action, amount, narration } = this.adjustForm.value;
    this.http.post<any>(
      `${environment.apiUrl}/cost-centers/${this.id()}/budget/adjust`,
      { action, amount, narration }
    ).subscribe({
      next: res => {
        this.notify.success(`Budget ${action === 'add' ? 'increased' : 'reduced'} by ₹${amount?.toLocaleString()}`);
        this.showAdjustForm = false;
        this.savingAdjust.set(false);
        // Refresh budget + ledger
        this.http.get<Budget>(`${environment.apiUrl}/cost-centers/${this.id()}/budget`)
          .subscribe(b => this.budget.set(b));
        this.loadLedger();
      },
      error: err => {
        this.notify.error(err.error?.error || 'Adjustment failed.');
        this.savingAdjust.set(false);
      },
    });
  }

  switchType(type: ConfigType) {
    this.configType.set(type);
    this.showConfigForm = false;
  }

  openAddForm() {
    this.configForm.reset({ level: 1, user_ids: [], amount_limit: null });
    this.showConfigForm = true;
  }

  saveConfig() {
    if (this.configForm.invalid) return;
    this.savingConfig.set(true);
    const type    = this.configType();
    const formVal = this.configForm.value;

    this.http.post<ApprovalConfig>(
      `${environment.apiUrl}/cost-centers/${this.id()}/approval-configs`,
      { ...formVal, type }
    ).subscribe({
      next: cfg => {
        const target = type === 'po' ? this.configs : type === 'invoice' ? this.invoiceConfigs : this.prConfigs;
        target.update(list => {
          const idx = list.findIndex(c => c.level === cfg.level);
          if (idx >= 0) { const u = [...list]; u[idx] = cfg; return u; }
          return [...list, cfg].sort((a, b) => a.level - b.level);
        });
        this.notify.success('Approval config saved.');
        this.showConfigForm = false;
        this.configForm.reset({ level: 1, user_ids: [] });
        this.savingConfig.set(false);
      },
      error: err => {
        this.notify.error(err.error?.message || 'Save failed.');
        this.savingConfig.set(false);
      },
    });
  }

  deleteConfig(cfg: ApprovalConfig) {
    if (!cfg.id) return;
    const type = this.configType();
    this.http.delete(`${environment.apiUrl}/cost-centers/${this.id()}/approval-configs/${cfg.id}`).subscribe({
      next: () => {
        const target = type === 'po' ? this.configs : type === 'invoice' ? this.invoiceConfigs : this.prConfigs;
        target.update(list => list.filter(c => c.id !== cfg.id));
        this.notify.success('Config removed.');
      },
      error: () => this.notify.error('Delete failed.'),
    });
  }
}
