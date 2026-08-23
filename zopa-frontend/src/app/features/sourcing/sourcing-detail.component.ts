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
        <!-- Header -->
        <div class="page-header">
          <div class="header-left">
            <button mat-icon-button routerLink="/sourcing" class="back-btn" matTooltip="Back to Sourcing List">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div>
              <div class="title-row">
                <h2>{{ request()!.sourcing_number }}</h2>
                <span class="status-pill" [class.status-open]="request()!.status === 'open'" [class.status-closed]="request()!.status === 'closed'">
                  <mat-icon>{{ request()!.status === 'open' ? 'play_circle' : 'check_circle' }}</mat-icon>
                  {{ request()!.status | titlecase }}
                </span>
                @if (request()!.source_type === 'pr') {
                  <span class="source-badge pr">
                    <mat-icon>description</mat-icon> From PR: {{ request()!.pr_ref || ('PR #' + request()!.pr_id) }}
                  </span>
                } @else {
                  <span class="source-badge direct">
                    <mat-icon>edit_note</mat-icon> Direct Entry
                  </span>
                }
              </div>
              <p class="subtitle">
                {{ request()!.item_name }} · Organization: <strong>{{ request()!.client_name || request()!.tenant?.name || 'All Organizations' }}</strong> · Created {{ request()!.created_at | date:'dd MMM yyyy HH:mm' }} by {{ request()!.creator?.name || 'Buyer' }}
              </p>
            </div>
          </div>

          <div class="header-actions">
            @if (request()!.pr_id) {
              <a mat-stroked-button [routerLink]="['/purchase-requisitions', request()!.pr_id]" target="_blank" class="btn-compact">
                <mat-icon>open_in_new</mat-icon> View Original PR
              </a>
            }

            @if (request()!.status === 'open') {
              <button mat-raised-button color="warn" class="btn-compact" (click)="toggleStatus('closed')" [disabled]="updatingStatus()">
                <mat-icon>done_all</mat-icon> Mark Closed (Sourcing Done)
              </button>
            } @else {
              <button mat-stroked-button color="primary" class="btn-compact" (click)="toggleStatus('open')" [disabled]="updatingStatus()">
                <mat-icon>replay</mat-icon> Reopen Sourcing
              </button>
            }
          </div>
        </div>

        <div class="main-grid">

          <!-- Left Column: Core Item Details & Pricing Targets -->
          <div class="left-col">
            <mat-card class="detail-card">
              <mat-card-header style="display:flex;justify-content:space-between;align-items:center;">
                <mat-card-title style="display:flex;align-items:center;gap:8px;">
                  <mat-icon style="color:var(--brand);">inventory_2</mat-icon>
                  Item Details & Specification
                </mat-card-title>
                @if (canEditCore()) {
                  <span class="permission-tag owner">
                    <mat-icon>lock_open</mat-icon> Creator Editable
                  </span>
                } @else {
                  <span class="permission-tag locked" matTooltip="Core details can only be edited by the creator ({{ request()!.creator?.name }})">
                    <mat-icon>lock</mat-icon> Locked (View Only)
                  </span>
                }
              </mat-card-header>

              <mat-card-content style="padding-top:12px!important;">
                @if (canEditCore()) {
                  <form [formGroup]="editForm" (ngSubmit)="saveCoreDetails()">
                    <div class="form-grid">
                      <mat-form-field appearance="outline" class="full-span">
                        <mat-label>Item Name *</mat-label>
                        <input matInput formControlName="item_name" />
                      </mat-form-field>

                      <mat-form-field appearance="outline" class="full-span">
                        <mat-label>Specification / Details</mat-label>
                        <textarea matInput formControlName="specification" rows="3"></textarea>
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

                      <mat-form-field appearance="outline">
                        <mat-label>Client / Organization</mat-label>
                        <input matInput formControlName="client_name" />
                      </mat-form-field>

                      <mat-form-field appearance="outline">
                        <mat-label>Delivery Location</mat-label>
                        <input matInput formControlName="delivery_location" />
                      </mat-form-field>

                      <mat-form-field appearance="outline">
                        <mat-label>RFQ Reference No</mat-label>
                        <input matInput formControlName="rfq_ref" />
                      </mat-form-field>
                    </div>

                    <div style="display:flex;justify-content:flex-end;margin-top:10px;">
                      <button mat-raised-button color="primary" type="submit" [disabled]="editForm.invalid || savingCore()">
                        @if (savingCore()) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px;" /> }
                        Save Specification Updates
                      </button>
                    </div>
                  </form>
                } @else {
                  <div class="read-only-grid">
                    <div class="info-item"><span class="info-label">Item Name</span><strong>{{ request()!.item_name }}</strong></div>
                    <div class="info-item"><span class="info-label">Category</span><span>{{ request()!.category?.name || request()!.category_name || '—' }}</span></div>
                    <div class="info-item"><span class="info-label">Required Quantity</span><strong>{{ request()!.qty }} {{ request()!.unit }}</strong></div>
                    <div class="info-item"><span class="info-label">Target / Budget Price</span><span>{{ request()!.target_price ? ('₹' + (request()!.target_price | number:'1.2-2')) : '—' }}</span></div>
                    <div class="info-item"><span class="info-label">Client / Organization</span><span>{{ request()!.client_name || request()!.tenant?.name || '—' }}</span></div>
                    <div class="info-item"><span class="info-label">Delivery Location</span><span>{{ request()!.delivery_location || request()!.location?.name || '—' }}</span></div>
                    <div class="info-item"><span class="info-label">RFQ Reference</span><span>{{ request()!.rfq_ref || '—' }}</span></div>
                    <div class="info-item"><span class="info-label">PR Reference</span><span>{{ request()!.pr_ref || '—' }}</span></div>
                  </div>

                  @if (request()!.specification) {
                    <mat-divider style="margin:12px 0;" />
                    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">Specification</div>
                    <div style="font-size:13px;color:var(--text-1);white-space:pre-wrap;background:#f8fafc;padding:10px 12px;border-radius:6px;border:1px solid #e2e8f0;">{{ request()!.specification }}</div>
                  }
                }
              </mat-card-content>
            </mat-card>

            <!-- Working Remarks & Call Logs Section -->
            <mat-card class="detail-card" style="margin-top:16px;">
              <mat-card-header style="display:flex;justify-content:space-between;align-items:center;">
                <mat-card-title style="display:flex;align-items:center;gap:8px;color:#0284c7;">
                  <mat-icon>phone_in_talk</mat-icon>
                  Working Remarks &amp; Buyer Call Logs ({{ request()!.remarks?.length || 0 }})
                </mat-card-title>
                <span class="permission-tag open-tag">
                  <mat-icon>group</mat-icon> Open to all ZOPA Buyers
                </span>
              </mat-card-header>

              <mat-card-content style="padding-top:12px!important;">
                <!-- Post Remark Box -->
                <div class="new-remark-box">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Add working remark, vendor discussion, or negotiation note...</mat-label>
                    <textarea matInput [(ngModel)]="newRemarkText" rows="2"></textarea>
                  </mat-form-field>
                  <div style="display:flex;justify-content:flex-end;margin-top:-6px;margin-bottom:14px;">
                    <button mat-raised-button color="primary" class="btn-compact" (click)="addRemark()" [disabled]="!newRemarkText.trim() || postingRemark()">
                      @if (postingRemark()) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px;" /> }
                      <mat-icon>send</mat-icon> Post Remark
                    </button>
                  </div>
                </div>

                <!-- Remarks Feed -->
                @if (request()!.remarks?.length) {
                  <div class="remarks-feed">
                    @for (rem of request()!.remarks; track rem.id) {
                      <div class="remark-item">
                        <div class="remark-header">
                          <span class="remark-author">
                            <mat-icon style="font-size:14px;width:14px;height:14px;">account_circle</mat-icon>
                            {{ rem.user?.name || 'Buyer' }}
                          </span>
                          <span class="remark-time">{{ rem.created_at | date:'dd MMM yyyy, HH:mm' }}</span>
                        </div>
                        <div class="remark-body">{{ rem.remark }}</div>
                      </div>
                    }
                  </div>
                } @else {
                  <div style="text-align:center;padding:24px;color:var(--text-3);font-size:13px;">
                    No remarks or call logs posted yet. Add the first update above.
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Right Column: Vendor Contacts & Quotations -->
          <div class="right-col">
            <mat-card class="detail-card">
              <mat-card-header style="display:flex;justify-content:space-between;align-items:center;">
                <mat-card-title style="display:flex;align-items:center;gap:8px;color:#16a34a;">
                  <mat-icon>store</mat-icon>
                  Vendor Contacts &amp; Quotations ({{ request()!.vendor_contacts?.length || 0 }})
                </mat-card-title>
                <button mat-raised-button color="primary" class="btn-compact" (click)="openAddContactDialog()" style="background:linear-gradient(135deg, #10b981, #059669);">
                  <mat-icon>add</mat-icon> Add Vendor Contact
                </button>
              </mat-card-header>

              <mat-card-content style="padding:12px 0 0 0!important;">
                @if (request()!.vendor_contacts?.length) {
                  <div class="contacts-list">
                    @for (c of request()!.vendor_contacts; track c.id) {
                      <div class="contact-card">
                        <div class="contact-card-top">
                          <div>
                            <div class="vendor-title">{{ c.vendor_name }}</div>
                            @if (c.contact_person) {
                              <div class="contact-sub">
                                <mat-icon style="font-size:13px;width:13px;height:13px;">person</mat-icon>
                                {{ c.contact_person }}
                              </div>
                            }
                          </div>

                          <div style="text-align:right;">
                            @if (c.quoted_price !== null && c.quoted_price !== undefined) {
                              <div class="quoted-price">₹{{ c.quoted_price | number:'1.2-2' }}</div>
                              @if (c.gst_rate) { <div class="gst-tag">+{{ c.gst_rate }}% GST</div> }
                            } @else {
                              <div class="quoted-price unquoted">Awaiting Quote</div>
                            }
                          </div>
                        </div>

                        <div class="contact-details-grid">
                          @if (c.phone) {
                            <div class="c-detail">
                              <mat-icon>phone</mat-icon>
                              <a href="tel:{{ c.phone }}">{{ c.phone }}</a>
                            </div>
                          }
                          @if (c.email) {
                            <div class="c-detail">
                              <mat-icon>email</mat-icon>
                              <a href="mailto:{{ c.email }}">{{ c.email }}</a>
                            </div>
                          }
                          @if (c.lead_time_days) {
                            <div class="c-detail">
                              <mat-icon>local_shipping</mat-icon>
                              <span>Lead time: {{ c.lead_time_days }} days</span>
                            </div>
                          }
                          @if (c.payment_terms) {
                            <div class="c-detail">
                              <mat-icon>payments</mat-icon>
                              <span>Terms: {{ c.payment_terms }}</span>
                            </div>
                          }
                        </div>

                        @if (c.notes) {
                          <div class="contact-notes">
                            "{{ c.notes }}"
                          </div>
                        }

                        <div class="contact-footer">
                          <span style="font-size:11px;color:var(--text-3);">
                            Added by {{ c.creator?.name || 'Buyer' }} · {{ c.created_at | date:'dd MMM, HH:mm' }}
                          </span>
                          <div style="display:flex;gap:4px;">
                            <button mat-icon-button class="action-icon-btn" (click)="openEditContactDialog(c)" matTooltip="Edit Contact / Quote">
                              <mat-icon>edit</mat-icon>
                            </button>
                            <button mat-icon-button color="warn" class="action-icon-btn" (click)="deleteContact(c)" matTooltip="Remove Contact">
                              <mat-icon>delete_outline</mat-icon>
                            </button>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-contacts">
                    <mat-icon>contact_phone</mat-icon>
                    <p>No vendor contacts or quotes added yet.</p>
                    <button mat-stroked-button color="primary" (click)="openAddContactDialog()">
                      <mat-icon>person_add</mat-icon> Add First Vendor Contact
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
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
    .header-left { display:flex; align-items:center; gap:12px; }
    .back-btn { background:#f1f5f9; }
    .title-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    h2 { margin:0; font-size:22px; font-weight:800; }
    .subtitle { margin:4px 0 0; font-size:13px; color:var(--text-3); }
    .header-actions { display:flex; align-items:center; gap:10px; }
    .btn-compact { height:36px!important; font-size:12.5px!important; }

    .status-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:99px; font-size:11.5px; font-weight:700; }
    .status-open { background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; }
    .status-closed { background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; }
    .status-pill mat-icon { font-size:15px; width:15px; height:15px; }

    .source-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:700; }
    .source-badge.pr { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
    .source-badge.direct { background:#fdf4ff; color:#a855f7; border:1px solid #f5d0fe; }
    .source-badge mat-icon { font-size:14px; width:14px; height:14px; }

    .main-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start; }
    @media (max-width:1050px) { .main-grid { grid-template-columns:1fr; } }

    .detail-card { border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.03); }
    
    .permission-tag { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:4px; font-size:10.5px; font-weight:700; }
    .permission-tag.owner { background:#f0fdf4; color:#15803d; }
    .permission-tag.locked { background:#fef2f2; color:#991b1b; }
    .permission-tag.open-tag { background:#f0f9ff; color:#0369a1; }
    .permission-tag mat-icon { font-size:13px; width:13px; height:13px; }

    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .full-span { grid-column:1/-1; }
    .read-only-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .info-item { display:flex; flex-direction:column; gap:2px; font-size:13px; }
    .info-label { font-size:11px; color:var(--text-3); text-transform:uppercase; font-weight:600; }

    .new-remark-box { margin-bottom:12px; }
    .remarks-feed { display:flex; flex-direction:column; gap:10px; max-height:400px; overflow-y:auto; padding-right:4px; }
    .remark-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; }
    .remark-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
    .remark-author { font-size:12px; font-weight:700; color:#0369a1; display:flex; align-items:center; gap:4px; }
    .remark-time { font-size:11px; color:var(--text-3); }
    .remark-body { font-size:13px; color:var(--text-1); white-space:pre-wrap; }

    .contacts-list { display:flex; flex-direction:column; gap:12px; padding:0 16px 16px; }
    .contact-card { background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,0.02); }
    .contact-card-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
    .vendor-title { font-size:14.5px; font-weight:700; color:var(--text-1); }
    .contact-sub { font-size:12px; color:var(--text-2); display:flex; align-items:center; gap:4px; margin-top:2px; }
    .quoted-price { font-size:16px; font-weight:800; color:#15803d; }
    .quoted-price.unquoted { font-size:12px; font-weight:600; color:#94a3b8; }
    .gst-tag { font-size:10px; color:#15803d; font-weight:700; }
    
    .contact-details-grid { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color:var(--text-2); margin:8px 0; }
    .c-detail { display:flex; align-items:center; gap:4px; }
    .c-detail mat-icon { font-size:14px; width:14px; height:14px; color:#64748b; }
    .c-detail a { color:#0284c7; text-decoration:none; }
    .c-detail a:hover { text-decoration:underline; }

    .contact-notes { background:#f8fafc; border-left:3px solid #0284c7; padding:6px 10px; font-size:12px; color:#334155; font-style:italic; border-radius:0 4px 4px 0; margin-bottom:8px; }
    .contact-footer { display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:8px; margin-top:6px; }
    .action-icon-btn { width:28px!important; height:28px!important; line-height:28px!important; }
    .action-icon-btn mat-icon { font-size:16px; width:16px; height:16px; }
    .empty-contacts { display:flex; flex-direction:column; align-items:center; padding:40px 20px; color:#94a3b8; gap:8px; text-align:center; }
  `]
})
export class SourcingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  auth = inject(AuthService);

  loading = signal(true);
  request = signal<SourcingRequest | null>(null);
  categories = signal<Category[]>([]);

  savingCore = signal(false);
  updatingStatus = signal(false);
  postingRemark = signal(false);

  newRemarkText = '';

  editForm: FormGroup = this.fb.group({
    item_name: ['', Validators.required],
    specification: [''],
    category_id: [null],
    qty: [1, [Validators.required, Validators.min(0.001)]],
    unit: ['Nos'],
    target_price: [null],
    client_name: [''],
    delivery_location: [''],
    rfq_ref: [''],
  });

  canEditCore = computed(() => {
    const r = this.request();
    if (!r) return false;
    const u = this.auth.user();
    if (!u) return false;
    return r.created_by === u.id || this.auth.isSuperAdmin() || this.auth.isZopaStaff();
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
    this.http.get<SourcingRequest>(`${environment.apiUrl}/sourcing/${id}`).subscribe({
      next: res => {
        this.request.set(res);
        this.editForm.patchValue({
          item_name: res.item_name,
          specification: res.specification,
          category_id: res.category_id,
          qty: res.qty,
          unit: res.unit,
          target_price: res.target_price,
          client_name: res.client_name,
          delivery_location: res.delivery_location,
          rfq_ref: res.rfq_ref,
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
