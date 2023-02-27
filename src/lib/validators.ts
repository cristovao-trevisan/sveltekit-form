import type { Validator } from './form';

export const required: Validator<string | number> = value => {
  if (value === undefined || value === '' || value === null) return 'Required';
}
