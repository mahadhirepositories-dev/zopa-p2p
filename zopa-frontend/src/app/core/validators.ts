import { AbstractControl, ValidatorFn } from '@angular/forms';

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_PATTERN   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PHONE_PATTERN = /^[6-9]\d{9}$/;

export function gstinValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const v = String(control.value ?? '').toUpperCase().trim();
    if (!v) return null;
    return GSTIN_PATTERN.test(v) ? null : { gstin: true };
  };
}

export function panValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const v = String(control.value ?? '').toUpperCase().trim();
    if (!v) return null;
    return PAN_PATTERN.test(v) ? null : { pan: true };
  };
}

export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl) => {
    const v = String(control.value ?? '').trim().replace(/\s/g, '');
    if (!v) return null;
    return PHONE_PATTERN.test(v) ? null : { phone: true };
  };
}
