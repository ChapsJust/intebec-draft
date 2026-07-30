<script lang="ts">
	import LigneDocument from './LigneDocument.svelte';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
	import Icone from '$composants/ui/Icone.svelte';
	import type { ResumeDocument } from '$domaine/types';

	let { documents, archives = [] }: { documents: ResumeDocument[]; archives?: ResumeDocument[] } =
		$props();
</script>

<section class="mt-10">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-ink">Documents récents</h2>
		{#if documents.length > 0}
			<a
				href="/clients"
				class="flex items-center gap-1 text-sm font-medium text-accent-500 hover:text-accent-600"
			>
				Clients
				<Icone name="arrow-right" size={16} />
			</a>
		{/if}
	</div>

	<div class="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-sm">
		{#if documents.length === 0}
			<div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
				<span
					class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"
				>
					<Icone name="document" size={24} />
				</span>
				<div>
					<p class="font-medium text-ink">Aucun document pour l'instant</p>
					<p class="mt-1 text-sm text-ink-muted">
						Créez votre premier document pour le retrouver ici.
					</p>
				</div>
				<a
					href="/nouveau"
					class="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
				>
					<Icone name="plus" size={16} />
					Nouveau document
				</a>
			</div>
		{:else}
			<ul class="divide-y divide-border-subtle">
				{#each documents as doc (doc.id)}
					<li>
						<LigneDocument {doc} />
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if archives.length > 0}
		<div class="mt-6">
			<SectionFormulaire
				title="Documents archivés ({archives.length})"
				collapsible
				defaultOpen={false}
			>
				<p class="text-sm text-ink-muted">
					Retirés des documents récents, mais conservés. Désarchivez pour les y remettre.
				</p>
				<ul class="divide-y divide-border-subtle opacity-75">
					{#each archives as doc (doc.id)}
						<li>
							<LigneDocument {doc} />
						</li>
					{/each}
				</ul>
			</SectionFormulaire>
		</div>
	{/if}
</section>
