import { validateFormData } from '$lib/form';
import { fail, type Actions } from '@sveltejs/kit';
import { fields } from './user-form';

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const validation = await validateFormData(fields(), data);
    if (validation.anyError) return fail(400, validation as any);
    return { success: true };
  },
};
