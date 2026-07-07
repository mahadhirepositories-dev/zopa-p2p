import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { Budget, Location } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { BulkImportService } from '../../core/services/bulk-import.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-pr-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCardModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatDatepickerModule, MatNativeDateModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div>
          <h2>{{ isEditMode() ? 'Edit' : 'New' }} Purchase Requisition</h2>
          <p>{{ isEditMode() ? 'Modify your requisition' : 'Request items for procurement' }}</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save(false)" class="form-grid">

        <!-- Left column -->
        <div class="left-col">
          <mat-card class="form-card">
            <mat-card-header><mat-card-title>Requisition Details</mat-card-title></mat-card-header>
            <mat-card-content>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Title *</mat-label>
                <input matInput formControlName="title" placeholder="e.g. Office Supplies Q3" />
              </mat-form-field>

              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Cost Center *</mat-label>
                  <mat-select formControlName="cost_center_id" (selectionChange)="onCostCenterChange()">
                    @for (cc of costCenters(); track cc.id) {
                      <mat-option [value]="cc.id">{{ cc.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="low">Low</mat-option>
                    <mat-option value="normal">Normal</mat-option>
                    <mat-option value="high">High</mat-option>
                    <mat-option value="urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              @if (budget()) {
                <div class="budget-banner" [class.budget-warn]="budgetWarn()">
                  <mat-icon>{{ budgetWarn() ? 'warning' : 'account_balance_wallet' }}</mat-icon>
                  <div style="flex:1;">
                    <div style="font-size:12px;">
                      <strong>Budget:</strong> ₹{{ budget()!.available | number:'1.0-0' }} available
                      of ₹{{ budget()!.annual | number:'1.0-0' }}
                    </div>
                    <div style="font-size:11px;opacity:.8;">
                      Frozen: ₹{{ budget()!.frozen | number:'1.0-0' }} &nbsp;·&nbsp;
                      Consumed: ₹{{ budget()!.consumed | number:'1.0-0' }}
                    </div>
                    <mat-progress-bar mode="determinate" [value]="budgetUsed()"
                      [color]="budgetWarn() ? 'warn' : 'primary'"
                      style="margin-top:4px;" />
                  </div>
                </div>
              }

              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Project</mat-label>
                  <mat-select formControlName="project_id">
                    <mat-option [value]="null">— None —</mat-option>
                    @for (p of projects(); track p.id) {
                      <mat-option [value]="p.id">{{ p.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Delivery Location</mat-label>
                  <mat-select formControlName="location_id" (selectionChange)="onLocationChange()">
                    <mat-option [value]="null">— None —</mat-option>
                    @for (l of locations(); track l.id) {
                      <mat-option [value]="l.id">{{ l.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              @if (selectedLocation(); as d) {
                <div class="addr-card">
                  <div class="addr-head"><mat-icon>place</mat-icon> Delivery Address</div>
                  <div class="addr-name">{{ d.name }}</div>
                  @if (d.address) { <div>{{ d.address }}</div> }
                  @if (addrLine(d)) { <div>{{ addrLine(d) }}</div> }
                  @if (d.country) { <div>{{ d.country }}</div> }
                  @if (d.gstin) { <div class="addr-gstin">GSTIN: {{ d.gstin }}</div> }
                </div>
              }

              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Required By Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="required_by_date" />
                  <mat-datepicker-toggle matIconSuffix [for]="picker" />
                  <mat-datepicker #picker />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Required By Person</mat-label>
                  <input matInput formControlName="required_by_person" placeholder="Who needs this?" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full">
                <mat-label>Description / Justification</mat-label>
                <textarea matInput formControlName="description" rows="3"
                          placeholder="Provide context for the procurement team"></textarea>
              </mat-form-field>

            </mat-card-content>
          </mat-card>
        </div>

        <!-- Right: Items -->
        <div class="right-col">
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>Line Items</mat-card-title>
              <button type="button" mat-stroked-button (click)="downloadBoqTemplate()"
                      matTooltip="Download the BOQ (line items) Excel template" style="margin-left:auto;">
                <mat-icon>download</mat-icon> BOQ Template
              </button>
              <button type="button" mat-stroked-button [disabled]="boqUploading()" (click)="boqInput.click()"
                      matTooltip="Bulk upload line items from a filled-in BOQ template" style="margin-left:8px;">
                @if (boqUploading()) { <mat-spinner diameter="18" /> } @else { <mat-icon>upload_file</mat-icon> }
                Upload BOQ
              </button>
              <input #boqInput type="file" hidden accept=".xlsx,.xls,.csv" (change)="uploadBoq($event)" />
              <button type="button" mat-stroked-button (click)="addItem()" style="margin-left:8px;">
                <mat-icon>add</mat-icon> Add Item
              </button>
            </mat-card-header>
            <mat-card-content>

              <div formArrayName="items">
                @for (item of items.controls; track $index) {
                  <div [formGroupName]="$index" class="item-row">
                    <div class="item-num">{{ $index + 1 }}</div>

                    <div class="item-fields">
                      <mat-form-field appearance="outline" class="full">
                        <mat-label>Description *</mat-label>
                        <input matInput formControlName="description" />
                      </mat-form-field>

                      <div class="three-col">
                        <mat-form-field appearance="outline">
                          <mat-label>Qty *</mat-label>
                          <input matInput type="number" formControlName="qty" min="0.001" step="1" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Unit</mat-label>
                          <input matInput formControlName="unit" placeholder="nos" />
                        </mat-form-field>

                        <mat-form-field appearance="outline">
                          <mat-label>Est. Price (₹)</mat-label>
                          <input matInput type="number" formControlName="estimated_price" min="0" />
                        </mat-form-field>
                      </div>

                      <mat-form-field appearance="outline" class="full">
                        <mat-label>Remarks</mat-label>
                        <input matInput formControlName="remarks" />
                      </mat-form-field>
                    </div>

                    <button type="button" mat-icon-button (click)="removeItem($index)" class="remove-btn"
                            [disabled]="items.length <= 1">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                }
              </div>

              <!-- Totals -->
              <div class="totals-row">
                <span>Estimated Total</span>
                <strong>₹{{ estimatedTotal() | number:'1.0-0' }}</strong>
              </div>

            </mat-card-content>
          </mat-card>

          <!-- Actions -->
          <div class="action-row">
            <button type="button" mat-stroked-button (click)="cancel()">Cancel</button>
            <button type="submit" mat-raised-button color="primary" [disabled]="saving()">
              @if (saving()) { <mat-spinner diameter="16" style="margin-right:6px;" /> }
              Save as Draft
            </button>
            <button type="button" mat-raised-button style="background:#16a34a;color:white;"
                    (click)="save(true)" [disabled]="saving()">
              <mat-icon>send</mat-icon> Submit PR
            </button>
          </div>
        </div>

      </form>
    </div>
  `,
  styles: [`
    .page-wrapper { padding:28px; }
    .page-header { margin-bottom:24px; }
    .page-header h2 { margin:0;font-size:20px;font-weight:700; }
    .page-header p  { margin:3px 0 0;font-size:13px;color:var(--text-3); }
    .form-grid { display:grid;grid-template-columns:1fr 1.2fr;gap:20px;align-items:start; }
    @media (max-width:900px) { .form-grid { grid-template-columns:1fr; } }
    .form-card mat-card-content { display:flex;flex-direction:column;gap:12px;padding-top:16px!important; }
    .form-card mat-card-header { padding-bottom:0!important;display:flex;align-items:center; }
    .full { width:100%; }
    .two-col { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
    .three-col { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }
    .item-row { display:flex;gap:10px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border); }
    .item-row:last-of-type { border-bottom:none; }
    .item-num { width:24px;height:24px;border-radius:6px;background:var(--brand-light);color:var(--brand);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:12px; }
    .item-fields { flex:1;display:flex;flex-direction:column;gap:6px; }
    .remove-btn { flex-shrink:0;margin-top:4px;color:var(--text-3)!important; }
    .totals-row { display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:2px solid var(--border);font-size:14px;font-weight:600;color:var(--text-1); }
    .action-row { display:flex;justify-content:flex-end;gap:10px;margin-top:16px;flex-wrap:wrap; }
    .left-col, .right-col { display:flex;flex-direction:column;gap:16px; }
    .budget-banner {
      display:flex;align-items:flex-start;gap:10px;padding:10px 14px;
      border-radius:10px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;
      font-size:13px;margin-bottom:4px;
    }
    .budget-banner.budget-warn { background:#fff7ed;border-color:#fed7aa;color:#c2410c; }
    .budget-banner mat-icon { flex-shrink:0;margin-top:2px;font-size:18px;width:18px;height:18px; }

    .addr-card { background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:12.5px;color:#475569;line-height:1.55; }
    .addr-head { display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1565c0;margin-bottom:6px; }
    .addr-head mat-icon { font-size:15px;width:15px;height:15px; }
    .addr-name { font-weight:700;color:#1e293b;font-size:13px; }
    .addr-gstin { margin-top:3px;font-weight:600;color:#334155; }
  `],
})
export class PrFormComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);
  private bulk = inject(BulkImportService);
  boqUploading = signal(false);

  isEditMode = signal(false);
  prId = signal<number | null>(null);

  costCenters = signal<any[]>([]);
  projects    = signal<any[]>([]);
  locations   = signal<Location[]>([]);
  selectedLocation = signal<Location | null>(null);
  saving      = signal(false);
  budget      = signal<Budget | null>(null);

  budgetWarn = computed(() => {
    const b = this.budget();
    if (!b || !b.annual) return false;
    return b.available / b.annual < 0.1;
  });

  budgetUsed = computed(() => {
    const b = this.budget();
    if (!b || !b.annual) return 0;
    return Math.min(100, ((b.consumed + b.frozen) / b.annual) * 100);
  });

  form = this.fb.group({
    title: ['', Validators.required],
    cost_center_id: [null as number|null, Validators.required],
    project_id: [null as number|null],
    location_id: [null as number|null],
    priority: ['normal'],
    required_by_date: [null as Date|null],
    required_by_person: [''],
    description: [''],
    items: this.fb.array([this.newItem()]),
  });

  get items(): FormArray { return this.form.get('items') as FormArray; }

  estimatedTotal(): number {
    return this.items.controls.reduce((sum, ctrl) => {
      const qty = Number(ctrl.get('qty')?.value ?? 0);
      const price = Number(ctrl.get('estimated_price')?.value ?? 0);
      return sum + qty * price;
    }, 0);
  }

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/cost-centers`).subscribe(r => this.costCenters.set(r.data ?? r));
    this.http.get<any>(`${environment.apiUrl}/projects`).subscribe(r => this.projects.set(r));
    this.http.get<any>(`${environment.apiUrl}/locations`).subscribe(r => this.locations.set(r));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode.set(true);
      this.prId.set(+idParam);
      this.loadPr(+idParam);
    }
  }

  loadPr(id: number) {
    this.http.get<any>(`${environment.apiUrl}/purchase-requisitions/${id}`).subscribe({
      next: (pr) => {
        this.form.patchValue({
          title: pr.title,
          cost_center_id: pr.cost_center_id,
          project_id: pr.project_id,
          location_id: pr.location_id,
          priority: pr.priority,
          required_by_date: pr.required_by_date,
          required_by_person: pr.required_by_person,
          description: pr.description,
        });

        if (pr.cost_center_id) this.onCostCenterChange();
        if (pr.location_id) this.onLocationChange();

        if (pr.items && pr.items.length > 0) {
          this.items.clear();
          pr.items.forEach((it: any) => {
            const group = this.newItem();
            group.patchValue({
              description: it.description,
              qty: it.qty,
              unit: it.unit,
              estimated_price: it.estimated_price,
              remarks: it.remarks,
            });
            this.items.push(group);
          });
        }
      },
      error: () => this.notify.error('Failed to load PR details'),
    });
  }

  onCostCenterChange() {
    const ccId = this.form.value.cost_center_id;
    if (!ccId) { this.budget.set(null); return; }
    this.http.get<Budget>(`${environment.apiUrl}/cost-centers/${ccId}/budget`)
      .subscribe(b => this.budget.set(b));
  }

  newItem() {
    return this.fb.group({
      description: ['', Validators.required],
      qty: [1, [Validators.required, Validators.min(0.001)]],
      unit: ['nos'],
      estimated_price: [0],
      remarks: [''],
    });
  }

  addItem() { this.items.push(this.newItem()); }
  removeItem(i: number) { if (this.items.length > 1) this.items.removeAt(i); }

  onLocationChange() {
    const id = this.form.get('location_id')!.value;
    this.selectedLocation.set(this.locations().find(l => l.id === id) ?? null);
  }

  /** "City, State - Pincode" line for the address preview (State Code omitted). */
  addrLine(loc: Location | null): string {
    if (!loc) return '';
    const cityState = [loc.city, loc.state].filter(Boolean).join(', ');
    return loc.pincode ? (cityState ? `${cityState} - ${loc.pincode}` : `${loc.pincode}`) : cityState;
  }

  downloadBoqTemplate() {
    this.bulk.downloadTemplate('boq/template?type=pr', 'pr-boq-template.xlsx').subscribe({
      next: blob => this.bulk.saveBlob(blob, 'pr-boq-template.xlsx'),
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
    fd.append('type', 'pr');
    this.http.post<{ items: any[]; errors: string[] }>(`${environment.apiUrl}/boq/parse`, fd).subscribe({
      next: res => {
        this.boqUploading.set(false);
        // Drop the initial blank row if it's still empty, then append parsed rows.
        if (this.items.length === 1 && !this.items.at(0).value.description) {
          this.items.removeAt(0);
        }
        (res.items ?? []).forEach(it => {
          const g = this.newItem();
          g.patchValue({
            description: it.description,
            qty: it.qty,
            unit: it.unit ?? 'nos',
            estimated_price: it.estimated_price ?? 0,
            remarks: it.remarks ?? '',
          });
          this.items.push(g);
        });
        if (this.items.length === 0) this.items.push(this.newItem());
        const added = res.items?.length ?? 0;
        this.notify.success(`${added} line item(s) added from BOQ.`
          + (res.errors?.length ? ` ${res.errors.length} row(s) skipped.` : ''));
        if (res.errors?.length) this.notify.error(res.errors.slice(0, 5).join(' | '));
      },
      error: err => {
        this.boqUploading.set(false);
        this.notify.error(err.error?.message ?? 'Could not read the BOQ file.');
      },
    });
    input.value = '';
  }

  save(submit: boolean) {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);

    const body = {
      ...this.form.value,
      items: this.items.value,
    };

    const req = this.isEditMode() 
      ? this.http.put<any>(`${environment.apiUrl}/purchase-requisitions/${this.prId()}`, body)
      : this.http.post<any>(`${environment.apiUrl}/purchase-requisitions`, body);

    req.subscribe({
      next: pr => {
        if (submit) {
          this.http.post(`${environment.apiUrl}/purchase-requisitions/${pr.id}/submit`, {}).subscribe({
            next: () => {
              this.notify.success('PR submitted successfully');
              this.router.navigate(['/purchase-requisitions', pr.id]);
            },
            error: e => { this.notify.error(e.error?.error ?? 'Submit failed'); this.saving.set(false); },
          });
        } else {
          this.notify.success(`PR ${this.isEditMode() ? 'updated' : 'saved as draft'}`);
          this.router.navigate(['/purchase-requisitions', pr.id]);
        }
      },
      error: e => { this.notify.error(e.error?.error ?? 'Save failed'); this.saving.set(false); },
    });
  }

  cancel() { this.router.navigate(['/purchase-requisitions']); }
}
