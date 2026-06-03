import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '../../../environments/environment';
import { CostCenter } from '../../core/models';
import { CostCenterFormDialogComponent } from './cost-center-form-dialog.component';
import { AuthService } from '../../core/auth/auth.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';

@Component({
  selector: 'app-cost-center-list',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatCardModule, MatProgressBarModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Cost Centers</h2>
          <p>{{ filtered().length }} of {{ costCenters().length }} cost center{{ costCenters().length !== 1 ? 's' : '' }}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <app-search-field class="search-field" [value]="search()" (valueChange)="search.set($event)"
                            placeholder="Search cost centers…" />
          @if (auth.canDo('cost_centers','create')) {
            <button mat-raised-button color="primary" class="cta-btn" (click)="openForm()">
              <mat-icon>add</mat-icon> New Cost Center
            </button>
          }
        </div>
      </div>

      <!-- Table card -->
      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;">
              <mat-spinner diameter="36" />
            </div>
          } @else if (filtered().length === 0) {
            <div class="empty-state">
              <mat-icon>account_balance_wallet</mat-icon>
              <h3>No cost centers found</h3>
              <p>{{ search() ? 'Try a different search term.' : 'Create a cost center to start tracking budgets.' }}</p>
              @if (!search() && auth.canDo('cost_centers','create')) {
                <button mat-raised-button color="primary" (click)="openForm()">
                  <mat-icon>add</mat-icon> New Cost Center
                </button>
              }
            </div>
          } @else {
            <table mat-table [dataSource]="filtered()" class="full-width">

              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                <td mat-cell *matCellDef="let cc">
                  <div class="name-cell">
                    <div class="avatar">
                      <mat-icon>account_balance_wallet</mat-icon>
                    </div>
                    <div>
                      <div class="name-primary">{{ cc.name }}</div>
                      @if (cc.department?.name) {
                        <div class="name-sub">{{ cc.department.name }}</div>
                      }
                    </div>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="project">
                <th mat-header-cell *matHeaderCellDef>Project</th>
                <td mat-cell *matCellDef="let cc">
                  @if (cc.project?.name) {
                    <span class="tag">{{ cc.project.name }}</span>
                  } @else {
                    <span style="color:var(--text-3);">—</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="annual_budget">
                <th mat-header-cell *matHeaderCellDef>Annual Budget</th>
                <td mat-cell *matCellDef="let cc">
                  <div class="budget-cell">
                    <span class="budget-amount">₹{{ cc.annual_budget | number:'1.0-0' }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let cc" style="text-align:right;white-space:nowrap;">
                  <button mat-icon-button matTooltip="Budget & Approvals" (click)="goDetail(cc.id)">
                    <mat-icon>settings</mat-icon>
                  </button>
                  @if (auth.canDo('cost_centers','edit')) {
                    <button mat-icon-button matTooltip="Edit" (click)="openForm(cc)">
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;" class="hover-row"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; color:var(--text-1); }
    .page-header p  { margin:3px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .search-field { width:220px; }
    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper { display:none; }

    .full-width { width:100%; }
    .hover-row:hover { background:#fafafa; }

    .name-cell { display:flex; align-items:center; gap:10px; padding:4px 0; }
    .avatar {
      width:34px; height:34px; border-radius:9px; flex-shrink:0;
      background:linear-gradient(135deg,#ede9fe,#ddd6fe);
      display:flex; align-items:center; justify-content:center;
    }
    .avatar mat-icon { font-size:18px; width:18px; height:18px; color:#7c3aed; }
    .name-primary { font-size:13px; font-weight:600; color:var(--text-1); }
    .name-sub { font-size:11px; color:var(--text-3); margin-top:1px; }

    .tag {
      display:inline-block; font-size:12px; font-weight:500;
      background:#f1f5f9; color:var(--text-2);
      padding:2px 8px; border-radius:5px;
    }

    .budget-cell { display:flex; flex-direction:column; gap:4px; }
    .budget-amount { font-size:13px; font-weight:700; color:var(--text-1); }

    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .empty-state p  { margin:0; font-size:13px; color:var(--text-3); }
  `],
})
export class CostCenterListComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  columns = ['name', 'project', 'annual_budget', 'actions'];
  costCenters = signal<CostCenter[]>([]);
  loading = signal(true);
  search = signal('');

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    return !q ? this.costCenters() : this.costCenters().filter(cc =>
      cc.name.toLowerCase().includes(q) ||
      (cc.department?.name ?? '').toLowerCase().includes(q) ||
      (cc.project?.name ?? '').toLowerCase().includes(q)
    );
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<CostCenter[]>(`${environment.apiUrl}/cost-centers`).subscribe({
      next: res => { this.costCenters.set(res); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(cc?: CostCenter) {
    const ref = this.dialog.open(CostCenterFormDialogComponent, { width: '540px', data: cc ?? null });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  goDetail(id: number) { this.router.navigate(['/cost-centers', id]); }
}
