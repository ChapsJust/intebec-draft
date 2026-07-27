<script lang="ts">
	import { APP_NAME } from '$lib/config';
</script>

<footer class="mt-auto border-t border-border-subtle bg-surface">
	<div
		class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-ink-muted sm:flex-row sm:px-6"
	>
		<span>{APP_NAME} · outil interne</span>
		<span class="flex items-center gap-1.5">
			<span class="h-1.5 w-1.5 rounded-full bg-success"></span>
			IA locale · aucune donnée envoyée à l'externe
		</span>
	</div>
</footer>
