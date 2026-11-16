/* Model Educ Studio — réparer un maillage importé.
   Un maillage imprimable est « étanche » : chaque arête sépare exactement deux triangles, parcourus en sens opposés.
   Un STL venu d'un logiciel d'architecture ne l'est presque jamais tel quel : ses murs, dalles et poteaux sont des
   volumes fermés posés les uns contre les autres. Là où ils se touchent, une même arête porte 4 triangles ou plus.
   Les outils d'ici travaillent sur un maillage { v, f } et en rendent un nouveau, sans rien changer à l'ancien :
     souder   : réunir les sommets qui ont les mêmes coordonnées ;
     nettoyer : ôter les triangles écrasés et les triangles en double ;
     separer  : détacher les volumes qui se touchent, chacun redevenant une coque fermée ;
     orienter : remettre à l'endroit les triangles retournés ;
     boucher  : fermer les petits trous. */
(function (ME) {
  'use strict';
  const R = ME.R = {};

  /* demi-arêtes : la demi-arête h = 3 t + k va du sommet f[h] au sommet f[3 t + (k + 1) % 3].
     tete : clé d'arête → première demi-arête ; suiv : chaînage des demi-arêtes d'une même arête. */
  function aretes(m) {
    const f = m.f, nv = m.v.length / 3, tete = new Map(), suiv = new Int32Array(f.length).fill(-1);
    for (let h = 0; h < f.length; h++) {
      const a = f[h], b = f[h - h % 3 + (h + 1) % 3], cle = a < b ? a * nv + b : b * nv + a, p = tete.get(cle);
      if (p !== undefined) suiv[h] = p;
      tete.set(cle, h);
    }
    return { tete, suiv };
  }
  const autre = (f, h) => f[h - h % 3 + (h + 1) % 3], troisieme = (f, h) => f[h - h % 3 + (h + 2) % 3];

  /* ---------- diagnostic : compter les défauts et rendre les arêtes fautives, pour les montrer ---------- */
  R.diagnostic = function (m) {
    const v = m.v, f = m.f, { tete, suiv } = aretes(m), ouv = [], mul = [], ret = []; let partagees = 0;
    const seg = (t, h) => { const a = f[h] * 3, b = autre(f, h) * 3; t.push(v[a], v[a + 1], v[a + 2], v[b], v[b + 1], v[b + 2]); };
    for (const h0 of tete.values()) {
      let n = 0, sens = 0;
      for (let h = h0; h >= 0; h = suiv[h]) { n++; sens += f[h] < autre(f, h) ? 1 : -1; }
      if (n === 1) seg(ouv, h0);
      else if (n > 2) { if (sens === 0) partagees++; else seg(mul, h0); }   // autant d'allers que de retours : des volumes fermés qui se touchent
      else if (sens !== 0) seg(ret, h0);
    }
    return { ouvertes: ouv.length / 6, multiples: mul.length / 6, retournees: ret.length / 6, partagees, segOuvertes: ouv, segMultiples: mul, segRetournees: ret,
      triangles: f.length / 3, etanche: !ouv.length && !mul.length && !ret.length };
  };

  /* le pas de soudure suit la taille de la pièce (un millionième de sa plus grande dimension) : une maquette
     de bâtiment réduite a des barreaux de garde-corps de quelques centièmes de millimètre */
  R.pas = function (m) {
    const v = m.v, mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < v.length; i++) { const k = i % 3; if (v[i] < mn[k]) mn[k] = v[i]; if (v[i] > mx[k]) mx[k] = v[i]; }
    return Math.max(1e-9, Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) * 1e-6);
  };
  /* ---------- souder : un seul sommet par position ---------- */
  R.souder = function (m, pas) {
    const v = m.v, f = m.f, carte = new Map(), nv = [], idx = new Int32Array(v.length / 3), q = pas || 1e-3;
    for (let i = 0; i < v.length; i += 3) {
      const kx = Math.round(v[i] / q), ky = Math.round(v[i + 1] / q), kz = Math.round(v[i + 2] / q), x = kx * q, y = ky * q, z = kz * q, cle = kx + ',' + ky + ',' + kz;
      let id = carte.get(cle); if (id === undefined) { id = nv.length / 3; carte.set(cle, id); nv.push(x, y, z); }
      idx[i / 3] = id;
    }
    const nf = new Array(f.length); for (let i = 0; i < f.length; i++) nf[i] = idx[f[i]];
    return { v: nv, f: nf, soudes: v.length / 3 - nv.length / 3 };
  };

  /* ---------- nettoyer : triangles écrasés (deux sommets confondus ou aire nulle) et triangles en double ---------- */
  R.nettoyer = function (m, garderDoubles) {
    const v = m.v, f = m.f, nv = v.length / 3, vus = new Set(), nf = []; let ecrases = 0, doubles = 0;
    for (let t = 0; t < f.length; t += 3) {
      const a = f[t], b = f[t + 1], c = f[t + 2];
      if (a === b || b === c || a === c) { ecrases++; continue; }
      const ux = v[b * 3] - v[a * 3], uy = v[b * 3 + 1] - v[a * 3 + 1], uz = v[b * 3 + 2] - v[a * 3 + 2], wx = v[c * 3] - v[a * 3], wy = v[c * 3 + 1] - v[a * 3 + 1], wz = v[c * 3 + 2] - v[a * 3 + 2];
      if (Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) < 1e-9) { ecrases++; continue; }
      /* même triangle, même sens de parcours : on tourne les trois sommets pour commencer par le plus petit */
      const p = a < b && a < c ? [a, b, c] : b < c ? [b, c, a] : [c, a, b], cle = (p[0] * nv + p[1]) + ':' + p[2];
      if (vus.has(cle)) { doubles++; if (!garderDoubles) continue; }
      vus.add(cle); nf.push(a, b, c);
    }
    return { v, f: nf, ecrases, doubles };
  };

  /* ---------- recoudre les « sommets en T » ----------
     Deux faces voisines n'ont pas toujours été découpées pareil : l'une a une grande arête a-b, l'autre deux petites
     a-p et p-b. À l'œil c'est fermé, mais les arêtes ne se correspondent pas. On coupe le triangle de la grande
     arête en passant par p. On ne regarde que les arêtes déséquilibrées, et les sommets qui les bordent. */
  R.recoudre = function (m, tol) {
    const v = m.v, nv = v.length / 3, tol2 = (tol || 0.003) * (tol || 0.003); let f = m.f, coupes = 0;
    for (let tour = 0; tour < 12; tour++) {
      const compte = new Map();
      for (let h = 0; h < f.length; h++) { const a = f[h], b = autre(f, h), cle = a < b ? a * nv + b : b * nv + a; compte.set(cle, (compte.get(cle) || 0) + (a < b ? 1 : -1)); }
      const libres = new Set();
      for (let h = 0; h < f.length; h++) { const a = f[h], b = autre(f, h); if (compte.get(a < b ? a * nv + b : b * nv + a) !== 0) { libres.add(a); libres.add(b); } }
      if (!libres.size || libres.size > 20000) break;                 // trop de défauts : ce n'est plus du recousage
      const cand = [...libres], nf = []; let change = false;
      for (let t = 0; t < f.length; t += 3) {
        let coupe = false;
        for (let k = 0; k < 3 && !coupe; k++) {
          const a = f[t + k], b = f[t + (k + 1) % 3], c = f[t + (k + 2) % 3];
          if (compte.get(a < b ? a * nv + b : b * nv + a) === 0) continue;
          const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2], dx = v[b * 3] - ax, dy = v[b * 3 + 1] - ay, dz = v[b * 3 + 2] - az, l2 = dx * dx + dy * dy + dz * dz, sur = [];
          if (l2 < 1e-12) continue;
          for (const p of cand) {
            if (p === a || p === b || p === c) continue;
            const px = v[p * 3] - ax, py = v[p * 3 + 1] - ay, pz = v[p * 3 + 2] - az, u = (px * dx + py * dy + pz * dz) / l2;
            if (u <= 1e-6 || u >= 1 - 1e-6) continue;
            const ex = px - u * dx, ey = py - u * dy, ez = pz - u * dz;
            if (ex * ex + ey * ey + ez * ez < tol2) sur.push([u, p]);
          }
          if (sur.length) { sur.sort((x, y) => x[0] - y[0]); let prec = a; for (const [, p] of sur) { nf.push(prec, p, c); prec = p; } nf.push(prec, b, c); coupe = change = true; coupes += sur.length; }
        }
        if (!coupe) nf.push(f[t], f[t + 1], f[t + 2]);
      }
      f = nf; if (!change) break;
    }
    return { v, f, coupes };
  };

  /* ---------- séparer les volumes qui se touchent ----------
     Autour d'une arête qui porte plus de deux triangles, on range les triangles par angle. La matière d'un volume
     est comprise entre un triangle qui « ouvre » (il parcourt l'arête à l'envers) et le triangle suivant qui
     « ferme » (il la parcourt à l'endroit) : on les marie comme des parenthèses. Chaque couple devient l'arête
     d'une coque, et chaque coque reçoit ses propres sommets. */
  R.separer = function (m) {
    const v = m.v, f = m.f, nt = f.length / 3, { tete, suiv } = aretes(m), voisin = new Int32Array(f.length).fill(-1);
    let mariees = 0;
    for (const h0 of tete.values()) {
      const h1 = suiv[h0];
      if (h1 < 0) continue;                                             // arête ouverte : pas de voisin
      if (suiv[h1] < 0) { voisin[h0] = h1; voisin[h1] = h0; continue; }  // deux triangles : le cas normal
      const a = Math.min(f[h0], autre(f, h0)), b = Math.max(f[h0], autre(f, h0));
      const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2]; let dx = v[b * 3] - ax, dy = v[b * 3 + 1] - ay, dz = v[b * 3 + 2] - az;
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      /* deux axes perpendiculaires à l'arête : u quelconque, w = d × u (les angles tournent autour de l'arête) */
      let ux = Math.abs(dx) < 0.9 ? 1 : 0, uy = ux ? 0 : 1, uz = 0; const k = ux * dx + uy * dy + uz * dz;
      ux -= k * dx; uy -= k * dy; uz -= k * dz; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
      const wx = dy * uz - dz * uy, wy = dz * ux - dx * uz, wz = dx * uy - dy * ux, liste = [];
      for (let h = h0; h >= 0; h = suiv[h]) {
        const c = troisieme(f, h) * 3, px = v[c] - ax, py = v[c + 1] - ay, pz = v[c + 2] - az;
        liste.push({ h, ang: Math.atan2(px * wx + py * wy + pz * wz, px * ux + py * uy + pz * uz), ferme: f[h] === a, pris: false, pile: false });
      }
      /* à angle égal : on ferme avant d'ouvrir (deux volumes qui se touchent) ; et deux copies exactes du même volume
         restent chacune avec ses triangles (les « ouvre » dans l'ordre du fichier, les « ferme » dans l'ordre inverse) */
      liste.sort((p, q) => Math.abs(p.ang - q.ang) > 1e-7 ? p.ang - q.ang : p.ferme !== q.ferme ? (p.ferme ? -1 : 1) : p.ferme ? q.h - p.h : p.h - q.h);
      const pile = [], n = liste.length;
      for (let i = 0; i < 2 * n; i++) {
        const e = liste[i % n]; if (e.pris) continue;
        if (!e.ferme) { if (!e.pile) { e.pile = true; pile.push(e); } }
        else if (pile.length) { const o = pile.pop(); o.pris = e.pris = true; voisin[o.h] = e.h; voisin[e.h] = o.h; }
      }
      mariees++;
    }
    /* les coques : groupes de triangles reliés par leurs arêtes mariées */
    const coque = new Int32Array(nt).fill(-1), file = new Int32Array(nt); let nc = 0;
    for (let t0 = 0; t0 < nt; t0++) {
      if (coque[t0] >= 0) continue;
      let debut = 0, fin = 0; file[fin++] = t0; coque[t0] = nc;
      while (debut < fin) { const t = file[debut++]; for (let k = 0; k < 3; k++) { const o = voisin[t * 3 + k]; if (o >= 0) { const u = (o - o % 3) / 3; if (coque[u] < 0) { coque[u] = nc; file[fin++] = u; } } } }
      nc++;
    }
    /* À chaque « éventail » de triangles son sommet : autour d'un sommet, les triangles reliés de proche en proche
       par leurs arêtes mariées gardent le même sommet ; les autres en reçoivent une copie. Deux volumes qui se
       touchent, ou un volume qui se touche lui-même le long d'une arête, sont ainsi détachés. */
    const coin = new Int32Array(f.length); for (let h = 0; h < f.length; h++) coin[h] = h;
    const rac = h => { while (coin[h] !== h) { coin[h] = coin[coin[h]]; h = coin[h]; } return h; };
    const lier = (p, q) => { p = rac(p); q = rac(q); if (p !== q) coin[p] = q; };
    const apres = h => h - h % 3 + (h + 1) % 3;
    for (let h = 0; h < f.length; h++) {
      const o = voisin[h]; if (o < h) continue;                      // chaque couple une seule fois (et o = -1 : rien)
      if (f[h] === f[o]) { lier(h, o); lier(apres(h), apres(o)); }   // triangle voisin à l'envers : mêmes départs
      else { lier(h, apres(o)); lier(apres(h), o); }
    }
    const carte = new Map(), nvv = [], nf = new Array(f.length);
    for (let h = 0; h < f.length; h++) {
      const r = rac(h); let id = carte.get(r);
      if (id === undefined) { id = nvv.length / 3; carte.set(r, id); const s = f[h] * 3; nvv.push(v[s], v[s + 1], v[s + 2]); }
      nf[h] = id;
    }
    const ouverte = new Uint8Array(nc); for (let h = 0; h < f.length; h++) if (voisin[h] < 0) ouverte[coque[(h - h % 3) / 3]] = 1;
    return { v: nvv, f: nf, coques: nc, aretes: mariees, coqueDe: coque, ouverte };
  };

  /* ---------- ôter les volumes en double ----------
     Un export contient souvent deux fois le même objet, exactement au même endroit. m est le maillage soudé,
     coqueDe dit à quelle coque appartient chaque triangle : deux coques faites des mêmes triangles = un double. */
  R.sansDoubles = function (m, sep) {
    const f = m.f, nv = m.v.length / 3, nc = sep.coques, cq = sep.coqueDe, nb = new Int32Array(nc), s1 = new Float64Array(nc), s2 = new Float64Array(nc);
    for (let t = 0; t < cq.length; t++) {
      const a = f[t * 3], b = f[t * 3 + 1], c = f[t * 3 + 2], p = a < b && a < c ? [a, b, c] : b < c ? [b, c, a] : [c, a, b], k = cq[t];
      nb[k]++; s1[k] += (p[0] * 7919 + p[1] * 104729 + p[2] * 1299709) % 2147483647; s2[k] += ((p[0] + 1) * (p[1] + 3)) % 1000003 + p[2] / (nv + 1);
    }
    const vues = new Set(), oter = new Uint8Array(nc); let coques = 0;
    for (let k = 0; k < nc; k++) { const cle = nb[k] + ':' + s1[k] + ':' + s2[k]; if (vues.has(cle)) { oter[k] = 1; coques++; } else vues.add(cle); }
    /* dans une coque restée ouverte, un triangle qui existe déjà ailleurs, dans le même sens, est un double isolé */
    const cleTri = t => { const a = f[t * 3], b = f[t * 3 + 1], c = f[t * 3 + 2], p = a < b && a < c ? [a, b, c] : b < c ? [b, c, a] : [c, a, b]; return (p[0] * nv + p[1]) + ':' + p[2]; };
    const gardes = new Set(), oterTri = new Uint8Array(cq.length); let triangles = 0;
    for (let t = 0; t < cq.length; t++) { if (oter[cq[t]]) { oterTri[t] = 1; triangles++; } else if (!sep.ouverte[cq[t]]) gardes.add(cleTri(t)); }
    for (let t = 0; t < cq.length; t++) { if (oterTri[t] || !sep.ouverte[cq[t]]) continue; const c = cleTri(t); if (gardes.has(c)) { oterTri[t] = 1; triangles++; } else gardes.add(c); }
    if (!triangles) return { v: sep.v, f: sep.f, coques: 0, triangles: 0 };
    /* on garde les autres triangles, et seulement les sommets qui servent encore */
    const carte = new Map(), nvv = [], nf = [];
    for (let t = 0; t < cq.length; t++) {
      if (oterTri[t]) continue;
      for (let k = 0; k < 3; k++) { const i = sep.f[t * 3 + k]; let id = carte.get(i); if (id === undefined) { id = nvv.length / 3; carte.set(i, id); nvv.push(sep.v[i * 3], sep.v[i * 3 + 1], sep.v[i * 3 + 2]); } nf.push(id); }
    }
    return { v: nvv, f: nf, coques, triangles };
  };

  /* ---------- remettre les triangles à l'endroit ----------
     Dans chaque coque, deux triangles voisins doivent parcourir leur arête commune en sens opposés : on part d'un
     triangle et on retourne de proche en proche ceux qui ne suivent pas. Puis, si la coque entière a un volume
     négatif, c'est qu'elle est tout entière à l'envers : on la retourne. */
  R.orienter = function (m) {
    const v = m.v, f = m.f.slice(), nt = f.length / 3, { tete, suiv } = aretes({ v, f }), voisin = new Int32Array(f.length).fill(-1);
    for (const h0 of tete.values()) { const h1 = suiv[h0]; if (h1 >= 0 && suiv[h1] < 0) { voisin[h0] = h1; voisin[h1] = h0; } }
    const vu = new Uint8Array(nt), inverse = new Uint8Array(nt), file = new Int32Array(nt); let retournes = 0, coquesRetournees = 0;
    const volume = t => { const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3; return (v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) + v[a + 1] * (v[b + 2] * v[c] - v[b] * v[c + 2]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c])) / 6; };
    for (let t0 = 0; t0 < nt; t0++) {
      if (vu[t0]) continue;
      let debut = 0, fin = 0, vol = 0, nInv = 0, fermee = true; file[fin++] = t0; vu[t0] = 1;
      while (debut < fin) {
        const t = file[debut++];
        for (let k = 0; k < 3; k++) {
          const h = t * 3 + k, o = voisin[h]; if (o < 0) { fermee = false; continue; }
          const u = (o - o % 3) / 3; if (vu[u]) continue;
          /* les deux demi-arêtes vont-elles dans le même sens ? (en tenant compte de ce qu'on a déjà décidé de retourner) */
          const memeSens = (m.f[h] === m.f[o]) !== (inverse[t] === 1);
          inverse[u] = memeSens ? 1 : 0; vu[u] = 1; file[fin++] = u; if (inverse[u]) nInv++;
        }
      }
      for (let i = 0; i < fin; i++) { const t = file[i]; if (inverse[t]) { const x = f[t * 3 + 1]; f[t * 3 + 1] = f[t * 3 + 2]; f[t * 3 + 2] = x; } vol += volume(t); }
      if (nInv > fin / 2) nInv = fin - nInv;                    // on avait pris pour modèle un triangle à l'envers
      if (fermee && vol < -1e-9) { /* une surface ouverte n'a pas de volume : on ne peut pas dire qu'elle est à l'envers */ for (let i = 0; i < fin; i++) { const t = file[i], x = f[t * 3 + 1]; f[t * 3 + 1] = f[t * 3 + 2]; f[t * 3 + 2] = x; } coquesRetournees++; }
      retournes += nInv;
    }
    return { v, f, retournes, coquesRetournees };
  };

  /* ---------- boucher les trous : on suit le bord d'un trou et on le ferme en éventail autour de son centre ---------- */
  R.boucher = function (m, maxi) {
    const v = m.v.slice(), f = m.f.slice(), { tete, suiv } = aretes(m), depart = new Map(); maxi = maxi || 400;
    /* le bord d'un trou se parcourt à l'envers des triangles qui le longent */
    for (const h of tete.values()) if (suiv[h] < 0) { const de = autre(m.f, h), vers = m.f[h]; if (!depart.has(de)) depart.set(de, []); depart.get(de).push(vers); }
    let bouches = 0, laisses = 0, ajoutes = 0;
    for (const s0 of [...depart.keys()]) {
      while (depart.get(s0) && depart.get(s0).length) {
        const tour = [s0]; let s = depart.get(s0).pop(), ferme = false;
        while (tour.length <= maxi) { if (s === s0) { ferme = true; break; } tour.push(s); const l = depart.get(s); if (!l || !l.length) break; s = l.pop(); }
        if (!ferme || tour.length < 3) { laisses++; continue; }
        if (tour.length === 3) f.push(tour[0], tour[1], tour[2]);
        else {
          let cx = 0, cy = 0, cz = 0; for (const i of tour) { cx += v[i * 3]; cy += v[i * 3 + 1]; cz += v[i * 3 + 2]; }
          const c = v.length / 3; v.push(cx / tour.length, cy / tour.length, cz / tour.length);
          for (let i = 0; i < tour.length; i++) f.push(tour[i], tour[(i + 1) % tour.length], c);
        }
        ajoutes += tour.length === 3 ? 1 : tour.length; bouches++;
      }
    }
    return { v, f, bouches, laisses, ajoutes };
  };

  /* nombre de morceaux « qui se tiennent » : les coques qui partagent au moins un sommet comptent pour un seul */
  R.morceaux = function (m, pas) {
    const s = R.souder(m, pas), nv = s.v.length / 3, parent = new Int32Array(nv); for (let i = 0; i < nv; i++) parent[i] = i;
    const racine = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let t = 0; t < s.f.length; t += 3) { const a = racine(s.f[t]); for (let k = 1; k < 3; k++) { const b = racine(s.f[t + k]); if (a !== b) parent[b] = a; } }
    const vus = new Set(); for (let t = 0; t < s.f.length; t += 3) vus.add(racine(s.f[t])); return vus.size;
  };

  /* ---------- réparer, dans l'ordre, et rendre le compte rendu de chaque étape ----------
     quoi : 'tout' (par défaut), 'doubles', 'retourner' ou 'boucher'. Le maillage rendu est soudé : les volumes qui se
     touchent y partagent leurs sommets, ce qui garde le fichier léger et le compte des morceaux juste. */
  R.reparer = function (m0, quoi) {
    const tout = !quoi || quoi === 'tout', e = {}, q = R.pas(m0), propre = x => R.nettoyer(R.souder(x, q), true);
    let m = R.souder(m0, q), r = R.nettoyer(m, true); e.ecrases = r.ecrases; m = r;
    const avant = R.diagnostic(m);
    if (tout || quoi === 'boucher') { r = R.recoudre(m, 3 * q); e.recousus = r.coupes; if (r.coupes) m = R.nettoyer(r, true); }
    r = R.separer(m);
    if (tout || quoi === 'doubles') {
      const d = R.sansDoubles(m, r); e.coquesEnDouble = d.coques; e.trianglesEnDouble = d.triangles;
      if (d.triangles) r = R.separer(propre(d));                    // des objets ont disparu : on refait le mariage des arêtes
    }
    if (tout || quoi === 'retourner' || quoi === 'boucher') {
      const o = R.orienter(r); e.retournes = o.retournes; e.coquesRetournees = o.coquesRetournees;
      r = o.retournes ? R.orienter(R.separer(propre(o))) : o;       // une fois les triangles à l'endroit, le mariage est plus sûr
    }
    if (tout || quoi === 'boucher') { const b = R.boucher(r); e.bouches = b.bouches; e.laisses = b.laisses; r = b.bouches ? R.orienter(b) : b; }
    m = propre(r);
    const coques = R.separer(m).coques;
    return { v: m.v, f: m.f, avant, apres: R.diagnostic(m), etapes: e, coques, morceaux: R.morceaux(m, q) };
  };
})(globalThis.ME = globalThis.ME || {});
