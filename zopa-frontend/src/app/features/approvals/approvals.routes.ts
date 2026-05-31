import { Routes } from '@angular/router';

export const approvalRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./approval-queue.component').then(m => m.ApprovalQueueComponent),
  },
];
