import { Component, ElementRef, forwardRef, inject, input, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Lightweight, dependency-free rich-text editor (contenteditable + execCommand)
 * that stores HTML and works as a reactive-forms control. Toolbar: bold, italic,
 * underline, bullet + numbered lists, clear formatting. The stored HTML is
 * rendered (sanitised) on the PO detail screen and in the PO PDF.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => RichTextEditorComponent),
    multi: true,
  }],
  template: `
    <div class="rte">
      <div class="rte-toolbar">
        <button type="button" mat-icon-button matTooltip="Bold" (click)="cmd('bold')"><mat-icon>format_bold</mat-icon></button>
        <button type="button" mat-icon-button matTooltip="Italic" (click)="cmd('italic')"><mat-icon>format_italic</mat-icon></button>
        <button type="button" mat-icon-button matTooltip="Underline" (click)="cmd('underline')"><mat-icon>format_underlined</mat-icon></button>
        <span class="rte-divider"></span>
        <button type="button" mat-icon-button matTooltip="Bulleted list" (click)="cmd('insertUnorderedList')"><mat-icon>format_list_bulleted</mat-icon></button>
        <button type="button" mat-icon-button matTooltip="Numbered list" (click)="cmd('insertOrderedList')"><mat-icon>format_list_numbered</mat-icon></button>
        <span class="rte-divider"></span>
        <button type="button" mat-icon-button matTooltip="Clear formatting" (click)="cmd('removeFormat')"><mat-icon>format_clear</mat-icon></button>
      </div>
      <div #editor class="rte-body" contenteditable="true"
           [attr.data-placeholder]="placeholder()"
           (input)="onInput()" (blur)="onTouched()"></div>
    </div>
  `,
  styles: [`
    .rte { border: 1px solid var(--border, #d1d5db); border-radius: 10px; overflow: hidden; background: #fff; }
    .rte:focus-within { border-color: var(--brand, #ea580c); }
    .rte-toolbar { display: flex; align-items: center; gap: 2px; padding: 4px 6px; border-bottom: 1px solid var(--border, #e5e7eb); background: #fafafa; }
    .rte-toolbar button { width: 32px; height: 32px; line-height: 32px; }
    .rte-toolbar mat-icon { font-size: 18px; width: 18px; height: 18px; color: #475569; }
    .rte-divider { width: 1px; height: 20px; background: var(--border, #e5e7eb); margin: 0 4px; }
    .rte-body { min-height: 180px; max-height: 380px; overflow-y: auto; padding: 12px 14px; font-size: 13px; line-height: 1.6; color: #1f2937; outline: none; }
    .rte-body:empty::before { content: attr(data-placeholder); color: #9ca3af; }
    .rte-body ul, .rte-body ol { margin: 4px 0; padding-left: 22px; }
  `],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  placeholder = input('Enter or paste terms and conditions…');
  private editorRef = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  cmd(command: string) {
    this.editorRef().nativeElement.focus();
    document.execCommand(command, false);
    this.onInput();
  }

  onInput() {
    const html = this.editorRef().nativeElement.innerHTML;
    // Treat an empty editor as an empty string, not "<br>".
    this.onChange(this.isBlank(html) ? '' : html);
  }

  private isBlank(html: string): boolean {
    return html.replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '').trim() === '';
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────
  writeValue(value: string | null): void {
    const el = this.editorRef().nativeElement;
    const v = value ?? '';
    // Plain-text (legacy) content has no tags — preserve its line breaks.
    el.innerHTML = /<[a-z][\s\S]*>/i.test(v)
      ? v
      : v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
