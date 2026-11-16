/* Model Educ Studio — les types d'éléments qu'on peut poser sur le plateau.
   Chaque type s'appuie sur un « moteur » : un objet qui sait construire un maillage à partir
   d'un état (construire), afficher ses réglages (panneau) et, parfois, réagir à la souris.
   Les moteurs des six méthodes viennent tels quels de Model Educ (fichiers a1 à a7) ;
   les solides simples sont définis ici. Chaque élément vit dans son propre repère :
   posé sur z = 0, centré sur l'axe Z. L'application le place ensuite sur le plateau. */
(function (ME) {
  'use strict';
  const M = ME.M, C = ME.CSG;
  const atelier = id => ME.ateliers.find(a => a.id === id);

  function tore(p, rapide) {
    const n = rapide ? Math.min(p.n, 24) : p.n, m = Math.max(8, Math.round(n / 2)), R = p.D / 2, r = p.d / 2, v = [], f = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = 2 * Math.PI * i / n, b = 2 * Math.PI * j / m;
      v.push((R + r * Math.cos(b)) * Math.cos(a), (R + r * Math.cos(b)) * Math.sin(a), r + r * Math.sin(b));
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const i2 = (i + 1) % n, j2 = (j + 1) % m, a = i * m + j, b = i2 * m + j, c = i2 * m + j2, d = i * m + j2;
      f.push(a, b, c, a, c, d);
    }
    return { v, f };
  }

  const SOLIDES = {
    pave: { nom: 'Pavé', lissage: 0, defaut: { lx: 40, ly: 30, lz: 20 },
      params: [['lx', 'Longueur (X)', 1, 200, 1, 'mm'], ['ly', 'Largeur (Y)', 1, 200, 1, 'mm'], ['lz', 'Hauteur (Z)', 1, 200, 1, 'mm']],
      polys: p => C.placer(C.pave(p.lx, p.ly, p.lz), [0, 0, p.lz / 2]) },
    cylindre: { nom: 'Cylindre', lissage: 35, defaut: { d: 30, h: 30, n: 48 },
      params: [['d', 'Diamètre', 1, 200, 1, 'mm'], ['h', 'Hauteur', 1, 200, 1, 'mm'], ['n', 'Facettes', 8, 96, 4, '']],
      polys: (p, r) => C.placer(C.cylindre(p.d / 2, p.h, r ? Math.min(p.n, 24) : p.n), [0, 0, p.h / 2]) },
    cone: { nom: 'Cône', lissage: 35, defaut: { d1: 30, d2: 0, h: 30, n: 48 },
      params: [['d1', 'Diamètre du bas', 0, 200, 1, 'mm'], ['d2', 'Diamètre du haut', 0, 200, 1, 'mm'], ['h', 'Hauteur', 1, 200, 1, 'mm'], ['n', 'Facettes', 8, 96, 4, '']],
      note: 'Diamètre du haut à 0 : cône pointu. Les deux diamètres égaux : cylindre.',
      polys: (p, r) => { if (p.d1 <= 0 && p.d2 <= 0) p.d1 = 1; return C.placer(C.cone(p.d1 / 2, p.d2 / 2, p.h, r ? Math.min(p.n, 24) : p.n), [0, 0, p.h / 2]); } },
    sphere: { nom: 'Sphère', lissage: 60, defaut: { d: 30, n: 32 },
      params: [['d', 'Diamètre', 2, 200, 1, 'mm'], ['n', 'Facettes', 8, 64, 4, '']],
      note: 'Une sphère ne touche le plateau qu’en un point : regarde le contrôle d’impression.',
      polys: (p, r) => { const n = r ? Math.min(p.n, 16) : p.n; return C.placer(C.sphere(p.d / 2, n, Math.max(4, Math.round(n / 2))), [0, 0, p.d / 2]); } },
    tore: { nom: 'Tore', lissage: 60, defaut: { D: 40, d: 12, n: 40 },
      params: [['D', 'Diamètre de l’anneau', 6, 200, 1, 'mm'], ['d', 'Diamètre du tube', 2, 60, 1, 'mm'], ['n', 'Facettes', 12, 64, 4, '']],
      maille: (p, r) => { if (p.d > p.D - 2) p.d = Math.max(2, p.D - 2); return tore(p, r); } },
    prisme: { nom: 'Prisme', lissage: 0, defaut: { d: 30, h: 20, n: 6 },
      params: [['d', 'Diamètre du cercle', 2, 200, 1, 'mm'], ['h', 'Hauteur', 1, 200, 1, 'mm'], ['n', 'Nombre de côtés', 3, 12, 1, '']],
      polys: p => C.placer(C.cylindre(p.d / 2, p.h, p.n), [0, 0, p.h / 2]) }
  };

  function solide(cle) {
    const d = SOLIDES[cle];
    return {
      id: 'solides',
      defaut: () => JSON.parse(JSON.stringify(d.defaut)),
      construire(rapide) {
        const p = this.etat, m = d.maille ? d.maille(p, rapide) : C.maillage(d.polys(p, rapide));
        m.lissage = d.lissage; return m;
      },
      panneau(el, ui) {
        ui.note(el, 'Un <b>solide simple</b> : on règle ses cotes. Passe-le en <b>perçage</b> (onglet Modifier) pour qu’il enlève de la matière aux autres éléments.');
        for (const [c, nom, min, max, pas, unite] of d.params) ui.curseur(el, { nom, obj: this.etat, cle: c, min, max, pas, unite });
        if (d.note) ui.aide(el, d.note);
      },
      comprendre: atelier('solides').comprendre
    };
  }

  /* Forme figée : le résultat d'une fusion. Elle n'a plus de paramètres, seulement des triangles. */
  const fige = {
    id: 'fige', fige: true,
    defaut: () => ({ v: [], f: [] }),
    construire() { return { v: this.etat.v, f: this.etat.f, lissage: 30 }; },
    panneau(el, ui) {
      ui.note(el, 'Cette forme vient d’une <b>fusion</b>. Elle est <b>figée</b> : ses éléments d’origine ont été remplacés par un seul maillage, on ne peut plus changer leurs cotes.');
      ui.info(el, (this.etat.f.length / 3).toLocaleString('fr-FR') + ' triangles');
      ui.aide(el, 'C’est ce qui arrive aussi dans un fichier STL : il ne garde que des triangles, pas la recette.');
    },
    comprendre: atelier('solides').comprendre
  };

  /* Pièce importée d'un fichier STL : des triangles venus d'un autre logiciel. On ne peut régler que son échelle. */
  const importe = {
    id: 'importe', fige: true,
    defaut: () => ({ v: [], f: [], k: 100 }),
    construire() {
      const k = (this.etat.k || 100) / 100, s = this.etat.v, v = new Array(s.length);
      for (let i = 0; i < s.length; i++) v[i] = s[i] * k;
      return { v, f: this.etat.f, lissage: 30 };
    },
    panneau(el, ui) {
      ui.note(el, 'Cette pièce vient d’un <b>fichier STL</b> : elle a été dessinée dans un autre logiciel. Un STL ne contient que des <b>triangles</b> : ni cotes, ni recette de construction.');
      ui.info(el, (this.etat.f.length / 3).toLocaleString('fr-FR') + ' triangles');
      ui.curseur(el, { nom: 'Échelle', obj: this.etat, cle: 'k', min: 5, max: 400, pas: 5, unite: '%' });
      ui.aide(el, 'Un STL n’indique pas son unité : l’application lit ses cotes en millimètres. Si la pièce arrive trop grande ou trop petite, règle son échelle. Tu peux la déplacer, la tourner, la percer et la fusionner comme les autres éléments.');
    },
    comprendre: atelier('polygone').comprendre
  };

  const prereglage = (id, regler) => { const a = atelier(id), p = Object.create(a); p.defaut = () => { const e = a.defaut(); regler(e); return e; }; return p; };

  /* groupe = le groupe du ruban ; methode = le nom de la méthode de modélisation, affiché dans les propriétés */
  const TYPES = ME.TYPES = {};
  const ajouter = (cle, nom, groupe, methode, proto, pos) => { TYPES[cle] = { cle, nom, groupe, methode, proto, pos }; };
  for (const k in SOLIDES) ajouter(k, SOLIDES[k].nom, 'Solides', 'Solides et opérations booléennes', solide(k));
  ajouter('revolution', 'Révolution', 'Courbes', 'Courbes NURBS', atelier('nurbs'));
  ajouter('polygone', 'Polygones', 'Maillage', 'Maillage polygonal', atelier('polygone'));
  ajouter('subdivision', 'Subdivision', 'Maillage', 'Subdivision de surface', atelier('subdivision'));
  ajouter('boules', 'Boules', 'Implicite', 'Surfaces implicites', prereglage('implicite', e => { e.mode = 'boules'; }));
  ajouter('gyroide', 'Gyroïde', 'Implicite', 'Surfaces implicites', prereglage('implicite', e => { e.mode = 'gyroide'; e.res = 28; }));
  ajouter('voxels', 'Voxels', 'Volumique', 'Modélisation volumique (voxels)', atelier('voxels'));
  ajouter('equerre', 'Équerre', 'Paramétrique', 'Modélisation paramétrique', prereglage('parametrique', e => { e.modele = 'equerre'; }));
  ajouter('boite', 'Boîte', 'Paramétrique', 'Modélisation paramétrique', prereglage('parametrique', e => { e.modele = 'boite'; }));
  ajouter('engrenage', 'Roue dentée', 'Paramétrique', 'Modélisation paramétrique', prereglage('parametrique', e => { e.modele = 'engrenage'; }));
  ajouter('importe', 'Pièce importée', null, 'Maillage importé (fichier STL)', importe);
  ajouter('fige', 'Forme fusionnée', null, 'Maillage figé (résultat d’une fusion)', fige);
})(globalThis.ME = globalThis.ME || {});
