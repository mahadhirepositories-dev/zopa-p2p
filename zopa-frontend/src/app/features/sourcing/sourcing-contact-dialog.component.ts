import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { SourcingVendorContact, Vendor } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';

export interface SourcingContactDialogData {
  sourcingRequestId: number;
  contact?: SourcingVendorContact | null;
}

@Component({
  selector: 'app-sourcing-contact-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="header-icon">
          <mat-icon>{{ isEdit() ? 'edit' : 'person_add' }}</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title style="margin:0;font-size:18px;font-weight:700;">
            {{ isEdit() ? 'Edit Vendor Contact & Quote' : 'Add Vendor Contact & Quote' }}
          </h2>
          <p style="margin:2px 0 0;font-size:12px;color:var(--text-3);">
            Record vendor quotation, contact details, and terms
          </p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content style="padding-top:16px!important;max-height:75vh;">
      <form [formGroup]="form" class="contact-form">

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Vendor / Company Name *</mat-label>
            <input matInput formControlName="vendor_name" placeholder="e.g. Mukesh Interlining House" />
            <mat-error>Vendor name is required</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Contact Person</mat-label>
            <input matInput formControlName="contact_person" placeholder="e.g. Rajesh Kumar" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Phone Number</mat-label>
            <input matInput formControlName="phone" placeholder="e.g. +91 9876543210" />
          </mat-form-field>
        </div>

        <div class="form-row two-col">
          <mat-form-field appearance="outline">
            <mat-label>Email Address</mat-label>
            <input matInput formControlName="email" type="email" placeholder="vendor@example.com" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Quoted Price (₹)</mat-label>
            <input matInput formControlName="quoted_price" type="number" min="0" step="0.01" placeholder="0.00" />
          </mat-form-field>
        </div>

        <div class="form-row three-col">
          <mat-form-field appearance="outline">
            <mat-label>GST Rate (%)</mat-label>
            <mat-select formControlName="gst_rate">
              <mat-option [value]="0">0%</mat-option>
              <mat-option [value]="5">5%</mat-option>
              <mat-option [value]="12">12%</mat-option>
              <mat-option [value]="18">18%</mat-option>
              <mat-option [value]="28">28%</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Lead Time (Days)</mat-label>
            <input matInput formControlName="lead_time_days" type="number" min="0" placeholder="e.g. 7" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Payment Terms</mat-label>
            <input matInput formControlName="payment_terms" placeholder="e.g. 50% Adv, 50% 30d" />
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Notes / Quote Remarks</mat-label>
            <textarea matInput formControlName="notes" rows="2" placeholder="e.g. Price valid till end of month, inclusive of freight..."></textarea>
          </mat-form-field>
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding:16px 24px;">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">
        @if (saving()) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px;" /> }
        {{ isEdit() ? 'Save Changes' : 'Add Contact & Quote' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header { display:flex; justify-content:space-between; align-items:center; padding:18px 24px 10px; }
    .header-icon { width:38px; height:38px; border-radius:10px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; }
    .contact-form { display:flex; flex-direction:column; gap:6px; }
    .form-row { width:100%; }
    .full-width { width:100%; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .three-col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  `]
})
export class SourcingContactDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<SourcingContactDialogComponent>);

  saving = signal(false);
  isEdit = signal(false);

  form: FormGroup = this.fb.group({
    vendor_name: ['', Validators.required],
    contact_person: [''],
    phone: [''],
    email: [''],
    quoted_price: [null],
    gst_rate: [null],
    lead_time_days: [null],
    payment_terms: [''],
    notes: [''],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: SourcingContactDialogData) {}

  ngOnInit() {
    if (this.data.contact) {
      this.isEdit.set(true);
      this.form.patchValue({
        vendor_name: this.data.contact.vendor_name,
        contact_person: this.data.contact.contact_person,
        phone: this.data.contact.phone,
        email: this.data.contact.email,
        quoted_price: this.data.contact.quoted_price,
        gst_rate: this.data.contact.gst_rate,
        lead_time_days: this.data.contact.lead_time_days,
        payment_terms: this.data.contact.payment_terms,
        notes: this.data.contact.notes,
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const body = this.form.value;
    const reqId = this.data.sourcingRequestId;

    if (this.isEdit()) {
      const contactId = this.data.contact!.id;
      this.http.put<{ message: string; data: SourcingVendorContact }>(
        `${environment.apiUrl}/sourcing/${reqId}/contacts/${contactId}`,
        body
      ).subscribe({
        next: res => {
          this.saving.set(false);
          this.notify.success(res.message || 'Vendor contact updated.');
          this.dialogRef.close(res.data);
        },
        error: err => {
          this.saving.set(false);
          this.notify.error(err.error?.message || 'Failed to update vendor contact.');
        }
      });
    } else {
      this.http.post<{ message: string; data: SourcingVendorContact }>(
        `${environment.apiUrl}/sourcing/${reqId}/contacts`,
        body
      ).subscribe({
        next: res => {
          this.saving.set(false);
          this.notify.success(res.message || 'Vendor contact added.');
          this.dialogRef.close(res.data);
        },
        error: err => {
          this.saving.set(false);
          this.notify.error(err.error?.message || 'Failed to add vendor contact.');
        }
      });
    }
  }
}
