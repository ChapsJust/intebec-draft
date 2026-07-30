<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';

	// Garde-fou unique pour tous les gestes destructeurs : rien n'est posté tant que la boîte de
	// dialogue n'a pas été confirmée. `motCle` ajoute une seconde vérification — recopier le nom —
	// réservée à l'irréversible : archiver se défait, supprimer non.
	let {
		action,
		id = undefined,
		titre,
		message,
		confirmLabel = 'Confirmer',
		motCle = '',
		ton = 'danger',
		class: klass = '',
		ariaLabel = undefined,
		children
	}: {
		action: string;
		id?: string;
		titre: string;
		message: string;
		confirmLabel?: string;
		motCle?: string;
		ton?: 'danger' | 'neutre';
		class?: string;
		ariaLabel?: string;
		children: Snippet;
	} = $props();

	let dialogue = $state<HTMLDialogElement>();
	let saisie = $state('');
	let enCours = $state(false);

	const normalise = (v: string) => v.trim().toLocaleLowerCase('fr-CA');
	const pretAConfirmer = $derived(motCle === '' || normalise(saisie) === normalise(motCle));
</script>

<button
	type="button"
	class={klass}
	aria-label={ariaLabel}
	title={ariaLabel}
	onclick={() => dialogue?.showModal()}
>
	{@render children()}
</button>

<dialog
	bind:this={dialogue}
	onclose={() => {
		saisie = '';
		enCours = false;
	}}
	class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-border-subtle bg-surface p-0 text-ink shadow-lg backdrop:bg-slate-900/40"
>
	<form
		method="POST"
		{action}
		class="space-y-4 p-6"
		use:enhance={() => {
			enCours = true;
			return async ({ update }) => {
				dialogue?.close();
				await update({ reset: false });
			};
		}}
	>
		{#if id}
			<input type="hidden" name="id" value={id} />
		{/if}

		<h2 class="text-lg font-semibold text-ink">{titre}</h2>
		<p class="text-sm text-ink-muted">{message}</p>

		{#if motCle}
			<div>
				<label class="field-label" for="confirmation-{action}-{id ?? 'page'}">
					Tapez <span class="font-semibold text-ink">{motCle}</span> pour confirmer
				</label>
				<input
					id="confirmation-{action}-{id ?? 'page'}"
					class="field-input"
					type="text"
					autocomplete="off"
					bind:value={saisie}
				/>
			</div>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				class="inline-flex items-center rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
				onclick={() => dialogue?.close()}
			>
				Annuler
			</button>
			<button
				type="submit"
				disabled={!pretAConfirmer || enCours}
				class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 {ton ===
				'danger'
					? 'bg-danger hover:bg-danger-strong'
					: 'bg-accent-500 hover:bg-accent-600'}"
			>
				{confirmLabel}
			</button>
		</div>
	</form>
</dialog>
