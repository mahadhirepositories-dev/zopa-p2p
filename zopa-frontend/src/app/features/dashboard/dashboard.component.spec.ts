import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardComponent } from './dashboard.component';

const EMPTY = {
  filter: { period: 'all' },
  tat_summary: {
    avg_total_days: null, avg_pr_tat_days: null, avg_pr_tat_net_days: null,
    avg_approval_days: null, avg_release_days: null, avg_delivery_days: null,
  },
  spend: { value: 0, count: 0, previous_value: null, trend: [{ month: '2026-11', value: 0 }] },
  attention: { pos_returned: 0, pos_ready_to_release: 0, deliveries_delayed: 0, prs_needing_clarification: 0, prs_ageing: 0 },
  po_counts: {},
  pending_approvals: 0,
  budget_summary: [],
  po_kpi: [],
  pr_counts: {},
  pr_kpi: [],
  pending_pr_tracking: [],
  po_delivery_tracking: [],
  latest_operational_report: null,
};

function openDashboard(stats: object, allowed: (module: string, action: string) => boolean = () => true) {
  TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideNoopAnimations(),
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { currentTenantId: signal(1), user: signal({ name: 'Asha' }), canDo: allowed },
      },
    ],
  });
  const fixture = TestBed.createComponent(DashboardComponent);
  fixture.detectChanges();
  TestBed.inject(HttpTestingController)
    .expectOne(r => r.url.endsWith('/dashboard/stats'))
    .flush({ ...EMPTY, ...stats });
  fixture.detectChanges();
  return { dashboard: fixture.componentInstance, page: fixture.nativeElement as HTMLElement };
}

describe('DashboardComponent', () => {
  it('says there is no data instead of showing zero days', () => {
    const { page } = openDashboard({});

    expect(page.textContent).toContain('No data');
    expect(page.textContent).not.toContain('0 days');
    expect(page.textContent).toContain('The monthly trend appears once POs are raised');
  });

  it('shows only the attention items with work waiting', () => {
    const { page } = openDashboard({
      pending_approvals: 3,
      attention: { ...EMPTY.attention, deliveries_delayed: 2 },
    });

    expect(page.textContent).toContain('Waiting on your approval');
    expect(page.textContent).toContain('Delivery delayed');
    expect(page.textContent).not.toContain('Returned for changes');
    expect(page.textContent).not.toContain('Nothing needs attention');
  });

  it('says so when nothing needs attention', () => {
    expect(openDashboard({}).page.textContent).toContain('Nothing needs attention');
  });

  it('hides what the role cannot act on or view', () => {
    const { page } = openDashboard(
      { pending_approvals: 3, attention: { ...EMPTY.attention, pos_returned: 1, prs_ageing: 4 } },
      (module, action) => module === 'purchase_requisitions' && action === 'view',
    );

    expect(page.textContent).not.toContain('Waiting on your approval');
    expect(page.textContent).not.toContain('Returned for changes');
    expect(page.textContent).toContain('Open over 7 days');
    expect(page.querySelector('.ui-hero')).toBeNull();
    expect(page.textContent).not.toContain('Budget used');
  });

  it('compares PO value only when there is an earlier figure to compare with', () => {
    const period = { filter: { period: 'this_month' } };

    const up = openDashboard({ ...period, spend: { ...EMPTY.spend, value: 150, previous_value: 100 } });
    expect(up.dashboard.spendDelta()).toEqual({ pct: 50, up: true, label: 'vs this point last month' });
    TestBed.resetTestingModule();

    const none = openDashboard({ ...period, spend: { ...EMPTY.spend, value: 150, previous_value: 0 } });
    expect(none.dashboard.spendDelta()).toBeNull();
  });

  it('ranks budgets by use and does not invent a percentage for an unfunded cost center', () => {
    const { dashboard, page } = openDashboard({
      budget_summary: [
        { id: 1, name: 'Unfunded', annual: 0, frozen: 0, consumed: 0, available: 0 },
        { id: 2, name: 'Fine', annual: 1000, frozen: 100, consumed: 100, available: 800 },
        { id: 3, name: 'Over', annual: 1000, frozen: 800, consumed: 300, available: -100 },
      ],
    });

    expect(dashboard.budgets().map(b => b.name)).toEqual(['Over', 'Fine', 'Unfunded']);
    expect(dashboard.budgetTotal().used).toBeCloseTo(65);
    expect(page.textContent).toContain('No budget set');
    expect(page.textContent).toContain('₹100 over budget');
    expect(page.textContent).toContain('Above 90% of budget');
  });

  it('adds up pipeline stages and reports anything else as closed', () => {
    const { dashboard } = openDashboard({ po_counts: { pending_l1: 2, pending_l3: 1, approved: 4, cancelled: 3 } });

    const lane = dashboard.lanes().find(l => l.title === 'Purchase orders')!;
    expect(lane.total).toBe(10);
    expect(lane.stages.find(s => s.label === 'Pending')!.count).toBe(3);
    expect(lane.closed).toBe('3 rejected or closed');
  });

  it('formats headline rupees in lakh and crore', () => {
    const { dashboard } = openDashboard({});

    expect(dashboard.inr(85400)).toBe('₹85,400');
    expect(dashboard.inr(4260000)).toBe('₹42.6L');
    expect(dashboard.inr(123400000)).toBe('₹12.34Cr');
    expect(dashboard.inr(-250000)).toBe('-₹2.5L');
  });
});
