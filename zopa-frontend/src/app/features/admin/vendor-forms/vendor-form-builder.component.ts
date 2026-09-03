import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';

export interface FormFieldDefinition {
  id: string;
  field_key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'select' | 'radio' | 'checkbox' | 'date' | 'file';
  required: boolean;
  placeholder?: string;
  help_text?: string;
  options?: string[];
  target_mapping?: string;
  target_doc_type?: string;
}

export interface FormTemplate {
  id: number;
  name: string;
  vendor_type?: string;
  description?: string;
  schema_definition: FormFieldDefinition[];
  is_active: boolean;
  invites_count?: number;
  responses_count?: number;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-vendor-form-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <div class="breadcrumbs">
            <span>Administration</span> / <span>Vendor Onboarding</span> / <span class="active">Form Builder</span>
          </div>
          <h2>Vendor Form Builder</h2>
          <p class="subtitle">Design customizable registration form templates for different vendor categories and manage field schemas.</p>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" (click)="openBuilderModal()">
            <mat-icon>add</mat-icon> Create New Template
          </button>
        </div>
      </div>

      <!-- Template Cards Grid -->
      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="36" />
          <span>Loading form templates...</span>
        </div>
      } @else if (templates().length === 0) {
        <div class="empty-state">
          <mat-icon class="empty-icon">dynamic_form</mat-icon>
          <h3>No Form Templates Found</h3>
          <p>Get started by creating your first vendor onboarding registration template.</p>
          <button mat-stroked-button color="primary" (click)="openBuilderModal()">
            <mat-icon>add</mat-icon> Create Form Template
          </button>
        </div>
      } @else {
        <div class="templates-grid">
          @for (t of templates(); track t.id) {
            <div class="template-card">
              <div class="card-top">
                <div class="card-icon-wrap">
                  <mat-icon>{{ getTemplateIcon(t.vendor_type) }}</mat-icon>
                </div>
                <div class="card-badges">
                  @if (t.vendor_type) {
                    <span class="type-pill">{{ formatVendorType(t.vendor_type) }}</span>
                  }
                  <span class="field-count-pill">{{ t.schema_definition?.length || 0 }} fields</span>
                </div>
              </div>

              <div class="card-body">
                <h3 class="template-title">{{ t.name }}</h3>
                <p class="template-desc">{{ t.description || 'No description provided.' }}</p>

                <div class="card-stats">
                  <div class="stat-item">
                    <span class="stat-val">{{ t.invites_count ?? 0 }}</span>
                    <span class="stat-lbl">Invites Sent</span>
                  </div>
                  <div class="stat-divider"></div>
                  <div class="stat-item">
                    <span class="stat-val">{{ t.responses_count ?? 0 }}</span>
                    <span class="stat-lbl">Responses</span>
                  </div>
                  <div class="stat-divider"></div>
                  <div class="stat-item">
                    <span class="stat-val">{{ getFileFieldCount(t) }}</span>
                    <span class="stat-lbl">Attachments</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button mat-button class="action-btn" (click)="previewTemplate(t)" matTooltip="Preview vendor form">
                  <mat-icon>visibility</mat-icon> Preview
                </button>
                <button mat-button class="action-btn" (click)="openBuilderModal(t)" matTooltip="Edit & amend fields">
                  <mat-icon>edit</mat-icon> Amend
                </button>
                <button mat-button class="action-btn" (click)="duplicateTemplate(t)" matTooltip="Clone this template">
                  <mat-icon>content_copy</mat-icon> Duplicate
                </button>
                <button mat-icon-button class="delete-btn" (click)="deactivateTemplate(t)" matTooltip="Deactivate template">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Form Builder Modal -->
      @if (isBuilderOpen()) {
        <div class="modal-backdrop">
          <div class="modal-dialog">
            <div class="modal-header">
              <div>
                <h3>{{ editingTemplateId() ? 'Amend Form Template' : 'Create Form Template' }}</h3>
                <p>Customize form properties and configure input fields or file attachments.</p>
              </div>
              <button mat-icon-button (click)="closeBuilderModal()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="modal-content">
              <!-- Template Meta Information -->
              <div class="section-box">
                <h4 class="section-title">Template Details</h4>
                <div class="form-row">
                  <div class="form-group flex-2">
                    <label>Template Name <span class="req">*</span></label>
                    <input type="text" class="custom-input" [(ngModel)]="templateForm.name" placeholder="e.g. Standard Materials Vendor Form" />
                  </div>
                  <div class="form-group flex-1">
                    <label>Default Vendor Type</label>
                    <select class="custom-input" [(ngModel)]="templateForm.vendor_type">
                      <option value="distributor">Distributor</option>
                      <option value="manufacturer">Manufacturer</option>
                      <option value="service_provider">Service Provider</option>
                      <option value="consultant">Consultant</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label>Instructions & Description for Vendor</label>
                  <textarea class="custom-input" rows="2" [(ngModel)]="templateForm.description" placeholder="Brief instructions visible at the top of the form for the vendor..."></textarea>
                </div>
              </div>

              <!-- Fields Builder Section -->
              <div class="section-box">
                <div class="section-head-row">
                  <div>
                    <h4 class="section-title">Form Fields ({{ templateForm.schema.length }})</h4>
                    <span class="sub-lbl">Define text inputs, dropdown selections, and mandatory compliance document uploads.</span>
                  </div>
                  <button mat-stroked-button color="primary" type="button" (click)="openAddFieldDialog()">
                    <mat-icon>add</mat-icon> Add Field
                  </button>
                </div>

                <div class="fields-list">
                  @for (f of templateForm.schema; track f.id; let idx = $index) {
                    <div class="field-item">
                      <div class="field-drag-handle">
                        <span class="field-index">#{{ idx + 1 }}</span>
                      </div>

                      <div class="field-info">
                        <div class="field-title-line">
                          <span class="field-name">{{ f.label }}</span>
                          @if (f.required) {
                            <span class="required-badge">Required</span>
                          }
                          <span class="type-tag type-tag--{{ f.type }}">{{ f.type | uppercase }}</span>
                          @if (f.target_mapping && f.target_mapping !== 'custom') {
                            <span class="mapping-tag">P2P: {{ f.target_mapping }}</span>
                          }
                          @if (f.type === 'file' && f.target_doc_type) {
                            <span class="doc-tag">Doc: {{ f.target_doc_type }}</span>
                          }
                        </div>
                        <div class="field-subline">
                          <code>{{ f.field_key }}</code>
                          @if (f.placeholder) {
                            <span class="dot">&bull;</span>
                            <span class="placeholder-text">Placeholder: "{{ f.placeholder }}"</span>
                          }
                          @if (f.help_text) {
                            <span class="dot">&bull;</span>
                            <span class="help-text">Help: {{ f.help_text }}</span>
                          }
                          @if (f.options?.length) {
                            <span class="dot">&bull;</span>
                            <span class="options-text">Options: {{ f.options?.join(', ') }}</span>
                          }
                        </div>
                      </div>

                      <div class="field-actions">
                        <button mat-icon-button (click)="moveFieldUp(idx)" [disabled]="idx === 0" matTooltip="Move up">
                          <mat-icon>arrow_upward</mat-icon>
                        </button>
                        <button mat-icon-button (click)="moveFieldDown(idx)" [disabled]="idx === templateForm.schema.length - 1" matTooltip="Move down">
                          <mat-icon>arrow_downward</mat-icon>
                        </button>
                        <button mat-icon-button color="primary" (click)="editField(f, idx)" matTooltip="Edit field settings">
                          <mat-icon>tune</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="removeField(idx)" matTooltip="Remove field">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button mat-stroked-button (click)="closeBuilderModal()">Cancel</button>
              <button mat-flat-button color="primary" (click)="saveTemplate()" [disabled]="saving()">
                @if (saving()) {
                  <mat-spinner diameter="18" />
                } @else {
                  <mat-icon>save</mat-icon> {{ editingTemplateId() ? 'Update Template' : 'Save Template' }}
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Field Config Dialog Modal -->
      @if (isFieldModalOpen()) {
        <div class="modal-backdrop modal-backdrop--sub">
          <div class="modal-dialog modal-dialog--sm">
            <div class="modal-header">
              <h3>{{ editingFieldIndex() >= 0 ? 'Edit Field Settings' : 'Add New Form Field' }}</h3>
              <button mat-icon-button (click)="closeFieldModal()"><mat-icon>close</mat-icon></button>
            </div>

            <div class="modal-content">
              <div class="form-group">
                <label>Field Label <span class="req">*</span></label>
                <input type="text" class="custom-input" [(ngModel)]="currentField.label" (ngModelChange)="autoGenKey()" placeholder="e.g. Registered Trade Name" />
              </div>

              <div class="form-row">
                <div class="form-group flex-1">
                  <label>Field Key <span class="req">*</span></label>
                  <input type="text" class="custom-input" [(ngModel)]="currentField.field_key" placeholder="e.g. trade_name" />
                </div>
                <div class="form-group flex-1">
                  <label>Field Type <span class="req">*</span></label>
                  <select class="custom-input" [(ngModel)]="currentField.type">
                    <option value="text">Text Input</option>
                    <option value="textarea">Textarea (Multiline)</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone / Mobile</option>
                    <option value="select">Dropdown (Select)</option>
                    <option value="radio">Radio Group</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="date">Date</option>
                    <option value="file">File Upload (Attachment)</option>
                  </select>
                </div>
              </div>

              <!-- Options (if select/radio/checkbox) -->
              @if (['select', 'radio', 'checkbox'].includes(currentField.type)) {
                <div class="form-group">
                  <label>Choices / Options (comma-separated) <span class="req">*</span></label>
                  <input type="text" class="custom-input" [(ngModel)]="fieldOptionsRaw" placeholder="e.g. Manufacturer, Authorized Dealer, Stockist" />
                </div>
              }

              <!-- Document Type Mapping (if file) -->
              @if (currentField.type === 'file') {
                <div class="form-group">
                  <label>Document Classification</label>
                  <select class="custom-input" [(ngModel)]="currentField.target_doc_type">
                    <option value="pan">PAN Card Copy</option>
                    <option value="gst">GST Registration Certificate</option>
                    <option value="cancelled_cheque">Cancelled Cheque / Bank Passbook</option>
                    <option value="additional">Additional Certificate / License</option>
                  </select>
                  <span class="field-hint">Uploaded file will be automatically classified into this document folder in the vendor profile upon approval.</span>
                </div>
              } @else {
                <!-- Target P2P Column Mapping -->
                <div class="form-group">
                  <label>Map to P2P Vendor Column</label>
                  <select class="custom-input" [(ngModel)]="currentField.target_mapping">
                    <option value="custom">-- Custom Field (Stored in Response) --</option>
                    <option value="name">Vendor Legal Name (vendors.name)</option>
                    <option value="pan">PAN Number (vendors.pan)</option>
                    <option value="gstin">GSTIN (vendors.gstin)</option>
                    <option value="email">Official Email (vendors.email)</option>
                    <option value="phone">Contact Phone (vendors.phone)</option>
                    <option value="vendor_type">Vendor Type (vendors.vendor_type)</option>
                    <option value="entity_type">Entity Legal Structure (vendors.entity_type)</option>
                    <option value="special_status">Special Classification / MSME (vendors.special_status)</option>
                    <option value="account_no">Bank Account No (vendors.account_no)</option>
                    <option value="ifsc">Bank IFSC Code (vendors.ifsc)</option>
                    <option value="bank_name">Bank Name & Branch (vendors.bank_name)</option>
                    <option value="address">Registered Address (vendor_addresses.address)</option>
                    <option value="city">City (vendor_addresses.city)</option>
                    <option value="state">State (vendor_addresses.state)</option>
                    <option value="pincode">PIN Code (vendor_addresses.pincode)</option>
                  </select>
                </div>
              }

              <div class="form-group">
                <label>Placeholder</label>
                <input type="text" class="custom-input" [(ngModel)]="currentField.placeholder" placeholder="e.g. Enter details..." />
              </div>

              <div class="form-group">
                <label>Help Text / Hint</label>
                <input type="text" class="custom-input" [(ngModel)]="currentField.help_text" placeholder="e.g. As shown on official certificate..." />
              </div>

              <div class="checkbox-row">
                <mat-checkbox [(ngModel)]="currentField.required">Is Mandatory / Required</mat-checkbox>
              </div>
            </div>

            <div class="modal-footer">
              <button mat-stroked-button (click)="closeFieldModal()">Cancel</button>
              <button mat-flat-button color="primary" (click)="saveField()">Apply Field</button>
            </div>
          </div>
        </div>
      }

      <!-- Interactive Preview Modal -->
      @if (previewModalOpen()) {
        <div class="modal-backdrop">
          <div class="modal-dialog modal-dialog--preview">
            <div class="modal-header">
              <div>
                <span class="preview-badge">Live Interactive Preview</span>
                <h3>{{ previewData?.name }}</h3>
                <p>{{ previewData?.description }}</p>
              </div>
              <button mat-icon-button (click)="previewModalOpen.set(false)"><mat-icon>close</mat-icon></button>
            </div>

            <div class="modal-content preview-body">
              <div class="preview-card">
                <div class="preview-head-banner">
                  <mat-icon>storefront</mat-icon>
                  <div>
                    <h4>Vendor Registration Form</h4>
                    <span>ZOPA Procurement Suite &bull; Prospective Vendor Registration</span>
                  </div>
                </div>

                <div class="preview-fields-grid">
                  @for (f of previewData?.schema_definition; track f.id) {
                    <div class="preview-field-box" [class.full-width]="f.type === 'textarea' || f.type === 'file'">
                      <label class="preview-lbl">
                        {{ f.label }}
                        @if (f.required) { <span class="req">*</span> }
                      </label>

                      @if (f.type === 'textarea') {
                        <textarea class="preview-input" rows="3" [placeholder]="f.placeholder || ''" disabled></textarea>
                      } @else if (f.type === 'select') {
                        <select class="preview-input" disabled>
                          <option>-- Select an option --</option>
                          @for (opt of f.options; track opt) {
                            <option>{{ opt }}</option>
                          }
                        </select>
                      } @else if (f.type === 'file') {
                        <div class="preview-file-dropzone">
                          <mat-icon>cloud_upload</mat-icon>
                          <span>Attach file (PDF / PNG / JPG)</span>
                          <span class="file-help">{{ f.help_text || 'Max file size: 10MB' }}</span>
                        </div>
                      } @else {
                        <input [type]="f.type === 'phone' ? 'tel' : f.type" class="preview-input" [placeholder]="f.placeholder || ''" disabled />
                      }

                      @if (f.help_text && f.type !== 'file') {
                        <span class="preview-help">{{ f.help_text }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button mat-stroked-button (click)="previewModalOpen.set(false)">Close Preview</button>
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
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border, #e2e8f0);
    }

    .breadcrumbs {
      font-size: 12px;
      color: var(--text-3, #94a3b8);
      margin-bottom: 6px;
    }
    .breadcrumbs .active {
      color: var(--brand, #ea580c);
      font-weight: 600;
    }

    .page-header h2 {
      font-size: 24px;
      font-weight: 800;
      color: var(--text-1, #0f172a);
      margin: 0 0 4px;
    }

    .subtitle {
      font-size: 13.5px;
      color: var(--text-3, #64748b);
      margin: 0;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      gap: 14px;
      color: var(--text-3, #64748b);
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #cbd5e1;
    }

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .template-card {
      background: var(--surface, #ffffff);
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .template-card:hover {
      box-shadow: 0 6px 16px rgba(0,0,0,0.08);
      border-color: #cbd5e1;
      transform: translateY(-2px);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .card-icon-wrap {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: #fff7ed;
      color: #ea580c;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card-badges {
      display: flex;
      gap: 6px;
    }

    .type-pill {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 6px;
      background: #eff6ff;
      color: #2563eb;
    }

    .field-count-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
    }

    .template-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-1, #0f172a);
      margin: 0 0 6px;
    }

    .template-desc {
      font-size: 12.5px;
      color: var(--text-3, #64748b);
      line-height: 1.5;
      margin: 0 0 16px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-stats {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }

    .stat-item {
      flex: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
    }

    .stat-val {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-1, #0f172a);
    }

    .stat-lbl {
      font-size: 10.5px;
      color: var(--text-3, #64748b);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-divider {
      width: 1px;
      height: 24px;
      background: #e2e8f0;
    }

    .card-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid #f1f5f9;
      padding-top: 12px;
      margin-top: auto;
    }

    .action-btn {
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #475569 !important;
      padding: 0 8px !important;
    }
    .action-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }

    .delete-btn {
      color: #94a3b8;
    }
    .delete-btn:hover {
      color: #dc2626;
    }

    /* Modal Backdrop & Dialog */
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
    .modal-backdrop--sub {
      z-index: 1050;
    }

    .modal-dialog {
      background: #ffffff;
      border-radius: 14px;
      width: 100%;
      max-width: 820px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .modal-dialog--sm {
      max-width: 520px;
    }
    .modal-dialog--preview {
      max-width: 760px;
    }

    .modal-header {
      padding: 18px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .modal-header p {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: #64748b;
    }

    .modal-content {
      padding: 20px 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
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

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 12px;
    }

    .section-head-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .sub-lbl {
      font-size: 12px;
      color: #64748b;
    }

    .form-row {
      display: flex;
      gap: 14px;
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
      font-size: 13.5px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.2s;
      background: #ffffff;
      color: #0f172a;
    }
    .custom-input:focus {
      border-color: #ea580c;
      box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.1);
    }

    .field-hint {
      font-size: 11px;
      color: #64748b;
      line-height: 1.4;
    }

    .checkbox-row {
      margin-top: 6px;
    }

    /* Fields list items */
    .fields-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      transition: background 0.15s;
    }
    .field-item:hover {
      background: #ffffff;
      border-color: #cbd5e1;
    }

    .field-index {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      width: 24px;
    }

    .field-info {
      flex: 1;
      min-width: 0;
    }

    .field-title-line {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .field-name {
      font-size: 13.5px;
      font-weight: 700;
      color: #1e293b;
    }

    .required-badge {
      font-size: 10px;
      font-weight: 700;
      background: #fee2e2;
      color: #b91c1c;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .type-tag {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: #e2e8f0;
      color: #334155;
    }
    .type-tag--file {
      background: #fef3c7;
      color: #b45309;
    }

    .mapping-tag {
      font-size: 10px;
      font-weight: 600;
      background: #e0f2fe;
      color: #0369a1;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .doc-tag {
      font-size: 10px;
      font-weight: 600;
      background: #fdf4ff;
      color: #a21caf;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .field-subline {
      font-size: 11.5px;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 6px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .field-subline code {
      background: #ffffff;
      padding: 0 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      color: #ea580c;
    }
    .dot { color: #cbd5e1; }

    .field-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .field-actions button {
      width: 32px;
      height: 32px;
      line-height: 32px;
    }
    .field-actions mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Live Preview Styles */
    .preview-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      background: #dcfce7;
      color: #15803d;
      padding: 2px 8px;
      border-radius: 99px;
      display: inline-block;
      margin-bottom: 4px;
    }

    .preview-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
    }

    .preview-head-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 16px;
      margin-bottom: 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .preview-head-banner mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #ea580c;
    }
    .preview-head-banner h4 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    .preview-head-banner span {
      font-size: 12px;
      color: #64748b;
    }

    .preview-fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .preview-field-box.full-width {
      grid-column: 1 / -1;
    }

    .preview-lbl {
      display: block;
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }

    .preview-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #0f172a;
    }

    .preview-file-dropzone {
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: #64748b;
    }
    .preview-file-dropzone mat-icon {
      color: #ea580c;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .file-help {
      font-size: 11px;
      color: #94a3b8;
    }

    .preview-help {
      display: block;
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
  `]
})
export class VendorFormBuilderComponent implements OnInit {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);

  templates = signal<FormTemplate[]>([]);
  loading = signal(true);
  saving = signal(false);

  // Template Modal State
  isBuilderOpen = signal(false);
  editingTemplateId = signal<number | null>(null);
  templateForm: {
    name: string;
    vendor_type: string;
    description: string;
    schema: FormFieldDefinition[];
  } = {
    name: '',
    vendor_type: 'distributor',
    description: '',
    schema: []
  };

  // Field Modal State
  isFieldModalOpen = signal(false);
  editingFieldIndex = signal<number>(-1);
  currentField: FormFieldDefinition = this.createEmptyField();
  fieldOptionsRaw: string = '';

  // Preview Modal State
  previewModalOpen = signal(false);
  previewData: FormTemplate | null = null;

  ngOnInit() {
    this.loadTemplates();
  }

  loadTemplates() {
    this.loading.set(true);
    this.http.get<FormTemplate[]>(`${environment.apiUrl}/admin/vendor-forms`).subscribe({
      next: (res) => {
        this.templates.set(res || []);
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Failed to load vendor form templates.');
        this.loading.set(false);
      }
    });
  }

  openBuilderModal(template?: FormTemplate) {
    if (template) {
      this.editingTemplateId.set(template.id);
      this.templateForm = {
        name: template.name,
        vendor_type: template.vendor_type || 'distributor',
        description: template.description || '',
        schema: JSON.parse(JSON.stringify(template.schema_definition || []))
      };
    } else {
      this.editingTemplateId.set(null);
      this.templateForm = {
        name: '',
        vendor_type: 'distributor',
        description: '',
        schema: this.getDefaultSchema()
      };
    }
    this.isBuilderOpen.set(true);
  }

  closeBuilderModal() {
    this.isBuilderOpen.set(false);
  }

  saveTemplate() {
    if (!this.templateForm.name.trim()) {
      this.notify.warning('Please enter a template name.');
      return;
    }
    if (this.templateForm.schema.length === 0) {
      this.notify.warning('Please add at least one field to the form.');
      return;
    }

    this.saving.set(true);
    const payload = {
      name: this.templateForm.name.trim(),
      vendor_type: this.templateForm.vendor_type,
      description: this.templateForm.description,
      schema_definition: this.templateForm.schema,
    };

    const id = this.editingTemplateId();
    const req$ = id
      ? this.http.put(`${environment.apiUrl}/admin/vendor-forms/${id}`, payload)
      : this.http.post(`${environment.apiUrl}/admin/vendor-forms`, payload);

    req$.subscribe({
      next: () => {
        this.notify.success(id ? 'Template updated successfully!' : 'Template created successfully!');
        this.saving.set(false);
        this.closeBuilderModal();
        this.loadTemplates();
      },
      error: (err) => {
        this.notify.error(err.error?.message || 'Failed to save template.');
        this.saving.set(false);
      }
    });
  }

  duplicateTemplate(template: FormTemplate) {
    const cloneName = prompt('Enter a name for the duplicated template:', `Copy of ${template.name}`);
    if (!cloneName || !cloneName.trim()) return;

    this.http.post(`${environment.apiUrl}/admin/vendor-forms/${template.id}/duplicate`, { name: cloneName.trim() }).subscribe({
      next: () => {
        this.notify.success(`Template duplicated as "${cloneName.trim()}"!`);
        this.loadTemplates();
      },
      error: () => this.notify.error('Failed to duplicate template.')
    });
  }

  deactivateTemplate(template: FormTemplate) {
    if (!confirm(`Are you sure you want to deactivate template "${template.name}"?`)) return;

    this.http.delete(`${environment.apiUrl}/admin/vendor-forms/${template.id}`).subscribe({
      next: () => {
        this.notify.success('Template deactivated.');
        this.loadTemplates();
      },
      error: () => this.notify.error('Failed to deactivate template.')
    });
  }

  previewTemplate(template: FormTemplate) {
    this.previewData = template;
    this.previewModalOpen.set(true);
  }

  // ── Field Editor Sub-modal ────────────────────────────────────────────────
  openAddFieldDialog() {
    this.editingFieldIndex.set(-1);
    this.currentField = this.createEmptyField();
    this.fieldOptionsRaw = '';
    this.isFieldModalOpen.set(true);
  }

  editField(field: FormFieldDefinition, index: number) {
    this.editingFieldIndex.set(index);
    this.currentField = JSON.parse(JSON.stringify(field));
    this.fieldOptionsRaw = (this.currentField.options || []).join(', ');
    this.isFieldModalOpen.set(true);
  }

  closeFieldModal() {
    this.isFieldModalOpen.set(false);
  }

  autoGenKey() {
    if (this.editingFieldIndex() === -1 && this.currentField.label) {
      this.currentField.field_key = this.currentField.label
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }
  }

  saveField() {
    if (!this.currentField.label.trim()) {
      this.notify.warning('Field label is required.');
      return;
    }
    if (!this.currentField.field_key.trim()) {
      this.notify.warning('Field key is required.');
      return;
    }

    if (['select', 'radio', 'checkbox'].includes(this.currentField.type)) {
      this.currentField.options = this.fieldOptionsRaw
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
    } else {
      delete this.currentField.options;
    }

    const idx = this.editingFieldIndex();
    if (idx >= 0) {
      this.templateForm.schema[idx] = { ...this.currentField };
    } else {
      this.templateForm.schema.push({ ...this.currentField, id: 'f_' + Date.now() });
    }

    this.closeFieldModal();
  }

  removeField(index: number) {
    this.templateForm.schema.splice(index, 1);
  }

  moveFieldUp(index: number) {
    if (index > 0) {
      const temp = this.templateForm.schema[index];
      this.templateForm.schema[index] = this.templateForm.schema[index - 1];
      this.templateForm.schema[index - 1] = temp;
    }
  }

  moveFieldDown(index: number) {
    if (index < this.templateForm.schema.length - 1) {
      const temp = this.templateForm.schema[index];
      this.templateForm.schema[index] = this.templateForm.schema[index + 1];
      this.templateForm.schema[index + 1] = temp;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  createEmptyField(): FormFieldDefinition {
    return {
      id: 'f_' + Date.now(),
      field_key: '',
      label: '',
      type: 'text',
      required: true,
      placeholder: '',
      help_text: '',
      target_mapping: 'custom',
    };
  }

  getDefaultSchema(): FormFieldDefinition[] {
    return [
      { id: 'f_name', field_key: 'name', label: 'Company / Vendor Legal Name', type: 'text', required: true, target_mapping: 'name' },
      { id: 'f_email', field_key: 'email', label: 'Official Email Address', type: 'email', required: true, target_mapping: 'email' },
      { id: 'f_phone', field_key: 'phone', label: 'Primary Contact Phone', type: 'phone', required: true, target_mapping: 'phone' },
      { id: 'f_pan', field_key: 'pan', label: 'PAN Number', type: 'text', required: true, target_mapping: 'pan' },
      { id: 'f_pan_doc', field_key: 'pan_doc', label: 'PAN Card Attachment', type: 'file', required: true, target_doc_type: 'pan' },
      { id: 'f_gstin', field_key: 'gstin', label: 'GSTIN', type: 'text', required: false, target_mapping: 'gstin' },
      { id: 'f_gst_doc', field_key: 'gst_doc', label: 'GST Certificate Attachment', type: 'file', required: false, target_doc_type: 'gst' },
      { id: 'f_address', field_key: 'address', label: 'Registered Office Address', type: 'textarea', required: true, target_mapping: 'address' },
    ];
  }

  getFileFieldCount(t: FormTemplate): number {
    return (t.schema_definition || []).filter(f => f.type === 'file').length;
  }

  getTemplateIcon(type?: string): string {
    switch (type) {
      case 'manufacturer': return 'precision_manufacturing';
      case 'service_provider': return 'home_repair_service';
      case 'consultant': return 'psychology';
      default: return 'inventory_2';
    }
  }

  formatVendorType(type: string): string {
    return type.replace(/_/g, ' ');
  }
}
