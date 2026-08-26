import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';
import { CostCenter } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-cost-center-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Cost Center' : 'New Cost Center' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Cost Center Name *</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Department</mat-label>
            <mat-select formControlName="department_id">
              <mat-option [value]="null">— None —</mat-option>
              @for (d of departments(); track d.id) {
                <mat-option [value]="d.id">{{ d.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Project</mat-label>
            <mat-select formControlName="project_id">
              <mat-option [value]="null">— None —</mat-option>
              @for (p of projects(); track p.id) {
                <mat-option [value]="p.id">{{ p.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Delivery Locations</mat-label>
            <mat-select formControlName="location_ids" multiple>
              @for (l of locations(); track l.id) {
                <mat-option [value]="l.id">{{ l.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Locations allowed for this cost center</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Annual Budget (₹) *</mat-label>
            <input matInput type="number" formControlName="annual_budget" min="0" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Assigned Users</mat-label>
          <mat-select formControlName="user_ids" multiple>
            @for (u of users(); track u.id) {
              <mat-option [value]="u.id">{{ u.name }} ({{ u.email }})</mat-option>
            }
          </mat-select>
          <mat-hint>Users permitted to transact or view this Cost Center</mat-hint>
        </mat-form-field>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Budget From Date</mat-label>
            <input matInput [matDatepicker]="fromPicker" formControlName="budget_from" />
            <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
            <mat-datepicker #fromPicker />
            <mat-hint>Start of budget period</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Budget To Date</mat-label>
            <input matInput [matDatepicker]="toPicker" formControlName="budget_to" />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
            <mat-datepicker #toPicker />
            <mat-hint>End of budget period</mat-hint>
          </mat-form-field>
        </div>
        @if (form.value.budget_from) {
          <p class="fy-note">Fiscal year is set automatically to <strong>{{ derivedFiscalYear() }}</strong> from the budget start date.</p>
        }
        @if (form.value.budget_from && form.value.budget_to && isBudgetDateInvalid()) {
          <p class="date-error"><mat-icon style="font-size:14px;vertical-align:middle;">error</mat-icon> Budget end date must be after the start date.</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .full-width { width: 100%; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fy-note { font-size: 12px; color: var(--text-3); margin: 4px 2px 0; }
    .date-error { font-size: 12px; color: #dc2626; margin: 4px 2px 0; display:flex; align-items:center; gap:4px; }
  `],
})
export class CostCenterFormDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<CostCenterFormDialogComponent>);
  data: CostCenter | null = inject(MAT_DIALOG_DATA);

  saving = signal(false);
  departments = signal<any[]>([]);
  projects = signal<any[]>([]);
  locations = signal<any[]>([]);
  users = signal<any[]>([]);

  form = this.fb.group({
    name:                [this.data?.name ?? '', Validators.required],
    department_id:       [this.data?.department?.id ?? null],
    project_id:          [this.data?.project?.id ?? null],
    location_id:         [this.data?.location?.id ?? null],
    location_ids:        [this.data?.locations?.map(l => l.id) ?? (this.data?.location?.id ? [this.data.location.id] : [])],
    annual_budget:       [this.data?.annual_budget ?? 0, [Validators.required, Validators.min(0)]],
    budget_from:         [this.data?.budget_from ?? null],
    budget_to:           [this.data?.budget_to ?? null],
    user_ids:            [this.data?.users?.map(u => u.id) ?? []],
  });

  /** Fiscal year auto-derived from the budget start date (no manual entry). */
  derivedFiscalYear(): number {
    const from = this.form.value.budget_from;
    return from ? new Date(from).getFullYear()
                : (this.data?.current_fiscal_year ?? new Date().getFullYear());
  }

  /** CR-CC3: Returns true when budget_to is before budget_from */
  isBudgetDateInvalid(): boolean {
    const from = this.form.value.budget_from;
    const to = this.form.value.budget_to;
    return !!(from && to && new Date(from) > new Date(to));
  }

  ngOnInit() {
    const api = environment.apiUrl;
    this.http.get<any[]>(`${api}/departments`).subscribe(r => this.departments.set(r));
    this.http.get<any[]>(`${api}/projects`).subscribe(r => this.projects.set(r));
    this.http.get<any[]>(`${api}/locations`).subscribe(r => this.locations.set(r));
    this.http.get<any[]>(`${api}/users`).subscribe(r => this.users.set(r));
  }

  save() {
    if (this.form.invalid) return;
    const from = this.form.value.budget_from;
    const to = this.form.value.budget_to;
    if (from && to && new Date(from) > new Date(to)) {
      this.notify.error('Budget To Date must be after or equal to Budget From Date.');
      return;
    }
    this.saving.set(true);
    const formVals: any = this.form.value;

    const formatDate = (val: any) => {
      if (!val) return null;
      const d = new Date(val);
      return !isNaN(d.getTime())
        ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
        : null;
    };

    const payload = {
      ...formVals,
      department_id: formVals.department_id || null,
      project_id: formVals.project_id || null,
      location_id: formVals.location_ids?.[0] ?? null,
      budget_from: formatDate(formVals.budget_from),
      budget_to: formatDate(formVals.budget_to),
      current_fiscal_year: this.derivedFiscalYear()
    };

    const req = this.data
      ? this.http.put(`${environment.apiUrl}/cost-centers/${this.data.id}`, payload)
      : this.http.post(`${environment.apiUrl}/cost-centers`, payload);

    req.subscribe({
      next: () => {
        this.notify.success('Cost center saved.');
        this.dialogRef.close(true);
      },
      error: (err) => {
        const msg = err.error?.message || (err.error?.errors ? Object.values(err.error.errors).flat().join(', ') : 'Save failed.');
        this.notify.error(msg);
        this.saving.set(false);
      },
    });
  }
}
