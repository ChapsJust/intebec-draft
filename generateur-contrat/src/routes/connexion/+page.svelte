<script lang="ts">
	import { APP_NAME, APP_TAGLINE } from '$lib/config';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Connexion · {APP_NAME}</title></svelte:head>

<div class="mx-auto flex max-w-sm flex-col justify-center py-12">
	<div class="mb-8 text-center">
		<span
			class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-xl font-semibold text-white"
		>
			{APP_NAME.charAt(0)}
		</span>
		<h1 class="mt-4 text-xl font-semibold text-ink">{APP_NAME}</h1>
		<p class="mt-1 text-sm text-ink-muted">{APP_TAGLINE}</p>
	</div>

	<form
		method="POST"
		action="?/connexion"
		class="space-y-4 rounded-card border border-border-subtle bg-surface p-6 shadow-sm"
	>
		<input type="hidden" name="suite" value={data.suite} />

		<div>
			<label class="field-label" for="nom">Identifiant</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="nom"
				name="nom"
				class="field-input"
				autocomplete="username"
				autofocus
				required
				value={form?.nom ?? ''}
			/>
		</div>

		<div>
			<label class="field-label" for="motDePasse">Mot de passe</label>
			<input
				id="motDePasse"
				name="motDePasse"
				type="password"
				class="field-input"
				autocomplete="current-password"
				required
			/>
		</div>

		{#if form?.message}
			<p class="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
				{form.message}
			</p>
		{/if}

		<button
			type="submit"
			class="w-full rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
		>
			Se connecter
		</button>
	</form>

	<p class="mt-4 text-center text-xs text-ink-muted">
		Application interne. Les accès sont créés à la main : voir la section « Accès » du README.
	</p>
</div>
