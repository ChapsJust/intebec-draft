<script lang="ts">
	import ActionCard from './ActionCard.svelte';
	import { APP_TAGLINE } from '$domaine/config';
</script>

<section>
	<h1 class="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
		Générez vos documents en quelques minutes
	</h1>
	<p class="mt-2 max-w-2xl text-ink-muted">{APP_TAGLINE}</p>

	<div class="mt-6">
		<ActionCard
			href="/nouveau"
			icon="sparkles"
			title="Nouveau document"
			description="Soumission ou contrat : le type se précise dans le formulaire"
		/>
	</div>
</section>
