<script lang="ts">
  import type { ActionData, PageData } from './$types';
  import { enhance } from '$app/forms';

  export let form: ActionData;
  export let data: PageData;
  
  $: form && console.log(form);
  const { name, age, study, enhancer, anyError, errors } = data;
</script>

<form use:enhance={enhancer} method="POST">
  <label class:error={$name.error}>
    Name
    <input type="text" name="name" use:name.action>
  </label>
  <label class:error={$age.error}>
    Age
    <input type="number" name="age" use:age.action>
  </label>
  <label class:error={$study.error}>
    Study
    <input type="text" name="study" use:study.action>
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
