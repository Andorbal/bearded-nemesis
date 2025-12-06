<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import Toast from '$lib/components/Toast.svelte';

  let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50">
  <Nav />
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>
  <Toast />
</div>
