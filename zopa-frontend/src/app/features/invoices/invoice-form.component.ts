import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [
    DecimalPipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatCardModule,
    MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/invoices"><mat-icon>arrow_back</mat-icon></button>
          <div>
            <h2>New Invoice</h2>
            <p style="margin:0;font-size:12px;color:var(--text-3);">
              @if (selectedPo()) {
                PO: {{ selectedPo()!.po_number }} — Total: ₹{{ selectedPo()!.grand_total | number:'1.0-0' }}
                @if (alreadyInvoiced() > 0) {
                  &nbsp;·&nbsp; Already invoiced: ₹{{ alreadyInvoiced() | number:'1.0-0' }}
                }
              }
            </p>
          </div>
        </div>
        <button mat-raised-button color="primary" [disabled]="form.invalid || saving()" (click)="save()">
          @if (saving()) { <mat-spinner diameter="18" /> } @else { Save Invoice }
        </button>
      </div>

      <div class="form-section">
        <div class="section-label">Invoice Details</div>
        <form [formGroup]="form" class="fields-grid">

          <mat-form-field appearance="outline">
            <mat-label>Purchase Order *</mat-label>
            <mat-select formControlName="po_id" (selectionChange)="onPoSelect()">
              @for (po of releasedPos(); track po.id) {
                <mat-option [value]="po.id">{{ po.po_number ?? 'PO #' + po.id }} — {{ po.vendor?.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Invoice Type *</mat-label>
            <mat-select formControlName="invoice_type">
              <mat-option value="regular">Regular Invoice</mat-option>
              <mat-option value="advance">Advance Invoice</mat-option>
              <mat-option value="proforma">Proforma Invoice</mat-option>
            </mat-select>
            <mat-hint>Advance/Proforma don't reduce remaining balance</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>GRN (optional)</mat-label>
            <mat-select formControlName="grn_id">
              <mat-option [value]="null">— None —</mat-option>
              @for (g of grnsForPo(); track g.id) {
                <mat-option [value]="g.id">{{ g.grn_number }} ({{ g.received_date }})</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Invoice Number *</mat-label>
            <input matInput formControlName="invoice_number" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Vendor Invoice Ref</mat-label>
            <input matInput formControlName="vendor_invoice_ref" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Invoice Date *</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="invoice_date" />
            <mat-datepicker-toggle matSuffix [for]="dp" />
            <mat-datepicker #dp />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Invoice Amount (₹) *</mat-label>
            <span matPrefix>₹&nbsp;</span>
            <input matInput type="number" formControlName="amount" min="0" />
            @if (selectedPo()) {
              <mat-hint>Remaining: ₹{{ remainingBalance() | number:'1.0-0' }}</mat-hint>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Freight / Additional Charges (₹)</mat-label>
            <span matPrefix>₹&nbsp;</span>
            <input matInput type="number" formControlName="freight" min="0" />
            <mat-hint>Added to invoice total; included in PO balance check</mat-hint>
          </mat-form-field>

        </form>

        <mat-divider style="margin:12px 0;" />

        <!-- Invoice totals preview -->
        @if (invoiceTotal() > 0) {
          <div class="totals-row">
            <div class="total-item">
              <span class="total-label">Invoice Amount</span>
              <span>₹{{ form.value.amount | number:'1.2-2' }}</span>
            </div>
            @if (form.value.freight && form.value.freight > 0) {
              <div class="total-item">
                <span class="total-label">Freight</span>
                <span>₹{{ form.value.freight | number:'1.2-2' }}</span>
              </div>
            }
            <div class="total-item grand">
              <span class="total-label">Total Payable</span>
              <span>₹{{ invoiceTotal() | number:'1.2-2' }}</span>
            </div>
          </div>
        }

        <mat-form-field appearance="outline" style="width:100%;margin-top:12px;">
          <mat-label>Notes (internal)</mat-label>
          <textarea matInput formControlName="notes" rows="2" placeholder="Optional remarks…"></textarea>
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px; }
    .page-header h2 { margin:0; }
    .form-section {
      background:#ffffff;border:1px solid var(--border);border-radius:16px;
      padding:20px 24px 16px;box-shadow:0 2px 10px rgba(0,0,0,.05);
    }
    .section-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:14px; }
    .fields-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
    .fields-grid mat-form-field { width:100%; }
    .totals-row { display:flex;gap:24px;align-items:center;background:#f8faff;border-radius:8px;padding:12px 16px;flex-wrap:wrap; }
    .total-item { display:flex;flex-direction:column;gap:2px; }
    .total-label { font-size:10px;text-transform:uppercase;color:var(--text-3); }
    .total-item span:last-child { font-size:14px;font-weight:600;color:var(--text-1); }
    .total-item.grand span:last-child { font-size:18px;color:var(--brand); }
  `],
})
export class InvoiceFormComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private notify = inject(NotificationService);

  releasedPos  = signal<any[]>([]);
  grnsForPo    = signal<any[]>([]);
  saving       = signal(false);
  selectedPo   = signal<any | null>(null);
  alreadyInvoiced = signal(0);

  form = this.fb.group({
    po_id:              [null as number | null, Validators.required],
    grn_id:             [null as number | null],
    invoice_number:     ['', Validators.required],
    invoice_date:       [null as Date | null, Validators.required],
    vendor_invoice_ref: [''],
    invoice_type:       ['regular', Validators.required],
    amount:             [0, [Validators.required, Validators.min(0)]],
    freight:            [0],
    notes:              [''],
  });

  invoiceTotal = computed(() => {
    const amt = +(this.form.value.amount ?? 0);
    const freight = +(this.form.value.freight ?? 0);
    return amt + freight;
  });

  remainingBalance = computed(() => {
    const po = this.selectedPo();
    if (!po) return 0;
    return Math.max(0, po.grand_total - this.alreadyInvoiced());
  });

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/purchase-orders`).subscribe(res => {
      const pos: any[] = res.data ?? res;
      this.releasedPos.set(pos.filter(p => ['delivered', 'invoiced', 'released'].includes(p.status)));
    });
  }

  onPoSelect() {
    const poId = this.form.value.po_id;
    if (!poId) return;
    this.http.get<any[]>(`${environment.apiUrl}/purchase-orders/${poId}/grns`).subscribe(grns => {
      this.grnsForPo.set(grns);
    });
    const po = this.releasedPos().find(p => p.id === poId);
    if (po) {
      this.selectedPo.set(po);
      // Calculate already invoiced
      this.http.get<any>(`${environment.apiUrl}/invoices?po_id=${poId}`).subscribe(res => {
        const invs: any[] = res.data ?? res;
        const total = invs
          .filter(i => ['pending', 'approved'].includes(i.status))
          .reduce((sum, i) => sum + (+(i.amount || 0)) + (+(i.freight || 0)), 0);
        this.alreadyInvoiced.set(total);
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const val = this.form.value;
    const payload = {
      ...val,
      invoice_date: val.invoice_date instanceof Date
        ? val.invoice_date.toISOString().split('T')[0]
        : val.invoice_date,
    };
    this.http.post<any>(`${environment.apiUrl}/invoices`, payload).subscribe({
      next: inv => { this.notify.success('Invoice saved.'); this.router.navigate(['/invoices', inv.id]); },
      error: err => { this.notify.error(err.error?.error ?? err.error?.message ?? 'Save failed.'); this.saving.set(false); },
    });
  }
}
