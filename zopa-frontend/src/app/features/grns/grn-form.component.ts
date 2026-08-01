import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

interface GrnBreakdown { grn_number: string; accepted_qty: number; received_date: string; }
interface PoItemMeta {
  id: number;
  description: string;
  qty: number;
  product?: { code?: string; hsn_code?: string };
  alreadyReceived: number;
  remaining: number;
  grnBreakdown: GrnBreakdown[];
}

@Component({
  selector: 'app-grn-form',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, DecimalPipe, DatePipe, UpperCasePipe,
    MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatCardModule,
    MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="page-wrapper">
      <div class="page-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <button mat-icon-button routerLink="/grns"><mat-icon>arrow_back</mat-icon></button>
          <h2>New GRN</h2>
        </div>
        <button mat-raised-button color="primary" [disabled]="saving() || formInvalid" (click)="save()">
          @if (saving()) { <mat-spinner diameter="18" /> } @else { Save GRN }
        </button>
      </div>

      <!-- ── Header fields ─────────────────────────────── -->
      <div class="form-section anim-1">
        <div class="section-label">GRN Details</div>
        <div class="fields-row">
          <mat-form-field appearance="outline">
            <mat-label>Purchase Order *</mat-label>
            <mat-select [formControl]="poControl" (selectionChange)="onPoSelect()">
              @for (po of releasedPos(); track po.id) {
                <mat-option [value]="po.id">
                  {{ po.po_number ?? 'PO #' + po.id }} — {{ po.vendor?.name }}
                  <span style="font-size:11px;opacity:0.6;margin-left:4px;">[{{ po.status | uppercase }}]</span>
                </mat-option>
              }
            </mat-select>
            @if (releasedPos().length === 0) {
              <mat-hint style="color:#dc2626;">No eligible POs found (need Approved / Released status)</mat-hint>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>GRN Number (Auto if blank)</mat-label>
            <input matInput [formControl]="grnNumberControl" placeholder="Auto-generated e.g. GRN-2026-0001" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Received Date *</mat-label>
            <input matInput [matDatepicker]="dp" [formControl]="dateControl" />
            <mat-datepicker-toggle matSuffix [for]="dp" />
            <mat-datepicker #dp />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Remarks</mat-label>
            <input matInput [formControl]="remarksControl" placeholder="Delivery notes / call info..." />
          </mat-form-field>
        </div>
        
        <div class="fields-row" style="margin-top: 12px;">
          <mat-form-field appearance="outline">
            <mat-label>DC Number</mat-label>
            <input matInput [formControl]="dcNumberControl" placeholder="Delivery Challan No." />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>DC Date</mat-label>
            <input matInput [matDatepicker]="dpDc" [formControl]="dcDateControl" />
            <mat-datepicker-toggle matSuffix [for]="dpDc" />
            <mat-datepicker #dpDc />
          </mat-form-field>
          <div class="file-upload-wrap">
            <label class="file-upload-btn">
              <mat-icon>cloud_upload</mat-icon> Upload Vendor GRN / Photo / PDF
              <input type="file" multiple accept="image/*,application/pdf" (change)="onFileSelect($event)" style="display:none;" />
            </label>
            @if (attachments().length > 0) {
              <div class="file-list">
                @for (file of attachments(); track file.name; let i = $index) {
                  <span class="file-badge">
                    <mat-icon>insert_drive_file</mat-icon> {{ file.name }}
                    <mat-icon (click)="removeFile(i)" title="Remove">close</mat-icon>
                  </span>
                }
              </div>
            }
          </div>
        </div>


        <div class="fields-row" style="margin-top: 12px;">
          <mat-form-field appearance="outline">
            <mat-label>Invoice Number</mat-label>
            <input matInput [formControl]="invoiceNumberControl" placeholder="Invoice No." />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Invoice Date</mat-label>
            <input matInput [matDatepicker]="dpInv" [formControl]="invoiceDateControl" />
            <mat-datepicker-toggle matSuffix [for]="dpInv" />
            <mat-datepicker #dpInv />
          </mat-form-field>
          <div></div>
        </div>
      </div>

      @if (loadingItems()) {
        <div class="spinner-row"><mat-spinner diameter="36" /></div>
      }

      @if (allFullyReceived) {
        <div class="fully-received-banner">
          <mat-icon>check_circle</mat-icon>
          <strong>All items on this PO have been fully received.</strong>
          No further GRN can be created. Select a different PO.
        </div>
      }

      @if (!loadingItems() && poItemMeta().length > 0) {
        <mat-card class="anim-2">
          <mat-card-header>
            <mat-card-title>
              <mat-icon style="vertical-align:middle;margin-right:6px;font-size:18px;color:var(--brand);">inventory_2</mat-icon>
              Line Items
            </mat-card-title>
            <div style="flex:1;"></div>

            <!-- Prior GRN context banner -->
            @if (priorGrns().length > 0) {
              <div class="prior-grn-banner">
                <mat-icon style="font-size:14px;width:14px;height:14px;">history</mat-icon>
                {{ priorGrns().length }} prior GRN{{ priorGrns().length > 1 ? 's' : '' }} for this PO:
                @for (g of priorGrns(); track g.id) {
                  <span class="grn-ref-badge"
                    [matTooltip]="'Received: ' + (g.received_date | date:'dd MMM yy')">
                    {{ g.grn_number }}
                  </span>
                }
              </div>
            }
          </mat-card-header>

          <mat-card-content style="padding:0 !important;">
            <div class="table-scroll">
              <table class="grn-table">
                <colgroup>
                  <col style="width:32px;">          <!-- # -->
                  <col style="min-width:220px;">     <!-- Item -->
                  <col style="width:90px;">          <!-- Ordered -->
                  <col style="width:110px;">         <!-- Prior Received -->
                  <col style="width:100px;">         <!-- Remaining -->
                  <col style="width:130px;">         <!-- Receive Now -->
                  <col style="width:120px;">         <!-- Accept -->
                  <col style="min-width:150px;">     <!-- Remarks -->
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th class="ta-center">Ordered</th>
                    <th class="ta-center">
                      Prior<br>Received
                      @if (priorGrns().length > 0) {
                        <mat-icon class="hdr-info"
                          matTooltip="Qty already accepted in previous GRNs. Remaining is adjusted automatically.">
                          info_outline
                        </mat-icon>
                      }
                    </th>
                    <th class="ta-center">Remaining</th>
                    <th>Receive Now *</th>
                    <th>Accept *</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of itemGroups.controls; track i; let i = $index) {
                    <tr [formGroup]="asGroup(item)"
                        [class.row-full]="(poItemMeta()[i]?.remaining ?? 1) <= 0"
                        [class.row-partial]="(poItemMeta()[i]?.alreadyReceived ?? 0) > 0 && (poItemMeta()[i]?.remaining ?? 0) > 0">

                      <!-- Row # -->
                      <td class="td-sno">{{ i + 1 }}</td>

                      <!-- Item description -->
                      <td class="td-item">
                        <div class="item-name">{{ poItemMeta()[i]?.description }}</div>
                        @if (poItemMeta()[i]?.product?.code) {
                          <div class="item-meta">Code: {{ poItemMeta()[i]?.product?.code }}</div>
                        }
                        @if (poItemMeta()[i]?.product?.hsn_code) {
                          <div class="item-meta">HSN: {{ poItemMeta()[i]?.product?.hsn_code }}</div>
                        }
                        @if ((poItemMeta()[i]?.remaining ?? 0) <= 0) {
                          <span class="badge-full">✓ Fully Received</span>
                        }
                      </td>

                      <!-- Ordered -->
                      <td class="ta-center">
                        <span class="qty-badge ordered">{{ poItemMeta()[i]?.qty | number:'1.0-3' }}</span>
                      </td>

                      <!-- Prior received (with per-GRN tooltip) -->
                      <td class="ta-center">
                        @let bd = poItemMeta()[i]?.grnBreakdown ?? [];
                        @let received = poItemMeta()[i]?.alreadyReceived ?? 0;
                        <span class="qty-badge received"
                          [class.zero]="received === 0"
                          [matTooltip]="bdTooltip(bd)"
                          matTooltipClass="grn-tooltip">
                          {{ received | number:'1.0-3' }}
                        </span>
                        @if (bd.length) {
                          <div class="bd-chips">
                            @for (b of bd; track b.grn_number) {
                              <span class="bd-chip">{{ b.grn_number }}: {{ b.accepted_qty | number:'1.0-3' }}</span>
                            }
                          </div>
                        }
                      </td>

                      <!-- Remaining -->
                      <td class="ta-center">
                        <span class="qty-badge remaining"
                          [class.zero]="(poItemMeta()[i]?.remaining ?? 0) <= 0">
                          {{ poItemMeta()[i]?.remaining | number:'1.0-3' }}
                        </span>
                      </td>

                      <!-- Receive Now -->
                      <td class="td-input">
                        @if ((poItemMeta()[i]?.remaining ?? 0) <= 0) {
                          <span class="qty-input-disabled">—</span>
                        } @else {
                          <input class="qty-input"
                            type="number" formControlName="received_qty"
                            min="0" [max]="poItemMeta()[i]?.remaining ?? 0"
                            (input)="syncAccepted(i)"
                            [class.input-error]="asGroup(item).get('received_qty')?.invalid && asGroup(item).get('received_qty')?.touched" />
                          @if (asGroup(item).get('received_qty')?.hasError('max')) {
                            <div class="input-err-msg">Max {{ poItemMeta()[i]?.remaining | number:'1.0-3' }}</div>
                          }
                        }
                      </td>

                      <!-- Accept -->
                      <td class="td-input">
                        @if ((poItemMeta()[i]?.remaining ?? 0) <= 0) {
                          <span class="qty-input-disabled">—</span>
                        } @else {
                          <input class="qty-input"
                            type="number" formControlName="accepted_qty"
                            min="0"
                            [class.input-error]="asGroup(item).get('accepted_qty')?.invalid && asGroup(item).get('accepted_qty')?.touched" />
                          <div class="input-hint">≤ Receive Now</div>
                        }
                      </td>

                      <!-- Remarks -->
                      <td class="td-remarks">
                        <input class="remarks-input" formControlName="remarks" placeholder="Optional" />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }

    /* Header form */
    .form-section {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px 24px 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,.05);
    }
    .section-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: var(--text-3); margin-bottom: 14px;
    }
    .fields-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
    }
    .fields-row mat-form-field { width: 100%; }
    .spinner-row { display:flex; justify-content:center; padding:32px; }

    .file-upload-wrap { display: flex; flex-direction: column; gap: 8px; justify-content: center; }
    .file-upload-btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
      background: #f1f5f9; color: #334155; border-radius: 6px; border: 1px dashed #cbd5e1;
      cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s;
    }
    .file-upload-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
    .file-upload-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    
    .file-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .file-badge {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;
      background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 11px; font-weight: 500;
    }
    .file-badge mat-icon { font-size: 14px; width: 14px; height: 14px; cursor: pointer; color: #0284c7; }
    .file-badge mat-icon:hover { color: #0c4a6e; }

    /* Prior GRN banner */
    .prior-grn-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 6px 12px;
      flex-wrap: wrap;
    }
    .prior-grn-banner mat-icon { color: #2563eb; }
    .grn-ref-badge {
      background: #dbeafe; color: #1e40af;
      font-size: 10px; font-weight: 700;
      padding: 2px 7px; border-radius: 99px;
      cursor: default;
    }

    /* Table */
    .table-scroll { overflow-x: auto; }
    .grn-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .grn-table thead tr {
      background: #f8fafc;
      border-bottom: 2px solid var(--border);
    }
    .grn-table th {
      padding: 10px 14px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--text-3);
      text-align: left;
      white-space: nowrap;
    }
    .grn-table th.ta-center { text-align: center; }
    .hdr-info {
      font-size: 12px !important;
      width: 12px !important;
      height: 12px !important;
      vertical-align: middle;
      margin-left: 3px;
      color: #94a3b8;
      cursor: help;
    }

    .grn-table tbody tr { border-bottom: 1px solid #f0f4f8; }
    .grn-table tbody tr:hover { background: #fafbff; }
    .grn-table td { padding: 10px 14px; vertical-align: middle; }

    .row-full    { background: #f0fdf4 !important; opacity: .8; }
    .row-partial { background: #fefce8; }

    .td-sno   { color: var(--text-3); font-size: 12px; text-align: center; width: 32px; }
    .td-item  { min-width: 200px; }
    .ta-center { text-align: center; }

    .item-name { font-weight: 600; color: var(--text-1); }
    .item-meta { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .badge-full {
      display: inline-block; background: #dcfce7; color: #15803d;
      font-size: 10px; font-weight: 700; padding: 1px 7px;
      border-radius: 99px; margin-top: 4px;
    }

    /* Qty badges */
    .qty-badge {
      display: inline-block; padding: 3px 10px; border-radius: 99px;
      font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
      min-width: 44px; text-align: center;
    }
    .qty-badge.ordered   { background: #eff6ff; color: #1d4ed8; }
    .qty-badge.received  { background: #fff7ed; color: #c2410c; cursor: default; }
    .qty-badge.received.zero { background: #f1f5f9; color: #94a3b8; }
    .qty-badge.remaining { background: #f0fdf4; color: #15803d; }
    .qty-badge.remaining.zero { background: #fff1f2; color: #dc2626; }

    /* Per-GRN breakdown chips */
    .bd-chips { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; align-items: center; }
    .bd-chip {
      font-size: 9px; color: #64748b; background: #f1f5f9;
      padding: 1px 5px; border-radius: 4px; white-space: nowrap;
    }

    /* Input cells */
    .td-input { width: 130px; }
    .td-remarks { min-width: 150px; }

    .qty-input, .remarks-input {
      width: 100%;
      padding: 7px 10px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      font-size: 13px;
      color: var(--text-1);
      background: #ffffff;
      outline: none;
      box-sizing: border-box;
      transition: border-color .18s ease;
      font-family: inherit;
    }
    .qty-input:focus, .remarks-input:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(249,115,22,.12);
    }
    .qty-input.input-error { border-color: #dc2626; }
    .qty-input { text-align: right; }
    .remarks-input { text-align: left; }

    .input-err-msg { font-size: 10px; color: #dc2626; margin-top: 2px; }
    .input-hint    { font-size: 10px; color: var(--text-3); margin-top: 2px; }

    /* Fully-received banner */
    .fully-received-banner {
      display:flex; align-items:center; gap:10px;
      background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px;
      padding:14px 20px; margin-bottom:20px;
      font-size:13px; color:#15803d;
    }
    .fully-received-banner mat-icon { flex-shrink:0; color:#16a34a; }

    /* Disabled input placeholder for fully-received rows */
    .qty-input-disabled {
      display:block; text-align:center;
      color:#94a3b8; font-size:16px; padding:6px 0;
    }

    /* Remove number spinners */
    .qty-input::-webkit-inner-spin-button,
    .qty-input::-webkit-outer-spin-button { -webkit-appearance: none; }
    .qty-input { -moz-appearance: textfield; }
  `],
})
export class GrnFormComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notify = inject(NotificationService);

  releasedPos  = signal<any[]>([]);
  poItemMeta   = signal<PoItemMeta[]>([]);
  priorGrns    = signal<any[]>([]);
  loadingItems = signal(false);
  saving       = signal(false);

  poControl          = this.fb.control<number | null>(null, Validators.required);
  grnNumberControl   = this.fb.control<string>('');
  dateControl        = this.fb.control<Date | null>(new Date(), Validators.required);
  dcNumberControl    = this.fb.control<string>('');
  dcDateControl      = this.fb.control<Date | null>(null);
  invoiceNumberControl = this.fb.control<string>('');
  invoiceDateControl = this.fb.control<Date | null>(null);
  remarksControl     = this.fb.control('');

  
  attachments = signal<File[]>([]);

  itemGroups: FormArray<FormGroup> = this.fb.array<FormGroup>([]);

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.attachments.update(curr => [...curr, ...newFiles].slice(0, 5)); // max 5 files
    }
  }

  removeFile(index: number) {
    this.attachments.update(curr => {
      const arr = [...curr];
      arr.splice(index, 1);
      return arr;
    });
  }

  get formInvalid() {
    if (!this.poControl.value || !this.dateControl.value) return true;
    if (this.itemGroups.length === 0) return true;
    // Check enabled controls are valid (disabled ones are excluded from .invalid)
    const enabledInvalid = this.itemGroups.controls.some(ctrl => {
      const g = ctrl as FormGroup;
      return !g.get('received_qty')?.disabled && g.invalid;
    });
    if (enabledInvalid) return true;
    // Must have at least one item with received_qty > 0 (use getRawValue to include disabled)
    const hasReceivable = this.itemGroups.getRawValue().some(
      (item: any) => Number(item.received_qty ?? 0) > 0
    );
    return !hasReceivable;
  }

  /** True when every item on this PO has already been fully received */
  get allFullyReceived() {
    return this.poItemMeta().length > 0 &&
      this.poItemMeta().every(m => m.remaining <= 0);
  }

  asGroup(ctrl: any): FormGroup { return ctrl as FormGroup; }

  ngOnInit() {
    const poIdParam = this.route.snapshot.queryParamMap.get('po_id') || this.route.snapshot.queryParamMap.get('po');
    const params = 'statuses[]=released&statuses[]=delivered&statuses[]=partially_delivered&statuses[]=approved&statuses[]=invoiced&statuses[]=payment_released&grn_eligible=1&per_page=500';
    this.http.get<any>(`${environment.apiUrl}/purchase-orders?${params}`).subscribe(res => {
      const pos: any[] = res.data ?? res;
      this.releasedPos.set(pos);
      if (poIdParam) {
        const targetId = +poIdParam;
        const found = pos.find(p => p.id === targetId);
        if (!found) {
          this.http.get<any>(`${environment.apiUrl}/purchase-orders/${targetId}`).subscribe(singlePo => {
            if (singlePo) {
              this.releasedPos.update(curr => [singlePo, ...curr]);
              this.poControl.setValue(singlePo.id);
              this.onPoSelect();
            }
          });
        } else {
          this.poControl.setValue(found.id);
          this.onPoSelect();
        }
      }
    });
  }

  onPoSelect() {
    const poId = this.poControl.value;
    if (!poId) return;

    this.loadingItems.set(true);
    this.poItemMeta.set([]);
    this.priorGrns.set([]);
    this.itemGroups.clear();

    forkJoin({
      po:   this.http.get<any>(`${environment.apiUrl}/purchase-orders/${poId}`),
      grns: this.http.get<any>(`${environment.apiUrl}/purchase-orders/${poId}/grns`),
    }).subscribe({
      next: ({ po, grns }) => {
        const grnList: any[] = Array.isArray(grns) ? grns : (grns.data ?? []);
        this.priorGrns.set(grnList);

        // Build per-item received map + per-GRN breakdown
        const receivedMap:  Record<number, number>          = {};
        const breakdownMap: Record<number, GrnBreakdown[]>  = {};

        for (const grn of grnList) {
          for (const grnItem of (grn.items ?? [])) {
            const pid = grnItem.po_item_id;
            receivedMap[pid]  = (receivedMap[pid] ?? 0) + Number(grnItem.accepted_qty ?? 0);
            breakdownMap[pid] = breakdownMap[pid] ?? [];
            breakdownMap[pid].push({
              grn_number:   grn.grn_number ?? `GRN #${grn.id}`,
              accepted_qty: Number(grnItem.accepted_qty ?? 0),
              received_date: grn.received_date,
            });
          }
        }

        const meta: PoItemMeta[] = (po.items ?? []).map((item: any) => {
          const alreadyReceived = receivedMap[item.id] ?? 0;
          const remaining = Math.max(0, Number(item.qty) - alreadyReceived);
          return {
            id: item.id,
            description: item.description,
            qty: Number(item.qty),
            product: item.product,
            alreadyReceived,
            remaining,
            grnBreakdown: breakdownMap[item.id] ?? [],
          };
        });

        this.poItemMeta.set(meta);
        this.itemGroups.clear();

        meta.forEach(m => {
          const fullyReceived = m.remaining <= 0;
          const group = this.fb.group({
            po_item_id:   [m.id, Validators.required],
            received_qty: [fullyReceived ? 0 : m.remaining, [Validators.required, Validators.min(0), Validators.max(m.remaining)]],
            accepted_qty: [fullyReceived ? 0 : m.remaining, [Validators.required, Validators.min(0)]],
            remarks:      [''],
          });
          if (fullyReceived) {
            group.get('received_qty')?.disable();
            group.get('accepted_qty')?.disable();
          }
          this.itemGroups.push(group);
        });

        this.loadingItems.set(false);
      },
      error: () => {
        this.notify.error('Could not load PO items.');
        this.loadingItems.set(false);
      },
    });
  }

  syncAccepted(i: number) {
    const received = Number(this.itemGroups.at(i).value.received_qty ?? 0);
    this.itemGroups.at(i).patchValue({ accepted_qty: received });
    // Dynamically tighten the max validator on accepted_qty
    this.itemGroups.at(i).get('accepted_qty')?.setValidators([
      Validators.required, Validators.min(0), Validators.max(received),
    ]);
    this.itemGroups.at(i).get('accepted_qty')?.updateValueAndValidity();
  }

  bdTooltip(bd: GrnBreakdown[]): string {
    if (!bd.length) return '';
    return bd.map(b => `${b.grn_number}: ${b.accepted_qty} units (${b.received_date})`).join('\n');
  }

  save() {
    if (this.formInvalid) return;
    this.saving.set(true);
    // getRawValue() includes disabled controls; filter to only items actually being received
    const allItems = this.itemGroups.getRawValue();
    const receivableItems = allItems.filter(
      (item: any) => Number(item.received_qty ?? 0) > 0
    );

    const payload = {
      po_id: this.poControl.value,
      grn_number: this.grnNumberControl.value?.trim() || undefined,
      received_date: this.dateControl.value instanceof Date
        ? this.dateControl.value.toISOString().split('T')[0]
        : this.dateControl.value,
      dc_number: this.dcNumberControl.value,

      dc_date: this.dcDateControl.value instanceof Date ? this.dcDateControl.value.toISOString().split('T')[0] : this.dcDateControl.value,
      invoice_number: this.invoiceNumberControl.value,
      invoice_date: this.invoiceDateControl.value instanceof Date ? this.invoiceDateControl.value.toISOString().split('T')[0] : this.invoiceDateControl.value,
      remarks: this.remarksControl.value,
      items: receivableItems,
    };
    
    this.http.post<any>(`${environment.apiUrl}/grns`, payload).subscribe({
      next: grn => {
        const files = this.attachments();
        if (files.length > 0) {
          const uploads = files.map(file => {
            const formData = new FormData();
            formData.append('file', file);
            return this.http.post(`${environment.apiUrl}/grns/${grn.id}/upload`, formData);
          });
          forkJoin(uploads).subscribe({
            next: () => {
              this.notify.success('GRN saved with attachments.');
              this.router.navigate(['/grns', grn.id]);
            },
            error: () => {
              this.notify.error('GRN saved, but attachments failed.');
              this.router.navigate(['/grns', grn.id]);
            }
          });
        } else {
          this.notify.success('GRN saved.');
          this.router.navigate(['/grns', grn.id]);
        }
      },
      error: err => { this.notify.error(err.error?.message ?? 'Save failed.'); this.saving.set(false); },
    });
  }
}
