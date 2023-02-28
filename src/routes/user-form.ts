import { createForm, field } from '$lib';
import { required, requiredFile } from '$lib/validators';

export function fields() {
  const name = field({ mode: 'onSubmit', validators: [required] });
  const age = field({ mode: 'onBlur', validators: [required] });
  const study = field({ initialValue: 'Eng.', mode: 'onSubmit', validators: [required] });
  const picture = field({ mode: 'onChange', validators: [requiredFile] });
  return { name, age, study, picture };
}

export async function form() {
  const ff = fields();
  const form = await createForm(ff);
  return { ...ff, ...form };
}
