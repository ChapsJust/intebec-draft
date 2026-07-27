<script lang="ts">
	import type { DocumentType, StructureProjet } from '$lib/types';
	import FormSection from './FormSection.svelte';
	import Icon from './Icon.svelte';

	let {
		type = $bindable(),
		titre = $bindable(),
		structureProjet = $bindable(),
		objet = $bindable()
	}: {
		type: DocumentType;
		titre: string;
		structureProjet: StructureProjet;
		objet: string;
	} = $props();

	const types: {
		value: DocumentType;
		label: string;
		description: string;
		icon: 'document' | 'contract';
	}[] = [
		{
			value: 'soumission',
			label: 'Soumission',
			description: 'Offre de prix à faire approuver par le client',
			icon: 'document'
		},
		{
			value: 'contrat',
			label: 'Contrat',
			description: 'Entente formalisée, prête à signer',
			icon: 'contract'
		}
	];

	const structures: { value: StructureProjet; label: string; description: string }[] = [
		{
			value: 'phases',
			label: 'Par phases',
			description: 'Étapes séquentielles, chacune conditionnelle à la précédente.'
		},
		{
			value: 'blocs',
			label: 'Par blocs',
			description: 'Services indépendants, réalisables en parallèle.'
		},
		{
			value: 'recurrent',
			label: 'Service récurrent',
			description: 'Abonnement continu sans découpage en livrables distincts.'
		}
	];
</script>

<FormSection title="Mandat" description="Informations générales du document.">
	<div>
		<span class="field-label">Type de document</span>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each types as t (t.value)}
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition {type ===
					t.value
						? 'border-accent-500 bg-accent-400/5 ring-1 ring-accent-500'
						: 'border-border-subtle hover:border-accent-400'}"
				>
					<span
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
					>
						<Icon name={t.icon} size={20} />
					</span>
					<span class="flex-1">
						<span class="flex items-center gap-2 font-medium text-ink">
							<input
								type="radio"
								name="documentType"
								value={t.value}
								bind:group={type}
								class="text-accent-500 focus:ring-accent-500"
							/>
							{t.label}
						</span>
						<span class="block text-xs text-ink-muted">{t.description}</span>
					</span>
				</label>
			{/each}
		</div>
	</div>

	<div>
		<label class="field-label" for="mandat-titre">Titre du projet</label>
		<input
			id="mandat-titre"
			class="field-input"
			type="text"
			bind:value={titre}
			placeholder="Ex. Transformation numérique"
		/>
	</div>

	<div>
		<span class="field-label">Structure du projet</span>
		<div class="grid gap-3 sm:grid-cols-3">
			{#each structures as s (s.value)}
				<label
					class="flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition {structureProjet ===
					s.value
						? 'border-accent-500 bg-accent-400/5 ring-1 ring-accent-500'
						: 'border-border-subtle hover:border-accent-400'}"
				>
					<span class="flex items-center gap-2 font-medium text-ink">
						<input
							type="radio"
							name="structureProjet"
							value={s.value}
							bind:group={structureProjet}
							class="text-accent-500 focus:ring-accent-500"
						/>
						{s.label}
					</span>
					<span class="text-xs text-ink-muted">{s.description}</span>
				</label>
			{/each}
		</div>
	</div>

	<div>
		<label class="field-label" for="mandat-objet">Objet du mandat</label>
		<textarea
			id="mandat-objet"
			class="field-input"
			rows="3"
			bind:value={objet}
			placeholder="Décrivez brièvement le mandat…"
		></textarea>
	</div>
</FormSection>
