# Générateur de soumissions et contrats Intébec

## Description

Application interne servant à préparer les soumissions et les contrats d'Intébec. L'utilisateur
saisit les informations du mandat (client, portée, tarifs, conditions), l'application en produit un
document professionnel formaté, prêt à imprimer ou à enregistrer en PDF.

La rédaction peut être assistée par une intelligence artificielle locale (Ollama), hébergée sur
l'infrastructure Intébec et jointe par Tailscale, derrière une passerelle authentifiée : aucune
donnée client n'est envoyée à un service externe.

## Stack technique

- **Frontend** : SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind v4
- **Base de données** : PostgreSQL 16 + Drizzle ORM
- **IA** : modèle local via Ollama (optionnel)
- **Export** : PDF généré côté serveur par Chromium via Playwright, avec numérotation des pages
- **Déploiement** : `adapter-node`, Docker Compose

## Démarrage

```bash
cp .env.example .env
docker compose up -d      # Postgres + migrations + serveur de dev sur :5173
```

Ou en local, avec un Postgres déjà disponible :

```bash
npm install
npm run db:migrate
npm run dev
```

### Variables d'environnement

| Variable        | Requis | Rôle                                                               |
| --------------- | ------ | ------------------------------------------------------------------ |
| `DATABASE_URL`  | Oui    | Connexion PostgreSQL                                               |
| `AI_API_URL`    | Non    | Passerelle IA authentifiée (ex. `https://<machine>.ts.net`)        |
| `AI_API_KEY`    | Non    | Clé envoyée en `X-API-Key` à la passerelle                         |
| `AI_MODEL`      | Non    | Modèle demandé à la passerelle (défaut `gemma4:latest`)            |
| `OLLAMA_URL`    | Non    | Instance Ollama en direct (défaut `http://localhost:11434`)        |
| `OLLAMA_MODEL`  | Non    | Modèle utilisé en accès direct (défaut `llama3.1:8b`)              |
| `CHROMIUM_PATH` | Non    | Chromium système pour le PDF. Requis en conteneur Alpine (musl)    |
| `PDF_ORIGIN`    | Non    | Origine que Chromium visite pour imprimer (défaut : origine reçue) |

Sans IA joignable, toute l'application fonctionne normalement : seule la rédaction assistée est
indisponible, et l'échec est signalé à l'écran sans bloquer la génération.

### IA : deux modes d'accès

L'application choisit son transport toute seule, selon ce qui est configuré.

**Passerelle authentifiée**, dès que `AI_API_URL` et `AI_API_KEY` sont fournies. C'est le mode de
production : la passerelle tourne sur le Mac Studio devant Ollama et ajoute clé API, limite de débit
et file d'attente bornée. Elle n'est joignable que par les membres du tailnet Tailscale. Les appels
sont streamés en SSE, réassemblés côté serveur avant usage : la passerelle plafonne le mode
non-streamé à 90 secondes, ce qu'une passe de rédaction complète dépasse dès que le modèle doit
être rechargé en mémoire.

**Ollama en direct**, sinon, sur `OLLAMA_URL`. Pas d'authentification, mode pratique en
développement local. Ce chemin utilise le mode JSON natif d'Ollama ; la passerelle ne l'expose pas,
la réponse y est donc extraite du texte reçu (`extraireJson`).

Si le nom Tailscale de la passerelle ne se résout pas depuis le conteneur, mappez-le sur l'IP du
tailnet plutôt que de mettre l'IP dans l'URL, sinon le certificat TLS ne correspond plus :

```yaml
extra_hosts:
  - 'intebecs-mac-studio.tail7bd633.ts.net:100.119.112.106'
```

Vérifier la passerelle avant de l'utiliser depuis l'application :

```bash
curl -s $AI_API_URL/health                                  # {"status":"ok","queue":0}
curl -s $AI_API_URL/v1/models -H "X-API-Key: $AI_API_KEY"   # le modèle voulu doit y être "available"
```

## Structure du projet

```
src/
  routes/
    +page.svelte              # accueil : documents récents
    nouveau/                  # création d'un mandat
    mandats/[id]/             # édition d'un mandat
    mandats/[id]/apercu/      # document mis en page à l'écran
    mandats/[id]/pdf/         # endpoint de téléchargement du PDF
    clients/                  # CRUD clients (liste, fiche, archivage)
    aide/                     # mode d'emploi
  lib/
    components/               # éditeur (MandatEditor + sections) et rendu (DocumentView)
    document/                 # génération du document : clauses, sections, formatage
    server/db/                # schéma Drizzle et accès aux données
    server/pdf.ts             # impression Chromium et pied de page numéroté
    server/ollama.ts          # client d'appel à l'IA : passerelle ou Ollama direct
    server/mandatActions.ts   # form actions partagées création / édition
    pricing.ts                # calculs monétaires : source de vérité unique
    validation.ts             # validation partagée client et serveur
```

## Fonctionnalités

1. **Clients** : création, consultation, modification et archivage. Un client enregistré est
   réutilisable d'un mandat à l'autre.
2. **Saisie du mandat** : type de document, structure du projet (phases / blocs / récurrent), portée
   ligne par ligne avec trois modes de tarification (forfaitaire, taux horaire, quantités),
   échéancier de paiement, abonnement récurrent, clauses et conditions particulières.
3. **Génération du document** : le mandat devient un contrat structuré selon l'usage québécois,
   ouverture `Entre / Et` avec les désignations `(ci-après « … »)`, articles numérotés, tableau des
   honoraires, échéancier, clôture `En foi de quoi` et blocs de signature.
4. **Export PDF** : `Télécharger le PDF` produit le fichier côté serveur, avec la numérotation
   `Page X sur Y` et un nom de fichier dérivé du mandat. `Imprimer` reste disponible pour un tirage
   direct depuis le navigateur.
5. **Rédaction assistée** (optionnelle) : `Étoffer avec l'IA` propose un texte pour un champ pendant
   la saisie ; `Rédiger avec l'IA` refait la prose du document entier depuis l'aperçu.
6. **Duplication** : repartir d'un mandat existant pour un client récurrent.

### Ce que l'IA écrit, et ce qu'elle n'écrit pas

L'IA ne produit que de la **prose** : préambule, objet du mandat, descriptions des lignes de service.
Les montants, pourcentages, dates, échéanciers et textes de clauses sont calculés et rendus par
l'application à partir de la saisie, et ne peuvent pas être modifiés par le modèle.

La prose générée est stockée dans une colonne `redaction` distincte du `draft` : la saisie reste
intacte, la rédaction est rejouable autant de fois que voulu, et `Revenir à ma saisie` la supprime.

## Scripts

```bash
npm run dev          # serveur de développement
npm run build        # build de production (adapter-node)
npm run check        # svelte-check (types + a11y)
npm run lint         # prettier --check
npm run format       # prettier --write
npm run test         # vitest (unitaires)
npm run db:generate  # générer une migration après modification du schéma
npm run db:migrate   # appliquer les migrations
npm run db:studio    # explorateur de base de données
```

## À venir

- Remplacer `src/lib/assets/logo-intebec.svg` par le logo officiel (le fichier actuel est une
  approximation provisoire) et confirmer les coordonnées de `PRESTATAIRE` dans `src/lib/config.ts`.
- Faire relire le texte des clauses par un conseiller juridique avant tout envoi réel.
- Intégration avec Intébec Sign (Docuseal) pour l'envoi direct en signature : le statut `envoyé`
  existe déjà dans le modèle de données.
- Historique et versions des documents générés.
- Authentification.
