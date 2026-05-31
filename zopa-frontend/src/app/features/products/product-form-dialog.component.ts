import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Product, Category } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-product-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Product' : 'New Product' }}</h2>
    <mat-dialog-content style="min-width:480px;">
      <form [formGroup]="form" class="dialog-form">
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Product Code</mat-label>
            <input matInput formControlName="code" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>HSN Code</mat-label>
            <input matInput formControlName="hsn_code" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Product Name *</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category_id">
            <mat-option [value]="null">— None —</mat-option>
            @for (cat of flatCategories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Unit *</mat-label>
            <mat-select formControlName="unit">
              @for (u of units; track u) {
                <mat-option [value]="u">{{ u }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Warranty (months)</mat-label>
            <input matInput type="number" formControlName="warranty_months" min="0" />
          </mat-form-field>
        </div>
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Net Rate (₹)</mat-label>
            <input matInput type="number" formControlName="net_rate" min="0" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>GST Rate (%)</mat-label>
            <mat-select formControlName="gst_rate">
              @for (r of gstRates; track r) {
                <mat-option [value]="r">{{ r }}%</mat-option>
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
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .full-width { width: 100%; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `],
})
export class ProductFormDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<ProductFormDialogComponent>);
  data: Product | null = inject(MAT_DIALOG_DATA);

  saving = signal(false);
  categories = signal<Category[]>([]);
  units = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Pair', 'Sq.Ft', 'Hours'];
  gstRates = [0, 5, 12, 18, 28];

  flatCategories = signal<{ id: number; name: string }[]>([]);

  form = this.fb.group({
    code:            [this.data?.code ?? ''],
    name:            [this.data?.name ?? '', Validators.required],
    unit:            [this.data?.unit ?? 'Nos', Validators.required],
    hsn_code:        [this.data?.hsn_code ?? ''],
    category_id:     [this.data?.category_id ?? null],
    net_rate:        [this.data?.net_rate ?? 0, [Validators.required, Validators.min(0)]],
    gst_rate:        [this.data?.gst_rate ?? 18, Validators.required],
    warranty_months: [this.data?.warranty_months ?? 0],
  });

  ngOnInit() {
    this.http.get<Category[]>(`${environment.apiUrl}/categories`).subscribe(cats => {
      const flat: { id: number; name: string }[] = [];
      const prefixes = ['', '↳ ', '↳↳ '];
      const flatten = (list: Category[], depth = 0) => {
        for (const c of list) {
          flat.push({ id: c.id, name: (prefixes[depth] ?? '↳↳ ') + c.name });
          if (c.children?.length) flatten(c.children, depth + 1);
        }
      };
      flatten(cats);
      this.flatCategories.set(flat);
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const req = this.data
      ? this.http.put(`${environment.apiUrl}/products/${this.data.id}`, this.form.value)
      : this.http.post(`${environment.apiUrl}/products`, this.form.value);

    req.subscribe({
      next: () => { this.notify.success(`Product ${this.data ? 'updated' : 'created'}.`); this.dialogRef.close(true); },
      error: () => { this.notify.error('Save failed.'); this.saving.set(false); },
    });
  }
}
