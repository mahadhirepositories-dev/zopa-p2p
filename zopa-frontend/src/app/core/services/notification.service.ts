import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snack = inject(MatSnackBar);

  success(message: string) {
    this.snack.open(message, 'Close', { duration: 4000, panelClass: ['snack-success'] });
  }

  error(message: string) {
    this.snack.open(message, 'Close', { duration: 6000, panelClass: ['snack-error'] });
  }

  warning(message: string) {
    this.snack.open(message, 'Close', { duration: 7000, panelClass: ['snack-warning'] });
  }

  info(message: string) {
    this.snack.open(message, 'Close', { duration: 3000 });
  }
}
