<script lang="ts">
	import Icone from '$composants/ui/Icone.svelte';
	import { APP_NAME } from '$domaine/config';
	import type { Utilisateur } from '$domaine/types';

	let { utilisateur = null }: { utilisateur?: Utilisateur | null } = $props();
</script>

<header class="border-b border-border-subtle bg-surface">
	<div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
		<a href="/" class="flex items-center gap-2.5">
			<span
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 font-semibold text-white"
			>
				{APP_NAME.charAt(0)}
			</span>
			<span class="text-lg font-semibold tracking-tight text-ink">{APP_NAME}</span>
		</a>

		<nav class="flex items-center gap-1">
			<a
				href="/clients"
				class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-muted hover:text-ink"
			>
				<Icone name="user" size={18} />
				<span class="hidden sm:inline">Clients</span>
			</a>
			<a
				href="/aide"
				class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-muted hover:text-ink"
			>
				<Icone name="help" size={18} />
				<span class="hidden sm:inline">Aide</span>
			</a>

			<!-- Nom fourni par Tailscale, pas par une session : il n'y a donc rien dont se déconnecter,
				et le nom disparaît simplement quand l'application tourne sans le proxy devant (dev local). -->
			{#if utilisateur}
				<span
					class="ml-2 hidden border-l border-border-subtle pl-3 text-sm text-ink-muted sm:inline"
					title="Identifié par Tailscale"
				>
					{utilisateur.nom}
				</span>
			{/if}
		</nav>
	</div>
</header>
