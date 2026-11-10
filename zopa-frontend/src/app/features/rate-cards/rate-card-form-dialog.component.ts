import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { SearchSelectDialogComponent, SearchSelectOption } from '../../shared/components/search-select-dialog.component';
import { RateCard } from './rate-card-list.component';

interface Named { id: number; name: string; code?: string; global_vendor_code?: string; net_rate?: number | string; unit?: string; is_active?: boolean; }

@Component({
  selector: 'app-rate-card-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.card ? 'Edit Rate Card' : 'New Rate Card' }}</h2>
    <mat-dialog-content style="min-width:min(400px, 80vw);">
      <form [formGroup]="form" class="dialog-form">

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vendor *</mat-label>
          <input matInput readonly [value]="vendorLabel()" (click)="pickVendor()" [disabled]="!!data.card"
                 placeholder="Choose a vendor" />
          @if (!data.card) { <mat-icon matSuffix>search</mat-icon> }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Product *</mat-label>
          <input matInput readonly [value]="productLabel()" (click)="pickProduct()" [disabled]="!!data.card"
                 placeholder="Choose a product" />
          @if (!data.card) { <mat-icon matSuffix>search</mat-icon> }
          @if (product(); as p) {
            <mat-hint>Product master rate: ₹{{ +(p.net_rate ?? 0) | number:'1.2-2' }}{{ p.unit ? ' per ' + p.unit : '' }}</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vendor's rate (₹, before GST)</mat-label>
          <input matInput type="number" min="0.01" step="0.01" formControlName="net_rate" />
          <mat-hint>POs for this vendor and product use this rate, and it can't be changed on the PO.</mat-hint>
        </mat-form-field>

      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.dialog-form { display:flex; flex-direction:column; gap:12px; padding-top:8px; } .full-width { width:100%; } input[readonly] { cursor:pointer; }`],
})
export class RateCardFormDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<RateCardFormDialogComponent>);
  data: { card: RateCard | null } = inject(MAT_DIALOG_DATA);

  saving = signal(false);
  vendors = signal<Named[]>([]);
  products = signal<Named[]>([]);

  form = this.fb.group({
    vendor_id:  [this.data.card?.vendor_id ?? null as number | null, Validators.required],
    product_id: [this.data.card?.product_id ?? null as number | null, Validators.required],
    net_rate:   [this.data.card ? +this.data.card.net_rate : null as number | null, [Validators.required, Validators.min(0.01)]],
  });
  private vendorId = signal(this.form.value.vendor_id ?? null);
  private productId = signal(this.form.value.product_id ?? null);

  vendor = computed(() => this.vendors().find(v => v.id === this.vendorId()) ?? this.data.card?.vendor ?? null);
  product = computed(() => this.products().find(p => p.id === this.productId()) ?? this.data.card?.product ?? null);
  vendorLabel = computed(() => this.vendor()?.name ?? '');
  productLabel = computed(() => {
    const p = this.product();
    return p ? (p.code ? `${p.code} · ${p.name}` : p.name) : '';
  });

  ngOnInit() {
    if (this.data.card) return;   // vendor and product are fixed once a card exists
    this.http.get<Named[]>(`${environment.apiUrl}/vendors`).subscribe(v => this.vendors.set(v.filter(x => x.is_active !== false)));
    this.http.get<Named[]>(`${environment.apiUrl}/products`).subscribe(p => this.products.set(p.filter(x => x.is_active !== false)));
  }

  pickVendor() {
    if (this.data.card) return;
    this.pick('Choose vendor', this.vendors().map(v => ({ id: v.id, name: v.name, sub: v.global_vendor_code })), this.vendorId(), id => {
      this.vendorId.set(id);
      this.form.patchValue({ vendor_id: id });
    });
  }

  pickProduct() {
    if (this.data.card) return;
    this.pick('Choose product', this.products().map(p => ({ id: p.id, name: p.name, sub: p.code, badge: p.unit })), this.productId(), id => {
      this.productId.set(id);
      this.form.patchValue({ product_id: id });
    });
  }

  private pick(title: string, options: SearchSelectOption[], currentId: number | null, done: (id: number) => void) {
    this.dialog.open(SearchSelectDialogComponent, {
      width: '460px', maxWidth: '92vw', autoFocus: 'input', position: { top: '12vh' },
      data: { title, options, currentId },
    }).afterClosed().subscribe((id: number | undefined) => { if (id != null) done(id); });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const req = this.data.card
      ? this.http.put(`${environment.apiUrl}/rate-cards/${this.data.card.id}`, { net_rate: this.form.value.net_rate })
      : this.http.post(`${environment.apiUrl}/rate-cards`, this.form.value);

    req.subscribe({
      next: () => { this.notify.success('Rate card saved.'); this.dialogRef.close(true); },
      error: (err: any) => {
        this.notify.error(err.error?.message || err.error?.error || 'Save failed.');
        this.saving.set(false);
      },
    });
  }
}
