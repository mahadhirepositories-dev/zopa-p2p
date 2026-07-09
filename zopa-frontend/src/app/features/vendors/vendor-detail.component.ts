import { Component, OnInit, inject, signal, input, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { Vendor, VendorAddress } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { gstinValidator, phoneValidator } from '../../core/validators';
import { DatePipe, TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-vendor-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatButtonModule, MatIconModule, MatTableModule,
    MatChipsModule, MatProgressSpinnerModule, MatCardModule, RouterLink, MatDialogModule,
    DatePipe, TitleCasePipe,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/vendors"><mat-icon>arrow_back</mat-icon></button>
          <h2>{{ vendor()?.name ?? 'Vendor' }}</h2>
        </div>
      </div>

      @if (loading()) {
        <mat-spinner diameter="40" />
      } @else if (vendor()) {
        <mat-card style="margin-bottom:24px;">
          <mat-card-header>
            <mat-card-title>Details</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
              @if (auth.canDo('vendors','edit')) {
                <button mat-stroked-button [routerLink]="['/vendors', vendor()!.id, 'edit']">
                  <mat-icon>edit</mat-icon> Edit Vendor Details
                </button>
              }
            </div>
            <div class="detail-grid">
              <div><span class="label">Name</span><strong>{{ vendor()!.name }}</strong></div>
              <div><span class="label">Global Vendor Code</span><span>{{ vendor()!.global_vendor_code ?? '—' }}</span></div>
              <div><span class="label">Entity Code</span><span>{{ vendor()!.entity_code ?? '—' }}</span></div>
              <div><span class="label">Vendor Type</span><span>{{ vendor()!.vendor_type ?? '—' }}</span></div>
              <div><span class="label">Entity Type</span><span>{{ vendor()!.entity_type ?? '—' }}</span></div>
              <div><span class="label">Currency</span><span>{{ vendor()!.currency ?? 'INR' }}</span></div>
              <div><span class="label">Status</span>
                <mat-chip [class]="vendor()!.is_active ? 'status-approved' : 'status-cancelled'" [highlighted]="true">
                  {{ vendor()!.is_active ? 'Active' : 'Inactive' }}
                </mat-chip>
              </div>
              <div><span class="label">PAN</span><span>{{ vendor()!.pan_not_available ? 'Not Available' : (vendor()!.pan ?? '—') }}</span></div>
              <div><span class="label">GST Status</span><span>{{ vendor()!.gst_status ?? '—' }}</span></div>
              <div><span class="label">GSTIN</span><span>{{ vendor()!.gstin ?? '—' }}</span></div>
              <div><span class="label">Email</span><span>{{ vendor()!.email ?? '—' }}</span></div>
              <div><span class="label">Phone</span><span>{{ vendor()!.phone ?? '—' }}</span></div>
            </div>

            @if (vendor()!.vendor_categories?.length) {
              <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;">
                <span class="label">Categories</span>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
                  @for (vc of vendor()!.vendor_categories; track vc.id) {
                    <span style="background:#eff6ff;color:#1d4ed8;padding:3px 10px;border-radius:99px;font-size:12px;">
                      {{ vc.category?.name }}
                      @if (vc.subcategory) { / {{ vc.subcategory?.name }} }
                    </span>
                  }
                </div>
              </div>
            }

            @if (vendor()!.bank_name || vendor()!.account_no) {
              <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;">
                <span class="label" style="display:block;margin-bottom:8px;">Bank Details</span>
                <div class="detail-grid">
                  <div><span class="label">Account No</span><span>{{ vendor()!.account_no ?? '—' }}</span></div>
                  <div><span class="label">IFSC</span><span>{{ vendor()!.ifsc ?? '—' }}</span></div>
                  <div><span class="label">MICR</span><span>{{ vendor()!.micr ?? '—' }}</span></div>
                  <div><span class="label">Bank</span><span>{{ vendor()!.bank_name ?? '—' }}</span></div>
                  <div><span class="label">Branch</span><span>{{ vendor()!.branch_name ?? '—' }}</span></div>
                </div>
              </div>
            }

            @if (vendor()!.special_status) {
              <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;">
                <span class="label" style="display:block;margin-bottom:8px;">Special Status</span>
                <div class="detail-grid">
                  <div><span class="label">Status</span><span>{{ vendor()!.special_status?.toUpperCase() }}</span></div>
                  <div><span class="label">Reg No</span><span>{{ vendor()!.special_status_reg_no ?? '—' }}</span></div>
                  <div><span class="label">Valid From</span><span>{{ vendor()!.special_status_start_date ?? '—' }}</span></div>
                  <div><span class="label">Valid Till</span><span>{{ vendor()!.special_status_end_date ?? '—' }}</span></div>
                </div>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Addresses</mat-card-title>
            <div style="flex:1;"></div>
            @if (auth.canDo('vendors','edit')) {
              <button mat-raised-button color="primary" (click)="openAddressForm(null)">
                <mat-icon>add</mat-icon> Add Address
              </button>
            }
          </mat-card-header>
          <mat-card-content style="padding-top:16px;">
            @if (showAddressForm() && auth.canDo('vendors','edit')) {
              <form [formGroup]="addressForm" (ngSubmit)="saveAddress()" class="addr-form">
                <div class="addr-form-title">
                  {{ editingAddress() ? 'Edit Address' : 'New Address' }}
                </div>
                <div class="addr-form-grid">
                  <div>
                    <label class="label">Label *</label>
                    <input class="simple-input" formControlName="label" placeholder="Head Office" />
                    @if (addressForm.get('label')?.errors?.['required'] && addressForm.get('label')?.touched) {
                      <span class="field-error">Label is required</span>
                    }
                  </div>
                  <div>
                    <label class="label">GSTIN</label>
                    <input class="simple-input" formControlName="gstin" placeholder="27XXXXX" style="text-transform:uppercase" />
                    @if (addressForm.get('gstin')?.errors?.['gstin'] && addressForm.get('gstin')?.touched) {
                      <span class="field-error">Invalid GSTIN format</span>
                    }
                  </div>
                  <div style="grid-column:1/-1;">
                    <label class="label">Street Address</label>
                    <textarea class="simple-input" formControlName="address" rows="2" style="width:100%;resize:vertical;"></textarea>
                  </div>

                  <!-- Pincode with auto-lookup -->
                  <div>
                    <label class="label">Pincode</label>
                    <div style="display:flex;gap:6px;">
                      <input class="simple-input" formControlName="pincode" placeholder="e.g. 400001" maxlength="10"
                             style="flex:1;" (blur)="lookupPincode()" />
                      <button mat-icon-button type="button" [disabled]="pincodeLoading()"
                              (click)="lookupPincode()" style="flex-shrink:0;" title="Lookup">
                        @if (pincodeLoading()) { <mat-spinner diameter="18" /> }
                        @else { <mat-icon>search</mat-icon> }
                      </button>
                    </div>
                  </div>
                  <div>
                    <label class="label">City</label>
                    <input class="simple-input" formControlName="city" placeholder="Mumbai" />
                  </div>
                  <div>
                    <label class="label">State</label>
                    <input class="simple-input" formControlName="state" placeholder="Maharashtra" />
                  </div>
                  <div>
                    <label class="label">State Code</label>
                    <input class="simple-input" formControlName="state_code" placeholder="27" maxlength="5" />
                  </div>
                  <div>
                    <label class="label">Country</label>
                    <input class="simple-input" formControlName="country" placeholder="India" />
                  </div>

                  <div>
                    <label class="label">Contact Name</label>
                    <input class="simple-input" formControlName="contact_name" />
                  </div>
                  <div>
                    <label class="label">Contact Phone</label>
                    <input class="simple-input" formControlName="contact_phone" maxlength="15" />
                    @if (addressForm.get('contact_phone')?.errors?.['phone'] && addressForm.get('contact_phone')?.touched) {
                      <span class="field-error">Invalid phone number</span>
                    }
                  </div>
                  <div style="grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end;">
                    <button mat-button type="button" (click)="cancelAddressForm()">Cancel</button>
                    <button mat-raised-button color="primary" type="submit" [disabled]="addressForm.invalid || savingAddress()">
                      @if (savingAddress()) { Saving... } @else { {{ editingAddress() ? 'Update Address' : 'Save Address' }} }
                    </button>
                  </div>
                </div>
              </form>
            }

            <table mat-table [dataSource]="vendor()!.addresses ?? []" class="full-width">
              <ng-container matColumnDef="label">
                <th mat-header-cell *matHeaderCellDef>Label</th>
                <td mat-cell *matCellDef="let a">
                  {{ a.label }}
                  @if(a.is_default) { <span class="badge-default">Default</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="state">
                <th mat-header-cell *matHeaderCellDef>State</th>
                <td mat-cell *matCellDef="let a">{{ a.state ?? '—' }} ({{ a.state_code ?? '—' }})</td>
              </ng-container>
              <ng-container matColumnDef="gstin">
                <th mat-header-cell *matHeaderCellDef>GSTIN</th>
                <td mat-cell *matCellDef="let a">{{ a.gstin ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="contact">
                <th mat-header-cell *matHeaderCellDef>Contact</th>
                <td mat-cell *matCellDef="let a">
                  {{ a.contact_name ?? '—' }}
                  @if (a.contact_phone) { <span class="contact-phone">{{ a.contact_phone }}</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef style="text-align:right;width:96px;">Actions</th>
                <td mat-cell *matCellDef="let a" style="text-align:right;">
                  @if (auth.canDo('vendors','edit')) {
                    <button mat-icon-button color="primary" title="Edit" (click)="openAddressForm(a)">
                      <mat-icon style="font-size:18px;">edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" title="Delete" (click)="deleteAddress(a)">
                      <mat-icon style="font-size:18px;">delete</mat-icon>
                    </button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="addrCols"></tr>
              <tr mat-row *matRowDef="let row; columns: addrCols;"></tr>
            </table>
          </mat-card-content>
        </mat-card>

        <!-- Activity timeline card -->
        <mat-card style="margin-top: 24px;">
          <mat-card-header>
            <mat-card-title>Change History & Activity Log</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top: 16px;">
            @if (activity().length === 0) {
              <p style="color: var(--text-3); font-size: 13px; text-align: center; padding: 20px;">No change history recorded yet.</p>
            } @else {
              <div class="timeline">
                @for (act of activity(); track act.id) {
                  <div class="timeline-item">
                    <div class="timeline-badge">
                      <mat-icon>{{ act.action === 'created' ? 'add_circle_outline' : act.action === 'deactivated' ? 'remove_circle_outline' : 'edit_note' }}</mat-icon>
                    </div>
                    <div class="timeline-body">
                      <div class="timeline-header">
                        <strong>{{ act.user?.name ?? 'System' }}</strong>
                        <span class="timeline-action">{{ act.action | titlecase }}</span>
                        <span class="timeline-date">{{ act.created_at | date:'dd MMM yyyy, hh:mm a' }}</span>
                      </div>
                      @if (act.meta?.changes) {
                        <div class="timeline-changes">
                          @for (chg of getChangePairs(act.meta.changes); track chg.field) {
                            <div class="change-pair">
                              <span class="change-field">{{ chg.field }}:</span>
                              <span class="change-old">{{ chg.old ?? '—' }}</span>
                              <mat-icon style="font-size:12px;width:12px;height:12px;margin:0 4px;vertical-align:middle;color:var(--text-3);">arrow_forward</mat-icon>
                              <span class="change-new">{{ chg.new ?? '—' }}</span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .label { font-size: 11px; color: #888; text-transform: uppercase; display: block; margin-bottom: 4px; }
    .simple-input { width: 100%; border: 1px solid #ccc; border-radius: 4px; padding: 8px; font-size: 14px; box-sizing: border-box; }
    .simple-input:focus { outline: none; border-color: #1976d2; }
    .badge-default { background: #1976d2; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 6px; }
    .contact-phone { font-size: 11px; color: #888; margin-left: 6px; }
    .field-error { font-size: 11px; color: #e53e3e; margin-top: 3px; display: block; }
    .addr-form {
      background: #f8f9fa; padding: 16px; border-radius: 8px;
      margin-bottom: 20px; border: 1px solid #e2e8f0;
    }
    .addr-form-title { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 12px; }
    .addr-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .timeline { display: flex; flex-direction: column; gap: 16px; position: relative; padding-left: 20px; }
    .timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background: var(--border); }
    .timeline-item { display: flex; gap: 12px; position: relative; }
    .timeline-badge { position: absolute; left: -20px; background: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); }
    .timeline-badge mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-2); }
    .timeline-body { flex: 1; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .timeline-header { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; }
    .timeline-action { font-weight: 600; color: var(--primary); }
    .timeline-date { color: var(--text-3); font-size: 11px; margin-left: auto; }
    .timeline-changes { margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
    .change-pair { display: flex; align-items: center; }
    .change-field { font-weight: 600; color: #475569; margin-right: 6px; text-transform: capitalize; }
    .change-old { color: #ef4444; text-decoration: line-through; }
    .change-new { color: #22c55e; font-weight: 500; }
  `],
})
export class VendorDetailComponent implements OnInit {
  id = input.required<string>();
  private http   = inject(HttpClient);
  private fb     = inject(FormBuilder);
  private notify = inject(NotificationService);
  readonly auth  = inject(AuthService);
  readonly router = inject(Router);
  pincodeLoading = signal(false);

  vendor = signal<Vendor | null>(null);
  activity = signal<any[]>([]);
  loading = signal(true);
  showAddressForm = signal(false);
  savingAddress = signal(false);
  editingAddress = signal<VendorAddress | null>(null);
  addrCols = ['label', 'state', 'gstin', 'contact', 'actions'];

  addressForm = this.fb.group({
    label:         ['', Validators.required],
    address:       [''],
    pincode:       [''],
    city:          [''],
    state:         [''],
    state_code:    [''],
    country:       ['India'],
    gstin:         ['', gstinValidator()],
    contact_name:  [''],
    contact_phone: ['', phoneValidator()],
    is_default:    [false],
  });

  ngOnInit() {
    this.http.get<Vendor>(`${environment.apiUrl}/vendors/${this.id()}`).subscribe({
      next: v => { this.vendor.set(v); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    this.http.get<any[]>(`${environment.apiUrl}/vendors/${this.id()}/activity`).subscribe({
      next: act => this.activity.set(act),
      error: () => {}
    });
  }

  getChangePairs(changesObj: any): { field: string; old: any; new: any }[] {
    if (!changesObj) return [];
    return Object.entries(changesObj).map(([field, vals]: [string, any]) => ({
      field: field.replace(/_/g, ' '),
      old: vals.old,
      new: vals.new
    }));
  }

  openAddressForm(addr: VendorAddress | null) {
    this.editingAddress.set(addr);
    this.addressForm.reset({
      label:         addr?.label                    ?? '',
      address:       (addr as any)?.address        ?? '',
      pincode:       (addr as any)?.pincode        ?? '',
      city:          (addr as any)?.city           ?? '',
      state:         addr?.state                    ?? '',
      state_code:    addr?.state_code               ?? '',
      country:       (addr as any)?.country        ?? 'India',
      gstin:         addr?.gstin                    ?? '',
      contact_name:  addr?.contact_name             ?? '',
      contact_phone: addr?.contact_phone            ?? '',
      is_default:    addr?.is_default               ?? false,
    });
    this.showAddressForm.set(true);
  }

  lookupPincode() {
    const pin = (this.addressForm.get('pincode')?.value ?? '').replace(/\D/g, '').trim();
    if (pin.length < 4) return;
    this.pincodeLoading.set(true);
    // Route through our backend to avoid CORS restrictions
    this.http.get<any>(`${environment.apiUrl}/pincode/${pin}`).subscribe({
      next: res => {
        this.pincodeLoading.set(false);
        if (res?.success) {
          this.addressForm.patchValue({
            city:    res.city    ?? '',
            state:   res.state   ?? '',
            country: res.country ?? 'India',
          });
          this.notify.success(`Address auto-filled from pincode ${pin}`);
        } else {
          this.notify.error('Pincode not found — please fill manually.');
        }
      },
      error: err => {
        this.pincodeLoading.set(false);
        const msg = err.status === 404
          ? 'Pincode not found — please fill manually.'
          : 'Lookup service unavailable — fill manually.';
        this.notify.error(msg);
      },
    });
  }

  cancelAddressForm() {
    this.showAddressForm.set(false);
    this.editingAddress.set(null);
    this.addressForm.reset();
  }

  saveAddress() {
    if (this.addressForm.invalid) return;
    this.savingAddress.set(true);
    const editing = this.editingAddress();

    const addrPayload = this.addressForm.value;
    const req = editing
      ? this.http.put<VendorAddress>(
          `${environment.apiUrl}/vendors/${this.id()}/addresses/${editing.id}`,
          addrPayload
        )
      : this.http.post<VendorAddress>(
          `${environment.apiUrl}/vendors/${this.id()}/addresses`,
          addrPayload
        );

    req.subscribe({
      next: addr => {
        if (editing) {
          this.vendor.update(v => v ? {
            ...v,
            addresses: (v.addresses ?? []).map(a => a.id === addr.id ? addr : a),
          } : v);
          this.notify.success('Address updated.');
        } else {
          this.vendor.update(v => v ? { ...v, addresses: [...(v.addresses ?? []), addr] } : v);
          this.notify.success('Address added.');
        }
        this.cancelAddressForm();
        this.savingAddress.set(false);
      },
      error: (err) => {
        this.notify.error(err?.error?.message || 'Failed to save address.');
        this.savingAddress.set(false);
      },
    });
  }

  deleteAddress(addr: VendorAddress) {
    if (!confirm(`Delete address "${addr.label}"?`)) return;
    this.http.delete(`${environment.apiUrl}/vendors/${this.id()}/addresses/${addr.id}`).subscribe({
      next: () => {
        this.vendor.update(v => v ? {
          ...v,
          addresses: (v.addresses ?? []).filter(a => a.id !== addr.id),
        } : v);
        this.notify.success('Address deleted.');
      },
      error: () => this.notify.error('Failed to delete address.'),
    });
  }
}
