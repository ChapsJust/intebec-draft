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
npm run auth:secret                              # colle le résultat dans .env
npm run auth:compte -- justin "mot de passe"     # une ligne par personne, dans AUTH_UTILISATEURS
docker compose up -d                             # Postgres + migrations + serveur de dev sur :5173
```

Ou en local, avec un Postgres déjà disponible :

```bash
npm install
npm run db:migrate
npm run dev
```

## Accès

L'application est réservée à quelques personnes nommées. Il n'y a ni inscription ni gestion des
comptes à l'écran : les comptes sont créés à la main au moment du déploiement, dans la variable
`AUTH_UTILISATEURS`. C'est suffisant pour trois personnes, et ça évite une table, une migration et
un écran d'administration.

```bash
npm run auth:secret                            # AUTH_SECRET, à générer une seule fois
npm run auth:compte -- justin "mot de passe"   # une ligne "identifiant:sel:empreinte"
```

Les lignes obtenues se collent dans `AUTH_UTILISATEURS`, séparées par des virgules. Le mot de passe
n'est jamais stocké, seulement son empreinte scrypt salée (`node:crypto`, aucune dépendance ajoutée).
La session est un cookie signé, `HttpOnly`, valable douze heures.

Retirer quelqu'un consiste à supprimer sa ligne : sa session en cours cesse aussitôt de valoir, sans
attendre son expiration. Changer `AUTH_SECRET` déconnecte tout le monde.

**Sans `AUTH_SECRET` ni `AUTH_UTILISATEURS`, l'application refuse toute requête** au lieu de s'ouvrir
à tout le monde. Une protection qu'on désactive en oubliant une variable d'environnement n'en est pas
une : le jour où le `.env` de production est incomplet, rien ne le signalerait.

La génération du PDF continue de fonctionner : la route `/mandats/[id]/pdf` retransmet le cookie de
la requête à Chromium, qui visite donc l'aperçu authentifié comme le ferait l'utilisateur.

### Variables d'environnement

| Variable            | Requis | Rôle                                                               |
| ------------------- | ------ | ------------------------------------------------------------------ |
| `DATABASE_URL`      | Oui    | Connexion PostgreSQL                                               |
| `AUTH_SECRET`       | Oui    | Clé de signature des sessions (`npm run auth:secret`)              |
| `AUTH_UTILISATEURS` | Oui    | Comptes autorisés (`npm run auth:compte -- <nom> "<mot>"`)         |
| `AI_API_URL`        | Non    | Passerelle IA authentifiée (ex. `https://<machine>.ts.net`)        |
| `AI_API_KEY`        | Non    | Clé envoyée en `X-API-Key` à la passerelle                         |
| `AI_MODEL`          | Non    | Modèle demandé à la passerelle (défaut `gemma4:latest`)            |
| `OLLAMA_URL`        | Non    | Instance Ollama en direct (défaut `http://localhost:11434`)        |
| `OLLAMA_MODEL`      | Non    | Modèle utilisé en accès direct (défaut `llama3.1:8b`)              |
| `CHROMIUM_PATH`     | Non    | Chromium système pour le PDF. Requis en conteneur Alpine (musl)    |
| `PDF_ORIGIN`        | Non    | Origine que Chromium visite pour imprimer (défaut : origine reçue) |

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
  hooks.server.ts             # garde d'accès : une session valide, ou redirection vers /connexion
  routes/
    +page.svelte              # accueil : documents récents
    connexion/                # écran de connexion et déconnexion
    nouveau/                  # création d'un mandat
    mandats/[id]/             # édition d'un mandat
    mandats/[id]/apercu/      # document mis en page à l'écran
    mandats/[id]/pdf/         # endpoint de téléchargement du PDF
    clients/                  # CRUD clients (liste, fiche, archivage)
    aide/                     # mode d'emploi
  lib/
    components/               # éditeur (MandatEditor + sections) et rendu (DocumentView)
    components/document.css   # mise en page du document, partagée par les composants de rendu
    document/                 # génération du document : clauses, sections, formatage
    server/auth.ts            # comptes, empreintes de mots de passe, cookie de session signé
    server/db/                # schéma Drizzle et accès aux données
    server/pdf.ts             # impression Chromium, pied numéroté, nom de fichier
    server/ollama.ts          # client d'appel à l'IA : passerelle ou Ollama direct
    server/mandatActions.ts   # form actions partagées création / édition
    server/mandatForm.ts      # lecture et normalisation du mandat reçu du formulaire
    server/formulaire.ts      # garde d'identifiant partagée par les form actions
    montants.ts               # calculs monétaires : source de vérité unique
    validation.ts             # validation partagée client et serveur
