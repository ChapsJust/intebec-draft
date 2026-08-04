/** Lecture et vérification d'un identifiant posté, partagées par toutes les form actions. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai si la valeur a bien la forme attendue par les colonnes `uuid` de Postgres.
 *
 * Sans cette vérification, un identifiant fantaisiste comme `/mandats/test` se rend jusqu'à la
 * comparaison SQL. Postgres refuse alors la conversion et lève une erreur : l'utilisateur voit une
 * 500 là où le code voulait répondre 404. */
export function estUuid(valeur: unknown): valeur is string {
	return typeof valeur === 'string' && UUID_RE.test(valeur);
}

/** Identifiant posté, ou `null` s'il est absent ou mal formé. On le poste toujours explicitement au
 * lieu de le lire dans `params`, parce que ça ne marcherait pas partout : sur la fiche client,
 * `params.id` désigne le client, alors que l'action vise un de ses mandats. */
export async function idPoste(request: Request): Promise<string | null> {
	const poste = (await request.formData()).get('id');
	return estUuid(poste) ? poste : null;
}
