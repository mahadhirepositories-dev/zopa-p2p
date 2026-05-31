import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { SearchFieldComponent } from '../../shared/components/search-field.component';
import {
  HELP_ARTICLES, HELP_CATEGORIES, MODULE_LABELS, HelpArticle, HelpCategory,
} from './help.data';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    MatIconModule, MatExpansionModule, MatChipsModule, MatSlideToggleModule,
    MatCardModule, MatTooltipModule, SearchFieldComponent,
  ],
  template: `
    <div class="page-wrapper">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2>Help &amp; User Manual</h2>
          <p>Search how-to guides and see exactly what you can do in ZOPA.</p>
        </div>
      </div>

      <!-- Personalized "what you can do" panel -->
      <div class="me-card">
        <div class="me-top">
          <div class="me-avatar">{{ initials() }}</div>
          <div>
            <div class="me-name">Hi {{ auth.user()?.name || 'there' }} 👋</div>
            <div class="me-role">You're signed in as <strong>{{ roleLabel() }}</strong></div>
          </div>
        </div>
        @if (capabilities().length) {
          <div class="me-sub">Here's what your role can access:</div>
          <div class="cap-grid">
            @for (c of capabilities(); track c.key) {
              <div class="cap">
                <mat-icon class="cap-icon">{{ c.icon }}</mat-icon>
                <div class="cap-body">
                  <div class="cap-label">{{ c.label }}</div>
                  <div class="cap-actions">
                    <span class="cap-tag view">View</span>
                    @if (c.create) { <span class="cap-tag create">Create</span> }
                    @if (c.edit)   { <span class="cap-tag edit">Edit</span> }
                    @if (c.delete) { <span class="cap-tag delete">Delete</span> }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Search + filters -->
      <div class="toolbar">
        <app-search-field class="search" [value]="query()" (valueChange)="query.set($event)"
                          placeholder="Search help — e.g. 'create PO', 'approve', 'budget'…" />
        <mat-slide-toggle [checked]="relevantOnly()" (change)="relevantOnly.set($event.checked)" color="primary">
          Only my role
        </mat-slide-toggle>
      </div>

      <div class="chips">
        <button class="chip" [class.active]="category() === ''" (click)="category.set('')">All</button>
        @for (cat of categories; track cat.key) {
          <button class="chip" [class.active]="category() === cat.key" (click)="category.set(cat.key)">
            <mat-icon>{{ cat.icon }}</mat-icon> {{ cat.key }}
          </button>
        }
      </div>

      <!-- Results -->
      @if (grouped().length === 0) {
        <div class="empty">
          <mat-icon>search_off</mat-icon>
          <h3>No topics found</h3>
          <p>Try a different word, or turn off "Only my role" to browse everything.</p>
        </div>
      } @else {
        @for (group of grouped(); track group.category) {
          <div class="cat-block">
            <div class="cat-head">
              <mat-icon>{{ iconFor(group.category) }}</mat-icon>
              {{ group.category }}
              <span class="cat-count">{{ group.articles.length }}</span>
            </div>
            <mat-accordion class="acc" multi>
              @for (a of group.articles; track a.id) {
                <mat-expansion-panel class="art">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-icon class="art-icon">{{ a.icon }}</mat-icon>
                      <span class="art-title">{{ a.title }}</span>
                    </mat-panel-title>
                    <mat-panel-description>{{ a.summary }}</mat-panel-description>
                  </mat-expansion-panel-header>
                  <div class="art-body" [innerHTML]="a.body"></div>
                </mat-expansion-panel>
              }
            </mat-accordion>
          </div>
        }
      }

    </div>
  `,
  styles: [`
    .page-wrapper { padding: 28px; max-width: 1000px; }
    .page-header { margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .page-header p { margin: 4px 0 0; font-size: 13px; color: var(--text-3); }

    /* Personalized card */
    .me-card { background: linear-gradient(120deg, #fff7ed 0%, #ffffff 65%); border: 1px solid var(--border); border-radius: 16px; padding: 20px 22px; margin-bottom: 20px; }
    .me-top { display: flex; align-items: center; gap: 14px; }
    .me-avatar { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; background: linear-gradient(135deg,#f97316,#fb923c); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; }
    .me-name { font-size: 17px; font-weight: 700; color: var(--text-1); }
    .me-role { font-size: 13px; color: var(--text-3); margin-top: 2px; }
    .me-sub { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); margin: 16px 0 10px; }
    .cap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .cap { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; }
    .cap-icon { color: var(--brand, #f97316); flex-shrink: 0; }
    .cap-label { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .cap-actions { display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap; }
    .cap-tag { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 99px; }
    .cap-tag.view { background: #eff6ff; color: #2563eb; }
    .cap-tag.create { background: #dcfce7; color: #16a34a; }
    .cap-tag.edit { background: #fef9c3; color: #a16207; }
    .cap-tag.delete { background: #fee2e2; color: #dc2626; }

    /* Toolbar */
    .toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
    .toolbar .search { flex: 1; max-width: 460px; }

    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
    .chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--border); background: #fff; color: var(--text-2); font-size: 12.5px; font-weight: 500; padding: 6px 13px; border-radius: 99px; cursor: pointer; transition: all .12s; }
    .chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .chip:hover { border-color: var(--brand, #f97316); color: var(--brand, #f97316); }
    .chip.active { background: var(--brand, #f97316); border-color: var(--brand, #f97316); color: #fff; }

    /* Category blocks */
    .cat-block { margin-bottom: 22px; }
    .cat-head { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px; }
    .cat-head mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--brand, #f97316); }
    .cat-count { background: #f1f5f9; color: var(--text-3); font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 99px; }

    .acc { display: block; }
    .art { border-radius: 10px !important; margin-bottom: 8px !important; border: 1px solid var(--border); box-shadow: none !important; }
    ::ng-deep .art .mat-expansion-panel-header { height: auto; padding: 14px 18px; }
    .art-icon { color: var(--text-3); margin-right: 10px; font-size: 20px; width: 20px; height: 20px; }
    .art-title { font-size: 14px; font-weight: 600; color: var(--text-1); }
    ::ng-deep .art .mat-expansion-panel-header-description { color: var(--text-3); font-size: 12.5px; }
    .art-body { font-size: 13.5px; color: var(--text-2); line-height: 1.65; padding: 4px 4px 8px; }
    .art-body :first-child { margin-top: 0; }
    .art-body p { margin: 0 0 10px; }
    .art-body ol, .art-body ul { margin: 0 0 10px; padding-left: 20px; }
    .art-body li { margin-bottom: 5px; }
    .art-body code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 12px; color: #be123c; }
    .art-body strong { color: var(--text-1); }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 20px; color: var(--text-3); text-align: center; }
    .empty mat-icon { font-size: 44px; width: 44px; height: 44px; color: var(--border); }
    .empty h3 { margin: 0; font-size: 16px; color: var(--text-2); }
    .empty p { margin: 0; font-size: 13px; }
  `],
})
export class HelpComponent {
  auth = inject(AuthService);

