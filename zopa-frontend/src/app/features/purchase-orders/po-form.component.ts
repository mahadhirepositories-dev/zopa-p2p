import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { environment } from '../../../environments/environment';
import { Vendor, VendorAddress, Product, CostCenter, Location, Budget, PaymentTerm, Category } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { BulkImportService } from '../../core/services/bulk-import.service';

@Component({
  selector: 'app-po-form',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatCardModule, MatDividerModule, MatProgressSpinnerModule,
    MatTooltipModule, MatProgressBarModule, MatChipsModule,
  ],
  template: `
    <div class="page-wrapper">
      <!-- Header -->
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/purchase-orders"><mat-icon>arrow_back</mat-icon></button>
          <div>
            <h2>{{ poId() ? 'Edit Purchase Order' : 'New Purchase Order' }}</h2>
            <p style="margin:0;font-size:12px;color:var(--text-3);">
              PO Date: {{ today | date:'dd MMM yyyy' }}
              @if (poId()) { &nbsp;·&nbsp; Draft }
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button mat-stroked-button [disabled]="saving()" (click)="save('draft')">
            @if (saving() === 'draft') { <mat-spinner diameter="18" /> } @else { Save Draft }
          </button>
          <button mat-raised-button color="primary"
                  [disabled]="!!saving() || headerForm.invalid || items.length === 0"
                  (click)="save('submit')">
            @if (saving() === 'submit') { <mat-spinner diameter="18" /> } @else { Save &amp; Submit }
          </button>
        </div>
      </div>

      <!-- PR source banner -->
      @if (prSource()) {
        <div style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#166534;">
          <mat-icon style="font-size:16px;width:16px;height:16px;">description</mat-icon>
          <span>Pre-filled from <strong>Purchase Requisition #{{ prSource() }}</strong>. Review and add vendor details before submitting.</span>
        </div>
      }

      <!-- Budget banner -->
      @if (budget()) {
        <div class="budget-banner" [class.budget-warn]="budgetWarn()">
          <mat-icon>{{ budgetWarn() ? 'warning' : 'account_balance_wallet' }}</mat-icon>
          <span>
            <strong>Budget:</strong> ₹{{ budget()!.available | number:'1.0-0' }} available
            of ₹{{ budget()!.annual | number:'1.0-0' }}
          </span>
          @if (grandTotal() > 0) {
            <span class="po-total-badge"
                  [style.background]="budgetWarn() ? '#dc2626' : 'var(--brand)'">
              This PO: ₹{{ grandTotal() | number:'1.0-0' }}
            </span>
          }
          <mat-progress-bar mode="determinate" [value]="budgetUsed()"
                            [color]="budgetWarn() ? 'warn' : 'primary'"
                            style="flex:1;max-width:220px;margin-left:auto;" />
        </div>
      }

      <!-- ═══════════════════ SECTION 1: PO Header ═══════════════════ -->
      <mat-card class="form-card">
        <mat-card-header><mat-card-title>PO Details</mat-card-title></mat-card-header>
        <mat-card-content style="padding-top:16px;">
          <form [formGroup]="headerForm">

            <div class="form-row">
              <mat-form-field appearance="outline" class="field-wide">
                <mat-label>Purchase Requisition Ref</mat-label>
                <input matInput formControlName="pr_reference"
                       placeholder="e.g. PR-2026-0045 or free text" />
                <mat-icon matPrefix style="color:var(--text-3);">receipt</mat-icon>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="field-wide">
                <mat-label>Vendor *</mat-label>
                <mat-select formControlName="vendor_id" (selectionChange)="onVendorChange()">
                  @for (v of vendors(); track v.id) {
                    <mat-option [value]="v.id">{{ v.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="field-wide">
                <mat-label>Vendor Address (Billing State)</mat-label>
                <mat-select formControlName="vendor_address_id"
                            (selectionChange)="onVendorAddressChange()"
                            [disabled]="!vendorAddresses().length">
                  @for (a of vendorAddresses(); track a.id) {
                    <mat-option [value]="a.id">
                      {{ a.label }} — {{ a.state }}
                      @if (a.gstin) { · {{ a.gstin }} }
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            @if (selectedVendor()) {
              <div class="info-strip">
                <span class="info-chip">
                  <mat-icon>business</mat-icon>
                  <span>
                    {{ selectedVendor()!.name }}
                    @if (selectedVendor()!.gstin) { · GSTIN: <strong>{{ selectedVendor()!.gstin }}</strong> }
                    @if (selectedVendor()!.pan) { · PAN: {{ selectedVendor()!.pan }} }
                  </span>
                </span>
                @if (selectedAddress()) {
                  <span class="info-chip accent">
                    <mat-icon>location_on</mat-icon>
                    <span>
                      {{ selectedAddress()!.state }}
                      @if (selectedAddress()!.gstin) { · GSTIN: <strong>{{ selectedAddress()!.gstin }}</strong> }
                    </span>
                  </span>
                }
              </div>
            }

            <div class="form-row">
              <mat-form-field appearance="outline" class="field-wide">
                <mat-label>Cost Center *</mat-label>
                <mat-select formControlName="cost_center_id"
                            (selectionChange)="onCostCenterChange()">
                  @for (cc of costCenters(); track cc.id) {
                    <mat-option [value]="cc.id">{{ cc.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="field-wide">
                <mat-label>Bill-to Location</mat-label>
                <mat-select formControlName="bill_to_location_id"
                            (selectionChange)="onBillToChange()">
                  @for (l of locations(); track l.id) {
                    <mat-option [value]="l.id">{{ l.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="field-wide">
                <mat-label>Ship-to Location</mat-label>
                <mat-select formControlName="ship_to_location_id" (selectionChange)="onShipToChange()">
                  @for (l of locations(); track l.id) {
                    <mat-option [value]="l.id">{{ l.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            @if (selectedCostCenter() || selectedBillTo()) {
              <div class="info-strip">
                @if (selectedCostCenter()) {
                  <span class="info-chip">
                    <mat-icon>folder_special</mat-icon>
                    <span>
                      @if (selectedCostCenter()!.department) {
                        Dept: <strong>{{ selectedCostCenter()!.department!.name }}</strong>
                      }
                      @if (selectedCostCenter()!.project) {
                        &nbsp;·&nbsp; Project: <strong>{{ selectedCostCenter()!.project!.name }}</strong>
                      }
                      @if (selectedCostCenter()!.location) {
                        &nbsp;·&nbsp; {{ selectedCostCenter()!.location!.name }}
                      }
                    </span>
                  </span>
                }
              </div>
            }

            <!-- Full Bill-to / Ship-to address preview (exactly what prints on the PO) -->
            @if (selectedBillTo() || selectedShipTo()) {
              <div class="addr-preview">
                @if (selectedBillTo(); as b) {
                  <div class="addr-card">
                    <div class="addr-head"><mat-icon>apartment</mat-icon> Bill To</div>
                    <div class="addr-name">{{ b.name }}</div>
                    @if (b.address) { <div>{{ b.address }}</div> }
                    @if (addrLine(b)) { <div>{{ addrLine(b) }}</div> }
                    @if (b.country) { <div>{{ b.country }}</div> }
                    @if (b.gstin) { <div class="addr-gstin">GSTIN: {{ b.gstin }}</div> }
                  </div>
                }
                @if (selectedShipTo(); as s) {
                  <div class="addr-card">
                    <div class="addr-head"><mat-icon>local_shipping</mat-icon> Ship To</div>
                    <div class="addr-name">{{ s.name }}</div>
                    @if (s.address) { <div>{{ s.address }}</div> }
                    @if (addrLine(s)) { <div>{{ addrLine(s) }}</div> }
                    @if (s.country) { <div>{{ s.country }}</div> }
                    @if (s.gstin) { <div class="addr-gstin">GSTIN: {{ s.gstin }}</div> }
                  </div>
                } @else if (selectedBillTo()) {
                  <div class="addr-card addr-card--muted">
                    <div class="addr-head"><mat-icon>local_shipping</mat-icon> Ship To</div>
                    <div>Same as Bill To</div>
                  </div>
                }
              </div>
            }

            <!-- Row 4: Valid Till + Freight -->
            <div class="form-row">
              <mat-form-field appearance="outline" class="field-md">
                <mat-label>PO Valid Till *</mat-label>
                <input matInput [matDatepicker]="picker1" formControlName="po_valid_till"
                       [min]="today" />
                <mat-datepicker-toggle matSuffix [for]="picker1" />
                <mat-datepicker #picker1 />
                <mat-hint>Cannot be a past date</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="field-sm">
                <mat-label>Freight (₹)</mat-label>
                <span matPrefix>₹&nbsp;</span>
                <input matInput type="number" formControlName="freight" min="0"
                       (input)="recalc()" />
              </mat-form-field>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- ═══════════════════ SECTION 2: Line Items ═══════════════════ -->
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Line Items</mat-card-title>
          <div style="flex:1"></div>
          <button mat-stroked-button type="button" (click)="downloadBoqTemplate()"
                  matTooltip="Download the BOQ (line items) Excel template" style="margin-right:8px;">
            <mat-icon>download</mat-icon> BOQ Template
          </button>
          <button mat-stroked-button type="button" [disabled]="boqUploading()" (click)="boqInput.click()"
                  matTooltip="Bulk upload line items from a filled-in BOQ template" style="margin-right:8px;">
            @if (boqUploading()) { <mat-spinner diameter="18" /> } @else { <mat-icon>upload_file</mat-icon> }
            Upload BOQ
          </button>
          <input #boqInput type="file" hidden accept=".xlsx,.xls,.csv" (change)="uploadBoq($event)" />
          <button mat-raised-button color="primary" (click)="addItem()">
            <mat-icon>add</mat-icon> Add Item
          </button>
        </mat-card-header>
        <mat-card-content style="padding-top:16px;overflow-x:auto;">

          @if (items.length === 0) {
            <div class="empty-items">
              <mat-icon>add_shopping_cart</mat-icon>
              <p>No items yet. Click "Add Item" to begin.</p>
            </div>
          }

          @for (item of items.controls; track i; let i = $index) {
            <div [formGroup]="asGroup(item)" class="line-item">

              <!-- Row 1: Num + Product + Description + Category -->
              <div class="item-row1">
                <div class="item-num">{{ i + 1 }}</div>

                <mat-form-field appearance="outline" class="field-product">
                  <mat-label>Product</mat-label>
                  <mat-select formControlName="product_id"
                              (selectionChange)="onProductSelect(i)">
                    <mat-option [value]="null">— Custom Item —</mat-option>
                    @for (p of products(); track p.id) {
                      <mat-option [value]="p.id">
                        {{ p.name }}
                        @if (p.code) { ({{ p.code }}) }
                      </mat-option>
                    }
                  </mat-select>
                  @if (getProductCode(i)) {
                    <mat-hint>Code: {{ getProductCode(i) }}
                      @if (getProductHsn(i)) { · HSN: {{ getProductHsn(i) }} }
                    </mat-hint>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline" style="flex:2;min-width:180px;">
                  <mat-label>Item Description / Specification *</mat-label>
                  <textarea matInput formControlName="description" rows="2"
                            placeholder="e.g. i9 12th gen 16gb 512 SSD, or full item spec"
                            style="resize:vertical;"></textarea>
                  <mat-hint>This text appears on the PO document and PDF</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" style="flex:1;min-width:140px;">
                  <mat-label>Category</mat-label>
                  <mat-select formControlName="category_id">
                    <mat-option [value]="null">— None —</mat-option>
                    @for (cat of flatCategories(); track cat.id) {
                      <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Row 2: Qty + Net Rate + GST + Gross Rate + Amount + Warranty + Required By + Delete -->
              <div class="item-row2">
                <div style="width:24px;flex-shrink:0;"></div>

                <mat-form-field appearance="outline" class="field-xs">
                  <mat-label>Qty *</mat-label>
                  <input matInput type="number" formControlName="qty"
                         min="0.001" (input)="recalcItem(i)" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-rate">
                  <mat-label>Net Rate *</mat-label>
                  <span matPrefix>₹&nbsp;</span>
                  <input matInput type="number" formControlName="net_rate"
                         min="0" (input)="recalcItem(i)" />
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-xs">
                  <mat-label>GST %</mat-label>
                  <mat-select formControlName="gst_rate"
                              (selectionChange)="recalcItem(i)">
                    @for (r of gstRates; track r) {
                      <mat-option [value]="r">{{ r }}%</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <div class="item-calc">
                  <span class="calc-label">Gross Rate</span>
                  <span class="calc-val">₹{{ grossRate(i) | number:'1.2-2' }}</span>
                </div>

                <div class="item-calc amount-col">
                  <span class="calc-label">Amount</span>
                  <span class="calc-val amount-val">₹{{ itemAmount(i) | number:'1.2-2' }}</span>
                </div>

                <mat-form-field appearance="outline" style="width:130px;min-width:120px;">
                  <mat-label>Warranty</mat-label>
                  <mat-select formControlName="warranty_months">
                    <mat-option [value]="0">N/A</mat-option>
                    <mat-option [value]="3">3 months</mat-option>
                    <mat-option [value]="6">6 months</mat-option>
                    <mat-option [value]="12">12 months</mat-option>
                    <mat-option [value]="24">24 months</mat-option>
                    <mat-option [value]="36">36 months</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="field-date">
                  <mat-label>Required By</mat-label>
                  <input matInput [matDatepicker]="dp" formControlName="required_by" />
                  <mat-datepicker-toggle matSuffix [for]="dp" />
                  <mat-datepicker #dp />
                </mat-form-field>

                <button mat-icon-button color="warn" matTooltip="Remove item"
                        (click)="removeItem(i)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- ═══════════════════ SECTION 3: Payment Terms + Totals ═══════════════════ -->
      <div class="two-panel">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Payment Terms</mat-card-title>
            <div style="flex:1"></div>
            @if (paymentTerms.length > 0) {
              <div class="terms-total" [class.terms-over]="paymentTotal > 100" [class.terms-ok]="paymentTotal === 100">
                Total: {{ paymentTotal }}%
                @if (paymentTotal > 100) { ⚠️ Exceeds 100% }
                @if (paymentTotal === 100) { ✓ }
              </div>
            }
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            @for (term of paymentTerms.controls; track i; let i = $index) {
              <div [formGroup]="asGroup(term)" class="term-row">
                <mat-form-field appearance="outline" style="flex:2;">
                  <mat-label>Stage</mat-label>
                  <input matInput formControlName="stage"
                         placeholder="e.g. Advance, On Delivery" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-xs">
                  <mat-label>%</mat-label>
                  <input matInput type="number" formControlName="percentage"
                         min="0" max="100" (input)="onTermChange()" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="field-xs">
                  <mat-label>Credit Days</mat-label>
                  <input matInput type="number" formControlName="credit_days"
                         min="0" />
                </mat-form-field>
                <button mat-icon-button color="warn" (click)="removeTerm(i)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            }
            @if (paymentTotal > 100) {
              <div class="terms-warn">
                <mat-icon>warning</mat-icon>
                Payment terms exceed 100%. Please adjust percentages.
              </div>
            }
            <button mat-stroked-button (click)="addTerm()"
                    [disabled]="paymentTotal >= 100"
                    style="width:100%;margin-top:8px;">
              <mat-icon>add</mat-icon> Add Payment Stage
            </button>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header><mat-card-title>Financial Summary</mat-card-title></mat-card-header>
          <mat-card-content style="padding-top:16px;">
            <div class="totals-table">
              <div class="totals-row">
                <span>Net Total</span><span>₹{{ netTotal() | number:'1.2-2' }}</span>
              </div>
              <div class="totals-row">
                <span>Freight</span><span>₹{{ freight() | number:'1.2-2' }}</span>
              </div>
              <div class="totals-row">
                <span>GST (IGST / CGST+SGST)</span>
                <span>₹{{ taxAmount() | number:'1.2-2' }}</span>
              </div>
              <div class="totals-row grand">
                <span>Grand Total</span>
                <span>₹{{ grandTotal() | number:'1.2-2' }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- ═══════════════════ SECTION 4: Terms & Conditions ═══════════════════ -->
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Terms &amp; Conditions</mat-card-title>
          <div style="flex:1"></div>
          <button mat-stroked-button style="margin-right:8px;"
                  [disabled]="suggestingTerms() || items.length === 0"
                  (click)="suggestTerms()"
                  matTooltip="AI will suggest T&C based on your line items and categories">
            @if (suggestingTerms()) { <mat-spinner diameter="18" /> } @else { <mat-icon>auto_awesome</mat-icon> }
            Ask AI
          </button>
        </mat-card-header>
        <mat-card-content style="padding-top:12px;">
          <mat-form-field appearance="outline" class="full-width">
            <textarea matInput [formControl]="tcControl" rows="8"
                      placeholder="Enter or paste terms and conditions, or click 'Ask AI' to auto-generate…"></textarea>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <!-- ═══════════════════ SECTION 5: Attachments ═══════════════════ -->
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Attachments</mat-card-title>
        </mat-card-header>
        <mat-card-content style="padding-top:16px;">
          @if (!poId() && pendingFiles().length === 0 && attachments().length === 0) {
            <p style="color:var(--text-3);font-size:13px;margin:0 0 12px;">
              Files will be uploaded once you save a draft.
            </p>
          }

          <!-- Saved attachments -->
          @for (att of attachments(); track att.id) {
            <div class="attachment-row">
              <mat-icon>attach_file</mat-icon>
              <span>{{ att.original_name }}</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-3);">
                {{ att.size ? (att.size / 1024 | number:'1.0-0') + ' KB' : '' }}
              </span>
            </div>
          }

          <!-- Pending (not yet uploaded) files for new POs -->
          @for (f of pendingFiles(); track f.name) {
            <div class="attachment-row pending">
              <mat-icon>hourglass_empty</mat-icon>
              <span>{{ f.name }}</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-3);">
                Pending — will upload on save
              </span>
            </div>
          }

          <input type="file" multiple #fileInput
                 (change)="onFileSelect($event)" style="display:none" />
          <button mat-stroked-button [disabled]="uploading()"
                  (click)="fileInput.click()" style="margin-top:8px;">
            @if (uploading()) { <mat-spinner diameter="18" /> } @else { <mat-icon>upload_file</mat-icon> }
            {{ poId() ? 'Upload Files' : 'Select Files' }}
          </button>
          <p style="font-size:11px;color:var(--text-3);margin:6px 0 0;">
            Accepted: PDF, Excel, Images. Max 10 MB per file.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 16px;
    }
    .page-header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .form-card { margin-bottom: 16px; }
    .full-width { width: 100%; }

    .form-row { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 4px; }
    .field-wide { flex: 1; min-width: 200px; }
    .field-md { min-width: 180px; }
    .field-sm { min-width: 140px; }

    .info-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: -4px 0 12px; }
    .info-chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--brand-light); border: 1px solid #fed7aa;
      border-radius: 8px; padding: 5px 12px; font-size: 12px; color: var(--text-2);
    }
    .info-chip mat-icon { font-size: 14px; width: 14px; height: 14px; color: var(--brand); }
    .info-chip.accent { background: #eff6ff; border-color: #bfdbfe; }
    .info-chip.accent mat-icon { color: #2563eb; }

    .addr-preview { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 4px 0 14px; }
    .addr-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 12.5px; color: #475569; line-height: 1.55; }
    .addr-card--muted { color: #94a3b8; font-style: italic; }
    .addr-head { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #1565c0; margin-bottom: 6px; }
    .addr-head mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .addr-name { font-weight: 700; color: #1e293b; font-size: 13px; }
    .addr-gstin { margin-top: 3px; font-weight: 600; color: #334155; }
    @media (max-width: 720px) { .addr-preview { grid-template-columns: 1fr; } }

    .budget-banner {
      display: flex; align-items: center; gap: 12px;
      background: #f0fdf4; border: 1px solid #86efac;
      padding: 10px 16px; border-radius: 10px;
      margin-bottom: 16px; font-size: 14px;
    }
    .budget-banner.budget-warn { background: #fff7ed; border-color: #fed7aa; }
    .budget-banner mat-icon { color: #16a34a; }
    .budget-banner.budget-warn mat-icon { color: var(--brand); }
    .po-total-badge {
      color: white; padding: 2px 12px; border-radius: 99px;
      font-size: 12px; font-weight: 600;
    }

    .line-item {
      border: 1px solid var(--border); border-radius: 10px;
      padding: 12px 14px; margin-bottom: 10px;
      background: var(--surface); transition: border-color 0.15s;
    }
    .line-item:focus-within { border-color: var(--brand); }
    .item-row1 { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
    .item-row2 { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
    .item-num { width: 22px; min-width: 22px; font-weight: 700; color: var(--text-3); font-size: 12px; padding-top: 20px; }
    .field-product { flex: 1.5; min-width: 160px; }
    .field-xs { width: 90px; min-width: 90px; }
    .field-rate { width: 140px; min-width: 120px; }
    .field-date { width: 150px; min-width: 140px; }

    .item-calc { text-align: center; min-width: 90px; padding: 6px 4px; }
    .amount-col { min-width: 110px; }
    .calc-label { font-size: 10px; color: var(--text-3); display: block; text-transform: uppercase; letter-spacing: 0.05em; }
    .calc-val { font-size: 13px; font-weight: 600; color: var(--text-2); display: block; }
    .amount-val { font-size: 15px; color: var(--text-1); }

    .empty-items {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 48px 24px; color: var(--text-3); text-align: center;
    }
    .empty-items mat-icon { font-size: 40px; width: 40px; height: 40px; }

    .term-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 4px; }
    .terms-total {
      font-size: 12px; font-weight: 600; padding: 4px 10px;
      border-radius: 6px; background: #f1f5f9; color: var(--text-2);
    }
    .terms-total.terms-over { background: #fff1f2; color: #e11d48; }
    .terms-total.terms-ok   { background: #f0fdf4; color: #16a34a; }
    .terms-warn {
      display: flex; align-items: center; gap: 6px;
      background: #fff7ed; border: 1px solid #fed7aa;
      color: #c2410c; border-radius: 6px; padding: 8px 12px;
      font-size: 12px; margin-bottom: 8px;
    }
    .terms-warn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .two-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

    .totals-table { display: flex; flex-direction: column; gap: 6px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
    .totals-row.grand { font-weight: 700; font-size: 16px; border-bottom: none; border-top: 2px solid var(--brand); padding-top: 10px; margin-top: 4px; color: var(--brand); }

    .attachment-row {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px;
    }
    .attachment-row mat-icon { color: var(--text-3); font-size: 18px; }
    .attachment-row.pending { opacity: 0.7; }
    .attachment-row.pending mat-icon { color: #f59e0b; }
  `],
})
export class PoFormComponent implements OnInit {
  poId = input<string | null>(null, { alias: 'id' });
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notify = inject(NotificationService);
  private bulk = inject(BulkImportService);
  boqUploading = signal(false);

