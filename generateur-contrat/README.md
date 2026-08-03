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
  app.css                     # thème Tailwind et jetons de design, importés par +layout.svelte
  hooks.server.ts             # lit l'identité Tailscale ; ne garde rien, la garde est réseau
  routes/
    +page.svelte              # accueil : documents récents
    nouveau/                  # création d'un mandat
    mandats/[id]/             # édition d'un mandat
    mandats/[id]/apercu/      # document mis en page à l'écran
    mandats/[id]/pdf/         # endpoint de téléchargement du PDF
    clients/                  # CRUD clients (liste, fiche, archivage)
    clauses/                  # bibliothèque de clauses (liste, édition, archivage)
    aide/                     # mode d'emploi
    actions.spec.ts           # fige les clés d'actions de chaque route (voir plus bas)
  lib/
    domaine/                  # le métier, sans dépendance à SvelteKit
      types/                  # une famille de types par fichier, réexportés par index.ts
      fabriques.ts            # objets vides : nouveauMandat, nouvelleLigne, dupliquerMandat
      montants.ts             # calculs monétaires : source de vérité unique
      validation.ts           # règles qui bloquent la génération, partagées client et serveur
      coherence.ts            # incohérences qui ne bloquent pas, mais font un document bancal
      config.ts               # PRESTATAIRE : à renseigner avant le premier envoi client
      titres.ts               # normalisation des titres de clause, partagée avec le serveur
    document/                 # génération du document, sans DOM ni base
      modele.ts               # types du document rendu, consommés par composants/document/
      sections.ts             # ce qui figure au contrat et dans quel ordre
      empreinte.ts            # « la prose affichée décrit-elle encore ce mandat-là »
      clauses.ts  catalogue.ts  format.ts  diff.ts
    composants/
      ui/                     # primitives : Icone, SectionFormulaire, ConfirmationAction…
      app/                    # chrome : Entete, PiedPage, BanniereAccueil
      mandat/                 # éditeur : Editeur + conditions/ + lignes/
      client/  ia/            # formulaire client, assistance et revue de rédaction
      document/               # rendu imprimable + document.css
      tableau-bord/           # listes de documents récents
    ressources/               # favicon et logo
    server/                   # NE PAS RENOMMER : chemin magique SvelteKit (voir ci-dessous)
      acces.ts                # identité lue dans les en-têtes de `tailscale serve`
      formulaire.ts           # garde d'identifiant partagée par les form actions
      pdf.ts                  # impression Chromium, pied numéroté, nom de fichier
      db/                     # schéma Drizzle et accès aux données
      mandat/formulaire.ts    # lecture et normalisation du mandat reçu du formulaire
      ia/                     # transport, invites, normalisation ; index.ts = API publique
      actions/                # form actions : mandat.ts, ia.ts, client.ts, clause.ts
