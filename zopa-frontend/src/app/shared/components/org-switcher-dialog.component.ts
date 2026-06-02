import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContext } from '../../core/models';

/**
 * Command-palette style organization switcher. Built for users who belong to
 * many (100+) organizations: a focused search box filters a scrollable list,
 * with full keyboard navigation (↑/↓ to move, Enter to switch, Esc to close).
 * Returns the chosen tenant_id via the dialog result.
 */
@Component({
  selector: 'app-org-switcher-dialog',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  template: `
    <div class="osw">
      <div class="osw-search">
        <mat-icon>search</mat-icon>
        <input #searchInput type="text" [ngModel]="query()" (ngModelChange)="onQuery($event)"
               (keydown)="onKeydown($event)"
               [placeholder]="'Search ' + total() + ' organizations…'" autocomplete="off" />
        @if (query()) {
          <button class="osw-clear" type="button" (click)="clear()" aria-label="Clear"><mat-icon>close</mat-icon></button>
        }
      </div>

      <div class="osw-list" #list>
        @for (c of filtered(); track c.tenant_id; let i = $index) {
          <button type="button" class="osw-item"
                  [class.osw-item--active]="i === activeIndex()"
                  [class.osw-item--current]="c.tenant_id === currentId()"
                  (click)="select(c)" (mouseenter)="activeIndex.set(i)">
            <span class="osw-avatar" [class.osw-avatar--internal]="c.is_internal">{{ initial(c) }}</span>
            <span class="osw-info">
              <span class="osw-name">{{ c.tenant_name }}</span>
              <span class="osw-meta">
                {{ roleLabel(c.role) }}
                <span class="osw-type" [class.osw-type--internal]="c.is_internal">
                  {{ c.is_internal ? 'ZOPA Internal' : 'Client' }}
                </span>
              </span>
            </span>
            @if (c.tenant_id === currentId()) {
              <mat-icon class="osw-check">check_circle</mat-icon>
            }
          </button>
        } @empty {
          <div class="osw-empty">
            <mat-icon>search_off</mat-icon>
            <span>No organizations match “{{ query() }}”.</span>
          </div>
        }
      </div>

      <div class="osw-footer">
        <span>{{ filtered().length }} of {{ total() }}</span>
        <span class="osw-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>↵</kbd> switch · <kbd>esc</kbd> close</span>
      </div>
    </div>
  `,
  styles: [`
    .osw { display: flex; flex-direction: column; max-height: 70vh; }
    .osw-search {
      display: flex; align-items: center; gap: 10px; padding: 14px 18px;
      border-bottom: 1px solid var(--border, #e2e8f0);
    }
    .osw-search > mat-icon { color: #94a3b8; flex-shrink: 0; }
    .osw-search input {
      flex: 1; border: 0; outline: none; font-size: 15px; color: #0f172a; background: transparent;
    }
    .osw-clear { border: 0; background: transparent; cursor: pointer; color: #94a3b8; display: flex; padding: 2px; }
    .osw-clear mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .osw-list { overflow-y: auto; padding: 6px; flex: 1; }
    .osw-item {
      display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      border: 0; background: transparent; cursor: pointer; padding: 9px 12px;
      border-radius: 10px; transition: background .1s;
    }
    .osw-item--active { background: var(--brand-light, #fff1e6); }
    .osw-item--current { opacity: .9; }
    .osw-avatar {
      width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px;
      background: var(--brand-light, #fff1e6); color: var(--brand, #f97316);
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;
    }
    .osw-avatar--internal { background: #f5f3ff; color: #6d28d9; }
    .osw-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .osw-name { font-size: 14px; font-weight: 600; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .osw-meta { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 7px; }
    .osw-type {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
      color: #b45309; background: #fff7ed; padding: 1px 6px; border-radius: 999px;
    }
    .osw-type--internal { color: #6d28d9; background: #f5f3ff; }
    .osw-check { color: #16a34a; flex-shrink: 0; }

    .osw-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 44px 16px; color: #94a3b8; font-size: 14px;
    }
    .osw-empty mat-icon { font-size: 34px; width: 34px; height: 34px; opacity: .5; }

    .osw-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 16px; border-top: 1px solid var(--border, #e2e8f0);
      font-size: 11.5px; color: #94a3b8;
    }
    .osw-hint kbd {
      font-family: inherit; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px;
      padding: 0 5px; margin: 0 1px; font-size: 10.5px; color: #64748b;
    }
  `],
})
export class OrgSwitcherDialogComponent {
  private auth = inject(AuthService);
  private ref = inject(MatDialogRef<OrgSwitcherDialogComponent, number>);
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private listEl = viewChild<ElementRef<HTMLElement>>('list');

  query = signal('');
  activeIndex = signal(0);
  readonly currentId = this.auth.currentTenantId;

  total = computed(() => this.auth.clients().length);

  /** Alphabetical, filtered by name or role. */
  filtered = computed<TenantContext[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = [...this.auth.clients()].sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));
    if (!q) return all;
    return all.filter(c =>
      c.tenant_name.toLowerCase().includes(q) ||
      this.roleLabel(c.role).toLowerCase().includes(q) ||
      (c.is_internal ? 'zopa internal' : 'client').includes(q),
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

  initial(c: TenantContext): string {
    return (c.tenant_name?.[0] ?? '?').toUpperCase();
  }

  roleLabel(role: string): string {
    return (role ?? '')
      .replace(/^zopa_/, 'ZOPA ')
      .replace(/^client_/, '')
      .replace(/_/g, ' ')
      .replace(/\bl(\d)\b/i, 'L$1')
      .replace(/\b\w/g, c => c.toUpperCase());
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
      const c = items[this.activeIndex()];
      if (c) this.select(c);
    }
  }

  select(c: TenantContext) {
    this.ref.close(c.tenant_id);
  }

  private scrollActiveIntoView() {
    const list = this.listEl()?.nativeElement;
    const el = list?.querySelectorAll('.osw-item')[this.activeIndex()] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }
}
