<script lang="ts">
	import type { BlocSignature } from '$document/modele';

	let { signatures, enFoiDeQuoi }: { signatures: BlocSignature[]; enFoiDeQuoi: string } = $props();
</script>

<section class="signatures">
	<h2 class="section-titre section-titre-nonnumerote">Signatures</h2>
	<p class="para">
		En signant, les parties reconnaissent avoir lu et accepté l'ensemble des conditions énoncées aux
		présentes.
	</p>
	<p class="en-foi-de-quoi">{enFoiDeQuoi}</p>
	<div class="signatures-grille">
		{#each signatures as bloc (bloc.role)}
			<div class="signature">
				<p class="etiquette">{bloc.role}</p>
				{#if bloc.organisation}<p class="signature-organisation">{bloc.organisation}</p>{/if}
				<div class="signature-champ">
					<div class="signature-trait"></div>
					<p class="signature-legende">
						{bloc.nom || 'Nom du signataire'}{#if bloc.titre}, {bloc.titre}{/if}
					</p>
				</div>
				<div class="signature-champ">
					<div class="signature-trait"></div>
					<p class="signature-legende">Date</p>
				</div>
			</div>
		{/each}
	</div>
</section>
