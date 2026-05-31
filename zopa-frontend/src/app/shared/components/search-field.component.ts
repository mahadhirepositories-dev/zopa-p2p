import { Component, input, model, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Reusable search field used across all list screens.
 *
 * Uses a plain input + a `model()` signal (not mat-form-field) so the layout
 * is consistent and compact everywhere, and so two-way binding always drives
 * change detection / computed signals correctly.
 *
 * Usage:
 *   <app-search-field [value]="search()" (valueChange)="search.set($event)"
 *                     placeholder="Search by PO number, vendor…" />
 *   or with a writable signal:
 *   <app-search-field [(value)]="search" />
 */
@Component({
  selector: 'app-search-field',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="zsearch" [class.zsearch--focused]="focused()">
      <mat-icon class="zsearch__icon">search</mat-icon>
      <input
        class="zsearch__input"
        type="text"
        [attr.aria-label]="placeholder()"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)" />
      @if (value()) {
        <button class="zsearch__clear" type="button" (click)="clear()" aria-label="Clear search" tabindex="-1">
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .zsearch {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 42px;
      padding: 0 10px 0 12px;
      background: #fff;
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 10px;
      transition: border-color .15s ease, box-shadow .15s ease;
    }
    .zsearch--focused {
      border-color: var(--brand, #f97316);
      box-shadow: 0 0 0 3px rgba(249, 115, 22, .14);
    }

    .zsearch__icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--text-3, #94a3b8);
      flex-shrink: 0;
    }

    .zsearch__input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      font-size: 13.5px;
      color: var(--text-1, #1e293b);
      font-family: inherit;
    }
    .zsearch__input::placeholder { color: var(--text-3, #94a3b8); }

    .zsearch__clear {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border: 0;
      background: transparent;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-3, #94a3b8);
      transition: background .12s ease, color .12s ease;
    }
    .zsearch__clear:hover { background: #f1f5f9; color: var(--text-1, #1e293b); }
    .zsearch__clear mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `],
})
export class SearchFieldComponent {
  /** Two-way bindable search text. */
  value = model<string>('');
  /** Placeholder text. */
  placeholder = input<string>('Search…');

  focused = signal(false);

  onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  clear(): void {
    this.value.set('');
  }
}
