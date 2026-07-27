<script lang="ts">
	import { page } from '$app/state';

	// Placeholder — le formulaire de saisie (ClientForm, MandatForm...) viendra ici.
	const type = page.url.searchParams.get('type') === 'contrat' ? 'contrat' : 'soumission';
</script>

<section class="rounded-card border border-border-subtle bg-surface p-8 shadow-sm">
	<h1 class="text-2xl font-semibold text-ink">
		{type === 'contrat' ? 'Nouveau contrat' : 'Nouvelle soumission'}
	</h1>
	<p class="mt-2 text-ink-muted">
		Le formulaire de saisie sera intégré ici. Type sélectionné : <strong>{type}</strong>.
	</p>
	<a
		href="/"
		class="mt-6 inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
	>
		← Retour à l'accueil
	</a>
</section>
