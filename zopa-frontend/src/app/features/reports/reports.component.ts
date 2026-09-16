import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe, DatePipe, NgTemplateOutlet, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, DecimalPipe, DatePipe, NgTemplateOutlet, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCardModule, MatProgressSpinnerModule,
    MatDatepickerModule, MatNativeDateModule, MatTableModule, MatChipsModule,
    MatTabsModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      
      <!-- Top Page Header -->
      <div class="page-header">
        <div>
          <h2>Procurement Reports &amp; Operational Reviews</h2>
          <p>Generate McKinsey-style executive operational reports, review pipeline TAT, and brief client approvers.</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          @if (activeTab === 0 && !editingReport()) {
            <button mat-raised-button color="primary" (click)="startNewReport()" [disabled]="startingReport()">
              @if (startingReport()) {
                <mat-spinner diameter="16" style="margin-right:6px;display:inline-block;" />
              } @else {
                <mat-icon>add_chart</mat-icon>
              }
              Start Operational Report
            </button>
          } @else if (editingReport()) {
            <button mat-stroked-button (click)="closeEditor()">
              <mat-icon>arrow_back</mat-icon> Back to Reports List
            </button>
            <button mat-stroked-button color="primary" (click)="saveReportDraft()" [disabled]="savingReport()">
              @if (savingReport()) {
                <mat-spinner diameter="16" style="margin-right:6px;display:inline-block;" />
              } @else {
                <mat-icon>save</mat-icon>
              }
              Save Draft
            </button>
            <button mat-stroked-button (click)="previewPdf(editingReport())" [disabled]="previewingPdf()">
              @if (previewingPdf()) {
                <mat-spinner diameter="16" style="margin-right:6px;display:inline-block;" />
              } @else {
                <mat-icon>picture_as_pdf</mat-icon>
              }
              Preview PDF
            </button>
            <button mat-raised-button color="primary" (click)="openSendModal(editingReport())">
              <mat-icon>send</mat-icon> Send to Client
            </button>
          }
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="report-nav-tabs">
        <button class="nav-tab-btn" [class.active]="activeTab === 0 && !editingReport()" (click)="switchTab(0)">
          <mat-icon>assignment</mat-icon> Operational Reports
        </button>
        @if (editingReport()) {
          <button class="nav-tab-btn active" (click)="activeTab = 1">
            <mat-icon>edit_note</mat-icon> Editing: {{ editingReport().title || 'Draft Report' }}
          </button>
        }
        <button class="nav-tab-btn" [class.active]="activeTab === 2" (click)="switchTab(2)">
          <mat-icon>analytics</mat-icon> Turnaround Time (TAT) Analytics
        </button>
      </div>

      <!-- TAB 0: OPERATIONAL REPORTS LIST -->
      @if (activeTab === 0 && !editingReport()) {
        <mat-card class="table-card" style="margin-top:16px;">
          <mat-card-content style="padding:0 !important;">
            @if (loadingOpReports()) {
              <div style="display:flex;justify-content:center;padding:60px;">
                <mat-spinner diameter="36" />
              </div>
            } @else if (opReports().length === 0) {
              <div class="empty-state">
                <mat-icon>assessment</mat-icon>
                <h3>No operational reports yet</h3>
                <p>Click "Start Operational Report" to auto-fetch live PRs, approvals, and deliveries and create your first executive review.</p>
                <button mat-raised-button color="primary" style="margin-top:12px;" (click)="startNewReport()">
                  <mat-icon>add_chart</mat-icon> Start First Operational Report
                </button>
              </div>
            } @else {
              <div style="overflow-x:auto;">
                <table class="custom-table full-width">
                  <thead>
                    <tr>
                      <th>Report Title</th>
                      <th>Reporting Period</th>
                      <th>Status</th>
                      <th>Created By</th>
                      <th>Sent Details</th>
                      <th style="text-align:right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of opReports(); track r.id) {
                      <tr>
                        <td>
                          <strong>{{ r.title }}</strong>
                          <div style="font-size:11px;color:var(--text-3);">
                            {{ r.metrics_data?.total_open_prs || 0 }} Open PRs &bull;
                            {{ r.metrics_data?.pending_deliveries || 0 }} Deliveries
                          </div>
                        </td>
                        <td>
                          {{ (r.period_start | date:'dd MMM yyyy') || '—' }} to {{ (r.period_end | date:'dd MMM yyyy') || '—' }}
                        </td>
                        <td>
                          @if (r.status === 'sent') {
                            <span class="pill-badge pill-success">Sent to Client</span>
                          } @else if (r.status === 'generated') {
                            <span class="pill-badge pill-info">Generated</span>
                          } @else {
                            <span class="pill-badge pill-warn">Draft Review</span>
                          }
                        </td>
                        <td>
                          <div>{{ r.creator?.name || 'Buyer' }}</div>
                          <div style="font-size:11px;color:var(--text-3);">{{ r.creator?.email }}</div>
                        </td>
                        <td>
                          @if (r.sent_at) {
                            <div>To: <strong>{{ r.client_approver_email }}</strong></div>
                            <div style="font-size:11px;color:var(--text-3);">{{ r.sent_at | date:'dd MMM yyyy, HH:mm' }}</div>
                          } @else {
                            <span style="color:var(--text-3);">Not yet sent</span>
                          }
                        </td>
                        <td style="text-align:right;">
                          <div style="display:inline-flex;gap:6px;">
                            <button mat-stroked-button (click)="openEditor(r)" matTooltip="Review and edit remarks/statuses">
                              <mat-icon>edit</mat-icon> Review / Edit
                            </button>
                            <button mat-icon-button (click)="previewPdf(r)" matTooltip="Preview McKinsey PDF">
                              <mat-icon>picture_as_pdf</mat-icon>
                            </button>
                            <button mat-icon-button color="primary" (click)="openSendModal(r)" matTooltip="Send to client approver">
                              <mat-icon>send</mat-icon>
                            </button>
                            @if (r.status === 'draft') {
                              <button mat-icon-button color="warn" (click)="deleteReport(r)" matTooltip="Delete draft">
                                <mat-icon>delete</mat-icon>
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }

      <!-- TAB 1: OPERATIONAL REPORT INTERACTIVE EDITOR -->
      @if (editingReport()) {
        <div class="editor-container" style="margin-top:16px;">
          
          <!-- Editor Title Card -->
          <mat-card class="editor-header-card">
            <div class="editor-header-content">
              <div style="flex:1;">
                <mat-form-field appearance="outline" class="full-width" style="margin-bottom:-1.25em;">
                  <mat-label>Report Title</mat-label>
                  <input matInput [(ngModel)]="editingReport().title" placeholder="e.g. Weekly Operational Report - Apollo Vidhyalayam">
                </mat-form-field>
              </div>
              <div class="header-meta">
                <span class="pill-badge pill-info">Period: {{ (editingReport().period_start | date:'dd MMM yyyy') || '—' }} to {{ (editingReport().period_end | date:'dd MMM yyyy') || '—' }}</span>
                <span class="pill-badge" [ngClass]="editingReport().status === 'sent' ? 'pill-success' : 'pill-warn'">
                  {{ editingReport().status === 'sent' ? 'Sent' : 'Draft' }}
                </span>
              </div>
            </div>
          </mat-card>

          <!-- Executive Scorecard (6 KPIs) -->
          <div class="kpi-grid">
            <div class="kpi-card-mckinsey success">
              <div class="kpi-tag">PRs Closed</div>
              <div class="kpi-val">{{ editingReport().metrics_data?.prs_closed || 0 }}</div>
              <div class="kpi-hint">Converted in period</div>
            </div>
            <div class="kpi-card-mckinsey">
              <div class="kpi-tag">Average PR TAT</div>
              <div class="kpi-val">{{ editingReport().metrics_data?.avg_pr_tat_days || 0 }}<span class="kpi-unit">d</span></div>
              <div class="kpi-hint">Submission &rarr; PO Draft</div>
            </div>
            <div class="kpi-card-mckinsey">
              <div class="kpi-tag">POs Issued</div>
              <div class="kpi-val">{{ editingReport().metrics_data?.pos_issued || 0 }}</div>
              <div class="kpi-hint">₹{{ (editingReport().metrics_data?.pos_issued_value || 0) | number:'1.0-0' }}</div>
            </div>
            <div class="kpi-card-mckinsey">
              <div class="kpi-tag">Total Open PRs</div>
              <div class="kpi-val">{{ editingReport().metrics_data?.total_open_prs || 0 }}</div>
              <div class="kpi-hint">Active in pipeline</div>
            </div>
            <div class="kpi-card-mckinsey" [class.danger]="(editingReport().metrics_data?.prs_tat_gt_10 || 0) > 0">
              <div class="kpi-tag">PRs TAT &gt; 10 Days</div>
              <div class="kpi-val">{{ editingReport().metrics_data?.prs_tat_gt_10 || 0 }}</div>
              <div class="kpi-hint">{{ (editingReport().metrics_data?.prs_tat_gt_10 || 0) > 0 ? 'Requires attention' : 'Target achieved' }}</div>
            </div>
            <div class="kpi-card-mckinsey" [class.warn]="(editingReport().metrics_data?.pending_deliveries || 0) > 5">
              <div class="kpi-tag">Pending Deliveries</div>
              <div class="kpi-val">{{ editingReport().metrics_data?.pending_deliveries || 0 }}</div>
              <div class="kpi-hint">Awaiting vendor GRN</div>
            </div>
          </div>

          <!-- McKinsey Visual Charts Card -->
          <div class="charts-grid" style="margin-top:16px;">
            <div class="mckinsey-chart-box">
              <div class="chart-box-title">
                <mat-icon>query_builder</mat-icon> Open PR Turnaround Time (TAT) Aging Distribution
              </div>
              <div class="chart-body">
                @for (item of getTatDistEntries(); track item.label) {
                  <div class="chart-bar-line">
                    <span class="bar-name">{{ item.label }}</span>
                    <div class="bar-bg">
                      <div class="bar-progress" [style.width.%]="item.pct"
                           [ngClass]="item.label.includes('> 10') ? 'bg-danger' : (item.label.includes('8 - 10') ? 'bg-warn' : 'bg-primary')">
                      </div>
                    </div>
                    <span class="bar-count">{{ item.count }} PRs</span>
                  </div>
                }
              </div>
            </div>

            <div class="mckinsey-chart-box">
              <div class="chart-box-title">
                <mat-icon>local_shipping</mat-icon> Delivery Fulfillment &amp; Logistics Risk Profile
              </div>
              <div class="chart-body">
                @for (item of getDeliveryRiskEntries(); track item.label) {
                  <div class="chart-bar-line">
                    <span class="bar-name">{{ item.label }}</span>
                    <div class="bar-bg">
                      <div class="bar-progress" [style.width.%]="item.pct"
                           [ngClass]="item.label.includes('Delayed') ? 'bg-danger' : (item.label.includes('Moderate') ? 'bg-warn' : 'bg-success')">
                      </div>
                    </div>
                    <span class="bar-count">{{ item.count }} POs</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- TABLE 1: OPEN PURCHASE REQUISITIONS -->
          <mat-card class="section-card" style="margin-top:16px;">
            <div class="section-card-header">
              <div>
                <h3>1. Active Purchase Requisitions &bull; Status &amp; Action Plan</h3>
                <p>Team members review each item, correct statuses if required, and enter specific operational remarks.</p>
              </div>
              <span class="count-pill">{{ editingReport().open_prs_data?.length || 0 }} Items</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="custom-table full-width">
                <thead>
                  <tr>
                    <th style="width:10%;">PR Number</th>
                    <th style="width:9%;">Date</th>
                    <th style="width:24%;">Scope &bull; Title</th>
                    <th style="width:12%;">Cost Center</th>
                    <th style="width:12%;">Status (Correctable)</th>
                    <th style="width:7%;text-align:right;">Age</th>
                    <th style="width:26%;">Team Remarks (Manual Input)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pr of editingReport().open_prs_data; track pr.id) {
                    <tr>
                      <td>
                        <strong>{{ pr.pr_number }}</strong>
                        <div style="font-size:11px;color:var(--text-3);">{{ pr.requested_by }}</div>
                      </td>
                      <td>{{ pr.created_at }}</td>
                      <td>
                        <div style="font-weight:600;">{{ pr.title }}</div>
                        <div style="font-size:11px;color:var(--text-3);">Est: ₹{{ pr.estimated_amount | number:'1.0-0' }}</div>
                      </td>
                      <td>{{ pr.cost_center }}</td>
                      <td>
                        <select class="status-dropdown" [(ngModel)]="pr.status">
                          <option value="submitted">Submitted</option>
                          <option value="rfq_created">RFQ Created</option>
                          <option value="rfq_approved">RFQ Approved</option>
                          <option value="partially_converted">Partially Converted</option>
                          <option value="converted">Converted</option>
                          <option value="needs_clarification">Needs Clarification</option>
                          <option value="short_closed">Short Closed</option>
                        </select>
                      </td>
                      <td style="text-align:right;">
                        <span class="age-pill" [class.age-bad]="pr.age_days > 10" [class.age-warn]="pr.age_days > 3">
                          {{ pr.age_days }}d
                        </span>
                      </td>
                      <td>
                        <input type="text" class="table-input" [(ngModel)]="pr.remarks" placeholder="Enter remarks (e.g. Quotation awaited, tech review)...">
                      </td>
                    </tr>
                  }
                  @if (!editingReport().open_prs_data?.length) {
                    <tr><td colspan="7" class="empty-row">No open PRs in pipeline.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card>

          <!-- TABLE 2: POs PENDING APPROVAL -->
          <mat-card class="section-card" style="margin-top:16px;">
            <div class="section-card-header">
              <div>
                <h3>2. Purchase Orders Pending Client Approval</h3>
                <p>Purchase orders currently awaiting Level 1, Level 2, or Level 3 client approval sign-off.</p>
              </div>
              <span class="count-pill">{{ editingReport().pending_pos_data?.length || 0 }} POs</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="custom-table full-width">
                <thead>
                  <tr>
                    <th style="width:12%;">PO Number</th>
                    <th style="width:10%;">PO Date</th>
                    <th style="width:24%;">Vendor Name</th>
                    <th style="width:12%;text-align:right;">Value (Inc GST)</th>
                    <th style="width:14%;">Cost Center</th>
                    <th style="width:12%;">Approval Level</th>
                    <th style="width:6%;text-align:right;">Waiting</th>
                    <th style="width:10%;">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  @for (po of editingReport().pending_pos_data; track po.id) {
                    <tr>
                      <td><strong>{{ po.po_number }}</strong></td>
                      <td>{{ po.created_at }}</td>
                      <td><strong>{{ po.vendor_name }}</strong></td>
                      <td style="text-align:right;font-weight:700;">₹{{ po.grand_total | number:'1.0-0' }}</td>
                      <td>{{ po.cost_center }}</td>
                      <td><span class="pill-badge pill-warn">{{ po.approval_level }}</span></td>
                      <td style="text-align:right;">{{ po.waiting_days }}d</td>
                      <td>
                        <input type="text" class="table-input" [(ngModel)]="po.remarks" placeholder="Notes...">
                      </td>
                    </tr>
                  }
                  @if (!editingReport().pending_pos_data?.length) {
                    <tr><td colspan="8" class="empty-row">No purchase orders currently pending approval.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card>

          <!-- TABLE 3: DELIVERIES & LOGISTICS TRACKING -->
          <mat-card class="section-card" style="margin-top:16px;">
            <div class="section-card-header">
              <div>
                <h3>3. Delivery Logistics &amp; Goods Receipt Tracking</h3>
                <p>Orders released to suppliers awaiting transit, dispatch, or site delivery acknowledgement.</p>
              </div>
              <span class="count-pill">{{ editingReport().deliveries_data?.length || 0 }} Deliveries</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="custom-table full-width">
                <thead>
                  <tr>
                    <th style="width:11%;">PO Number</th>
                    <th style="width:9%;">Released Date</th>
                    <th style="width:20%;">Vendor Name</th>
                    <th style="width:22%;">Description / Material Scope</th>
                    <th style="width:10%;text-align:right;">Value</th>
                    <th style="width:6%;text-align:right;">Age</th>
                    <th style="width:9%;">Status</th>
                    <th style="width:13%;">Team Remarks &bull; ETA</th>
                  </tr>
                </thead>
                <tbody>
                  @for (del of editingReport().deliveries_data; track del.id) {
                    <tr>
                      <td><strong>{{ del.po_number }}</strong></td>
                      <td>{{ del.released_at }}</td>
                      <td><strong>{{ del.vendor_name }}</strong></td>
                      <td style="font-size:12px;">{{ del.description }}</td>
                      <td style="text-align:right;font-weight:700;">₹{{ del.grand_total | number:'1.0-0' }}</td>
                      <td style="text-align:right;">{{ del.days_since_release }}d</td>
                      <td>
                        <select class="status-dropdown" [(ngModel)]="del.status">
                          <option value="On Track">On Track</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Delayed">Delayed</option>
                        </select>
                      </td>
                      <td>
                        <input type="text" class="table-input" [(ngModel)]="del.remarks" placeholder="Delivery remarks / ETA...">
                      </td>
                    </tr>
                  }
                  @if (!editingReport().deliveries_data?.length) {
                    <tr><td colspan="8" class="empty-row">All issued purchase orders have been delivered.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card>

          <!-- TABLE 4: ACTION ITEMS & TASKS -->
          <mat-card class="section-card" style="margin-top:16px;">
            <div class="section-card-header">
              <div>
                <h3>4. Operational Action Items &bull; Team Tasks</h3>
                <p>Track critical follow-ups, dependencies, vendor negotiations, and next steps.</p>
              </div>
              <button mat-stroked-button color="primary" (click)="addTask()">
                <mat-icon>add</mat-icon> Add Task
              </button>
            </div>
            <div style="overflow-x:auto;">
              <table class="custom-table full-width">
                <thead>
                  <tr>
                    <th style="width:3%;">#</th>
                    <th style="width:36%;">Action Item / Specific Task</th>
                    <th style="width:18%;">Owner</th>
                    <th style="width:12%;">Due Date</th>
                    <th style="width:12%;">Status</th>
                    <th style="width:15%;">Remarks &bull; Dependencies</th>
                    <th style="width:4%;text-align:center;"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (task of editingReport().tasks_data; track $index; let i = $index) {
                    <tr>
                      <td>{{ i + 1 }}</td>
                      <td>
                        <input type="text" class="table-input" [(ngModel)]="task.task" placeholder="Task description...">
                      </td>
                      <td>
                        <input type="text" class="table-input" [(ngModel)]="task.owner" placeholder="Owner name...">
                      </td>
                      <td>
                        <input type="date" class="table-input" [(ngModel)]="task.due_date">
                      </td>
                      <td>
                        <select class="status-dropdown" [(ngModel)]="task.status">
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                      </td>
                      <td>
                        <input type="text" class="table-input" [(ngModel)]="task.remarks" placeholder="Remarks...">
                      </td>
                      <td style="text-align:center;">
                        <button mat-icon-button color="warn" (click)="removeTask(i)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                  @if (!editingReport().tasks_data?.length) {
                    <tr><td colspan="7" class="empty-row">No action items added yet. Click "+ Add Task" to create one.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card>

          <!-- Bottom Action Toolbar -->
          <div class="bottom-action-bar">
            <button mat-stroked-button (click)="closeEditor()">
              <mat-icon>arrow_back</mat-icon> Back to Reports List
            </button>
            <div style="display:flex;gap:12px;">
              <button mat-stroked-button color="primary" (click)="saveReportDraft()" [disabled]="savingReport()">
                @if (savingReport()) {
                  <mat-spinner diameter="16" style="margin-right:6px;display:inline-block;" />
                } @else {
                  <mat-icon>save</mat-icon>
                }
                Save Draft
              </button>
              <button mat-stroked-button (click)="previewPdf(editingReport())" [disabled]="previewingPdf()">
                @if (previewingPdf()) {
                  <mat-spinner diameter="16" style="margin-right:6px;display:inline-block;" />
                } @else {
                  <mat-icon>picture_as_pdf</mat-icon>
                }
                Preview McKinsey PDF
              </button>
              <button mat-raised-button color="primary" (click)="openSendModal(editingReport())">
                <mat-icon>send</mat-icon> Send to Client
              </button>
            </div>
          </div>

        </div>
      }

      <!-- TAB 2: TAT ANALYTICS (EXISTING) -->
      @if (activeTab === 2) {
        <div style="margin-top:16px;">
          <!-- Filters -->
          <mat-card class="filter-card no-hover" style="margin-bottom:20px;">
            <mat-card-content>
              <div class="filter-row">
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>From Date</mat-label>
                  <input matInput [matDatepicker]="fromPicker" [(ngModel)]="fromDate" />
                  <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
                  <mat-datepicker #fromPicker />
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>To Date</mat-label>
                  <input matInput [matDatepicker]="toPicker" [(ngModel)]="toDate" />
                  <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
                  <mat-datepicker #toPicker />
                </mat-form-field>

                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Cost Center</mat-label>
                  <mat-select [(ngModel)]="costCenterId">
                    <mat-option [value]="null">All Cost Centers</mat-option>
                    @for (cc of costCenters(); track cc.id) {
                      <mat-option [value]="cc.id">{{ cc.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <button mat-raised-button color="primary" (click)="loadTat()" [disabled]="loadingTat()"
                        style="height:56px;margin-top:0;">
                  @if (loadingTat()) { <mat-spinner diameter="16" style="margin-right:6px;" /> }
                  Apply Filter
                </button>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Summary KPIs -->
          @if (tatRows().length > 0) {
            <div class="kpi-row">
              <div class="kpi-card">
                <div class="kpi-label">Total POs</div>
                <div class="kpi-value">{{ tatRows().length }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Avg PR→PO Draft</div>
                <div class="kpi-value">{{ avg('tat_pr_to_po') }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Avg PR→Approval</div>
                <div class="kpi-value">{{ avg('tat_pr_to_approval') }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Avg PR→Release</div>
                <div class="kpi-value">{{ avg('tat_pr_to_release') }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Avg PR→Delivery</div>
                <div class="kpi-value">{{ avg('tat_pr_to_delivery') }}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Avg PR→Invoice</div>
                <div class="kpi-value">{{ avg('tat_pr_to_invoice') }}</div>
              </div>
            </div>
          }

          <!-- Table -->
          <mat-card class="table-card" style="overflow:hidden;">
            <mat-card-content style="padding:0!important;">
              @if (loadingTat()) {
                <div style="display:flex;justify-content:center;padding:60px;">
                  <mat-spinner diameter="36" />
                </div>
              } @else if (tatRows().length === 0) {
                <div class="empty-state">
                  <mat-icon>bar_chart</mat-icon>
                  <h3>No TAT data found</h3>
                  <p>Apply filters and click Apply Filter to load data.</p>
                </div>
              } @else {
                <div style="overflow-x:auto;">
                  <table mat-table [dataSource]="tatRows()" class="full-width tat-table">
                    <ng-container matColumnDef="po_number">
                      <th mat-header-cell *matHeaderCellDef>PO Number</th>
                      <td mat-cell *matCellDef="let r">
                        <strong>{{ r.po_number }}</strong>
                        <div style="font-size:11px;color:var(--text-3);">{{ r.vendor }}</div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="pr_number">
                      <th mat-header-cell *matHeaderCellDef>PR Number</th>
                      <td mat-cell *matCellDef="let r">{{ r.pr_number }}</td>
                    </ng-container>

                    <ng-container matColumnDef="cost_center">
                      <th mat-header-cell *matHeaderCellDef>Cost Center</th>
                      <td mat-cell *matCellDef="let r" style="color:var(--text-2);">{{ r.cost_center }}</td>
                    </ng-container>

                    <ng-container matColumnDef="grand_total">
                      <th mat-header-cell *matHeaderCellDef>Amount</th>
                      <td mat-cell *matCellDef="let r"><strong>₹{{ r.grand_total | number:'1.0-0' }}</strong></td>
                    </ng-container>

                    <ng-container matColumnDef="tat_pr_to_po">
                      <th mat-header-cell *matHeaderCellDef>PR→PO</th>
                      <td mat-cell *matCellDef="let r">
                        <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_po}" />
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="tat_pr_to_approval">
                      <th mat-header-cell *matHeaderCellDef>PR→Approval</th>
                      <td mat-cell *matCellDef="let r">
                        <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_approval}" />
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="tat_pr_to_release">
                      <th mat-header-cell *matHeaderCellDef>PR→Release</th>
                      <td mat-cell *matCellDef="let r">
                        <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_release}" />
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="tat_pr_to_delivery">
                      <th mat-header-cell *matHeaderCellDef>PR→Delivery</th>
                      <td mat-cell *matCellDef="let r">
                        <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_delivery}" />
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="tat_pr_to_invoice">
                      <th mat-header-cell *matHeaderCellDef>PR→Invoice</th>
                      <td mat-cell *matCellDef="let r">
                        <ng-container *ngTemplateOutlet="tatBadge; context:{v: r.tat_pr_to_invoice}" />
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="columns"></tr>
                    <tr mat-row *matRowDef="let row; columns: columns;"></tr>
                  </table>
                </div>
              }
            </mat-card-content>
          </mat-card>
        </div>
      }

      <!-- TAT badge template -->
      <ng-template #tatBadge let-v="v">
        @if (v === null || v === undefined) {
          <span class="tat-na">—</span>
        } @else if (v <= 2) {
          <span class="tat-badge tat-good">{{ v }}d</span>
        } @else if (v <= 7) {
          <span class="tat-badge tat-medium">{{ v }}d</span>
        } @else {
          <span class="tat-badge tat-bad">{{ v }}d</span>
        }
      </ng-template>

      <!-- MODAL: PDF PREVIEW -->
      @if (showPdfModal()) {
        <div class="modal-backdrop" (click)="closePdfModal()">
          <div class="modal-window pdf-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <mat-icon style="color:#0f2942;">picture_as_pdf</mat-icon>
                <h3 style="margin:0;font-size:16px;">McKinsey Executive PDF Report Preview</h3>
              </div>
              <div style="display:flex;gap:8px;">
                <button mat-stroked-button color="primary" (click)="downloadPdfBlob()">
                  <mat-icon>download</mat-icon> Download PDF
                </button>
                <button mat-icon-button (click)="closePdfModal()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
            <div class="modal-body" style="height:70vh;padding:0;">
              @if (pdfSafeUrl()) {
                <iframe [src]="pdfSafeUrl()" style="width:100%;height:100%;border:none;"></iframe>
              } @else {
                <div style="display:flex;justify-content:center;align-items:center;height:100%;">
                  <mat-spinner diameter="40" />
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- MODAL: SEND TO CLIENT -->
      @if (showSendModal()) {
        <div class="modal-backdrop" (click)="closeSendModal()">
          <div class="modal-window send-modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <mat-icon style="color:#0284c7;">send</mat-icon>
                <h3 style="margin:0;font-size:16px;">Dispatch Operational Report to Client Approver</h3>
              </div>
              <button mat-icon-button (click)="closeSendModal()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="modal-body">
              
              <!-- Recipient Selection -->
              <mat-form-field appearance="outline" class="full-width" style="margin-bottom:12px;">
                <mat-label>Select Client Approver (To:)</mat-label>
                <mat-select [(ngModel)]="sendRecipientEmail" (selectionChange)="onApproverSelected($event.value)">
                  @for (appr of approversList(); track appr.id) {
                    <mat-option [value]="appr.email">{{ appr.name }} ({{ appr.email }})</mat-option>
                  }
                  <mat-option value="custom">-- Enter custom email address --</mat-option>
                </mat-select>
              </mat-form-field>

              @if (sendRecipientEmail === 'custom' || customRecipientActive) {
                <mat-form-field appearance="outline" class="full-width" style="margin-bottom:12px;">
                  <mat-label>Recipient Email Address</mat-label>
                  <input matInput type="email" [(ngModel)]="customRecipientEmail" placeholder="client.approver@organization.com">
                </mat-form-field>
              }

              <!-- Mandatory Locked CCs -->
              <div class="locked-cc-box">
                <div class="cc-label">
                  <mat-icon style="font-size:16px;width:16px;height:16px;">verified_user</mat-icon>
                  <strong>Automated Mandatory CCs (Included by default):</strong>
                </div>
                <div class="cc-chips">
                  <span class="cc-chip">{{ auth.user()?.email || 'buyer@zopapro.com' }} (You / Generating Buyer)</span>
                  <span class="cc-chip">rajashyam&#64;zopapro.com (ZOPA Chief)</span>
                </div>
              </div>

              <!-- Additional CCs Input Box (User Request) -->
              <mat-form-field appearance="outline" class="full-width" style="margin-top:14px;margin-bottom:12px;">
                <mat-label>Additional CC Emails (Optional)</mat-label>
                <input matInput [(ngModel)]="additionalCcsInput" placeholder="Separate multiple emails with commas, e.g. manager@client.com, auditor@zopapro.com">
                <mat-hint>Enter any additional stakeholders who should receive a copy of this review.</mat-hint>
              </mat-form-field>

              <!-- Optional Custom Message / Buyer Note -->
              <mat-form-field appearance="outline" class="full-width" style="margin-top:14px;">
                <mat-label>Operational Notes / Highlights for Client</mat-label>
                <textarea matInput [(ngModel)]="sendCustomNote" rows="3" placeholder="Add any specific context, priority highlights, or urgent actions for this weekly review..."></textarea>
              </mat-form-field>

              <!-- Attachment Note -->
              <div class="attach-badge">
                <mat-icon style="color:#0284c7;">attach_file</mat-icon>
                <span><strong>Attached:</strong> McKinsey-Style Executive PDF Report (Item-level tables, TAT distribution &amp; Logistics Risk charts).</span>
              </div>

              @if (sendError()) {
                <div class="send-error-banner">
                  <mat-icon>error</mat-icon> {{ sendError() }}
                </div>
              }
            </div>
            <div class="modal-footer">
              <button mat-stroked-button (click)="closeSendModal()">Cancel</button>
              <button mat-raised-button color="primary" (click)="dispatchReportEmail()" [disabled]="sendingEmail()">
                @if (sendingEmail()) {
                  <mat-spinner diameter="16" style="margin-right:6px;display:inline-block;" />
                } @else {
                  <mat-icon>send</mat-icon>
                }
                Send Report Now
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .page-wrapper { padding:28px; }
    .page-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px; }
    .page-header h2 { margin:0;font-size:22px;font-weight:700;color:var(--text-1); }
    .page-header p  { margin:4px 0 0;font-size:13.5px;color:var(--text-3); }

    /* Navigation Tabs */
    .report-nav-tabs { display:flex;gap:8px;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px; }
    .nav-tab-btn {
      display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid transparent;
      background:transparent;color:var(--text-2);font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s ease;
    }
    .nav-tab-btn mat-icon { font-size:18px;width:18px;height:18px; }
    .nav-tab-btn:hover { background:var(--surface-hover); }
    .nav-tab-btn.active { background:#0f2942;color:#ffffff;border-color:#0f2942; }

    /* McKinsey KPI Grid */
    .kpi-grid { display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:16px; }
    @media (max-width:1200px) { .kpi-grid { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:768px) { .kpi-grid { grid-template-columns:repeat(2,1fr); } }
    
    .kpi-card-mckinsey {
      background:#ffffff;border:1px solid #cbd5e1;border-top:3px solid #0f2942;border-radius:8px;
      padding:12px 14px;box-shadow:0 1px 3px rgba(0,0,0,0.05);
    }
    .kpi-card-mckinsey.success { border-top-color:#16a34a; }
    .kpi-card-mckinsey.warn { border-top-color:#ea580c; }
    .kpi-card-mckinsey.danger { border-top-color:#dc2626; }
    .kpi-tag { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:2px; }
    .kpi-val { font-size:22px;font-weight:800;color:#0f2942;line-height:1.1; }
    .kpi-unit { font-size:13px;font-weight:500;margin-left:2px;color:#64748b; }
    .kpi-hint { font-size:10px;color:#94a3b8;margin-top:2px; }

    /* McKinsey Charts */
    .charts-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
    @media (max-width:992px) { .charts-grid { grid-template-columns:1fr; } }
    .mckinsey-chart-box {
      background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:14px 18px;
      box-shadow:0 1px 3px rgba(0,0,0,0.04);
    }
    .chart-box-title { display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#0f2942;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:12px;border-bottom:1px solid #f1f5f9;padding-bottom:8px; }
    .chart-box-title mat-icon { font-size:18px;width:18px;height:18px;color:#0284c7; }
    .chart-bar-line { display:flex;align-items:center;gap:12px;margin-bottom:8px;font-size:11.5px; }
    .bar-name { width:120px;font-weight:600;color:#334155; }
    .bar-bg { flex:1;background:#e2e8f0;height:12px;border-radius:4px;overflow:hidden; }
    .bar-progress { height:12px;border-radius:4px;transition:width 0.3s ease; }
    .bg-primary { background:#0f2942; }
    .bg-warn { background:#f97316; }
    .bg-danger { background:#ef4444; }
    .bg-success { background:#16a34a; }
    .bar-count { width:65px;text-align:right;font-weight:700;color:#0f2942; }

    /* Section Cards */
    .section-card { background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:16px; }
    .section-card-header { display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc; }
    .section-card-header h3 { margin:0;font-size:13.5px;font-weight:700;color:#0f2942;text-transform:uppercase;letter-spacing:0.04em; }
    .section-card-header p { margin:2px 0 0;font-size:12px;color:#64748b; }
    .count-pill { background:#e2e8f0;color:#334155;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700; }

    /* Custom Tables */
    .custom-table { width:100%;border-collapse:collapse;font-size:12.5px; }
    .custom-table th { background:#0f2942;color:#ffffff;font-weight:700;padding:8px 10px;text-align:left;border:1px solid #0f2942;font-size:11.5px;letter-spacing:0.03em; }
    .custom-table td { padding:8px 10px;border-bottom:1px solid #e2e8f0;border-right:1px solid #f1f5f9;vertical-align:middle; }
    .custom-table tbody tr:nth-child(even) { background:#f8fafc; }
    .custom-table tbody tr:hover { background:#f1f5f9; }

    .table-input {
      width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;
      font-size:12px;font-family:inherit;background:#ffffff;transition:border-color 0.15s ease;
    }
    .table-input:focus { outline:none;border-color:#0284c7;box-shadow:0 0 0 2px rgba(2,132,199,0.15); }
    .status-dropdown {
      width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;
      font-weight:600;font-family:inherit;background:#ffffff;color:#0f2942;cursor:pointer;
    }

    .pill-badge { display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em; }
    .pill-success { background:#dcfce7;color:#15803d; }
    .pill-warn { background:#ffedd5;color:#c2410c; }
    .pill-danger { background:#fee2e2;color:#b91c1c; }
    .pill-info { background:#e0f2fe;color:#0369a1; }

    .age-pill { display:inline-block;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;background:#e2e8f0;color:#334155; }
    .age-warn { background:#ffedd5;color:#c2410c; }
    .age-bad { background:#fee2e2;color:#b91c1c; }

    .empty-row { text-align:center;color:#64748b;padding:20px;font-style:italic; }

    .editor-header-card { padding:14px 18px;border:1px solid #cbd5e1;border-radius:8px; }
    .editor-header-content { display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap; }
    .header-meta { display:flex;gap:8px;align-items:center; }

    .bottom-action-bar {
      display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#ffffff;
      border:1px solid #cbd5e1;border-radius:8px;margin-top:16px;
    }

    /* Modals */
    .modal-backdrop {
      position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.55);
      z-index:1000;display:flex;justify-content:center;align-items:center;padding:20px;
    }
    .modal-window {
      background:#ffffff;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.2);
      width:100%;max-width:680px;display:flex;flex-direction:column;overflow:hidden;
    }
    .modal-window.pdf-modal { max-width:1100px; }
    .modal-header { display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc; }
    .modal-body { padding:20px;max-height:80vh;overflow-y:auto; }
    .modal-footer { display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc; }

    .locked-cc-box { background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:12px; }
    .cc-label { display:flex;align-items:center;gap:6px;font-size:11.5px;color:#475569;margin-bottom:6px; }
    .cc-chips { display:flex;flex-wrap:wrap;gap:6px; }
    .cc-chip { background:#ffffff;border:1px solid #94a3b8;color:#0f2942;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px; }

    .attach-badge { display:flex;align-items:center;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin-top:12px;font-size:12px;color:#1e40af; }
    .send-error-banner { display:flex;align-items:center;gap:6px;background:#fee2e2;color:#b91c1c;padding:10px 14px;border-radius:6px;font-size:12px;margin-top:12px; }

    /* TAT Table styles */
    .filter-card { overflow:visible; }
    .filter-row { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }
    .filter-field { flex:1 1 200px; min-width:180px; }
    .kpi-row { display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:20px; }
    .kpi-card { background:white;border:1px solid var(--border);border-radius:12px;padding:14px 16px; }
    .kpi-label { font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px; }
    .kpi-value { font-size:20px;font-weight:800;color:var(--text-1); }
    .tat-table .mat-mdc-cell { font-size:12px; }
    .tat-badge { display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700; }
    .tat-good   { background:#dcfce7;color:#166534; }
    .tat-medium { background:#fef9c3;color:#854d0e; }
    .tat-bad    { background:#fee2e2;color:#991b1b; }
    .tat-na     { color:var(--text-3);font-size:12px; }
    .empty-state { display:flex;flex-direction:column;align-items:center;gap:8px;padding:60px 24px;color:var(--text-3);text-align:center; }
    .empty-state mat-icon { font-size:48px;width:48px;height:48px;color:var(--border); }
    .empty-state h3 { margin:0;font-size:16px;font-weight:600;color:var(--text-2); }
    .empty-state p { margin:0;font-size:13px; }
    .full-width { width:100%; }
  `],
})
export class ReportsComponent implements OnInit {
  private http = inject(HttpClient);
  public auth = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  // Tab State: 0 = Operational Reports List, 1 = Report Editor, 2 = TAT Analytics
  activeTab = 0;

  // Operational Reports State
  opReports = signal<any[]>([]);
  loadingOpReports = signal(false);
  startingReport = signal(false);
  editingReport = signal<any | null>(null);
  savingReport = signal(false);

  // PDF Preview Modal
  showPdfModal = signal(false);
  pdfSafeUrl = signal<SafeResourceUrl | null>(null);
  pdfCurrentBlobUrl: string | null = null;
  previewingPdf = signal(false);

  // Send to Client Modal
  showSendModal = signal(false);
  sendingReportTarget = signal<any | null>(null);
  approversList = signal<any[]>([]);
  sendRecipientEmail = '';
  customRecipientActive = false;
  customRecipientEmail = '';
  additionalCcsInput = '';
  sendCustomNote = '';
  sendingEmail = signal(false);
  sendError = signal<string | null>(null);

  // TAT Analytics State
  columns = ['po_number', 'pr_number', 'cost_center', 'grand_total',
    'tat_pr_to_po', 'tat_pr_to_approval', 'tat_pr_to_release',
    'tat_pr_to_delivery', 'tat_pr_to_invoice'];
  costCenters = signal<any[]>([]);
  tatRows = signal<any[]>([]);
  loadingTat = signal(false);
  fromDate: Date | null = null;
  toDate: Date | null = null;
  costCenterId: number | null = null;

  ngOnInit() {
    this.loadOperationalReports();
    this.loadApprovers();
    this.http.get<any>(`${environment.apiUrl}/cost-centers`).subscribe(r => this.costCenters.set(r.data ?? r));
  }

  switchTab(tabIndex: number) {
    this.activeTab = tabIndex;
    if (tabIndex === 0) {
      this.loadOperationalReports();
    } else if (tabIndex === 2 && this.tatRows().length === 0) {
      this.loadTat();
    }
  }

  // ── Operational Reports List & Actions ─────────────────────────────────────
  loadOperationalReports() {
    this.loadingOpReports.set(true);
    this.http.get<any>(`${environment.apiUrl}/operational-reports`).subscribe({
      next: res => {
        this.opReports.set(res.data ?? res);
        this.loadingOpReports.set(false);
      },
      error: () => this.loadingOpReports.set(false),
    });
  }

  loadApprovers() {
    this.http.get<any[]>(`${environment.apiUrl}/operational-reports/approvers`).subscribe({
      next: res => {
        this.approversList.set(res || []);
        if (res && res.length > 0) {
          this.sendRecipientEmail = res[0].email;
        }
      },
      error: () => {},
    });
  }

  startNewReport() {
    this.startingReport.set(true);
    this.http.post<any>(`${environment.apiUrl}/operational-reports/start`, {}).subscribe({
      next: res => {
        this.startingReport.set(false);
        this.openEditor(res.report);
      },
      error: err => {
        this.startingReport.set(false);
        alert('Failed to initialize report: ' + (err.error?.message || err.message));
      },
    });
  }

  openEditor(report: any) {
    this.editingReport.set(JSON.parse(JSON.stringify(report)));
    this.activeTab = 1;
  }

  closeEditor() {
    this.editingReport.set(null);
    this.activeTab = 0;
    this.loadOperationalReports();
  }

  saveReportDraft() {
    const rep = this.editingReport();
    if (!rep) return;

    this.savingReport.set(true);
    this.http.put<any>(`${environment.apiUrl}/operational-reports/${rep.id}`, rep).subscribe({
      next: res => {
        this.savingReport.set(false);
        this.editingReport.set(res.report);
        alert('Report draft and status corrections saved successfully.');
      },
      error: err => {
        this.savingReport.set(false);
        alert('Failed to save draft: ' + (err.error?.message || err.message));
      },
    });
  }

  deleteReport(report: any) {
    if (!confirm(`Are you sure you want to delete "${report.title}"?`)) return;

    this.http.delete(`${environment.apiUrl}/operational-reports/${report.id}`).subscribe({
      next: () => {
        this.loadOperationalReports();
      },
      error: err => alert('Failed to delete report: ' + (err.error?.message || err.message)),
    });
  }

  // ── Tasks Operations ───────────────────────────────────────────────────────
  addTask() {
    const rep = this.editingReport();
    if (!rep) return;
    if (!rep.tasks_data) rep.tasks_data = [];
    rep.tasks_data.push({
      task: '',
      owner: this.auth.user()?.name || '',
      due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      status: 'Pending',
      remarks: '',
    });
  }

  removeTask(index: number) {
    const rep = this.editingReport();
    if (!rep || !rep.tasks_data) return;
    rep.tasks_data.splice(index, 1);
  }

  // ── Chart Helper Computations ──────────────────────────────────────────────
  getTatDistEntries() {
    const dist = this.editingReport()?.metrics_data?.tat_distribution || {
      '< 1 Day': 0, '1 - 3 Days': 0, '4 - 7 Days': 0, '8 - 10 Days': 0, '> 10 Days': 0
    };
    const maxVal = Math.max(1, ...Object.values(dist).map(Number));
    return Object.entries(dist).map(([label, count]) => ({
      label,
      count: Number(count),
      pct: Math.max(6, Math.round((Number(count) / maxVal) * 100)),
    }));
  }

  getDeliveryRiskEntries() {
    const risk = this.editingReport()?.metrics_data?.delivery_risk || {
      'On Track (0-3d)': 0, 'Moderate (4-7d)': 0, 'Delayed (> 7d)': 0
    };
    const maxVal = Math.max(1, ...Object.values(risk).map(Number));
    return Object.entries(risk).map(([label, count]) => ({
      label,
      count: Number(count),
      pct: Math.max(6, Math.round((Number(count) / maxVal) * 100)),
    }));
  }

  // ── PDF Preview & Download ─────────────────────────────────────────────────
  previewPdf(report: any) {
    if (!report) return;
    this.previewingPdf.set(true);

    const performPdfFetch = () => {
      this.http.get(`${environment.apiUrl}/operational-reports/${report.id}/pdf`, { responseType: 'blob' }).subscribe({
        next: (blob: Blob) => {
          if (this.pdfCurrentBlobUrl) {
            URL.revokeObjectURL(this.pdfCurrentBlobUrl);
          }
          const blobUrl = URL.createObjectURL(blob);
          this.pdfCurrentBlobUrl = blobUrl;
          this.pdfSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl));
          this.previewingPdf.set(false);
          this.showPdfModal.set(true);
        },
        error: async (err: any) => {
          this.previewingPdf.set(false);
          let msg = 'Failed to generate PDF';
          if (err.error instanceof Blob) {
            try {
              const text = await err.error.text();
              const json = JSON.parse(text);
              msg = json.error || json.message || text;
            } catch (_) {
              try { msg = await err.error.text(); } catch (_) {}
            }
          } else if (err.error?.message || err.error?.error) {
            msg = err.error.message || err.error.error;
          }
          alert('Could not preview PDF: ' + msg);
        }
      });
    };

    // If currently editing this report, save draft first to include latest edits
    const rep = this.editingReport();
    if (rep && rep.id === report.id) {
      this.http.put<any>(`${environment.apiUrl}/operational-reports/${rep.id}`, rep).subscribe({
        next: (res) => {
          this.editingReport.set(res.report);
          performPdfFetch();
        },
        error: () => performPdfFetch(),
      });
    } else {
      performPdfFetch();
    }
  }

  downloadPdfBlob() {
    if (!this.pdfCurrentBlobUrl) return;
    const a = document.createElement('a');
    a.href = this.pdfCurrentBlobUrl;
    a.download = `${this.editingReport()?.title || 'Operational-Report'}.pdf`;
    a.click();
  }

  closePdfModal() {
    this.showPdfModal.set(false);
    this.pdfSafeUrl.set(null);
  }

  // ── Send to Client Modal ───────────────────────────────────────────────────
  openSendModal(report: any) {
    this.sendingReportTarget.set(report);
    this.sendError.set(null);
    this.additionalCcsInput = '';
    this.sendCustomNote = report.notes || '';

    // Set initial recipient if available
    if (report.client_approver_email) {
      this.sendRecipientEmail = report.client_approver_email;
      this.customRecipientActive = true;
      this.customRecipientEmail = report.client_approver_email;
    } else if (this.approversList().length > 0) {
      this.sendRecipientEmail = this.approversList()[0].email;
      this.customRecipientActive = false;
    } else {
      this.sendRecipientEmail = 'custom';
      this.customRecipientActive = true;
    }

    this.showSendModal.set(true);
  }

  onApproverSelected(val: string) {
    if (val === 'custom') {
      this.customRecipientActive = true;
    } else {
      this.customRecipientActive = false;
      this.customRecipientEmail = val;
    }
  }

  closeSendModal() {
    this.showSendModal.set(false);
    this.sendingReportTarget.set(null);
  }

  dispatchReportEmail() {
    const report = this.sendingReportTarget();
    if (!report) return;

    const recipient = this.customRecipientActive ? this.customRecipientEmail : this.sendRecipientEmail;
    if (!recipient || !recipient.includes('@')) {
      this.sendError.set('Please provide a valid client recipient email.');
      return;
    }

    // Parse additional CCs entered in the CC box
    const extraCcs = this.additionalCcsInput
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 3 && e.includes('@'));

    this.sendingEmail.set(true);
    this.sendError.set(null);

    const payload = {
      recipient_email: recipient,
      recipient_name: recipient.split('@')[0],
      additional_ccs: extraCcs,
      custom_message: this.sendCustomNote,
    };

    this.http.post<any>(`${environment.apiUrl}/operational-reports/${report.id}/send`, payload).subscribe({
      next: res => {
        this.sendingEmail.set(false);
        this.closeSendModal();
        alert('Operational report dispatched successfully to ' + recipient + ' with CCs.');
        if (this.editingReport()) {
          this.editingReport.set(res.report);
        }
        this.loadOperationalReports();
      },
      error: err => {
        this.sendingEmail.set(false);
        this.sendError.set(err.error?.error || err.error?.message || 'Failed to dispatch email.');
      },
    });
  }

  // ── TAT Analytics ──────────────────────────────────────────────────────────
  loadTat() {
    this.loadingTat.set(true);
    const params: Record<string, string> = {};
    if (this.fromDate) params['from'] = this.fromDate.toISOString().split('T')[0];
    if (this.toDate)   params['to']   = this.toDate.toISOString().split('T')[0];
    if (this.costCenterId) params['cost_center_id'] = String(this.costCenterId);

    this.http.get<any[]>(`${environment.apiUrl}/reports/po-tat`, { params }).subscribe({
      next: r => { this.tatRows.set(r); this.loadingTat.set(false); },
      error: () => this.loadingTat.set(false),
    });
  }

  avg(field: string): string {
    const vals = this.tatRows()
      .map(r => r[field])
      .filter((v): v is number => v !== null && v !== undefined);
    if (!vals.length) return '—';
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) + 'd';
  }
}
