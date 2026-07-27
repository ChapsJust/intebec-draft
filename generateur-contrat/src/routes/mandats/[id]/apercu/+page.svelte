<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import DocumentView from '$lib/components/DocumentView.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { formatDateLongue } from '$lib/document/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let redactionEnCours = $state(false);

	const mandat = $derived(data.mandat);
	const redaction = $derived(mandat.redaction);
</script>

<svelte:head>
	<title>{mandat.titre || 'Document'} · aperçu</title>
</svelte:head>

<div class="space-y-4 print:space-y-0">
	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface p-4 shadow-sm print:hidden"
	>
		<a
			href="/mandats/{mandat.id}"
			class="inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition hover:text-ink"
		>
			← Modifier le mandat
		</a>
		<div class="flex flex-wrap gap-3">
			<form
				method="POST"
				action="?/rediger"
				use:enhance={() => {
					redactionEnCours = true;
					return async ({ update }) => {
						await update();
						redactionEnCours = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={redactionEnCours}
					class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:opacity-60"
				>
					<Icon name="sparkles" size={16} />
					{redactionEnCours
						? 'Rédaction en cours…'
						: redaction
							? 'Relancer la rédaction'
							: 'Rédiger avec l’IA'}
				</button>
			</form>

			{#if redaction}
				<form method="POST" action="?/effacerRedaction" use:enhance>
					<button
						type="submit"
						class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-muted hover:text-ink"
					>
						Revenir à ma saisie
					</button>
				</form>
			{/if}

			<!-- Le PDF est produit côté serveur : c'est la seule voie qui permet une numérotation
				« Page X sur Y », le nombre total de pages n'étant pas accessible au CSS. -->
			<a
				href="/mandats/{mandat.id}/pdf"
				class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
			>
				<Icon name="download" size={16} />
				Télécharger le PDF
			</a>
		</div>
	</div>

	{#if form?.message}
		<div
			class="rounded-card border p-4 text-sm print:hidden {form.ok
				? 'border-success/30 bg-success/5 text-success'
				: 'border-warning/30 bg-warning/5 text-warning'}"
		>
			{form.message}
		</div>
	{/if}

	{#if data.iaIndisponible && !redaction}
		<div
			class="flex flex-wrap items-center gap-2 rounded-card border border-warning/30 bg-warning/5 p-3 text-sm text-warning print:hidden"
		>
			<Icon name="sparkles" size={16} />
			<span>
				L’IA locale n’a pas pu être jointe : le document ci-dessous reprend votre saisie telle
				quelle, sans adaptation. Démarrez Ollama, puis relancez la rédaction.
			</span>
		</div>
	{/if}

	{#if redaction}
		<div
			class="flex flex-wrap items-center gap-2 rounded-card border border-accent-400/30 bg-accent-500/5 p-3 text-sm text-ink-muted print:hidden"
		>
			<Icon name="sparkles" size={16} />
			<span>
				La prose affichée a été rédigée par l’IA locale ({redaction.modele}) le
				{formatDateLongue(redaction.genereLe)}. Les montants, dates et clauses restent ceux de votre
				saisie.
			</span>
		</div>
	{/if}

	<div
		class="overflow-hidden rounded-card border border-border-subtle shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none"
	>
		<DocumentView draft={mandat.draft} {redaction} />
	</div>
</div>
