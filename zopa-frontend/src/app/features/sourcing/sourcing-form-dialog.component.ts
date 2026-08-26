import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { DecimalPipe, DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { Category, Location, Product, SourcingRequest } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-sourcing-form-dialog',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatTabsModule, MatCheckboxModule, MatProgressSpinnerModule, MatChipsModule,
    DecimalPipe, DatePipe,
  ],
  template: `
    <div class="dialog-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="header-icon">
          <mat-icon>travel_explore</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title style="margin:0;font-size:18px;font-weight:700;">Create Sourcing Request</h2>
          <p style="margin:2px 0 0;font-size:12px;color:var(--text-3);">
            Initiate price discovery and vendor sourcing (Direct Entry or from Client PRs)
          </p>
        </div>
      </div>
      <button mat-icon-button mat-dialog-close class="close-btn"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content style="padding-top:8px!important;max-height:78vh;">
      <mat-tab-group (selectedTabChange)="onTabChange($event.index)" animationDuration="150ms">

        <!-- ── TAB 1: DIRECT ENTRY ────────────────────────── -->
        <mat-tab label="Direct Entry">
          <form [formGroup]="directForm" class="dialog-form" style="margin-top:16px;">

            <div class="form-row two-col">
              <mat-form-field appearance="outline">
                <mat-label>Item Name *</mat-label>
                <input matInput formControlName="item_name" placeholder="e.g. Surgical Gloves Latex" />
                <mat-error>Item name is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Category</mat-label>
                <mat-select formControlName="category_id">
                  <mat-option [value]="null">— None —</mat-option>
                  @for (cat of categories(); track cat.id) {
                    <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Item Specification / Details</mat-label>
                <textarea matInput formControlName="specification" rows="2" placeholder="e.g. Size 7.5, sterile, powder-free, box of 100 pairs"></textarea>
              </mat-form-field>
            </div>

            <div class="form-row three-col">
              <mat-form-field appearance="outline">
                <mat-label>Required Qty *</mat-label>
                <input matInput formControlName="qty" type="number" min="0.001" step="any" placeholder="1" />
                <mat-error>Valid quantity is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Unit (UOM)</mat-label>
                <input matInput formControlName="unit" placeholder="e.g. Nos, Box, Mtr, Bottle" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Target / Budget Price (₹)</mat-label>
                <input matInput formControlName="target_price" type="number" min="0" placeholder="Optional" />
              </mat-form-field>
            </div>

            <div class="form-row three-col">
              <mat-form-field appearance="outline">
                <mat-label>Client / Organization</mat-label>
                <input matInput formControlName="client_name" placeholder="e.g. Total Health, Aragonda" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Delivery Location</mat-label>
                <input matInput formControlName="delivery_location" placeholder="e.g. Aragonda Hospital, Chittoor" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>RFQ Ref No</mat-label>
                <input matInput formControlName="rfq_ref" placeholder="e.g. RFQ-2026-089" />
              </mat-form-field>
            </div>

            <!-- Optional Initial Vendor Contact -->
            <div class="section-title">Initial Vendor Contact & Quote (Optional)</div>
            <div class="form-row two-col">
              <mat-form-field appearance="outline">
                <mat-label>Vendor / Company Name</mat-label>
                <input matInput formControlName="vendor_name" placeholder="e.g. ABC Medical Supplies" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Contact Person</mat-label>
                <input matInput formControlName="contact_person" placeholder="e.g. Suresh Patel" />
              </mat-form-field>
            </div>

            <div class="form-row three-col">
              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" placeholder="+91 9876543210" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email" placeholder="vendor@example.com" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Quoted Price (₹)</mat-label>
                <input matInput formControlName="quoted_price" type="number" min="0" placeholder="0.00" />
              </mat-form-field>
            </div>

            <!-- Optional Initial Working Remark -->
            <div class="section-title">Initial Working Remark / Call Log (Optional)</div>
            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Working Remark</mat-label>
                <textarea matInput formControlName="initial_remark" rows="2" placeholder="e.g. Spoke with vendor, awaiting revised price quotation with bulk discount..."></textarea>
              </mat-form-field>
            </div>

          </form>
        </mat-tab>

        <!-- ── TAB 2: FROM PR (ALL ORGANIZATIONS) ────────── -->
        <mat-tab label="From PR (All Organizations)">
          <div style="padding-top:16px;">
            <!-- Filter Bar for PR Items -->
            <div class="pr-filters-row">
              <mat-form-field appearance="outline" style="flex:1;">
                <mat-label>Search PR Items / Requisitions / Orgs</mat-label>
                <input matInput [(ngModel)]="prSearchText" (keyup.enter)="loadPrItems()" placeholder="e.g. Paracetamol, Total Health, PR-36..." />
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>

              <button mat-stroked-button (click)="loadPrItems()" style="height:52px;margin-top:2px;">
                <mat-icon>search</mat-icon> Search
              </button>
            </div>

            <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
              <mat-checkbox [(ngModel)]="unpricedOnly" (change)="loadPrItems()" color="primary">
                Show Only Unpriced Items (No approved price)
              </mat-checkbox>
              <span style="font-size:12px;color:var(--text-3);margin-left:auto;">
                Showing {{ prItems().length }} PR line item(s) across all clients
              </span>
            </div>

            <!-- PR Items Table -->
            @if (loadingPrItems()) {
              <div style="display:flex;justify-content:center;padding:40px;">
                <mat-spinner diameter="32" />
              </div>
            } @else if (prItems().length === 0) {
              <div class="empty-state">
                <mat-icon>search_off</mat-icon>
                <p>No matching PR line items found across organizations.</p>
              </div>
            } @else {
              <div class="pr-items-container">
                <table class="pr-items-table">
                  <thead>
                    <tr>
                      <th style="width:40px;">Select</th>
                      <th>Organization / PR Ref</th>
                      <th>Item Description</th>
                      <th>Qty & UOM</th>
                      <th>Est. Price</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (it of prItems(); track it.id) {
                      <tr [class.selected-row]="selectedPrItemId() === it.id">
                        <td>
                          <input type="radio" name="prItemSelect" [value]="it.id" [checked]="selectedPrItemId() === it.id" (change)="selectPrItem(it)" />
                        </td>
                        <td>
                          <div style="font-weight:700;font-size:12px;color:var(--brand);">
                            {{ it.pr?.tenant?.name ?? 'Client' }}
                          </div>
                          <div style="font-size:11px;color:var(--text-3);">
                            {{ it.pr?.pr_number ?? ('PR #' + it.pr?.id) }}
                          </div>
                        </td>
                        <td>
                          <div style="font-weight:600;font-size:13px;color:var(--text-1);">{{ it.description }}</div>
                          @if (it.category?.name) {
                            <div style="font-size:11px;color:var(--text-3);">Category: {{ it.category.name }}</div>
                          }
                        </td>
                        <td>
                          <strong>{{ it.qty }}</strong> {{ it.unit }}
                        </td>
                        <td>
                          @if (it.estimated_price > 0) {
                            <span>₹{{ it.estimated_price | number:'1.2-2' }}</span>
                          } @else {
                            <span class="unpriced-badge">Unpriced</span>
                          }
                        </td>
                        <td>
                          <button mat-stroked-button color="primary" class="btn-xs" (click)="createFromPrItem(it)" [disabled]="saving()">
                            Select & Source
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

          </div>
        </mat-tab>

      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding:16px 24px;">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      @if (activeTab() === 0) {
        <button mat-raised-button color="primary" (click)="saveDirect()" [disabled]="directForm.invalid || saving()">
          @if (saving()) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px;" /> }
          Create Sourcing Request
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header { display:flex; justify-content:space-between; align-items:center; padding:18px 24px 10px; }
    .header-icon { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg, #0ea5e9, #0284c7); color:#fff; display:flex; align-items:center; justify-content:center; }
    .dialog-form { display:flex; flex-direction:column; gap:8px; }
    .form-row { width:100%; }
    .full-width { width:100%; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .three-col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .section-title { font-size:12px; font-weight:700; color:#0284c7; text-transform:uppercase; letter-spacing:0.5px; margin:10px 0 4px; }
    
    .pr-filters-row { display:flex; gap:10px; align-items:flex-start; }
    .pr-items-container { max-height:360px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; }
    .pr-items-table { width:100%; border-collapse:collapse; font-size:12.5px; }
    .pr-items-table th { background:#f8fafc; padding:10px 12px; text-align:left; font-weight:700; color:#475569; border-bottom:1px solid #e2e8f0; position:sticky; top:0; z-index:2; }
    .pr-items-table td { padding:10px 12px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .pr-items-table tr:hover { background:#f8fafc; }
    .selected-row { background:#eff6ff!important; }
    .unpriced-badge { background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-size:10.5px; font-weight:700; }
    .btn-xs { height:28px!important; font-size:11px!important; padding:0 10px!important; line-height:28px!important; }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:40px; color:#94a3b8; gap:8px; }
  `]
})
export class SourcingFormDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<SourcingFormDialogComponent>);

  activeTab = signal(0);
  saving = signal(false);
  loadingPrItems = signal(false);

  categories = signal<Category[]>([]);
  prItems = signal<any[]>([]);
  selectedPrItemId = signal<number | null>(null);

  prSearchText = '';
  unpricedOnly = false;

  directForm: FormGroup = this.fb.group({
    source_type: ['direct'],
    item_name: ['', Validators.required],
    specification: [''],
    category_id: [null],
    qty: [1, [Validators.required, Validators.min(0.001)]],
    unit: ['Nos'],
    target_price: [null],
    client_name: [''],
    delivery_location: [''],
    rfq_ref: [''],
    vendor_name: [''],
    contact_person: [''],
    phone: [''],
    email: [''],
    quoted_price: [null],
    initial_remark: [''],
  });

  ngOnInit() {
    this.loadCategories();
  }

  onTabChange(index: number) {
    this.activeTab.set(index);
    if (index === 1 && this.prItems().length === 0) {
      this.loadPrItems();
    }
  }

  loadCategories() {
    this.http.get<any>(`${environment.apiUrl}/categories`).subscribe({
      next: res => this.categories.set(res.data ?? res),
      error: () => {}
    });
  }

  loadPrItems() {
    this.loadingPrItems.set(true);
    let params: any = {};
    if (this.prSearchText.trim()) params.search = this.prSearchText.trim();
    if (this.unpricedOnly) params.unpriced_only = 1;

    this.http.get<any>(`${environment.apiUrl}/sourcing/pr-line-items`, { params }).subscribe({
      next: res => {
        this.loadingPrItems.set(false);
        this.prItems.set(res.data ?? res);
      },
      error: () => {
        this.loadingPrItems.set(false);
      }
    });
  }

  selectPrItem(item: any) {
    this.selectedPrItemId.set(item.id);
  }

  createFromPrItem(item: any) {
    this.saving.set(true);
    const payload = {
      items: [{
        pr_id: item.pr_id,
        pr_item_id: item.id,
        description: item.description,
        qty: item.qty,
        unit: item.unit ?? 'Nos',
        category_id: item.category_id,
        remarks: item.remarks ?? '',
      }]
    };

    this.http.post<{ message: string; data: SourcingRequest[] }>(
      `${environment.apiUrl}/sourcing/from-pr`,
      payload
    ).subscribe({
      next: res => {
        this.saving.set(false);
        this.notify.success(res.message || 'Sourcing request created from PR item.');
        this.dialogRef.close(res.data?.[0]);
      },
      error: err => {
        this.saving.set(false);
        this.notify.error(err.error?.message || 'Failed to create sourcing request.');
      }
    });
  }

  saveDirect() {
    if (this.directForm.invalid) {
      this.directForm.markAllAsTouched();
      this.notify.error('Please fill all required fields.');
      return;
    }
    this.saving.set(true);

    const val = { ...this.directForm.value };
    if (!val.category_id) val.category_id = null;
    if (!val.target_price) val.target_price = null;
    if (!val.quoted_price) val.quoted_price = null;

    this.http.post<{ message: string; data: SourcingRequest }>(
      `${environment.apiUrl}/sourcing`,
      val
    ).subscribe({
      next: res => {
        this.saving.set(false);
        this.notify.success(res.message || 'Sourcing request created successfully.');
        this.dialogRef.close(res.data);
      },
      error: err => {
        this.saving.set(false);
        const msg = err.error?.message || (err.error?.errors ? Object.values(err.error.errors).flat().join(', ') : 'Failed to create sourcing request.');
        this.notify.error(msg);
      }
    });
  }
}
