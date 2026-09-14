# Cours de mathematiques 5e-6e - Ines Cabossart

Site statique (aucune dependance, aucune etape de build) pour un cours de
mathematiques prive, filiere generale standard (4 periodes/semaine). Suit le
programme officiel FESeC "Mathematiques 2-4-6 periodes, 3e degre"
(D/2014/7362/3/16), section "Mathematiques generales (4p)".

Meme modele que le cours de geographie de la meme eleve
(https://cours-geo-5e6e.pages.dev), avec un moteur adapte aux mathematiques
(pas de cartes : flashcards, un mini-jeu different par chapitre, quiz, examen).

## Structure

- `index.html` : page d'accueil listant les 10 modules (5 pour la 5e, 5 pour la
  6e), avec deblocage sequentiel.
- `module-1.html` a `module-10.html` : un module par chapitre du programme.
  Format constant : theorie (formules, exemples resolus), entrainement
  (flashcards + jeu + quiz), examen note (seuil 60%, essais illimites).
- `shared/engine.js` et `shared/engine.css` : moteur commun. Chaque module ne
  contient que son contenu et appelle `MathEngine.initModule({...})`.
- `research/` : PDF du programme officiel FESeC utilise pour construire le
  contenu (non deploye, exclu du depot Git).

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

Module 1 construit, teste et pret a deployer. Modules 2 a 10 restants a
construire sur le meme modele.

## Deploiement

Site statique pur, deploye sur Cloudflare Pages, relie a un depot GitHub
(compte `ahmeddavidfp-spec`) : chaque push sur `main` redeploie
automatiquement. Racine du projet = racine du site (build command : aucune,
dossier de sortie : `/`).
