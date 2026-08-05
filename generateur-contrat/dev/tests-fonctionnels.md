# Tests fonctionnels — Générateur de soumissions et contrats (DocGen)

**Application** : générateur de soumissions et contrats Intébec (`generateur-contrat`) · version `0.0.1`
**Auteur** : Justin Chaput · **Dernière mise à jour** : 5 août 2026
**Contenu** : 79 tests fonctionnels répartis en 13 volets, plus 316 tests automatisés (§4).

## 1. À quoi sert ce document

Il liste les **tests fonctionnels** de l'application : chaque test nomme une chose à essayer dans
l'application en marche, et dit ce que l'application doit faire en retour. C'est le point de vue de la
personne qui utilise le logiciel, pas celui du code.

Les tests automatisés (§4) vérifient des fonctions isolées — un calcul, une normalisation. Les tests
ci-dessous vérifient des **parcours complets** : un clic, une page, un fichier téléchargé. Les deux
sont nécessaires : une règle peut être juste dans le code et mal branchée à l'interface.

**Environnement** : `docker compose up -d` (Postgres 16 + serveur de dev sur `127.0.0.1:5173`),
navigateur Chromium, passerelle IA locale joignable, Chromium présent pour le PDF.

**Priorité** : `P1` bloquant (le document ou les données sont en jeu) · `P2` important · `P3` confort.

---

## 2. Les tests

### A — Accès et sécurité réseau (4 tests)

L'application n'a ni compte ni mot de passe : l'accès est contrôlé par le réseau (Tailscale). A-02 est
le test le plus important du document, c'est le seul dont l'échec exposerait les données clients.

| ID   | P   | Test                            | Ce qu'il vérifie                                                                                    |
| ---- | --- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| A-01 | P1  | Accès en boucle locale          | L'application répond bien sur `127.0.0.1:5173` (code 200).                                          |
| A-02 | P1  | Accès depuis le réseau local    | La connexion à l'adresse LAN du serveur est **refusée** : le port n'existe pas pour les voisins.    |
| A-03 | P1  | Accès par le tailnet en HTTPS   | Un poste membre du tailnet ouvre le site en HTTPS, sans avertissement de certificat.                |
| A-04 | P2  | Identité affichée dans l'entête | Le nom du compte Tailscale apparaît dans la barre du haut ; il est ignoré si la requête est forgée. |

### B — Fiches clients (7 tests)

| ID   | P   | Test                             | Ce qu'il vérifie                                                                                              |
| ---- | --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| B-01 | P1  | Créer un client                  | Une fiche complète est enregistrée et relue à l'identique sur sa page.                                        |
| B-02 | P1  | Créer un client sans nom         | La création est refusée ; aucune fiche fantôme n'est créée.                                                   |
| B-03 | P2  | Rechercher un client             | La recherche trouve par nom, représentant, courriel, téléphone ou numéro d'entreprise, sans accents ni casse. |
| B-04 | P3  | Recherche sans résultat          | Un message explicite s'affiche et le compteur indique `0 / n`.                                                |
| B-05 | P2  | Mettre à jour la fiche du mandat | Corriger les coordonnées depuis l'éditeur met la fiche client à jour sans quitter le mandat.                  |
| B-06 | P1  | Archiver puis désarchiver        | La fiche et ses mandats sortent des listes courantes, puis y reviennent intacts.                              |
| B-07 | P1  | Supprimer un client              | La suppression exige de recopier le nom du client ; un nom faux laisse le bouton désactivé.                   |

### C — Saisie et enregistrement d'un mandat (6 tests)

| ID   | P   | Test                             | Ce qu'il vérifie                                                                                      |
| ---- | --- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| C-01 | P1  | Enregistrer un brouillon         | Le mandat est enregistré, un bandeau le confirme, et il apparaît à l'accueil au statut « brouillon ». |
| C-02 | P1  | Relire un brouillon              | Tous les champs sont relus à l'identique après avoir quitté puis rouvert la page.                     |
| C-03 | P2  | Choisir un client existant       | Les coordonnées remplissent le formulaire et le mandat est rattaché à la fiche.                       |
| C-04 | P2  | Créer le client depuis l'éditeur | Cocher l'enregistrement crée la fiche en même temps que le mandat ; sans la cocher, aucune fiche.     |
| C-05 | P2  | Soumission ou contrat            | Le type change l'intitulé du document et la soumission seule porte l'article « Validité ».            |
| C-06 | P2  | Structure du projet              | « Phases », « blocs » ou « récurrent » change le vocabulaire partout, saisie et document compris.     |

### D — Portée et tarification (6 tests)

