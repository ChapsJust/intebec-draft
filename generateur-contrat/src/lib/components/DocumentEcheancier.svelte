<script lang="ts">
	import type { ContenuSection } from '$document/sections';

	let { contenu }: { contenu: Extract<ContenuSection, { kind: 'echeancier' }> } = $props();
</script>

<table class="tableau tableau-echeancier">
	<thead>
		<tr>
			<th scope="col">Versement</th>
			<th scope="col">Échéance</th>
			<th scope="col" class="col-montant">Montant</th>
		</tr>
	</thead>
	<tbody>
		{#each contenu.versements as versement, i (i)}
			<tr>
				<td class="cellule-forte">{versement.libelle}</td>
				<td class="cellule-detail"><span>{versement.echeance}</span></td>
				<td class="col-montant">{versement.montant}</td>
			</tr>
		{/each}
	</tbody>
</table>
{#each contenu.notes as note (note)}
	<p class="note">{note}</p>
{/each}
