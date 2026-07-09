import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { Category, Vendor, VendorDocument } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' }, { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' }, { code: 'GBP', name: 'British Pound (£)' },
  { code: 'JPY', name: 'Japanese Yen (¥)' }, { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'CAD', name: 'Canadian Dollar (C$)' }, { code: 'CHF', name: 'Swiss Franc (CHF)' },
  { code: 'CNY', name: 'Chinese Yuan (¥)' }, { code: 'SGD', name: 'Singapore Dollar (S$)' },
  { code: 'AED', name: 'UAE Dirham (AED)' }, { code: 'SAR', name: 'Saudi Riyal (SAR)' },
  { code: 'HKD', name: 'Hong Kong Dollar (HK$)' }, { code: 'KRW', name: 'South Korean Won (₩)' },
  { code: 'MYR', name: 'Malaysian Ringgit (RM)' }, { code: 'THB', name: 'Thai Baht (฿)' },
  { code: 'IDR', name: 'Indonesian Rupiah (Rp)' }, { code: 'BDT', name: 'Bangladeshi Taka (৳)' },
  { code: 'LKR', name: 'Sri Lankan Rupee (Rs)' }, { code: 'NPR', name: 'Nepalese Rupee (Rs)' },
  { code: 'PKR', name: 'Pakistani Rupee (Rs)' }, { code: 'QAR', name: 'Qatari Riyal (QR)' },
  { code: 'KWD', name: 'Kuwaiti Dinar (KD)' }, { code: 'BHD', name: 'Bahraini Dinar (BD)' },
  { code: 'OMR', name: 'Omani Rial (OMR)' }, { code: 'ZAR', name: 'South African Rand (R)' },
  { code: 'SEK', name: 'Swedish Krona (kr)' }, { code: 'NOK', name: 'Norwegian Krone (kr)' },
  { code: 'DKK', name: 'Danish Krone (kr)' }, { code: 'NZD', name: 'New Zealand Dollar (NZ$)' },
  { code: 'MXN', name: 'Mexican Peso (MX$)' }, { code: 'BRL', name: 'Brazilian Real (R$)' },
];

