import { createForm, field } from '$lib/form';
import { required } from '$lib/validators';

export function fields() {
  const name = field({ mode: 'onSubmit', validators: [required] });
  const age = field({ mode: 'onBlur', validators: [required] });
  const study = field({ initialValue: 'Eng.', mode: 'onSubmit', validators: [required] });
  return { name, age, study };
}

export async function form() {
  const _fields = fields();
  const form = await createForm(_fields);
  return { ..._fields, ...form };
}
