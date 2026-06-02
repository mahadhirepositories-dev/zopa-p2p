import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface SearchSelectOption {
  id: number;
  name: string;
  sub?: string;
  badge?: string;
  badgeAccent?: 'orange' | 'purple' | 'green' | 'gray';
}

export interface SearchSelectData {
  title?: string;
  options: SearchSelectOption[];
  currentId?: number | null;
  searchPlaceholder?: string;
}

/**
 * Generic command-palette picker: a focused search box filtering a scrollable
 * list with full keyboard navigation (↑/↓ move, Enter select, Esc close).
 * Built to scale to hundreds of options. Returns the chosen option id.
 * Used by the org switcher and the ZOPA dashboard organization filter.
 */
@Component({
  selector: 'app-search-select-dialog',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  template: `
    <div class="ssd">
      <div class="ssd-search">
        <mat-icon>search</mat-icon>
        <input #searchInput type="text" [ngModel]="query()" (ngModelChange)="onQuery($event)"
               (keydown)="onKeydown($event)"
               [placeholder]="data.searchPlaceholder || ('Search ' + total() + '…')" autocomplete="off" />
        @if (query()) {
          <button class="ssd-clear" type="button" (click)="clear()" aria-label="Clear"><mat-icon>close</mat-icon></button>
        }
      </div>

      <div class="ssd-list" #list>
        @for (o of filtered(); track o.id; let i = $index) {
          <button type="button" class="ssd-item"
                  [class.ssd-item--active]="i === activeIndex()"
                  (click)="select(o)" (mouseenter)="activeIndex.set(i)">
            <span class="ssd-avatar" [attr.data-accent]="o.badgeAccent || 'orange'">{{ initial(o) }}</span>
            <span class="ssd-info">
              <span class="ssd-name">{{ o.name }}</span>
              @if (o.sub) { <span class="ssd-sub">{{ o.sub }}</span> }
            </span>
            @if (o.badge) {
              <span class="ssd-badge" [attr.data-accent]="o.badgeAccent || 'gray'">{{ o.badge }}</span>
            }
            @if (o.id === data.currentId) { <mat-icon class="ssd-check">check_circle</mat-icon> }
          </button>
        } @empty {
          <div class="ssd-empty">
            <mat-icon>search_off</mat-icon>
            <span>No matches for “{{ query() }}”.</span>
          </div>
        }
      </div>

      <div class="ssd-footer">
        <span>{{ filtered().length }} of {{ total() }}</span>
        <span class="ssd-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> select · <kbd>esc</kbd> close</span>
      </div>
    </div>
  `,
  styles: [`
    .ssd { display: flex; flex-direction: column; max-height: 70vh; }
    .ssd-search { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border, #e2e8f0); }
    .ssd-search > mat-icon { color: #94a3b8; flex-shrink: 0; }
    .ssd-search input { flex: 1; border: 0; outline: none; font-size: 15px; color: #0f172a; background: transparent; }
    .ssd-clear { border: 0; background: transparent; cursor: pointer; color: #94a3b8; display: flex; padding: 2px; }
    .ssd-clear mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .ssd-list { overflow-y: auto; padding: 6px; flex: 1; }
    .ssd-item { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer; padding: 9px 12px; border-radius: 10px; transition: background .1s; }
    .ssd-item--active { background: var(--brand-light, #fff1e6); }
    .ssd-avatar { width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; background: #fff1e6; color: #f97316; }
    .ssd-avatar[data-accent="purple"] { background: #f5f3ff; color: #6d28d9; }
    .ssd-avatar[data-accent="green"]  { background: #dcfce7; color: #16a34a; }
    .ssd-avatar[data-accent="gray"]   { background: #f1f5f9; color: #64748b; }
    .ssd-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .ssd-name { font-size: 14px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ssd-sub { font-size: 12px; color: #94a3b8; }
    .ssd-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 2px 7px; border-radius: 999px; flex-shrink: 0; background: #fff7ed; color: #b45309; }
    .ssd-badge[data-accent="purple"] { background: #f5f3ff; color: #6d28d9; }
    .ssd-badge[data-accent="green"]  { background: #dcfce7; color: #16a34a; }
    .ssd-badge[data-accent="gray"]   { background: #f1f5f9; color: #64748b; }
    .ssd-check { color: #16a34a; flex-shrink: 0; }

    .ssd-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px 16px; color: #94a3b8; font-size: 14px; }
    .ssd-empty mat-icon { font-size: 34px; width: 34px; height: 34px; opacity: .5; }

    .ssd-footer { display: flex; justify-content: space-between; align-items: center; padding: 9px 16px; border-top: 1px solid var(--border, #e2e8f0); font-size: 11.5px; color: #94a3b8; }
    .ssd-hint kbd { font-family: inherit; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0 5px; margin: 0 1px; font-size: 10.5px; color: #64748b; }
  `],
})
export class SearchSelectDialogComponent {
  readonly data = inject<SearchSelectData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<SearchSelectDialogComponent, number>);
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private listEl = viewChild<ElementRef<HTMLElement>>('list');

  query = signal('');
  activeIndex = signal(0);

  total = computed(() => this.data.options.length);

  filtered = computed<SearchSelectOption[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.data.options;
    return this.data.options.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.sub ?? '').toLowerCase().includes(q) ||
      (o.badge ?? '').toLowerCase().includes(q),
    );
  });

  onQuery(value: string) {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  clear() {
    this.query.set('');
    this.activeIndex.set(0);
    this.searchInput()?.nativeElement.focus();
  }

  initial(o: SearchSelectOption): string {
    return (o.name?.[0] ?? '?').toUpperCase();
  }

  onKeydown(e: KeyboardEvent) {
    const items = this.filtered();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex.update(i => Math.min(i + 1, items.length - 1));
      this.scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex.update(i => Math.max(i - 1, 0));
      this.scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = items[this.activeIndex()];
      if (o) this.select(o);
    }
  }

  select(o: SearchSelectOption) {
    this.ref.close(o.id);
  }

  private scrollActiveIntoView() {
    const list = this.listEl()?.nativeElement;
    const el = list?.querySelectorAll('.ssd-item')[this.activeIndex()] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }
}