@Component({
  selector: 'app-vendor-form',
  standalone: true,
  imports: [
    DatePipe, RouterLink, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatDatepickerModule, MatNativeDateModule,
    MatCardModule, MatProgressSpinnerModule, MatDividerModule, MatChipsModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      <!-- Header -->
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/vendors"><mat-icon>arrow_back</mat-icon></button>
          <div>
            <h2>{{ vendorId ? 'Edit Vendor' : 'New Vendor' }}</h2>
            <p>Complete all required sections before saving</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button mat-stroked-button routerLink="/vendors">Cancel</button>
          <button mat-raised-button color="primary" [disabled]="saving()" (click)="save()">
            @if (saving()) { <mat-spinner diameter="18" /> } @else { <mat-icon>save</mat-icon> Save Vendor }
          </button>
        </div>
      </div>

      <form [formGroup]="form" class="form-layout">

        <!-- ═══ SECTION 1: Basic Information ═══ -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="section-icon"><mat-icon>business</mat-icon></div>
            <mat-card-title>Basic Information</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="grid-3">
              <mat-form-field appearance="outline" class="span-3">
                <mat-label>Vendor / Company Name *</mat-label>
                <input matInput formControlName="name" />
                @if (form.get('name')?.errors?.['required'] && form.get('name')?.touched) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Global Vendor Code</mat-label>
                <input matInput formControlName="global_vendor_code" />
                <mat-hint>Central/Entity vendor ID</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Entity Code</mat-label>
                <input matInput formControlName="entity_code" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Vendor Currency *</mat-label>
                <mat-select formControlName="currency">
                  @for (c of currencies; track c.code) {
                    <mat-option [value]="c.code">{{ c.code }} — {{ c.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Vendor Type</mat-label>
                <mat-select formControlName="vendor_type">
                  <mat-option value="manufacturer">Manufacturer</mat-option>
                  <mat-option value="distributor">Distributor</mat-option>
                  <mat-option value="service_provider">Service Provider</mat-option>
                  <mat-option value="consultant">Consultant</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Entity Type</mat-label>
                <mat-select formControlName="entity_type">
                  <mat-option value="public">Public Limited</mat-option>
                  <mat-option value="pvt_ltd">Private Limited</mat-option>
                  <mat-option value="llp">LLP</mat-option>
                  <mat-option value="partnership">Partnership</mat-option>
                  <mat-option value="individual">Individual / Proprietor</mat-option>
                  <mat-option value="overseas_company">Overseas Company</mat-option>
                  <mat-option value="others">Others</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Contact Email</mat-label>
                <input matInput formControlName="email" type="email" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Contact Phone</mat-label>
                <input matInput formControlName="phone" placeholder="e.g. +919876543210" maxlength="20" />
                @if (form.get('phone')?.errors?.['pattern'] && form.get('phone')?.touched) {
                  <mat-error>Invalid phone format (e.g. +919876543210)</mat-error>
                }
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ═══ SECTION 2: Tax & Compliance ═══ -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="section-icon"><mat-icon>receipt_long</mat-icon></div>
            <mat-card-title>Tax &amp; Compliance</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="grid-3">
              <!-- PAN -->
              <div class="pan-row">
                @if (!form.get('pan_not_available')?.value) {
                  <mat-form-field appearance="outline" style="flex:1;">
                    <mat-label>PAN Number</mat-label>
                    <input matInput formControlName="pan" maxlength="10" style="text-transform:uppercase" />
                    <mat-hint>e.g. ABCDE1234F</mat-hint>
                  </mat-form-field>
                } @else {
                  <div class="pan-na-placeholder">
                    <mat-icon>info</mat-icon> PAN not available for this vendor
                  </div>
                }
                <mat-checkbox formControlName="pan_not_available" style="flex-shrink:0;margin-top:8px;">
                  PAN Not Available
                </mat-checkbox>
              </div>

              <!-- GST Status -->
              <mat-form-field appearance="outline">
                <mat-label>GST Status</mat-label>
                <mat-select formControlName="gst_status">
                  <mat-option value="registered">GST Registered</mat-option>
                  <mat-option value="unregistered">GST Unregistered</mat-option>
                  <mat-option value="overseas">Overseas</mat-option>
                </mat-select>
              </mat-form-field>

              @if (form.get('gst_status')?.value === 'registered') {
                <mat-form-field appearance="outline">
                  <mat-label>GSTIN</mat-label>
                  <input matInput formControlName="gstin" maxlength="15" style="text-transform:uppercase" />
                  <mat-hint>e.g. 29ABCDE1234F1Z5</mat-hint>
                </mat-form-field>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ═══ SECTION 3: Categories ═══ -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="section-icon"><mat-icon>category</mat-icon></div>
            <mat-card-title>Categories</mat-card-title>
            <div style="flex:1;"></div>
            <button mat-stroked-button type="button" (click)="addCategoryRow()">
              <mat-icon>add</mat-icon> Add Category
            </button>
          </mat-card-header>
          <mat-card-content>
            @if (categoryRows.length === 0) {
              <div class="empty-hint">No categories assigned. Click "Add Category" to tag this vendor.</div>
            }
            @for (row of categoryRows.controls; track i; let i = $index) {
              <div [formGroup]="asGroup(row)" class="cat-row">
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Category</mat-label>
                  <mat-select formControlName="category_id" (selectionChange)="onCatChange(i)">
                    <mat-option [value]="null">— Select —</mat-option>
                    @for (cat of allCategories(); track cat.id) {
                      <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;">
                  <mat-label>Subcategory</mat-label>
                  <mat-select formControlName="subcategory_id">
                    <mat-option [value]="null">— None —</mat-option>
                    @for (sub of getSubcategories(i); track sub.id) {
                      <mat-option [value]="sub.id">{{ sub.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-icon-button type="button" color="warn" (click)="removeCategoryRow(i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- ═══ SECTION 4: Bank & Account Details ═══ -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="section-icon"><mat-icon>account_balance</mat-icon></div>
            <mat-card-title>Bank &amp; Account Details</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="grid-3">
              <mat-form-field appearance="outline">
                <mat-label>Account Number</mat-label>
                <input matInput formControlName="account_no" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>IFSC Code</mat-label>
                <input matInput formControlName="ifsc" maxlength="11" style="text-transform:uppercase" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>MICR Code</mat-label>
                <input matInput formControlName="micr" maxlength="9" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Bank Name</mat-label>
                <input matInput formControlName="bank_name" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Branch Name</mat-label>
                <input matInput formControlName="branch_name" />
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ═══ SECTION 5: Special Status ═══ -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="section-icon"><mat-icon>verified</mat-icon></div>
            <mat-card-title>Special Status</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="grid-3">
              <mat-form-field appearance="outline">
                <mat-label>Status</mat-label>
                <mat-select formControlName="special_status">
                  <mat-option [value]="null">— None —</mat-option>
                  <mat-option value="msme">MSME</mat-option>
                  <mat-option value="non_msme">Non-MSME</mat-option>
                  <mat-option value="sez">SEZ</mat-option>
                  <mat-option value="others">Others</mat-option>
                </mat-select>
              </mat-form-field>
              @if (form.get('special_status')?.value) {
                <mat-form-field appearance="outline">
                  <mat-label>Registration Number *</mat-label>
                  <input matInput formControlName="special_status_reg_no" />
                  @if (form.get('special_status_reg_no')?.errors?.['required'] && form.get('special_status_reg_no')?.touched) {
                    <mat-error>Registration number is required</mat-error>
                  }
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Valid From *</mat-label>
                  <input matInput [matDatepicker]="dpStart" formControlName="special_status_start_date" />
                  <mat-datepicker-toggle matSuffix [for]="dpStart" />
                  <mat-datepicker #dpStart />
                  @if (form.get('special_status_start_date')?.errors?.['required'] && form.get('special_status_start_date')?.touched) {
                    <mat-error>Start date is required</mat-error>
                  }
                </mat-form-field>
                <div style="display:flex; align-items:center; height:56px; padding-left:4px;">
                  <mat-checkbox formControlName="special_status_no_end_date">No End Date</mat-checkbox>
                </div>
                @if (!form.get('special_status_no_end_date')?.value) {
                  <mat-form-field appearance="outline">
                    <mat-label>Valid Till *</mat-label>
                    <input matInput [matDatepicker]="dpEnd" formControlName="special_status_end_date" />
                    <mat-datepicker-toggle matSuffix [for]="dpEnd" />
                    <mat-datepicker #dpEnd />
                    @if (form.get('special_status_end_date')?.errors?.['required'] && form.get('special_status_end_date')?.touched) {
                      <mat-error>End date is required</mat-error>
                    }
                  </mat-form-field>
                }
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ═══ SECTION 6: Documents ═══ -->
        <mat-card class="form-card">
          <mat-card-header>
            <div class="section-icon"><mat-icon>folder_open</mat-icon></div>
            <mat-card-title>Documents</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="doc-grid">
              @for (dtype of docTypes; track dtype.key) {
                <div class="doc-slot">
                  <div class="doc-slot-label">
                    <mat-icon>{{ dtype.icon }}</mat-icon>
                    <span>{{ dtype.label }}</span>
                    @if (dtype.key !== 'additional') { <span class="doc-badge">Required</span> }
                    @if (dtype.key === 'additional') {
                      <span class="doc-badge secondary">Up to 5</span>
                    }
                  </div>

                  <!-- Existing uploads -->
                  @for (doc of getDocsByType(dtype.key); track doc.id) {
                    <div class="doc-file-row">
                      <mat-icon style="font-size:16px;color:#4ade80;">check_circle</mat-icon>
                      <span class="doc-filename">{{ doc.original_name }}</span>
                      <a [href]="doc.url ?? '/storage/' + doc.file_path" target="_blank"
                         mat-icon-button matTooltip="View">
                        <mat-icon style="font-size:16px;">open_in_new</mat-icon>
                      </a>
                      @if (vendorId) {
                        <button mat-icon-button color="warn" matTooltip="Remove"
                                (click)="removeDocument(doc)">
                          <mat-icon style="font-size:16px;">close</mat-icon>
                        </button>
                      }
                    </div>
                  }

                  <!-- Upload button (hide additional if 5 already uploaded) -->
                  @if (dtype.key !== 'additional' || getDocsByType('additional').length < 5) {
                    <label class="upload-btn">
                      <input type="file" hidden
                             [accept]="dtype.accept"
                             (change)="onFileSelect($event, dtype.key)" />
                      <mat-icon>upload</mat-icon>
                      {{ getDocsByType(dtype.key).length > 0 ? 'Replace / Add' : 'Upload' }}
                    </label>
                  }

                  <!-- Pending upload (not yet saved) -->
                  @if (pendingFiles[dtype.key]?.length) {
                    @for (pf of pendingFiles[dtype.key]; track pf.name) {
                      <div class="doc-file-row pending">
                        <mat-icon style="font-size:16px;color:#f59e0b;">hourglass_empty</mat-icon>
                        <span class="doc-filename">{{ pf.name }}</span>
                        <span style="font-size:10px;color:#888;">(will upload on save)</span>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

      </form>
    </div>
  `,
  styles: [`
    .page-wrapper { padding:28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:12px;color:var(--text-3); }
    .form-layout { display:flex;flex-direction:column;gap:20px; }

    .form-card mat-card-header { display:flex;align-items:center;gap:12px;padding-bottom:0; }
    .form-card mat-card-content { padding-top:20px!important; }
    .section-icon {
      width:36px;height:36px;border-radius:10px;
      background:var(--brand-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .section-icon mat-icon { color:var(--brand);font-size:20px;width:20px;height:20px; }

    .grid-3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px; }
    @media(max-width:900px) { .grid-3 { grid-template-columns:1fr 1fr; } }
    .grid-3 mat-form-field { width:100%; }
    .span-3 { grid-column:1/-1; }

    /* PAN row */
    .pan-row { display:flex;align-items:flex-start;gap:12px;grid-column:1/-1; }
    .pan-na-placeholder {
      flex:1;display:flex;align-items:center;gap:8px;
      background:#fef3c7;border:1px dashed #f59e0b;border-radius:8px;
      padding:12px 16px;font-size:13px;color:#92400e;
    }
    .pan-na-placeholder mat-icon { font-size:18px;width:18px;height:18px; }

    /* Category rows */
    .cat-row { display:flex;align-items:center;gap:12px;margin-bottom:8px; }
    .empty-hint { font-size:13px;color:var(--text-3);text-align:center;padding:20px;background:#f8faff;border-radius:10px;border:1px dashed var(--border); }

    /* Documents */
    .doc-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
    @media(max-width:768px) { .doc-grid { grid-template-columns:1fr; } }
    .doc-slot {
      border:1px solid var(--border);border-radius:12px;padding:14px 16px;
      display:flex;flex-direction:column;gap:8px;
    }
    .doc-slot-label { display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text-1); }
    .doc-slot-label mat-icon { font-size:18px;width:18px;height:18px;color:var(--brand); }
    .doc-badge {
      font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;
      background:#fee2e2;color:#b91c1c;margin-left:auto;
    }
    .doc-badge.secondary { background:#eff6ff;color:#1d4ed8; }
    .doc-file-row {
      display:flex;align-items:center;gap:8px;
      background:#f8faff;border-radius:8px;padding:6px 10px;
      font-size:12px;
    }
    .doc-file-row.pending { background:#fffbeb; }
    .doc-filename { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    .upload-btn {
      display:flex;align-items:center;gap:6px;
      border:1.5px dashed var(--brand);border-radius:8px;
      padding:8px 14px;font-size:12px;font-weight:600;color:var(--brand);
      cursor:pointer;transition:background .15s;
    }
    .upload-btn:hover { background:var(--brand-light); }
    .upload-btn mat-icon { font-size:16px;width:16px;height:16px; }
  `],
})
export class VendorFormComponent implements OnInit {
  private http   = inject(HttpClient);
  private fb     = inject(FormBuilder);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private notify = inject(NotificationService);

  readonly currencies = CURRENCIES;
  readonly docTypes = [
    { key: 'pan',              label: 'PAN Document',       icon: 'badge',         accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'gst',              label: 'GST Certificate',    icon: 'article',       accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'cancelled_cheque', label: 'Cancelled Cheque',   icon: 'payments',      accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'additional',       label: 'Additional Docs',    icon: 'attach_file',   accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.docx' },
  ] as const;

  vendorId: number | null = null;
  saving        = signal(false);
  allCategories = signal<Category[]>([]);
  existingDocs  = signal<VendorDocument[]>([]);
  pendingFiles:  Record<string, File[]> = { pan: [], gst: [], cancelled_cheque: [], additional: [] };

  form = this.fb.group({
    name:                      ['', Validators.required],
    global_vendor_code:        [''],
    entity_code:               [''],
    vendor_type:               [null as string | null],
    entity_type:               [null as string | null],
    email:                     ['', Validators.email],
    phone:                     ['', [Validators.pattern(/^\+?[0-9\s\-]{7,15}$/)]],
    currency:                  ['INR'],
    pan:                       [''],
    pan_not_available:         [false],
    gst_status:                [null as string | null],
    gstin:                     [''],
    account_no:                [''],
    ifsc:                      [''],
    micr:                      [''],
    bank_name:                 [''],
    branch_name:               [''],
    special_status:            [null as string | null],
    special_status_reg_no:     [''],
    special_status_start_date: [null as Date | null],
    special_status_end_date:   [null as Date | null],
    special_status_no_end_date: [false],
    vendor_categories:         this.fb.array([]),
  });

  get categoryRows(): FormArray { return this.form.get('vendor_categories') as FormArray; }
  asGroup(ctrl: any): FormGroup { return ctrl as FormGroup; }

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.vendorId = idParam ? +idParam : null;

    this.http.get<Category[]>(`${environment.apiUrl}/categories`).subscribe(cats => {
      this.allCategories.set(cats);
      if (this.vendorId) this.loadVendor();
    });

    this.form.get('special_status')?.valueChanges.subscribe(status => {
      this.updateSpecialStatusValidators(status ?? null, this.form.get('special_status_no_end_date')?.value ?? null);
    });

    this.form.get('special_status_no_end_date')?.valueChanges.subscribe(noEndDate => {
      this.updateSpecialStatusValidators(this.form.get('special_status')?.value ?? null, noEndDate ?? null);
    });
  }

  updateSpecialStatusValidators(status: string | null, noEndDate: boolean | null) {
    const regNo = this.form.get('special_status_reg_no');
    const startDate = this.form.get('special_status_start_date');
    const endDate = this.form.get('special_status_end_date');

    if (status) {
      regNo?.setValidators([Validators.required]);
      startDate?.setValidators([Validators.required]);

      if (noEndDate) {
        endDate?.clearValidators();
        endDate?.disable({ emitEvent: false });
        endDate?.setValue(null, { emitEvent: false });
      } else {
        endDate?.enable({ emitEvent: false });
        endDate?.setValidators([Validators.required]);
      }
    } else {
      regNo?.clearValidators();
      startDate?.clearValidators();
      endDate?.clearValidators();
      endDate?.enable({ emitEvent: false });

      regNo?.setValue('', { emitEvent: false });
      startDate?.setValue(null, { emitEvent: false });
      endDate?.setValue(null, { emitEvent: false });
    }

    regNo?.updateValueAndValidity({ emitEvent: false });
    startDate?.updateValueAndValidity({ emitEvent: false });
    endDate?.updateValueAndValidity({ emitEvent: false });
  }

  loadVendor() {
    this.http.get<Vendor>(`${environment.apiUrl}/vendors/${this.vendorId}`).subscribe(v => {
      this.form.patchValue({
        name: v.name, global_vendor_code: v.global_vendor_code ?? '',
        entity_code: v.entity_code ?? '', vendor_type: v.vendor_type ?? null,
        entity_type: v.entity_type ?? null, email: v.email ?? '',
        phone: v.phone ?? '', currency: v.currency ?? 'INR',
        pan: v.pan ?? '', pan_not_available: v.pan_not_available ?? false,
        gst_status: v.gst_status ?? null, gstin: v.gstin ?? '',
        account_no: v.account_no ?? '', ifsc: v.ifsc ?? '',
        micr: v.micr ?? '', bank_name: v.bank_name ?? '',
        branch_name: v.branch_name ?? '', special_status: v.special_status ?? null,
        special_status_reg_no: v.special_status_reg_no ?? '',
        special_status_start_date: v.special_status_start_date ? new Date(v.special_status_start_date) : null,
        special_status_end_date: v.special_status_end_date ? new Date(v.special_status_end_date) : null,
        special_status_no_end_date: v.special_status ? !v.special_status_end_date : false,
      });
      this.updateSpecialStatusValidators(v.special_status ?? null, v.special_status ? !v.special_status_end_date : false);

      // Load multi-categories
      this.categoryRows.clear();
      (v.vendor_categories ?? []).forEach(vc => {
        this.categoryRows.push(this.newCatRow(vc.category_id, vc.subcategory_id ?? null));
      });

      // Load existing documents
      if (v.documents) {
        this.existingDocs.set(v.documents.map(d => ({
          ...d,
          url: d.file_path ? `/storage/${d.file_path}` : undefined,
        })));
      }
    });
  }

  newCatRow(catId: number | null = null, subId: number | null = null): FormGroup {
    return this.fb.group({ category_id: [catId], subcategory_id: [subId] });
  }

  addCategoryRow() { this.categoryRows.push(this.newCatRow()); }
  removeCategoryRow(i: number) { this.categoryRows.removeAt(i); }

  onCatChange(i: number) {
    this.categoryRows.at(i).patchValue({ subcategory_id: null });
  }

  getSubcategories(i: number): Category[] {
    const catId = this.categoryRows.at(i)?.value?.category_id;
    if (!catId) return [];
    const parent = this.allCategories().find(c => c.id === catId);
    return parent?.children ?? [];
  }

  getDocsByType(type: string): VendorDocument[] {
    return this.existingDocs().filter(d => d.document_type === type);
  }

  onFileSelect(event: Event, type: string) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    if (!this.pendingFiles[type]) this.pendingFiles[type] = [];
    
    // Check if filename is already pending for this type
    if (this.pendingFiles[type].some(f => f.name === file.name)) {
      this.notify.error(`A file named "${file.name}" is already selected for upload.`);
      input.value = '';
      return;
    }

    // Check if filename already exists in uploaded documents
    if (this.existingDocs().some(d => d.file_name === file.name)) {
      this.notify.error(`A document named "${file.name}" has already been uploaded for this vendor.`);
      input.value = '';
      return;
    }

    if (type === 'additional') {
      this.pendingFiles[type].push(file);
    } else {
      this.pendingFiles[type] = [file]; // replace for single-doc types
    }
    input.value = '';
  }

  removeDocument(doc: VendorDocument) {
    if (!this.vendorId || !doc.id) return;
    this.http.delete(`${environment.apiUrl}/vendors/${this.vendorId}/documents/${doc.id}`).subscribe({
      next: () => {
        this.existingDocs.update(list => list.filter(d => d.id !== doc.id));
        this.notify.success('Document removed.');
      },
      error: () => this.notify.error('Could not remove document.'),
    });
  }

  async save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Please fill all required fields.');
      return;
    }
    this.saving.set(true);

    const val = this.form.getRawValue();
    const payload: any = {
      ...val,
      special_status_start_date: val.special_status_start_date instanceof Date
        ? (val.special_status_start_date as Date).toISOString().split('T')[0] : val.special_status_start_date,
      special_status_end_date: val.special_status_end_date instanceof Date
        ? (val.special_status_end_date as Date).toISOString().split('T')[0] : val.special_status_end_date,
      vendor_categories: this.categoryRows.value,
    };

    const req = this.vendorId
      ? this.http.put<Vendor>(`${environment.apiUrl}/vendors/${this.vendorId}`, payload)
      : this.http.post<Vendor>(`${environment.apiUrl}/vendors`, payload);

    req.subscribe({
      next: async vendor => {
        // Upload pending files
        await this.uploadPendingFiles(vendor.id!);
        this.notify.success(`Vendor ${this.vendorId ? 'updated' : 'created'}.`);
        this.router.navigate(['/vendors', vendor.id]);
      },
      error: err => {
        this.notify.error(err.error?.message ?? 'Save failed.');
        this.saving.set(false);
      },
    });
  }

  private async uploadPendingFiles(vendorId: number): Promise<void> {
    for (const [type, files] of Object.entries(this.pendingFiles)) {
      for (const file of files) {
        const fd = new FormData();
        fd.append('document', file);
        fd.append('document_type', type);
        try {
          await this.http.post(`${environment.apiUrl}/vendors/${vendorId}/documents`, fd).toPromise();
        } catch { /* non-fatal */ }
      }
    }
    Object.keys(this.pendingFiles).forEach(k => this.pendingFiles[k] = []);
  }
}
