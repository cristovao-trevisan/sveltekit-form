import type { Validator } from './form';

export const required: Validator<string> = value => {
  if (value === undefined || value === '' || value === null) return 'required';
}

export const requiredFile: Validator<File> = value => {
  console.log(value, value instanceof File)
  if (!(value instanceof File)) return 'required';
  if (!value.size) return 'required';
}
