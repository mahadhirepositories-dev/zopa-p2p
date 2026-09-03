import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';

export interface OnboardingResponse {
  id: number;
  invite_id: number;
  tenant_id: number;
  form_template_id: number;
  form_snapshot: any[];
  form_data: Record<string, any>;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_notes?: string;
  approved_by?: number;
  approved_at?: string;
  rejected_by?: number;
  rejected_at?: string;
  created_vendor_id?: number;
  created_at: string;
  updated_at: string;
  attachments_count?: number;
  template?: { id: number; name: string; vendor_type?: string };
  tenant?: { id: number; name: string };
  vendor?: { id: number; name: string; global_vendor_code: string };
  approved_by_user?: { id: number; name: string };
  rejected_by_user?: { id: number; name: string };
  invite?: { id: number; token: string; vendor_email: string; phone?: string; created_at: string };
  attachments?: Array<{
    id: number;
    field_key: string;
    document_type: string;
    original_name: string;
    file_name: string;
    size: number;
  }>;
}

export interface OnboardingInvite {
  id: number;
  tenant_id: number;
  form_template_id: number;
  token: string;
  vendor_name?: string;
  vendor_email: string;
  phone?: string;
  status: 'pending' | 'submitted' | 'expired';
  expires_at: string;
  submitted_at?: string;
  onboarding_url?: string;
  is_expired?: boolean;
  template?: { id: number; name: string };
  tenant?: { id: number; name: string };
  invited_by?: { id: number; name: string };
  created_at: string;
}

