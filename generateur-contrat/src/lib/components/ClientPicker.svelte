<script lang="ts">
	import type { FicheClient } from '$domaine/types';

	let {
		clients,
		onselect,
		onnew
	}: {
		clients: FicheClient[];
		onselect: (id: string) => void;
		onnew: () => void;
	} = $props();
</script>

<div class="flex flex-wrap items-end gap-3">
	<div class="min-w-56 flex-1">
		<label class="field-label" for="client-picker">Client</label>
		<select
			id="client-picker"
			class="field-input"
			value=""
			onchange={(e) => {
				const id = e.currentTarget.value;
				if (id) onselect(id);
			}}
		>
			<option value="" disabled>Choisir un client existant…</option>
			{#each clients as c (c.id)}
				<option value={c.id}>{c.nom}</option>
			{/each}
		</select>
	</div>
	<button
		type="button"
		class="inline-flex items-center gap-2 rounded-lg border border-dashed border-border-subtle px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:border-accent-400 hover:text-accent-600"
		onclick={onnew}
	>
		+ Nouveau client
	</button>
</div>
