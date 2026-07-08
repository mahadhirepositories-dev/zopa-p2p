import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { CategoryFormDialogComponent } from './category-form-dialog.component';
import { AuthService } from '../../core/auth/auth.service';
import { ExportService } from '../../core/services/export.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';

interface Category { id: number; name: string; parent_id?: number | null; children?: Category[]; }

// A flat row for display, with depth info
interface FlatRow { cat: Category; depth: number; isLeaf: boolean; }

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    FormsModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatCardModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <div class="page-header">
        <div>
          <h2>Categories</h2>
          <p>{{ flatRows().length }} entr{{ flatRows().length !== 1 ? 'ies' : 'y' }} across {{ categories().length }} top-level type{{ categories().length !== 1 ? 's' : '' }}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <app-search-field class="search-field" [value]="search()"
                            (valueChange)="search.set($event); onSearch()"
                            placeholder="Search categories…" />
          <button mat-stroked-button (click)="exportData()">
            <mat-icon>download</mat-icon> Export
          </button>
          @if (auth.canDo('products','create')) {
            <button mat-raised-button color="primary" (click)="openForm()" class="cta-btn">
              <mat-icon>add</mat-icon> New Category
            </button>
          }
        </div>
      </div>

      <mat-card style="overflow:hidden;">
        <mat-card-content style="padding:0!important;">
          @if (loading()) {
            <div style="display:flex;justify-content:center;padding:60px;"><mat-spinner diameter="36" /></div>
          } @else if (filteredRows().length === 0) {
            <div class="empty-state">
              <mat-icon>category</mat-icon>
              <h3>No categories found</h3>
              <p>{{ search() ? 'Try a different search term.' : 'Add your first category to organise products and services.' }}</p>
              @if (!search() && auth.canDo('products','create')) {
                <button mat-raised-button color="primary" (click)="openForm()"><mat-icon>add</mat-icon> New Category</button>
              }
            </div>
          } @else {
            <div class="tree-table">
              <!-- Header -->
              <div class="tree-header">
                <div class="col-name">Category</div>
                <div class="col-level">Level</div>
                <div class="col-children">Sub-items</div>
                <div class="col-actions"></div>
              </div>

              @for (row of filteredRows(); track row.cat.id) {
                <div class="tree-row" [class.depth-0]="row.depth===0" [class.depth-1]="row.depth===1" [class.depth-2]="row.depth===2">
                  <div class="col-name">
                    <!-- Indent + icon -->
                    <div class="name-cell" [style.padding-left.px]="row.depth * 20">
                      @if (row.depth === 0) {
                        <div class="avatar l0"><mat-icon>folder</mat-icon></div>
                      } @else if (row.depth === 1) {
                        <div class="avatar l1"><mat-icon>subdirectory_arrow_right</mat-icon></div>
                      } @else {
                        <div class="avatar l2"><mat-icon>label</mat-icon></div>
                      }
                      <span class="name-text">{{ row.cat.name }}</span>
                    </div>
                  </div>
                  <div class="col-level">
                    @if (row.depth === 0) {
                      <span class="level-badge l0">Type</span>
                    } @else if (row.depth === 1) {
                      <span class="level-badge l1">Category</span>
                    } @else {
                      <span class="level-badge l2">Sub-category</span>
                    }
                  </div>
                  <div class="col-children">
                    @if ((row.cat.children?.length ?? 0) > 0) {
                      <span class="child-count">{{ row.cat.children!.length }}</span>
                    } @else {
                      <span style="color:var(--text-3);">—</span>
                    }
                  </div>
                  <div class="col-actions">
                    @if (auth.canDo('products','edit')) {
                      <button mat-icon-button matTooltip="Edit" (click)="openForm(row.cat)">
                        <mat-icon>edit</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
    .page-header h2 { margin:0; font-size:20px; font-weight:700; color:var(--text-1); }
    .page-header p  { margin:3px 0 0; font-size:13px; color:var(--text-3); }
    .cta-btn { height:40px!important; }
    .search-field { width:220px; }
    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper { display:none; }

    /* Tree table */
    .tree-table { width: 100%; }
    .tree-header {
      display: flex; align-items: center; padding: 10px 16px;
      background: #f8fafc; border-bottom: 2px solid #e0e0e0;
      font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase;
    }
    .tree-row {
      display: flex; align-items: center; padding: 8px 16px;
      border-bottom: 1px solid #f0f0f0; transition: background 0.1s;
    }
    .tree-row:hover { background: #fafafa; }
    .tree-row.depth-0 { background: #fafcff; }
    .tree-row.depth-0:hover { background: #f0f4ff; }

    .col-name     { flex: 1; min-width: 0; }
    .col-level    { width: 110px; }
    .col-children { width: 80px; }
    .col-actions  { width: 48px; text-align: right; }

    .name-cell { display: flex; align-items: center; gap: 10px; }
    .name-text { font-size: 13px; font-weight: 500; color: var(--text-1); }

    .avatar {
      width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .avatar mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .l0 { background: #dbeafe; } .l0 mat-icon { color: #1d4ed8; }
    .l1 { background: #ede9fe; } .l1 mat-icon { color: #7c3aed; }
    .l2 { background: #dcfce7; } .l2 mat-icon { color: #16a34a; }

    .level-badge {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
    }
    .level-badge.l0 { background: #dbeafe; color: #1d4ed8; }
    .level-badge.l1 { background: #ede9fe; color: #7c3aed; }
    .level-badge.l2 { background: #dcfce7; color: #16a34a; }

    .child-count {
      display: inline-block; background: #f1f5f9; color: #64748b;
      font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 10px;
    }

    .empty-state {
      display:flex; flex-direction:column; align-items:center;
      gap:8px; padding:60px 24px; text-align:center;
    }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; color:var(--border); }
    .empty-state h3 { margin:0; font-size:16px; font-weight:600; color:var(--text-2); }
    .empty-state p  { margin:0; font-size:13px; color:var(--text-3); }
  `],
})
export class CategoryListComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  readonly auth = inject(AuthService);
  private exportService = inject(ExportService);

  categories = signal<Category[]>([]);
  loading = signal(true);
  search = signal('');

  /** Flatten the 3-level tree into ordered rows */
  flatRows = computed<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    const walk = (cats: Category[], depth: number) => {
      for (const c of cats) {
        rows.push({ cat: c, depth, isLeaf: !(c.children?.length) });
        if (c.children?.length) walk(c.children, depth + 1);
      }
    };
    walk(this.categories(), 0);
    return rows;
  });

  filteredRows = signal<FlatRow[]>([]);

  ngOnInit() { this.load(); }

  onSearch() {
    const q = this.search().toLowerCase().trim();
    if (!q) { this.filteredRows.set(this.flatRows()); return; }
    // When searching, show matching rows + their ancestors for context
    const matchIds = new Set(this.flatRows()
      .filter(r => r.cat.name.toLowerCase().includes(q))
      .map(r => r.cat.id));
    this.filteredRows.set(this.flatRows().filter(r => r.cat.name.toLowerCase().includes(q)));
  }

  load() {
    this.loading.set(true);
    this.http.get<Category[]>(`${environment.apiUrl}/categories`).subscribe({
      next: res => {
        this.categories.set(res);
        this.filteredRows.set(this.flatRows());
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openForm(cat?: Category) {
    const ref = this.dialog.open(CategoryFormDialogComponent, {
      width: '440px',
      data: { category: cat ?? null, categories: this.categories() },
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  exportData() {
    this.exportService.export('api/categories/export');
  }
}