  // Master data
  vendors = signal<Vendor[]>([]);
  vendorAddresses = signal<VendorAddress[]>([]);
  products = signal<Product[]>([]);
  costCenters = signal<CostCenter[]>([]);
  locations = signal<Location[]>([]);
  categories = signal<Category[]>([]);
  attachments = signal<any[]>([]);
  pendingFiles = signal<File[]>([]);

  // Selection context signals
  selectedVendor = signal<Vendor | null>(null);
  selectedAddress = signal<VendorAddress | null>(null);
  selectedCostCenter = signal<CostCenter | null>(null);
  selectedBillTo = signal<Location | null>(null);
  selectedShipTo = signal<Location | null>(null);

  // PR pre-fill
  prSource = signal<number|null>(null);

  // UI state
  budget = signal<Budget | null>(null);
  saving = signal<string | false>(false);
  suggestingTerms = signal(false);
  uploading = signal(false);

  today = new Date();
  gstRates = [0, 5, 12, 18, 28];

  // Flat categories for dropdown (root only → children)
  flatCategories = computed(() => {
    const flat: Category[] = [];
    const flatten = (cats: Category[], depth = 0) => {
      for (const c of cats) {
        flat.push({ ...c, name: depth > 0 ? '↳ ' + c.name : c.name });
        if (c.children?.length) flatten(c.children, depth + 1);
      }
    };
    // API returns root-only with children nested, no further filtering needed
    flatten(this.categories());
    return flat;
  });