scripts/compte.mjs            # génère AUTH_SECRET et les lignes de AUTH_UTILISATEURS
```

### Ce qui entre en base

Tout ce qui arrive du formulaire passe par `normaliserMandat` (`server/mandatForm.ts`), qui repart du
mandat vide et n'y recopie que ce qui a la forme attendue. Le brouillon est stocké dans une colonne
`jsonb` que rien ne contraint : sans cette étape, un `lignes` qui n'est pas un tableau s'enregistre
sans broncher, puis fait échouer l'affichage du mandat à _chaque_ visite suivante.

La normalisation corrige au lieu de refuser : un écart vient presque toujours d'un champ laissé vide,
et perdre une saisie complète pour un nombre mal formé serait pire que de le ramener à zéro. Les
règles qui, elles, doivent bloquer la génération vivent dans `validation.ts`, partagé avec le
navigateur.

Le vocabulaire du code est en français. Deux exceptions assumées, côté stockage : la colonne
`draft` garde son nom en base (la clé JavaScript, elle, est `brouillon` — Drizzle dissocie les deux,
ce qui évite une migration), et les clés internes du JSON du brouillon, dont `pricingMode`, restent
telles quelles pour que les mandats déjà enregistrés continuent de se relire.

## Fonctionnalités

0. **Accès** : connexion par identifiant et mot de passe, réservée aux comptes déclarés. Voir la
   section « Accès » ci-dessus.
1. **Clients** : création, consultation, modification et archivage, avec recherche par nom,
   représentant, courriel, téléphone ou numéro d'entreprise. Un client enregistré est réutilisable
   d'un mandat à l'autre.
2. **Saisie du mandat** : type de document, structure du projet (phases / blocs / récurrent), portée
   ligne par ligne avec trois modes de tarification (forfaitaire, taux horaire, quantités),
   échéancier de paiement, abonnement récurrent, clauses et conditions particulières.
   Le paiement se règle en trois choix : tout à la livraison, acompte puis solde, ou tout à la
   signature. L'acompte et le solde totalisent toujours 100 %, et le document nomme un versement
   unique « paiement intégral » plutôt que « solde », qui supposerait un acompte avant lui.
3. **Génération du document** : le mandat devient un contrat structuré selon l'usage québécois,
   ouverture `Entre / Et` avec les désignations `(ci-après « … »)`, articles numérotés, tableau des
   honoraires, échéancier, clôture `En foi de quoi` et blocs de signature.
4. **Export PDF** : `Télécharger le PDF` produit le fichier côté serveur, avec la numérotation
   `Page X sur Y` et un nom de fichier dérivé du mandat. `Imprimer` reste disponible pour un tirage
   direct depuis le navigateur.
5. **Rédaction assistée** (optionnelle) : `Étoffer avec l'IA` propose un texte pour un champ pendant
   la saisie ; `Rédiger avec l'IA` refait la prose du document entier depuis l'aperçu. `Générer`
   enchaîne sur cette passe automatiquement, mais dans une requête distincte : l'appel au modèle peut
   durer quelques minutes, et l'enregistrement du mandat ne doit pas en dépendre.
6. **Duplication** : repartir d'un mandat existant pour un client récurrent.
7. **Suivi** : `Marquer comme envoyé` fait passer le document au statut `envoyé`, et l'opération se
   défait. Le statut est déclaratif : l'application n'envoie rien elle-même, elle note que vous
   l'avez fait.

### Ce que l'IA écrit, et ce qu'elle n'écrit pas

L'IA ne produit que de la **prose** : préambule, objet du mandat, descriptions des lignes de service.
Les montants, pourcentages, dates, échéanciers et textes de clauses sont calculés et rendus par
l'application à partir de la saisie, et ne peuvent pas être modifiés par le modèle.

La prose générée est stockée dans une colonne `redaction` distincte du brouillon : la saisie reste
intacte, la rédaction est rejouable autant de fois que voulu, et `Revenir à ma saisie` la supprime.

## Scripts

```bash
npm run dev          # serveur de développement
npm run build        # build de production (adapter-node)
npm run check        # svelte-check (types + a11y)
npm run lint         # prettier --check
npm run format       # prettier --write
npm run test         # vitest : unitaires (node) + rendu du document (chromium)
npm run auth:secret  # générer AUTH_SECRET
npm run auth:compte  # générer une ligne de compte : -- <identifiant> "<mot de passe>"
npm run db:generate  # générer une migration après modification du schéma
npm run db:migrate   # appliquer les migrations
npm run db:studio    # explorateur de base de données
```

Les tests couvrent la génération du document (clauses, sections, formatage, montants), la validation,
la normalisation de ce qui entre en base, l'authentification, et le rendu du document dans un vrai
navigateur — dont une assertion sur le style calculé, pour qu'un découpage de composants ne puisse pas
faire perdre la mise en page sans être vu.

## À venir

- Renseigner le NEQ et le téléphone dans `PRESTATAIRE` (`src/lib/config.ts`). Tant qu'ils manquent,
  l'aperçu affiche un rappel, qui disparaît de lui-même une fois les champs remplis.
- Remplacer `src/lib/assets/logo-intebec.svg` par le logo officiel (le fichier actuel est une
  approximation provisoire).
- Faire relire le texte des clauses par un conseiller juridique avant tout envoi réel.
- Intégration avec Intébec Sign (Docuseal) pour l'envoi direct en signature. Le statut `envoyé` est
  déjà posable à la main depuis l'aperçu.
- Historique et versions des documents générés.
- Pagination de l'accueil : la liste est bornée à huit documents par la requête, mais il n'existe pas
  encore d'écran « tous les mandats ».
