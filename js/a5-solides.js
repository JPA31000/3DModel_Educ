/* Atelier 5 — Modélisation par géométrie : solides de base et opérations booléennes (CSG).
   La pièce est une recette : une liste de solides simples, chacun ajouté, enlevé ou croisé
   avec ce qui précède. L'ordre de la liste compte. Les calculs sont dans js/csg.js. */
(function (ME) {
  'use strict';
  const M = ME.M, C = ME.CSG;
  const A = { id: 'solides', nom: 'Solides et booléens', court: 'Solides', accroche: 'Des solides simples qu’on unit, qu’on soustrait, qu’on croise.' };

  const TYPES = {
    pave: { nom: 'Pavé', dims: [['Longueur (X)', 2, 120], ['Largeur (Y)', 2, 120], ['Hauteur (Z)', 2, 120]], d: [30, 30, 20] },
    cylindre: { nom: 'Cylindre', dims: [['Diamètre', 2, 120], ['Hauteur', 2, 120]], d: [20, 30] },
    sphere: { nom: 'Sphère', dims: [['Diamètre', 4, 120]], d: [30] },
    cone: { nom: 'Cône', dims: [['Diamètre du bas', 0, 120], ['Diamètre du haut', 0, 120], ['Hauteur', 2, 120]], d: [30, 0, 30] },
    prisme: { nom: 'Prisme', dims: [['Diamètre', 4, 120], ['Hauteur', 2, 120], ['Nombre de côtés', 3, 8]], d: [30, 20, 6] }
  };
  const OPS = { '+': 'Ajouter', '-': 'Enlever', 'x': 'Croiser' };

  A.defaut = () => ({
    objets: [
      { type: 'pave', op: '+', d: [60, 40, 20], pos: [0, 0, 10], rot: [0, 0, 0] },
      { type: 'cylindre', op: '-', d: [16, 30], pos: [14, 0, 10], rot: [0, 0, 0] }
    ], sel: 1
  });

  function polys(o, rapide) {
    const d = o.d, n = rapide ? 16 : 32; let p;
    if (o.type === 'pave') p = C.pave(d[0], d[1], d[2]);
    else if (o.type === 'cylindre') p = C.cylindre(d[0] / 2, d[1], n);
    else if (o.type === 'sphere') p = C.sphere(d[0] / 2, rapide ? 12 : 24, rapide ? 6 : 12);
    else if (o.type === 'cone') p = C.cone(Math.max(d[0], d[1] > 0 ? 0 : 1) / 2, d[1] / 2, d[2], n);
    else p = C.cone(d[0] / 2, d[0] / 2, d[1], Math.round(d[2]));
    return C.placer(p, o.pos, o.rot);
  }
  A.construire = function (rapide) {
    const e = this.etat; let acc = null;
    try {
      for (const o of e.objets) {
        const p = polys(o, rapide);
        if (o.op === '+') acc = acc ? C.unir(acc, p) : p;
        else if (acc) acc = o.op === '-' ? C.enlever(acc, p) : C.croiser(acc, p);
      }
    } catch (err) { acc = null; this.erreur = true; }
    const m = C.maillage(acc || []);
    m.lissage = 35; this.fins = rapide ? [] : M.aretesVives(m, 35);
    return m;
  };

  A.decor = function () {
    const e = this.etat, d = { fantomes: [], fins: [{ seg: this.fins || [], c: [0.1, 0.13, 0.16, 0.8] }], poignees: [] };
    e.objets.forEach((o, i) => {
      if (i === e.sel) d.fantomes.push({ seg: C.contours(polys(o, true)), c: [0.85, 0.3, 0.05, 0.8] });
      else if (o.op !== '+') d.fantomes.push({ seg: C.contours(polys(o, true)), c: [0.04, 0.42, 0.49, 0.3] });
      d.poignees.push({ id: i, p: o.pos.slice(), c: i === e.sel ? [0.85, 0.3, 0.05, 1] : o.op === '+' ? [0.2, 0.25, 0.3, 1] : [0.04, 0.42, 0.49, 1], t: i === e.sel ? 16 : 13 });
    });
    return d;
  };
  A.poigneeDebut = function (id) { this.etat.sel = id; };
  A.poigneeGlisse = function (id, rayon, p0) {
    const p = M.rayonPlan(rayon, p0, [0, 0, 1]); if (!p) return;
    const o = this.etat.objets[id];
    o.pos[0] = Math.max(-110, Math.min(110, Math.round(p[0]))); o.pos[1] = Math.max(-110, Math.min(110, Math.round(p[1])));
    ME.app.maj(true);
  };
  A.poigneeFin = function () { ME.app.valider(); ME.app.panneau(); };

  A.panneau = function (el, ui) {
    const e = this.etat;
    ui.note(el, 'La pièce est une <b>recette</b>, lue de haut en bas. Tire le point d’un solide pour le déplacer sur le plateau. Un solide à <b>enlever</b> doit dépasser un peu de la matière.');
    ui.titre(el, 'La recette');
    e.objets.forEach((o, i) => ui.boutons(el, [[(i + 1) + ' · ' + OPS[o.op] + ' un ' + TYPES[o.type].nom.toLowerCase(), () => { e.sel = i; ME.app.maj(); ME.app.panneau(); }, { actif: i === e.sel, large: true }]]));
    const ajouter = type => () => {
      const t = TYPES[type], h = type === 'sphere' ? t.d[0] : type === 'pave' || type === 'cone' ? t.d[2] : t.d[1];
      e.objets.push({ type, op: '+', d: t.d.slice(), pos: [0, -35, h / 2], rot: [0, 0, 0] }); e.sel = e.objets.length - 1; ME.app.valider(); ME.app.panneau();
    };
    ui.boutons(el, Object.keys(TYPES).map(t => ['+ ' + TYPES[t].nom, ajouter(t), { inactif: e.objets.length >= 8 }]));
    const o = e.objets[e.sel]; if (!o) return;
    ui.titre(el, 'Solide ' + (e.sel + 1) + ' : ' + TYPES[o.type].nom);
    ui.choix(el, { nom: 'Opération', obj: o, cle: 'op', options: Object.entries(OPS), refaire: true, aide: 'Ajouter : la matière des deux. Enlever : on creuse. Croiser : on ne garde que la partie commune.' });
    TYPES[o.type].dims.forEach(([nom, mn, mx], k) => ui.curseur(el, { nom, obj: o.d, cle: k, min: mn, max: mx, pas: 1, unite: nom.startsWith('Nombre') ? '' : 'mm' }));
    ui.titre(el, 'Position du centre');
    ['X', 'Y', 'Z'].forEach((n, k) => ui.curseur(el, { nom: n, obj: o.pos, cle: k, min: k === 2 ? -20 : -110, max: k === 2 ? 150 : 110, pas: 1, unite: 'mm' }));
    ui.titre(el, 'Rotation');
    ['Autour de X', 'Autour de Y', 'Autour de Z'].forEach((n, k) => ui.curseur(el, { nom: n, obj: o.rot, cle: k, min: -180, max: 180, pas: 15, unite: '°' }));
    const bouger = s => () => { const j = e.sel + s; e.objets.splice(j, 0, e.objets.splice(e.sel, 1)[0]); e.sel = j; ME.app.valider(); ME.app.panneau(); };
    ui.boutons(el, [
      ['Monter', bouger(-1), { inactif: e.sel === 0 }], ['Descendre', bouger(1), { inactif: e.sel === e.objets.length - 1 }],
      ['Supprimer', () => { e.objets.splice(e.sel, 1); e.sel = Math.max(0, e.sel - 1); ME.app.valider(); ME.app.panneau(); }, { danger: true, inactif: e.objets.length <= 1 }]
    ]);
  };

  A.comprendre = `
<p><b>Le principe.</b> On part de <b>solides simples</b> (pavé, cylindre, sphère, cône) et on les combine par trois opérations : <b>ajouter</b> (union), <b>enlever</b> (différence), <b>croiser</b> (intersection). On parle de géométrie constructive de solides, CSG en anglais.</p>
<p><b>Ce qu’on règle.</b> La liste des solides, leurs dimensions, leur position et l’<b>ordre</b> des opérations. La pièce est une recette qu’on peut relire et corriger.</p>
<p><b>Points forts.</b> Très simple à comprendre, cotes exactes, et le résultat est toujours un vrai volume fermé. Parfait pour les pièces mécaniques : supports, boîtiers, perçages.</p>
<p><b>Limites.</b> Les formes souples (carrosserie, visage) sont presque impossibles à obtenir.</p>
<p><b>Pour l’impression 3D.</b> Un solide qu’on enlève doit <b>dépasser</b> de la matière : s’il s’arrête exactement à la surface, il peut rester une peau d’épaisseur nulle. Un perçage horizontal a un plafond en surplomb : mieux vaut le placer vertical.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> Tinkercad, OpenSCAD, BlocksCAD, les « opérations booléennes » de tous les logiciels de CAO.</p>`;

  A.defis = [
    { titre: 'Deux perçages', texte: 'Obtiens une pièce étanche qui utilise au moins deux fois l’opération Enlever.', ok: (a, e) => e.objets.filter(o => o.op === '-').length >= 2 && a.etanche && a.volume > 100 },
    { titre: 'Les trois opérations', texte: 'Utilise Ajouter, Enlever et Croiser dans la même recette, pièce étanche.', ok: (a, e) => ['+', '-', 'x'].every(op => e.objets.some(o => o.op === op)) && a.etanche && a.volume > 100 },
    { titre: 'Quatre solides, un seul morceau', texte: 'Au moins quatre solides dans la recette, et une pièce d’un seul tenant.', ok: (a, e) => e.objets.length >= 4 && a.pieces === 1 && a.etanche }
  ];

  (ME.ateliers = ME.ateliers || []).push(A);
})(globalThis.ME = globalThis.ME || {});
