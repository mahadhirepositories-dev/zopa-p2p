import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';

interface EmailTemplate {
  key: string;
  name: string;
  recipient: string;
  trigger: string;
  subject: string;
  html: string;
}

@Component({
  selector: 'app-email-templates',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Email Templates</h1>
          <p>Preview the automated emails the platform sends. Rendered with sample data.</p>
        </div>
      </header>

      @if (loading()) {
        <div class="center"><mat-spinner diameter="36" /></div>
      } @else if (templates().length === 0) {
        <div class="center muted">No templates found.</div>
      } @else {
        <div class="layout">
          <!-- Template list -->
          <aside class="list">
            @for (t of templates(); track t.key) {
              <button class="tpl" [class.tpl--active]="t.key === selected()?.key" (click)="select(t)">
                <span class="tpl-icon"><mat-icon>{{ icon(t.key) }}</mat-icon></span>
                <span class="tpl-info">
                  <span class="tpl-name">{{ t.name }}</span>
                  <span class="tpl-to">{{ t.recipient }}</span>
                </span>
              </button>
            }
          </aside>

          <!-- Preview -->
          <section class="preview">
            @if (selected(); as t) {
              <div class="meta">
                <div class="meta-row"><span class="meta-k">Subject</span><span class="meta-v subject">{{ t.subject }}</span></div>
                <div class="meta-row"><span class="meta-k">To</span><span class="meta-v">{{ t.recipient }}</span></div>
                <div class="meta-row"><span class="meta-k">When</span><span class="meta-v">{{ t.trigger }}</span></div>
              </div>
              <div class="frame-wrap">
                <iframe class="frame" [srcdoc]="safeHtml()" title="Email preview" sandbox=""></iframe>
              </div>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 8px 4px; }
    .page-head { margin-bottom: 18px; }
    .page-head h1 { font-size: 22px; font-weight: 800; color: var(--text-1, #0f172a); margin: 0 0 4px; }
    .page-head p { font-size: 13.5px; color: var(--text-3, #94a3b8); margin: 0; }
    .center { display: flex; align-items: center; justify-content: center; padding: 60px; }
    .muted { color: #94a3b8; font-size: 14px; }

    .layout { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }

    .list { display: flex; flex-direction: column; gap: 8px; }
    .tpl {
      display: flex; align-items: center; gap: 12px; text-align: left; width: 100%;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 13px 14px; cursor: pointer;
      transition: border-color .15s, box-shadow .15s, transform .05s;
    }
    .tpl:hover { border-color: #fdba74; }
    .tpl--active { border-color: #f97316; box-shadow: 0 2px 10px rgba(249,115,22,.14); }
    .tpl-icon {
      width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; background: #fff7ed;
      display: flex; align-items: center; justify-content: center;
    }
    .tpl-icon mat-icon { color: #ea580c; font-size: 20px; width: 20px; height: 20px; }
    .tpl-info { display: flex; flex-direction: column; min-width: 0; }
    .tpl-name { font-size: 14px; font-weight: 700; color: #0f172a; }
    .tpl-to { font-size: 12px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .preview { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
    .meta { padding: 16px 18px; border-bottom: 1px solid #eef2f7; display: flex; flex-direction: column; gap: 7px; }
    .meta-row { display: flex; gap: 12px; font-size: 13px; }
    .meta-k { width: 64px; flex-shrink: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding-top: 1px; }
    .meta-v { color: #334155; }
    .meta-v.subject { font-weight: 700; color: #0f172a; }
    .frame-wrap { background: #f1f5f9; padding: 16px; }
    .frame { width: 100%; height: 620px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }

    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; }
      .frame { height: 520px; }
    }
  `],
})
export class EmailTemplatesComponent {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  templates = signal<EmailTemplate[]>([]);
  selected  = signal<EmailTemplate | null>(null);
  loading   = signal(true);

  safeHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.selected()?.html ?? ''),
  );

  constructor() {
    this.http.get<EmailTemplate[]>(`${environment.apiUrl}/admin/email-templates`).subscribe({
      next: list => {
        this.templates.set(list);
        this.selected.set(list[0] ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  select(t: EmailTemplate) { this.selected.set(t); }

  icon(key: string): string {
    switch (key) {
      case 'password_reset':   return 'lock_reset';
      case 'po_issued':        return 'forward_to_inbox';
      case 'approval_request': return 'how_to_reg';
      case 'document_status':  return 'fact_check';
      default:                 return 'mail';
    }
  }
}
