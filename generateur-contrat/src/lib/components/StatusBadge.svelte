<script lang="ts">
	import type { DocumentStatus } from '$lib/types';

	let { status }: { status: DocumentStatus } = $props();

	const config: Record<DocumentStatus, { label: string; class: string }> = {
		brouillon: { label: 'Brouillon', class: 'bg-slate-100 text-slate-600' },
		genere: { label: 'Généré', class: 'bg-emerald-50 text-emerald-700' },
		envoye: { label: 'Envoyé', class: 'bg-blue-50 text-blue-700' }
	};
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {config[status]
		.class}"
>
	{config[status].label}
</span>
