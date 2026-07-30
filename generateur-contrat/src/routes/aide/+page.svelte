<script lang="ts">
	import { APP_NAME } from '$domaine/config';
	import SectionFormulaire from '$composants/ui/SectionFormulaire.svelte';
</script>

<svelte:head><title>Aide · {APP_NAME}</title></svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold text-ink">Aide</h1>
		<p class="mt-1 text-sm text-ink-muted">
			Comment produire une soumission ou un contrat avec {APP_NAME}.
		</p>
	</div>

	<SectionFormulaire title="Produire un document" description="Le parcours complet, du brouillon au PDF.">
		<ol class="list-decimal space-y-3 pl-5 text-sm text-ink">
			<li>
				Depuis l'accueil, cliquez sur <strong>Nouveau document</strong> et choisissez soumission ou contrat.
				Le type peut être changé à tout moment.
			</li>
			<li>
				Sélectionnez un client existant, ou créez-en un. Cochez
				<strong>Enregistrer dans mes clients</strong> pour le réutiliser plus tard.
			</li>
			<li>
				Décrivez la portée. Chaque ligne peut avoir son propre mode de tarification : forfaitaire,
				taux horaire, ou lignes détaillées avec quantités.
			</li>
			<li>
				Ajustez les modalités de paiement, les clauses et les conditions particulières. Les clauses
				cochées deviennent des articles complets dans le document.
			</li>
			<li>
				Cliquez sur <strong>Générer le document</strong>. Vous arrivez sur l'aperçu, mis en page et
				prêt à imprimer.
			</li>
			<li>
				Sur l'aperçu, <strong>Imprimer / PDF</strong> ouvre la boîte d'impression du navigateur :
				choisissez <em>Enregistrer au format PDF</em> comme destination.
			</li>
		</ol>
	</SectionFormulaire>

	<SectionFormulaire
		title="Rédaction par l'IA locale"
		description="Ce que l'IA écrit, et ce qu'elle n'écrit jamais."
	>
		<div class="space-y-3 text-sm text-ink">
			<p>
				Deux niveaux d'assistance sont disponibles. Pendant la saisie, le bouton
				<strong>Étoffer avec l'IA</strong> propose un texte pour l'objet du mandat ou la description
				d'une ligne : vous lisez la proposition et décidez de l'utiliser ou de l'ignorer. Sur
				l'aperçu, <strong>Rédiger avec l'IA</strong> refait la prose du document entier d'un seul coup,
				de façon cohérente.
			</p>
			<p>
				L'IA ne touche <strong>qu'à la prose</strong>. Les montants, les pourcentages, les dates,
				l'échéancier et le texte des clauses sont calculés et rendus par l'application à partir de
				votre saisie : ils ne peuvent pas être inventés ni modifiés par le modèle.
			</p>
			<p>
				La prose générée est stockée à part de votre saisie. Vous pouvez donc relancer la rédaction
				autant de fois que vous le souhaitez, ou cliquer sur <strong>Revenir à ma saisie</strong> pour
				retrouver vos textes d'origine.
			</p>
			<p class="text-ink-muted">
				Le traitement se fait sur l'infrastructure locale, jointe par Tailscale. Si la connexion est
				coupée ou le serveur éteint, un message vous l'indique et le reste de l'application continue
				de fonctionner normalement.
			</p>
		</div>
	</SectionFormulaire>

	<SectionFormulaire title="Réutiliser un document" description="Pour les clients récurrents.">
		<p class="text-sm text-ink">
			Depuis l'accueil ou la fiche d'un client, le bouton <strong>Dupliquer</strong> crée un nouveau brouillon
			reprenant toute la structure du mandat d'origine, avec la date du jour. Rien n'est modifié dans
			le document source.
		</p>
	</SectionFormulaire>
</div>