  // Form — warranty_months removed from header (now per item)
  headerForm = this.fb.group({
    pr_reference:        [null as string | null],
    vendor_id:           [null as number | null, Validators.required],
    vendor_address_id:   [null as number | null],
    cost_center_id:      [null as number | null, Validators.required],
    bill_to_location_id: [null as number | null],
    ship_to_location_id: [null as number | null],
    po_valid_till:       [null as Date | null, Validators.required],
    freight:             [0],
  });

  items: FormArray<FormGroup> = this.fb.array<FormGroup>([]);
  paymentTerms: FormArray<FormGroup> = this.fb.array<FormGroup>([]);
  tcControl = this.fb.control('');

  // Computed totals
  netTotal = signal(0);
  taxAmount = signal(0);
  grandTotal = signal(0);
  freight = signal(0);   // Updated by recalc() so template shows live value

  get paymentTotal(): number {
    return this.paymentTerms.controls.reduce(
      (sum, ctrl) => sum + (+(ctrl.value.percentage) || 0), 0
    );
  }

  budgetUsed = computed(() => {
    const b = this.budget();
    if (!b || !b.annual) return 0;
    return Math.min(100, ((b.consumed + b.frozen) / b.annual) * 100);
  });
  budgetWarn = computed(() => this.grandTotal() > (this.budget()?.available ?? Infinity));

