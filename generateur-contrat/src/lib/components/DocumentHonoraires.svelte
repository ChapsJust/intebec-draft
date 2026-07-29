<script lang="ts">
	import type { ContenuSection } from '$lib/document/sections';

	let { contenu }: { contenu: Extract<ContenuSection, { kind: 'honoraires' }> } = $props();
</script>

<table class="tableau tableau-honoraires">
	<thead>
		<tr>
			<th scope="col">Désignation</th>
			<th scope="col">Détail</th>
			<th scope="col">Délai</th>
			<th scope="col" class="col-montant">Montant</th>
		</tr>
	</thead>
	<tbody>
		{#each contenu.lignes as ligne, i (i)}
			<tr>
				<td>
					<span class="cellule-label">{ligne.label}</span>
					<span class="cellule-nom">{ligne.nom}</span>
				</td>
				<td class="cellule-detail">
					{#each ligne.details as detail (detail)}
						<span>{detail}</span>
					{/each}
				</td>
				<td class="cellule-detail"><span>{ligne.delai || 'À convenir'}</span></td>
				<td class="col-montant">{ligne.montant}</td>
			</tr>
		{/each}
	</tbody>
	<tfoot>
		<tr class="rang-sous-total">
			<td colspan="3">Sous-total</td>
			<td class="col-montant">{contenu.sousTotal}</td>
		</tr>
		{#if contenu.rabais}
			<tr class="rang-rabais">
				<td colspan="3">
					Rabais ({contenu.rabais.pct}&nbsp;%)
					{#if contenu.rabais.motif}
						<span class="rabais-motif">{contenu.rabais.motif}</span>
					{/if}
				</td>
				<td class="col-montant">{contenu.rabais.montant}</td>
			</tr>
		{/if}
		<tr class="rang-total">
			<td colspan="3">Total <span class="rang-total-note">avant taxes</span></td>
			<td class="col-montant">{contenu.total}</td>
		</tr>
	</tfoot>
</table>
