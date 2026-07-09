import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrgService, OrgEntity } from '../../core/services/org.service';
import { NotificationService } from '../../core/services/notification.service';
import { gstinValidator } from '../../core/validators';
import { HttpClient } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { environment } from '../../../environments/environment';

export interface OrgMasterDialogData {
  type: 'department' | 'project' | 'location';
  entity?: OrgEntity;
}

@Component({
  selector: 'app-org-master-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatProgressSpinnerModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.entity ? 'Edit' : 'New' }} {{ getTitle() }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name *</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        @if (data.type === 'department') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Department Head</mat-label>
            <mat-select formControlName="head_user_id">
              <mat-option [value]="null">None</mat-option>
              @for (u of users(); track u.id) {
                <mat-option [value]="u.id">{{ u.name }} ({{ u.email }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        @if (data.type === 'project') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Project End Date</mat-label>
            <input matInput [matDatepicker]="projPicker" formControlName="end_date" />
            <mat-datepicker-toggle matIconSuffix [for]="projPicker" />
            <mat-datepicker #projPicker />
            <mat-hint>Optional project expiration date</mat-hint>
          </mat-form-field>
        }

        @if (data.type === 'location') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Address</mat-label>
            <input matInput formControlName="address" />
          </mat-form-field>
          <div class="row-2">
            <mat-form-field appearance="outline">
              <mat-label>City</mat-label>
              <input matInput formControlName="city" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Pincode</mat-label>
              <input matInput formControlName="pincode" maxlength="20" />
            </mat-form-field>
          </div>
          <div class="row-2">
            <mat-form-field appearance="outline">
              <mat-label>State</mat-label>
              <mat-select formControlName="state" (selectionChange)="onStateChange($event.value)">
                <mat-option [value]="null">Select State</mat-option>
                @for (s of indianStates; track s.code) {
                  <mat-option [value]="s.name">{{ s.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>State Code</mat-label>
              <input matInput formControlName="state_code" maxlength="2" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Country</mat-label>
            <input matInput formControlName="country" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>GSTIN</mat-label>
            <input matInput formControlName="gstin" style="text-transform:uppercase" />
            @if (form.get('gstin')?.errors?.['gstin'] && form.get('gstin')?.touched) {
              <mat-error>Invalid GSTIN format</mat-error>
            }
          </mat-form-field>
          <div class="row-2">
            <mat-form-field appearance="outline">
              <mat-label>Receiver Name</mat-label>
              <input matInput formControlName="receiver_name" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Receiver Phone</mat-label>
              <input matInput formControlName="receiver_phone" />
            </mat-form-field>
          </div>
        }

        <mat-checkbox formControlName="is_active" color="primary">Active</mat-checkbox>
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
    .dialog-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .full-width { width: 100%; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `]
})
export class OrgMasterDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private orgService = inject(OrgService);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<OrgMasterDialogComponent>);
  private http = inject(HttpClient);
  data: OrgMasterDialogData = inject(MAT_DIALOG_DATA);

  saving = signal(false);
  form!: FormGroup;
  users = signal<any[]>([]);

  indianStates = [
    { name: 'Andhra Pradesh', code: 'AP' },
    { name: 'Arunachal Pradesh', code: 'AR' },
    { name: 'Assam', code: 'AS' },
    { name: 'Bihar', code: 'BR' },
    { name: 'Chhattisgarh', code: 'CG' },
    { name: 'Goa', code: 'GA' },
    { name: 'Gujarat', code: 'GJ' },
    { name: 'Haryana', code: 'HR' },
    { name: 'Himachal Pradesh', code: 'HP' },
    { name: 'Jharkhand', code: 'JH' },
    { name: 'Karnataka', code: 'KA' },
    { name: 'Kerala', code: 'KL' },
    { name: 'Madhya Pradesh', code: 'MP' },
    { name: 'Maharashtra', code: 'MH' },
    { name: 'Manipur', code: 'MN' },
    { name: 'Meghalaya', code: 'ML' },
    { name: 'Mizoram', code: 'MZ' },
    { name: 'Nagaland', code: 'NL' },
    { name: 'Odisha', code: 'OD' },
    { name: 'Punjab', code: 'PB' },
    { name: 'Rajasthan', code: 'RJ' },
    { name: 'Sikkim', code: 'SK' },
    { name: 'Tamil Nadu', code: 'TN' },
    { name: 'Telangana', code: 'TG' },
    { name: 'Tripura', code: 'TR' },
    { name: 'Uttar Pradesh', code: 'UP' },
    { name: 'Uttarakhand', code: 'UK' },
    { name: 'West Bengal', code: 'WB' },
    { name: 'Andaman and Nicobar Islands', code: 'AN' },
    { name: 'Chandigarh', code: 'CH' },
    { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN' },
    { name: 'Delhi', code: 'DL' },
    { name: 'Jammu and Kashmir', code: 'JK' },
    { name: 'Ladakh', code: 'LA' },
    { name: 'Lakshadweep', code: 'LD' },
    { name: 'Puducherry', code: 'PY' }
  ];

  ngOnInit() {
    this.form = this.fb.group({
      name: [this.data.entity?.name || '', Validators.required],
      is_active: [this.data.entity ? this.data.entity.is_active : true]
    });

    if (this.data.type === 'department') {
      this.form.addControl('head_user_id', this.fb.control(this.data.entity?.head_user_id || null));
      this.http.get<any[]>(`${environment.apiUrl}/users`).subscribe({
        next: u => this.users.set(u),
        error: () => {}
      });
    }

    if (this.data.type === 'project') {
      this.form.addControl('end_date', this.fb.control(this.data.entity?.end_date || null));
    }

    if (this.data.type === 'location') {
      this.form.addControl('address', this.fb.control(this.data.entity?.address || ''));
      this.form.addControl('city', this.fb.control(this.data.entity?.city || ''));
      this.form.addControl('pincode', this.fb.control(this.data.entity?.pincode || ''));
      this.form.addControl('state', this.fb.control(this.data.entity?.state || ''));
      this.form.addControl('state_code', this.fb.control(this.data.entity?.state_code || ''));
      this.form.addControl('country', this.fb.control(this.data.entity?.country || 'India'));
      this.form.addControl('gstin', this.fb.control(this.data.entity?.gstin || '', gstinValidator()));
      this.form.addControl('receiver_name', this.fb.control(this.data.entity?.receiver_name || ''));
      this.form.addControl('receiver_phone', this.fb.control(this.data.entity?.receiver_phone || ''));
    }
  }

  onStateChange(stateName: string) {
    const s = this.indianStates.find(x => x.name === stateName);
    if (s) {
      this.form.get('state_code')?.setValue(s.code);
    } else {
      this.form.get('state_code')?.setValue('');
    }
  }

  getTitle() {
    if (this.data.type === 'department') return 'Department';
    if (this.data.type === 'project') return 'Project';
    return 'Location';
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);

    let req;
    const isEdit = !!this.data.entity;
    const id = this.data.entity?.id;
    const val = { ...this.form.value };

    if (val.end_date) {
      const d = new Date(val.end_date);
      val.end_date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    if (this.data.type === 'department') {
      req = isEdit ? this.orgService.updateDepartment(id!, val) : this.orgService.createDepartment(val);
    } else if (this.data.type === 'project') {
      req = isEdit ? this.orgService.updateProject(id!, val) : this.orgService.createProject(val);
    } else if (this.data.type === 'location') {
      req = isEdit ? this.orgService.updateLocation(id!, val) : this.orgService.createLocation(val);
    }

    req?.subscribe({
      next: () => {
        this.notify.success(`${this.getTitle()} saved successfully.`);
        this.dialogRef.close(true);
      },
      error: () => {
        this.notify.error(`Failed to save ${this.getTitle()}.`);
        this.saving.set(false);
      }
    });
  }
}
