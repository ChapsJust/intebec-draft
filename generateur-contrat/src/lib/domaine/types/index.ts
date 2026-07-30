/** Point d'entrée unique des types du domaine.
 *
 * Le découpage en modules sert à la lecture — chaque fichier tient sur un écran et regroupe une
 * seule famille. Les importateurs, eux, continuent d'écrire `from '$domaine/types'` : la frontière
 * publique est le domaine entier, pas ses sous-familles, et un type qui change de fichier ne doit
 * pas provoquer une vague de modifications ailleurs.
 */
export type * from './utilisateur';
export type * from './document';
export type * from './client';
export type * from './tarification';
export type * from './clauses';
export type * from './ia';
export type * from './mandat';
