/* Atelier 3 — Modélisation par surfaces implicites.
   La pièce n'est pas décrite par sa peau mais par une fonction f(x, y, z) : négative dans la
   matière, positive dehors. La surface est l'endroit où f = 0. Ici f est une « distance signée » :
   - boules : distance à chaque sphère, fondues par un minimum adouci (smooth minimum) ;
   - gyroïde : surface minimale triplement périodique, sin x·cos y + sin y·cos z + sin z·cos x = 0.
   Pour l'afficher et l'imprimer, on échantillonne f sur une grille et on en tire des triangles
   (ici par « tétraèdres en marche » : chaque cube de la grille est découpé en 6 tétraèdres). */
(function (ME) {
  'use strict';
  const M = ME.M;
  const A = { id: 'implicite', nom: 'Surfaces implicites', court: 'Implicites', accroche: 'Une formule dit où est la matière : boules qui fusionnent, gyroïde.' };

  A.defaut = () => ({
    mode: 'boules',
    boules: [{ x: 0, y: 0, z: 18, r: 18, s: 1 }, { x: 24, y: 0, z: 30, r: 13, s: 1 }, { x: -34, y: 14, z: 12, r: 11, s: 1 }],
    fondu: 8, res: 44, sel: 0,
    gy: { forme: 'cube', L: 40, T: 20, ep: 2.4 }
  });

  const smin = (a, b, k) => { if (k <= 0.01) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

  function champ(e) {
    if (e.mode === 'gyroide') {
      const { L, T, ep, forme } = e.gy, w = 2 * Math.PI / T, h = L / 2;
      return (x, y, z) => {
        const g = Math.sin(x * w) * Math.cos(y * w) + Math.sin(y * w) * Math.cos(z * w) + Math.sin(z * w) * Math.cos(x * w);
        const d = Math.abs(g) / (w * 1.2) - ep / 2;
        const env = forme === 'sphere' ? Math.hypot(x, y, z - h) - h : Math.max(forme === 'cylindre' ? Math.hypot(x, y) - h : Math.max(Math.abs(x), Math.abs(y)) - h, Math.abs(z - h) - h);
        return Math.max(d, env, -z);
      };
    }
    const plus = e.boules.filter(b => b.s > 0), moins = e.boules.filter(b => b.s < 0), k = e.fondu;
    return (x, y, z) => {
      let d = Infinity;
      for (const b of plus) d = smin(d, Math.hypot(x - b.x, y - b.y, z - b.z) - b.r, k);
      for (const b of moins) d = -smin(-d, Math.hypot(x - b.x, y - b.y, z - b.z) - b.r, k);
      return Math.max(d, -z);
    };
  }
  function domaine(e) {
    if (e.mode === 'gyroide') { const h = e.gy.L / 2; return [[-h, -h, 0], [h, h, e.gy.L]]; }
    const mn = [Infinity, Infinity, 0], mx = [-Infinity, -Infinity, 1];
    for (const b of e.boules) if (b.s > 0) {
      const m = b.r + e.fondu * 0.3;
      mn[0] = Math.min(mn[0], b.x - m); mn[1] = Math.min(mn[1], b.y - m);
      mx[0] = Math.max(mx[0], b.x + m); mx[1] = Math.max(mx[1], b.y + m); mx[2] = Math.max(mx[2], b.z + m);
    }
    if (!isFinite(mn[0])) return [[-10, -10, 0], [10, 10, 10]];
    return [mn, mx];
  }

  /* Surface f = 0 par tétraèdres en marche. */
  A.iso = function (f, mn, mx, res) {
    const c = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / res;
    const ox = mn[0] - c * 1.5, oy = mn[1] - c * 1.5, oz = -c * 0.5; // le plateau (z = 0) passe au milieu d'une maille
    const nx = Math.ceil((mx[0] - ox) / c) + 2, ny = Math.ceil((mx[1] - oy) / c) + 2, nz = Math.ceil((mx[2] - oz) / c) + 2;
    const sx = nx + 1, sy = ny + 1, sz = nz + 1, sxy = sx * sy, val = new Float32Array(sxy * sz);
    let n = 0;
    for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
      let x = f(ox + i * c, oy + j * c, oz + k * c);
      if (i === 0 || j === 0 || k === 0 || i === nx || j === ny || k === nz) x = Math.max(x, c * 0.25); // la grille est fermée
      val[n++] = x === 0 ? 1e-9 : x;
    }
    const emplacement = new Int32Array(sxy * sz * 7).fill(-1), v = [], tri = [];
    const dec = b => (b & 1) + ((b >> 1) & 1) * sx + ((b >> 2) & 1) * sxy;
    const DEC = [0, 1, 2, 3, 4, 5, 6, 7].map(dec);
    const TETS = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]];
    let base = 0;
    /* sommet posé sur l'arête de grille entre les coins a et b du cube courant */
    function sommet(a, b) {
      if (a > b) { const t = a; a = b; b = t; }
      const ia = base + DEC[a], cle = ia * 7 + (a ^ b) - 1;
      let s = emplacement[cle];
      if (s < 0) {
        const va = val[ia], vb = val[base + DEC[b]], t = va / (va - vb);
        const i = ia % sx, j = Math.floor(ia / sx) % sy, k = Math.floor(ia / sxy), d = a ^ b;
        s = v.length / 3; emplacement[cle] = s;
        v.push(ox + (i + (d & 1) * t) * c, oy + (j + ((d >> 1) & 1) * t) * c, oz + (k + ((d >> 2) & 1) * t) * c);
      }
      return s;
    }
    /* triangle orienté : sa normale doit pointer du dedans (D) vers le dehors (H) */
    function poser(a, b, d, dx, dy, dz) {
      if (a === b || b === d || a === d) return;
      const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2];
      const ux = v[b * 3] - ax, uy = v[b * 3 + 1] - ay, uz = v[b * 3 + 2] - az, wx = v[d * 3] - ax, wy = v[d * 3 + 1] - ay, wz = v[d * 3 + 2] - az;
      if ((uy * wz - uz * wy) * dx + (uz * wx - ux * wz) * dy + (ux * wy - uy * wx) * dz >= 0) tri.push(a, b, d); else tri.push(a, d, b);
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      base = i + j * sx + k * sxy;
      let masque = 0;
      for (let q = 0; q < 8; q++) if (val[base + DEC[q]] < 0) masque |= 1 << q;
      if (masque === 0 || masque === 255) continue;
      for (const T of TETS) {
        const din = [], dout = [];
        for (const q of T) ((masque >> q) & 1 ? din : dout).push(q);
        if (!din.length || !dout.length) continue;
        let dx = 0, dy = 0, dz = 0;
        for (const q of dout) { dx += (q & 1) / dout.length; dy += ((q >> 1) & 1) / dout.length; dz += ((q >> 2) & 1) / dout.length; }
        for (const q of din) { dx -= (q & 1) / din.length; dy -= ((q >> 1) & 1) / din.length; dz -= ((q >> 2) & 1) / din.length; }
        if (din.length === 1) poser(sommet(din[0], dout[0]), sommet(din[0], dout[1]), sommet(din[0], dout[2]), dx, dy, dz);
        else if (dout.length === 1) poser(sommet(dout[0], din[0]), sommet(dout[0], din[1]), sommet(dout[0], din[2]), dx, dy, dz);
        else {
          const p = sommet(din[0], dout[0]), q = sommet(din[0], dout[1]), r = sommet(din[1], dout[1]), s = sommet(din[1], dout[0]);
          poser(p, q, r, dx, dy, dz); poser(p, r, s, dx, dy, dz);
        }
      }
    }
    return { v, f: tri };
  };

  A.construire = function (rapide) {
    const e = this.etat, [mn, mx] = domaine(e);
    const m = A.iso(champ(e), mn, mx, rapide ? Math.min(e.res, 22) : e.res);
    m.lissage = 75;
    return m;
  };

  function cercles(b) {
    const s = [], N = 32;
    for (let i = 0; i < N; i++) {
      const a = 2 * Math.PI * i / N, a2 = 2 * Math.PI * (i + 1) / N, c = Math.cos(a) * b.r, d = Math.sin(a) * b.r, c2 = Math.cos(a2) * b.r, d2 = Math.sin(a2) * b.r;
      s.push(b.x + c, b.y + d, b.z, b.x + c2, b.y + d2, b.z, b.x + c, b.y, b.z + d, b.x + c2, b.y, b.z + d2, b.x, b.y + c, b.z + d, b.x, b.y + c2, b.z + d2);
    }
    return s;
  }
  A.decor = function () {
    const e = this.etat, d = { fantomes: [], poignees: [] };
    if (e.mode !== 'boules') return d;
    e.boules.forEach((b, i) => {
      if (i === e.sel) d.fantomes.push({ seg: cercles(b), c: [0.85, 0.3, 0.05, 0.9] });
      else if (b.s < 0) d.fantomes.push({ seg: cercles(b), c: [0.04, 0.42, 0.49, 0.6] });
      d.poignees.push({ id: i, p: [b.x, b.y, b.z], c: i === e.sel ? [0.85, 0.3, 0.05, 1] : b.s < 0 ? [0.04, 0.42, 0.49, 1] : [0.2, 0.25, 0.3, 1], t: i === e.sel ? 16 : 13 });
    });
    return d;
  };
  A.poigneeDebut = function (id) { this.etat.sel = id; };
  A.poigneeGlisse = function (id, rayon, p0) {
    const p = M.rayonPlan(rayon, p0, rayon.avant); if (!p) return;
    const b = this.etat.boules[id];
    b.x = Math.max(-100, Math.min(100, Math.round(p[0]))); b.y = Math.max(-100, Math.min(100, Math.round(p[1]))); b.z = Math.max(0, Math.min(200, Math.round(p[2])));
    ME.app.maj(true);
  };
  A.poigneeFin = function () { ME.app.valider(); ME.app.panneau(); };

  A.panneau = function (el, ui) {
    const e = this.etat;
    ui.choix(el, { nom: 'Formule', obj: e, cle: 'mode', options: [['boules', 'Boules qui fusionnent'], ['gyroide', 'Gyroïde']], refaire: true });
    if (e.mode === 'boules') {
      ui.note(el, 'Tire le centre des boules dans la vue. Quand deux boules s’approchent, elles <b>fusionnent</b>. Un <b>creux</b> est une boule qui enlève de la matière.');
      ui.boutons(el, e.boules.map((b, i) => [(b.s > 0 ? 'Boule ' : 'Creux ') + (i + 1), () => { e.sel = i; ME.app.maj(); ME.app.panneau(); }, { actif: i === e.sel }]));
      const ajouter = s => () => { e.boules.push({ x: 0, y: -30, z: 14, r: 14, s }); e.sel = e.boules.length - 1; ME.app.valider(); ME.app.panneau(); };
      ui.boutons(el, [
        ['+ Boule', ajouter(1), { inactif: e.boules.length >= 10 }], ['+ Creux', ajouter(-1), { inactif: e.boules.length >= 10 }],
        ['Supprimer', () => { e.boules.splice(e.sel, 1); e.sel = 0; ME.app.valider(); ME.app.panneau(); }, { inactif: e.boules.length <= 1 }]
      ]);
      const b = e.boules[e.sel];
      if (b) {
        ui.titre(el, (b.s > 0 ? 'Boule ' : 'Creux ') + (e.sel + 1));
        ui.curseur(el, { nom: 'Rayon', obj: b, cle: 'r', min: 4, max: 45, pas: 1, unite: 'mm' });
        ui.curseur(el, { nom: 'X', obj: b, cle: 'x', min: -100, max: 100, pas: 1, unite: 'mm' });
        ui.curseur(el, { nom: 'Y', obj: b, cle: 'y', min: -100, max: 100, pas: 1, unite: 'mm' });
        ui.curseur(el, { nom: 'Z (hauteur du centre)', obj: b, cle: 'z', min: 0, max: 200, pas: 1, unite: 'mm' });
      }
      ui.titre(el, 'La formule');
      ui.curseur(el, { nom: 'Fondu entre les boules', obj: e, cle: 'fondu', min: 0, max: 24, pas: 1, unite: 'mm', aide: '0 : les boules se coupent net. Plus le fondu est grand, plus le raccord est doux.' });
    } else {
      ui.note(el, 'Le <b>gyroïde</b> est une surface qui se répète dans les trois directions sans jamais se recouper. Les trancheurs s’en servent comme motif de <b>remplissage</b>.');
      ui.choix(el, { nom: 'Enveloppe', obj: e.gy, cle: 'forme', options: [['cube', 'Cube'], ['cylindre', 'Cylindre'], ['sphere', 'Sphère']] });
      ui.curseur(el, { nom: 'Taille', obj: e.gy, cle: 'L', min: 20, max: 80, pas: 2, unite: 'mm' });
      ui.curseur(el, { nom: 'Période du motif', obj: e.gy, cle: 'T', min: 10, max: 40, pas: 1, unite: 'mm' });
      ui.curseur(el, { nom: 'Épaisseur de la paroi', obj: e.gy, cle: 'ep', min: 0.8, max: 6, pas: 0.2, unite: 'mm', aide: 'Valeur approchée. En dessous de 1,2 mm, la paroi risque de ne pas s’imprimer.' });
    }
    ui.curseur(el, { nom: 'Finesse de la grille', obj: e, cle: 'res', min: 20, max: 64, pas: 4, aide: 'Nombre de mailles sur le plus grand côté. La formule est exacte ; c’est la grille qui fabrique les triangles.' });
  };

  A.comprendre = `
<p><b>Le principe.</b> Aucune face, aucun sommet : la pièce est une <b>formule</b>. Pour chaque point de l’espace, elle répond « dedans » (valeur négative) ou « dehors » (valeur positive). La surface est la frontière, là où la valeur vaut zéro.</p>
<p><b>Ce qu’on règle.</b> Les termes de la formule : le centre et le rayon de chaque boule, le <b>fondu</b> qui les soude en douceur, la période d’un motif répété.</p>
<p><b>Points forts.</b> Les formes fusionnent toutes seules, sans raccord à gérer. Les motifs répétés (treillis, gyroïde) tiennent en une ligne de calcul : c’est la méthode des pièces allégées et des structures internes.</p>
<p><b>Limites.</b> On ne « voit » la forme qu’après calcul. Les arêtes vives et les cotes précises sont difficiles à obtenir.</p>
<p><b>Pour l’impression 3D.</b> La formule doit être convertie en triangles par une <b>grille</b> : trop grossière, les détails fins disparaissent ; très fine, le fichier devient lourd. Le plateau coupe ici la formule à plat, pour que la pièce ait une base.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> les métaballes de Blender, nTop, les remplissages « gyroïde » de Cura, PrusaSlicer et Bambu Studio.</p>`;

  A.defis = [
    { titre: 'Une seule pièce', texte: 'Fais fusionner au moins trois boules en un seul morceau étanche.', ok: (a, e) => e.mode === 'boules' && e.boules.filter(b => b.s > 0).length >= 3 && a.pieces === 1 && a.etanche },
    { titre: 'Creuser', texte: 'Ajoute un creux qui enlève de la matière, en gardant un seul morceau.', ok: (a, e) => e.mode === 'boules' && e.boules.some(b => b.s < 0) && a.pieces === 1 && a.etanche && a.volume > 500 },
    { titre: 'Un gyroïde serré', texte: 'Passe au gyroïde : une période de 15 mm ou moins, une paroi d’au moins 1,2 mm, et une pièce étanche.', ok: (a, e) => e.mode === 'gyroide' && e.gy.ep >= 1.2 && e.gy.T <= 15 && a.etanche }
  ];

  (ME.ateliers = ME.ateliers || []).push(A);
})(globalThis.ME = globalThis.ME || {});