```

### Parcours de lecture

L'arborescence dit **où** vivent les fichiers ; ce parcours dit **dans quel ordre** les lire. Un seul
clic — « Générer le document » — traverse toutes les couches :

| #   | Fichier                                            | Ce qui s'y passe                                           |
| --- | -------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `composants/mandat/Editeur.svelte`                 | Le bouton. `verifierMandat` bloque côté client.            |
| 2   | `server/actions/mandat.ts` → `generer`             | La form action.                                            |
| 3   | `server/mandat/formulaire.ts` → `normaliserMandat` | **Frontière de confiance** : on repart d'un mandat vide.   |
| 4   | `domaine/validation.ts` → `verifierMandat`         | Rejoué côté serveur : le client ne fait pas foi.           |
| 5   | `server/db/mandats.ts` → `enregistrerMandat`       | En base, colonne `jsonb`.                                  |
| 6   | `routes/mandats/[id]/apercu/`                      | Redirection. La rédaction part dans **sa propre requête**. |
| 7   | `server/ia/invites.ts`                             | Le prompt. Aucun montant n'y figure.                       |
| 8   | `server/ia/transport.ts`                           | L'aller-retour, en SSE.                                    |
| 9   | `server/ia/normalisation.ts`                       | **Ce que l'application accepte** du modèle.                |
| 10  | `document/sections.ts` → `construireDocument`      | Le modèle de vue. Aucun montant recalculé.                 |
| 11  | `document/diff.ts` → `texteEffectif`               | Recompose saisie et prose selon les passages refusés.      |
| 12  | `composants/document/Rendu.svelte`                 | L'affichage, puis `server/pdf.ts` pour le PDF.             |

Deux invariants se lisent le long de ce chemin, et ce sont les seuls qu'il faut retenir :

- **Ce qui entre est reconstruit, jamais recopié** (étape 3), et les règles qui bloquent sont
  rejouées côté serveur (étape 4).
- **L'IA n'écrit que de la prose.** Les montants ne lui sont pas transmis (7), ce qu'elle renvoie est
  filtré (9), et les chiffres sont rendus par le gabarit (10).

### Où ranger un fichier

L'emplacement se déduit de la nature du fichier, pas de la fonctionnalité à laquelle il sert :
`domaine/` ne dépend de rien, `document/` ne dépend que du domaine, `composants/` affiche,
`server/` accède au réseau et à la base. Un import qui remonte cette liste à contresens signale une
erreur de rangement.

Quatre alias déclarés dans `svelte.config.js`, un par couche : `$domaine`, `$document`,
`$composants`, `$serveur`. **Tout import inter-dossiers passe par un alias ; seul l'intra-dossier
reste relatif.** Un fichier peut ainsi changer de dossier sans que ses importateurs bougent, et le
préfixe rend une violation de couche visible à la lecture.

### Deux pièges qui ne préviennent pas

**`src/lib/server/` garde son nom anglais.** C'est un chemin magique de SvelteKit : le compilateur
refuse tout import de ce dossier depuis un bundle client. Le renommer en `serveur/` supprimerait la
protection sans le moindre avertissement. L'alias `$serveur`, lui, la conserve — la vérification
porte sur le chemin résolu, pas sur le spécificateur.

**Le suffixe `.svelte.spec.ts` sélectionne le runner.** `vite.config.ts` envoie ces fichiers-là au
projet vitest « navigateur » (Chromium), et tous les autres `.spec.ts` au projet « node ». Renommer
un test en `.spec.ts` le fait basculer en silence, où il échouera — ou pire, passera pour de
mauvaises raisons.

À quoi s'ajoute une dépendance de configuration : `drizzle.config.ts` code en dur le chemin
`./src/lib/server/db/schema.ts`, et `prettier.config.js` celui de `./src/app.css`. Déplacer l'un ou
l'autre casse un outil sans erreur TypeScript.

### Le filet de sécurité des form actions

Les gabarits postent vers `?/nomAction` : des chaînes de caractères, que ni TypeScript ni
`svelte-check` ne rapprochent jamais des clés réellement exportées par le `+page.server.ts` en face.
Perdre une action au fil d'un déplacement de fichier ne casse donc aucune compilation.

`src/routes/actions.spec.ts` fige la surface exacte de chaque route et vérifie que toute cible `?/…`
écrite dans un gabarit atterrit quelque part. `src/lib/server/ia/contrat.spec.ts` fait de même pour
la surface publique du client IA. Les mettre à jour est le prix à payer pour ajouter une action ;
c'est aussi ce qui rend un déménagement de `lib/server/` vérifiable.

### Ce qui entre en base

Tout ce qui arrive du formulaire passe par `normaliserMandat` (`server/mandat/formulaire.ts`), qui repart du
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
5. **Rédaction assistée** (optionnelle) : l'aide est offerte là où elle a du sens, sous la forme que
   le champ appelle — un bouton uniforme sur chaque champ alourdirait le formulaire sans rien
   apporter.

   | Endroit                                  | Forme de l'aide                                             |
   | ---------------------------------------- | ----------------------------------------------------------- |
   | Titre du projet                          | `Proposer un titre` : déduit de la portée déjà saisie       |
   | Objet du mandat, description d'une ligne | `Étoffer avec l'IA` : un paragraphe, à prendre ou à laisser |
   | `Inclus` / `Non inclus` d'une ligne      | `Proposer avec l'IA` : des éléments à cocher un par un      |
   | Couverture de l'abonnement               | `Déduire de la portée`                                      |
   | Conditions additionnelles                | `Proposer à partir du mandat`                               |
   | Fond du mandat                           | `Relire mon mandat` : ce qui se contredit ou manque         |
   | Volet contractuel                        | `Vérifier les clauses` : la relecture complète              |
   | Document entier, depuis l'aperçu         | `Rédiger avec l'IA`                                         |

   **Chaque appel reçoit le mandat entier**, volet contractuel compris, jamais le seul champ visé :
   une description de ligne tient donc compte du reste du projet. Rien n'est appliqué sans un geste.

   `Générer` refait **toujours** la prose, y compris sur un mandat inchangé — c'est ce que le bouton
   annonce, et pour seulement relire le document il y a `Voir le document`. La passe part dans une
   requête distincte de l'enregistrement : elle peut durer quelques minutes, et le mandat ne doit pas
   rester suspendu à sa durée.

