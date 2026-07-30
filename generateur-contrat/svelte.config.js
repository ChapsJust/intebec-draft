import adapter from '@sveltejs/adapter-node';

/** Configuration SvelteKit.
 *
 * Elle vivait auparavant en argument de `sveltekit()` dans `vite.config.ts`. Le plugin l'accepte
 * bien là, mais `svelte-check`, `prettier-plugin-svelte` et l'extension VS Code cherchent d'abord
 * ce fichier-ci, et `kit.alias` n'a pas d'autre endroit conventionnel où vivre.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},

	kit: {
		// adapter-node : l'application est déployée comme un serveur Node, en cohérence avec
		// le service `app` de compose.yaml.
		adapter: adapter(),

		/** Un alias par couche. Ils décrivent *ce qu'est* un module plutôt que le chemin pour y
		 * arriver : un fichier peut donc changer de dossier sans que ses importateurs bougent, ce
		 * qui n'était pas le cas des quelque cinquante imports relatifs qu'ils remplacent.
		 *
		 * `$serveur` pointe volontairement sur `src/lib/server`, qui garde son nom anglais : c'est
		 * un chemin magique de SvelteKit, seul l'emplacement réel active le refus d'import depuis
		 * le navigateur. Le renommer supprimerait la protection sans le moindre avertissement.
		 * L'alias, lui, la conserve — la vérification porte sur le chemin résolu. */
		alias: {
			$domaine: 'src/lib/domaine',
			$document: 'src/lib/document',
			$composants: 'src/lib/composants',
			$serveur: 'src/lib/server'
		},

		typescript: {
			config: (config) => {
				// Les deux fichiers de configuration hors `src/` que `svelte-kit sync` n'inclut pas
				// de lui-même. Sans ça, et malgré `checkJs`, une faute de frappe dans ce fichier-ci
				// ne se voit qu'au démarrage de Vite.
				config.include.push('../drizzle.config.ts', '../svelte.config.js');
			}
		}
	}
};

export default config;
