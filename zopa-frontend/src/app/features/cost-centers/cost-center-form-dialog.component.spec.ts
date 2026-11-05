import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../core/auth/auth.service';
import { CostCenterFormDialogComponent } from './cost-center-form-dialog.component';

function openDialog(isAdmin: boolean, costCenter: unknown = null) {
  TestBed.configureTestingModule({
    imports: [CostCenterFormDialogComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAdmin: signal(isAdmin) } },
      { provide: MAT_DIALOG_DATA, useValue: costCenter },
      { provide: MatDialogRef, useValue: { close: () => {} } },
    ],
  });
  const fixture = TestBed.createComponent(CostCenterFormDialogComponent);
  fixture.detectChanges();
  const page = fixture.nativeElement as HTMLElement;
  return {
    dialog: fixture.componentInstance,
    http: TestBed.inject(HttpTestingController),
    page,
    budgetInput: page.querySelector<HTMLInputElement>('input[formcontrolname="annual_budget"]')!,
  };
}

describe('CostCenterFormDialogComponent budget field', () => {
  it('is locked for a non-admin, with a hint saying why', () => {
    const { budgetInput, page } = openDialog(false);

    expect(budgetInput.readOnly).toBe(true);
    expect(page.textContent).toContain('Only an admin can set the budget');
  });

  it('stays editable for an admin', () => {
    const { budgetInput, page } = openDialog(true);

    expect(budgetInput.readOnly).toBe(false);
    expect(page.textContent).not.toContain('Only an admin can set the budget');
  });

  // The backend requires annual_budget on create, so locking must not drop it from the payload.
  it('still sends a budget of 0 when a non-admin creates a cost center', () => {
    const { dialog, http } = openDialog(false);

    dialog.form.patchValue({ name: 'Ops' });
    dialog.save();

    const request = http.expectOne(r => r.method === 'POST' && r.url.endsWith('/cost-centers')).request;
    expect(request.body.annual_budget).toBe(0);
  });

  it('resends the unchanged budget when a non-admin edits a cost center', () => {
    const { dialog, http } = openDialog(false, { id: 7, name: 'Ops', annual_budget: '1000000.00' });

    dialog.form.patchValue({ name: 'Renamed' });
    dialog.save();

    const request = http.expectOne(r => r.method === 'PUT' && r.url.endsWith('/cost-centers/7')).request;
    expect(request.body.annual_budget).toBe('1000000.00');
    expect(request.body.name).toBe('Renamed');
  });
});