6. **Bibliothèque de clauses** : les clauses hors catalogue, réutilisables d'un mandat à l'autre.
   Elles s'ajoutent à la main depuis `/clauses`, ou entrent d'elles-mêmes quand on accepte une
   proposition de la relecture. Ce qu'un mandat retient en est une **copie figée** : corriger une
   clause dans la bibliothèque ne réécrit aucun document déjà rédigé. Une clause s'archive plutôt que
   de se supprimer.
7. **Duplication** : repartir d'un mandat existant pour un client récurrent.
8. **Suivi** : `Marquer comme envoyé` fait passer le document au statut `envoyé`, et l'opération se
   défait. Le statut est déclaratif : l'application n'envoie rien elle-même, elle note que vous
   l'avez fait.

### Ce que l'IA écrit, et ce qu'elle n'écrit pas

L'IA ne produit que du **texte** : titre, préambule, objet, descriptions de lignes, puces incluses ou
exclues, couverture d'abonnement, conditions additionnelles. Les montants, pourcentages, dates,
durées et échéanciers sont calculés et rendus par l'application à partir de la saisie, et ne peuvent
pas être modifiés par le modèle.

### Ce que le code vérifie tout seul

`domaine/coherence.ts` compare ce qui se compare, sans modèle : le même élément inclus quelque part
et exclu ailleurs, un doublon dans une liste, deux lignes homonymes, un montant sans travail décrit,
un abonnement dont on ne dit pas ce qu'il couvre, un rabais sans motif. C'est instantané, hors ligne,
et **exhaustif sur ce qu'il couvre** — là où la relecture par l'IA trouve une contradiction sur deux.

Ces avertissements s'affichent en continu pendant la saisie, sans clic, au-dessus des alertes de
l'IA et sous une étiquette distincte. L'ordre n'est pas cosmétique : mélanger « prouvé » et
« soupçonné » laisserait croire que les deux se valent.

Le partage est là : **le code vérifie ce qui se prouve, l'IA garde ce qui demande du jugement.**
Chaque règle déterministe ajoutée ici est une chose de moins à espérer du modèle.

### Deux relectures, et ce qu'elles valent

`Vérifier les clauses` regarde le **volet contractuel** : quelle protection manque, quelle condition
est restée à zéro. `Relire mon mandat` regarde le **fond** : l'objet promet-il un travail qu'aucune
ligne ne réalise, une même chose est-elle incluse ici et exclue là, une description resterait-elle
ambiguë en cas de désaccord.

Les deux **signalent sans corriger**. L'IA n'a aucun moyen de savoir ce que vous avez voulu écrire :
elle pointe l'endroit, vous tranchez. Rien n'est persisté, relancer repart d'une page blanche.

