<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatCad } from '$lib/montants';
	import type { MandatEnregistre } from '$lib/types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const total = $derived(data.mandats.length + data.mandatsArchives.length);
	const libelleMandats = $derived(`${total} mandat${total > 1 ? 's' : ''}`);
</script>

{#snippet ligneMandat(m: MandatEnregistre)}
	<li class="flex flex-wrap items-center gap-3 py-3">
		<a href="/mandats/{m.id}" class="min-w-0 flex-1">
			<span class="block truncate font-medium text-ink">{m.titre || 'Sans titre'}</span>
			<span class="block text-sm text-ink-muted">{formatCad(m.totalNet)}</span>
		</a>
		<StatusBadge status={m.statut} />
		<a
			href="/mandats/{m.id}/pdf"
			class="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-muted"
		>
			<Icon name="download" size={14} />
			PDF
		</a>
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

		{#if m.archiveLe}
			<ConfirmAction
				action="?/desarchiverMandat"
				id={m.id}
				ton="neutre"
				titre="Désarchiver ce mandat ?"
				message="« {m.titre || 'Sans titre'} » réapparaîtra dans les listes courantes."
				confirmLabel="Désarchiver"
				ariaLabel="Désarchiver ce mandat"
				class="inline-flex items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
			>
				<Icon name="archive-restore" size={16} />
			</ConfirmAction>
		{:else}
			<ConfirmAction
				action="?/archiverMandat"
				id={m.id}
				ton="neutre"
				titre="Archiver ce mandat ?"
				message="« {m.titre ||
					'Sans titre'} » sortira de l'accueil et de la liste ci-dessus. Rien n'est supprimé : il restera consultable dans les mandats archivés de cette fiche."
				confirmLabel="Archiver"
				ariaLabel="Archiver ce mandat"
				class="inline-flex items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
			>
				<Icon name="archive" size={16} />
			</ConfirmAction>
		{/if}

		<ConfirmAction
			action="?/supprimerMandat"
			id={m.id}
			titre="Supprimer ce mandat ?"
			message="« {m.titre ||
				'Sans titre'} » sera supprimé définitivement, avec sa rédaction. Cette action est irréversible."
			confirmLabel="Supprimer définitivement"
			ariaLabel="Supprimer ce mandat"
			class="inline-flex items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
		>
			<Icon name="trash" size={16} />
		</ConfirmAction>
	</li>
{/snippet}

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<h1 class="text-2xl font-semibold text-ink">{data.client.nom}</h1>
			{#if data.client.archiveLe}
				<span
					class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
				>
					Archivé
				</span>
			{/if}
		</div>
		<a
			href="/clients"
			class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
		>
			← Retour aux clients
		</a>
	</div>

	{#if form?.notice}
		<p
			class="rounded-card border border-border-subtle bg-surface px-4 py-3 text-sm text-ink-muted shadow-sm"
		>
			{form.notice}
		</p>
	{/if}

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

		<div class="mt-6 flex flex-wrap gap-3 border-t border-border-subtle pt-4">
			{#if data.client.archiveLe}
				<ConfirmAction
					action="?/desarchiver"
					ton="neutre"
					titre="Désarchiver {data.client.nom} ?"
					message="La fiche revient dans la liste des clients, avec les mandats archivés en même temps qu'elle. Ceux que vous aviez archivés séparément restent archivés."
					confirmLabel="Désarchiver"
					class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
				>
					<Icon name="archive-restore" size={16} />
					Désarchiver ce client
				</ConfirmAction>
			{:else}
				<ConfirmAction
					action="?/archiver"
					ton="neutre"
					titre="Archiver {data.client.nom} ?"
					message="La fiche et ses {libelleMandats} sortent des listes courantes. Rien n'est supprimé : un désarchivage remet tout en place."
					confirmLabel="Archiver"
					class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
				>
					<Icon name="archive" size={16} />
					Archiver ce client
				</ConfirmAction>
			{/if}

			<ConfirmAction
				action="?/supprimer"
				motCle={data.client.nom}
				titre="Supprimer {data.client.nom} ?"
				message="La fiche et ses {libelleMandats} seront détruits définitivement, brouillons comme documents générés. Cette action est irréversible : si vous voulez seulement les mettre de côté, archivez plutôt."
				confirmLabel="Supprimer définitivement"
				class="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
			>
				<Icon name="trash" size={16} />
				Supprimer ce client
			</ConfirmAction>
		</div>
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
			<p class="mt-4 text-sm text-ink-muted">Aucun mandat actif pour ce client.</p>
		{:else}
			<ul class="mt-4 divide-y divide-border-subtle">
				{#each data.mandats as m (m.id)}
					{@render ligneMandat(m)}
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.mandatsArchives.length > 0}
		<section class="section-card">
			<h2 class="text-lg font-semibold text-ink">
				Mandats archivés ({data.mandatsArchives.length})
			</h2>
			<p class="mt-1 text-sm text-ink-muted">
				Conservés mais retirés des listes courantes. Désarchivez pour les y remettre.
			</p>
			<ul class="mt-4 divide-y divide-border-subtle opacity-75">
				{#each data.mandatsArchives as m (m.id)}
					{@render ligneMandat(m)}
				{/each}
			</ul>
		</section>
	{/if}
</div>
