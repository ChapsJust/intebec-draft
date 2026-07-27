<script lang="ts">
	import Icon from './Icon.svelte';
	import { APP_NAME } from '$lib/config';
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
				href="/aide"
				class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-muted transition hover:bg-surface-muted hover:text-ink"
			>
				<Icon name="help" size={18} />
				<span class="hidden sm:inline">Aide</span>
			</a>
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-ink-muted transition hover:text-ink"
				aria-label="Compte utilisateur"
			>
				<Icon name="user" size={18} />
			</button>
		</nav>
	</div>
</header>
