# Cours de mathematiques 5e-6e - Ines Cabossart

Site statique (aucune dependance, aucune etape de build) pour un cours de
mathematiques prive, filiere generale standard (4 periodes/semaine). Suit le
programme officiel FESeC "Mathematiques 2-4-6 periodes, 3e degre"
(D/2014/7362/3/16), section "Mathematiques generales (4p)"), complete par 13
modules de remise a niveau bases sur le programme officiel du deuxieme degre
"Mathematiques" (39/2000/240, 3e-4e annee de transition).

Meme modele que le cours de geographie de la meme eleve
(https://cours-geo-5e6e.pages.dev), avec un moteur adapte aux mathematiques
(pas de cartes : flashcards, un mini-jeu different par chapitre, quiz, examen).

## Structure

- `index.html` : page d'accueil listant les 23 modules (13 de remise a
  niveau, puis 5 pour la 5e, 5 pour la 6e), avec deblocage sequentiel continu
  sur l'ensemble du parcours.
- `module-p1.html` a `module-p13.html` : modules de remise a niveau (2e
  degre, 3e-4e annee), a faire avant le module 1 si l'eleve a besoin de
  revoir les bases. Meme format que les autres modules.
- `module-1.html` a `module-10.html` : un module par chapitre du programme
  du 3e degre (5e-6e annee). Format constant : theorie (formules, exemples
  resolus), entrainement (flashcards + jeu + quiz), examen note (seuil 60%,
  essais illimites).
- `shared/engine.js` et `shared/engine.css` : moteur commun. Chaque module ne
  contient que son contenu et appelle `MathEngine.initModule({...})`.
- `research/` : PDF des programmes officiels FESeC utilises pour construire
  le contenu (non deployes, exclus du depot Git).

## Jeux par module

Le moteur supporte trois mecaniques de jeu, choisies au cas par cas selon ce
qui convient le mieux au chapitre (`cfg.game.type`) :
- `chrono` : calcul rapide, temps limite global, score = nombre de bonnes
  reponses.
- `order` : remettre dans le bon ordre les etapes d'une methode (boutons
  monter/descendre).
- `match` : association (reutilise le rendu du type de question `match` du
  quiz), pour associer par exemple un graphique a une propriete.

## Modules

### Remise a niveau (2e degre, 3e annee)
P1. Fonctions du premier degre
P2. Equations, inequations et systemes du premier degre
P3. Calcul numerique et polynomes
P4. Theoreme de Pythagore et configurations de Thales
P5. Angles, isometrie et similitude des triangles
P6. Trigonometrie du triangle rectangle

### Remise a niveau (2e degre, 4e annee)
P7. Fonctions de reference et transformations
P8. Radicaux, puissances rationnelles et coefficients indetermines
P9. Fonction du deuxieme degre
P10. Calcul vectoriel et produit scalaire
P11. Trigonometrie du cercle
P12. Lieux geometriques
P13. Statistique a une variable

### 5e annee
1. Statistique a deux variables (correlation, ajustement lineaire)
2. Suites
3. Asymptotes et limites
4. Derivee
5. Fonctions trigonometriques

### 6e annee
6. Probabilite
7. Lois de probabilite
8. Integrale
9. Fonctions exponentielles et logarithmes
10. Geometrie analytique de l'espace

## Statut

Les 23 modules (13 de remise a niveau + 10 de 5e-6e annees) sont construits
et deployes. Chaque section de theorie contient des termes techniques
marques pour l'infobulle et la lecture orale au survol (voir
shared/engine.js). Les modules de remise a niveau P1-P13 sont grounded dans
le programme officiel FESeC "Mathematiques" (39/2000/240), avec exemples
numeriques verifies independamment (Python) avant integration.

## Deploiement

Site statique pur, deploye sur Cloudflare Pages, relie a un depot GitHub
(compte `ahmeddavidfp-spec`) : chaque push sur `main` redeploie
automatiquement. Racine du projet = racine du site (build command : aucune,
dossier de sortie : `/`).
