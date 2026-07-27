<script lang="ts">
	// Jeu d'icônes SVG inline (aucune dépendance externe).
	// Tracé unique, stroke héritant de `currentColor` pour suivre la couleur du texte.
	type IconName =
		| 'document'
		| 'contract'
		| 'plus'
		| 'arrow-right'
		| 'sparkles'
		| 'download'
		| 'steps'
		| 'help'
		| 'user'
		| 'trash'
		| 'close';

	let {
		name,
		size = 20,
		class: klass = ''
	}: { name: IconName; size?: number; class?: string } = $props();

	const paths: Record<IconName, string> = {
		document: 'M9 3h6l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm5 0v5h5M9 13h6M9 17h6',
		contract: 'M8 3h8a1 1 0 0 1 1 1v15l-3-2-2 2-2-2-3 2V4a1 1 0 0 1 1-1Zm2 5h4M10 11h4',
		plus: 'M12 5v14M5 12h14',
		'arrow-right': 'M5 12h14M13 6l6 6-6 6',
		sparkles:
			'M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3ZM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z',
		download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 19h14',
		steps: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
		help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-1.6-6.5c0-2 2.6-2.2 2.6-4a1.9 1.9 0 0 0-3.6-.9M12 17h.01',
		user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
		trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13M10 11v6m4-6v6',
		close: 'M6 6l12 12M18 6 6 18'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={klass}
	aria-hidden="true"
>
	<path d={paths[name]} />
</svg>
