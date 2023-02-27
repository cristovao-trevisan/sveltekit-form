import type { MaybePromise, SubmitFunction } from '$app/forms';
import type { Action } from 'svelte/action';
import { derived, get, writable, type Readable } from 'svelte/store';

// TODO: files

/**
 * Validator returns the error string or nothing if valid
 * To use multiple validators, use the `combine` function
 */
export type Validator = (value: string) => MaybePromise<string | void>;

export type FieldMode = 'onBlur' | 'onChange' | 'onSubmit' | 'all';
export interface FieldOptions {
  mode: FieldMode;
  multipleErrors?: boolean;
  validators?: Validator[],
  initialValue?: string | number,
}
interface FieldOptionsParsed extends FieldOptions {
  validators: Validator[],
  initialValue: string | undefined,
}

export type Field = Readable<{
  value: string;
  errors?: string[];
  error?: string;
}> & {
  action: Action<HTMLInputElement>,
  subscribeValue: Readable<string>['subscribe'],
  setErrors: (error: string[] | undefined) => void,
  setDirty: () => void,
  readonly dirty: boolean,
  readonly options: FieldOptionsParsed,
};


export function field(opts: FieldOptions): Field {
  const options: FieldOptionsParsed = {
    validators: [],
    ...opts,
    initialValue: opts.initialValue === undefined ? undefined : String(opts.initialValue)
  };
  const value = writable(options.initialValue);
  const errors = writable<string[] | undefined>(undefined);
  const listeners = new Map<string, (e: Event) => void>();
  let dirty = false;

  function setDirty() {
    if (!dirty) registerEvent('input', handleEvent);
    dirty = true;
  }

  let node: HTMLInputElement;
  function registerEvent(event: string, fn: (e: Event) => void) {
    node.addEventListener(event, fn);
    listeners.set(event, fn);
  }
  function handleEvent(e: Event) {
    const target = e.target as HTMLInputElement;
    setDirty();
    value.set(target.value);
  }


  return {
    ...derived([value, errors], ([$value, $errors]) => ({
      value: $value,
      errors: $errors,
      error: $errors && $errors[0],
    })),
    get dirty() { return dirty; },
    setDirty,
    options,
    subscribeValue: value.subscribe,
    setErrors: err => errors.set(err),
    action: n => {
      node = n;
      node.value = options.initialValue ?? '';

      switch (options.mode) {
        case 'onBlur':
          registerEvent('blur', handleEvent);
          break;
        case 'onChange':
          registerEvent('change', handleEvent);
          break;
        case 'onSubmit':
          registerEvent('submit', handleEvent);
          break;
        case 'all':
          registerEvent('blur', handleEvent);
          registerEvent('change', handleEvent);
          registerEvent('submit', handleEvent);
          break;
      }
      return {
        destroy: () => listeners.forEach((fn, event) => node.removeEventListener(event, fn)),
      };
    },
  };
}

type Fields = { [key: string]: Field };
type FormErrors<T extends Fields> = { [k in keyof T]?: string[] };
export interface Form<F extends Fields> {
  errors: Readable<FormErrors<F>>;
  anyError: Readable<boolean>;
  enhancer: SubmitFunction;
}

export async function createForm<T extends Fields>(fields: T): Promise<Form<T>> {
  const errors = writable<FormErrors<T>>({});
  const anyError = derived(errors, $errors => Object.values($errors).some(Boolean));
  
  Object.entries(fields).forEach(([key, field]) => {
    field.subscribeValue(v => {
      if (field.dirty) validateField(key, field, v);
    });
  });
  async function validateField(key: string, field: Field, value: string) {
    const errs = [] as string[];
    for (const validator of field.options.validators) {
      const error = await validator(value);
      if (error) {
        errs.push(error);
        if (!field.options.multipleErrors) break;
      }
    }
    field.setErrors(errs.length ? errs : undefined);
    errors.update($errors => ({ ...$errors, [key]: errs.length ? errs : undefined }));
  }
  async function validateAll() {
    await Promise.all(Object.entries(fields).map(([key, field]) => validateField(key, field, get(field).value)));
  }

  return {
    errors,
    anyError,
    async enhancer({ cancel }) {
      Object.values(fields).forEach(field => {
        if (field.options.mode === 'onSubmit' || field.options.mode === 'all') field.setDirty();
      });
      await validateAll();
      // if (get(anyError)) cancel();
      return ({ update }) => update();
    },
  };
}

export async function validateFormData<T extends Fields>(fields: T, data: FormData): Promise<{
  errors: FormErrors<T>,
  anyError: boolean,
  values: Partial<{ [key in keyof T]: string }>,
}> {
  let anyError = false;
  const values: Partial<{ [key in keyof T]: string }> = {};
  const res = await Promise.all(Object.entries(fields).map(async ([key, field]) => {
    const value = data.get(key)?.toString() ?? '';
    const k = key as keyof T;
    values[k] = value;
    return Promise.all(field.options.validators.map(validator => validator(String(value))));
  }));
  const errors = res.reduce((acc, cur, i) => {
    const key = Object.keys(fields)[i];
    const errs = cur.filter(Boolean);
    if (errs.length) anyError = true;
    return { ...acc, [key]: errs.length ? errs : null };
  }, {});
  return { errors, values, anyError };
}