@Component({
  selector: 'app-vendor-onboarding-queue',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <div class="breadcrumbs">
            <span>Administration</span> / <span>Vendor Onboarding</span> / <span class="active">Onboarding Queue</span>
          </div>
          <h2>Vendor Onboarding Queue</h2>
          <p class="subtitle">Review external vendor submissions, inspect compliance attachments, and approve prospective vendors into P2P.</p>
        </div>

        <div class="header-actions">
          <button mat-flat-button color="primary" (click)="openInviteModal()">
            <mat-icon>mail</mat-icon> Invite Vendor
          </button>
        </div>
      </div>

      <!-- Top Navigation Tabs (Responses Queue vs Sent Invites) -->
      <div class="tab-bar">
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'responses'" (click)="setTab('responses')">
          <mat-icon>inbox</mat-icon> Vendor Submissions
          @if (pendingCount() > 0) {
            <span class="count-badge">{{ pendingCount() }}</span>
          }
        </button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'invites'" (click)="setTab('invites')">
          <mat-icon>send</mat-icon> Sent Invitations ({{ invites().length }})
        </button>
      </div>

      <!-- TAB 1: SUBMISSIONS QUEUE -->
      @if (activeTab() === 'responses') {
        <!-- Filter Bar -->
        <div class="filters-bar">
          <div class="filter-chips">
            <button class="filter-chip" [class.filter-chip--active]="statusFilter() === ''" (click)="setStatusFilter('')">
              All Submissions
            </button>
            <button class="filter-chip filter-chip--pending" [class.filter-chip--active]="statusFilter() === 'pending_review'" (click)="setStatusFilter('pending_review')">
              Pending Review
              @if (pendingCount() > 0) {
                <span class="chip-count">{{ pendingCount() }}</span>
              }
            </button>
            <button class="filter-chip filter-chip--approved" [class.filter-chip--active]="statusFilter() === 'approved'" (click)="setStatusFilter('approved')">
              Approved into P2P
            </button>
            <button class="filter-chip filter-chip--rejected" [class.filter-chip--active]="statusFilter() === 'rejected'" (click)="setStatusFilter('rejected')">
              Rejected
            </button>
          </div>

          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="loadResponses()" placeholder="Search by name, email, PAN, GSTIN..." />
          </div>
        </div>

        <!-- Responses Table -->
        @if (loadingResponses()) {
          <div class="loading-state">
            <mat-spinner diameter="36" />
            <span>Loading submissions...</span>
          </div>
        } @else if (responses().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">check_circle_outline</mat-icon>
            <h3>No Submissions Found</h3>
            <p>There are no vendor onboarding submissions matching your current filters.</p>
          </div>
        } @else {
          <div class="table-card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Submission Date</th>
                  <th>Vendor / Legal Name</th>
                  <th>Contact Information</th>
                  <th>Form Template</th>
                  <th>Org / Tenant</th>
                  <th>Status</th>
                  <th>P2P Vendor Code</th>
                  <th class="actions-col">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of responses(); track r.id) {
                  <tr>
                    <td>
                      <div class="date-cell">
                        <span class="date-main">{{ r.created_at | date:'dd MMM yyyy' }}</span>
                        <span class="date-sub">{{ r.created_at | date:'hh:mm a' }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="vendor-cell">
                        <span class="vendor-name">{{ r.form_data['name'] || r.invite?.vendor_email }}</span>
                        @if (r.form_data['pan']) {
                          <span class="vendor-pan">PAN: {{ r.form_data['pan'] }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div class="contact-cell">
                        <span class="contact-email">{{ r.form_data['email'] || r.invite?.vendor_email }}</span>
                        @if (r.form_data['phone']) {
                          <span class="contact-phone">{{ r.form_data['phone'] }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="template-badge">{{ r.template?.name || 'Onboarding Form' }}</span>
                    </td>
                    <td>
                      <span class="tenant-name">{{ r.tenant?.name || '—' }}</span>
                    </td>
                    <td>
                      <span class="status-badge status-badge--{{ r.status }}">
                        {{ formatStatus(r.status) }}
                      </span>
                    </td>
                    <td>
                      @if (r.status === 'approved' && r.vendor?.global_vendor_code) {
                        <a [routerLink]="['/vendors', r.created_vendor_id]" class="vendor-code-link">
                          <mat-icon>verified</mat-icon> {{ r.vendor?.global_vendor_code }}
                        </a>
                      } @else {
                        <span class="muted-dash">—</span>
                      }
                    </td>
                    <td class="actions-col">
                      <button mat-stroked-button color="primary" class="review-btn" (click)="openReviewModal(r)">
                        <mat-icon>rate_review</mat-icon> Review
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- TAB 2: SENT INVITATIONS -->
      @if (activeTab() === 'invites') {
        @if (loadingInvites()) {
          <div class="loading-state">
            <mat-spinner diameter="36" />
            <span>Loading invitations...</span>
          </div>
        } @else if (invites().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">mail_outline</mat-icon>
            <h3>No Invitations Sent Yet</h3>
            <p>Send onboarding invitations with single-use registration links to your vendors.</p>
            <button mat-stroked-button color="primary" (click)="openInviteModal()">
              <mat-icon>mail</mat-icon> Send First Invite
            </button>
          </div>
        } @else {
          <div class="table-card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invited On</th>
                  <th>Vendor Name / Contact</th>
                  <th>Form Template</th>
                  <th>Client Organization</th>
                  <th>Single-Use Link Status</th>
                  <th>Expires On</th>
                  <th class="actions-col">Link & Action</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of invites(); track inv.id) {
                  <tr>
                    <td>{{ inv.created_at | date:'dd MMM yyyy, hh:mm a' }}</td>
                    <td>
                      <div class="vendor-cell">
                        <span class="vendor-name">{{ inv.vendor_name || 'Prospective Vendor' }}</span>
                        <span class="contact-email">{{ inv.vendor_email }}</span>
                      </div>
                    </td>
                    <td><span class="template-badge">{{ inv.template?.name }}</span></td>
                    <td>{{ inv.tenant?.name }}</td>
                    <td>
                      <span class="status-badge status-badge--{{ inv.status }}">
                        {{ inv.status === 'submitted' ? 'Used / Submitted' : (inv.is_expired ? 'Expired' : 'Active (Unused)') }}
                      </span>
                    </td>
                    <td>{{ inv.expires_at | date:'dd MMM yyyy, hh:mm a' }}</td>
                    <td class="actions-col">
                      <button mat-button class="sm-btn" (click)="copyLink(inv.onboarding_url)" matTooltip="Copy link to clipboard">
                        <mat-icon>content_copy</mat-icon> Copy Link
                      </button>
                      @if (inv.status !== 'submitted') {
                        <button mat-button color="accent" class="sm-btn" (click)="resendInvite(inv)" matTooltip="Resend email">
                          <mat-icon>refresh</mat-icon> Resend
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- Invite Vendor Modal -->
      @if (inviteModalOpen()) {
        <div class="modal-backdrop">
          <div class="modal-dialog modal-dialog--sm">
            <div class="modal-header">
              <h3>Invite Vendor for Onboarding</h3>
              <button mat-icon-button (click)="inviteModalOpen.set(false)"><mat-icon>close</mat-icon></button>
            </div>
            <div class="modal-content">
              <p class="dialog-hint">
                Generate a unique, cryptographically secure <strong>single-use registration link</strong> and send it directly to the vendor via email.
              </p>

              <div class="form-group">
                <label>Target Client Organization <span class="req">*</span></label>
                <select class="custom-input" [(ngModel)]="inviteForm.tenant_id">
                  @for (t of tenants(); track t.id) {
                    <option [value]="t.id">{{ t.name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Select Form Template <span class="req">*</span></label>
                <select class="custom-input" [(ngModel)]="inviteForm.form_template_id">
                  @for (tpl of availableTemplates(); track tpl.id) {
                    <option [value]="tpl.id">{{ tpl.name }} ({{ tpl.schema_definition?.length || 0 }} fields)</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Vendor Contact Email <span class="req">*</span></label>
                <input type="email" class="custom-input" [(ngModel)]="inviteForm.vendor_email" placeholder="vendor@example.com" />
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label>Vendor / Company Name</label>
                  <input type="text" class="custom-input" [(ngModel)]="inviteForm.vendor_name" placeholder="e.g. Acme Supplies" />
                </div>
                <div class="form-group flex-1">
                  <label>Contact Phone</label>
                  <input type="tel" class="custom-input" [(ngModel)]="inviteForm.phone" placeholder="+91 9876543210" />
                </div>
              </div>

              <div class="form-group">
                <label>Link Expiry (Days)</label>
                <select class="custom-input" [(ngModel)]="inviteForm.expiry_days">
                  <option [value]="3">3 Days</option>
                  <option [value]="7">7 Days (Default)</option>
                  <option [value]="14">14 Days</option>
                  <option [value]="30">30 Days</option>
                </select>
              </div>
            </div>

            <div class="modal-footer">
              <button mat-stroked-button (click)="inviteModalOpen.set(false)">Cancel</button>
              <button mat-flat-button color="primary" (click)="sendInvite()" [disabled]="sendingInvite()">
                @if (sendingInvite()) {
                  <mat-spinner diameter="18" />
                } @else {
                  <mat-icon>send</mat-icon> Send Invitation
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Review & Approve Modal -->
      @if (reviewModalOpen()) {
        <div class="modal-backdrop">
          <div class="modal-dialog modal-dialog--lg">
            <div class="modal-header">
              <div>
                <div class="status-badge-wrap">
                  <span class="status-badge status-badge--{{ currentReview?.status }}">
                    {{ formatStatus(currentReview?.status) }}
                  </span>
                </div>
                <h3>Review Vendor Submission</h3>
                <p>{{ currentReview?.form_data?.['name'] || 'Prospective Vendor' }} &bull; Submitted on {{ currentReview?.created_at | date:'dd MMM yyyy, hh:mm a' }}</p>
              </div>
              <button mat-icon-button (click)="reviewModalOpen.set(false)"><mat-icon>close</mat-icon></button>
            </div>

            <div class="modal-content">
              <!-- Submitted Particulars Section -->
              <div class="section-box">
                <h4 class="section-title">Submitted Details</h4>
                <div class="details-grid">
                  @for (field of currentReview?.form_snapshot; track field.id) {
                    <div class="detail-item" [class.full-width]="field.type === 'textarea'">
                      <span class="detail-label">{{ field.label }}</span>
                      <span class="detail-val">
                        @if (field.type === 'file') {
                          <span class="attached-file-indicator">
                            <mat-icon>attach_file</mat-icon> {{ currentReview?.form_data?.[field.field_key] || 'Not attached' }}
                          </span>
                        } @else if (isArrayVal(currentReview?.form_data?.[field.field_key])) {
                          <div class="val-chips-wrap">
                            @for (item of asArray(currentReview?.form_data?.[field.field_key]); track item) {
                              <span class="val-chip">{{ item }}</span>
                            }
                          </div>
                        } @else {
                          {{ currentReview?.form_data?.[field.field_key] || '—' }}
                        }
                      </span>
                    </div>
                  }
                </div>
              </div>

              <!-- Attached Compliance Documents -->
              <div class="section-box">
                <h4 class="section-title">Attached Verification Documents ({{ currentReview?.attachments?.length || 0 }})</h4>
                @if (!currentReview?.attachments?.length) {
                  <p class="muted-text">No files were attached with this submission.</p>
                } @else {
                  <div class="attachments-grid">
                    @for (att of currentReview?.attachments; track att.id) {
                      <div class="attachment-card">
                        <div class="att-icon-wrap">
                          <mat-icon>description</mat-icon>
                        </div>
                        <div class="att-meta">
                          <span class="att-name">{{ att.original_name }}</span>
                          <span class="att-type">{{ att.document_type | uppercase }} &bull; {{ formatSize(att.size) }}</span>
                        </div>
                        <a class="att-dl-btn" [href]="getDownloadUrl(att.id)" target="_blank" matTooltip="Download document">
                          <mat-icon>download</mat-icon>
                        </a>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Promotion Fields (Only active if pending) -->
              @if (currentReview?.status === 'pending_review') {
                <div class="section-box section-box--approval">
                  <h4 class="section-title">Promote to Live P2P Master Catalog</h4>
                  <p class="approval-hint">
                    Approving this vendor automatically generates a sequential vendor code (<code>ZP-YYMM-XX</code>), creates the vendor in the live P2P directory, stores default addresses, and archives compliance documents.
                  </p>

                  <div class="form-row">
                    <div class="form-group flex-2">
                      <label>Confirmed Legal Name</label>
                      <input type="text" class="custom-input" [(ngModel)]="approvalOverride.name" />
                    </div>
                    <div class="form-group flex-1">
                      <label>PAN Number</label>
                      <input type="text" class="custom-input" [(ngModel)]="approvalOverride.pan" />
                    </div>
                    <div class="form-group flex-1">
                      <label>GSTIN</label>
                      <input type="text" class="custom-input" [(ngModel)]="approvalOverride.gstin" />
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group flex-1">
                      <label>Bank Account Number</label>
                      <input type="text" class="custom-input" [(ngModel)]="approvalOverride.account_no" />
                    </div>
                    <div class="form-group flex-1">
                      <label>Bank IFSC</label>
                      <input type="text" class="custom-input" [(ngModel)]="approvalOverride.ifsc" />
                    </div>
                    <div class="form-group flex-1">
                      <label>Bank Name</label>
                      <input type="text" class="custom-input" [(ngModel)]="approvalOverride.bank_name" />
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Internal Reviewer Notes / Remarks</label>
                    <input type="text" class="custom-input" [(ngModel)]="approvalOverride.notes" placeholder="e.g. Verified against GST portal. Approved for procurement." />
                  </div>
                </div>
              } @else if (currentReview?.status === 'approved') {
                <div class="approved-banner">
                  <mat-icon>verified</mat-icon>
                  <div>
                    <h4>Approved into P2P Directory</h4>
                    <p>Vendor Code: <strong>{{ currentReview?.vendor?.global_vendor_code }}</strong> &bull; Approved by {{ currentReview?.approved_by_user?.name || 'Administrator' }} on {{ currentReview?.approved_at | date:'dd MMM yyyy' }}</p>
                  </div>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button mat-stroked-button (click)="reviewModalOpen.set(false)">Close</button>
              @if (currentReview?.status === 'pending_review') {
                <button mat-button color="warn" (click)="rejectCurrent()" [disabled]="processingDecision()">
                  <mat-icon>cancel</mat-icon> Reject
                </button>
                <button mat-flat-button color="primary" (click)="approveCurrent()" [disabled]="processingDecision()">
                  @if (processingDecision()) {
                    <mat-spinner diameter="18" />
                  } @else {
                    <mat-icon>check_circle</mat-icon> Approve & Add to Vendor Pool
                  }
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px 32px;
      max-width: 1440px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .breadcrumbs {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .breadcrumbs .active {
      color: #ea580c;
      font-weight: 600;
    }

    .page-header h2 {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px;
    }

    .subtitle {
      font-size: 13.5px;
      color: #64748b;
      margin: 0;
    }

    .tab-bar {
      display: flex;
      gap: 12px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 20px;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 18px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-btn:hover {
      color: #0f172a;
    }
    .tab-btn--active {
      color: #ea580c;
      border-bottom-color: #ea580c;
    }

    .count-badge {
      background: #ea580c;
      color: #ffffff;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 99px;
      font-weight: 700;
    }

    .filters-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 16px;
      flex-wrap: wrap;
    }

    .filter-chips {
      display: flex;
      gap: 8px;
    }

    .filter-chip {
      padding: 7px 14px;
      border-radius: 99px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      font-size: 12.5px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .filter-chip:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .filter-chip--active {
      background: #0f172a !important;
      color: #ffffff !important;
      border-color: #0f172a !important;
    }
    .filter-chip--pending.filter-chip--active {
      background: #ea580c !important;
      border-color: #ea580c !important;
    }

    .chip-count {
      background: #fee2e2;
      color: #b91c1c;
      padding: 1px 6px;
      border-radius: 99px;
      font-size: 10.5px;
    }
    .filter-chip--active .chip-count {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      gap: 8px;
      width: 320px;
    }
    .search-box mat-icon {
      color: #94a3b8;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .search-box input {
      border: none;
      outline: none;
      font-size: 13px;
      width: 100%;
    }

    .table-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    .data-table th {
      background: #f8fafc;
      padding: 12px 16px;
      font-weight: 700;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }
    .data-table tr:hover td {
      background: #f8fafc;
    }

    .date-cell {
      display: flex;
      flex-direction: column;
    }
    .date-main { font-weight: 600; color: #0f172a; }
    .date-sub { font-size: 11px; color: #94a3b8; }

    .vendor-cell {
      display: flex;
      flex-direction: column;
    }
    .vendor-name { font-weight: 700; color: #0f172a; }
    .vendor-pan { font-size: 11px; color: #64748b; font-family: monospace; }

    .contact-cell {
      display: flex;
      flex-direction: column;
    }
    .contact-email { font-weight: 500; color: #2563eb; }
    .contact-phone { font-size: 11.5px; color: #64748b; }

    .template-badge {
      font-size: 11.5px;
      font-weight: 600;
      background: #f1f5f9;
      color: #334155;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 99px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .status-badge--pending_review, .status-badge--pending {
      background: #fef3c7;
      color: #b45309;
    }
    .status-badge--approved, .status-badge--submitted {
      background: #dcfce7;
      color: #15803d;
    }
    .status-badge--rejected, .status-badge--expired {
      background: #fee2e2;
      color: #b91c1c;
    }

    .vendor-code-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 700;
      color: #16a34a;
      text-decoration: none;
    }
    .vendor-code-link:hover {
      text-decoration: underline;
    }
    .vendor-code-link mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .actions-col {
      text-align: right;
      white-space: nowrap;
    }

    .review-btn {
      font-size: 12px !important;
      height: 32px !important;
      line-height: 30px !important;
    }

    .sm-btn {
      font-size: 11.5px !important;
      padding: 0 8px !important;
    }
    .sm-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      gap: 14px;
      color: #64748b;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #cbd5e1;
    }

    /* Modal Styling */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 14px;
      width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .modal-dialog--sm { max-width: 480px; }
    .modal-dialog--lg { max-width: 860px; }

    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
    .modal-header p { margin: 4px 0 0; font-size: 12.5px; color: #64748b; }

    .modal-content {
      padding: 20px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .modal-footer {
      padding: 14px 24px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .section-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }
    .section-box--approval {
      background: #fdf2f8;
      border-color: #fbcfe8;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 12px;
    }
    .approval-hint {
      font-size: 12px;
      color: #64748b;
      margin: -6px 0 14px;
      line-height: 1.4;
    }

    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .detail-item.full-width {
      grid-column: 1 / -1;
    }

    .detail-label {
      display: block;
      font-size: 11.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }
    .detail-val {
      font-size: 13.5px;
      font-weight: 600;
      color: #0f172a;
    }

    .val-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .val-chip {
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid #dbeafe;
    }

    .attachments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
    }

    .attachment-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .att-icon-wrap mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #ea580c;
    }
    .att-meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .att-name {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .att-type {
      font-size: 10.5px;
      color: #64748b;
    }
    .att-dl-btn {
      color: #2563eb;
    }

    .approved-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      padding: 16px;
    }
    .approved-banner mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #10b981;
    }
    .approved-banner h4 {
      margin: 0 0 4px;
      color: #065f46;
      font-size: 15px;
      font-weight: 700;
    }
    .approved-banner p {
      margin: 0;
      font-size: 12.5px;
      color: #047857;
    }

    .form-row {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .form-group label {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
    }
    .req { color: #dc2626; }

    .custom-input {
      padding: 9px 12px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      outline: none;
      background: #ffffff;
      color: #0f172a;
    }
    .custom-input:focus {
      border-color: #ea580c;
    }

    .dialog-hint {
      font-size: 12.5px;
      color: #64748b;
      margin: 0 0 14px;
      line-height: 1.5;
    }
  `]
})
export class VendorOnboardingQueueComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  activeTab = signal<'responses' | 'invites'>('responses');
  statusFilter = signal<string>('pending_review');
  searchQuery: string = '';

  responses = signal<OnboardingResponse[]>([]);
  invites = signal<OnboardingInvite[]>([]);
  tenants = signal<any[]>([]);
  availableTemplates = signal<any[]>([]);

  loadingResponses = signal(true);
  loadingInvites = signal(false);

  // Invite Modal
  inviteModalOpen = signal(false);
  sendingInvite = signal(false);
  inviteForm: {
    tenant_id: number | null;
    form_template_id: number | null;
    vendor_email: string;
    vendor_name: string;
    phone: string;
    expiry_days: number;
  } = {
    tenant_id: null,
    form_template_id: null,
    vendor_email: '',
    vendor_name: '',
    phone: '',
    expiry_days: 7,
  };

  // Review Modal
  reviewModalOpen = signal(false);
  currentReview: OnboardingResponse | null = null;
  processingDecision = signal(false);
  approvalOverride = {
    name: '',
    pan: '',
    gstin: '',
    account_no: '',
    ifsc: '',
    bank_name: '',
    notes: 'Approved and promoted to live P2P vendor catalog.'
  };

  pendingCount = signal(0);

  ngOnInit() {
    this.loadResponses();
    this.loadInvites();
    this.loadMeta();
  }

  setTab(tab: 'responses' | 'invites') {
    this.activeTab.set(tab);
    if (tab === 'invites' && this.invites().length === 0) {
      this.loadInvites();
    }
  }

  setStatusFilter(status: string) {
    this.statusFilter.set(status);
    this.loadResponses();
  }

  loadResponses() {
    this.loadingResponses.set(true);
    let url = `${environment.apiUrl}/admin/vendor-onboarding/responses?per_page=50`;
    if (this.statusFilter()) {
      url += `&status=${this.statusFilter()}`;
    }
    if (this.searchQuery.trim()) {
      url += `&search=${encodeURIComponent(this.searchQuery.trim())}`;
    }

    this.http.get<any>(url).subscribe({
      next: (res) => {
        const items = res.data || res || [];
        this.responses.set(items);
        this.loadingResponses.set(false);
        this.calculatePendingCount(items);
      },
      error: () => {
        this.notify.error('Failed to load onboarding submissions.');
        this.loadingResponses.set(false);
      }
    });
  }

  calculatePendingCount(items: OnboardingResponse[]) {
    // If filtered, fetch full pending count separately
    this.http.get<any>(`${environment.apiUrl}/admin/vendor-onboarding/responses?status=pending_review&per_page=1`).subscribe({
      next: (res) => {
        this.pendingCount.set(res.total ?? (items.filter(i => i.status === 'pending_review').length));
      }
    });
  }

  loadInvites() {
    this.loadingInvites.set(true);
    this.http.get<any>(`${environment.apiUrl}/admin/vendor-onboarding/invites?per_page=50`).subscribe({
      next: (res) => {
        this.invites.set(res.data || res || []);
        this.loadingInvites.set(false);
      },
      error: () => {
        this.notify.error('Failed to load sent invitations.');
        this.loadingInvites.set(false);
      }
    });
  }

  loadMeta() {
    this.http.get<any[]>(`${environment.apiUrl}/admin/vendor-forms`).subscribe({
      next: (res) => this.availableTemplates.set(res || [])
    });

    this.http.get<any[]>(`${environment.apiUrl}/admin/clients`).subscribe({
      next: (res) => {
        this.tenants.set(res || []);
        if (res && res.length > 0) {
          this.inviteForm.tenant_id = res[0].id;
        }
      }
    });
  }

  openInviteModal() {
    if (this.availableTemplates().length > 0 && !this.inviteForm.form_template_id) {
      this.inviteForm.form_template_id = this.availableTemplates()[0].id;
    }
    this.inviteModalOpen.set(true);
  }

  sendInvite() {
    if (!this.inviteForm.vendor_email || !this.inviteForm.vendor_email.trim()) {
      this.notify.warning('Vendor email is required.');
      return;
    }
    if (!this.inviteForm.form_template_id) {
      this.notify.warning('Please select a form template.');
      return;
    }

    this.sendingInvite.set(true);
    this.http.post(`${environment.apiUrl}/admin/vendor-onboarding/invites`, this.inviteForm).subscribe({
      next: (res: any) => {
        this.notify.success(`Invitation email sent to ${this.inviteForm.vendor_email}!`);
        this.sendingInvite.set(false);
        this.inviteModalOpen.set(false);
        this.inviteForm.vendor_email = '';
        this.inviteForm.vendor_name = '';
        this.inviteForm.phone = '';
        this.loadInvites();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Failed to send invitation.');
        this.sendingInvite.set(false);
      }
    });
  }

  resendInvite(inv: OnboardingInvite) {
    this.http.post(`${environment.apiUrl}/admin/vendor-onboarding/invites/${inv.id}/resend`, {}).subscribe({
      next: () => this.notify.success('Invitation resent successfully!'),
      error: () => this.notify.error('Failed to resend invitation.')
    });
  }

  copyLink(url?: string) {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.notify.info('Single-use link copied to clipboard!');
    });
  }

  openReviewModal(resp: OnboardingResponse) {
    this.currentReview = resp;
    const d = resp.form_data || {};
    this.approvalOverride = {
      name: d['name'] || resp.invite?.vendor_email || '',
      pan: d['pan'] || '',
      gstin: d['gstin'] || '',
      account_no: d['account_no'] || '',
      ifsc: d['ifsc'] || '',
      bank_name: d['bank_name'] || '',
      notes: 'Approved and promoted to live P2P vendor catalog.'
    };

    // Load full details with attachments
    this.http.get<OnboardingResponse>(`${environment.apiUrl}/admin/vendor-onboarding/responses/${resp.id}`).subscribe({
      next: (full) => {
        this.currentReview = full;
      }
    });

    this.reviewModalOpen.set(true);
  }

  approveCurrent() {
    if (!this.currentReview) return;
    if (!this.approvalOverride.name.trim()) {
      this.notify.warning('Vendor legal name is required.');
      return;
    }

    this.processingDecision.set(true);
    const payload = {
      name: this.approvalOverride.name.trim(),
      pan: this.approvalOverride.pan.trim(),
      gstin: this.approvalOverride.gstin.trim(),
      account_no: this.approvalOverride.account_no.trim(),
      ifsc: this.approvalOverride.ifsc.trim(),
      bank_name: this.approvalOverride.bank_name.trim(),
      notes: this.approvalOverride.notes,
    };

    this.http.post<any>(`${environment.apiUrl}/admin/vendor-onboarding/responses/${this.currentReview.id}/approve`, payload).subscribe({
      next: (res) => {
        this.notify.success(res.message || 'Vendor approved and added to P2P!');
        this.processingDecision.set(false);
        this.reviewModalOpen.set(false);
        this.loadResponses();
      },
      error: (err) => {
        this.notify.error(err.error?.error || err.error?.message || 'Failed to approve vendor.');
        this.processingDecision.set(false);
      }
    });
  }

  rejectCurrent() {
    if (!this.currentReview) return;
    const reason = prompt('Please enter rejection notes / reason for the vendor:', 'Incomplete documentation / Verification failed.');
    if (reason === null) return;

    this.processingDecision.set(true);
    this.http.post(`${environment.apiUrl}/admin/vendor-onboarding/responses/${this.currentReview.id}/reject`, { notes: reason }).subscribe({
      next: () => {
        this.notify.success('Vendor submission marked as rejected.');
        this.processingDecision.set(false);
        this.reviewModalOpen.set(false);
        this.loadResponses();
      },
      error: () => {
        this.notify.error('Failed to reject submission.');
        this.processingDecision.set(false);
      }
    });
  }

  getDownloadUrl(attachmentId: number): string {
    return `${environment.apiUrl}/admin/vendor-onboarding/responses/${this.currentReview?.id}/attachments/${attachmentId}`;
  }

  formatStatus(status?: string): string {
    switch (status) {
      case 'pending_review': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'submitted': return 'Submitted';
      case 'pending': return 'Pending';
      default: return status || '—';
    }
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  isArrayVal(val: any): boolean {
    return Array.isArray(val) || (typeof val === 'string' && val.startsWith('['));
  }

  asArray(val: any): any[] {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val); } catch { return [val]; }
    }
    return [val];
  }
}
