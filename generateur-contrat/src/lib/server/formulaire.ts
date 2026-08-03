/** Lecture et vérification d'un identifiant posté, partagées par toutes les form actions. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai si la valeur a la forme attendue par les colonnes `uuid`. Sans cette garde, un identifiant
 * fantaisiste (`/mandats/test`) atteint la comparaison SQL, Postgres refuse la conversion, et
 * l'utilisateur voit une 500 là où le code prévoyait un 404. */
export function estUuid(valeur: unknown): valeur is string {
	return typeof valeur === 'string' && UUID_RE.test(valeur);
}

/** Identifiant posté, ou `null` s'il est absent ou mal formé. Toujours posté explicitement plutôt que
 * lu dans `params` : sur la fiche client, `params.id` désigne le client, pas le mandat visé. */
export async function idPoste(request: Request): Promise<string | null> {
	const poste = (await request.formData()).get('id');
	return estUuid(poste) ? poste : null;
}
