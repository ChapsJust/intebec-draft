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
docker compose up -d     # Postgres + migrations + serveur de dev sur 127.0.0.1:5173
```

Aucun compte à créer : l'accès est géré par le réseau, pas par l'application. Pour rendre le site
joignable depuis les autres postes, voir la section « Accès » ci-dessous.

Ou en local, avec un Postgres déjà disponible :

```bash
npm install
npm run db:migrate
npm run dev
```

## Accès

L'application n'a **ni mot de passe, ni comptes, ni écran de connexion**. Elle est hébergée sur le
Mac Studio et joignable uniquement depuis le tailnet Tailscale d'Intébec. Demander un mot de passe
derrière ça reviendrait à poser une deuxième serrure sur une porte déjà fermée, et à gérer des mots
de passe pour trois personnes qui sont déjà authentifiées par Tailscale.

La garde tient en trois couches :

| Couche                         | Rôle                                                                                       | Où                               |
| ------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------- |
| **1. Écoute en boucle locale** | Rend l'application injoignable depuis le réseau local, par construction.                   | `compose.yaml`, `vite.config.ts` |
| **2. `tailscale serve`**       | Publie l'application en HTTPS, aux seuls membres du tailnet. Ajoute l'identité en en-tête. | Le Mac, hors dépôt               |
| **3. Politique du tailnet**    | _Quels_ membres ont le droit d'entrer. Remplace la liste de comptes.                       | Console admin Tailscale          |

**La couche 1 est porteuse, pas cosmétique.** Il n'y a aucune vérification dans le code de
l'application : ce qui empêche le voisin de réseau d'ouvrir le site, c'est que le port n'existe pas
pour lui. Les en-têtes d'identité (couche 2) ne sont dignes de confiance que parce que seul le proxy
peut atteindre ce port — publier le port ailleurs qu'en `127.0.0.1` permettrait à n'importe qui de
les fabriquer. C'est le seul réglage de tout ce dispositif qu'il ne faut pas se tromper.

En contrepartie, l'invariant vit dans `compose.yaml`, un fichier versionné, et non dans un `.env`
qu'on peut oublier de remplir au déploiement.

### Prérequis

- Tailscale installé sur le Mac Studio et sur les postes qui doivent accéder au site.
- MagicDNS et **HTTPS Certificates** activés dans la console admin du tailnet (c'est déjà le cas :
  la passerelle IA utilise une adresse `https://….ts.net`).
- La CLI `tailscale`. Selon la variante installée sur macOS, elle n'est pas toujours dans le `PATH` :
  `/Applications/Tailscale.app/Contents/MacOS/Tailscale` (variante App Store).

### Mise en service

Le nom `.ts.net` du Mac sert déjà à la passerelle IA sur le port 443 : on publie donc l'application
sur un port distinct, d'où `--https=8443`.

```bash
tailscale serve status                                    # 8443 est-il libre ? sinon, en choisir un autre
docker compose up -d
docker compose port app 5173                              # doit afficher 127.0.0.1:5173
tailscale serve --bg --https=8443 http://127.0.0.1:5173
tailscale serve status                                    # confirme le mappage
```

L'application est alors disponible, pour les membres du tailnet uniquement, à
`https://intebecs-mac-studio.tail7bd633.ts.net:8443` — avec un vrai certificat, sans avertissement
de navigateur. Le nom de la personne connectée apparaît dans l'en-tête, fourni par Tailscale.

Pour arrêter de publier : `tailscale serve --https=8443 off`.

### Vérifier que c'est bien fermé

C'est le test qui compte. Le second doit **échouer** :

```bash
curl -sS -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/   # 200
curl -sS -m 3 http://<adresse-LAN-du-Mac>:5173/                         # doit refuser la connexion
```

Si le second répond, l'application est exposée à tout le réseau local sans aucune protection :
vérifier que `compose.yaml` publie bien `127.0.0.1:5173:5173` et non `5173:5173`, puis
`docker compose up -d --force-recreate app`.

### Donner ou retirer l'accès à quelqu'un

Tout se passe dans la console Tailscale — c'est ce qui remplace l'ancienne liste de comptes.

