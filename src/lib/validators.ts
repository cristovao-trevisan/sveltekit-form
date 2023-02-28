import type { Validator } from './form';

export const required: Validator = value => {
  if (value === undefined || value === '' || value === null) return 'required';
}
