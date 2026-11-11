import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { RateCard, grossPrice } from './rate-card-list.component';

interface Named {
  id: number; name: string; code?: string; global_vendor_code?: string;
  net_rate?: number | string; gst_rate?: number | string; unit?: string; is_active?: boolean;
}

@Component({
  selector: 'app-rate-card-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.card ? 'Edit Rate Card' : 'New Rate Card' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
          <mat-label>Vendor</mat-label>
          <input matInput readonly required [value]="vendor()?.name ?? ''" (click)="pickVendor()" [disabled]="!!data.card"
                 placeholder="Choose a vendor" />
          @if (!data.card) { <mat-icon matSuffix>search</mat-icon> }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="span-2">
          <mat-label>Product</mat-label>
          <input matInput readonly required [value]="product()?.name ?? ''" (click)="pickProduct()" [disabled]="!!data.card"
                 placeholder="Choose a product" />
          @if (!data.card) { <mat-icon matSuffix>search</mat-icon> }
          @if (product(); as p) {
            <mat-hint>Item master: ₹{{ +(p.net_rate ?? 0) | number:'1.2-2' }} / {{ p.unit || 'unit' }} · GST {{ gstRate() }}%</mat-hint>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Product Code</mat-label>
          <input matInput readonly disabled [value]="product()?.code || '—'" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>UOM</mat-label>
          <input matInput formControlName="uom" maxlength="20" placeholder="Nos" />
          <mat-hint>Fixed on PO lines</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>MOQ</mat-label>
          <input matInput type="number" min="0" step="any" formControlName="moq" />
          <mat-hint>Per PO, across lines</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>MRP (incl GST)</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput type="number" min="0" step="0.01" formControlName="mrp" />
          @if (aboveMrp()) { <mat-hint class="warn">Gross is above the MRP</mat-hint> }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Net Price (excl tax)</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput type="number" min="0.01" step="0.01" formControlName="net_rate" />
          <mat-hint>Fixed on PO lines</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Gross Price (incl tax)</mat-label>
          <span matTextPrefix>₹&nbsp;</span>
          <input matInput readonly disabled [value]="gross() == null ? '' : (gross() | number:'1.2-2')" />
          <mat-hint>Net + {{ gstRate() }}% GST</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Lead Time (days)</mat-label>
          <input matInput type="number" min="0" step="1" formControlName="lead_time_days" />
          <mat-hint>Fills "Required by"</mat-hint>
        </mat-form-field>

      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || !vendor() || !product() || aboveMrp() || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form {
      display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:8px 12px;
      padding-top:8px;
    }
    .span-2 { grid-column: 1 / -1; }
    .warn { color:#b91c1c; }
    input[readonly]:not([disabled]) { cursor:pointer; }
    @media (max-width: 600px) { .dialog-form { grid-template-columns: minmax(0, 1fr); } }
  `],
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

  private card = this.data.card;
  form = this.fb.group({
    uom:            [this.card?.uom ?? this.card?.product?.unit ?? '', [Validators.required, Validators.maxLength(20)]],
    moq:            [this.card?.moq != null ? +this.card.moq : null as number | null, Validators.min(0.001)],
    mrp:            [this.card?.mrp != null ? +this.card.mrp : null as number | null, Validators.min(0.01)],
    net_rate:       [this.card ? +this.card.net_rate : null as number | null, [Validators.required, Validators.min(0.01)]],
    lead_time_days: [this.card?.lead_time_days ?? null as number | null, [Validators.min(0), Validators.max(3650)]],
  });
  private values = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  private vendorId = signal<number | null>(this.card?.vendor_id ?? null);
  private productId = signal<number | null>(this.card?.product_id ?? null);

  vendor = computed(() => this.vendors().find(v => v.id === this.vendorId()) ?? this.card?.vendor ?? null);
  product = computed<Named | null>(() => this.products().find(p => p.id === this.productId()) ?? this.card?.product ?? null);
  gstRate = computed(() => +(this.product()?.gst_rate ?? 0));
  gross = computed(() => {
    const net = this.values().net_rate;
    return net ? grossPrice(net, this.gstRate()) : null;
  });
  aboveMrp = computed(() => {
    const mrp = this.values().mrp, gross = this.gross();
    return !!mrp && gross != null && gross > +mrp;
  });

  ngOnInit() {
    if (this.card) return;   // vendor and product are fixed once a card exists
    this.http.get<Named[]>(`${environment.apiUrl}/vendors`).subscribe(v => this.vendors.set(v.filter(x => x.is_active !== false)));
    this.http.get<Named[]>(`${environment.apiUrl}/products`).subscribe(p => this.products.set(p.filter(x => x.is_active !== false)));
  }

  pickVendor() {
    if (this.card) return;
    this.pick('Choose vendor', this.vendors().map(v => ({ id: v.id, name: v.name, sub: v.global_vendor_code })), this.vendorId(),
      id => this.vendorId.set(id));
  }

  pickProduct() {
    if (this.card) return;
    this.pick('Choose product', this.products().map(p => ({ id: p.id, name: p.name, sub: p.code, badge: p.unit })), this.productId(), id => {
      this.productId.set(id);
      this.form.patchValue({ uom: this.product()?.unit ?? '' });
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
    const body = { ...this.form.getRawValue(), vendor_id: this.vendorId(), product_id: this.productId() };
    const req = this.card
      ? this.http.put(`${environment.apiUrl}/rate-cards/${this.card.id}`, body)
      : this.http.post(`${environment.apiUrl}/rate-cards`, body);

    req.subscribe({
      next: () => { this.notify.success('Rate card saved.'); this.dialogRef.close(true); },
      error: (err: any) => {
        this.notify.error(err.error?.message || err.error?.error || 'Save failed.');
        this.saving.set(false);
      },
    });
  }
}