  // ─── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit() {
    const api = environment.apiUrl;
    this.http.get<any>(`${api}/vendors`).subscribe(r => {
      const list = r.data ?? r;
      this.vendors.set((list as Vendor[]).filter(v => v.is_active));
    });
    this.http.get<any>(`${api}/products`).subscribe(r => {
      const list = r.data ?? r;
      this.products.set((list as Product[]).filter(p => p.is_active));
    });
    this.http.get<any>(`${api}/cost-centers`).subscribe(r => { this.costCenters.set(r.data ?? r); });
    this.http.get<any>(`${api}/locations`).subscribe(r => { this.locations.set(r.data ?? r); });
    this.http.get<any>(`${api}/categories`).subscribe(r => { this.categories.set(r.data ?? r); });

    const id = this.poId();
    if (id) {
      this.http.get<any>(`${api}/purchase-orders/${id}`).subscribe(po => this.patchPo(po));
    }

    // Pre-fill from PR if ?pr_id is in URL
    const prId = this.route.snapshot.queryParamMap.get('pr_id');
    if (prId) {
      this.prSource.set(+prId);
      this.http.get<any>(`${api}/purchase-requisitions/${prId}`).subscribe(pr => this.patchFromPr(pr));
    }
  }

  // ─── Patch existing PO ────────────────────────────────────────────────
  private patchPo(po: any) {
    this.headerForm.patchValue({
      pr_reference:        po.pr_reference,
      vendor_id:           po.vendor_id,
      vendor_address_id:   po.vendor_address_id,
      cost_center_id:      po.cost_center_id,
      bill_to_location_id: po.bill_to_location_id,
      ship_to_location_id: po.ship_to_location_id,
      po_valid_till:       po.po_valid_till ? new Date(po.po_valid_till) : null,
      freight:             po.freight,
    });
    this.tcControl.setValue(po.terms_conditions ?? '');
    this.attachments.set(po.attachments ?? []);

    if (po.vendor_id) {
      this.loadVendorAddresses(po.vendor_id);
      setTimeout(() => {
        this.selectedVendor.set(this.vendors().find(v => v.id === po.vendor_id) ?? null);
        this.selectedAddress.set(this.vendorAddresses().find(a => a.id === po.vendor_address_id) ?? null);
      }, 300);
    }
    if (po.cost_center_id) {
      this.loadBudget(po.cost_center_id);
      setTimeout(() => {
        this.selectedCostCenter.set(this.costCenters().find(cc => cc.id === po.cost_center_id) ?? null);
      }, 300);
    }
    if (po.bill_to_location_id || po.ship_to_location_id) {
      setTimeout(() => {
        this.selectedBillTo.set(this.locations().find(l => l.id === po.bill_to_location_id) ?? null);
        this.selectedShipTo.set(this.locations().find(l => l.id === po.ship_to_location_id) ?? null);
      }, 300);
    }

    po.items?.forEach((item: any) => this.items.push(this.buildItem(item)));
    po.payment_terms_json?.forEach((t: PaymentTerm) => this.paymentTerms.push(this.buildTerm(t)));
    this.recalc();
  }

  // ─── Patch from PR ────────────────────────────────────────────────────
  private patchFromPr(pr: any) {
    // Pre-fill cost center & PR reference
    this.headerForm.patchValue({
      cost_center_id: pr.cost_center_id,
      pr_reference: pr.pr_number ?? pr.pr_ref,
    });
    if (pr.cost_center_id) {
      this.loadBudget(pr.cost_center_id);
      setTimeout(() => {
        this.selectedCostCenter.set(this.costCenters().find(cc => cc.id === pr.cost_center_id) ?? null);
      }, 300);
    }
    if (pr.location_id) {
      this.headerForm.patchValue({ ship_to_location_id: pr.location_id });
    }
    // Pre-fill line items from PR items (description + qty only; buyer sets rates)
    if (pr.items?.length) {
      while (this.items.length > 0) this.items.removeAt(0);
      pr.items.forEach((item: any) => {
        this.items.push(this.buildItem({
          description: item.description,
          qty: item.qty,
          net_rate: 0,
          gst_rate: 18,
          product_id: item.product_id,
          category_id: item.category_id,
          required_by: pr.required_by_date,
        }));
      });
      this.recalc();
    }
    // Also store pr_id for backend to link TAT
    (this.headerForm as any)._prId = pr.id;
  }

  // ─── Selection handlers ───────────────────────────────────────────────
  onVendorChange() {
    const vid = this.headerForm.value.vendor_id;
    this.selectedVendor.set(this.vendors().find(v => v.id === vid) ?? null);
    this.selectedAddress.set(null);
    this.vendorAddresses.set([]);
    this.headerForm.patchValue({ vendor_address_id: null });
    if (vid) this.loadVendorAddresses(vid);
  }

  onVendorAddressChange() {
    const aid = this.headerForm.value.vendor_address_id;
    this.selectedAddress.set(this.vendorAddresses().find(a => a.id === aid) ?? null);
  }

  onCostCenterChange() {
    const ccId = this.headerForm.value.cost_center_id;
    this.selectedCostCenter.set(this.costCenters().find(cc => cc.id === ccId) ?? null);
    if (ccId) this.loadBudget(ccId);
  }

  onBillToChange() {
    const lid = this.headerForm.value.bill_to_location_id;
    this.selectedBillTo.set(this.locations().find(l => l.id === lid) ?? null);
    if (lid && !this.headerForm.value.ship_to_location_id) {
      this.headerForm.patchValue({ ship_to_location_id: lid });
      this.onShipToChange();
    }
  }

  onShipToChange() {
    const lid = this.headerForm.value.ship_to_location_id;
    this.selectedShipTo.set(this.locations().find(l => l.id === lid) ?? null);
  }

  /** "City, State - Pincode" line for an address preview (State Code is omitted). */
  addrLine(loc: Location | null): string {
    if (!loc) return '';
    const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
    return loc.pincode ? (cityState ? `${cityState} - ${loc.pincode}` : `${loc.pincode}`) : cityState;
  }

  private loadVendorAddresses(vendorId: number) {
    this.http.get<VendorAddress[]>(`${environment.apiUrl}/vendors/${vendorId}/addresses`)
      .subscribe(a => {
        this.vendorAddresses.set(a);
        const def = a.find(x => x.is_default);
        if (def && !this.headerForm.value.vendor_address_id) {
          this.headerForm.patchValue({ vendor_address_id: def.id });
          this.selectedAddress.set(def);
        }
      });
  }

  private loadBudget(ccId: number) {
    this.http.get<Budget>(`${environment.apiUrl}/cost-centers/${ccId}/budget`)
      .subscribe(b => this.budget.set(b));
  }

  // ─── Line items ────────────────────────────────────────────────────────
  addItem() { this.items.push(this.buildItem()); }

  private buildItem(data?: any) {
    return this.fb.group({
      product_id:      [data?.product_id ?? null],
      description:     [data?.description ?? '', Validators.required],
      category_id:     [data?.category_id ?? null],
      qty:             [data?.qty ?? 1, [Validators.required, Validators.min(0.001)]],
      net_rate:        [data?.net_rate ?? 0, [Validators.required, Validators.min(0)]],
      gst_rate:        [data?.gst_rate ?? 18, Validators.required],
      warranty_months: [data?.warranty_months ?? 0],
      required_by:     [data?.required_by ? new Date(data.required_by) : null],
    });
  }

  removeItem(i: number) { this.items.removeAt(i); this.recalc(); }

  downloadBoqTemplate() {
    this.bulk.downloadTemplate('boq/template?type=po', 'po-boq-template.xlsx').subscribe({
      next: blob => this.bulk.saveBlob(blob, 'po-boq-template.xlsx'),
      error: () => this.notify.error('Could not download the BOQ template.'),
    });
  }

  uploadBoq(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.boqUploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'po');
    this.http.post<{ items: any[]; errors: string[] }>(`${environment.apiUrl}/boq/parse`, fd).subscribe({
      next: res => {
        this.boqUploading.set(false);
        (res.items ?? []).forEach(it => this.items.push(this.buildItem(it)));
        this.recalc();
        const added = res.items?.length ?? 0;
        this.notify.success(`${added} line item(s) added from BOQ.`
          + (res.errors?.length ? ` ${res.errors.length} row(s) skipped.` : ''));
        if (res.errors?.length) {
          this.notify.error(res.errors.slice(0, 5).join(' | '));
        }
      },
      error: err => {
        this.boqUploading.set(false);
        this.notify.error(err.error?.message ?? 'Could not read the BOQ file.');
      },
    });
    input.value = '';
  }

  onProductSelect(i: number) {
    const productId = (this.items.at(i).value as any).product_id;
    if (!productId) return;
    const product = this.products().find(p => p.id === productId);
    if (!product) return;
    this.items.at(i).patchValue({
      description:     product.name,
      net_rate:        product.net_rate,
      gst_rate:        product.gst_rate,
      category_id:     product.category_id ?? null,
      warranty_months: product.warranty_months ?? 0,
    });
    this.recalcItem(i);
  }

  getProductCode(i: number): string {
    const pid = (this.items.at(i).value as any).product_id;
    if (!pid) return '';
    return this.products().find(p => p.id === pid)?.code ?? '';
  }

  getProductHsn(i: number): string {
    const pid = (this.items.at(i).value as any).product_id;
    if (!pid) return '';
    return this.products().find(p => p.id === pid)?.hsn_code ?? '';
  }

  grossRate(i: number): number {
    const { net_rate, gst_rate } = this.items.at(i).value as any;
    if (!net_rate) return 0;
    return net_rate * (1 + (gst_rate || 0) / 100);
  }

  itemAmount(i: number): number {
    const { qty } = this.items.at(i).value as any;
    return this.grossRate(i) * (qty || 0);
  }

  recalcItem(i: number) { this.recalc(); }

  recalc() {
    let net = 0, tax = 0;
    for (let i = 0; i < this.items.length; i++) {
      const { qty, net_rate, gst_rate } = this.items.at(i).value as any;
      if (!qty || !net_rate) continue;
      const lineNet = net_rate * qty;
      net += lineNet;
      tax += lineNet * (gst_rate || 0) / 100;
    }
    const fr = +(this.headerForm.value.freight || 0);
    this.freight.set(fr);       // ← signal updated so template reflects freight immediately
    this.netTotal.set(net);
    this.taxAmount.set(tax);
    this.grandTotal.set(net + tax + fr);
  }

  asGroup(ctrl: AbstractControl) { return ctrl as FormGroup; }

  // ─── Payment terms ─────────────────────────────────────────────────────
  addTerm() { this.paymentTerms.push(this.buildTerm()); }
  onTermChange() { /* paymentTotal is a getter — Angular CD picks it up */ }
  private buildTerm(data?: PaymentTerm) {
    const remaining = Math.max(0, 100 - this.paymentTotal);
    return this.fb.group({
      stage:       [data?.stage ?? '', Validators.required],
      percentage:  [data?.percentage ?? remaining, [Validators.required, Validators.min(0), Validators.max(100)]],
      credit_days: [data?.credit_days ?? 0, [Validators.required, Validators.min(0)]],
    });
  }
  removeTerm(i: number) { this.paymentTerms.removeAt(i); }

  // ─── AI Terms suggestion ────────────────────────────────────────────────
  suggestTerms() {
    const itemNames = this.items.value.map((i: any) => i.description).filter(Boolean);
    const catIds    = [...new Set(this.items.value.map((i: any) => i.category_id).filter(Boolean))];
    this.suggestingTerms.set(true);
    this.http.post<{ terms: string }>(`${environment.apiUrl}/ai/suggest-terms`, {
      item_names: itemNames, category_ids: catIds,
    }).subscribe({
      next: res => {
        this.tcControl.setValue(res.terms);
        this.suggestingTerms.set(false);
        this.notify.success('Terms & Conditions generated.');
      },
      error: () => {
        this.notify.error('AI suggestion failed. Please enter manually.');
        this.suggestingTerms.set(false);
      },
    });
  }

  // ─── File handling ────────────────────────────────────────────────────
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const id = this.poId();
    if (id) {
      // Already saved — upload immediately
      this.uploading.set(true);
      const fd = new FormData();
      Array.from(input.files).forEach(f => fd.append('files[]', f));
      this.http.post<any[]>(`${environment.apiUrl}/purchase-orders/${id}/upload`, fd).subscribe({
        next: atts => {
          this.attachments.set([...this.attachments(), ...atts]);
          this.notify.success(`${input.files!.length} file(s) uploaded.`);
          this.uploading.set(false);
          input.value = '';
        },
        error: () => {
          this.notify.error('Upload failed.');
          this.uploading.set(false);
          input.value = '';
        },
      });
    } else {
      // New PO — stage files for upload after save
      this.pendingFiles.update(prev => [...prev, ...Array.from(input.files!)]);
      input.value = '';
    }
  }

  private uploadPendingFiles(poId: number): Promise<void> {
    const files = this.pendingFiles();
    if (!files.length) return Promise.resolve();
    const fd = new FormData();
    files.forEach(f => fd.append('files[]', f));
    return this.http.post<any[]>(`${environment.apiUrl}/purchase-orders/${poId}/upload`, fd)
      .toPromise()
      .then(atts => {
        this.attachments.set(atts ?? []);
        this.pendingFiles.set([]);
      })
      .catch(() => this.notify.error('File upload failed.'));
  }

  // ─── Save ─────────────────────────────────────────────────────────────
  save(action: 'draft' | 'submit') {
    if (this.headerForm.invalid || this.items.length === 0) {
      this.notify.error('Please fill all required fields and add at least one item.');
      return;
    }
    if (this.paymentTotal > 100) {
      this.notify.error('Payment terms exceed 100%. Please fix before saving.');
      return;
    }
    this.saving.set(action);

    const payload: any = {
      ...this.headerForm.value,
      // Include pr_id if this PO was created from a PR
      ...(this.prSource() ? { pr_id: this.prSource() } : {}),
      po_valid_till: this.headerForm.value.po_valid_till
        ? (this.headerForm.value.po_valid_till as Date).toISOString().split('T')[0]
        : null,
      items: this.items.value.map((item: any) => ({
        ...item,
        required_by: item.required_by
          ? (item.required_by instanceof Date
              ? item.required_by
              : new Date(item.required_by)).toISOString().split('T')[0]
          : null,
      })),
      payment_terms_json: this.paymentTerms.value,
      terms_conditions:   this.tcControl.value,
    };

    const id = this.poId();
    const req = id
      ? this.http.put<any>(`${environment.apiUrl}/purchase-orders/${id}`, payload)
      : this.http.post<any>(`${environment.apiUrl}/purchase-orders`, payload);

    req.subscribe({
      next: async po => {
        // Upload any pending files first
        await this.uploadPendingFiles(po.id);

        if (action === 'submit') {
          this.http.post(`${environment.apiUrl}/purchase-orders/${po.id}/submit`, {}).subscribe({
            next: () => {
              this.notify.success('PO submitted for approval.');
              this.router.navigate(['/purchase-orders', po.id]);
            },
            error: err => {
              this.notify.error(err.error?.error ?? 'Submit failed.');
              this.saving.set(false);
              this.router.navigate(['/purchase-orders', po.id]);
            },
          });
        } else {
          this.notify.success('PO saved as draft.');
          this.saving.set(false);
          if (!id) this.router.navigate(['/purchase-orders', po.id]);
        }
      },
      error: err => {
        this.notify.error(err.error?.error ?? err.error?.message ?? 'Save failed.');
        this.saving.set(false);
      },
    });
  }
}