| ID   | P   | Test                         | Ce qu'il vérifie                                                                                     |
| ---- | --- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| D-01 | P1  | Ajouter et retirer une ligne | La numérotation se resserre sans trou ; la dernière ligne n'est pas supprimable.                     |
| D-02 | P1  | Tarif forfaitaire            | Le sous-total de la ligne vaut le montant saisi, au format monétaire canadien-français.              |
| D-03 | P1  | Tarif horaire                | Le sous-total vaut taux × heures.                                                                    |
| D-04 | P1  | Lignes détaillées            | Le sous-total vaut la somme des quantités × prix unitaires, et suit l'ajout ou le retrait d'un item. |
| D-05 | P1  | Totaux et rabais             | Sous-total, rabais et total net concordent entre l'éditeur et le tableau des honoraires du document. |
| D-06 | P2  | Rabais hors bornes           | Un rabais de 100 % donne un total nul, jamais négatif ; au-delà de 100 %, la génération est refusée. |

### E — Modalités de paiement et abonnement (5 tests)

| ID   | P   | Test                      | Ce qu'il vérifie                                                                                               |
| ---- | --- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| E-01 | P1  | Tout à la livraison       | Le document annonce un versement unique nommé « paiement intégral », et non un « solde ».                      |
| E-02 | P1  | Acompte puis solde        | Le solde se calcule seul (100 % − acompte) et l'échéancier répartit le total net dans ces proportions.         |
| E-03 | P2  | Tout à la signature       | Le champ de délai disparaît : sans solde à venir, il n'a rien à retarder.                                      |
| E-04 | P1  | Délai de paiement négatif | La génération est refusée avec un message clair.                                                               |
| E-05 | P1  | Abonnement récurrent      | Un abonnement actif sans montant bloque la génération ; renseigné, il apparaît au document avec sa couverture. |

### F — Conditions et bibliothèque de clauses (7 tests)

| ID   | P   | Test                             | Ce qu'il vérifie                                                                                           |
| ---- | --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| F-01 | P1  | Activer et désactiver une clause | Décocher une clause retire son article ; les suivants se renumérotent sans trou.                           |
| F-02 | P2  | Conditions chiffrées             | Garantie, support, formation, taux hors périmètre et préavis apparaissent dans l'article qui les porte.    |
| F-03 | P1  | Créer une clause                 | Une clause saisie à la main rejoint la bibliothèque, ses paragraphes conservés ; sans texte, c'est refusé. |
| F-04 | P2  | Modifier une clause              | Le nouveau texte remplace l'ancien dans la bibliothèque.                                                   |
| F-05 | P2  | Archiver puis désarchiver        | La clause sort de la bibliothèque et cesse d'être proposée, puis redevient disponible.                     |
| F-06 | P1  | Ajouter une clause à un mandat   | La clause devient un article du document et reste modifiable dans le mandat.                               |
| F-07 | P1  | Copie figée                      | Modifier une clause dans la bibliothèque ne change **aucun** document déjà rédigé.                         |

### G — Validation : ce qui bloque la génération (6 tests)

| ID   | P   | Test                            | Ce qu'il vérifie                                                                                                 |
| ---- | --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| G-01 | P1  | Formulaire vide                 | Rien n'est généré ; les manques sont listés (client, titre, objet, nom et montant de la ligne).                  |
| G-02 | P2  | Aucune erreur avant l'essai     | Un formulaire qu'on vient d'ouvrir n'affiche aucun reproche : les messages n'apparaissent qu'après un essai.     |
| G-03 | P1  | Courriel invalide               | Un courriel mal formé bloque la génération ; un courriel vide est accepté.                                       |
| G-04 | P1  | Ligne sans nom ou à zéro        | Une ligne sans nom, ou dont le montant est nul, bloque la génération.                                            |
| G-05 | P1  | Validation rejouée côté serveur | Une requête forgée qui contourne l'interface est refusée quand même : le navigateur ne fait pas foi.             |
| G-06 | P1  | Données difformes               | Un envoi mal formé est reconstruit au lieu de faire planter la page à chaque visite suivante (plafonds compris). |

### H — Cohérence : ce qui avertit sans bloquer (7 tests)

Ces vérifications sont faites par le code, hors ligne, sans clic et sans l'IA. Le libellé cité suit la
structure choisie (phase, bloc ou service).

