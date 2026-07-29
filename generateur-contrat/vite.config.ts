import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	server: {
		// Pas de `host: true` ici : le conteneur reçoit déjà `--host 0.0.0.0` dans le CMD de
		// Dockerfile.dev, où c'est indispensable pour que l'hôte joigne le serveur. En dehors du
		// conteneur, l'écoute reste sur la boucle locale — un `npm run dev` lancé directement sur
		// le Mac ne s'expose donc pas au réseau local.
		//
		// Noms d'hôtes acceptés. Vite refuse par défaut les `Host` qu'il ne connaît pas ; derrière
		// `tailscale serve`, l'en-tête porte le nom `.ts.net` de la machine et la réponse serait
		// « Blocked request. This host is not allowed. » plutôt que l'application.
		allowedHosts: ['.ts.net'],
		// Le polling permet au hot reload de fonctionner à travers le bind mount Docker (Windows) :
		// les événements inotify ne traversent pas la frontière entre l'hôte et le conteneur.
		// Sans intervalle explicite, chokidar interroge le disque toutes les 100 ms, ce qui
		// consommait 19 % de CPU en continu, machine au repos. À 800 ms le hot reload reste
		// imperceptiblement plus lent et la charge devient négligeable.
		watch: process.env.VITE_USE_POLLING
			? {
					usePolling: true,
					interval: 800,
					binaryInterval: 1500,
					ignored: ['**/node_modules/**', '**/.svelte-kit/**', '**/build/**', '**/.git/**']
				}
			: undefined
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-node : l'application est déployée comme un serveur Node, en cohérence avec
			// le service `app` de compose.yaml.
			adapter: adapter(),

			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
