import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { Category, SourcingRequest, SourcingVendorContact } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { SourcingContactDialogComponent } from './sourcing-contact-dialog.component';

@Component({
  selector: 'app-sourcing-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TitleCasePipe, RouterLink, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatProgressSpinnerModule,
    MatCardModule, MatDividerModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      @if (loading()) {
        <div style="display:flex;justify-content:center;padding:80px;">
          <mat-spinner diameter="40" />
        </div>
      } @else if (request()) {
        
        <!-- Top Header matching PO / PR Detail -->
        <div class="detail-header">
          <div class="header-left">
            <button mat-icon-button routerLink="/sourcing" class="back-btn" matTooltip="Back to Sourcing List">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div>
              <div class="title-row">
                <h2>{{ request()!.sourcing_number }}</h2>
                <span class="status-badge" [class.status-approved]="request()!.status === 'closed'" [class.status-submitted]="request()!.status === 'open'">
                  {{ request()!.status === 'open' ? 'Open' : 'Closed' }}
                </span>
                @if (request()!.source_type === 'pr') {
                  <span class="source-chip pr">
                    <mat-icon>description</mat-icon> PR: {{ request()!.pr_ref || ('#' + request()!.pr_id) }}
                  </span>
                } @else {
                  <span class="source-chip direct">
                    <mat-icon>edit_note</mat-icon> Direct Entry
                  </span>
                }
              </div>
              <p class="subtitle">
                {{ request()!.item_name }} · Organization: <strong>{{ request()!.client_name || request()!.tenant?.name || 'All Organizations' }}</strong>
              </p>
            </div>
          </div>

          <div class="header-actions">
            @if (request()!.pr_id) {
              <a mat-stroked-button [routerLink]="['/purchase-requisitions', request()!.pr_id]" target="_blank">
                <mat-icon>open_in_new</mat-icon> View PR
              </a>
            }

            @if (bestQuote()) {
              <button mat-stroked-button color="primary" (click)="promoteToMaster()" [disabled]="promoting()">
                <mat-icon>library_add</mat-icon> Promote to Product Master
              </button>
            }

            @if (request()!.status === 'open') {
              <button mat-raised-button color="warn" (click)="toggleStatus('closed')" [disabled]="updatingStatus()">
                <mat-icon>done_all</mat-icon> Mark Closed
              </button>
            } @else {
              <button mat-stroked-button color="primary" (click)="toggleStatus('open')" [disabled]="updatingStatus()">
                <mat-icon>replay</mat-icon> Reopen
              </button>
            }
          </div>
        </div>

        <!-- ── SMART TYPO / POTENTIAL MASTER MATCH ALERT ── -->
        @if (!request()!.product_id && masterSuggestions().length > 0) {
          <div class="smart-match-banner">
            <div class="banner-icon">
              <mat-icon>auto_awesome</mat-icon>
            </div>
            <div style="flex:1;">
              <div class="banner-title">
                Potential Product Master Match Detected (Check for Typo)
              </div>
              <div class="banner-desc">
                The item name <strong>"{{ request()!.item_name }}"</strong> might already exist in the Master Catalog. If this was a typo, you can map it with 1-click to avoid duplicate sourcing:
              </div>
              <div class="suggestions-row">
                @for (m of masterSuggestions(); track m.product_id) {
                  <div class="sugg-chip">
                    <div class="sugg-info">
                      <strong>{{ m.name }}</strong> (Code: {{ m.code || '—' }}, Rate: ₹{{ m.net_rate | number:'1.2-2' }})
                      <span class="match-pct">{{ m.score }}% Match</span>
                    </div>
                    <button mat-flat-button color="accent" class="btn-xs-sugg" (click)="mapToMaster(m)" [disabled]="mappingMaster()">
                      Map to this Product
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <div class="detail-grid">

          <!-- Left Column: Sourcing Info & Remarks -->
          <div class="left-col">
            
            <mat-card class="info-card">
              <mat-card-header>
                <mat-card-title>Sourcing Details</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">Sourcing Number</span><span>{{ request()!.sourcing_number }}</span></div>
                  <div class="info-item"><span class="info-label">Source Type</span><span style="text-transform:uppercase;font-weight:600;">{{ request()!.source_type }}</span></div>
                  <div class="info-item"><span class="info-label">Organization</span><span>{{ request()!.client_name || request()!.tenant?.name || '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Delivery Location</span><span>{{ request()!.delivery_location || request()!.location?.name || '—' }}</span></div>
                  <div class="info-item"><span class="info-label">RFQ Reference</span><span>{{ request()!.rfq_ref || '—' }}</span></div>
                  <div class="info-item"><span class="info-label">PR Reference</span><span>{{ request()!.pr_ref || '—' }}</span></div>
                  <div class="info-item"><span class="info-label">Created By</span><span>{{ request()!.creator?.name || 'Buyer' }}</span></div>
                  <div class="info-item"><span class="info-label">Created Date</span><span>{{ request()!.created_at | date:'dd MMM yyyy HH:mm' }}</span></div>
                  @if (request()!.status === 'closed') {
                    <div class="info-item" style="grid-column:1/-1;background:#f0fdf4;padding:8px 12px;border-radius:6px;border:1px solid #bbf7d0;">
                      <span class="info-label" style="color:#166534;">Closure Note</span>
                      <span style="font-size:13px;color:#14532d;">{{ request()!.closure_notes || 'Sourcing completed and finalized.' }}</span>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Working Remarks & Buyer Call Logs -->
            <mat-card class="info-card" style="margin-top:20px;">
              <mat-card-header>
                <mat-card-title style="display:flex;align-items:center;gap:6px;">
                  <mat-icon style="font-size:18px;width:18px;height:18px;color:#0284c7;">phone_in_talk</mat-icon>
                  Working Remarks &amp; Call Logs ({{ request()!.remarks?.length || 0 }})
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <!-- Add Remark Box -->
                <div class="remark-input-group">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Add call log, vendor response, or negotiation update…</mat-label>
                    <textarea matInput [(ngModel)]="newRemarkText" rows="2"></textarea>
                  </mat-form-field>
                  <div style="display:flex;justify-content:flex-end;margin-top:-6px;margin-bottom:12px;">
                    <button mat-raised-button color="primary" (click)="addRemark()" [disabled]="!newRemarkText.trim() || postingRemark()" style="height:32px;font-size:12px;">
                      @if (postingRemark()) { <mat-spinner diameter="14" style="display:inline-block;margin-right:4px;" /> }
                      Post Remark
                    </button>
                  </div>
                </div>

                <!-- Feed -->
                @if (request()!.remarks?.length) {
                  <div class="remarks-feed">
                    @for (rem of request()!.remarks; track rem.id) {
                      <div class="remark-bubble">
                        <div class="remark-head">
                          <span class="remark-user">{{ rem.user?.name || 'Buyer' }}</span>
                          <span class="remark-date">{{ rem.created_at | date:'dd MMM, HH:mm' }}</span>
                        </div>
                        <div class="remark-text">{{ rem.remark }}</div>
                      </div>
                    }
                  </div>
                } @else {
                  <div style="text-align:center;padding:20px;color:var(--text-3);font-size:12.5px;">
                    No remarks recorded yet.
                  </div>
                }
              </mat-card-content>
            </mat-card>

          </div>

          <!-- Right Column: Item Spec & Vendor Quotations -->
          <div class="right-col">
            
            <!-- Item Spec Card -->
            <mat-card class="items-card">
              <mat-card-header style="display:flex;justify-content:space-between;align-items:center;">
                <mat-card-title>Item Specifications &amp; Pricing</mat-card-title>
                @if (!canEditCore()) {
                  <span style="font-size:11px;color:var(--text-3);display:flex;align-items:center;gap:4px;">
                    <mat-icon style="font-size:14px;width:14px;height:14px;">lock</mat-icon> Core details locked by creator
                  </span>
                }
              </mat-card-header>
              <mat-card-content>
                @if (canEditCore()) {
                  <form [formGroup]="editForm" (ngSubmit)="saveCoreDetails()">
                    <div class="spec-form-grid">
                      <mat-form-field appearance="outline" class="col-span-2">
                        <mat-label>Item Name *</mat-label>
                        <input matInput formControlName="item_name" />
                      </mat-form-field>

                      <mat-form-field appearance="outline" class="col-span-2">
                        <mat-label>Detailed Specification</mat-label>
                        <textarea matInput formControlName="specification" rows="2"></textarea>
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

                      <mat-form-field appearance="outline">
                        <mat-label>Required Qty *</mat-label>
                        <input matInput formControlName="qty" type="number" step="any" />
                      </mat-form-field>

                      <mat-form-field appearance="outline">
                        <mat-label>Unit (UOM)</mat-label>
                        <input matInput formControlName="unit" />
                      </mat-form-field>

                      <mat-form-field appearance="outline">
                        <mat-label>Target / Budget Price (₹)</mat-label>
                        <input matInput formControlName="target_price" type="number" />
                      </mat-form-field>
                    </div>

                    <div style="display:flex;justify-content:flex-end;margin-top:6px;">
                      <button mat-stroked-button color="primary" type="submit" [disabled]="editForm.invalid || savingCore()">
                        @if (savingCore()) { <mat-spinner diameter="14" style="display:inline-block;margin-right:4px;" /> }
                        Save Specification
                      </button>
                    </div>
                  </form>
                } @else {
                  <div class="info-grid">
                    <div class="info-item"><span class="info-label">Item Name</span><strong>{{ request()!.item_name }}</strong></div>
                    <div class="info-item"><span class="info-label">Category</span><span>{{ request()!.category?.name || request()!.category_name || '—' }}</span></div>
                    <div class="info-item"><span class="info-label">Required Quantity</span><strong>{{ request()!.qty }} {{ request()!.unit }}</strong></div>
                    <div class="info-item"><span class="info-label">Target / Budget Price</span><span>{{ request()!.target_price ? ('₹' + (request()!.target_price | number:'1.2-2')) : '—' }}</span></div>
                  </div>
                  @if (request()!.specification) {
                    <mat-divider style="margin:12px 0;" />
                    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">Specification</div>
                    <div style="font-size:13px;color:var(--text-1);white-space:pre-wrap;background:#f8fafc;padding:10px 12px;border-radius:6px;border:1px solid #e2e8f0;">{{ request()!.specification }}</div>
                  }
                }
              </mat-card-content>
            </mat-card>

            <!-- Vendor Quotations Card -->
            <mat-card class="items-card" style="margin-top:20px;">
              <mat-card-header style="display:flex;justify-content:space-between;align-items:center;">
                <mat-card-title style="display:flex;align-items:center;gap:6px;">
                  <mat-icon style="font-size:18px;width:18px;height:18px;color:#16a34a;">store</mat-icon>
                  Vendor Quotations &amp; Contacts ({{ request()!.vendor_contacts?.length || 0 }})
                </mat-card-title>
                <button mat-raised-button color="primary" (click)="openAddContactDialog()" style="height:32px;font-size:12px;">
                  <mat-icon style="font-size:14px;width:14px;height:14px;margin-right:2px;">add</mat-icon> Add Quote
                </button>
              </mat-card-header>
              <mat-card-content style="padding:0!important;">
                @if (request()!.vendor_contacts?.length) {
                  <table class="quotes-table">
                    <thead>
                      <tr>
                        <th>Vendor / Company</th>
                        <th>Contact Details</th>
                        <th>Quoted Price</th>
                        <th>Lead Time &amp; Terms</th>
                        <th>Notes</th>
                        <th style="text-align:right;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of request()!.vendor_contacts; track c.id) {
                        <tr>
                          <td>
                            <div style="font-weight:700;font-size:13px;color:var(--text-1);">{{ c.vendor_name }}</div>
                            @if (c.contact_person) {
                              <div style="font-size:11.5px;color:var(--text-2);">{{ c.contact_person }}</div>
                            }
                          </td>

                          <td>
                            @if (c.phone) {
                              <div style="font-size:12px;"><a href="tel:{{ c.phone }}" style="color:#2563eb;text-decoration:none;">{{ c.phone }}</a></div>
                            }
                            @if (c.email) {
                              <div style="font-size:11.5px;color:var(--text-3);">{{ c.email }}</div>
                            }
                          </td>

                          <td>
                            @if (c.quoted_price !== null && c.quoted_price !== undefined) {
                              <div style="font-size:14px;font-weight:800;color:#16a34a;">₹{{ c.quoted_price | number:'1.2-2' }}</div>
                              @if (c.gst_rate) { <div style="font-size:10px;color:#16a34a;font-weight:600;">+{{ c.gst_rate }}% GST</div> }
                            } @else {
                              <span style="color:#94a3b8;font-size:12px;">—</span>
                            }
                          </td>

                          <td>
                            @if (c.lead_time_days) { <div style="font-size:12px;">{{ c.lead_time_days }} days</div> }
                            @if (c.payment_terms) { <div style="font-size:11px;color:var(--text-3);">{{ c.payment_terms }}</div> }
                          </td>

                          <td>
                            @if (c.notes) {
                              <div style="font-size:11.5px;color:var(--text-2);max-width:180px;font-style:italic;">"{{ c.notes }}"</div>
                            } @else {
                              <span style="color:#94a3b8;font-size:11px;">—</span>
                            }
                          </td>

                          <td style="text-align:right;">
                            <div style="display:inline-flex;gap:2px;">
                              <button mat-icon-button class="action-btn-mini" (click)="openEditContactDialog(c)" matTooltip="Edit Quote">
                                <mat-icon>edit</mat-icon>
                              </button>
                              <button mat-icon-button color="warn" class="action-btn-mini" (click)="deleteContact(c)" matTooltip="Remove Quote">
                                <mat-icon>delete_outline</mat-icon>
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <div style="text-align:center;padding:32px 20px;color:var(--text-3);">
                    <p style="margin:0 0 8px;font-size:13px;">No vendor quotations added yet.</p>
                    <button mat-stroked-button color="primary" (click)="openAddContactDialog()">
                      <mat-icon>add</mat-icon> Add First Quote
                    </button>
                  </div>
                }
              </mat-card-content>
            </mat-card>

          </div>

        </div>

      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .back-btn { background: #f1f5f9; }
    .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .title-row h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .subtitle { margin: 3px 0 0; font-size: 13px; color: var(--text-3); }
    .header-actions { display: flex; align-items: center; gap: 10px; }

    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .status-submitted { background: #eff6ff; color: #2563eb; }
    .status-approved  { background: #f0fdf4; color: #16a34a; }

    .source-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .source-chip.pr { background: #eff6ff; color: #2563eb; }
    .source-chip.direct { background: #fdf4ff; color: #a855f7; }
    .source-chip mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* Smart Match Banner */
    .smart-match-banner {
      background: #eff6ff;
      border: 1px solid #93c5fd;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .banner-icon { width: 36px; height: 36px; border-radius: 8px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; }
    .banner-title { font-size: 14px; font-weight: 700; color: #1e3a8a; }
    .banner-desc { font-size: 12.5px; color: #3b82f6; margin: 3px 0 10px; }
    .suggestions-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .sugg-chip { background: #fff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 12px; display: flex; align-items: center; gap: 12px; }
    .sugg-info { font-size: 12px; color: #1e293b; }
    .match-pct { background: #2563eb; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-left: 6px; }
    .btn-xs-sugg { height: 26px!important; font-size: 11px!important; padding: 0 8px!important; line-height: 26px!important; }

    .detail-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; align-items: start; }
    @media (max-width: 1000px) { .detail-grid { grid-template-columns: 1fr; } }

    .info-card, .items-card { border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-top: 8px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-3); letter-spacing: .05em; }
    .info-item span:last-child { font-size: 13px; color: var(--text-1); }

    .spec-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 8px; }
    .col-span-2 { grid-column: 1 / -1; }

    .remark-bubble { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .remark-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .remark-user { font-size: 12px; font-weight: 700; color: #0284c7; }
    .remark-date { font-size: 11px; color: var(--text-3); }
    .remark-text { font-size: 13px; color: var(--text-1); white-space: pre-wrap; }

    .quotes-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .quotes-table th { background: #f8fafc; color: var(--text-3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; }
    .quotes-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .action-btn-mini { width: 28px!important; height: 28px!important; line-height: 28px!important; }
    .action-btn-mini mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `]
})
export class SourcingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  request = signal<SourcingRequest | null>(null);
  masterSuggestions = signal<any[]>([]);
  categories = signal<Category[]>([]);

  savingCore = signal(false);
  updatingStatus = signal(false);
  postingRemark = signal(false);
  mappingMaster = signal(false);
  promoting = signal(false);

  newRemarkText = '';

  editForm: FormGroup = this.fb.group({
    item_name: ['', Validators.required],
    specification: [''],
    category_id: [null],
    qty: [1, [Validators.required, Validators.min(0.001)]],
    unit: ['Nos'],
    target_price: [null],
  });

  canEditCore = computed(() => {
    const r = this.request();
    if (!r) return false;
    const u = this.auth.user();
    if (!u) return false;
    return r.created_by === u.id || this.auth.isSuperAdmin() || this.auth.isZopaStaff();
  });

  bestQuote = computed(() => {
    const contacts = this.request()?.vendor_contacts;
    if (!contacts?.length) return null;
    const prices = contacts.map(c => c.quoted_price ? +c.quoted_price : null).filter((p): p is number => p !== null && p > 0);
    if (!prices.length) return null;
    return Math.min(...prices);
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDetail(+id);
      this.loadCategories();
    }
  }

  loadDetail(id: number) {
    this.loading.set(true);
    this.http.get<any>(`${environment.apiUrl}/sourcing/${id}`).subscribe({
      next: res => {
        this.request.set(res);
        this.masterSuggestions.set(res.master_suggestions || []);
        this.editForm.patchValue({
          item_name: res.item_name,
          specification: res.specification,
          category_id: res.category_id,
          qty: res.qty,
          unit: res.unit,
          target_price: res.target_price,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Could not load sourcing request details.');
      }
    });
  }

  loadCategories() {
    this.http.get<any>(`${environment.apiUrl}/categories`).subscribe({
      next: res => this.categories.set(res.data ?? res),
      error: () => {}
    });
  }

  mapToMaster(matchedProduct: any) {
    if (!confirm(`Map this sourcing item to Master Product "${matchedProduct.name}" (Rate: ₹${matchedProduct.net_rate})? This resolves the typo and marks sourcing as completed.`)) {
      return;
    }

    this.mappingMaster.set(true);
    this.http.post<{ message: string; data: SourcingRequest }>(
      `${environment.apiUrl}/sourcing/${this.request()!.id}/map-master`,
      { product_id: matchedProduct.product_id }
    ).subscribe({
      next: res => {
        this.mappingMaster.set(false);
        this.request.set(res.data);
        this.masterSuggestions.set([]);
        this.notify.success(res.message || 'Mapped to master product.');
      },
      error: err => {
        this.mappingMaster.set(false);
        this.notify.error(err.error?.message || 'Failed to map to master product.');
      }
    });
  }

  promoteToMaster() {
    const req = this.request()!;
    const bestRate = this.bestQuote() || req.target_price || 0;

    const name = prompt('Enter Product Name for Master Catalog:', req.item_name);
    if (!name) return;

    this.promoting.set(true);
    this.http.post<{ message: string; data: any }>(
      `${environment.apiUrl}/sourcing/${req.id}/promote-master`,
      {
        name: name.trim(),
        description: req.specification || req.item_name,
        category_id: req.category_id,
        unit: req.unit,
        net_rate: bestRate,
        gst_rate: 18,
      }
    ).subscribe({
      next: res => {
        this.promoting.set(false);
        this.notify.success(res.message || 'Product promoted to Master Catalog.');
        this.loadDetail(req.id);
      },
      error: err => {
        this.promoting.set(false);
        this.notify.error(err.error?.message || 'Failed to promote to Master Catalog.');
      }
    });
  }

  saveCoreDetails() {
    if (this.editForm.invalid || !this.request()) return;
    this.savingCore.set(true);

    this.http.put<{ message: string; data: SourcingRequest }>(
      `${environment.apiUrl}/sourcing/${this.request()!.id}`,
      this.editForm.value
    ).subscribe({
      next: res => {
        this.savingCore.set(false);
        this.request.update(curr => curr ? { ...curr, ...res.data } : res.data);
        this.notify.success(res.message || 'Specification updated.');
      },
      error: err => {
        this.savingCore.set(false);
        this.notify.error(err.error?.error || err.error?.message || 'Failed to update details.');
      }
    });
  }

  toggleStatus(newStatus: 'open' | 'closed') {
    if (!this.request()) return;
    this.updatingStatus.set(true);

    this.http.put<{ message: string; data: SourcingRequest }>(
      `${environment.apiUrl}/sourcing/${this.request()!.id}`,
      { status: newStatus }
    ).subscribe({
      next: res => {
        this.updatingStatus.set(false);
        this.request.update(curr => curr ? { ...curr, status: newStatus } : null);
        this.notify.success(newStatus === 'closed' ? 'Sourcing marked as Closed.' : 'Sourcing reopened.');
      },
      error: err => {
        this.updatingStatus.set(false);
        this.notify.error(err.error?.message || 'Failed to update status.');
      }
    });
  }

  addRemark() {
    if (!this.newRemarkText.trim() || !this.request()) return;
    this.postingRemark.set(true);

    this.http.post<{ message: string; data: any }>(
      `${environment.apiUrl}/sourcing/${this.request()!.id}/remarks`,
      { remark: this.newRemarkText.trim() }
    ).subscribe({
      next: res => {
        this.postingRemark.set(false);
        this.request.update(curr => {
          if (!curr) return null;
          const rems = [res.data, ...(curr.remarks || [])];
          return { ...curr, remarks: rems };
        });
        this.newRemarkText = '';
        this.notify.success('Working remark added.');
      },
      error: err => {
        this.postingRemark.set(false);
        this.notify.error(err.error?.message || 'Failed to add remark.');
      }
    });
  }

  openAddContactDialog() {
    if (!this.request()) return;
    const ref = this.dialog.open(SourcingContactDialogComponent, {
      width: '600px',
      data: { sourcingRequestId: this.request()!.id, contact: null },
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.request.update(curr => {
          if (!curr) return null;
          const contacts = [res, ...(curr.vendor_contacts || [])];
          return { ...curr, vendor_contacts: contacts };
        });
      }
    });
  }

  openEditContactDialog(contact: SourcingVendorContact) {
    if (!this.request()) return;
    const ref = this.dialog.open(SourcingContactDialogComponent, {
      width: '600px',
      data: { sourcingRequestId: this.request()!.id, contact },
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.request.update(curr => {
          if (!curr) return null;
          const contacts = (curr.vendor_contacts || []).map(c => c.id === res.id ? res : c);
          return { ...curr, vendor_contacts: contacts };
        });
      }
    });
  }

  deleteContact(contact: SourcingVendorContact) {
    if (!confirm(`Remove vendor contact ${contact.vendor_name}?`)) return;
    this.http.delete(`${environment.apiUrl}/sourcing/${this.request()!.id}/contacts/${contact.id}`).subscribe({
      next: () => {
        this.request.update(curr => {
          if (!curr) return null;
          const contacts = (curr.vendor_contacts || []).filter(c => c.id !== contact.id);
          return { ...curr, vendor_contacts: contacts };
        });
        this.notify.success('Vendor contact removed.');
      },
      error: () => this.notify.error('Could not remove vendor contact.')
    });
  }
}
