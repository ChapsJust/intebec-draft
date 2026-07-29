/** Petits outils partagés par les form actions : lecture d'un identifiant posté et vérification de
 * sa forme. Regroupés ici parce que la fiche client et les actions de mandat en ont autant besoin
 * l'une que l'autre, et que la garde ci-dessous doit valoir pour les deux. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai si la valeur est un identifiant de la forme attendue par les colonnes `uuid`.
 *
 * Sans cette vérification, un identifiant fantaisiste (`/mandats/test`) arrive tel quel dans la
 * comparaison SQL, Postgres refuse de le convertir en `uuid` et lève une erreur : l'utilisateur
 * voit une page 500 là où le code prévoyait un « introuvable ». Filtrer en amont rend le 404
 * atteignable. */
export function estUuid(valeur: unknown): valeur is string {
	return typeof valeur === 'string' && UUID_RE.test(valeur);
}

/** Identifiant posté dans le corps du formulaire, ou `null` s'il est absent ou mal formé.
 *
 * La cible est toujours postée explicitement plutôt que lue dans `params` : ces actions vivent
 * aussi sur la fiche client, où `params.id` désigne le client et désignerait donc la mauvaise
 * chose. */
export async function idPoste(request: Request): Promise<string | null> {
	const poste = (await request.formData()).get('id');
	return estUuid(poste) ? poste : null;
}
