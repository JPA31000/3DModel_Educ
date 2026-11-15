# Model Educ Studio

Atelier de modélisation 3D pour l’impression 3D, dans une interface « à ruban » : menu Fichier, onglets d’outils, fenêtre Propriétés, arborescence du projet, vue 3D avec cube de vues, volet de contrôle d’impression.

**Outil pédagogique, pas un logiciel professionnel.** Il ne remplace ni un logiciel de CAO, ni un trancheur.

## Ce qu’on y fait

- **Créer** : poser sur le plateau des éléments issus de sept méthodes de modélisation — solides (pavé, cylindre, cône, sphère, tore, prisme), courbes NURBS (révolution), maillage polygonal, subdivision de surface, surfaces implicites (boules, gyroïde), voxels, pièces paramétriques (équerre, boîte, roue dentée).
- **Régler** : nom, rôle, couleur, position, rotation et forme dans la fenêtre Propriétés ; points de contrôle, faces et cubes directement dans la vue.
- **Modifier** : dupliquer, supprimer, percer (un élément « perçage » enlève de la matière), fusionner, poser, centrer, tourner.
- **Voir** : vues de face, de dessus, de côté ; styles ombré, arêtes, filaire ; surplombs en rouge.
- **Imprimer** : contrôle d’imprimabilité (étanchéité, dimensions, surplombs, contact, morceaux), aperçu des couches, export STL en millimètres.
- **Fichier** : nouveau, ouvrir, enregistrer (fichier `.modeleduc.json`), exemples.

## Fonctionnement

Page statique, sans aucune bibliothèque : elle marche en ligne (GitHub Pages) et hors ligne, en ouvrant `index.html`. Le projet en cours est gardé dans le navigateur ; rien n’est envoyé sur Internet.

Les moteurs de géométrie (`js/moteur.js`, `maillage.js`, `csg.js`, `cage.js`, `a1` à `a7`) viennent de [Model Educ](https://github.com/JPA31000/Model_Educ). `js/types.js` décrit les éléments du ruban, `js/studio.js` est l’application.

## Limites connues

- Perçages et fusion : calculés jusqu’à 4 500 triangles ; au-delà, l’application le dit et n’applique pas l’opération.
- Le contrôle ne vérifie ni l’épaisseur des parois, ni les faces qui se traversent. La masse est un ordre de grandeur.
- Deux éléments pleins qui se recouvrent sont exportés comme deux coques (le trancheur les soude) ; « Fusionner » donne un maillage unique.

Sur une idée de Jean-Philippe Amat, lycée Urbain Vitry (Toulouse) · Créateur : Claude · Licence CC BY-NC-SA 4.0.
