<script lang="ts">
	import Icon from './Icon.svelte';

	// Aide ponctuelle à la rédaction d'un champ. La proposition n'est jamais appliquée d'office :
	// l'utilisateur la lit, puis choisit de remplacer son texte ou de l'ignorer.
	let {
		champ,
		rediger,
		appliquer,
		label = 'Rédiger avec l’IA'
	}: {
		champ: string;
		rediger: (champ: string) => Promise<string>;
		appliquer: (texte: string) => void;
		label?: string;
	} = $props();

	let enCours = $state(false);
	let proposition = $state<string | null>(null);
	let erreur = $state<string | null>(null);

	async function demander() {
		enCours = true;
		erreur = null;
		proposition = null;
		try {
			proposition = await rediger(champ);
		} catch (err) {
			erreur = err instanceof Error ? err.message : 'La rédaction a échoué.';
		} finally {
			enCours = false;
		}
	}

	function accepter() {
		if (proposition) appliquer(proposition);
		proposition = null;
	}
</script>

<button
	type="button"
	onclick={demander}
	disabled={enCours}
	class="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 transition hover:text-accent-500 disabled:opacity-60"
>
	<Icon name="sparkles" size={14} />
	{enCours ? 'Rédaction en cours…' : label}
</button>

{#if erreur}
	<p class="mt-1 text-xs text-warning">{erreur}</p>
{/if}

{#if proposition}
	<div class="mt-2 rounded-lg border border-accent-400/40 bg-accent-500/5 p-3">
		<p class="text-xs font-medium text-ink-muted">Proposition de l’IA locale</p>
		<p class="mt-1 text-sm whitespace-pre-line text-ink">{proposition}</p>
		<div class="mt-2 flex gap-3">
			<button
				type="button"
				onclick={accepter}
				class="text-xs font-semibold text-accent-600 hover:text-accent-500"
			>
				Utiliser ce texte
			</button>
			<button
				type="button"
				onclick={() => (proposition = null)}
				class="text-xs font-medium text-ink-muted hover:text-ink"
			>
				Ignorer
			</button>
		</div>
	</div>
{/if}
