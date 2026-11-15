/* Atelier 7 — Modélisation paramétrique.
   La pièce est décrite par des cotes (les paramètres), des relations entre ces cotes et un
   arbre de construction : une suite d'étapes (esquisse, extrusion, perçage…) rejouée à chaque
   modification. Changer une cote reconstruit toute la pièce.
   Trois modèles : une équerre, une boîte à couvercle, une roue dentée (profil simplifié,
   ce n'est pas une vraie développante de cercle). */
(function (ME) {
  'use strict';
  const M = ME.M, C = ME.CSG;
  const A = { id: 'parametrique', nom: 'Modélisation paramétrique', court: 'Paramétrique', accroche: 'Des cotes et des étapes : on change un nombre, la pièce se reconstruit.' };
  const nb = (x, d) => x.toFixed(d === undefined ? 1 : d).replace('.', ',').replace(/,0$/, '');
  const borne = (p, cle, max, notes, pourquoi) => { if (p[cle] > max) { p[cle] = Math.max(0, Math.floor(max * 10) / 10); notes.push(pourquoi); } };

  /* contour d'un rectangle aux angles arrondis, centré, sens trigonométrique */
  function arrondi(L, l, r) {
    if (r < 0.2) return [[-L / 2, -l / 2], [L / 2, -l / 2], [L / 2, l / 2], [-L / 2, l / 2]];
    const pts = [], coins = [[L / 2 - r, -l / 2 + r, -90], [L / 2 - r, l / 2 - r, 0], [-L / 2 + r, l / 2 - r, 90], [-L / 2 + r, -l / 2 + r, 180]];
    for (const [cx, cy, a0] of coins) for (let i = 0; i <= 6; i++) { const a = (a0 + i * 15) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }

  const MODELES = {
    equerre: {
      nom: 'Équerre de fixation',
      defaut: { L1: 50, L2: 40, b: 30, e: 4, d: 5, n: 1, g: 12, etapes: [1, 1, 1, 1] },
      params: [['L1', 'Aile horizontale', 20, 100, 1, 'mm'], ['L2', 'Aile verticale', 20, 100, 1, 'mm'], ['b', 'Largeur', 10, 60, 1, 'mm'], ['e', 'Épaisseur', 2, 8, 0.5, 'mm'],
        ['g', 'Gousset (renfort)', 4, 40, 1, 'mm'], ['d', 'Diamètre des trous', 3, 12, 0.5, 'mm'], ['n', 'Trous par aile', 1, 3, 1, '']],
      etapes: ['Esquisse en L, puis extrusion', 'Gousset de renfort', 'Perçages de l’aile horizontale', 'Perçages de l’aile verticale'],
      contraindre(p) {
        const notes = [], gg = p.etapes[1] ? p.g : 0;
        borne(p, 'd', p.b - 6, notes, 'Le trou garde 3 mm de matière de chaque côté : diamètre ≤ largeur − 6.');
        if (p.etapes[1]) { borne(p, 'g', Math.min(p.L1, p.L2) - p.e - p.d - 4, notes, 'Le gousset laisse la place d’un trou au bout de chaque aile.'); }
        const place = Math.min(p.L1, p.L2) - p.e - (p.etapes[1] ? p.g : gg);
        while (p.n > 1 && place / p.n < p.d + 3) { p.n--; notes.push('Pas assez de longueur pour autant de trous : nombre réduit.'); }
        return notes;
      },
      relations(p) {
        const g = p.etapes[1] ? p.g : 0;
        return ['Entraxe des trous (aile horizontale) = (L1 − e − g) ÷ n = ' + nb((p.L1 - p.e - g) / p.n) + ' mm',
          'Entraxe des trous (aile verticale) = (L2 − e − g) ÷ n = ' + nb((p.L2 - p.e - g) / p.n) + ' mm',
          'Matière de chaque côté d’un trou = (b − d) ÷ 2 = ' + nb((p.b - p.d) / 2) + ' mm'];
      },
      construire(p, rapide) {
        const { L1, L2, b, e, d, n } = p, g = p.etapes[1] ? p.g : 0, seg = rapide ? 12 : 24, debout = q => C.placer(q, [-L1 / 2, b / 2, 0], [90, 0, 0]);
        let s = debout(C.extrusion([[0, 0], [L1, 0], [L1, e], [e, e], [e, L2], [0, L2]], 0, b));
        if (p.etapes[1]) s = C.unir(s, debout(C.extrusion([[e / 2, e / 2], [e + g, e / 2], [e / 2, e + g]], (b - e) / 2, (b + e) / 2)));
        for (let i = 0; i < n; i++) {
          if (p.etapes[2]) s = C.enlever(s, C.placer(C.cylindre(d / 2, e + 2, seg), [-L1 / 2 + e + g + (L1 - e - g) * (i + 0.5) / n, 0, e / 2]));
          if (p.etapes[3]) s = C.enlever(s, C.placer(C.cylindre(d / 2, e + 2, seg), [-L1 / 2 + e / 2, 0, e + g + (L2 - e - g) * (i + 0.5) / n], [0, 90, 0]));
        }
        return s;
      }
    },
    boite: {
      nom: 'Boîte à couvercle',
      defaut: { L: 60, l: 40, H: 30, e: 2, r: 6, jeu: 0, etapes: [1, 1, 0] },
      params: [['L', 'Longueur', 20, 100, 1, 'mm'], ['l', 'Largeur', 20, 100, 1, 'mm'], ['H', 'Hauteur', 8, 80, 1, 'mm'], ['e', 'Épaisseur de paroi', 0.8, 5, 0.4, 'mm'],
        ['r', 'Rayon des angles', 0, 30, 1, 'mm'], ['jeu', 'Jeu du couvercle', 0, 1, 0.1, 'mm']],
      etapes: ['Contour arrondi, puis extrusion', 'Évidement (coque)', 'Couvercle à lèvre, posé à côté'],
      contraindre(p) {
        const notes = [];
        borne(p, 'r', Math.min(p.L, p.l) / 2 - 0.5, notes, 'Le rayon des angles ne peut pas dépasser la moitié du petit côté.');
        borne(p, 'e', Math.min(p.L, p.l, p.H * 2) / 4 - 0.5, notes, 'La paroi est trop épaisse pour laisser un vide à l’intérieur.');
        return notes;
      },
      relations(p) {
        return ['Intérieur = (L − 2e) × (l − 2e) × (H − e) = ' + nb(p.L - 2 * p.e) + ' × ' + nb(p.l - 2 * p.e) + ' × ' + nb(p.H - p.e) + ' mm',
          'Lèvre du couvercle = intérieur − 2 × jeu = ' + nb(p.L - 2 * p.e - 2 * p.jeu) + ' × ' + nb(p.l - 2 * p.e - 2 * p.jeu) + ' mm',
          p.jeu < 0.15 ? 'Avec un jeu de 0, le couvercle imprimé ne rentrera pas : il faut 0,2 à 0,4 mm.' : 'Jeu de ' + nb(p.jeu) + ' mm de chaque côté.'];
      },
      construire(p) {
        const { L, l, H, e, r, jeu } = p, dx = p.etapes[2] ? -(L + 8) / 2 : 0;
        let s = C.extrusion(arrondi(L, l, r), 0, H);
        if (p.etapes[1]) s = C.enlever(s, C.extrusion(arrondi(L - 2 * e, l - 2 * e, Math.max(0, r - e)), e, H + 1));
        s = C.placer(s, [dx, 0, 0]);
        if (p.etapes[2]) {
          const Li = L - 2 * e - 2 * jeu, li = l - 2 * e - 2 * jeu, ri = Math.max(0, r - e - jeu);
          let levre = C.extrusion(arrondi(Li, li, ri), e - 0.4, e + 4);
          levre = C.enlever(levre, C.extrusion(arrondi(Li - 2 * e, li - 2 * e, Math.max(0, ri - e)), e - 1, e + 5));
          s = s.concat(C.placer(C.unir(C.extrusion(arrondi(L, l, r), 0, e), levre), [-dx, 0, 0]));
        }
        return s;
      }
    },
    engrenage: {
      nom: 'Roue dentée',
      defaut: { Z: 16, m: 2, ep: 8, al: 6, etapes: [1, 1, 0] },
      params: [['Z', 'Nombre de dents', 8, 40, 1, ''], ['m', 'Module', 1, 4, 0.5, 'mm'], ['ep', 'Épaisseur', 3, 20, 1, 'mm'], ['al', 'Diamètre de l’alésage', 2, 30, 0.5, 'mm']],
      etapes: ['Profil denté, puis extrusion', 'Alésage (trou de l’axe)', 'Six trous d’allègement'],
      contraindre(p) {
        const notes = [];
        borne(p, 'al', p.m * (p.Z - 2.5) - 6, notes, 'L’alésage garde 3 mm de matière sous les dents.');
        return notes;
      },
      relations(p) {
        return ['Diamètre primitif = module × dents = ' + nb(p.m * p.Z) + ' mm', 'Diamètre de tête = module × (dents + 2) = ' + nb(p.m * (p.Z + 2)) + ' mm',
          'Diamètre de pied = module × (dents − 2,5) = ' + nb(p.m * (p.Z - 2.5)) + ' mm', 'Pas = π × module = ' + nb(Math.PI * p.m, 2) + ' mm',
          'Deux roues n’engrènent que si elles ont le même module.'];
      },
      construire(p, rapide) {
        const { Z, m, ep, al } = p, rp = m * Z / 2, ra = rp + m, rf = rp - 1.25 * m, a = Math.PI / (2 * Z), c = [];
        for (let k = 0; k < Z; k++) {
          const t = 2 * Math.PI * k / Z;
          for (const [r, da] of [[rf, -1.3], [rp, -1], [ra, -0.45], [ra, 0.45], [rp, 1], [rf, 1.3]]) c.push([r * Math.cos(t + da * a), r * Math.sin(t + da * a)]);
        }
        /* le profil est découpé en morceaux convexes : le disque de pied, puis une dent après l'autre */
        const disque = [], dents = [];
        for (let k = 0; k < Z; k++) { disque.push(6 * k, 6 * k + 5); dents.push([0, 1, 2, 3, 4, 5].map(i => 6 * k + i)); }
        let s = C.extrusion(c, 0, ep, [disque, ...dents]);
        if (p.etapes[1]) s = C.enlever(s, C.placer(C.cylindre(al / 2, ep + 2, rapide ? 12 : 24), [0, 0, ep / 2]));
        const bord = p.etapes[1] ? al / 2 : 0, rt = (rf - bord) / 4;
        if (p.etapes[2] && rt >= 1.5) for (let i = 0; i < 6; i++) {
          const t = Math.PI * i / 3 + Math.PI / 6;
          s = C.enlever(s, C.placer(C.cylindre(rt, ep + 2, rapide ? 10 : 16), [(rf + bord) / 2 * Math.cos(t), (rf + bord) / 2 * Math.sin(t), ep / 2]));
        }
        return s;
      }
    }
  };
  A.MODELES = MODELES;

  A.defaut = () => {
    const e = { modele: 'equerre' };
    for (const k in MODELES) e[k] = JSON.parse(JSON.stringify(MODELES[k].defaut));
    return e;
  };
  A.construire = function (rapide) {
    const e = this.etat, mo = MODELES[e.modele], p = e[e.modele];
    this.notes = mo.contraindre(p);
    let m;
    try { m = C.maillage(mo.construire(p, rapide)); } catch (err) { m = { v: [], f: [] }; this.notes.push('La pièce n’a pas pu être reconstruite avec ces valeurs.'); }
    m.lissage = 35; this.fins = rapide ? [] : M.aretesVives(m, 35);
    return m;
  };
  A.decor = function () { return { fantomes: [], fins: [{ seg: this.fins || [], c: [0.1, 0.13, 0.16, 0.8] }], poignees: [] }; };

  A.panneau = function (el, ui) {
    const e = this.etat, mo = MODELES[e.modele], p = e[e.modele];
    ui.choix(el, { nom: 'Modèle', obj: e, cle: 'modele', options: Object.keys(MODELES).map(k => [k, MODELES[k].nom]), refaire: true, apres: () => ME.app.cadrer() });
    ui.note(el, 'Ici on ne touche pas à la forme : on change des <b>cotes</b>. La pièce est reconstruite en rejouant les étapes de l’arbre de construction.');
    ui.titre(el, 'Paramètres');
    for (const [cle, nom, min, max, pas, unite] of mo.params) ui.curseur(el, { nom, obj: p, cle, min, max, pas, unite, relire: true });
    const zone = ui.bloc(el, 'relations');
    A.rafraichir = () => {
      zone.innerHTML = '<h4>Relations calculées</h4>' + mo.relations(p).map(r => '<div class="relation">' + r + '</div>').join('') +
        (this.notes && this.notes.length ? [...new Set(this.notes)].map(n => '<div class="contrainte">Contrainte : ' + n + '</div>').join('') : '');
    };
    A.rafraichir();
    ui.titre(el, 'Arbre de construction');
    mo.etapes.forEach((nom, i) => ui.case(el, { nom: (i + 1) + ' · ' + nom, obj: p.etapes, cle: i, fige: i === 0 }));
    ui.aide(el, 'Décoche une étape pour voir la pièce sans elle : l’historique reste modifiable à tout moment.');
  };
  A.apresMaj = function () { if (A.rafraichir) A.rafraichir(); };

  A.comprendre = `
<p><b>Le principe.</b> La pièce n’est pas une forme figée : c’est un <b>programme</b>. On donne des <b>paramètres</b> (longueur, épaisseur, diamètre…), des <b>relations</b> entre eux (« l’entraxe vaut la longueur divisée par le nombre de trous ») et une suite d’étapes, l’<b>arbre de construction</b> : esquisse, extrusion, perçage, congé.</p>
<p><b>Ce qu’on règle.</b> Des nombres. Chaque modification rejoue toutes les étapes et reconstruit la pièce. Des <b>contraintes</b> empêchent les valeurs impossibles.</p>
<p><b>Points forts.</b> Une pièce se décline en toute une famille (tailles, variantes) sans rien redessiner. Les cotes sont exactes. C’est la méthode de l’industrie mécanique et du bâtiment : une maquette BIM est elle aussi paramétrique.</p>
<p><b>Limites.</b> Il faut réfléchir à la construction avant de dessiner. Un arbre mal pensé casse dès qu’on change une cote.</p>
<p><b>Pour l’impression 3D.</b> Le paramètre vedette est le <b>jeu</b> : deux pièces qui doivent s’emboîter ont besoin de 0,2 à 0,4 mm d’écart, sinon elles ne rentrent pas. Avec un modèle paramétrique, on corrige le jeu et on réimprime.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> Fusion 360, SolidWorks, Onshape, FreeCAD, et Revit pour le bâtiment.</p>`;

  A.defis = [
    { titre: 'Équerre à quatre trous', texte: 'Sur l’équerre : deux trous de 6 mm par aile.', ok: (a, e) => e.modele === 'equerre' && e.equerre.n === 2 && e.equerre.d === 6 && e.equerre.etapes[2] && e.equerre.etapes[3] && a.etanche },
    { titre: 'Une roue de 40 mm', texte: 'Sur la roue dentée : obtiens un diamètre primitif de 40 mm avec 20 dents. Quel module faut-il ?', ok: (a, e) => e.modele === 'engrenage' && e.engrenage.Z === 20 && e.engrenage.m === 2 && a.etanche },
    { titre: 'Un couvercle qui rentre', texte: 'Sur la boîte : active le couvercle et donne-lui un jeu de 0,2 à 0,4 mm.', ok: (a, e) => e.modele === 'boite' && e.boite.etapes[2] && e.boite.etapes[1] && e.boite.jeu >= 0.19 && e.boite.jeu <= 0.41 && a.etanche }
  ];

  (ME.ateliers = ME.ateliers || []).push(A);
})(globalThis.ME = globalThis.ME || {});
