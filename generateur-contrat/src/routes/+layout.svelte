<script lang="ts">
	import './layout.css';
	import favicon from '$lib/ressources/favicon.svg';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Le chrome applicatif est masqué à l'impression : la page d'aperçu peut ainsi garder la
	navigation à l'écran tout en ne sortant que le document sur papier. -->
<div class="flex min-h-screen flex-col">
	<div class="print:hidden"><AppHeader utilisateur={data.utilisateur} /></div>
	<main
		class="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0"
	>
		{@render children()}
	</main>
	<div class="print:hidden"><AppFooter /></div>
</div>
