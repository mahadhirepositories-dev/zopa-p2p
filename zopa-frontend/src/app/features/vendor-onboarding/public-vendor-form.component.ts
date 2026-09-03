import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { environment } from '../../../environments/environment';

interface PublicFormData {
  status: string;
  token: string;
  vendor_name?: string;
  vendor_email: string;
  phone?: string;
  expires_at: string;
  tenant: { name: string; code: string };
  template: {
    id: number;
    name: string;
    description?: string;
    schema_definition: any[];
  };
}

@Component({
  selector: 'app-public-vendor-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="public-wrapper">
      <!-- Top Branding Navbar -->
      <header class="public-header">
        <div class="header-inner">
          <div class="logo-group">
            <div class="brand-badge">ZOPA</div>
            <div class="brand-text">
              <span class="brand-title">Procurement Portal</span>
              <span class="brand-sub">Vendor Onboarding System</span>
            </div>
          </div>
          @if (formData?.tenant?.name) {
            <div class="tenant-pill">
              <mat-icon>business</mat-icon>
              <span>{{ formData?.tenant?.name }}</span>
            </div>
          }
        </div>
      </header>

      <!-- Main Container -->
      <main class="main-content">
        @if (loading()) {
          <div class="card state-card">
            <mat-spinner diameter="42" />
            <h3>Loading Registration Form...</h3>
            <p>Validating secure one-time onboarding credentials.</p>
          </div>
        } @else if (errorType()) {
          <!-- ERROR / SINGLE-USE BLOCK -->
          <div class="card state-card state-card--error">
            @if (errorType() === 'already_submitted') {
              <div class="icon-circle icon-circle--success">
                <mat-icon>check</mat-icon>
              </div>
              <h2>Registration Already Completed</h2>
              <p class="state-msg">
                This onboarding registration link was already successfully submitted. For data security, onboarding links are <strong>single-use</strong> and cannot be filled more than once.
              </p>
              @if (submittedDate()) {
                <div class="info-tag">Submitted On: {{ submittedDate() }}</div>
              }
              <p class="help-foot">If you need to amend any submitted particulars, please contact the procurement department directly.</p>
            } @else if (errorType() === 'expired') {
              <div class="icon-circle icon-circle--warn">
                <mat-icon>schedule</mat-icon>
              </div>
              <h2>Invitation Link Expired</h2>
              <p class="state-msg">
                This registration link has passed its expiration window. Please contact the procurement team to request a new onboarding invitation link.
              </p>
            } @else {
              <div class="icon-circle icon-circle--error">
                <mat-icon>link_off</mat-icon>
              </div>
              <h2>Invalid Registration Link</h2>
              <p class="state-msg">
                The onboarding link is invalid or does not exist. Please check the URL received in your email or contact support.
              </p>
            }
          </div>
        } @else if (submittedSuccess()) {
          <!-- SUCCESS CONFIRMATION -->
          <div class="card state-card state-card--success">
            <div class="icon-circle icon-circle--success">
              <mat-icon>task_alt</mat-icon>
            </div>
            <h2>Registration Submitted Successfully!</h2>
            <p class="state-msg">
              Thank you, <strong>{{ formData?.vendor_name || 'Partner' }}</strong>. Your business particulars and compliance documents have been securely received.
            </p>
            <div class="success-box">
              <div class="success-row">
                <span class="lbl">Recipient Organization:</span>
                <span class="val">{{ formData?.tenant?.name }}</span>
              </div>
              <div class="success-row">
                <span class="lbl">Reference Email:</span>
                <span class="val">{{ formData?.vendor_email }}</span>
              </div>
              <div class="success-row">
                <span class="lbl">Form Template:</span>
                <span class="val">{{ formData?.template?.name }}</span>
              </div>
            </div>
            <p class="help-foot">Our procurement and compliance team will review your application. You will receive an update once your profile has been approved.</p>
          </div>
        } @else {
          <!-- ACTIVE REGISTRATION FORM -->
          <div class="card form-card">
            <div class="form-header">
              <div class="form-header-badge">
                <mat-icon>shield</mat-icon> Secure Single-Use Registration Form
              </div>
              <h1>{{ formData?.template?.name }}</h1>
              @if (formData?.template?.description) {
                <p class="form-desc">{{ formData?.template?.description }}</p>
              }
              <div class="notice-bar">
                <mat-icon>info</mat-icon>
                <span>Please ensure all information matches your official GST and PAN records. This single-use link will close automatically once submitted.</span>
              </div>
            </div>

            <form (ngSubmit)="submitForm()" class="dynamic-form">
              <div class="fields-grid">
                @for (field of formData?.template?.schema_definition; track field.id) {
                  <div class="field-wrap" [class.field-wrap--full]="field.type === 'textarea' || field.type === 'file'">
                    <label class="field-label">
                      {{ field.label }}
                      @if (field.required) {
                        <span class="req">*</span>
                      }
                    </label>

                    <!-- Textarea -->
                    @if (field.type === 'textarea') {
                      <textarea
                        class="form-ctrl"
                        rows="3"
                        [name]="field.field_key"
                        [(ngModel)]="formValues[field.field_key]"
                        [placeholder]="field.placeholder || ''"
                        [required]="field.required"
                      ></textarea>
                    }

                    <!-- Select Dropdown -->
                    @else if (field.type === 'select') {
                      <select
                        class="form-ctrl"
                        [name]="field.field_key"
                        [(ngModel)]="formValues[field.field_key]"
                        [required]="field.required"
                      >
                        <option value="" disabled selected>-- Select an option --</option>
                        @for (opt of field.options; track opt) {
                          <option [value]="opt">{{ opt }}</option>
                        }
                      </select>
                    }

                    <!-- Radio Group -->
                    @else if (field.type === 'radio') {
                      <div class="radio-options-row">
                        @for (opt of field.options; track opt) {
                          <label class="radio-opt">
                            <input
                              type="radio"
                              [name]="field.field_key"
                              [value]="opt"
                              [(ngModel)]="formValues[field.field_key]"
                              [required]="field.required"
                            />
                            <span>{{ opt }}</span>
                          </label>
                        }
                      </div>
                    }

                    <!-- Checkbox Single -->
                    @else if (field.type === 'checkbox') {
                      <label class="checkbox-opt">
                        <input
                          type="checkbox"
                          [name]="field.field_key"
                          [(ngModel)]="formValues[field.field_key]"
                        />
                        <span>{{ field.placeholder || 'Yes, I confirm this requirement' }}</span>
                      </label>
                    }

                    <!-- File Attachment Upload -->
                    @else if (field.type === 'file') {
                      <div class="file-upload-zone" [class.file-upload-zone--has-file]="fileValues[field.field_key]">
                        @if (!fileValues[field.field_key]) {
                          <input
                            type="file"
                            class="file-input"
                            [id]="field.field_key"
                            (change)="onFileSelected($event, field.field_key)"
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                            [required]="field.required"
                          />
                          <label [for]="field.field_key" class="file-drop-label">
                            <mat-icon>cloud_upload</mat-icon>
                            <span class="file-label-main">Click to upload {{ field.label }}</span>
                            <span class="file-label-sub">Accepted formats: PDF, PNG, JPG (Max 10MB)</span>
                          </label>
                        } @else {
                          <div class="file-attached-pill">
                            <mat-icon class="file-icon">description</mat-icon>
                            <div class="file-info-text">
                              <span class="name">{{ fileValues[field.field_key].name }}</span>
                              <span class="size">{{ formatFileSize(fileValues[field.field_key].size) }}</span>
                            </div>
                            <button type="button" class="remove-file-btn" (click)="removeFile(field.field_key)">
                              <mat-icon>close</mat-icon>
                            </button>
                          </div>
                        }
                      </div>
                    }

                    <!-- Default Standard Input (Text, Number, Email, Phone, Date) -->
                    @else {
                      <input
                        [type]="field.type === 'phone' ? 'tel' : field.type"
                        class="form-ctrl"
                        [name]="field.field_key"
                        [(ngModel)]="formValues[field.field_key]"
                        [placeholder]="field.placeholder || ''"
                        [required]="field.required"
                      />
                    }

                    @if (field.help_text && field.type !== 'file') {
                      <span class="field-hint">{{ field.help_text }}</span>
                    }
                  </div>
                }
              </div>

              <!-- Declaration Section -->
              <div class="declaration-box">
                <label class="declaration-label">
                  <input type="checkbox" [(ngModel)]="termsAccepted" name="terms" required />
                  <span>
                    I confirm that the information and documents uploaded are authentic, current, and legally binding. I authorize <strong>{{ formData?.tenant?.name }}</strong> to verify these credentials for procurement engagement.
                  </span>
                </label>
              </div>

              @if (submitError()) {
                <div class="error-alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ submitError() }}</span>
                </div>
              }

              <div class="form-submit-row">
                <button
                  type="submit"
                  class="submit-btn"
                  [disabled]="submitting() || !termsAccepted"
                >
                  @if (submitting()) {
                    <mat-spinner diameter="20" />
                    <span>Submitting Application...</span>
                  } @else {
                    <mat-icon>send</mat-icon>
                    <span>Submit Vendor Registration</span>
                  }
                </button>
              </div>
            </form>
          </div>
        }
      </main>

      <footer class="public-footer">
        <p>&copy; {{ currentYear }} ZOPA P2P Procurement Platform. All rights reserved &bull; Encrypted & Secure Transmission</p>
      </footer>
    </div>
  `,
  styles: [`
    .public-wrapper {
      min-height: 100vh;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
    }

    .public-header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 16px 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .header-inner {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-badge {
      background: #ea580c;
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.05em;
      padding: 6px 12px;
      border-radius: 8px;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
    }

    .tenant-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #fff7ed;
      color: #c2410c;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #ffedd5;
    }
    .tenant-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .main-content {
      flex: 1;
      max-width: 900px;
      width: 100%;
      margin: 32px auto;
      padding: 0 16px;
      box-sizing: border-box;
    }

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }

    .state-card {
      padding: 56px 32px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .state-card h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
    }
    .state-msg {
      font-size: 15px;
      color: #475569;
      max-width: 560px;
      line-height: 1.6;
      margin: 0;
    }

    .icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .icon-circle mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }
    .icon-circle--success { background: #dcfce7; color: #16a34a; }
    .icon-circle--warn { background: #fef3c7; color: #d97706; }
    .icon-circle--error { background: #fee2e2; color: #dc2626; }

    .info-tag {
      background: #f1f5f9;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 8px;
    }
    .help-foot {
      font-size: 12.5px;
      color: #94a3b8;
      margin-top: 12px;
    }

    .success-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 20px;
      width: 100%;
      max-width: 440px;
      text-align: left;
      margin: 12px 0;
    }
    .success-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .success-row:last-child { border-bottom: none; }
    .success-row .lbl { color: #64748b; }
    .success-row .val { font-weight: 600; color: #0f172a; }

    /* Active Form Styles */
    .form-card {
      padding: 32px 36px;
    }

    .form-header {
      margin-bottom: 28px;
      padding-bottom: 22px;
      border-bottom: 1px solid #e2e8f0;
    }
    .form-header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 11.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      margin-bottom: 12px;
    }
    .form-header-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .form-header h1 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
    }
    .form-desc {
      font-size: 14px;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 16px;
    }

    .notice-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fff7ed;
      border-left: 4px solid #ea580c;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      font-size: 12.5px;
      color: #9a3412;
    }
    .notice-bar mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #ea580c;
    }

    .fields-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    .field-wrap--full {
      grid-column: 1 / -1;
    }

    .field-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 6px;
    }
    .req { color: #dc2626; font-weight: 700; }

    .form-ctrl {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
      font-size: 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      color: #0f172a;
      outline: none;
      transition: all 0.15s;
    }
    .form-ctrl:focus {
      border-color: #ea580c;
      box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.12);
    }

    .field-hint {
      display: block;
      font-size: 11.5px;
      color: #64748b;
      margin-top: 4px;
    }

    .radio-options-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding: 8px 0;
    }
    .radio-opt, .checkbox-opt {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      color: #334155;
      cursor: pointer;
    }

    /* File dropzone */
    .file-upload-zone {
      position: relative;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
      padding: 20px;
      text-align: center;
      transition: all 0.2s;
    }
    .file-upload-zone:hover {
      border-color: #ea580c;
      background: #ffffff;
    }
    .file-upload-zone--has-file {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      padding: 12px 16px;
    }

    .file-input {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .file-drop-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .file-drop-label mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #ea580c;
    }
    .file-label-main {
      font-size: 13.5px;
      font-weight: 600;
      color: #1e293b;
    }
    .file-label-sub {
      font-size: 11.5px;
      color: #64748b;
    }

    .file-attached-pill {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .file-icon {
      color: #ea580c;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .file-info-text {
      flex: 1;
      text-align: left;
      display: flex;
      flex-direction: column;
    }
    .file-info-text .name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    .file-info-text .size {
      font-size: 11px;
      color: #64748b;
    }
    .remove-file-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
    }
    .remove-file-btn:hover {
      color: #dc2626;
    }

    .declaration-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .declaration-label {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 13px;
      color: #334155;
      line-height: 1.5;
      cursor: pointer;
    }
    .declaration-label input {
      margin-top: 3px;
    }

    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #b91c1c;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .form-submit-row {
      display: flex;
      justify-content: flex-end;
    }
    .submit-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ea580c;
      color: #ffffff;
      border: none;
      padding: 14px 28px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .submit-btn:hover:not(:disabled) {
      background: #c2410c;
      box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);
    }
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .public-footer {
      padding: 24px 16px;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }
  `]
})
export class PublicVendorFormComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  token: string = '';
  loading = signal(true);
  errorType = signal<string | null>(null);
  submittedDate = signal<string | null>(null);

  formData: PublicFormData | null = null;
  formValues: Record<string, any> = {};
  fileValues: Record<string, File> = {};

  termsAccepted = false;
  submitting = signal(false);
  submitError = signal<string | null>(null);
  submittedSuccess = signal(false);

  currentYear = new Date().getFullYear();

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.token = params.get('token') || '';
      if (this.token) {
        this.fetchForm();
      } else {
        this.errorType.set('not_found');
        this.loading.set(false);
      }
    });
  }

  fetchForm() {
    this.loading.set(true);
    this.http.get<PublicFormData>(`${environment.apiUrl}/vendor-onboarding/${this.token}`).subscribe({
      next: (res) => {
        this.formData = res;
        // Pre-fill fields if present
        if (res.vendor_name) this.formValues['name'] = res.vendor_name;
        if (res.vendor_email) this.formValues['email'] = res.vendor_email;
        if (res.phone) this.formValues['phone'] = res.phone;

        this.loading.set(false);
      },
      error: (err) => {
        const errCode = err.error?.error || 'not_found';
        this.errorType.set(errCode);
        if (err.error?.submitted_at) {
          this.submittedDate.set(err.error.submitted_at);
        }
        this.loading.set(false);
      }
    });
  }

  onFileSelected(event: any, fieldKey: string) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds the 10MB limit. Please choose a smaller file.');
        return;
      }
      this.fileValues[fieldKey] = file;
    }
  }

  removeFile(fieldKey: string) {
    delete this.fileValues[fieldKey];
  }

  submitForm() {
    if (!this.formData) return;
    this.submitError.set(null);

    // Validate required fields
    const schema = this.formData.template?.schema_definition || [];
    for (const f of schema) {
      if (f.required) {
        if (f.type === 'file' && !this.fileValues[f.field_key]) {
          this.submitError.set(`Please upload the required document: ${f.label}`);
          return;
        }
        if (f.type !== 'file' && !this.formValues[f.field_key]) {
          this.submitError.set(`Please fill in the required field: ${f.label}`);
          return;
        }
      }
    }

    this.submitting.set(true);

    const fd = new FormData();
    // Append standard form fields
    for (const [key, val] of Object.entries(this.formValues)) {
      if (val !== undefined && val !== null) {
        fd.append(key, String(val));
      }
    }

    // Append file attachments
    for (const [key, file] of Object.entries(this.fileValues)) {
      if (file) {
        fd.append(key, file, file.name);
      }
    }

    this.http.post(`${environment.apiUrl}/vendor-onboarding/${this.token}/submit`, fd).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submittedSuccess.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        if (err.status === 410) {
          this.errorType.set(err.error?.error || 'already_submitted');
        } else {
          this.submitError.set(err.error?.message || 'Failed to submit registration. Please try again.');
        }
      }
    });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