  readonly categories = HELP_CATEGORIES;

  query        = signal('');
  category     = signal<HelpCategory | ''>('');
  relevantOnly = signal(true);

  initials = computed(() => {
    const n = this.auth.user()?.name?.trim() || this.auth.user()?.email || '?';
    const p = n.split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || n[0].toUpperCase();
  });

  roleLabel = computed(() => {
    const r = this.auth.currentRole() ?? '';
    return r
      .replace(/^zopa_/, 'ZOPA ')
      .replace(/^client_/, '')
      .replace(/_/g, ' ')
      .replace(/\bl(\d)\b/i, 'L$1')
      .replace(/\b\w/g, c => c.toUpperCase()) || 'User';
  });

  /** Modules the current user can VIEW, with their create/edit/delete flags. */
  capabilities = computed(() =>
    Object.keys(MODULE_LABELS)
      .filter(m => this.auth.canDo(m, 'view'))
      .map(m => ({
        key: m,
        label: MODULE_LABELS[m].label,
        icon: MODULE_LABELS[m].icon,
        create: this.auth.canDo(m, 'create'),
        edit: this.auth.canDo(m, 'edit'),
        delete: this.auth.canDo(m, 'delete'),
      }))
  );

  /** Filtered + grouped articles for display. */
  grouped = computed(() => {
    const q = this.query().toLowerCase().trim();
    const cat = this.category();
    const relOnly = this.relevantOnly();

    const matches = HELP_ARTICLES.filter(a => {
      if (relOnly && !this.isRelevant(a)) return false;
      if (cat && a.category !== cat) return false;
      if (q && !this.searchText(a).includes(q)) return false;
      return true;
    });

    return HELP_CATEGORIES
      .map(c => ({ category: c.key, articles: matches.filter(a => a.category === c.key) }))
      .filter(g => g.articles.length > 0);
  });

  iconFor(cat: HelpCategory): string {
    return HELP_CATEGORIES.find(c => c.key === cat)?.icon ?? 'help';
  }

  private isRelevant(a: HelpArticle): boolean {
    if (a.superAdminOnly) return this.auth.isSuperAdmin();
    if (a.adminOnly)      return this.auth.isAdmin();
    if (a.modules?.length) return a.modules.some(m => this.auth.canDo(m, 'view'));
    return true;
  }

  private searchText(a: HelpArticle): string {
    return `${a.title} ${a.summary} ${a.keywords.join(' ')} ${a.category} ${a.body.replace(/<[^>]+>/g, ' ')}`
      .toLowerCase();
  }
}
