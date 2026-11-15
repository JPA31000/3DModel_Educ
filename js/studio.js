/* Model Educ Studio — l'application.
   Un projet est une liste d'éléments posés sur le plateau. Chaque élément a un type (un outil
   du ruban), un état (ses réglages), une position, une rotation, un rôle (plein ou perçage).
   La pièce à imprimer = tous les éléments pleins visibles, auxquels on enlève les perçages. */
(function (ME) {
  'use strict';
  const M = ME.M, C = ME.CSG, V = ME.V, T = ME.TYPES, $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const nb = (x, d) => { const s = (+x).toFixed(d === undefined ? 1 : d).replace('.', ','); return d === 0 ? s : s.replace(/,0+$/, ''); };
  const copie = x => JSON.parse(JSON.stringify(x));

  /* ---------- mémoire du navigateur (jamais indispensable) ---------- */
  const CLE = 'modeleducstudio.v1.';
  const lire = cle => { try { const t = localStorage.getItem(CLE + cle); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const ecrire = (cle, val) => { try { localStorage.setItem(CLE + cle, typeof val === 'string' ? val : JSON.stringify(val)); } catch (e) { /* stockage refusé : on continue sans */ } };
  const reglages = Object.assign({ plateau: [220, 220, 250], couche: 0.2, surplombs: true, style: 'aretes', controle: true }, lire('reglages') || {});
  const sauverReglages = () => ecrire('reglages', reglages);

  const COULEURS = [[0.60, 0.70, 0.79], [0.52, 0.76, 0.78], [0.58, 0.76, 0.60], [0.80, 0.63, 0.76], [0.86, 0.81, 0.55], [0.74, 0.74, 0.74]];
  const ROUGE = [0.87, 0.22, 0.16], ORANGE = [0.85, 0.3, 0.05, 1], LIMITE = 4500;
  const teinte = c => [c[0] * 0.5 + 0.49, c[1] * 0.5 + 0.34, c[2] * 0.5 + 0.2];

  const I = { // icônes du ruban (traits, 32 × 32)
    fleche: '<path d="M9 5v20l5-5 4 8 3-1.5-4-8h7z"/>',
    pave: '<path d="M5 11l11-5 11 5v11l-11 5-11-5zM5 11l11 5 11-5M16 16v11"/>',
    cylindre: '<ellipse cx="16" cy="8" rx="9" ry="4"/><path d="M7 8v16c0 2.2 4 4 9 4s9-1.8 9-4V8"/>',
    cone: '<path d="M16 4L6 24c0 2.2 4.5 4 10 4s10-1.8 10-4z"/><path d="M6 24c0-2.2 4.5-4 10-4s10 1.8 10 4"/>',
    sphere: '<circle cx="16" cy="16" r="11"/><ellipse cx="16" cy="16" rx="11" ry="4"/>',
    tore: '<ellipse cx="16" cy="16" rx="12" ry="7.5"/><path d="M11 15c1 1.6 2.9 2.4 5 2.4s4-.8 5-2.4M12.2 16.3c.8-1.2 2.2-1.9 3.8-1.9s3 .7 3.8 1.9"/>',
    prisme: '<path d="M16 4l9 4.5v5L16 18l-9-4.5v-5zM7 13.5V23l9 5 9-5v-9.5M16 18v10"/>',
    revolution: '<path d="M5 26C5 10 27 22 27 6"/><circle cx="5" cy="26" r="2"/><circle cx="10" cy="9" r="2"/><circle cx="22" cy="23" r="2"/><circle cx="27" cy="6" r="2"/><path d="M5 26L10 9M22 23L27 6" stroke-dasharray="2 3"/>',
    polygone: '<path d="M4 24L12 6l14 4 2 14-13 4z"/><path d="M12 6l3 22M12 6l16 18M4 24l22-14"/>',
    subdivision: '<rect x="4" y="4" width="24" height="24" stroke-dasharray="2 3"/><rect x="8" y="8" width="16" height="16" rx="7"/>',
    boules: '<path d="M12 7a7 7 0 0 1 6.2 3.8 6.5 6.5 0 1 1-1.1 11.6A7 7 0 1 1 12 7z"/><circle cx="12" cy="14" r="1"/><circle cx="21" cy="17" r="1"/>',
    gyroide: '<path d="M4 10c4-6 8 6 12 0s8 6 12 0M4 17c4-6 8 6 12 0s8 6 12 0M4 24c4-6 8 6 12 0s8 6 12 0"/>',
    voxels: '<path d="M16 4l10 5v14l-10 5-10-5V9z"/><path d="M6 9l10 5 10-5M16 14v14M11 6.5l10 5v14M21 6.5l-10 5v14M6 16l10 5 10-5"/>',
    equerre: '<path d="M7 5v22h20v-6H13V5z"/><circle cx="10" cy="11" r="1.4"/><circle cx="21" cy="24" r="1.4"/>',
    boite: '<path d="M6 13h20v14H6zM4 8h24v5H4zM13 18h6"/>',
    engrenage: '<circle cx="16" cy="16" r="3.5"/><path d="M16 4l2 3 3.5-1 .8 3.6 3.6.8-1 3.5 3 2.1-3 2 1 3.5-3.6.8-.8 3.6-3.5-1-2 3-2-3-3.5 1-.8-3.6-3.6-.8 1-3.5-3-2 3-2.1-1-3.5 3.6-.8.8-3.6 3.5 1z"/>',
    fige: '<path d="M16 4l10 5v14l-10 5-10-5V9z"/><path d="M6 9l10 5 10-5M16 14v14M6 23l10-9M26 23l-10-9"/>',
    dupliquer: '<rect x="5" y="5" width="15" height="15" rx="1.5"/><path d="M12 24v2.5a1.5 1.5 0 0 0 1.5 1.5H26a1.5 1.5 0 0 0 1.5-1.5V14A1.5 1.5 0 0 0 26 12.5h-2.5"/>',
    supprimer: '<path d="M6 9h20M12 9V5.5h8V9M8.5 9l1.2 17.5h12.6L23.5 9M13 14v8M19 14v8"/>',
    plein: '<rect x="6" y="6" width="20" height="20" rx="2"/><path d="M6 13l7-7M6 20L20 6M8 26L26 8M15 26l11-11M22 26l4-4"/>',
    creux: '<rect x="5" y="5" width="22" height="22" rx="2"/><circle cx="16" cy="16" r="6.5" stroke-dasharray="3 3"/>',
    poser: '<path d="M16 4v15M10 13l6 6 6-6M5 25h22"/>',
    centrer: '<circle cx="16" cy="16" r="6"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8"/>',
    tourner: '<path d="M26 16a10 10 0 1 1-3.5-7.6"/><path d="M23 3v6h-6"/>',
    coucher: '<rect x="6" y="4" width="8" height="18" rx="1" stroke-dasharray="3 3"/><rect x="10" y="20" width="18" height="8" rx="1"/><path d="M18 8a8 8 0 0 1 6 7M24 11v4h-4"/>',
    masquer: '<path d="M4 16s4.5-8 12-8 12 8 12 8-4.5 8-12 8S4 16 4 16z"/><circle cx="16" cy="16" r="3.5"/><path d="M6 27L26 5"/>',
    afficher: '<path d="M4 16s4.5-8 12-8 12 8 12 8-4.5 8-12 8S4 16 4 16z"/><circle cx="16" cy="16" r="3.5"/>',
    fusionner: '<path d="M12.5 7a8 8 0 0 1 3.5.8A8 8 0 1 1 16 23.2 8 8 0 1 1 12.5 7z"/>',
    iso: '<path d="M16 4l10 5.5v13L16 28 6 22.5v-13zM6 9.5l10 5.5 10-5.5M16 15v13"/>',
    dessus: '<path d="M16 5l11 6-11 6-11-6z" fill="currentColor" fill-opacity=".18"/><path d="M5 11v10l11 6 11-6V11M16 17v10"/>',
    face: '<path d="M5 11l11 6v10L5 21z" fill="currentColor" fill-opacity=".18"/><path d="M5 11l11-6 11 6-11 6M27 11v10l-11 6"/>',
    droite: '<path d="M27 11l-11 6v10l11-6z" fill="currentColor" fill-opacity=".18"/><path d="M27 11L16 5 5 11l11 6M5 11v10l11 6"/>',
    arriere: '<path d="M16 5l11 6v10l-11-6z" stroke-dasharray="2.5 2.5"/><path d="M16 5L5 11v10l11 6 11-6M5 11l11 6 11-6M16 17v10"/>',
    gauche: '<path d="M16 5L5 11v10l11-6z" stroke-dasharray="2.5 2.5"/><path d="M16 5l11 6v10l-11 6-11-6M5 11l11 6 11-6M16 17v10"/>',
    cadrer: '<path d="M5 11V5h6M21 5h6v6M27 21v6h-6M11 27H5v-6"/><rect x="11" y="11" width="10" height="10" rx="1"/>',
    cadrerSel: '<path d="M5 11V5h6M21 5h6v6M27 21v6h-6M11 27H5v-6"/><circle cx="16" cy="16" r="4.5"/>',
    ombre: '<circle cx="16" cy="16" r="10" fill="currentColor" fill-opacity=".25"/>',
    aretes: '<path d="M16 4l10 5.5v13L16 28 6 22.5v-13z" fill="currentColor" fill-opacity=".18"/><path d="M6 9.5l10 5.5 10-5.5M16 15v13"/>',
    filaire: '<path d="M16 4l10 5.5v13L16 28 6 22.5v-13zM6 9.5l10 5.5 10-5.5M16 15v13" stroke-dasharray="3 2.5"/>',
    surplombs: '<path d="M5 26h22M9 26V8h14l-8 8v10"/><path d="M17.5 13.5l5 5" stroke-dasharray="2 2.5"/>',
    controle: '<path d="M16 4l10 4v7c0 6.5-4.3 11-10 13C10.300 26 6 21.500 6 15V8z"/><path d="M11.500 16l3.300 3.300 6-6.500"/>',
    imprimante: '<path d="M6 5h20v22H6zM6 22h20M10 5v5h12V5M16 10v4M13 17h6l-3 3z"/>',
    stl: '<path d="M16 4v15M10 13l6 6 6-6M6 22v5h20v-5"/>',
    livre: '<path d="M16 8c-3-2.500-7-3-11-2.500v19C9 24 13 24.500 16 27c3-2.500 7-3 11-2.500v-19C23 5 19 5.500 16 8zM16 8v19"/>',
    tableau: '<rect x="4" y="6" width="24" height="20" rx="1.500"/><path d="M4 12h24M4 19h24M12 6v20"/>',
    aide: '<circle cx="16" cy="16" r="11"/><path d="M12.500 13a3.600 3.600 0 1 1 5.200 3.200c-1.100.600-1.700 1.300-1.700 2.600"/><circle cx="16" cy="22.500" r=".600"/>',
    licence: '<circle cx="16" cy="16" r="11"/><path d="M14 13.500a3 3 0 1 0 0 5M22 13.500a3 3 0 1 0 0 5"/>'
  };
  const svg = (id, t) => '<svg viewBox="0 0 32 32" aria-hidden="true"' + (t ? ' style="width:' + t + 'px;height:' + t + 'px"' : '') + '>' + (I[id] || I.pave) + '</svg>';

  /* ---------- état ---------- */
  const app = ME.app = {};
  const vue = app.vue = ME.Vue($('vue'));
  let P = { nom: 'Sans titre', n: 0, objets: [] }, sel = null, outil = null, onglet = 'creer';
  let annul = [], retab = [], dernier = '';
  const insts = new Map(), caches = new Map(), aretesDe = new WeakMap(), ouverts = {};
  let parts = [], piece = { v: [], f: [] }, analyse = null, notes = [], groupesAretes = [];
  let tranche = null, fantome = null, glisse = null, rafr = [];

  const obj = id => P.objets.find(o => o.id === id);
  const selO = () => (sel !== null && obj(sel)) || null;
  function inst(o) {
    let i = insts.get(o.id);
    if (!i || i.etat !== o.etat) { i = Object.create(T[o.type].proto); i.etat = o.etat; insts.set(o.id, i); if (i.apresChargement) { try { i.apresChargement(); } catch (e) { /* état abîmé : la construction le dira */ } } }
    return i;
  }
  const cache = o => { let c = caches.get(o.id); if (!c) { c = {}; caches.set(o.id, c); } return c; };

  /* ---------- placer un élément : rotation (X, puis Y, puis Z) et translation ---------- */
  function mat(rot) {
    const [rx, ry, rz] = rot.map(a => a * Math.PI / 180), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    return [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, -sy, cy * sx, cy * cx];
  }
  const versMonde = (o, p) => { const R = mat(o.rot); return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + o.pos[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + o.pos[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + o.pos[2]]; };
  const dirLocale = (o, d) => { const R = mat(o.rot); return [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]]; };
  const versLocal = (o, p) => dirLocale(o, V.sub(p, o.pos));
  const rayonLocal = (o, r) => ({ o: versLocal(o, r.o), d: dirLocale(o, r.d), avant: dirLocale(o, r.avant) });
  const segMonde = (o, seg) => { const s = new Array(seg.length); for (let i = 0; i < seg.length; i += 3) { const p = versMonde(o, [seg[i], seg[i + 1], seg[i + 2]]); s[i] = p[0]; s[i + 1] = p[1]; s[i + 2] = p[2]; } return s; };

  /* maillage d'un élément dans son repère, puis sur le plateau (gardés en mémoire tant que rien ne change) */
  function local(o, rapide) {
    const c = cache(o), k = JSON.stringify(o.etat);
    if (c.cleE === k && c.local && (!c.estRapide || rapide)) return c.local;
    let m; try { m = inst(o).construire(!!rapide); } catch (e) { m = { v: [], f: [] }; }
    c.local = m; c.cleE = k; c.estRapide = !!rapide; return m;
  }
  function monde(o, rapide) {
    const m = local(o, rapide), c = cache(o), k = o.pos.join() + '|' + o.rot.join();
    if (c.cleM === k && c.srcM === m) return c.monde;
    const R = mat(o.rot), n = m.v.length, v = new Array(n), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i += 3) {
      const x = m.v[i], y = m.v[i + 1], z = m.v[i + 2];
      const a = R[0] * x + R[1] * y + R[2] * z + o.pos[0], b = R[3] * x + R[4] * y + R[5] * z + o.pos[1], d = R[6] * x + R[7] * y + R[8] * z + o.pos[2];
      v[i] = a; v[i + 1] = b; v[i + 2] = d;
      if (a < mn[0]) mn[0] = a; if (a > mx[0]) mx[0] = a; if (b < mn[1]) mn[1] = b; if (b > mx[1]) mx[1] = b; if (d < mn[2]) mn[2] = d; if (d > mx[2]) mx[2] = d;
    }
    c.monde = { v, f: m.f, lissage: m.lissage }; c.bb = n ? [mn, mx] : [o.pos.slice(), o.pos.slice()]; c.cleM = k; c.srcM = m; c.final = null;
    return c.monde;
  }
  const chevauche = (a, b) => a[0][0] < b[1][0] - 0.01 && b[0][0] < a[1][0] - 0.01 && a[0][1] < b[1][1] - 0.01 && b[0][1] < a[1][1] - 0.01 && a[0][2] < b[1][2] - 0.01 && b[0][2] < a[1][2] - 0.01;
  function polys(m) {
    const r = [], v = m.v, f = m.f, p = i => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
    for (let t = 0; t < f.length; t += 3) { const a = p(f[t]), b = p(f[t + 1]), c = p(f[t + 2]); if (V.len(V.cross(V.sub(b, a), V.sub(c, a))) > 1e-9) r.push(new C.Poly([a, b, c])); }
    return r;
  }
  /* un élément plein, une fois les perçages qui le touchent enlevés (opération booléenne) */
  function final(o, creux) {
    const c = cache(o), m = c.monde, cr = creux.filter(x => chevauche(cache(x).bb, c.bb));
    const k = cr.map(x => x.id + ':' + cache(x).cleE + cache(x).cleM).join(';');
    if (c.final && c.cleF === k && c.srcF === m) return c.final;
    let f = m; c.note = null;
    if (cr.length) {
      const nt = m.f.length / 3 + cr.reduce((s, x) => s + cache(x).monde.f.length / 3, 0);
      if (nt > LIMITE) c.note = 'Perçage non appliqué à « ' + o.nom + ' » : trop de triangles (' + Math.round(nt).toLocaleString('fr-FR') + '). Réduis les facettes, la finesse ou le niveau de subdivision.';
      else try {
        let p = polys(m); for (const x of cr) p = C.enlever(p, polys(cache(x).monde));
        f = C.maillage(p); f.lissage = m.lissage;
      } catch (e) { f = m; c.note = 'Perçage non appliqué à « ' + o.nom + ' » : le calcul n’a pas abouti.'; }
    }
    c.final = f; c.cleF = k; c.srcF = m; return f;
  }
  function aretes(m, angle, sansCalcul) {
    let a = aretesDe.get(m); if (!a) { a = {}; aretesDe.set(m, a); }
    if (!a[angle]) { if (sansCalcul) return null; a[angle] = M.aretesVives(m, angle); }
    return a[angle];
  }

  /* ---------- reconstruire la scène ---------- */
  function rendre(rapide) {
    const vis = P.objets.filter(o => o.vis !== false);
    for (const o of vis) monde(o, rapide && o.id === sel);
    const creux = vis.filter(o => o.role === 'creux'), pleins = vis.filter(o => o.role !== 'creux');
    notes = []; parts = [];
    for (const o of pleins) { const m = rapide ? cache(o).monde : final(o, creux); parts.push({ o, m, dec: 0 }); if (!rapide && cache(o).note) notes.push(cache(o).note); }
    const v = [], f = [];
    for (const p of parts) { const b = v.length / 3; p.dec = f.length / 3; const mv = p.m.v, mf = p.m.f; for (let i = 0; i < mv.length; i++) v.push(mv[i]); for (let i = 0; i < mf.length; i++) f.push(mf[i] + b); }
    piece = { v, f };
    analyse = M.analyser(piece, { plateau: reglages.plateau, couche: reglages.couche, rapide });
    const a = analyse, pl = reglages.plateau;
    if (!a.vide) {
      if (a.min[0] < -pl[0] / 2 - 0.01 || a.max[0] > pl[0] / 2 + 0.01 || a.min[1] < -pl[1] / 2 - 0.01 || a.max[1] > pl[1] / 2 + 0.01 || a.max[2] > pl[2] + 0.01) a.horsPlateau = true;
      /* une face tournée vers le bas mais posée sur le dessus d'un autre élément n'est pas un surplomb
         (approximation : on compare avec la boîte englobante de l'autre élément) */
      if (parts.length > 1) for (const p of parts) {
        const autres = parts.filter(q => q !== p).map(q => cache(q.o).bb), mf = p.m.f, mv = p.m.v;
        for (let t = 0; t < mf.length / 3; t++) {
          if (!a.surplomb[p.dec + t]) continue;
          const i = mf[t * 3] * 3, j = mf[t * 3 + 1] * 3, k = mf[t * 3 + 2] * 3;
          const gx = (mv[i] + mv[j] + mv[k]) / 3, gy = (mv[i + 1] + mv[j + 1] + mv[k + 1]) / 3, gz = (mv[i + 2] + mv[j + 2] + mv[k + 2]) / 3;
          if (!autres.some(b => gx >= b[0][0] && gx <= b[1][0] && gy >= b[0][1] && gy <= b[1][1] && Math.abs(gz - b[1][2]) < 0.06)) continue;
          a.surplomb[p.dec + t] = 0;
          a.surplombAire -= V.len(V.cross([mv[j] - mv[i], mv[j + 1] - mv[i + 1], mv[j + 2] - mv[i + 2]], [mv[k] - mv[i], mv[k + 1] - mv[i + 1], mv[k + 2] - mv[i + 2]])) / 2;
        }
        a.surplombAire = Math.max(0, a.surplombAire);
      }
      if (!rapide) { // éléments pleins qui se touchent : un seul morceau ; qui se recouvrent : le trancheur les soudera
        const par = pleins.map((_, i) => i), rac = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
        const touche = (x, y) => [0, 1, 2].every(k => x[0][k] <= y[1][k] + 0.05 && y[0][k] <= x[1][k] + 0.05);
        a.recouvre = 0;
        for (let i = 0; i < pleins.length; i++) for (let j = i + 1; j < pleins.length; j++) {
          const x = cache(pleins[i]).bb, y = cache(pleins[j]).bb;
          if (touche(x, y)) par[rac(i)] = rac(j);
          if (chevauche(x, y)) a.recouvre++;
        }
        a.assembles = pleins.length - new Set(pleins.map((_, i) => rac(i))).size;
        a.pieces = Math.max(1, a.pieces - a.assembles);
      }
    }
    const morceaux = []; let n = 0; const voir = reglages.surplombs, s = a.surplomb;
    for (const p of parts) {
      const base = COULEURS[(p.o.coul || 0) % COULEURS.length], col = p.o.id === sel ? teinte(base) : base, dec = p.dec;
      const t = M.tampons(p.m, p.m.lissage || 0, i => voir && s[dec + i] ? ROUGE : col); morceaux.push(t); n += t.P.length;
    }
    const PP = new Float32Array(n), NN = new Float32Array(n), CC = new Float32Array(n); let k = 0;
    for (const t of morceaux) { PP.set(t.P, k); NN.set(t.N, k); CC.set(t.C, k); k += t.P.length; }
    vue.faces = reglages.style !== 'filaire'; vue.maillage(PP, NN, CC);
    groupesAretes = [];
    if (reglages.style !== 'ombre') {
      const fil = reglages.style === 'filaire';
      for (const p of parts) { const ar = aretes(p.m, fil ? 1 : 30, rapide); if (ar) groupesAretes.push({ seg: ar, c: [0.1, 0.13, 0.16, fil ? 0.9 : 0.7] }); }
    }
    if (tranche !== null) tranche = Math.min(tranche, Math.max(1, a.couches));
    app.majDecor(); afficherAnalyse();
  }
  app.maj = function (rapide) {
    rendre(!!rapide);
    for (const r of rafr) r();
    const o = selO(); if (o) { const i = inst(o); if (i.apresMaj) i.apresMaj(); }
  };

  const boite = (a, b) => {
    const s = [], c = [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]];
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) s.push(...c[i], ...c[j]);
    return s;
  };
  const poigneesObjet = o => {
    const bb = cache(o).bb, cx = (bb[0][0] + bb[1][0]) / 2, cy = (bb[0][1] + bb[1][1]) / 2, a = o.rot[2] * Math.PI / 180;
    const R = Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1]) / 2 + 14;
    return { xy: [cx, bb[0][1] - 10, bb[0][2]], z: [cx, cy, bb[1][2] + 12], r: [o.pos[0] + R * Math.cos(a), o.pos[1] + R * Math.sin(a), bb[0][2]], haut: [cx, cy, bb[1][2]] };
  };
  app.majDecor = function () {
    const fant = [], poig = []; let fins = groupesAretes.slice();
    const o = selO();
    for (const x of P.objets) if (x.vis !== false && x.role === 'creux' && cache(x).monde) fant.push({ seg: aretes(cache(x).monde, 25), c: x.id === sel ? ORANGE : [0.04, 0.42, 0.49, 0.75] });
    if (o && o.vis !== false && cache(o).bb) {
      const i = inst(o), d = i.decor ? i.decor() : {}, bb = cache(o).bb, h = poigneesObjet(o);
      for (const g of d.fantomes || []) fant.push({ seg: segMonde(o, g.seg), c: g.c });
      for (const g of d.fins || []) fins.push({ seg: segMonde(o, g.seg), c: g.c });
      for (const p of d.poignees || []) poig.push(Object.assign({}, p, { p: versMonde(o, p.p) }));
      fant.push({ seg: boite(bb[0], bb[1]), c: [0.76, 0.25, 0.05, 0.55] });
      fant.push({ seg: [...h.haut, ...h.z, o.pos[0], o.pos[1], bb[0][2], ...h.r, h.xy[0], bb[0][1], bb[0][2], ...h.xy], c: [0.2, 0.25, 0.3, 0.5] });
      poig.push({ id: '__xy', p: h.xy, c: [0.14, 0.23, 0.37, 1], t: 17 }, { id: '__z', p: h.z, c: [0.17, 0.48, 0.24, 1], t: 15 }, { id: '__r', p: h.r, c: [0.49, 0.25, 0.6, 1], t: 15 });
    }
    if (outil && fantome) { const [x, y, z] = fantome; fant.push({ seg: [x - 15, y - 15, z, x + 15, y - 15, z, x + 15, y - 15, z, x + 15, y + 15, z, x + 15, y + 15, z, x - 15, y + 15, z, x - 15, y + 15, z, x - 15, y - 15, z, x, y, z, x, y, z + 25], c: ORANGE }); }
    if (tranche !== null && analyse && !analyse.vide) {
      const z = analyse.min[2] + tranche * reglages.couche - 1e-3;
      vue.coupe = z; fant.push({ seg: M.trancher(piece, z), c: [0.76, 0.15, 0.05, 1] });
      fins = fins.map(g => { const s = []; for (let i = 0; i < g.seg.length; i += 6) if (Math.max(g.seg[i + 2], g.seg[i + 5]) <= z + 1e-3) s.push(g.seg[i], g.seg[i + 1], g.seg[i + 2], g.seg[i + 3], g.seg[i + 4], g.seg[i + 5]); return { seg: s, c: g.c }; });
    } else vue.coupe = null;
    const assembler = groupes => {
      let n = 0; for (const g of groupes) n += g.seg.length / 3;
      const A = new Float32Array(n * 3), B = new Float32Array(n * 4); let k = 0;
      for (const g of groupes) { A.set(g.seg, k * 3); for (let i = 0; i < g.seg.length / 3; i++) B.set(g.c, (k + i) * 4); k += g.seg.length / 3; }
      return [A, B];
    };
    vue.traits(...assembler(fant)); vue.traitsFins(...assembler(fins)); vue.definirPoignees(poig);
  };
  app.cadrer = function (selection) {
    const o = selection && selO();
    if (o && cache(o).bb) vue.cadrer(cache(o).bb[0], cache(o).bb[1]);
    else if (analyse && !analyse.vide) vue.cadrer(analyse.min, analyse.max);
    else vue.cadrer([-60, -60, 0], [60, 60, 60]);
  };

  /* ---------- valider un geste : annulation, sauvegarde, contrôle complet ---------- */
  app.valider = function () {
    const j = JSON.stringify(P);
    if (j !== dernier) { annul.push(dernier); if (annul.length > 40) annul.shift(); retab = []; dernier = j; ecrire('projet', j); }
    app.maj(false); majArbre(); majEtat(); ruban();
  };
  function remettre(j) { P = JSON.parse(j); dernier = j; ecrire('projet', j); insts.clear(); caches.clear(); if (!selO()) sel = null; tout(); }
  function annuler() { if (annul.length) { retab.push(dernier); remettre(annul.pop()); } }
  function retablir() { if (retab.length) { annul.push(dernier); remettre(retab.pop()); } }
  function tout() { app.maj(false); app.panneau(); majArbre(); majEtat(); ruban(); }
  function installer(p, cadrer) { P = p; insts.clear(); caches.clear(); sel = null; outil = null; tranche = null; annul = []; retab = []; dernier = JSON.stringify(P); ecrire('projet', dernier); tout(); if (cadrer) app.cadrer(); }

  /* ---------- éléments ---------- */
  function creer(type, pos) {
    const t = T[type], n = P.objets.filter(o => o.type === type).length + 1;
    const o = { id: ++P.n, nom: t.nom + ' ' + n, type, etat: t.proto.defaut(), pos: pos || [0, 0, 0], rot: [0, 0, 0], role: 'plein', vis: true, coul: P.objets.length % COULEURS.length };
    P.objets.push(o); return o;
  }
  function selectionner(id) { sel = id; app.maj(false); app.panneau(); majArbre(); majEtat(); ruban(); }
  function poserSurPlateau(o) { monde(o); o.pos[2] = Math.round((o.pos[2] - cache(o).bb[0][2]) * 100) / 100; }
  function prendreOutil(type) { outil = type; fantome = null; $('vue').style.cursor = type ? 'crosshair' : 'default'; majEtat(); ruban(); app.majDecor(); }
  const COMMANDES = {
    dupliquer(o) { const c = copie(o); c.id = ++P.n; c.nom = o.nom + ' (copie)'; c.pos[0] += 10; c.pos[1] += 10; P.objets.push(c); sel = c.id; },
    supprimer(o) { P.objets = P.objets.filter(x => x !== o); sel = null; },
    plein(o) { o.role = 'plein'; },
    creux(o) { o.role = 'creux'; },
    poser(o) { poserSurPlateau(o); },
    centrer(o) { monde(o); const bb = cache(o).bb; o.pos[0] = Math.round(o.pos[0] - (bb[0][0] + bb[1][0]) / 2); o.pos[1] = Math.round(o.pos[1] - (bb[0][1] + bb[1][1]) / 2); },
    tourner(o) { o.rot[2] = (o.rot[2] + 90) % 360; },
    coucher(o) { o.rot[0] = (o.rot[0] + 90) % 360; poserSurPlateau(o); },
    masquer(o) { o.vis = false; },
    afficherTout() { for (const o of P.objets) o.vis = true; },
    fusionner() {
      const vis = P.objets.filter(o => o.vis !== false), pleins = vis.filter(o => o.role !== 'creux'), creux = vis.filter(o => o.role === 'creux');
      if (!pleins.length) return dire('Rien à fusionner : il faut au moins un élément plein visible.', true);
      const nt = vis.reduce((s, o) => s + monde(o).f.length / 3, 0);
      if (nt > LIMITE) return dire('Fusion impossible : trop de triangles (' + Math.round(nt).toLocaleString('fr-FR') + ', limite ' + LIMITE.toLocaleString('fr-FR') + '). Réduis les facettes ou la finesse.', true);
      let m;
      try {
        let p = polys(monde(pleins[0]));
        for (const o of pleins.slice(1)) p = C.unir(p, polys(monde(o)));
        for (const o of creux) p = C.enlever(p, polys(monde(o)));
        m = C.maillage(p);
      } catch (e) { return dire('La fusion n’a pas abouti.', true); }
      if (!m.f.length || !M.analyser(m, {}).etanche) return dire('La fusion donnerait un maillage qui n’est pas étanche : elle est abandonnée.', true);
      P.objets = P.objets.filter(o => !vis.includes(o));
      const o = creer('fige'); o.nom = 'Fusion ' + P.n; o.etat = { v: m.v.map(x => Math.round(x * 1e4) / 1e4), f: Array.from(m.f) }; o.coul = pleins[0].coul; sel = o.id;
      dire('Éléments fusionnés en un seul maillage (' + (m.f.length / 3) + ' triangles).');
    }
  };
  function commande(nom) {
    const o = selO(); if (!o && !['afficherTout', 'fusionner'].includes(nom)) return;
    COMMANDES[nom](o); app.valider(); app.panneau();
  }

  /* ---------- briques de la fenêtre Propriétés (les mêmes que dans Model Educ) ---------- */
  const ui = {
    nb,
    titre: (p, t) => p.appendChild(el('h4', '', t)),
    note: (p, h) => p.appendChild(el('p', 'note', h)),
    aide: (p, h) => p.appendChild(el('p', 'aide', h)),
    info: (p, h) => p.appendChild(el('div', 'info', h)),
    bloc: (p, cls) => p.appendChild(el('div', cls)),
    curseur(p, o) {
      const d = el('div', 'curseur'), tete = el('div', 'tete'), out = el('output'), inp = el('input'), decimales = o.pas < 1 ? (o.pas < 0.1 ? 2 : 1) : 0;
      tete.append(el('label', '', o.nom), out);
      inp.type = 'range'; inp.min = o.min; inp.max = o.max; inp.step = o.pas; inp.setAttribute('aria-label', o.nom);
      const montrer = () => { inp.value = o.obj[o.cle]; out.textContent = nb(o.obj[o.cle], decimales) + (o.unite ? ' ' + o.unite : ''); };
      montrer(); rafr.push(montrer);
      inp.addEventListener('input', () => { o.obj[o.cle] = +inp.value; montrer(); if (!o.sansMaj) app.maj(true); });
      inp.addEventListener('change', () => { o.obj[o.cle] = +inp.value; if (o.apres) o.apres(); app.valider(); if (o.refaire) app.panneau(); });
      d.append(tete, inp); p.appendChild(d);
      if (o.aide) ui.aide(p, o.aide);
    },
    choix(p, o) {
      const d = el('div', 'choix'), r = el('div', 'rangee'); d.append(el('div', 'nom', o.nom), r);
      for (const [val, lib] of o.options) {
        const b = el('button', String(o.obj[o.cle]) === String(val) ? 'actif' : '', lib); b.type = 'button';
        b.addEventListener('click', () => { o.obj[o.cle] = val; app.valider(); if (o.apres) o.apres(); app.panneau(); });
        r.appendChild(b);
      }
      p.appendChild(d);
      if (o.aide) ui.aide(p, o.aide);
    },
    boutons(p, liste) {
      const r = el('div', 'rangee');
      for (const [lib, fn, opt] of liste) {
        const b = el('button', opt ? ['fort', 'actif', 'danger', 'large'].filter(k => opt[k]).join(' ') : '', lib); b.type = 'button';
        if (opt && opt.inactif) b.disabled = true;
        b.addEventListener('click', fn); r.appendChild(b);
      }
      p.appendChild(r);
    },
    case(p, o) {
      const l = el('label', 'case'), c = el('input'); c.type = 'checkbox'; c.checked = !!o.obj[o.cle]; c.disabled = !!o.fige;
      c.addEventListener('change', () => { o.obj[o.cle] = c.checked ? 1 : 0; app.valider(); });
      l.append(c, el('span', '', o.nom)); p.appendChild(l);
    }
  };

  /* ---------- fenêtre Propriétés ---------- */
  function bloc(p, cle, titre, cls) {
    const d = el('details', 'bloc' + (cls ? ' ' + cls : '')), s = el('summary'); s.textContent = titre;
    d.open = ouverts[cle] !== false; d.addEventListener('toggle', () => { ouverts[cle] = d.open; });
    const c = el('div', 'dedans'); d.append(s, c); p.appendChild(d); return c;
  }
  let idChamp = 0;
  function ligne(g, nom, champ) { const id = 'ch' + (++idChamp), l = el('label'); l.textContent = nom; l.htmlFor = id; champ.id = id; g.append(l, champ); return champ; }
  function nombre(val, pas, apres) { const i = el('input'); i.type = 'number'; i.step = pas; i.value = val; i.addEventListener('change', () => { const x = parseFloat(i.value); if (isFinite(x)) apres(x); else i.value = val; }); return i; }
  app.panneau = function () {
    const p = $('proprietes'), haut = p.scrollTop; p.innerHTML = ''; rafr = [];
    const o = selO();
    if (!o) {
      $('propSous').textContent = 'projet';
      const g = el('div', 'grille'); bloc(p, 'projet', 'Projet').appendChild(g);
      const n = el('input'); n.type = 'text'; n.maxLength = 60; n.value = P.nom; n.addEventListener('change', () => { P.nom = n.value.trim() || 'Sans titre'; app.valider(); }); ligne(g, 'Nom', n);
      const v = el('span', 'valeur'); v.textContent = P.objets.length + ' élément' + (P.objets.length > 1 ? 's' : ''); ligne(g, 'Contenu', v);
      const pl = el('span', 'valeur'); pl.textContent = reglages.plateau.join(' × ') + ' mm'; ligne(g, 'Plateau', pl);
      const b = bloc(p, 'debut', 'Pour commencer', 'forme');
      b.appendChild(el('p', 'note', 'Aucun élément n’est sélectionné. Dans l’onglet <b>Créer</b>, choisis un outil puis clique sur le plateau. Clique ensuite un élément pour voir ses propriétés ici.'));
      ui.boutons(b, [['Changer d’imprimante…', () => ouvrirFenetre('fenImprimante')]]);
    } else {
      const t = T[o.type]; $('propSous').textContent = t.nom;
      const g = el('div', 'grille'); bloc(p, 'identite', 'Sélection — ' + t.nom).appendChild(g);
      const n = el('input'); n.type = 'text'; n.maxLength = 40; n.value = o.nom; n.addEventListener('change', () => { o.nom = n.value.trim() || t.nom; app.valider(); }); ligne(g, 'Nom', n);
      const me = el('span', 'valeur'); me.textContent = t.methode; ligne(g, 'Méthode', me);
      const r = el('select'); r.innerHTML = '<option value="plein">Plein (ajoute de la matière)</option><option value="creux">Perçage (enlève de la matière)</option>'; r.value = o.role === 'creux' ? 'creux' : 'plein';
      r.addEventListener('change', () => { o.role = r.value; app.valider(); }); ligne(g, 'Rôle', r);
      const pa = el('div', 'pastilles');
      COULEURS.forEach((c, i) => { const b = el('button', (o.coul || 0) === i ? 'actif' : ''); b.type = 'button'; b.style.background = 'rgb(' + c.map(x => Math.round(x * 255)).join(',') + ')'; b.setAttribute('aria-label', 'Couleur ' + (i + 1)); b.addEventListener('click', () => { o.coul = i; app.valider(); app.panneau(); }); pa.appendChild(b); });
      const lc = el('label'); lc.textContent = 'Couleur'; g.append(lc, pa);

      const g2 = el('div', 'grille'), bp = bloc(p, 'position', 'Position sur le plateau'); bp.appendChild(g2);
      const trio = (nom, tab, pas, apres) => {
        const d = el('div', 'trois'), champs = [];
        ['X', 'Y', 'Z'].forEach((axe, k) => { const l = el('label'), i = nombre(tab[k], pas, x => { tab[k] = x; if (apres) apres(); app.valider(); app.panneau(); }); i.setAttribute('aria-label', nom + ' ' + axe); l.append(axe, i); d.appendChild(l); champs.push(i); });
        const l = el('label'); l.textContent = nom; g2.append(l, d);
        rafr.push(() => champs.forEach((i, k) => { if (document.activeElement !== i) i.value = Math.round(tab[k] * 100) / 100; }));
      };
      trio('Position (mm)', o.pos, 1);
      trio('Rotation (°)', o.rot, 5, () => { monde(o); if (cache(o).bb[0][2] < 0) poserSurPlateau(o); });
      ui.boutons(bp, [['Poser sur le plateau', () => commande('poser')], ['Centrer', () => commande('centrer')]]);
      ui.aide(bp, 'Dans la vue : poignée bleue = déplacer, verte = monter, violette = tourner.');

      const bf = bloc(p, 'forme', 'Forme — ' + t.methode, 'forme');
      try { inst(o).panneau(bf, ui); } catch (e) { bf.appendChild(el('p', 'aide', 'Les réglages de cet élément ne peuvent pas être affichés.')); }
    }
    p.scrollTop = haut;
  };

  /* ---------- arborescence ---------- */
  function majArbre() {
    const a = $('arbre'); a.innerHTML = '';
    $('arbreSous').textContent = P.objets.length ? P.objets.length + ' élément' + (P.objets.length > 1 ? 's' : '') : '';
    if (!P.objets.length) { a.appendChild(el('p', 'vide', 'Le plateau est vide.')); return; }
    for (const o of P.objets) {
      const l = el('div', 'ligne' + (o.id === sel ? ' actif' : '') + (o.vis === false ? ' cache' : ''));
      const b = el('button', 'nomObj', svg(o.type)); b.type = 'button'; const s = el('span'); s.textContent = o.nom; b.appendChild(s);
      b.addEventListener('click', () => selectionner(o.id));
      l.appendChild(b);
      if (o.role === 'creux') l.appendChild(el('span', 'etq', 'perçage'));
      const oe = el('button', 'oeil', svg(o.vis === false ? 'masquer' : 'afficher')); oe.type = 'button'; oe.title = o.vis === false ? 'Afficher' : 'Masquer'; oe.setAttribute('aria-label', (o.vis === false ? 'Afficher ' : 'Masquer ') + o.nom);
      oe.addEventListener('click', () => { o.vis = o.vis === false; app.valider(); });
      l.appendChild(oe); a.appendChild(l);
    }
  }

  /* ---------- ruban ---------- */
  const ONGLETS = [['creer', 'Créer'], ['modifier', 'Modifier'], ['vue', 'Vue'], ['imprimer', 'Imprimer'], ['comprendre', 'Comprendre']];
  const VUES = { iso: [-0.9, 0.5], face: [-Math.PI / 2, 0.0001], arriere: [Math.PI / 2, 0.0001], droite: [0, 0.0001], gauche: [Math.PI, 0.0001], dessus: [-Math.PI / 2, Math.PI / 2 - 0.001] };
  function allerVue(nom) {
    const [az, e1] = VUES[nom], c = vue.cam, a0 = c.az, e0 = c.el, t0 = performance.now();
    let d = az - a0; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const pas = t => { const k = Math.min(1, (t - t0) / 320), s = k * k * (3 - 2 * k); c.az = a0 + d * s; c.el = e0 + (e1 - e0) * s; vue.demander(); if (k < 1) requestAnimationFrame(pas); };
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { c.az = az; c.el = e1; vue.demander(); } else requestAnimationFrame(pas);
  }
  function ruban() {
    const r = $('ruban'), o = selO(); r.innerHTML = '';
    const G = nom => { const g = el('div', 'groupe'), z = el('div', 'outils'); g.append(z, el('div', 'nom', nom)); r.appendChild(g); return z; };
    const B = (z, ic, lib, fn, opt) => {
      const b = el('button', 'outil' + (opt && opt.actif ? ' actif' : ''), svg(ic) + '<span>' + lib + '</span>'); b.type = 'button';
      if (opt && opt.titre) b.title = opt.titre; if (opt && opt.inactif) b.disabled = true; if (opt && opt.actif !== undefined) b.setAttribute('aria-pressed', !!opt.actif);
      b.addEventListener('click', fn); z.appendChild(b); return b;
    };
    if (onglet === 'creer') {
      B(G('Sélection'), 'fleche', 'Sélectionner', () => prendreOutil(null), { actif: !outil, titre: 'Choisir un élément dans la vue (Échap)' });
      let z = null, groupe = null;
      for (const k in T) {
        const t = T[k]; if (!t.groupe) continue;
        if (t.groupe !== groupe) { groupe = t.groupe; z = G(groupe); }
        B(z, k, t.nom, () => prendreOutil(outil === k ? null : k), { actif: outil === k, titre: t.nom + ' — ' + t.methode + '. Clique ensuite sur le plateau.' });
      }
    } else if (onglet === 'modifier') {
      const sans = !o; let z = G('Élément');
      B(z, 'dupliquer', 'Dupliquer', () => commande('dupliquer'), { inactif: sans, titre: 'Copier l’élément sélectionné (Ctrl + D)' });
      B(z, 'supprimer', 'Supprimer', () => commande('supprimer'), { inactif: sans, titre: 'Supprimer l’élément sélectionné (Suppr)' });
      z = G('Rôle');
      B(z, 'plein', 'Plein', () => commande('plein'), { inactif: sans, actif: !!o && o.role !== 'creux', titre: 'L’élément ajoute de la matière' });
      B(z, 'creux', 'Perçage', () => commande('creux'), { inactif: sans, actif: !!o && o.role === 'creux', titre: 'L’élément enlève de la matière aux éléments pleins qu’il traverse' });
      z = G('Placer');
      B(z, 'poser', 'Poser', () => commande('poser'), { inactif: sans, titre: 'Poser l’élément sur le plateau' });
      B(z, 'centrer', 'Centrer', () => commande('centrer'), { inactif: sans, titre: 'Amener l’élément au centre du plateau' });
      B(z, 'tourner', 'Tourner 90°', () => commande('tourner'), { inactif: sans, titre: 'Quart de tour autour de l’axe vertical' });
      B(z, 'coucher', 'Coucher', () => commande('coucher'), { inactif: sans, titre: 'Basculer l’élément d’un quart de tour, puis le reposer' });
      z = G('Affichage');
      B(z, 'masquer', 'Masquer', () => commande('masquer'), { inactif: sans, titre: 'Un élément masqué n’est ni contrôlé ni exporté' });
      B(z, 'afficher', 'Tout afficher', () => commande('afficherTout'), { inactif: !P.objets.some(x => x.vis === false) });
      B(G('Assembler'), 'fusionner', 'Fusionner', () => commande('fusionner'), { inactif: !P.objets.length, titre: 'Unir les éléments pleins visibles, enlever les perçages, et ne garder qu’un seul maillage' });
    } else if (onglet === 'vue') {
      let z = G('Vues');
      for (const [k, lib] of [['iso', '3D'], ['dessus', 'Dessus'], ['face', 'Face'], ['arriere', 'Arrière'], ['droite', 'Droite'], ['gauche', 'Gauche']]) B(z, k, lib, () => allerVue(k));
      z = G('Cadrage');
      B(z, 'cadrer', 'Tout', () => app.cadrer(), { titre: 'Cadrer toute la pièce (touche F)' });
      B(z, 'cadrerSel', 'Sélection', () => app.cadrer(true), { inactif: !o });
      z = G('Style d’affichage');
      for (const [k, lib] of [['ombre', 'Ombré'], ['aretes', 'Ombré + arêtes'], ['filaire', 'Filaire']]) B(z, k, lib, () => { reglages.style = k; sauverReglages(); app.maj(false); ruban(); }, { actif: reglages.style === k });
      B(G('Analyse'), 'surplombs', 'Surplombs', () => { reglages.surplombs = !reglages.surplombs; sauverReglages(); app.maj(false); ruban(); }, { actif: reglages.surplombs, titre: 'Colorer en rouge les faces en surplomb de plus de 45°' });
    } else if (onglet === 'imprimer') {
      B(G('Contrôle'), 'controle', 'Volet de contrôle', () => { reglages.controle = !reglages.controle; sauverReglages(); majVolet(); ruban(); }, { actif: reglages.controle });
      const z = G('Aperçu des couches'), d = el('div', 'reglage'), l1 = el('div', 'ligne'), cas = el('input'), lab = el('label'), selc = el('select'), cur = el('input'), txt = el('div');
      cas.type = 'checkbox'; cas.checked = tranche !== null; lab.append(cas, ' Trancher la pièce');
      selc.innerHTML = '<option value="0.1">0,1 mm</option><option value="0.2">0,2 mm</option><option value="0.3">0,3 mm</option>'; selc.value = String(reglages.couche); selc.title = 'Hauteur de couche'; selc.setAttribute('aria-label', 'Hauteur de couche');
      cur.type = 'range'; cur.min = 1; cur.setAttribute('aria-label', 'Couche affichée');
      const montrer = () => {
        const n = analyse && !analyse.vide ? Math.max(1, analyse.couches) : 1; cur.max = n; cur.disabled = tranche === null;
        if (tranche !== null) { cur.value = tranche; txt.textContent = 'Couche ' + tranche + ' sur ' + n + ' · ' + nb(tranche * reglages.couche, 1) + ' mm'; }
        else txt.textContent = analyse && !analyse.vide ? n + ' couches de ' + nb(reglages.couche, 1) + ' mm' : 'Pièce vide';
      };
      cas.addEventListener('change', () => { tranche = cas.checked && analyse && !analyse.vide ? Math.max(1, Math.round(analyse.couches / 2)) : null; app.majDecor(); montrer(); });
      selc.addEventListener('change', () => { reglages.couche = +selc.value; sauverReglages(); const actif = tranche !== null; tranche = null; app.maj(false); if (actif && !analyse.vide) { tranche = Math.max(1, Math.round(analyse.couches / 2)); app.majDecor(); } montrer(); });
      cur.addEventListener('input', () => { tranche = +cur.value; app.majDecor(); montrer(); });
      l1.append(lab, selc); d.append(l1, cur, txt); z.appendChild(d); montrer();
      B(G('Imprimante'), 'imprimante', 'Mon imprimante', () => ouvrirFenetre('fenImprimante'));
      B(G('Fichier'), 'stl', 'Exporter en STL', exporter);
    } else {
      let z = G('Méthodes');
      B(z, 'livre', 'La méthode', () => { const t = T[o.type]; texte(t.methode, t.proto.comprendre || ''); }, { inactif: !o, titre: 'Expliquer la méthode de modélisation de l’élément sélectionné' });
      B(z, 'tableau', 'Comparer', () => ouvrirFenetre('fenComparer'));
      z = G('Application');
      B(z, 'aide', 'Prise en main', () => texte('Prise en main', AIDE));
      B(z, 'licence', 'À propos', () => texte('À propos de Model Educ Studio', APROPOS));
    }
    document.querySelectorAll('#onglets [data-onglet]').forEach(b => b.classList.toggle('actif', b.dataset.onglet === onglet));
    $('btnAnnuler').disabled = !annul.length; $('btnRetablir').disabled = !retab.length;
  }

  /* ---------- barre d'état, bulle, volet ---------- */
  function majEtat() {
    const o = selO();
    $('etMessage').textContent = outil ? 'Clique sur le plateau (ou sur un élément) pour poser : ' + T[outil].nom + ' — Échap pour annuler'
      : o ? '« ' + o.nom + ' » sélectionné — poignée bleue : déplacer · verte : monter · violette : tourner · Suppr : supprimer'
        : 'Clic : sélectionner · glisser : tourner la vue · clic droit ou Maj + glisser : déplacer la vue · molette : zoom';
    const c = $('consigne'); c.classList.toggle('montre', !!outil); c.textContent = outil ? 'Outil ' + T[outil].nom + ' : clique pour poser l’élément' : '';
    $('etCompte').textContent = P.objets.length + ' élément' + (P.objets.length > 1 ? 's' : '');
    $('nomProjet').textContent = '— ' + P.nom;
    document.title = P.nom + ' — Model Educ Studio';
  }
  let minuterie = 0;
  function dire(t, alerte) { const b = $('bulle'); b.textContent = t; b.className = 'montre' + (alerte ? ' alerte' : ''); clearTimeout(minuterie); minuterie = setTimeout(() => { b.className = ''; }, alerte ? 5200 : 3200); }
  function majVolet() { $('voletImp').classList.toggle('ferme', !reglages.controle); vue.demander(); }

  /* ---------- contrôle d'imprimabilité ---------- */
  function afficherAnalyse() {
    const a = analyse, v = $('verdict'), pu = $('etVerdict'), cm2 = x => nb(x / 100, 1) + ' cm²', lignes = [];
    const ligne = (nom, val, cls) => lignes.push('<dt>' + nom + '</dt><dd class="' + (cls || '') + '">' + val + '</dd>');
    const verdict = (cls, titre, detail) => { v.className = cls; v.innerHTML = titre + '<small>' + detail + '</small>'; pu.className = 'puce ' + cls; pu.lastElementChild.textContent = titre; };
    $('remarques').innerHTML = '';
    if (a.vide) { verdict('erreur', 'Aucune matière', 'Il n’y a aucun élément plein visible : rien à imprimer.'); $('mesures').innerHTML = ''; return; }
    if (a.rapide) verdict('alerte', 'Calcul en cours…', 'Le contrôle complet se fait quand tu relâches.');
    else {
      const pb = [], av = [];
      if (!a.etanche) pb.push('le maillage n’est pas étanche');
      if (a.volume <= 0) pb.push('le volume est nul ou retourné');
      if (a.horsPlateau) pb.push('la pièce dépasse du plateau');
      if (a.sousPlateau) pb.push('un élément passe sous le plateau');
      if (a.decolle) av.push('rien ne touche le plateau');
      if (a.pieces > 1) av.push(a.pieces + ' morceaux séparés');
      if (!a.decolle && a.contact < 100) av.push('très peu de contact avec le plateau (risque de décollement)');
      if (a.surplombAire > 50) av.push('surplombs : des supports seront nécessaires');
      if (pb.length) verdict('erreur', 'À corriger avant d’imprimer', pb.join(' ; ') + '.');
      else if (av.length) verdict('alerte', 'Imprimable, avec précautions', av.join(' ; ') + '.');
      else verdict('ok', 'Prête à imprimer', 'Maillage étanche, bien posée, sans support.');
      const s = n => n > 1 ? 's' : '';
      ligne('Maillage', a.etanche ? 'étanche' : [a.ouvertes ? a.ouvertes + ' arête' + s(a.ouvertes) + ' ouverte' + s(a.ouvertes) : '', a.nonVariete ? a.nonVariete + ' arête' + s(a.nonVariete) + ' à plus de 2 faces' : '', a.retournees ? a.retournees + ' face' + s(a.retournees) + ' à l’envers' : ''].filter(Boolean).join(', '), a.etanche ? 'bien' : 'mal');
    }
    ligne('Dimensions', nb(a.dims[0]) + ' × ' + nb(a.dims[1]) + ' × ' + nb(a.dims[2]) + ' mm', a.horsPlateau ? 'mal' : '');
    ligne('Volume', (a.recouvre ? '≈ ' : '') + nb(Math.abs(a.volume) / 1000, 1) + ' cm³');
    ligne('Masse PLA', '≈ ' + nb(a.masse, a.masse < 10 ? 1 : 0) + ' g');
    ligne('Surplombs', cm2(a.surplombAire), a.surplombAire > 50 ? 'moyen' : '');
    ligne('Contact', cm2(a.contact), a.contact < 100 ? 'moyen' : '');
    ligne('Morceaux', a.rapide ? '…' : (a.assembles ? '≈ ' : '') + a.pieces, !a.rapide && a.pieces > 1 ? 'moyen' : '');
    ligne('Triangles', a.nbTri.toLocaleString('fr-FR'));
    $('mesures').innerHTML = lignes.join('');
    const rem = notes.slice();
    if (a.recouvre) rem.push('Des éléments pleins se recouvrent. Le trancheur les soudera ; le volume et la masse comptent deux fois la partie commune. « Fusionner » (onglet Modifier) donne un seul maillage exact.');
    for (const t of rem) { const li = el('li'); li.textContent = t; $('remarques').appendChild(li); }
  }

  /* ---------- la vue : clics, survol, poignées ---------- */
  function viser(r) {
    let mieux = null;
    for (const o of P.objets) { if (o.vis === false || !cache(o).monde) continue; const h = M.rayon(cache(o).monde, r.o, r.d); if (h && (!mieux || h.t < mieux.t)) { mieux = h; mieux.o = o; } }
    return mieux;
  }
  function pointDePose(r) {
    const h = viser(r);
    if (h && h.n[2] > 0.5) return [Math.round(h.p[0]), Math.round(h.p[1]), Math.round(h.p[2] * 10) / 10];
    const p = M.rayonPlan(r, [0, 0, 0], [0, 0, 1]); if (!p || r.d[2] >= 0) return null;
    return [Math.round(p[0]), Math.round(p[1]), 0];
  }
  vue.surClic = (r, ev) => {
    if (outil) {
      const p = pointDePose(r); if (!p) return;
      const o = creer(outil, p); sel = o.id; outil = null; fantome = null; $('vue').style.cursor = 'default';
      app.valider(); app.panneau();
      if (onglet === 'creer') { /* on reste sur l'onglet : l'élève enchaîne les créations */ }
      return;
    }
    const h = viser(r), o = selO();
    if (h && h.o.id !== sel) return selectionner(h.o.id);
    if (o) { const i = inst(o); if (i.clic && (h || o.type === 'voxels')) return i.clic(rayonLocal(o, r), ev); }
    if (!h && sel !== null) selectionner(null);
  };
  vue.surSurvol = (r, ev) => {
    const p = M.rayonPlan(r, [0, 0, 0], [0, 0, 1]);
    $('etSouris').textContent = p && r.d[2] < 0 ? 'X ' + nb(p[0], 0) + ' · Y ' + nb(p[1], 0) + ' mm' : '';
    if (outil) { const q = pointDePose(r); if ((q && q.join()) !== (fantome && fantome.join())) { fantome = q; app.majDecor(); } return; }
    const o = selO(); if (o) { const i = inst(o); if (i.survol) i.survol(rayonLocal(o, r), ev); }
  };
  vue.surPoigneeDebut = id => {
    const o = selO(); if (!o) return;
    if (typeof id === 'string' && id.startsWith('__')) { glisse = { pos: o.pos.slice(), bas: cache(o).bb[0][2] }; return; }
    const i = inst(o); if (i.poigneeDebut) { i.poigneeDebut(id); app.majDecor(); }
  };
  vue.surPoigneeGlisse = (id, r, p0) => {
    const o = selO(); if (!o) return;
    if (id === '__xy') { const p = M.rayonPlan(r, p0, [0, 0, 1]); if (!p) return; o.pos[0] = Math.round(glisse.pos[0] + p[0] - p0[0]); o.pos[1] = Math.round(glisse.pos[1] + p[1] - p0[1]); app.maj(true); }
    else if (id === '__z') { const n = V.norm([r.avant[0], r.avant[1], 0]), p = M.rayonPlan(r, p0, n); if (!p) return; o.pos[2] = Math.max(glisse.pos[2] - glisse.bas, Math.round(glisse.pos[2] + p[2] - p0[2])); app.maj(true); }
    else if (id === '__r') { const p = M.rayonPlan(r, p0, [0, 0, 1]); if (!p) return; o.rot[2] = ((Math.round(Math.atan2(p[1] - o.pos[1], p[0] - o.pos[0]) * 180 / Math.PI / 5) * 5) % 360 + 360) % 360; app.maj(true); }
    else { const i = inst(o); if (i.poigneeGlisse) i.poigneeGlisse(id, rayonLocal(o, r), versLocal(o, p0)); }
  };
  vue.surPoigneeFin = (id, bouge) => {
    const o = selO(); if (!o) return;
    if (typeof id === 'string' && id.startsWith('__')) { glisse = null; app.valider(); app.panneau(); return; }
    const i = inst(o); if (i.poigneeFin) i.poigneeFin(id, bouge);
  };

  /* ---------- cube de vues ---------- */
  const cube = $('cubeCorps');
  for (const [k, lib, tr] of [['face', 'Face', ''], ['arriere', 'Arrière', 'rotateY(180deg)'], ['droite', 'Droite', 'rotateY(90deg)'], ['gauche', 'Gauche', 'rotateY(-90deg)'], ['dessus', 'Dessus', 'rotateX(90deg)'], ['', 'Dessous', 'rotateX(-90deg)']]) {
    const b = el('button', '', lib); b.type = 'button'; b.style.transform = tr + ' translateZ(28px)';
    if (k) { b.title = 'Vue : ' + lib; b.addEventListener('click', () => allerVue(k)); } else { b.disabled = true; b.tabIndex = -1; }
    cube.appendChild(b);
  }
  let azVu = null, elVu = null;
  (function suivre() {
    const c = vue.cam;
    if (c.az !== azVu || c.el !== elVu) { azVu = c.az; elVu = c.el; cube.style.transform = 'rotateX(' + (-c.el) + 'rad) rotateY(' + (-(c.az + Math.PI / 2)) + 'rad)'; }
    requestAnimationFrame(suivre);
  })();
  $('cubeIso').addEventListener('click', () => allerVue('iso'));

  /* ---------- fichiers ---------- */
  function telecharger(nom, donnees, type) {
    const url = URL.createObjectURL(new Blob([donnees], { type })), a = el('a');
    a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const nomFichier = () => (P.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projet');
  function exporter() {
    if (!analyse || analyse.vide) return dire('Rien à exporter : aucun élément plein visible.', true);
    telecharger(nomFichier() + '.stl', M.stl(piece), 'model/stl');
    dire(analyse.etanche ? 'Fichier STL enregistré (unités : mm).' : 'STL enregistré, mais le maillage n’est pas étanche : le trancheur risque de le refuser.', !analyse.etanche);
  }
  const enregistrer = () => { telecharger(nomFichier() + '.modeleduc.json', JSON.stringify({ format: 'model-educ-studio', version: 1, projet: P }), 'application/json'); dire('Projet enregistré dans tes téléchargements.'); };
  /* Un fichier ouvert peut être abîmé ou venir d'ailleurs : on ne garde que ce qui se reconstruit. */
  function verifier(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.objets)) return null;
    const bon = { nom: typeof p.nom === 'string' && p.nom.trim() ? p.nom.trim().slice(0, 60) : 'Sans titre', n: 0, objets: [] }; let rejets = 0;
    const trois = t => Array.isArray(t) && t.length === 3 && t.every(x => typeof x === 'number' && isFinite(x) && Math.abs(x) < 1e5);
    for (const o of p.objets.slice(0, 200)) {
      const t = o && T[o.type]; let ok = !!t && o.etat && typeof o.etat === 'object' && trois(o.pos) && trois(o.rot);
      if (ok) { try { const i = Object.create(t.proto); i.etat = copie(o.etat); if (i.apresChargement) i.apresChargement(); const m = i.construire(true); ok = !!m && m.v.length % 3 === 0 && m.f.length % 3 === 0 && m.v.every(x => typeof x === 'number' && isFinite(x)) && m.f.every(x => Number.isInteger(x) && x >= 0 && x < m.v.length / 3); } catch (e) { ok = false; } }
      if (!ok) { rejets++; continue; }
      bon.objets.push({ id: ++bon.n, nom: typeof o.nom === 'string' && o.nom.trim() ? o.nom.trim().slice(0, 40) : t.nom, type: o.type, etat: copie(o.etat), pos: o.pos.slice(), rot: o.rot.slice(), role: o.role === 'creux' ? 'creux' : 'plein', vis: o.vis !== false, coul: Number.isInteger(o.coul) ? Math.abs(o.coul) % COULEURS.length : 0 });
    }
    bon.rejets = rejets; return bon;
  }
  $('fichierOuvrir').addEventListener('change', ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    if (f.size > 20e6) return dire('Ce fichier est trop gros pour être un projet Model Educ Studio.', true);
    const lecteur = new FileReader();
    lecteur.onload = () => {
      let p = null; try { const d = JSON.parse(lecteur.result); p = verifier(d && d.format === 'model-educ-studio' ? d.projet : null); } catch (e) { p = null; }
      if (!p) return dire('Ce fichier n’est pas un projet Model Educ Studio : rien n’a été changé.', true);
      const rejets = p.rejets; delete p.rejets; installer(p, true); fermerFenetres();
      dire(rejets ? 'Projet ouvert. ' + rejets + ' élément' + (rejets > 1 ? 's illisibles ont été écartés.' : ' illisible a été écarté.') : 'Projet ouvert.', !!rejets);
    };
    lecteur.onerror = () => dire('Le fichier n’a pas pu être lu.', true);
    lecteur.readAsText(f);
  });

  const EXEMPLES = [
    { nom: 'Support percé', texte: 'un pavé, une nervure et deux perçages : les opérations booléennes',
      faire() { let o = creer('pave'); o.nom = 'Semelle'; o.etat = { lx: 70, ly: 40, lz: 10 }; o = creer('pave', [0, 0, 10]); o.nom = 'Nervure'; o.etat = { lx: 8, ly: 40, lz: 24 };
        for (const x of [-22, 22]) { o = creer('cylindre', [x, 0, -2]); o.nom = 'Perçage ' + (x < 0 ? 1 : 2); o.etat = { d: 8, h: 14, n: 32 }; o.role = 'creux'; } } },
    { nom: 'Vase sur son socle', texte: 'une courbe NURBS tournée autour d’un axe, posée sur un prisme',
      faire() { let o = creer('prisme'); o.nom = 'Socle'; o.etat = { d: 76, h: 6, n: 8 }; o = creer('revolution', [0, 0, 6]); o.nom = 'Vase'; } },
    { nom: 'Trois méthodes côte à côte', texte: 'une équerre paramétrique, une forme subdivisée, des boules qui fusionnent',
      faire() { creer('equerre', [-70, 0, 0]); creer('subdivision', [0, 0, 0]); creer('boules', [70, 0, 0]); } }
  ];
  function nouveau(nom, faire) { const p = { nom, n: 0, objets: [] }; P = p; if (faire) faire(); installer(P, true); fermerFenetres(); }
  const confirmer = () => !P.objets.length || window.confirm('Le projet en cours sera remplacé. Continuer ?\n(Enregistre-le d’abord si tu veux le garder.)');

  /* ---------- menu Fichier, onglets, fenêtres ---------- */
  function ouvrirFenetre(id) { $(id).classList.add('ouvert'); const b = $(id).querySelector('[data-fermer], button'); if (b) b.focus(); }
  function fermerFenetres() { document.querySelectorAll('.voile.ouvert').forEach(v => v.classList.remove('ouvert')); }
  function texte(titre, html) { $('fenTexteTitre').textContent = titre; $('fenTexteCorps').innerHTML = html; ouvrirFenetre('fenTexte'); }
  document.querySelectorAll('.voile').forEach(v => v.addEventListener('click', e => { if ((e.target === v && v.id !== 'fenAccueil') || e.target.hasAttribute('data-fermer')) v.classList.remove('ouvert'); }));
  const AIDE = `
<p><b>1. Créer.</b> Dans l’onglet <b>Créer</b>, clique un outil (Pavé, Révolution, Voxels…), puis clique sur le plateau : l’élément est posé là. Un clic sur le dessus d’un élément pose le nouveau dessus.</p>
<p><b>2. Régler.</b> L’élément sélectionné montre ses réglages dans la fenêtre <b>Propriétés</b>, à gauche : nom, rôle, position, puis sa forme. Les points de contrôle, les faces ou les cubes se manipulent directement dans la vue.</p>
<p><b>3. Placer.</b> Dans la vue, la poignée <b>bleue</b> déplace l’élément sur le plateau, la <b>verte</b> le monte, la <b>violette</b> le fait tourner.</p>
<p><b>4. Percer et assembler.</b> Onglet <b>Modifier</b> : un élément passé en <b>Perçage</b> enlève de la matière aux éléments pleins qu’il traverse. <b>Fusionner</b> remplace tous les éléments par un seul maillage.</p>
<p><b>5. Regarder.</b> Glisser : tourner la vue. Clic droit ou <kbd>Maj</kbd> + glisser : déplacer la vue. Molette : zoom. Le <b>cube</b> en haut à droite donne les vues de face, de dessus, de côté.</p>
<p><b>6. Imprimer.</b> Le volet <b>Impression 3D</b> dit si la pièce est imprimable. L’onglet <b>Imprimer</b> montre les couches et exporte le fichier STL.</p>
<p><b>Raccourcis.</b> <kbd>Ctrl</kbd> + <kbd>Z</kbd> annuler · <kbd>Ctrl</kbd> + <kbd>Y</kbd> rétablir · <kbd>Ctrl</kbd> + <kbd>D</kbd> dupliquer · <kbd>Suppr</kbd> supprimer · <kbd>F</kbd> cadrer · <kbd>Échap</kbd> lâcher l’outil ou la sélection.</p>`;
  const APROPOS = `
<p><b>Model Educ Studio est un outil pédagogique, pas un logiciel professionnel.</b> Il fait manipuler, dans une interface à ruban, sept méthodes de modélisation 3D et les règles de base de l’impression 3D. Il ne remplace ni un logiciel de CAO (Fusion 360, FreeCAD, Blender, Revit…), ni un trancheur (Cura, PrusaSlicer, Bambu Studio).</p>
<p><b>Ce que le contrôle vérifie.</b> Maillage étanche, dimensions et plateau, volume, surplombs à plus de 45°, surface de contact, morceaux séparés. <b>Ce qu’il ne vérifie pas :</b> l’épaisseur minimale des parois, les faces qui se traversent, les ponts. La masse est un ordre de grandeur (PLA à 1,24 g/cm³, coque de 0,8 mm, remplissage à 15 %).</p>
<p><b>Limites des perçages et de la fusion.</b> Ces opérations booléennes sont calculées dans la page ; au-delà de ${LIMITE.toLocaleString('fr-FR')} triangles, elles ne sont pas appliquées et l’application le dit.</p>
<p><b>Fichiers.</b> L’export STL est en millimètres. Le projet est gardé dans ce navigateur, sur cet ordinateur seulement ; « Enregistrer le projet » en fait un fichier. Rien n’est envoyé sur Internet.</p>
<p><b>Fonctionnement.</b> Tout est calculé dans la page, sans bibliothèque extérieure : l’application marche aussi hors ligne, en ouvrant index.html.</p>
<p>Sur une idée de <b>Jean-Philippe Amat</b>, lycée Urbain Vitry, Toulouse · Créateur : Claude. Licence Creative Commons <b>CC BY-NC-SA 4.0</b> : partage et adaptation autorisés, avec mention de l’auteur, sans usage commercial, sous la même licence.</p>`;

  const menu = $('menuFichier');
  const fermerMenu = () => { menu.classList.remove('ouvert'); $('btnFichier').setAttribute('aria-expanded', 'false'); };
  const entree = (lib, raccourci, fn) => { const b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.append(lib); if (raccourci) b.appendChild(el('small', '', raccourci)); b.addEventListener('click', () => { fermerMenu(); fn(); }); menu.appendChild(b); };
  entree('Nouveau projet', '', () => { if (confirmer()) nouveau('Sans titre'); });
  entree('Ouvrir un fichier…', '.json', () => { if (confirmer()) $('fichierOuvrir').click(); });
  entree('Enregistrer le projet', '.json', enregistrer);
  menu.appendChild(el('hr')); menu.appendChild(el('div', 'rubrique', 'Exemples'));
  for (const ex of EXEMPLES) entree(ex.nom, '', () => { if (confirmer()) nouveau(ex.nom, ex.faire); });
  menu.appendChild(el('hr'));
  entree('Exporter en STL', 'pour le trancheur', exporter);
  menu.appendChild(el('hr'));
  entree('Écran d’ouverture', '', ouvrirAccueil);
  entree('À propos et licence', '', () => texte('À propos de Model Educ Studio', APROPOS));
  $('btnFichier').addEventListener('click', e => { e.stopPropagation(); const ouvert = menu.classList.toggle('ouvert'); $('btnFichier').setAttribute('aria-expanded', ouvert); if (ouvert) menu.querySelector('button').focus(); });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) fermerMenu(); });

  const barre = $('onglets'), avant = barre.querySelector('.titre');
  for (const [k, lib] of ONGLETS) { const b = el('button', '', lib); b.type = 'button'; b.dataset.onglet = k; b.addEventListener('click', () => { onglet = k; ruban(); }); barre.insertBefore(b, avant); }
  $('btnAnnuler').addEventListener('click', annuler); $('btnRetablir').addEventListener('click', retablir);
  $('exporter').addEventListener('click', exporter);
  $('etLicence').addEventListener('click', () => texte('À propos de Model Educ Studio', APROPOS));

  window.addEventListener('keydown', e => {
    const saisie = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName), k = e.key.toLowerCase();
    if (e.key === 'Escape') { if (menu.classList.contains('ouvert')) return fermerMenu(); if (document.querySelector('.voile.ouvert:not(#fenAccueil)')) return fermerFenetres(); if (outil) return prendreOutil(null); if (sel !== null && !saisie) selectionner(null); return; }
    if (saisie || document.querySelector('.voile.ouvert')) return;
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); annuler(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); retablir(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); commande('dupliquer'); }
    else if (e.key === 'Delete') commande('supprimer');
    else if (k === 'f' && !e.ctrlKey && !e.metaKey) app.cadrer(!!selO());
  });

  /* tableau de comparaison */
  const COMPARER = [
    ['Solides et booléens', 'Pavé, Cylindre, Cône, Sphère, Tore, Prisme + Perçage, Fusionner', 'Des solides simples unis ou soustraits', 'Supports, boîtiers, pièces percées', 'Formes souples', 'Tinkercad, OpenSCAD'],
    ['Courbes NURBS', 'Révolution', 'Des courbes pilotées par des points de contrôle', 'Vase, carrosserie, objet design', 'Formes ramifiées', 'Rhino, Alias, Fusion 360'],
    ['Maillage polygonal', 'Polygones', 'Des sommets, des arêtes et des faces déplacés à la main', 'Objets à facettes, retouche de STL', 'Cotes non pilotées', 'Blender, SketchUp'],
    ['Subdivision de surface', 'Subdivision', 'Une cage grossière adoucie par le calcul', 'Formes organiques, poignées', 'Cotes précises', 'Blender, Maya, 3ds Max'],
    ['Surfaces implicites', 'Boules, Gyroïde', 'Une formule qui dit « dedans » ou « dehors »', 'Formes qui fusionnent, treillis', 'Arêtes vives', 'nTop, métaballes de Blender'],
    ['Volumique (voxels)', 'Voxels', 'Des petits cubes pleins ou vides', 'Volumes scannés, sculpture par blocs', 'Courbes en escalier', 'MagicaVoxel, imagerie médicale'],
    ['Paramétrique', 'Équerre, Boîte, Roue dentée', 'Des cotes, des relations, un arbre de construction', 'Pièces mécaniques, familles de pièces', 'Demande de prévoir la construction', 'SolidWorks, Onshape, FreeCAD, Revit']
  ];
  $('tableComparer').innerHTML = '<thead><tr><th>Méthode</th><th>Outils du ruban</th><th>On décrit la pièce par…</th><th>Idéale pour</th><th>Moins à l’aise pour</th><th>Vrais logiciels</th></tr></thead><tbody>' + COMPARER.map(l => '<tr>' + l.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody>';

  /* imprimante */
  function majPlateau() {
    const pl = reglages.plateau; vue.plateau(pl[0], pl[1]);
    $('plX').value = pl[0]; $('plY').value = pl[1]; $('plZ').value = pl[2];
    const s = $('choixPlateau'), v = pl.join(','); s.value = [...s.options].some(o => o.value === v) ? v : 'perso';
  }
  $('choixPlateau').addEventListener('change', e => { if (e.target.value !== 'perso') { reglages.plateau = e.target.value.split(',').map(Number); sauverReglages(); majPlateau(); app.maj(false); app.panneau(); } });
  ['plX', 'plY', 'plZ'].forEach((id, k) => $(id).addEventListener('change', e => { reglages.plateau[k] = Math.min(500, Math.max(50, Math.round(+e.target.value) || 220)); sauverReglages(); majPlateau(); app.maj(false); app.panneau(); }));

  /* écran d'ouverture */
  function ouvrirAccueil() {
    const garde = P.objets.length > 0;
    $('accReprendre').style.display = garde ? '' : 'none';
    $('accReprendreTexte').textContent = '« ' + P.nom + ' », ' + P.objets.length + ' élément' + (P.objets.length > 1 ? 's' : '') + ' gardé' + (P.objets.length > 1 ? 's' : '') + ' dans ce navigateur';
    ouvrirFenetre('fenAccueil'); (garde ? $('accReprendre') : $('accNouveau')).focus();
  }
  $('accNouveau').addEventListener('click', () => { if (confirmer()) nouveau('Sans titre'); });
  $('accReprendre').addEventListener('click', fermerFenetres);
  for (const ex of EXEMPLES) { const b = el('button', '', '<b>' + ex.nom + '</b><span>' + ex.texte + '</span>'); b.type = 'button'; b.addEventListener('click', () => { if (confirmer()) nouveau(ex.nom, ex.faire); }); $('accExemples').appendChild(b); }

  /* ---------- démarrage ---------- */
  majPlateau(); majVolet();
  const garde = verifier(lire('projet'));
  if (garde) delete garde.rejets;
  installer(garde || { nom: 'Sans titre', n: 0, objets: [] }, true);
  ouvrirAccueil();

  /* pour les essais */
  app.essai = { etat: () => ({ P, sel, outil, onglet, analyse, notes, piece, annul: annul.length, retab: retab.length }), creer, selectionner, commande, installer, nouveau, verifier, EXEMPLES, prendreOutil, allerVue, cache, obj, setOnglet: k => { onglet = k; ruban(); } };
})(globalThis.ME = globalThis.ME || {});
