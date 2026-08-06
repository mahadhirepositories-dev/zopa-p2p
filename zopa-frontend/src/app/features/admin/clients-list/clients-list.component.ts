import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminService, Tenant } from '../services/admin.service';
import { gstinValidator } from '../../../core/validators';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [
    RouterModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatTableModule, MatChipsModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>Client Management</h2>
          <p>{{ clients.data.length }} client{{ clients.data.length !== 1 ? 's' : '' }} registered</p>
        </div>
        <button mat-raised-button color="primary" (click)="openDialog()" class="cta-btn">
          <mat-icon>add</mat-icon> Add Client
        </button>
      </div>

      <!-- Stats row -->
      <div class="client-stats">
        <div class="stat-pill active">
          <mat-icon>check_circle</mat-icon>
          <span>{{ activeCount() }} Active</span>
        </div>
        <div class="stat-pill inactive">
          <mat-icon>cancel</mat-icon>
          <span>{{ inactiveCount() }} Inactive</span>
        </div>
      </div>

      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (clients.data.length === 0) {
            <div class="empty-state">
              <mat-icon>business</mat-icon>
              <h3>No clients yet</h3>
              <p>Add your first client to get started.</p>
            </div>
          } @else {
            <table mat-table [dataSource]="clients" class="full-width">

              <ng-container matColumnDef="code">
                <th mat-header-cell *matHeaderCellDef>Code</th>
                <td mat-cell *matCellDef="let c">
                  <span class="code-badge">{{ c.code }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Company Name</th>
                <td mat-cell *matCellDef="let c">
                  <div class="company-cell">
                    @if (c.logo_url) {
                      <img [src]="c.logo_url" class="company-avatar" alt="logo" style="background:white; border:1px solid var(--border); object-fit:contain;" />
                    } @else {
                      <div class="company-avatar">{{ c.name?.[0] }}</div>
                    }
                    <div>
                      <div class="company-name">{{ c.name }}</div>
                      @if (c.gstin) {
                        <div class="company-gstin">GSTIN: {{ c.gstin }}</div>
                      }
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let c">
                  <mat-chip [highlighted]="true"
                    [class]="c.is_active ? 'status-approved' : 'status-rejected'">
                    {{ c.is_active ? 'Active' : 'Inactive' }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;">Actions</th>
                <td mat-cell *matCellDef="let c" style="text-align:right;">
                  <button mat-stroked-button color="primary"
                          [routerLink]="['/admin/clients', c.id]">
                    <mat-icon style="font-size:16px;">manage_accounts</mat-icon> Manage
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover-row"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>

    </div>

    <!-- Add Client Modal — outside page-wrapper so position:fixed works correctly -->
    @if (showDialog()) {
      <div class="modal-overlay" (click)="closeDialog()">
        <mat-card class="modal-card" (click)="$event.stopPropagation()">
          <mat-card-header>
            <div class="modal-header">
              <div class="modal-icon">
                <mat-icon>add_business</mat-icon>
              </div>
              <div>
                <mat-card-title>Add New Client</mat-card-title>
                <p style="margin:4px 0 0;font-size:12px;color:var(--text-3);">
                  Create a new client tenant
                </p>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content style="padding-top:20px;">
            <form [formGroup]="clientForm" class="client-form">
              <div class="form-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Client Code *</mat-label>
                  <input matInput formControlName="code" placeholder="DEMO" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>GSTIN</mat-label>
                  <input matInput formControlName="gstin" placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase" />
                  @if (clientForm.get('gstin')?.errors?.['gstin'] && clientForm.get('gstin')?.touched) {
                    <mat-error>Invalid GSTIN format</mat-error>
                  }
                </mat-form-field>
              </div>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Company Name *</mat-label>
                <input matInput formControlName="name" placeholder="Acme Corp Pvt Ltd" />
              </mat-form-field>

              <div style="margin-bottom: 12px; display:flex; align-items:center; gap: 12px;">
                <button mat-stroked-button type="button" (click)="logoUpload.click()">
                  <mat-icon>image</mat-icon> Select Logo
                </button>
                <span style="font-size:12px; color:var(--text-3);">
                  {{ selectedFileName() || 'No file chosen (Optional)' }}
                </span>
                <input #logoUpload type="file" accept="image/*" style="display:none" (change)="onFileSelected($event)" />
              </div>

              <mat-checkbox formControlName="is_active" color="primary">
                Active (client can log in)
              </mat-checkbox>
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
                    [disabled]="clientForm.invalid || saving()"
                    (click)="onSubmit()">
              @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Client }
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; }
    .page-header p  { margin:3px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .full-width { width:100%; }

    .client-stats { display:flex; gap:10px; margin-bottom:16px; }
    .stat-pill {
      display:flex; align-items:center; gap:6px;
      padding:6px 14px; border-radius:99px;
      font-size:12px; font-weight:600;
      border:1px solid var(--border);
    }
    .stat-pill mat-icon { font-size:14px; width:14px; height:14px; }
    .stat-pill.active  { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
    .stat-pill.inactive{ background:#fff1f2; color:#e11d48; border-color:#fecdd3; }

    .hover-row:hover { background:#f8fafc; cursor:pointer; }

    .code-badge {
      display:inline-block;
      padding:3px 10px; border-radius:6px;
      background:#f1f5f9; color:var(--text-2);
      font-size:11px; font-weight:700;
      font-family:monospace; letter-spacing:0.05em;
    }
    .company-cell { display:flex; align-items:center; gap:12px; }
    .company-avatar {
      width:36px; height:36px; border-radius:10px;
      background:linear-gradient(135deg,var(--brand),var(--brand-hover));
      color:white; font-size:15px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
    }
    .company-name  { font-size:14px; font-weight:600; color:var(--text-1); }
    .company-gstin { font-size:11px; color:var(--text-3); font-family:monospace; margin-top:2px; }

    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .empty-state p  { margin:0; font-size:13px; color:var(--text-3); }

    /* Modal */
    .modal-overlay {
      position:fixed; inset:0;
      background:rgba(15,23,42,0.4);
      z-index:1000;
      display:flex; align-items:center; justify-content:center;
      backdrop-filter:blur(2px);
      padding:16px;
    }
    .modal-card { 
      width:500px; 
      max-width:90vw; 
      max-height:90vh; 
      display:flex; 
      flex-direction:column; 
      box-sizing:border-box;
    }
    .modal-card mat-card-content { 
      overflow-y:auto; 
      max-height:calc(90vh - 130px);
    }
    .modal-header { display:flex; align-items:center; gap:12px; }
    .modal-icon {
      width:40px; height:40px; border-radius:10px;
      background:var(--brand-light);
      display:flex; align-items:center; justify-content:center;
    }
    .modal-icon mat-icon { color:var(--brand); }
    .client-form { display:flex; flex-direction:column; gap:14px; }
    .form-row { display:flex; gap:12px; }
    .half-width { flex:1; }
    .save-error {
      display:flex; align-items:center; gap:8px;
      background:#fff1f2; border:1px solid #fecdd3;
      color:#e11d48; padding:10px 14px;
      border-radius:8px; font-size:13px;
      margin-top:12px;
    }
    .save-error mat-icon { font-size:16px; width:16px; height:16px; }
  `],
})
export class ClientsListComponent implements OnInit {
  private adminService = inject(AdminService);
  private fb = inject(FormBuilder);

  clients = new MatTableDataSource<Tenant>([]);
  displayedColumns = ['code', 'name', 'status', 'actions'];
  showDialog = signal(false);
  saving = signal(false);
  loading = signal(true);
  saveError = signal('');

  activeCount   = signal(0);
  inactiveCount = signal(0);
  
  logoFile = signal<File | null>(null);
  selectedFileName = signal('');

  clientForm: FormGroup = this.fb.group({
    code:      ['', Validators.required],
    name:      ['', Validators.required],
    gstin:     ['', gstinValidator()],
    is_active: [true],
  });

  ngOnInit() { this.loadClients(); }

  loadClients() {
    this.loading.set(true);
    this.adminService.getClients().subscribe({
      next: data => {
        this.clients.data = data;
        this.activeCount.set(data.filter((c: any) => c.is_active).length);
        this.inactiveCount.set(data.filter((c: any) => !c.is_active).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openDialog() {
    this.clientForm.reset({ is_active: true });
    this.saveError.set('');
    this.logoFile.set(null);
    this.selectedFileName.set('');
    this.showDialog.set(true);
  }

  closeDialog() { this.showDialog.set(false); }
  
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.logoFile.set(input.files[0]);
      this.selectedFileName.set(input.files[0].name);
    }
  }

  onSubmit() {
    if (this.clientForm.invalid) return;
    this.saving.set(true);
    this.saveError.set('');
    this.adminService.createClient(this.clientForm.value).subscribe({
      next: (tenant) => {
        const file = this.logoFile();
        if (file) {
          this.adminService.uploadLogo(tenant.id, file).subscribe({
            next: () => {
              this.saving.set(false);
              this.closeDialog();
              this.loadClients();
            },
            error: (err) => {
              this.saveError.set(err.error?.message || 'Client saved but logo upload failed.');
              this.saving.set(false);
            }
          });
        } else {
          this.saving.set(false);
          this.closeDialog();
          this.loadClients();
        }
      },
      error: err => {
        this.saveError.set(err.error?.message || 'Failed to save client.');
        this.saving.set(false);
      },
    });
  }
}
