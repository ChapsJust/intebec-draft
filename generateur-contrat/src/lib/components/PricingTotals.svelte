<script lang="ts">
	import type { ServiceLine } from '$lib/types';
	import { subtotal, rabaisAmount, totalNet, formatCad } from '$lib/pricing';
	import FormSection from './FormSection.svelte';

	let {
		lignes,
		rabaisPct = $bindable(),
		rabaisMotif = $bindable()
	}: {
		lignes: ServiceLine[];
		rabaisPct: number;
		rabaisMotif: string;
	} = $props();

	const st = $derived(subtotal(lignes));
	const rabais = $derived(rabaisAmount(st, rabaisPct));
	const total = $derived(totalNet(lignes, rabaisPct));
</script>

<FormSection title="Prix" description="Récapitulatif calculé à partir des lignes ci-dessus.">
	<div class="rounded-lg bg-surface-muted p-4 text-sm">
		<div class="flex justify-between py-1">
			<span class="text-ink-muted">Sous-total</span>
			<span class="font-medium text-ink">{formatCad(st)}</span>
		</div>
		{#if rabaisPct > 0}
			<div class="flex justify-between py-1">
				<span class="text-ink-muted">Rabais ({rabaisPct}%)</span>
				<span class="font-medium text-ink">-{formatCad(rabais)}</span>
			</div>
		{/if}
		<div class="flex justify-between border-t border-border-subtle py-2 text-base">
			<span class="font-semibold text-ink">Total net (taxes en sus)</span>
			<span class="font-semibold text-ink">{formatCad(total)}</span>
		</div>
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<div>
			<label class="field-label" for="rabais-pct">Rabais (%)</label>
			<input
				id="rabais-pct"
				class="field-input"
				type="number"
				min="0"
				max="100"
				step="1"
				bind:value={rabaisPct}
			/>
		</div>
		<div>
			<label class="field-label" for="rabais-motif">Motif du rabais</label>
			<input
				id="rabais-motif"
				class="field-input"
				type="text"
				bind:value={rabaisMotif}
				placeholder="Optionnel"
				disabled={rabaisPct === 0}
			/>
		</div>
	</div>
</FormSection>
