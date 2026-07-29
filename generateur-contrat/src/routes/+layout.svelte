<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	// L'écran de connexion se passe de navigation : les liens qu'elle contient mènent tous à des
	// pages inaccessibles avant d'être connecté.
	const chrome = $derived(Boolean(data.utilisateur));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Le chrome applicatif est masqué à l'impression : la page d'aperçu peut ainsi garder la
	navigation à l'écran tout en ne sortant que le document sur papier. -->
<div class="flex min-h-screen flex-col">
	{#if chrome}
		<div class="print:hidden"><AppHeader utilisateur={data.utilisateur} /></div>
	{/if}
	<main
		class="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0"
	>
		{@render children()}
	</main>
	{#if chrome}
		<div class="print:hidden"><AppFooter /></div>
	{/if}
</div>
