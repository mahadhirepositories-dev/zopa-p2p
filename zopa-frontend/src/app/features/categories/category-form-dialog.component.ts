import { Component, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

interface Category { id: number; name: string; parent_id?: number | null; children?: Category[]; }

// Flat option with depth for the parent selector
interface FlatOption { id: number; name: string; depth: number; }

@Component({
  selector: 'app-category-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.category ? 'Edit Category' : 'New Category' }}</h2>
    <mat-dialog-content style="min-width:400px;">
      <form [formGroup]="form" class="dialog-form">

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Category Name *</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Laptops, Consulting" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Parent Category (optional)</mat-label>
          <mat-select formControlName="parent_id">
            <mat-option [value]="null">— None (top level) —</mat-option>
            @for (opt of parentOptions(); track opt.id) {
              <mat-option [value]="opt.id" [disabled]="isDisabled(opt.id)">
                <span [style.padding-left.px]="opt.depth * 16">
                  {{ opt.depth === 0 ? '' : opt.depth === 1 ? '↳ ' : '↳↳ ' }}{{ opt.name }}
                </span>
              </mat-option>
            }
          </mat-select>
          <mat-hint>Max 3 levels: Type → Category → Sub-category</mat-hint>
        </mat-form-field>

      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.dialog-form { display:flex; flex-direction:column; gap:8px; padding-top:8px; } .full-width { width:100%; }`],
})
export class CategoryFormDialogComponent {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);
  private dialogRef = inject(MatDialogRef<CategoryFormDialogComponent>);
  data: { category: Category | null; categories: Category[] } = inject(MAT_DIALOG_DATA);

  saving = signal(false);

  form = this.fb.group({
    name:      [this.data.category?.name ?? '', Validators.required],
    parent_id: [this.data.category?.parent_id ?? null as number | null],
  });

  /** Flatten the tree to at most depth=1 (L1 and L2 can be parents; L3 cannot) */
  parentOptions = signal<FlatOption[]>(this.buildOptions());

  private buildOptions(): FlatOption[] {
    const opts: FlatOption[] = [];
    const walk = (cats: Category[], depth: number) => {
      for (const c of cats) {
        // Only allow nodes that are depth 0 or 1 as parents
        // (depth 2 nodes are L3 leaves — they cannot have children)
        if (depth < 2) {
          opts.push({ id: c.id, name: c.name, depth });
          if (c.children?.length) walk(c.children, depth + 1);
        }
      }
    };
    walk(this.data.categories, 0);
    return opts;
  }

  /** Disable selecting self or own descendants as parent */
  isDisabled(id: number): boolean {
    if (!this.data.category) return false;
    if (id === this.data.category.id) return true;
    // also disable descendants
    return this.isDescendant(id, this.data.category);
  }

  private isDescendant(targetId: number, cat: Category): boolean {
    for (const child of cat.children ?? []) {
      if (child.id === targetId) return true;
      if (this.isDescendant(targetId, child)) return true;
    }
    return false;
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const req = this.data.category
      ? this.http.put(`${environment.apiUrl}/categories/${this.data.category.id}`, this.form.value)
      : this.http.post(`${environment.apiUrl}/categories`, this.form.value);

    req.subscribe({
      next: () => { this.notify.success('Category saved.'); this.dialogRef.close(true); },
      error: (err: any) => {
        this.notify.error(err.error?.message || err.error?.error || 'Save failed.');
        this.saving.set(false);
      },
    });
  }
}
