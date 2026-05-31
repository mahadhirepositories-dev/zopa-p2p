import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Category, Vendor } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { gstinValidator, panValidator, phoneValidator } from '../../core/validators';

@Component({
  selector: 'app-vendor-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Vendor' : 'New Vendor' }}</h2>
    <mat-dialog-content style="min-width:480px;">
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vendor Name *</mat-label>
          <input matInput formControlName="name" />
          @if (form.get('name')?.errors?.['required'] && form.get('name')?.touched) {
            <mat-error>Name is required</mat-error>
          }
        </mat-form-field>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>PAN</mat-label>
            <input matInput formControlName="pan" maxlength="10" style="text-transform:uppercase" />
            <mat-hint>e.g. ABCDE1234F</mat-hint>
            @if (form.get('pan')?.errors?.['pan'] && form.get('pan')?.touched) {
              <mat-error>Invalid PAN (e.g. ABCDE1234F)</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>GSTIN</mat-label>
            <input matInput formControlName="gstin" maxlength="15" style="text-transform:uppercase" />
            <mat-hint>e.g. 29ABCDE1234F1Z5</mat-hint>
            @if (form.get('gstin')?.errors?.['gstin'] && form.get('gstin')?.touched) {
              <mat-error>Invalid GSTIN format</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Contact Email</mat-label>
            <input matInput formControlName="email" type="email" />
            @if (form.get('email')?.errors?.['email'] && form.get('email')?.touched) {
              <mat-error>Invalid email address</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Contact Phone</mat-label>
            <input matInput formControlName="phone" maxlength="10" />
            <mat-hint>10-digit mobile number</mat-hint>
            @if (form.get('phone')?.errors?.['phone'] && form.get('phone')?.touched) {
              <mat-error>Invalid phone (10-digit, starts 6–9)</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="two-col">
          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="category_id" (selectionChange)="onCategoryChange()">
              <mat-option [value]="null">— None —</mat-option>
              @for (cat of categories(); track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Subcategory</mat-label>
            <mat-select formControlName="subcategory_id" [disabled]="!subcategories().length">
              <mat-option [value]="null">— None —</mat-option>
              @for (sub of subcategories(); track sub.id) {
                <mat-option [value]="sub.id">{{ sub.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.dialog-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; } .full-width { width: 100%; } .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }`],
})
export class VendorFormDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<VendorFormDialogComponent>);
  data: Vendor | null = inject(MAT_DIALOG_DATA);

  saving = signal(false);
  categories = signal<Category[]>([]);
  subcategories = signal<Category[]>([]);

  form = this.fb.group({
    name:           [this.data?.name          ?? '', Validators.required],
    pan:            [this.data?.pan           ?? '', panValidator()],
    gstin:          [this.data?.gstin         ?? '', gstinValidator()],
    email:          [this.data?.email         ?? '', Validators.email],
    phone:          [this.data?.phone         ?? '', phoneValidator()],
    category_id:    [this.data?.category_id   ?? null],
    subcategory_id: [this.data?.subcategory_id ?? null],
  });

  ngOnInit() {
    // API returns top-level categories with nested children
    this.http.get<Category[]>(`${environment.apiUrl}/categories`).subscribe(cats => {
      this.categories.set(cats);
      // Pre-populate subcategories if editing
      const catId = this.data?.category_id;
      if (catId) {
        const parent = cats.find(c => c.id === catId);
        this.subcategories.set(parent?.children ?? []);
      }
    });
  }

  onCategoryChange() {
    const catId = this.form.get('category_id')?.value as number | null;
    this.form.patchValue({ subcategory_id: null });
    if (catId) {
      const parent = this.categories().find(c => c.id === catId);
      this.subcategories.set(parent?.children ?? []);
    } else {
      this.subcategories.set([]);
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const payload = this.form.value;
    const req = this.data
      ? this.http.put<Vendor>(`${environment.apiUrl}/vendors/${this.data.id}`, payload)
      : this.http.post<Vendor>(`${environment.apiUrl}/vendors`, payload);

    req.subscribe({
      next: () => {
        this.notify.success(`Vendor ${this.data ? 'updated' : 'created'}.`);
        this.dialogRef.close(true);
      },
      error: () => { this.notify.error('Save failed.'); this.saving.set(false); },
    });
  }
}