| ID   | P   | Test                               | Ce qu'il vérifie                                                                              |
| ---- | --- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| H-01 | P1  | Élément inclus ici, exclu ailleurs | La même chose promise dans une ligne et exclue dans une autre est signalée immédiatement.     |
| H-02 | P2  | Contradiction dans la même ligne   | Un élément à la fois inclus et exclu au même endroit est signalé à part.                      |
| H-03 | P2  | Doublon dans une liste             | Le même élément listé deux fois est repéré, même écrit sans accents ni majuscules.            |
| H-04 | P2  | Deux lignes homonymes              | Deux lignes de même nom sont signalées : seul le numéro les distinguerait au contrat.         |
| H-05 | P2  | Montant sans travail décrit        | Une ligne qui porte un prix sans rien décrire est signalée.                                   |
| H-06 | P2  | Abonnement sans couverture         | Un abonnement dont on ne dit pas ce qu'il couvre est signalé.                                 |
| H-07 | P1  | Les avertissements ne bloquent pas | Un mandat plein d'avertissements se génère quand même : ils informent, ils n'interdisent pas. |

### I — Génération et contenu du document (6 tests)

| ID   | P   | Test                       | Ce qu'il vérifie                                                                                                 |
| ---- | --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| I-01 | P1  | Générer le document        | L'aperçu s'ouvre et le mandat passe au statut « généré ».                                                        |
| I-02 | P1  | Identification des parties | Ouverture « Entre » / « Et » avec les désignations « (ci-après « … ») », selon l'usage québécois.                |
| I-03 | P1  | Articles numérotés         | Objet, portée, honoraires, paiement, puis un article par clause active : numérotation continue, sans trou.       |
| I-04 | P1  | Tableau des honoraires     | Chaque ligne y figure avec son détail de calcul, et les totaux sont ceux de l'éditeur — aucun montant recalculé. |
| I-05 | P1  | Échéancier                 | Les versements suivent le mode de paiement choisi et totalisent le total net.                                    |
| I-06 | P2  | Clôture et signatures      | Formule « En foi de quoi », lieu, date, puis les deux blocs de signature (prestataire et client).                |

### J — Rédaction assistée par l'IA locale (9 tests)

L'IA n'écrit que de la prose ; les montants ne lui sont jamais transmis. J-08 est le test qui compte le
plus : l'application doit rester entièrement utilisable sans IA.

| ID   | P   | Test                           | Ce qu'il vérifie                                                                                                            |
| ---- | --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| J-01 | P2  | Proposer un titre              | Un titre court est proposé à partir de la portée déjà saisie, à accepter ou à refuser.                                      |
| J-02 | P2  | Étoffer un texte               | Objet et descriptions de lignes reçoivent une proposition ; « Utiliser ce texte » l'applique, « Ignorer » la jette.         |
| J-03 | P2  | Proposer des éléments          | Les inclus et exclusions sont proposés en cases à cocher : la décision se prend puce par puce.                              |
| J-04 | P2  | Relire le fond du mandat       | La revue signale des écarts, chacun rattaché à un endroit précis, et ne corrige rien d'elle-même.                           |
| J-05 | P1  | Vérifier les clauses           | La relecture propose des clauses à activer ou à retenir ; accepter une proposition l'ajoute au mandat et à la bibliothèque. |
| J-06 | P1  | Rédiger le document entier     | La prose de l'IA remplace la saisie dans le document, **sans** toucher aux montants, dates et clauses.                      |
| J-07 | P1  | Accepter ou refuser un passage | Refuser un passage rétablit la saisie à cet endroit, dans l'aperçu et dans le PDF, et l'opération se défait.                |
| J-08 | P1  | IA injoignable                 | Les boutons d'assistance disparaissent, l'application reste utilisable, et le document se génère normalement.               |
| J-09 | P1  | Rédaction périmée              | Modifier la saisie après une rédaction déclenche un avertissement ; modifier un simple montant ne périme rien.              |

### K — Export PDF et impression (5 tests)

| ID   | P   | Test                      | Ce qu'il vérifie                                                                          |
| ---- | --- | ------------------------- | ----------------------------------------------------------------------------------------- |
| K-01 | P1  | Télécharger le PDF        | Le fichier produit correspond à l'aperçu : mêmes articles, mêmes montants, mêmes clauses. |
| K-02 | P1  | Numérotation des pages    | Chaque page porte « Page X sur Y » et la mention du document, sans recouvrir le texte.    |
| K-03 | P2  | Nom du fichier            | Le nom est dérivé du mandat : sans accents, sans ponctuation, en minuscules, daté.        |
| K-04 | P1  | Le PDF suit les décisions | Un passage refusé de l'IA apparaît bien en version saisie dans le PDF.                    |
| K-05 | P2  | Impression navigateur     | `Ctrl+P` n'imprime que le document : ni boutons, ni bandeaux, ni panneau de révision.     |

