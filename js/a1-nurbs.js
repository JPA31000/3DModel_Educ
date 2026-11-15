/* Atelier 1 — Modélisation par courbes NURBS.
   Une courbe NURBS (B-spline rationnelle non uniforme) est décrite par des points de contrôle,
   un poids par point, un degré et un vecteur de nœuds. Ici le vecteur de nœuds est « ouvert et
   uniforme » : la courbe part du premier point et arrive au dernier.
   La pièce est obtenue par révolution du profil autour de l'axe Z (un tour de potier). */
(function (ME) {
  'use strict';
  const M = ME.M;
  const A = { id: 'nurbs', nom: 'Courbes NURBS', court: 'Courbes', accroche: 'Un profil dessiné par quelques points, puis tourné autour d’un axe.' };

  A.defaut = () => ({
    pts: [{ r: 24, z: 0, w: 1 }, { r: 52, z: 10, w: 1 }, { r: 48, z: 48, w: 1 }, { r: 10, z: 56, w: 1 }, { r: 16, z: 96, w: 1 }, { r: 30, z: 108, w: 1 }],
    degre: 3, paroi: 2.4, fond: 2.4, cotes: 0, sel: 2
  });

  function noeuds(n, p) {
    const k = [], m = n - p;
    for (let i = 0; i <= p; i++) k.push(0);
    for (let i = 1; i < m; i++) k.push(i / m);
    for (let i = 0; i <= p; i++) k.push(1);
    return k;
  }
  /* Fonction de base B-spline (formule de récurrence de Cox - de Boor). */
  function base(i, p, u, k) {
    if (p === 0) return (k[i] <= u && u < k[i + 1]) || (u === 1 && k[i + 1] === 1 && k[i] < 1) ? 1 : 0;
    const a = k[i + p] - k[i], b = k[i + p + 1] - k[i + 1];
    return (a > 0 ? (u - k[i]) / a * base(i, p - 1, u, k) : 0) + (b > 0 ? (k[i + p + 1] - u) / b * base(i + 1, p - 1, u, k) : 0);
  }
  /* Points de la courbe : moyenne des points de contrôle, pondérée par base × poids. */
  A.courbe = function (e, N) {
    const n = e.pts.length, p = Math.min(e.degre, n - 1), k = noeuds(n, p), c = [];
    for (let s = 0; s <= N; s++) {
      const u = s / N; let r = 0, z = 0, d = 0;
      for (let i = 0; i < n; i++) { const b = base(i, p, u, k) * e.pts[i].w; r += b * e.pts[i].r; z += b * e.pts[i].z; d += b; }
      c.push([Math.max(0.5, r / d), z / d]);
    }
    return c;
  };

  A.construire = function (rapide) {
    const e = this.etat, ext = A.courbe(e, rapide ? 32 : 64), n = ext.length;
    let contour;
    if (e.paroi <= 0) contour = [[0, ext[0][1]], ...ext, [0, ext[n - 1][1]]];
    else {
      /* paroi : le profil est décalé de l'épaisseur, perpendiculairement à la courbe, vers l'axe */
      const z0 = ext[0][1] + e.fond, int = [];
      for (let i = 0; i < n; i++) {
        const a = ext[Math.max(0, i - 1)], b = ext[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        int.push([Math.max(0, ext[i][0] - (b[1] - a[1]) / l * e.paroi), Math.max(z0, ext[i][1] + (b[0] - a[0]) / l * e.paroi)]);
      }
      contour = [[0, ext[0][1]], ...ext, ...int.reverse(), [0, z0]];
    }
    const prof = contour.filter((p, i) => i === 0 || Math.hypot(p[0] - contour[i - 1][0], p[1] - contour[i - 1][1]) > 1e-4);
    const T = e.cotes || (rapide ? 36 : 72), v = [], f = [], P = prof.length;
    for (let i = 0; i < P; i++) for (let j = 0; j < T; j++) { const a = 2 * Math.PI * j / T; v.push(prof[i][0] * Math.cos(a), prof[i][0] * Math.sin(a), prof[i][1]); }
    for (let i = 0; i < P; i++) {
      const i2 = (i + 1) % P;
      for (let j = 0; j < T; j++) { const j2 = (j + 1) % T; f.push(i * T + j, i * T + j2, i2 * T + j2, i * T + j, i2 * T + j2, i2 * T + j); }
    }
    const m = M.souder(v, f);
    if (M.analyser(m, { rapide: true }).volume < 0) for (let t = 0; t < m.f.length; t += 3) { const x = m.f[t + 1]; m.f[t + 1] = m.f[t + 2]; m.f[t + 2] = x; }
    m.lissage = e.cotes ? 20 : 50;
    return m;
  };

  A.decor = function () {
    const e = this.etat, poly = [], crb = [], c = A.courbe(e, 64);
    for (let i = 0; i < e.pts.length - 1; i++) poly.push(e.pts[i].r, 0, e.pts[i].z, e.pts[i + 1].r, 0, e.pts[i + 1].z);
    for (let i = 0; i < c.length - 1; i++) crb.push(c[i][0], 0, c[i][1], c[i + 1][0], 0, c[i + 1][1]);
    const haut = Math.max(...e.pts.map(p => p.z)) + 15;
    return {
      fantomes: [{ seg: poly, c: [0.2, 0.25, 0.3, 0.55] }, { seg: crb, c: [0.85, 0.3, 0.05, 1] }, { seg: [0, 0, 0, 0, 0, haut], c: [0.04, 0.42, 0.49, 0.8] }],
      poignees: e.pts.map((p, i) => ({ id: i, p: [p.r, 0, p.z], c: i === e.sel ? [0.85, 0.3, 0.05, 1] : [0.04, 0.42, 0.49, 1], t: i === e.sel ? 16 : 13 }))
    };
  };

  A.poigneeDebut = function (id) { this.etat.sel = id; };
  A.poigneeGlisse = function (id, rayon) {
    const p = M.rayonPlan(rayon, [0, 0, 0], [0, 1, 0]); if (!p) return;
    const pt = this.etat.pts[id];
    pt.r = Math.min(105, Math.max(1, Math.round(p[0] * 2) / 2));
    pt.z = id === 0 ? 0 : Math.min(240, Math.max(0, Math.round(p[2] * 2) / 2));
    ME.app.maj(true);
  };
  A.poigneeFin = function () { ME.app.valider(); ME.app.panneau(); };

  A.panneau = function (el, ui) {
    const e = this.etat, pt = e.pts[e.sel] || e.pts[0];
    ui.note(el, 'Tire les <b>points bleus</b> dans la vue. La courbe orange ne passe pas par les points : elle est <b>attirée</b> par eux. Le solide est ce profil tourné autour de l’axe.');
    ui.titre(el, 'Point sélectionné : n° ' + (e.sel + 1) + ' sur ' + e.pts.length);
    ui.curseur(el, { nom: 'Poids du point', obj: pt, cle: 'w', min: 0.1, max: 8, pas: 0.1, aide: 'Plus le poids est grand, plus la courbe est tirée vers ce point.' });
    ui.info(el, 'Rayon ' + ui.nb(pt.r, 1) + ' mm · hauteur ' + ui.nb(pt.z, 1) + ' mm');
    ui.boutons(el, [
      ['Ajouter un point', () => {
        const i = Math.min(e.sel, e.pts.length - 2), a = e.pts[i], b = e.pts[i + 1];
        e.pts.splice(i + 1, 0, { r: (a.r + b.r) / 2, z: (a.z + b.z) / 2, w: 1 }); e.sel = i + 1; ME.app.valider(); ME.app.panneau();
      }, { inactif: e.pts.length >= 12 }],
      ['Supprimer ce point', () => {
        e.pts.splice(e.sel, 1); e.pts[0].z = 0; e.sel = Math.min(e.sel, e.pts.length - 1); ME.app.valider(); ME.app.panneau();
      }, { inactif: e.pts.length <= 3 }]
    ]);
    ui.titre(el, 'La courbe');
    ui.choix(el, { nom: 'Degré', obj: e, cle: 'degre', options: [[1, '1 · segments droits'], [2, '2 · arcs'], [3, '3 · courbe souple']], aide: 'Degré 1 : la courbe suit le polygone. Degré 3 : chaque point agit sur une plus grande longueur.' });
    ui.titre(el, 'Le solide');
    ui.curseur(el, { nom: 'Épaisseur de paroi', obj: e, cle: 'paroi', min: 0, max: 6, pas: 0.4, unite: 'mm', aide: '0 = pièce pleine. Avec une buse de 0,4 mm, une paroi tient à partir de 0,8 mm.' });
    ui.curseur(el, { nom: 'Épaisseur du fond', obj: e, cle: 'fond', min: 0.8, max: 6, pas: 0.4, unite: 'mm' });
    ui.choix(el, { nom: 'Section', obj: e, cle: 'cotes', options: [[0, 'Ronde'], [6, '6 côtés'], [8, '8 côtés'], [12, '12 côtés']] });
  };

  A.comprendre = `
<p><b>Le principe.</b> On ne dessine pas la surface : on place quelques <b>points de contrôle</b>, et une formule mathématique calcule une courbe parfaitement lisse qui se laisse attirer par eux. Chaque point a un <b>poids</b> (sa force d’attraction) et la courbe a un <b>degré</b> (sa souplesse). NURBS veut dire <i>B-spline rationnelle non uniforme</i>.</p>
<p><b>Du profil au solide.</b> Ici le profil tourne autour d’un axe (révolution). Les logiciels savent aussi le pousser tout droit (extrusion), le faire glisser le long d’un chemin (balayage) ou tendre une peau entre plusieurs courbes (lissage).</p>
<p><b>Points forts.</b> Surfaces exactes et lisses à toutes les échelles, peu de données, faciles à retoucher. C’est la méthode des carrosseries, des coques de bateau, des objets design.</p>
<p><b>Limites.</b> Difficile pour les formes très ramifiées ; les raccords entre plusieurs surfaces demandent du soin.</p>
<p><b>Pour l’impression 3D.</b> L’imprimante ne lit pas les courbes : le logiciel doit les convertir en triangles (fichier STL). Plus on demande de triangles, plus la pièce imprimée est fidèle à la courbe. Dans cet atelier, la révolution est découpée en 72 facettes.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> Rhino, Alias, les surfaces de Fusion 360, de SolidWorks ou de FreeCAD.</p>`;

  A.defis = [
    { titre: 'Un vase de 120 mm', texte: 'Règle le profil pour que la pièce mesure 120 mm de haut (à 2 mm près) et reste étanche.', ok: (a, e) => a.etanche && Math.abs(a.dims[2] - 120) <= 2 },
    { titre: 'Zéro support', texte: 'Garde une paroi creuse et au moins 80 mm de haut, mais sans aucune zone rouge (surplomb à plus de 45°).', ok: (a, e) => a.etanche && e.paroi > 0 && a.dims[2] >= 80 && a.surplombAire < 50 },
    { titre: 'Le poids d’un point', texte: 'Donne à un point un poids de 4 ou plus et observe : la courbe vient presque le toucher.', ok: (a, e) => e.pts.some(p => p.w >= 4) }
  ];

  (ME.ateliers = ME.ateliers || []).push(A);
})(globalThis.ME = globalThis.ME || {});
