import type { Action } from 'svelte/action';
import type { MaybePromise } from '@sveltejs/kit/types/private';
import { derived, get, writable, type Readable } from 'svelte/store';
import { fail, type Action as KitAction, type AwaitedActions, type SubmitFunction } from '@sveltejs/kit';

type Value = string | File;

/**
 * Validator returns the error string or nothing if valid
 * To use multiple validators, use the `combine` function
 */
export type Validator<T extends Value = any> = (value: T) => MaybePromise<string | void>;

export type FieldMode = 'onBlur' | 'onChange' | 'onSubmit' | 'all';
export interface FieldOptions<V extends Value> {
  mode: V extends File ? 'onChange' : FieldMode;
  multipleErrors?: boolean;
  validators?: Validator<V>[],
  initialValue?: string,
}
interface FieldOptionsParsed<V extends Value> extends FieldOptions<V> {
  validators: Validator[],
}

export type Field<V extends Value> = Readable<{
  value: V;
  dirty: boolean;
  errors?: string[];
  error?: string;
}> & {
  action: Action<HTMLInputElement>,
  /** @internal */ subscribeValue: Readable<readonly [V, boolean]>['subscribe'],
  /** @internal */ setErrors: (error: string[] | undefined) => void,
  /** @internal */ setDirty: () => void,
  /** @internal */ setValue: (value: V) => void,
  /** @internal */ readValue: () => void,
  /** @internal */ reset: () => void,
  /** @internal */ readonly options: FieldOptionsParsed<V>,
  /** @internal */ T?: V,
};


export function field<V extends Value>(opts: FieldOptions<V>): Field<V> {
  const options: FieldOptionsParsed<V> = {
    validators: [],
    ...opts,
  };
  const value = writable<V>(options.initialValue as V ?? '');
  const errors = writable<string[] | undefined>(undefined);
  const listeners = new Map<string, (e: Event) => void>();
  const dirty = writable(false);
  let alreadyDirty = false;

  function setDirty() {
    if (alreadyDirty) return;
    alreadyDirty = true;
    dirty.set(true);
    registerEvent('input', handleEvent);
  }
  function setValue(v: V) {
    value.set(v);
    if (node && typeof v === 'string') node.value = v;
  }
  function readValue() {
    if (!node) return;
    const v = node.files?.[0] ?? node.value;
    value.set(v as V);
  }

  let node: HTMLInputElement;
  function registerEvent(event: string, fn: (e: Event) => void) {
    if (!node) return;
    node.addEventListener(event, fn);
    listeners.set(event, fn);
  }
  function handleEvent(e: Event) {
    const target = e.target as HTMLInputElement;
    setDirty();
    const v = target.files?.[0] ?? target.value;
    value.set(v as V);
  }

  return {
    ...derived([value, errors, dirty], ([value, errors, dirty]) => ({ value, errors, dirty, error: errors && errors[0] })),
    setDirty,
    setValue,
    readValue,
    options,
    reset: () => {
      if (node) {
        if (typeof options.initialValue === 'string') node.value = options.initialValue ?? '';
        else node.value = '';
      }
      alreadyDirty = false;
      dirty.set(false);
      const onInput = listeners.get('input');
      if (onInput) node.removeEventListener('input', onInput);
    },
    subscribeValue: derived([value, dirty], ([$value, $dirty]) => [$value, $dirty] as const).subscribe,
    setErrors: err => errors.set(err),
    action: n => {
      node = n;
      if (node && typeof options.initialValue === 'string') node.value = options.initialValue ?? '';

      switch (options.mode) {
        case 'onBlur':
          registerEvent('blur', handleEvent);
          break;
        case 'onChange':
          registerEvent('change', handleEvent);
          break;
        case 'all':
          registerEvent('blur', handleEvent);
          registerEvent('change', handleEvent);
          break;
      }
      return {
        destroy: () => listeners.forEach((fn, event) => node.removeEventListener(event, fn)),
      };
    },
  };
}

interface Fields { [key: string]: Field<any> }
type FormErrors<F extends Fields> = { [k in keyof F]?: string[] };
interface ServerValidationResult<F extends Fields> {
  errors: FormErrors<F>,
  anyError: boolean,
  values: { [k in keyof F]: F[k]['T'] },
}
export interface Form<F extends Fields> {
  errors: Readable<FormErrors<F>>;
  anyError: Readable<boolean>;
  enhancer: SubmitFunction;
  populate: (validation: ServerValidationResult<F>) => void;
  reset: () => void;
  actionData: (ActionData: AwaitedActions<any>) => void;
}

export async function createForm<F extends Fields>(fields: F): Promise<Form<F>> {
  const errors = writable<FormErrors<F>>({});
  const anyError = derived(errors, $errors => Object.values($errors).some(Boolean));

  Object.entries(fields).forEach(([key, field]) => {
    field.subscribeValue(([v, dirty]) => {
      if (dirty) validateField(key, field, v);
    });
  });
  async function validateField(key: string, field: Field<any>, value: Value) {
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

  function populate(validation: ServerValidationResult<F>) {
    Object.entries(validation.errors).forEach(([key, errs]) => {
      const field = fields[key];
      if (!field) return;
      field.setErrors(errs);
      field.setDirty();
    });
    Object.entries(validation.values).forEach(([key, value]) => {
      const field = fields[key];
      if (!field) return;
      field.setValue(value as string);
    });
    errors.set(validation.errors);
  }
  function reset() {
    Object.values(fields).forEach(field => field.reset());
    errors.set({});
  }

  return {
    errors,
    anyError,
    populate,
    reset,
    async enhancer({ cancel }) {
      Object.values(fields).forEach(field => {
        if (field.options.mode === 'onSubmit' || field.options.mode === 'all') {
          field.setDirty();
          field.readValue();
        }
      });
      await validateAll();
      if (get(anyError)) cancel();
      return ({ update }) => update();
    },
    actionData(form) {
      const f = form as any;
      if (f) {
        if (f.success) reset();
        else populate(f);
      }
    },
  };
}

async function validateFormData<F extends Fields>(fields: F, data: FormData): Promise<ServerValidationResult<F>> {
  let anyError = false;
  const values = {} as any;
  const res = await Promise.all(Object.entries(fields).map(async ([key, field]) => {
    const value = data.get(key);
    values[key] = value;
    return Promise.all(field.options.validators.map(validator => validator(value)));
  }));
  const errors = res.reduce((acc, cur, i) => {
    const key = Object.keys(fields)[i];
    const errs = cur.filter(Boolean);
    if (errs.length) anyError = true;
    return { ...acc, [key]: errs.length ? errs : null };
  }, {});
  return { errors, values, anyError };
}

export type Submit<F extends Fields> = (value: ServerValidationResult<F>) => void;
export function validate<F extends Fields>(fields: F, submit: Submit<F>): KitAction {
  return async ({ request }) => {
    const data = await request.formData();
    const validation = await validateFormData(fields, data);
    if (validation.anyError) return fail(400, validation as any);
    await submit(validation);
    return { success: true };
  }
}
