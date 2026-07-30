<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import FormSection from '$lib/components/FormSection.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { FicheClientListee } from '$domaine/types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const mandats = (n: number) => `${n} mandat${n > 1 ? 's' : ''}`;

	let recherche = $state('');

	/** Recherche sans accents ni casse : taper « riviere » doit trouver « Rivière ». */
	function aplatir(valeur: string): string {
		return valeur
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	/** Filtrage côté navigateur : à cette échelle, quelques centaines de fiches au plus, la liste
	 * est déjà chargée et un aller-retour serveur par frappe n'apporterait rien. */
	function filtrer(liste: FicheClientListee[]): FicheClientListee[] {
		const terme = aplatir(recherche.trim());
		if (!terme) return liste;
		return liste.filter((c) =>
			[c.nom, c.representantNom, c.courriel, c.telephone, c.numeroEntreprise]
				.filter(Boolean)
				.some((champ) => aplatir(champ).includes(terme))
		);
	}

	const clientsVisibles = $derived(filtrer(data.clients));
	const archivesVisibles = $derived(filtrer(data.archives));
</script>

{#snippet actionsClient(c: FicheClientListee)}
	{#if c.archiveLe}
		<ConfirmAction
			action="?/desarchiver"
			id={c.id}
			ton="neutre"
			titre="Désarchiver {c.nom} ?"
			message="La fiche revient dans la liste des clients, ainsi que les mandats archivés en même temps qu'elle. Les mandats que vous aviez archivés séparément restent archivés."
			confirmLabel="Désarchiver"
			ariaLabel="Désarchiver ce client"
			class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
		>
			<Icon name="archive-restore" size={16} />
		</ConfirmAction>
	{:else}
		<ConfirmAction
			action="?/archiver"
			id={c.id}
			ton="neutre"
			titre="Archiver {c.nom} ?"
			message="La fiche et ses {mandats(
				c.nbMandats
			)} sortent des listes courantes. Rien n'est supprimé : vous pourrez tout remettre en place en désarchivant le client."
			confirmLabel="Archiver"
			ariaLabel="Archiver ce client"
			class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
		>
			<Icon name="archive" size={16} />
		</ConfirmAction>
	{/if}

	<ConfirmAction
		action="?/supprimer"
		id={c.id}
		motCle={c.nom}
		titre="Supprimer {c.nom} ?"
		message="La fiche et ses {mandats(
			c.nbMandats
		)} seront détruits définitivement, brouillons comme documents générés. Cette action est irréversible : si vous voulez seulement les mettre de côté, archivez plutôt."
		confirmLabel="Supprimer définitivement"
		ariaLabel="Supprimer ce client"
		class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border-subtle p-2 text-ink-muted transition hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
	>
		<Icon name="trash" size={16} />
	</ConfirmAction>
{/snippet}

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-ink">Clients</h1>
		<a
			href="/"
			class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
		>
			← Retour à l'accueil
		</a>
	</div>

	{#if form?.notice}
		<p
			class="rounded-card border border-border-subtle bg-surface px-4 py-3 text-sm text-ink-muted shadow-sm"
		>
			{form.notice}
		</p>
	{/if}

	<FormSection title="Nouveau client" collapsible defaultOpen={data.clients.length === 0}>
		<form method="POST" action="?/creer" use:enhance class="space-y-5">
			{#if form?.message}
				<p class="text-sm text-warning">{form.message}</p>
			{/if}
			<div class="grid gap-5 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label class="field-label" for="nom">Nom du client</label>
					<input
						id="nom"
						name="nom"
						class="field-input"
						type="text"
						required
						placeholder="Ex. Constructions Rivard"
					/>
				</div>
				<div>
					<label class="field-label" for="typeClient">Type</label>
					<select id="typeClient" name="typeClient" class="field-input">
						<option value="entreprise">Entreprise</option>
						<option value="obnl">OBNL</option>
						<option value="particulier">Particulier</option>
					</select>
				</div>
				<div>
					<label class="field-label" for="numeroEntreprise">Numéro d'entreprise (NE)</label>
					<input
						id="numeroEntreprise"
						name="numeroEntreprise"
						class="field-input"
						type="text"
						placeholder="Optionnel"
					/>
				</div>
				<div class="sm:col-span-2">
					<label class="field-label" for="adresse">Adresse</label>
					<input id="adresse" name="adresse" class="field-input" type="text" />
				</div>
				<div>
					<label class="field-label" for="representantNom">Représentant</label>
					<input id="representantNom" name="representantNom" class="field-input" type="text" />
				</div>
				<div>
					<label class="field-label" for="representantTitre">Titre</label>
					<input
						id="representantTitre"
						name="representantTitre"
						class="field-input"
						type="text"
						placeholder="Ex. Directrice"
					/>
				</div>
				<div>
					<label class="field-label" for="courriel">Courriel</label>
					<input id="courriel" name="courriel" class="field-input" type="email" />
				</div>
				<div>
					<label class="field-label" for="telephone">Téléphone</label>
					<input id="telephone" name="telephone" class="field-input" type="tel" />
				</div>
				<div class="sm:col-span-2">
					<label class="field-label" for="siteWeb">Site web</label>
					<input
						id="siteWeb"
						name="siteWeb"
						class="field-input"
						type="text"
						placeholder="Optionnel"
					/>
				</div>
			</div>
			<button
				type="submit"
				class="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
			>
				Créer le client
			</button>
		</form>
	</FormSection>

	{#if data.clients.length > 0}
		<div class="flex items-center gap-3">
			<label class="sr-only" for="recherche-client">Rechercher un client</label>
			<input
				id="recherche-client"
				class="field-input"
				type="search"
				bind:value={recherche}
				placeholder="Rechercher par nom, représentant, courriel, téléphone ou NE…"
			/>
			{#if recherche}
				<span class="shrink-0 text-sm text-ink-muted">
					{clientsVisibles.length} / {data.clients.length}
				</span>
			{/if}
		</div>
	{/if}

	<div class="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-sm">
		{#if data.clients.length === 0}
			<p class="px-6 py-12 text-center text-sm text-ink-muted">Aucun client pour l'instant.</p>
		{:else if clientsVisibles.length === 0}
			<p class="px-6 py-12 text-center text-sm text-ink-muted">
				Aucun client ne correspond à « {recherche} ».
			</p>
		{:else}
			<ul class="divide-y divide-border-subtle">
				{#each clientsVisibles as c (c.id)}
					<li class="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-muted">
						<a href="/clients/{c.id}" class="flex min-w-0 flex-1 items-center gap-4">
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
							>
								<Icon name="user" size={18} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium text-ink">{c.nom}</span>
								<span class="block truncate text-sm text-ink-muted">
									{[c.representantNom, c.courriel, mandats(c.nbMandats)]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</span>
						</a>
						{@render actionsClient(c)}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if archivesVisibles.length > 0}
		<FormSection
			title="Clients archivés ({archivesVisibles.length})"
			collapsible
			defaultOpen={false}
		>
			<p class="mb-4 text-sm text-ink-muted">
				Ces fiches et les mandats archivés avec elles n'apparaissent plus dans les listes courantes.
				Désarchivez pour les remettre en circulation.
			</p>
			<ul class="divide-y divide-border-subtle">
				{#each archivesVisibles as c (c.id)}
					<li class="flex items-center gap-3 py-3">
						<a href="/clients/{c.id}" class="min-w-0 flex-1">
							<span class="block truncate font-medium text-ink">{c.nom}</span>
							<span class="block truncate text-sm text-ink-muted">
								Archivé le {new Date(c.archiveLe ?? c.majLe).toLocaleDateString('fr-CA')} ·
								{mandats(c.nbMandats)}
							</span>
						</a>
						{@render actionsClient(c)}
					</li>
				{/each}
			</ul>
		</FormSection>
	{/if}
</div>
