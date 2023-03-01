import type { Validator } from './form';

export const required: Validator<string> = value => {
  if (value === undefined || value === '' || value === null) return 'required';
}

export const requiredFiles: Validator<File[]> = value => {
  if (!Array.isArray(value)) return 'required';
  if (!value.length) return 'required';
  if (value.some(v => v.size === 0)) return 'required';
}
