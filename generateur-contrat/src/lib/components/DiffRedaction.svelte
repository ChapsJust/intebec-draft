<script lang="ts">
	import { enhance } from '$app/forms';
	import type { BrouillonMandat, RedactionIA } from '$lib/types';
	import { comparerPassages, type Passage } from '$lib/document/diff';
	import { preambuleParDefaut } from '$lib/document/sections';
	import { libelleLigne } from '$lib/document/format';
	import Icon from './Icon.svelte';

	// Ce que l'IA a changé, et ce qu'on en garde. Sans ce panneau, la rédaction remplaçait le document
	// en silence : le gabarit s'affichait, l'IA finissait, la prose était échangée, et rien ne disait
	// où. Le diff est mot par mot pour la lecture, mais la décision se prend par passage, la plus
	// petite tranche de prose qui tienne debout seule.
	let { brouillon, redaction }: { brouillon: BrouillonMandat; redaction: RedactionIA } = $props();

	interface ChampRevu {
		/** Clé stockée dans `redaction.refuses` : `preambule`, `objet`, ou un `LigneService.id`. */
		cle: string;
		libelle: string;
		passages: Passage[];
		/** Vrai quand la saisie était vide : l'IA n'a rien réécrit, elle a écrit. */
		redigeDepuisRien: boolean;
	}

	const champs = $derived.by<ChampRevu[]>(() => {
		const label = libelleLigne(brouillon.structureProjet);
		const candidats: Array<{ cle: string; libelle: string; avant: string; apres?: string }> = [
			{
				cle: 'preambule',
				libelle: 'Préambule',
				avant: preambuleParDefaut(brouillon),
				apres: redaction.preambule
			},
			{ cle: 'objet', libelle: 'Objet du mandat', avant: brouillon.objet, apres: redaction.objet },
			...brouillon.lignes.map((ligne, i) => ({
				cle: ligne.id,
				libelle: `${label} ${i + 1}${ligne.nom.trim() ? ` — ${ligne.nom.trim()}` : ''}`,
				avant: ligne.description,
				apres: redaction.lignes[ligne.id]
			}))
		];

		return candidats
			.map((c) => ({
				cle: c.cle,
				libelle: c.libelle,
				passages: comparerPassages(c.avant, c.apres ?? ''),
				redigeDepuisRien: !c.avant.trim() && Boolean(c.apres?.trim())
			}))
			.filter((c) => c.passages.length > 0);
	});

	const nbPassages = $derived(champs.reduce((n, c) => n + c.passages.length, 0));
	const refuses = $derived(redaction.refuses ?? {});
	const estRefuse = (cle: string, index: number) => (refuses[cle] ?? []).includes(index);
	const nbRefuses = $derived(Object.values(refuses).reduce((n, liste) => n + liste.length, 0));

	const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
</script>

{#if champs.length > 0}
	<details
		class="rounded-card border border-accent-400/30 bg-accent-500/5 print:hidden"
		open={nbRefuses > 0}
	>
		<summary class="group flex cursor-pointer items-center gap-2 p-3 text-sm text-ink">
			<Icon name="sparkles" size={16} />
			<span class="font-medium">Modifications de l’IA</span>
			<span class="text-ink-muted">
				{pluriel(champs.length, 'champ')} · {pluriel(nbPassages, 'passage')}
				{#if nbRefuses > 0}
					· {nbRefuses} revenu{nbRefuses > 1 ? 's' : ''} à votre saisie
				{/if}
			</span>
			<Icon
				name="chevron-down"
				size={16}
				class="ml-auto shrink-0 text-ink-muted transition group-open:rotate-180"
			/>
		</summary>

		<div class="space-y-4 border-t border-accent-400/20 p-3">
			<p class="text-xs text-ink-muted">
				Le texte barré est votre saisie, le texte souligné celui de l’IA. Refuser un passage
				rétablit votre saisie à cet endroit, dans l’aperçu comme dans le PDF, sans toucher au reste.
			</p>

			{#each champs as champ (champ.cle)}
				<div>
					<p class="text-xs font-semibold text-ink">
						{champ.libelle}
						{#if champ.redigeDepuisRien}
							<span class="ml-1 font-normal text-ink-muted">(vous n’aviez rien saisi)</span>
						{/if}
					</p>

					<div class="mt-2 space-y-2">
						{#each champ.passages as passage (passage.index)}
							{@const refuse = estRefuse(champ.cle, passage.index)}
							<div
								class="rounded-lg border p-3 {refuse
									? 'border-border-subtle bg-surface-muted'
									: 'border-accent-400/30 bg-surface'}"
							>
								<p class="text-sm leading-relaxed text-ink">
									{#each passage.mots as mot, i (i)}
										{#if mot.kind === 'egal'}{mot.texte}{:else if mot.kind === 'suppression'}<span
												class="bg-danger/10 text-danger line-through decoration-danger/60"
												>{mot.texte}</span
											>{:else}<span
												class="bg-success/10 text-success underline decoration-success/60"
												>{mot.texte}</span
											>{/if}
									{/each}
								</p>

								<!-- Un formulaire progressif par bouton, comme le reste de l'aperçu : la décision
									est persistée, donc elle survit au rechargement et le PDF la suit. -->
								<form
									method="POST"
									action="?/basculerPassage"
									use:enhance
									class="mt-2 flex items-center gap-3"
								>
									<input type="hidden" name="champ" value={champ.cle} />
									<input type="hidden" name="index" value={passage.index} />
									<input type="hidden" name="refuse" value={refuse ? '0' : '1'} />
									<span class="text-xs text-ink-muted">
										{refuse ? 'Votre saisie est affichée.' : 'Le texte de l’IA est affiché.'}
									</span>
									<button
										type="submit"
										class="ml-auto text-xs font-semibold {refuse
											? 'text-accent-600 hover:text-accent-500'
											: 'text-ink-muted hover:text-ink'}"
									>
										{refuse ? 'Reprendre le texte de l’IA' : 'Revenir à ma saisie'}
									</button>
								</form>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</details>
{/if}
