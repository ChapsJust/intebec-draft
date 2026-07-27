<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import Icon from '$lib/components/Icon.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatCad } from '$lib/pricing';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-ink">{data.client.nom}</h1>
		<a
			href="/clients"
			class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
		>
			← Retour aux clients
		</a>
	</div>

	<section class="section-card">
		<h2 class="text-lg font-semibold text-ink">Coordonnées</h2>
		<dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
			<div>
				<dt class="text-ink-muted">Représentant</dt>
				<dd class="text-ink">
					{[data.client.representantNom, data.client.representantTitre]
						.filter(Boolean)
						.join(' · ') || 'Non renseigné'}
				</dd>
			</div>
			<div>
				<dt class="text-ink-muted">Type</dt>
				<dd class="text-ink capitalize">{data.client.typeClient}</dd>
			</div>
			<div>
				<dt class="text-ink-muted">Courriel</dt>
				<dd class="text-ink">{data.client.courriel || 'Non renseigné'}</dd>
			</div>
			<div>
				<dt class="text-ink-muted">Téléphone</dt>
				<dd class="text-ink">{data.client.telephone || 'Non renseigné'}</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="text-ink-muted">Adresse</dt>
				<dd class="text-ink">{data.client.adresse || 'Non renseigné'}</dd>
			</div>
		</dl>
		<form
			method="POST"
			action="?/archiver"
			use:enhance
			class="mt-6 border-t border-border-subtle pt-4"
		>
			<button type="submit" class="text-sm font-medium text-ink-muted hover:text-warning">
				Archiver ce client
			</button>
		</form>
	</section>

	<section class="section-card">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-ink">Mandats</h2>
			<a
				href="/nouveau"
				class="hover:text-accent-700 inline-flex items-center gap-1.5 text-sm font-medium text-accent-600"
			>
				<Icon name="plus" size={16} />
				Nouveau mandat
			</a>
		</div>

		{#if data.mandats.length === 0}
			<p class="mt-4 text-sm text-ink-muted">Aucun mandat pour ce client pour l'instant.</p>
		{:else}
			<ul class="mt-4 divide-y divide-border-subtle">
				{#each data.mandats as m (m.id)}
					<li class="flex items-center gap-4 py-3">
						<a href="/mandats/{m.id}" class="min-w-0 flex-1">
							<span class="block truncate font-medium text-ink">{m.titre || 'Sans titre'}</span>
							<span class="block text-sm text-ink-muted">{formatCad(m.totalNet)}</span>
						</a>
						<StatusBadge status={m.statut} />
						<form method="POST" action="?/dupliquer" use:enhance>
							<input type="hidden" name="id" value={m.id} />
							<button
								type="submit"
								class="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-muted"
							>
								<Icon name="copy" size={14} />
								Dupliquer
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