### L — Cycle de vie des documents (6 tests)

| ID   | P   | Test                        | Ce qu'il vérifie                                                                                  |
| ---- | --- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| L-01 | P2  | Marquer comme envoyé        | Le statut passe à « envoyé » et l'opération se défait ; l'application n'envoie rien elle-même.    |
| L-02 | P1  | Dupliquer un mandat         | Une copie s'ouvre au statut brouillon, datée du jour, client conservé.                            |
| L-03 | P1  | La copie est indépendante   | Modifier la copie ne touche pas l'original.                                                       |
| L-04 | P2  | Archiver puis désarchiver   | Le document quitte les documents récents sans être détruit, puis y revient.                       |
| L-05 | P1  | Supprimer un document       | « Annuler » ne supprime rien ; confirmé, le document disparaît partout et son adresse répond 404. |
| L-06 | P3  | Accueil borné à 8 documents | Avec dix mandats, l'accueil en montre huit, les plus récemment modifiés en tête.                  |

### M — Robustesse et qualité (5 tests)

| ID   | P   | Test                          | Ce qu'il vérifie                                                                   |
| ---- | --- | ----------------------------- | ---------------------------------------------------------------------------------- |
| M-01 | P2  | Adresse inexistante           | Un mandat ou un client introuvable donne une erreur 404 propre, sans écran blanc.  |
| M-02 | P1  | Persistance après redémarrage | `docker compose restart` ne perd aucune donnée : tout vit dans PostgreSQL.         |
| M-03 | P2  | Double clic sur « Générer »   | Le bouton se désactive pendant l'opération : aucun mandat en double.               |
| M-04 | P3  | Navigation au clavier         | Tout est atteignable au clavier, les boîtes de confirmation se ferment avec Échap. |
| M-05 | P2  | Contrôles avant livraison     | `npm run check` (types + accessibilité) et `npm run lint` ne signalent rien.       |

---

## 3. Récapitulatif

| Volet | Sujet                       | Tests  | Dont P1 |
| ----- | --------------------------- | ------ | ------- |
| A     | Accès et sécurité réseau    | 4      | 3       |
| B     | Fiches clients              | 7      | 4       |
| C     | Saisie et enregistrement    | 6      | 2       |
| D     | Portée et tarification      | 6      | 5       |
| E     | Paiement et abonnement      | 5      | 4       |
| F     | Conditions et clauses       | 7      | 4       |
| G     | Validation (blocages)       | 6      | 5       |
| H     | Cohérence (avertissements)  | 7      | 2       |
| I     | Génération et document      | 6      | 5       |
| J     | Rédaction assistée par l'IA | 9      | 5       |
| K     | Export PDF et impression    | 5      | 3       |
| L     | Cycle de vie des documents  | 6      | 3       |
| M     | Robustesse et qualité       | 5      | 1       |
|       | **Total**                   | **79** | **46**  |

Chaque fonctionnalité annoncée au `README.md` est couverte par au moins un test P1 : accès (A), clients
(B), saisie du mandat (C à F), génération du document (I), export PDF (K), rédaction assistée (J),
bibliothèque de clauses (F), duplication et suivi (L).

## 4. Tests automatisés, en complément

`npm run test` — **19 fichiers, 316 tests verts, 5 ignorés**, en environ 4 secondes (dernière
exécution : 5 août 2026). Les 5 ignorés sont le test « canari » qui appelle vraiment le modèle : il ne
s'exécute que si la passerelle IA est configurée.

| Ce qu'ils figent                                 | Fichiers                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Calculs monétaires, rabais, total net            | `montants.spec.ts`                                                                                          |
| Règles qui bloquent la génération                | `validation.spec.ts`                                                                                        |
| Avertissements de cohérence                      | `coherence.spec.ts`                                                                                         |
| Contenu et ordre du document généré              | `sections.spec.ts`, `clauses.spec.ts`, `format.spec.ts`                                                     |
| Révision passage par passage, péremption         | `diff.spec.ts`, `empreinte.spec.ts`                                                                         |
| Ce qui entre en base (frontière de confiance)    | `mandat/formulaire.spec.ts`, `formulaire.spec.ts`                                                           |
| Identité Tailscale, nom de fichier PDF           | `acces.spec.ts`, `pdf.spec.ts`                                                                              |
| Échanges avec l'IA (envoi, réception, panne)     | `appariement.spec.ts`, `normalisation.spec.ts`, `transport.spec.ts`, `contrat.spec.ts`, `en-direct.spec.ts` |
| Actions de chaque page, rendu dans un navigateur | `actions.spec.ts`, `Rendu.svelte.spec.ts`                                                                   |
