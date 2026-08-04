import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	server: {
		// Pas de `host: true` : le conteneur reçoit déjà `--host 0.0.0.0` dans Dockerfile.dev, et hors
		// conteneur l'écoute doit rester sur la boucle locale.
		//
		// Vite refuse par défaut les `Host` inconnus. Derrière `tailscale serve`, l'en-tête porte le
		// nom `.ts.net` et la réponse serait « Blocked request » plutôt que l'application.
		allowedHosts: ['.ts.net'],
		// Le polling fait marcher le hot reload à travers le bind mount Docker sous Windows : inotify
		// ne traverse pas la frontière entre l'hôte et le conteneur. Je fixe l'intervalle à la main
		// parce qu'avec le défaut (100 ms) le conteneur mangeait du CPU en continu, même au repos.
		watch: process.env.VITE_USE_POLLING
			? {
					usePolling: true,
					interval: 800,
					binaryInterval: 1500,
					ignored: ['**/node_modules/**', '**/.svelte-kit/**', '**/build/**', '**/.git/**']
				}
			: undefined
	},
	// Adaptateur, alias et options du compilateur vivent dans `svelte.config.js` : c'est là que les
	// outils tiers (svelte-check, prettier, l'extension VS Code) vont les chercher.
	plugins: [tailwindcss(), sveltekit()],
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