**Donner l'accès** : inviter la personne dans le tailnet depuis
[login.tailscale.com/admin/users](https://login.tailscale.com/admin/users), puis l'ajouter au groupe
`group:contrats` de la politique.

**Retirer l'accès** : la sortir du groupe, ou la retirer du tailnet. L'effet est immédiat — il n'y a
aucune session à attendre expirer.

Par défaut, **Tailscale autorise tous les membres du tailnet à joindre tous les ports**. Pour que
seules les personnes concernées atteignent l'application, restreindre dans la politique du tailnet
([login.tailscale.com/admin/acls](https://login.tailscale.com/admin/acls)) :

```jsonc
{
	"groups": {
		"group:contrats": ["justin.chaput@intebec.ca"]
	},
	"grants": [{ "src": ["group:contrats"], "dst": ["intebecs-mac-studio"], "ip": ["tcp:8443"] }]
}
```

### Trois pièges, et leur symptôme

- **Ne pas activer Funnel.** `tailscale funnel` publierait le site sur l'Internet public et
  retirerait les en-têtes d'identité. L'application ignore délibérément l'identité des requêtes
  Funnel plutôt que de leur faire confiance, mais la vraie précaution est de ne pas l'activer.
- **`Blocked request. This host is not allowed.`** — Vite refuse un nom d'hôte inconnu. Le nom
  `.ts.net` doit rester dans `server.allowedHosts` (`vite.config.ts`).
- **403 à l'enregistrement d'un formulaire, en production** — `ORIGIN` ne correspond pas exactement à
  l'adresse publique (schéma, nom et port compris). SvelteKit compare l'en-tête `Origin` de chaque
  POST à cette valeur. Le serveur de développement n'est pas concerné.

### Production (plus tard)

Le quotidien reste `npm run dev`. Le build de production existe déjà sous un profil Compose, qui
n'est jamais démarré par un `docker compose up` ordinaire :

```bash
ORIGIN="https://intebecs-mac-studio.tail7bd633.ts.net:8443" \
  docker compose --profile prod up -d app-prod
tailscale serve --bg --https=8443 http://127.0.0.1:3000    # le build écoute sur 3000
```

### Et la génération du PDF

Chromium tourne dans le même conteneur que l'application et visite la page d'aperçu pour l'imprimer.
Il passe par `PDF_ORIGIN` (`http://127.0.0.1:5173`), donc en interne : il ne ressort pas par le proxy,
n'a aucun nom `.ts.net` à résoudre depuis Docker, et n'a besoin d'aucune identité pour entrer.

### Variables d'environnement

| Variable        | Requis | Rôle                                                               |
| --------------- | ------ | ------------------------------------------------------------------ |
| `DATABASE_URL`  | Oui    | Connexion PostgreSQL                                               |
| `ORIGIN`        | Prod   | Adresse publique exacte, sinon 403 sur les formulaires             |
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
  hooks.server.ts             # lit l'identité Tailscale ; ne garde rien, la garde est réseau
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
    components/document.css   # mise en page du document, partagée par les composants de rendu
    document/                 # génération du document : clauses, sections, formatage
    server/acces.ts           # identité lue dans les en-têtes de `tailscale serve`
    server/db/                # schéma Drizzle et accès aux données
    server/pdf.ts             # impression Chromium, pied numéroté, nom de fichier
    server/ollama.ts          # client d'appel à l'IA : passerelle ou Ollama direct
    server/mandatActions.ts   # form actions partagées création / édition
    server/mandatForm.ts      # lecture et normalisation du mandat reçu du formulaire
    server/formulaire.ts      # garde d'identifiant partagée par les form actions
    montants.ts               # calculs monétaires : source de vérité unique
    validation.ts             # validation partagée client et serveur
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

0. **Accès** : réservé aux membres du tailnet Tailscale, sans mot de passe ni compte à gérer. Voir la
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
npm run db:generate  # générer une migration après modification du schéma
npm run db:migrate   # appliquer les migrations
npm run db:studio    # explorateur de base de données
```

Les tests couvrent la génération du document (clauses, sections, formatage, montants), la validation,
la normalisation de ce qui entre en base, la lecture de l'identité Tailscale, et le rendu du document
dans un vrai navigateur — dont une assertion sur le style calculé, pour qu'un découpage de composants ne puisse pas
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
