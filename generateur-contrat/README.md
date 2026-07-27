# Générateur de soumissions et contrats — Intébec

## Description

Application interne visant à simplifier et automatiser la création de soumissions et de contrats grâce à une intelligence artificielle locale (hébergée en interne, sans dépendance à un service cloud externe).

L'utilisateur fournit les informations essentielles du mandat (client, portée, tarifs, conditions particulières) et l'IA génère automatiquement un document professionnel, formaté et prêt à être envoyé.

## Stack technique

- **Frontend** : SvelteKit
- **IA** : modèle local via Ollama (infrastructure Intébec existante, Mac Studio)
- **Export** : génération PDF à partir du document généré

## Structure du projet

```
src/
  routes/
    +page.svelte           # formulaire de saisie
    api/generate/+server.ts # endpoint appelant l'IA locale
  lib/
    components/            # ClientForm, MandatForm, DocumentPreview
    templates/              # gabarits et clauses standards
    server/ollama.ts        # client d'appel à Ollama
```

## Fonctionnalités principales

1. **Saisie des informations** : coordonnées client, type de document (soumission/contrat), portée du mandat, tarifs, échéancier, conditions particulières.
2. **Génération automatique** : le moteur IA compose le texte à partir des gabarits et clauses standards préétablis.
3. **Export** : production du document final en PDF, prêt à envoyer.

## Démarrage

```bash
npm install
npm run dev
```

L'application appelle l'instance Ollama hébergée sur l'infrastructure locale d'Intébec (via Tailscale) pour la génération de texte — aucune donnée client n'est envoyée à un service externe.

## À venir

- Intégration avec Intébec Sign (Docuseal) pour l'envoi direct en signature après génération.
- Historique et versions des documents générés.
