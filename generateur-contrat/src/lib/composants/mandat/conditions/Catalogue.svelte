<script lang="ts">
	import type { ConditionsParticulieres } from '$domaine/types';
	import { CLES_CLAUSES, LIBELLES_CLAUSES } from '$document/catalogue';

	let { conditions = $bindable() }: { conditions: ConditionsParticulieres } = $props();
</script>

<div>
	<span class="field-label">Clauses standards à inclure</span>
	<div class="space-y-2">
		{#each CLES_CLAUSES as cle (cle)}
			<label class="flex items-center gap-2 text-sm text-ink">
				<input
					type="checkbox"
					bind:checked={conditions.clauses[cle]}
					class="rounded text-accent-500 focus:ring-accent-500"
				/>
				{LIBELLES_CLAUSES[cle]}
			</label>
		{/each}
	</div>
</div>
