<script lang="ts">
	import Icon from './Icon.svelte';

	type IconName = 'document' | 'contract';

	let {
		href,
		title,
		description,
		icon
	}: { href: string; title: string; description: string; icon: IconName } = $props();
</script>

<a
	{href}
	class="group flex items-center gap-4 rounded-card border border-border-subtle bg-surface p-5 shadow-sm transition hover:border-accent-400 hover:shadow-md"
>
	<span
		class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-accent-500 group-hover:text-white"
	>
		<Icon name={icon} size={24} />
	</span>
	<span class="min-w-0 flex-1">
		<span class="block font-semibold text-ink">{title}</span>
		<span class="block text-sm text-ink-muted">{description}</span>
	</span>
	<Icon
		name="arrow-right"
		class="shrink-0 text-ink-muted transition group-hover:translate-x-1 group-hover:text-accent-500"
	/>
</a>