**Ce que la revue du fond attrape, et ce qu'elle rate.** Mesuré sur un mandat où une contradiction
était plantée exprès — l'objet annonçait une migration de données que la seule phase excluait
explicitement — le modèle actuel la repère **environ une fois sur deux**. Les autres fois, il signale
des écarts réels mais différents. La revue est donc un filet, pas une garantie : elle trouve souvent
quelque chose d'utile, jamais tout. Le test `en-direct.spec.ts` n'assure pour cette raison que la
forme des alertes, avec le détail du raisonnement en commentaire.

Un modèle plus gros via `AI_MODEL` améliorerait le taux. Rien dans le code ne peut le faire.

### Ce que l'IA n'écrit pas

L'invariant tient en trois points, vérifiables dans le code : les montants **ne sont pas transmis**
au modèle (`server/ia/invites.ts`), ce qu'il renvoie est **filtré contre la structure attendue**
(`server/ia/normalisation.ts`), et les chiffres sont **rendus par le gabarit** (`document/sections.ts`).
L'IA ne crée jamais une ligne de service non plus : elle complète ce que vous avez commencé.

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
npm run test:ia      # joint vraiment le modèle ; lit .env, ne tourne pas sans passerelle
npm run db:generate  # générer une migration après modification du schéma
npm run db:migrate   # appliquer les migrations
npm run db:studio    # explorateur de base de données
```

Les tests couvrent la génération du document (clauses, sections, formatage, montants), la validation,
la normalisation de ce qui entre en base, la lecture de l'identité Tailscale, et le rendu du document
dans un vrai navigateur — dont une assertion sur le style calculé, pour qu'un découpage de composants ne puisse pas
faire perdre la mise en page sans être vu.

### Tester du code qui parle à une IA

Un modèle ne rend jamais deux fois la même réponse : on ne peut pas assurer son contenu. Ce qu'on
peut assurer, ce sont les trois choses autour, et le projet a un niveau de test pour chacune.

| Ce qu'on vérifie                           | Où                      | Déterministe |
| ------------------------------------------ | ----------------------- | ------------ |
| Ce que l'application **accepte** du modèle | `normalisation.spec.ts` | oui          |
| Ce que l'application **envoie** au modèle  | `appariement.spec.ts`   | oui          |
| Ce que le modèle **renvoie vraiment**      | `en-direct.spec.ts`     | non          |

`appariement.spec.ts` intercepte l'appel réseau et vérifie l'appariement entre une demande et ses
consignes système. Il existe parce que la contradiction a eu lieu : un titre était demandé sous des
consignes qui ordonnent « produis uniquement des paragraphes de texte courant », et le modèle,
obéissant, renvoyait un début de préambule. Une chaîne de caractères contredisait une autre chaîne de
caractères, et rien dans le typage ne pouvait le voir.

`en-direct.spec.ts` est un **canari**, pas un test unitaire. Il ne tourne que si `AI_API_URL` et
`AI_API_KEY` sont présentes, se déclare _skipped_ sinon, et n'assure que la **forme** de la réponse :
un titre fait moins de dix mots et ne finit pas par un point, une puce ne contient pas de montant.
Assurer les mots exacts le rendrait rouge une fois sur deux. Il attrape ce qu'aucun autre test ne
voit : un modèle remplacé qui n'obéit plus, ou un prompt qu'on croit clair et que le modèle lit
autrement.

## À venir

- Renseigner le NEQ et le téléphone dans `PRESTATAIRE` (`src/lib/domaine/config.ts`). Tant qu'ils manquent,
  l'aperçu affiche un rappel, qui disparaît de lui-même une fois les champs remplis.
- Remplacer `src/lib/ressources/logo-intebec.svg` par le logo officiel (le fichier actuel est une
  approximation provisoire).
- Faire relire le texte des clauses par un conseiller juridique avant tout envoi réel.
- Intégration avec Intébec Sign (Docuseal) pour l'envoi direct en signature. Le statut `envoyé` est
  déjà posable à la main depuis l'aperçu.
- Historique et versions des documents générés.
- Pagination de l'accueil : la liste est bornée à huit documents par la requête, mais il n'existe pas
  encore d'écran « tous les mandats ».

README Générer par l'ia en grande partie
