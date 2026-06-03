import { Component, OnInit, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OrgService, OrgEntity } from '../../core/services/org.service';
import { OrgMasterDialogComponent } from './org-master-dialog.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-org-masters',
  standalone: true,
  imports: [
    MatTabsModule, MatTableModule, MatButtonModule,
    MatIconModule, MatDialogModule, MatChipsModule,
    MatProgressSpinnerModule, MatCardModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Organization Masters</h2>
          <p>Manage Departments, Projects, and Locations</p>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group (selectedTabChange)="onTabChange($event.index)" animationDuration="0ms" class="org-tabs">

        <!-- ── Departments ─────────────────────────────── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:6px;font-size:16px;">domain</mat-icon>
            Departments
          </ng-template>

          <div class="tab-content">
            <div class="tab-toolbar">
              <span class="tab-count">{{ departments.data.length }} department{{ departments.data.length !== 1 ? 's' : '' }}</span>
              @if (auth.canDo('org_masters','create')) {
                <button mat-raised-button color="primary" class="cta-btn" (click)="openDialog('department')">
                  <mat-icon>add</mat-icon> New Department
                </button>
              }
            </div>

            <mat-card style="overflow:hidden;">
              <mat-card-content style="padding:0!important;">
                @if (loading()) {
                  <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
                } @else if (departments.data.length === 0) {
                  <div class="empty-state">
                    <mat-icon>domain_disabled</mat-icon>
                    <h3>No departments yet</h3>
                    <p>Departments help organise your cost centers and PO workflows.</p>
                    @if (auth.canDo('org_masters','create')) {
                      <button mat-raised-button color="primary" (click)="openDialog('department')">
                        <mat-icon>add</mat-icon> New Department
                      </button>
                    }
                  </div>
                } @else {
                  <table mat-table [dataSource]="departments" class="full-width">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Department</th>
                      <td mat-cell *matCellDef="let row">
                        <div class="entity-cell">
                          <div class="entity-icon dept"><mat-icon>domain</mat-icon></div>
                          <strong>{{ row.name }}</strong>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let row">
                        <mat-chip [class]="row.is_active ? 'status-approved' : 'status-cancelled'" [highlighted]="true">
                          {{ row.is_active ? 'Active' : 'Inactive' }}
                        </mat-chip>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let row" style="text-align:right;white-space:nowrap;">
                        @if (auth.canDo('org_masters','edit')) {
                          <button mat-icon-button matTooltip="Edit" (click)="openDialog('department', row)">
                            <mat-icon>edit</mat-icon>
                          </button>
                          @if (row.is_active) {
                            <button mat-icon-button color="warn" matTooltip="Deactivate" (click)="deleteEntity('department', row.id)">
                              <mat-icon>delete</mat-icon>
                            </button>
                          }
                        }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="columnsBasic"></tr>
                    <tr mat-row *matRowDef="let row; columns: columnsBasic;" class="hover-row"></tr>
                  </table>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- ── Projects ─────────────────────────────────── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:6px;font-size:16px;">work</mat-icon>
            Projects
          </ng-template>

          <div class="tab-content">
            <div class="tab-toolbar">
              <span class="tab-count">{{ projects.data.length }} project{{ projects.data.length !== 1 ? 's' : '' }}</span>
              @if (auth.canDo('org_masters','create')) {
                <button mat-raised-button color="primary" class="cta-btn" (click)="openDialog('project')">
                  <mat-icon>add</mat-icon> New Project
                </button>
              }
            </div>

            <mat-card style="overflow:hidden;">
              <mat-card-content style="padding:0!important;">
                @if (loading()) {
                  <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
                } @else if (projects.data.length === 0) {
                  <div class="empty-state">
                    <mat-icon>work_off</mat-icon>
                    <h3>No projects yet</h3>
                    <p>Projects allow you to group cost centers and track spend by initiative.</p>
                    @if (auth.canDo('org_masters','create')) {
                      <button mat-raised-button color="primary" (click)="openDialog('project')">
                        <mat-icon>add</mat-icon> New Project
                      </button>
                    }
                  </div>
                } @else {
                  <table mat-table [dataSource]="projects" class="full-width">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Project</th>
                      <td mat-cell *matCellDef="let row">
                        <div class="entity-cell">
                          <div class="entity-icon proj"><mat-icon>work</mat-icon></div>
                          <strong>{{ row.name }}</strong>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let row">
                        <mat-chip [class]="row.is_active ? 'status-approved' : 'status-cancelled'" [highlighted]="true">
                          {{ row.is_active ? 'Active' : 'Inactive' }}
                        </mat-chip>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let row" style="text-align:right;white-space:nowrap;">
                        @if (auth.canDo('org_masters','edit')) {
                          <button mat-icon-button matTooltip="Edit" (click)="openDialog('project', row)">
                            <mat-icon>edit</mat-icon>
                          </button>
                          @if (row.is_active) {
                            <button mat-icon-button color="warn" matTooltip="Deactivate" (click)="deleteEntity('project', row.id)">
                              <mat-icon>delete</mat-icon>
                            </button>
                          }
                        }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="columnsBasic"></tr>
                    <tr mat-row *matRowDef="let row; columns: columnsBasic;" class="hover-row"></tr>
                  </table>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- ── Locations ─────────────────────────────────── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon style="margin-right:6px;font-size:16px;">location_on</mat-icon>
            Locations
          </ng-template>

          <div class="tab-content">
            <div class="tab-toolbar">
              <span class="tab-count">{{ locations.data.length }} location{{ locations.data.length !== 1 ? 's' : '' }}</span>
              @if (auth.canDo('org_masters','create')) {
                <button mat-raised-button color="primary" class="cta-btn" (click)="openDialog('location')">
                  <mat-icon>add</mat-icon> New Location
                </button>
              }
            </div>

            <mat-card style="overflow:hidden;">
              <mat-card-content style="padding:0!important;">
                @if (loading()) {
                  <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
                } @else if (locations.data.length === 0) {
                  <div class="empty-state">
                    <mat-icon>location_off</mat-icon>
                    <h3>No locations yet</h3>
                    <p>Locations represent your company's offices and warehouses for billing and shipping.</p>
                    @if (auth.canDo('org_masters','create')) {
                      <button mat-raised-button color="primary" (click)="openDialog('location')">
                        <mat-icon>add</mat-icon> New Location
                      </button>
                    }
                  </div>
                } @else {
                  <table mat-table [dataSource]="locations" class="full-width">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Location</th>
                      <td mat-cell *matCellDef="let row">
                        <div class="entity-cell">
                          <div class="entity-icon loc"><mat-icon>location_on</mat-icon></div>
                          <div>
                            <div class="name-primary">{{ row.name }}</div>
                            @if (row.city || row.state) {
                              <div class="name-sub">{{ row.city ? row.city + ', ' : '' }}{{ row.state }}{{ row.state_code ? ' (' + row.state_code + ')' : '' }}{{ row.pincode ? ' - ' + row.pincode : '' }}</div>
                            }
                          </div>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="gstin">
                      <th mat-header-cell *matHeaderCellDef>GSTIN</th>
                      <td mat-cell *matCellDef="let row">
                        @if (row.gstin) {
                          <span class="mono-tag">{{ row.gstin }}</span>
                        } @else {
                          <span style="color:var(--text-3);">—</span>
                        }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let row">
                        <mat-chip [class]="row.is_active ? 'status-approved' : 'status-cancelled'" [highlighted]="true">
                          {{ row.is_active ? 'Active' : 'Inactive' }}
                        </mat-chip>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let row" style="text-align:right;white-space:nowrap;">
                        @if (auth.canDo('org_masters','edit')) {
                          <button mat-icon-button matTooltip="Edit" (click)="openDialog('location', row)">
                            <mat-icon>edit</mat-icon>
                          </button>
                          @if (row.is_active) {
                            <button mat-icon-button color="warn" matTooltip="Deactivate" (click)="deleteEntity('location', row.id)">
                              <mat-icon>delete</mat-icon>
                            </button>
                          }
                        }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="columnsLocation"></tr>
                    <tr mat-row *matRowDef="let row; columns: columnsLocation;" class="hover-row"></tr>
                  </table>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { margin-bottom: 24px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; color:var(--text-1); }
    .page-header p  { margin:4px 0 0; font-size:13px; color:var(--text-3); }

    /* Tab group */
    ::ng-deep .org-tabs .mat-mdc-tab-header { background:var(--surface); border-bottom:1px solid var(--border); }
    ::ng-deep .org-tabs .mat-mdc-tab { min-width:140px; }

    .tab-content { padding-top:20px; }
    .tab-toolbar {
      display:flex; justify-content:space-between; align-items:center;
      margin-bottom:16px;
    }
    .tab-count { font-size:13px; color:var(--text-3); font-weight:500; }
    .cta-btn { height:40px!important; }

    .full-width { width:100%; }
    .hover-row:hover { background:#fafafa; }
    .spinner-wrap { display:flex; justify-content:center; padding:60px; }

    /* Entity cell */
    .entity-cell { display:flex; align-items:center; gap:10px; padding:4px 0; }
    .entity-icon {
      width:32px; height:32px; border-radius:8px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
    }
    .entity-icon mat-icon { font-size:17px; width:17px; height:17px; }
    .entity-icon.dept { background:#fff7ed; }
    .entity-icon.dept mat-icon { color:var(--brand); }
    .entity-icon.proj { background:#f0fdf4; }
    .entity-icon.proj mat-icon { color:#16a34a; }
    .entity-icon.loc  { background:#eff6ff; }
    .entity-icon.loc mat-icon  { color:#2563eb; }

    .name-primary { font-size:13px; font-weight:600; color:var(--text-1); }
    .name-sub { font-size:11px; color:var(--text-3); margin-top:1px; }

    .mono-tag {
      font-family:monospace; font-size:12px; font-weight:600;
      background:#f1f5f9; color:var(--text-2);
      padding:2px 8px; border-radius:5px;
    }

    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .empty-state p  { margin:0; font-size:13px; color:var(--text-3); max-width:320px; }
  `],
})
export class OrgMastersComponent implements OnInit {
  private orgService = inject(OrgService);
  private dialog = inject(MatDialog);
  readonly auth = inject(AuthService);

  loading = signal(false);

  departments = new MatTableDataSource<OrgEntity>([]);
  projects    = new MatTableDataSource<OrgEntity>([]);
  locations   = new MatTableDataSource<OrgEntity>([]);

  columnsBasic    = ['name', 'status', 'actions'];
  columnsLocation = ['name', 'gstin', 'status', 'actions'];

  ngOnInit() { this.loadData(0); }

  onTabChange(index: number) { this.loadData(index); }

  loadData(index: number) {
    this.loading.set(true);
    if (index === 0) {
      this.orgService.getDepartments().subscribe({
        next: data => { this.departments.data = data; this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    } else if (index === 1) {
      this.orgService.getProjects().subscribe({
        next: data => { this.projects.data = data; this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    } else if (index === 2) {
      this.orgService.getLocations().subscribe({
        next: data => { this.locations.data = data; this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  openDialog(type: 'department' | 'project' | 'location', entity?: OrgEntity) {
    const ref = this.dialog.open(OrgMasterDialogComponent, {
      width: '500px',
      data: { type, entity },
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        if (type === 'department') this.loadData(0);
        else if (type === 'project') this.loadData(1);
        else this.loadData(2);
      }
    });
  }

  deleteEntity(type: 'department' | 'project' | 'location', id: number) {
    if (!confirm('Are you sure you want to deactivate this record?')) return;
    const req = type === 'department'
      ? this.orgService.deleteDepartment(id)
      : type === 'project'
        ? this.orgService.deleteProject(id)
        : this.orgService.deleteLocation(id);

    req?.subscribe(() => {
      if (type === 'department') this.loadData(0);
      else if (type === 'project') this.loadData(1);
      else this.loadData(2);
    });
  }
}
