import type { Actions } from '@sveltejs/kit';
import { validate } from '$lib/form';
import { fields } from './user-form';

export const actions: Actions = {
  default: validate(fields(), async ({ values }) => {
    console.log(values);
  }),
};
