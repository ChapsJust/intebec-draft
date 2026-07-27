<script lang="ts">
	import ActionCard from './ActionCard.svelte';
	import { APP_TAGLINE } from '$lib/config';
</script>

<section>
	<p class="text-sm font-medium text-accent-500">Bonjour 👋</p>
	<h1 class="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
		Générez vos documents en quelques minutes
	</h1>
	<p class="mt-2 max-w-2xl text-ink-muted">{APP_TAGLINE}</p>

	<div class="mt-6 grid gap-4 sm:grid-cols-2">
		<ActionCard
			href="/nouveau?type=soumission"
			icon="document"
			title="Nouvelle soumission"
			description="Chiffrer un mandat et générer l'offre"
		/>
		<ActionCard
			href="/nouveau?type=contrat"
			icon="contract"
			title="Nouveau contrat"
			description="Rédiger un contrat à partir des gabarits"
		/>
	</div>
</section>
