<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import FormSection from '$lib/components/FormSection.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

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

	<div class="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-sm">
		{#if data.clients.length === 0}
			<p class="px-6 py-12 text-center text-sm text-ink-muted">Aucun client pour l'instant.</p>
		{:else}
			<ul class="divide-y divide-border-subtle">
				{#each data.clients as c (c.id)}
					<li>
						<a
							href="/clients/{c.id}"
							class="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-muted"
						>
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
							>
								<Icon name="user" size={18} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium text-ink">{c.nom}</span>
								<span class="block truncate text-sm text-ink-muted">
									{[c.representantNom, c.courriel].filter(Boolean).join(' · ')}
								</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
