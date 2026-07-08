import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { Product, Category } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';

interface FlatCat { id: number; name: string; parent_id: number | null; }

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
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="2"
                    placeholder="Optional details about this product"></textarea>
        </mat-form-field>

        <!-- Primary + Secondary category -->
        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Primary Category</mat-label>
            <mat-select formControlName="category_id">
              <mat-option [value]="null">— None —</mat-option>
              @for (c of primaryCategories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Secondary Category</mat-label>
            <mat-select formControlName="subcategory_id">
              <mat-option [value]="null">— None —</mat-option>
              @for (c of subcategories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
            @if (form.value.category_id && subcategories().length === 0) {
              <mat-hint>No sub-categories under this primary</mat-hint>
            } @else if (!form.value.category_id) {
              <mat-hint>Pick a primary category first</mat-hint>
            }
          </mat-form-field>
        </div>

        <div class="row-2">
          <mat-form-field appearance="outline">
            <mat-label>Unit *</mat-label>
            <mat-select formControlName="unit">
              @for (u of units; track u) {
                <mat-option [value]="u">{{ u }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (form.value.unit === 'Other') {
            <mat-form-field appearance="outline">
              <mat-label>Custom Unit Name *</mat-label>
              <input matInput formControlName="custom_unit" />
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>Warranty (months)</mat-label>
              <input matInput type="number" formControlName="warranty_months" min="0" />
            </mat-form-field>
          }
        </div>

        @if (form.value.unit === 'Other') {
          <div class="row-2">
            <mat-form-field appearance="outline">
              <mat-label>Warranty (months)</mat-label>
              <input matInput type="number" formControlName="warranty_months" min="0" />
            </mat-form-field>
            <div></div>
          </div>
        }
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
  units = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Pair', 'Sq.Ft', 'Hours', 'Other'];
  gstRates = [0, 5, 12, 18, 28];

  allCategories = signal<FlatCat[]>([]);
  subcategories = signal<FlatCat[]>([]);
  primaryCategories = computed(() => this.allCategories().filter(c => !c.parent_id));

  form = this.fb.group({
    code:            [this.data?.code ?? ''],
    name:            [this.data?.name ?? '', Validators.required],
    description:     [this.data?.description ?? ''],
    unit:            [this.data?.unit ?? 'Nos', Validators.required],
    custom_unit:     [''],
    hsn_code:        [this.data?.hsn_code ?? ''],
    category_id:     [this.data?.category_id ?? null],     // primary
    subcategory_id:  [this.data?.subcategory_id ?? null],  // secondary
    net_rate:        [this.data?.net_rate ?? 0, [Validators.required, Validators.min(0)]],
    gst_rate:        [this.data?.gst_rate ?? 18, Validators.required],
    warranty_months: [this.data?.warranty_months ?? 0],
  });

  ngOnInit() {
    // When the primary category changes, refresh the sub-category list and drop
    // any secondary that no longer belongs to the chosen primary.
    this.form.controls.category_id.valueChanges.subscribe(pid => {
      this.refreshSubcategories(pid ?? null);
      const sub = this.form.controls.subcategory_id.value;
      if (sub && !this.subcategories().some(s => s.id === sub)) {
        this.form.controls.subcategory_id.setValue(null);
      }
    });

    if (this.data && !['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Pair', 'Sq.Ft', 'Hours'].includes(this.data.unit ?? '')) {
      this.form.patchValue({
        unit: 'Other',
        custom_unit: this.data.unit
      });
    }

    this.http.get<Category[]>(`${environment.apiUrl}/categories`).subscribe(cats => {
      const flat: FlatCat[] = [];
      const walk = (list: Category[], parentId: number | null) => {
        for (const c of list) {
          flat.push({ id: c.id, name: c.name, parent_id: c.parent_id ?? parentId });
          if (c.children?.length) walk(c.children, c.id);
        }
      };
      walk(cats, null);
      this.allCategories.set(flat);
      this.resolveEditSelection();
    });
  }

  /**
   * Resolve primary/secondary on edit. Handles legacy products where the single
   * category_id may have actually pointed at a sub-category: in that case we
   * auto-tag the primary (parent) and move the value to secondary.
   */
  private resolveEditSelection() {
    let primary = this.form.controls.category_id.value ?? null;
    let secondary = this.form.controls.subcategory_id.value ?? null;

    if (!secondary && primary) {
      const cat = this.allCategories().find(c => c.id === primary);
      if (cat?.parent_id) {           // legacy: category_id was a child
        secondary = primary;
        primary = cat.parent_id;      // auto-tag the primary parent
      }
    }

    this.form.patchValue({ category_id: primary, subcategory_id: secondary }, { emitEvent: false });
    this.refreshSubcategories(primary);
  }

  private refreshSubcategories(primaryId: number | null) {
    this.subcategories.set(primaryId ? this.allCategories().filter(c => c.parent_id === primaryId) : []);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const val: any = { ...this.form.value };
    if (val.unit === 'Other') {
      val.unit = val.custom_unit || 'Other';
    }
    delete val.custom_unit;

    const req = this.data
      ? this.http.put(`${environment.apiUrl}/products/${this.data.id}`, val)
      : this.http.post(`${environment.apiUrl}/products`, val);

    req.subscribe({
      next: () => { this.notify.success(`Product ${this.data ? 'updated' : 'created'}.`); this.dialogRef.close(true); },
      error: () => { this.notify.error('Save failed.'); this.saving.set(false); },
    });
  }
}
