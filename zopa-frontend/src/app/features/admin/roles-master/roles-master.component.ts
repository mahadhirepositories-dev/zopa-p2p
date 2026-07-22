import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NotificationService } from '../../../core/services/notification.service';
import { RoleService, Role } from '../../../services/role.service';

@Component({
  selector: 'app-roles-master',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatTableModule, MatButtonModule, 
    MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule, 
    MatSelectModule
  ],
  template: `
    <div class="page-container p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Roles Master</h1>
        <button mat-flat-button color="primary" (click)="openDialog()">
          <mat-icon>add</mat-icon> Add Role
        </button>
      </div>

      <div class="mat-elevation-z8 bg-white rounded-lg overflow-hidden">
        <table mat-table [dataSource]="roles()">
          
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef> Role Name </th>
            <td mat-cell *matCellDef="let role" class="font-medium"> {{role.name}} </td>
          </ng-container>

          <ng-container matColumnDef="slug">
            <th mat-header-cell *matHeaderCellDef> Slug </th>
            <td mat-cell *matCellDef="let role" class="text-gray-500"> {{role.slug}} </td>
          </ng-container>

          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef> Type </th>
            <td mat-cell *matCellDef="let role">
              <span class="px-2 py-1 text-xs font-semibold rounded-full"
                    [ngClass]="role.type === 'zopa' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'">
                {{role.type | uppercase}}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="is_system">
            <th mat-header-cell *matHeaderCellDef> System Role </th>
            <td mat-cell *matCellDef="let role">
              <mat-icon *ngIf="role.is_system" class="text-gray-400" title="System roles cannot be deleted">lock</mat-icon>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="text-right"> Actions </th>
            <td mat-cell *matCellDef="let role" class="text-right">
              <button mat-icon-button color="primary" (click)="openDialog(role)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" *ngIf="!role.is_system" (click)="deleteRole(role.slug)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50"></tr>
        </table>
      </div>
    </div>

    <!-- Dialog Template for Add/Edit -->
    <ng-template #roleDialog>
      <h2 mat-dialog-title>{{ editingRole() ? 'Edit Role' : 'Add New Role' }}</h2>
      <mat-dialog-content>
        <form [formGroup]="roleForm" class="flex flex-col gap-4 pt-2">
          
          <mat-form-field appearance="outline">
            <mat-label>Role Name</mat-label>
            <input matInput formControlName="name" placeholder="e.g. Finance Manager">
          </mat-form-field>

          <mat-form-field appearance="outline" *ngIf="!editingRole()">
            <mat-label>Role Slug (System ID)</mat-label>
            <input matInput formControlName="slug" placeholder="e.g. client_finance_manager">
            <mat-hint>Must be unique, lowercase, no spaces.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Role Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="client">Client Organization</mat-option>
              <mat-option value="zopa">ZOPA (Internal)</mat-option>
            </mat-select>
          </mat-form-field>

        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" [disabled]="roleForm.invalid" (click)="saveRole()">Save</button>
      </mat-dialog-actions>
    </ng-template>
  `
})
export class RolesMasterComponent implements OnInit {
  private roleService = inject(RoleService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);

  roles = signal<Role[]>([]);
  displayedColumns = ['name', 'slug', 'type', 'is_system', 'actions'];

  @ViewChild('roleDialog') roleDialogTemplate: any;
  editingRole = signal<Role | null>(null);

  roleForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    type: ['client', Validators.required]
  });

  ngOnInit() {
    this.loadRoles();
  }

  loadRoles() {
    this.roleService.getAdminRoles().subscribe({
      next: (res) => this.roles.set(res),
      error: () => {
        console.error("Failed to load admin roles");
        this.notify.error('Failed to load roles');
      }
    });
  }

  openDialog(role?: Role) {
    if (role) {
      this.editingRole.set(role);
      this.roleForm.patchValue(role);
      this.roleForm.get('slug')?.disable();
    } else {
      this.editingRole.set(null);
      this.roleForm.reset({ type: 'client' });
      this.roleForm.get('slug')?.enable();
    }
    
    this.dialog.open(this.roleDialogTemplate, { width: '400px' });
  }

  saveRole() {
    if (this.roleForm.invalid) return;

    const roleData = this.roleForm.getRawValue();
    const editing = this.editingRole();

    const req$ = editing 
      ? this.roleService.updateRole(editing.slug, roleData)
      : this.roleService.createRole(roleData);

    req$.subscribe({
      next: () => {
        this.notify.success(`Role ${editing ? 'updated' : 'created'} successfully`);
        this.dialog.closeAll();
        this.loadRoles();
      },
      error: (err: any) => this.notify.error(err.error?.message || 'Error saving role')
    });
  }

  deleteRole(slug: string) {
    if (confirm('Are you sure you want to delete this role? All users with this role will lose their permissions.')) {
      this.roleService.deleteRole(slug).subscribe({
        next: () => {
          this.notify.success('Role deleted');
          this.loadRoles();
        },
        error: (err: any) => this.notify.error(err.error?.message || 'Failed to delete role')
      });
    }
  }
}
