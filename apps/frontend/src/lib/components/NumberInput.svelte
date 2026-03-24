<script lang="ts">
  interface Props {
    value: number | string;
    label: string;
    suffix?: string;
    min?: number;
    max?: number;
    step?: number;
    inputmode?: 'numeric' | 'decimal';
    onSave: (value: number | null) => Promise<void>;
  }

  let {
    value = '',
    label,
    suffix,
    min,
    max,
    step = 1,
    inputmode = 'numeric',
    onSave
  }: Props = $props();

  let currentValue = $state(value);
  let inputRef: HTMLInputElement;
  let saving = $state(false);

  // Sync with external value changes
  $effect(() => {
    currentValue = value;
  });

  // Attach blur event listener using DOM API
  $effect(() => {
    if (!inputRef) return;

    const handler = async () => {
      if (saving) return;

      saving = true;
      try {
        const numValue = currentValue === '' ? null : Number(currentValue);
        await onSave(numValue);
      } catch (error) {
        console.error('Save error:', error);
      } finally {
        saving = false;
      }
    };

    inputRef.addEventListener('blur', handler);
    return () => inputRef.removeEventListener('blur', handler);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Find next input in the form
      const form = inputRef.closest('form');
      if (!form) return;

      const inputs = Array.from(form.querySelectorAll('input, select'));
      const currentIndex = inputs.indexOf(inputRef);
      const nextInput = inputs[currentIndex + 1] as HTMLInputElement | HTMLSelectElement;

      if (nextInput && e.key === 'Enter') {
        e.preventDefault();
        nextInput.focus();
      }
    }
  }
</script>

<div class="mb-3">
  <label class="block text-xs font-medium text-gray-700 mb-1">
    {label}
  </label>
  <div class="relative">
    <input
      bind:this={inputRef}
      type="number"
      bind:value={currentValue}
      on:keydown={handleKeyDown}
      {min}
      {max}
      {step}
      {inputmode}
      disabled={saving}
      class="input w-full"
      class:opacity-50={saving}
    />
    {#if suffix}
      <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
        {suffix}
      </span>
    {/if}
  </div>
</div>
