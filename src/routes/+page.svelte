<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { enhance } from '$app/forms';

  export let form: ActionData;
  export let data: PageData;
  const { name, age, study, enhancer, anyError, actionData } = data;

  $: actionData(form);
</script>

<form use:enhance={enhancer} method="POST">
  <label class:error={$name.error}>
    Name
    <input type="text" name="name" use:name.action value={$name.value}>
  </label>
  <label class:error={$age.error}>
    Age
    <input type="number" name="age" use:age.action value={$age.value}>
  </label>
  <label class:error={$study.error}>
    Study
    <input type="text" name="study" use:study.action value={$study.value}>
  </label>
  <button class:error={$anyError}> Submit </button>
</form>

<style>
  label, button {
    display: block;
  }
  .error {
    color: red;
  }
</style>
