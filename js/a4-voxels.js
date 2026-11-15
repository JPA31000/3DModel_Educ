/* Atelier 4 — Modélisation volumique (voxels).
   L'espace est découpé en petits cubes tous identiques, les voxels (« pixels en volume »).
   Chaque case est pleine ou vide : la pièce est la liste des cases pleines.
   Le maillage exporté ne garde que les faces des cubes qui donnent sur du vide. */
(function (ME) {
  'use strict';
  const M = ME.M;
  const A = { id: 'voxels', nom: 'Modélisation volumique', court: 'Voxels', accroche: 'L’espace découpé en petits cubes, pleins ou vides.' };
  const cle = (i, j, k) => i + ',' + j + ',' + k;

  A.defaut = () => {
    const vox = {};
    for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) for (let k = 0; k < 2; k++) vox[cle(i, j, k)] = 1;
    return { t: 5, vox, outil: 'ajouter', gen: { D: 40 } };
  };

  const FACES = [ // direction, puis les 4 coins de la face (sens trigonométrique vu de l'extérieur)
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]
  ];
  A.construire = function () {
    const e = this.etat, t = e.t, v = [], f = [], idx = new Map(), fins = [];
    const som = (i, j, k) => { const c = cle(i, j, k); let s = idx.get(c); if (s === undefined) { s = v.length / 3; idx.set(c, s); v.push(i * t, j * t, k * t); } return s; };
    const dessinerAretes = Object.keys(e.vox).length < 6000;
    for (const c in e.vox) {
      const [i, j, k] = c.split(',').map(Number);
      for (const [d, coins] of FACES) {
        if (e.vox[cle(i + d[0], j + d[1], k + d[2])]) continue;
        const s = coins.map(q => som(i + q[0], j + q[1], k + q[2]));
        f.push(s[0], s[1], s[2], s[0], s[2], s[3]);
        if (dessinerAretes) for (let a = 0; a < 4; a++) { const p = coins[a], q = coins[(a + 1) % 4]; fins.push((i + p[0]) * t, (j + p[1]) * t, (k + p[2]) * t, (i + q[0]) * t, (j + q[1]) * t, (k + q[2]) * t); }
      }
    }
    this.maille = { v, f }; this.fins = fins;
    return { v, f, lissage: 0 };
  };

  function cube(i, j, k, t) {
    const s = [], p = (a, b, c) => [(i + a) * t, (j + b) * t, (k + c) * t];
    for (const [a, b] of [[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 0]], [[0, 0, 1], [1, 0, 1]], [[1, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 1]], [[0, 1, 1], [0, 0, 1]], [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]], [[1, 1, 0], [1, 1, 1]], [[0, 1, 0], [0, 1, 1]]]) s.push(...p(...a), ...p(...b));
    return s;
  }
  A.decor = function () {
    const d = { fantomes: [], fins: [{ seg: this.fins || [], c: [0.1, 0.13, 0.16, 0.55] }], poignees: [] };
    if (this.fantome) d.fantomes.push({ seg: cube(...this.fantome.c, this.etat.t), c: this.fantome.retire ? [0.8, 0.1, 0.1, 1] : [0.85, 0.3, 0.05, 1] });
    return d;
  };

  /* Case visée par un rayon : celle qu'on ajouterait (contre la face touchée) ou celle qu'on retirerait. */
  function viser(self, rayon, retire) {
    const e = self.etat, t = e.t, h = self.maille && M.rayon(self.maille, rayon.o, rayon.d);
    let c = null;
    if (h) { const p = ME.V.add(h.p, ME.V.mul(h.n, (retire ? -0.5 : 0.5) * t)); c = [Math.floor(p[0] / t), Math.floor(p[1] / t), Math.floor(p[2] / t)]; }
    else if (!retire) { const p = M.rayonPlan(rayon, [0, 0, 0], [0, 0, 1]); if (p && rayon.d[2] < 0) c = [Math.floor(p[0] / t), Math.floor(p[1] / t), 0]; }
    if (!c || c[2] < 0 || c[2] * t >= 240 || Math.abs(c[0] * t) > 105 || Math.abs(c[1] * t) > 105) return null;
    return { c, retire };
  }
  A.survol = function (rayon, ev) {
    const avant = this.fantome && this.fantome.c.join() + this.fantome.retire;
    this.fantome = viser(this, rayon, (this.etat.outil === 'retirer') !== !!(ev && ev.shiftKey));
    if ((this.fantome && this.fantome.c.join() + this.fantome.retire) !== avant) ME.app.majDecor();
  };
  A.clic = function (rayon, ev) {
    const e = this.etat, x = viser(this, rayon, (e.outil === 'retirer') !== !!(ev && ev.shiftKey)); if (!x) return;
    if (x.retire) delete e.vox[cle(...x.c)]; else e.vox[cle(...x.c)] = 1;
    this.fantome = null; ME.app.valider(); ME.app.panneau();
  };

  /* Voxeliser une forme : on garde les cases dont le centre est dans la forme. */
  function generer(e, forme) {
    const t = e.t, D = e.gen.D, n = Math.ceil(D / t / 2) + 1, r = D / 2, vox = {};
    for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) for (let k = 0; k < 2 * n; k++) {
      const x = (i + 0.5) * t, y = (j + 0.5) * t, z = (k + 0.5) * t;
      const dedans = forme === 'sphere' ? Math.hypot(x, y, z - r) <= r
        : forme === 'cylindre' ? Math.hypot(x, y) <= r && z <= D
        : Math.max(Math.abs(x), Math.abs(y)) <= r * (1 - z / D) && z <= D;
      if (dedans) vox[cle(i, j, k)] = 1;
    }
    e.vox = vox; e.gen.forme = forme;
  }

  A.panneau = function (el, ui) {
    const e = this.etat, nb = Object.keys(e.vox).length;
    ui.note(el, 'Clique sur une face pour <b>poser un cube</b> contre elle, ou sur le plateau pour commencer. Avec l’outil Retirer (ou la touche Maj), le clic enlève le cube.');
    ui.choix(el, { nom: 'Outil', obj: e, cle: 'outil', options: [['ajouter', 'Ajouter'], ['retirer', 'Retirer']] });
    ui.info(el, nb + ' voxel' + (nb > 1 ? 's' : '') + ' de ' + ui.nb(e.t, 1) + ' mm');
    ui.titre(el, 'Résolution');
    ui.curseur(el, { nom: 'Taille d’un voxel', obj: e, cle: 't', min: 1, max: 10, pas: 0.5, unite: 'mm', refaire: true, aide: 'Changer la taille agrandit ou réduit toute la pièce : le nombre de cubes ne change pas.' });
    ui.titre(el, 'Voxeliser une forme');
    ui.curseur(el, { nom: 'Diamètre', obj: e.gen, cle: 'D', min: 10, max: 80, pas: 5, unite: 'mm', sansMaj: true });
    const gen = f => () => { generer(e, f); ME.app.valider(); ME.app.panneau(); ME.app.cadrer(); };
    ui.boutons(el, [['Sphère', gen('sphere')], ['Cylindre', gen('cylindre')], ['Pyramide', gen('pyramide')]]);
    ui.aide(el, 'La forme est reconstruite avec des cubes de la taille choisie. Essaie 5 mm, puis 2 mm : c’est la <b>résolution</b>.');
    ui.boutons(el, [['Tout effacer', () => { e.vox = {}; ME.app.valider(); ME.app.panneau(); }, { danger: true }]]);
  };

  A.comprendre = `
<p><b>Le principe.</b> L’espace est rangé comme un casier : des petits cubes tous identiques, les <b>voxels</b>. Chaque case est pleine ou vide. La pièce est simplement la liste des cases pleines : c’est une image en trois dimensions.</p>
<p><b>Ce qu’on règle.</b> Quelles cases sont pleines, et la <b>taille du voxel</b>, c’est-à-dire la résolution. Diviser la taille par 2 multiplie le nombre de cases par 8.</p>
<p><b>Points forts.</b> On sait toujours où est la matière, y compris à l’intérieur. Ajouter, enlever, creuser sont des opérations immédiates. C’est le format des scanners médicaux et de la simulation.</p>
<p><b>Limites.</b> Les surfaces courbes deviennent des <b>escaliers</b>. Pour une pièce fine, il faut énormément de voxels, donc beaucoup de mémoire.</p>
<p><b>Pour l’impression 3D.</b> Le trancheur fait presque la même chose : il découpe la pièce en couches, puis en lignes. Attention à deux cubes qui ne se touchent que par une <b>arête</b> ou un coin : ils ne sont pas vraiment soudés, et le contrôle le signale.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> MagicaVoxel, Goxel, les images de scanner (tomographie), Minecraft pour l’idée.</p>`;

  A.defis = [
    { titre: 'Trente cubes', texte: 'Construis une pièce d’au moins 30 voxels, étanche.', ok: (a, e) => Object.keys(e.vox).length >= 30 && a.etanche && Object.keys(e.vox).some(c => +c.split(',')[2] >= 2) },
    { titre: 'Une tour bien soudée', texte: 'Au moins 40 voxels sur 6 étages ou plus, sans aucune arête partagée par plus de deux faces.', ok: (a, e) => Object.keys(e.vox).length >= 40 && a.nonVariete === 0 && a.etanche && a.dims[2] >= 6 * e.t - 0.01 },
    { titre: 'Affiner la résolution', texte: 'Voxelise une sphère avec des voxels de 2 mm ou moins. Compare avec 5 mm.', ok: (a, e) => e.gen.forme === 'sphere' && e.t <= 2 && Object.keys(e.vox).length >= 1500 }
  ];

  (ME.ateliers = ME.ateliers || []).push(A);
})(globalThis.ME = globalThis.ME || {});
