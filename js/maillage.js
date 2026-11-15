/* Model Educ — outils sur les maillages de triangles.
   Un maillage = { v: [x,y,z, x,y,z, …] (mm), f: [i,j,k, …] } ; triangles tournés dans le sens
   inverse des aiguilles d'une montre vus de l'extérieur (c'est la règle du format STL).
   On y trouve : la soudure des sommets, le contrôle d'imprimabilité, les normales d'affichage,
   la coupe par un plan (aperçu des couches), l'export STL et le lancer de rayon. */
(function (ME) {
  'use strict';
  const M = ME.M = {};

  /* Soude les sommets confondus (au millième de mm) et retire les triangles écrasés. */
  M.souder = function (v, f, pas) {
    const q = 1 / (pas || 1e-3), carte = new Map(), nv = [], corr = new Int32Array(v.length / 3);
    for (let i = 0; i < v.length / 3; i++) {
      const cle = Math.round(v[i * 3] * q) + ',' + Math.round(v[i * 3 + 1] * q) + ',' + Math.round(v[i * 3 + 2] * q);
      let j = carte.get(cle);
      if (j === undefined) { j = nv.length / 3; carte.set(cle, j); nv.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); }
      corr[i] = j;
    }
    const nf = [];
    for (let t = 0; t < f.length; t += 3) {
      const a = corr[f[t]], b = corr[f[t + 1]], c = corr[f[t + 2]];
      if (a !== b && b !== c && a !== c) nf.push(a, b, c);
    }
    return { v: nv, f: nf };
  };

  /* Répare les « jonctions en T » : un sommet posé au milieu de l'arête d'un triangle voisin.
     Les opérations booléennes en produisent ; sans réparation, la pièce paraît trouée. */
  M.reparerT = function (m) {
    const v = m.v; let f = m.f.slice();
    const nv = v.length / 3;
    for (let tour = 0; tour < 40; tour++) {
      const compte = new Map();
      for (let t = 0; t < f.length; t += 3) for (let k = 0; k < 3; k++) {
        const a = f[t + k], b = f[t + (k + 1) % 3], cle = a < b ? a * nv + b : b * nv + a;
        compte.set(cle, (compte.get(cle) || 0) + (a < b ? 1 : -1));
      }
      const libres = new Set();
      for (let t = 0; t < f.length; t += 3) for (let k = 0; k < 3; k++) {
        const a = f[t + k], b = f[t + (k + 1) % 3], cle = a < b ? a * nv + b : b * nv + a;
        if (compte.get(cle) !== 0) { libres.add(a); libres.add(b); }
      }
      if (!libres.size) break;
      const cand = [...libres], nf = []; let change = false;
      for (let t = 0; t < f.length; t += 3) {
        let coupe = false;
        for (let k = 0; k < 3 && !coupe; k++) {
          const a = f[t + k], b = f[t + (k + 1) % 3], c = f[t + (k + 2) % 3], cle = a < b ? a * nv + b : b * nv + a;
          if (compte.get(cle) === 0) continue;
          const ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2], dx = v[b * 3] - ax, dy = v[b * 3 + 1] - ay, dz = v[b * 3 + 2] - az;
          const l2 = dx * dx + dy * dy + dz * dz;
          const sur = [];
          for (const p of cand) {
            if (p === a || p === b || p === c) continue;
            const px = v[p * 3] - ax, py = v[p * 3 + 1] - ay, pz = v[p * 3 + 2] - az;
            const u = (px * dx + py * dy + pz * dz) / l2;
            if (u <= 1e-6 || u >= 1 - 1e-6) continue;
            const ex = px - u * dx, ey = py - u * dy, ez = pz - u * dz;
            if (ex * ex + ey * ey + ez * ez < 1e-10) sur.push([u, p]);
          }
          if (sur.length) { // tous les sommets posés sur l'arête a-b, dans l'ordre : éventail depuis c
            sur.sort((x, y) => x[0] - y[0]);
            let prec = a;
            for (const [, p] of sur) { nf.push(prec, p, c); prec = p; }
            nf.push(prec, b, c); coupe = true; change = true;
          }
        }
        if (!coupe) nf.push(f[t], f[t + 1], f[t + 2]);
      }
      f = nf;
      if (!change) break;
    }
    return { v, f };
  };

  /* Contrôle d'imprimabilité.
     opts : { plateau:[x,y,z], couche (mm), rapide (saute l'étude des arêtes) } */
  M.analyser = function (m, opts) {
    const v = m.v, f = m.f, nt = f.length / 3, nv = v.length / 3;
    const r = { nbTri: nt, nbSommets: nv, min: [0, 0, 0], max: [0, 0, 0], dims: [0, 0, 0], volume: 0, aire: 0,
      ouvertes: 0, nonVariete: 0, retournees: 0, etanche: true, pieces: 1, surplombAire: 0, contact: 0,
      surplomb: new Uint8Array(nt), sousPlateau: false, horsPlateau: false, masse: 0, massePleine: 0, couches: 0, vide: nt === 0 };
    if (!nt) { r.etanche = false; return r; }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < nv; i++) {
      const x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    r.min = [x0, y0, z0]; r.max = [x1, y1, z1]; r.dims = [x1 - x0, y1 - y0, z1 - z0];
    const seuil = -Math.SQRT1_2; // normale à plus de 45° sous l'horizontale
    let vol = 0, aire = 0;
    for (let t = 0; t < nt; t++) {
      const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3;
      const ax = v[a], ay = v[a + 1], az = v[a + 2], bx = v[b], by = v[b + 1], bz = v[b + 2], cx = v[c], cy = v[c + 1], cz = v[c + 2];
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const l = Math.hypot(nx, ny, nz), at = l / 2;
      aire += at;
      vol += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
      if (l > 0 && nz / l < seuil) {
        if (Math.max(az, bz, cz) <= z0 + 0.06) r.contact += at;       // face posée sur le plateau
        else { r.surplomb[t] = 1; r.surplombAire += at; }             // face en porte-à-faux
      }
    }
    r.volume = vol; r.aire = aire;
    const pl = (opts && opts.plateau) || [220, 220, 250];
    r.sousPlateau = z0 < -0.05; r.decolle = z0 > 0.05;
    r.horsPlateau = r.dims[0] > pl[0] + 0.01 || r.dims[1] > pl[1] + 0.01 || r.dims[2] > pl[2] + 0.01;
    r.couches = Math.ceil(r.dims[2] / ((opts && opts.couche) || 0.2) - 1e-9);
    /* Masse : ordre de grandeur. Coque de 0,8 mm (2 passages de buse de 0,4) + 15 % de remplissage,
       PLA à 1,24 g/cm³. Ce n'est pas le calcul d'un trancheur. */
    const volAbs = Math.abs(vol), coque = Math.min(volAbs, aire * 0.8);
    r.massePleine = volAbs * 1.24e-3;
    r.masse = (coque + (volAbs - coque) * 0.15) * 1.24e-3;
    if (opts && opts.rapide) { r.rapide = true; return r; }

    /* Arêtes : dans une pièce imprimable, chaque arête sépare exactement deux triangles, parcourus en sens opposés. */
    const aretes = new Map(), parent = new Int32Array(nv);
    for (let i = 0; i < nv; i++) parent[i] = i;
    const racine = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const a = f[t * 3 + k], b = f[t * 3 + (k + 1) % 3], cle = a < b ? a * nv + b : b * nv + a;
      const e = aretes.get(cle) || 0;                       // on range : nombre + 4096 × (sens cumulé)
      aretes.set(cle, e + 1 + 4096 * (a < b ? 1 : -1));
      const ra = racine(a), rb = racine(b); if (ra !== rb) parent[ra] = rb;
    }
    for (const e of aretes.values()) {
      const n = ((e % 4096) + 4096) % 4096, sens = Math.round((e - n) / 4096);
      if (n === 1) r.ouvertes++; else if (n > 2) r.nonVariete++; else if (sens !== 0) r.retournees++;
    }
    r.etanche = r.ouvertes === 0 && r.nonVariete === 0 && r.retournees === 0;
    const vus = new Set(); for (let t = 0; t < nt; t++) vus.add(racine(f[t * 3])); r.pieces = vus.size;
    return r;
  };

  /* Tampons d'affichage : positions, normales (lissées sous un angle de pli), couleurs par triangle. */
  M.tampons = function (m, angleDeg, couleur) {
    const v = m.v, f = m.f, nt = f.length / 3, nv = v.length / 3;
    const fn = new Float32Array(nt * 3);
    for (let t = 0; t < nt; t++) {
      const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      fn[t * 3] = uy * wz - uz * wy; fn[t * 3 + 1] = uz * wx - ux * wz; fn[t * 3 + 2] = ux * wy - uy * wx; // longueur = 2 × aire (pondère le lissage)
    }
    const debut = new Int32Array(nv + 1);
    for (let i = 0; i < f.length; i++) debut[f[i] + 1]++;
    for (let i = 0; i < nv; i++) debut[i + 1] += debut[i];
    const pos = debut.slice(0, nv), adj = new Int32Array(f.length);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) adj[pos[f[t * 3 + k]]++] = t;
    const P = new Float32Array(nt * 9), N = new Float32Array(nt * 9), C = new Float32Array(nt * 9);
    const cosPli = Math.cos((angleDeg || 0) * Math.PI / 180), lisse = angleDeg > 0;
    for (let t = 0; t < nt; t++) {
      const nx = fn[t * 3], ny = fn[t * 3 + 1], nz = fn[t * 3 + 2], l = Math.hypot(nx, ny, nz) || 1;
      const col = couleur(t);
      for (let k = 0; k < 3; k++) {
        const i = f[t * 3 + k], o = t * 9 + k * 3;
        P[o] = v[i * 3]; P[o + 1] = v[i * 3 + 1]; P[o + 2] = v[i * 3 + 2];
        C[o] = col[0]; C[o + 1] = col[1]; C[o + 2] = col[2];
        let sx = nx, sy = ny, sz = nz;
        if (lisse) {
          sx = 0; sy = 0; sz = 0;
          for (let j = debut[i]; j < debut[i + 1]; j++) {
            const u = adj[j], ux = fn[u * 3], uy = fn[u * 3 + 1], uz = fn[u * 3 + 2], lu = Math.hypot(ux, uy, uz);
            if (lu > 0 && (ux * nx + uy * ny + uz * nz) / (lu * l) >= cosPli) { sx += ux; sy += uy; sz += uz; }
          }
        }
        const ls = Math.hypot(sx, sy, sz) || 1;
        N[o] = sx / ls; N[o + 1] = sy / ls; N[o + 2] = sz / ls;
      }
    }
    return { P, N, C };
  };

  /* Contour de la pièce coupée par le plan horizontal de hauteur z : liste de segments. */
  M.trancher = function (m, z) {
    const v = m.v, f = m.f, seg = [];
    for (let t = 0; t < f.length; t += 3) {
      const pts = [];
      for (let k = 0; k < 3; k++) {
        const a = f[t + k] * 3, b = f[t + (k + 1) % 3] * 3, za = v[a + 2] - z, zb = v[b + 2] - z;
        if ((za < 0) !== (zb < 0)) { const u = za / (za - zb); pts.push(v[a] + (v[b] - v[a]) * u, v[a + 1] + (v[b + 1] - v[a + 1]) * u, z); }
      }
      if (pts.length === 6) seg.push(...pts);
    }
    return seg;
  };

  /* Premier triangle touché par un rayon (o + t·d). Renvoie { t, tri, p, n } ou null. */
  M.rayon = function (m, o, d) {
    const v = m.v, f = m.f; let mieux = null;
    for (let t = 0; t < f.length; t += 3) {
      const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
      const e1 = [v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], e2 = [v[c] - v[a], v[c + 1] - v[a + 1], v[c + 2] - v[a + 2]];
      const h = ME.V.cross(d, e2), det = ME.V.dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const s = [o[0] - v[a], o[1] - v[a + 1], o[2] - v[a + 2]], u = ME.V.dot(s, h) / det;
      if (u < 0 || u > 1) continue;
      const q = ME.V.cross(s, e1), w = ME.V.dot(d, q) / det;
      if (w < 0 || u + w > 1) continue;
      const tt = ME.V.dot(e2, q) / det;
      if (tt > 1e-6 && (!mieux || tt < mieux.t)) mieux = { t: tt, tri: t / 3, n: ME.V.norm(ME.V.cross(e1, e2)) };
    }
    if (mieux) mieux.p = ME.V.add(o, ME.V.mul(d, mieux.t));
    return mieux;
  };

  /* Point d'un rayon sur un plan (point p, normale n), ou null. */
  M.rayonPlan = function (r, p, n) {
    const den = ME.V.dot(r.d, n); if (Math.abs(den) < 1e-9) return null;
    const t = ME.V.dot(ME.V.sub(p, r.o), n) / den; if (t < 0) return null;
    return ME.V.add(r.o, ME.V.mul(r.d, t));
  };

  /* Export STL binaire, en millimètres. */
  M.stl = function (m) {
    const v = m.v, f = m.f, nt = f.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const titre = 'Model Educ - STL binaire - unites : mm';
    for (let i = 0; i < titre.length; i++) dv.setUint8(i, titre.charCodeAt(i));
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3;
      const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
      for (const i of [a, b, c]) { dv.setFloat32(o, v[i], true); dv.setFloat32(o + 4, v[i + 1], true); dv.setFloat32(o + 8, v[i + 2], true); o += 12; }
      o += 2;
    }
    return buf;
  };

  /* Triangulation d'un polygone plan simple (liste de [x,y], sens trigonométrique) par « oreilles ». */
  M.trianguler2D = function (pts) {
    const n = pts.length, idx = []; for (let i = 0; i < n; i++) idx.push(i);
    const aire = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
    const dedans = (a, b, c, p) => aire(a, b, p) >= -1e-12 && aire(b, c, p) >= -1e-12 && aire(c, a, p) >= -1e-12;
    const tri = []; let garde = 0;
    while (idx.length > 3 && garde++ < 20000) {
      let coupe = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        if (aire(a, b, c) <= 1e-12) continue;
        let libre = true;
        for (const p of idx) { if (p !== a && p !== b && p !== c && dedans(a, b, c, p)) { libre = false; break; } }
        if (libre) { tri.push(a, b, c); idx.splice(i, 1); coupe = true; break; }
      }
      if (!coupe) idx.splice(0, 1); // polygone dégénéré : on avance quand même
    }
    if (idx.length === 3) tri.push(idx[0], idx[1], idx[2]);
    return tri;
  };

  /* Arêtes vives d'un maillage (pli > angle) : pour dessiner les arêtes d'un solide. */
  M.aretesVives = function (m, angleDeg) {
    const v = m.v, f = m.f, nv = v.length / 3, nt = f.length / 3, carte = new Map(), seg = [], cosA = Math.cos(angleDeg * Math.PI / 180);
    const norm = t => {
      const a = f[t * 3] * 3, b = f[t * 3 + 1] * 3, c = f[t * 3 + 2] * 3;
      return ME.V.norm(ME.V.cross([v[b] - v[a], v[b + 1] - v[a + 1], v[b + 2] - v[a + 2]], [v[c] - v[a], v[c + 1] - v[a + 1], v[c + 2] - v[a + 2]]));
    };
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const a = f[t * 3 + k], b = f[t * 3 + (k + 1) % 3], cle = a < b ? a * nv + b : b * nv + a;
      if (!carte.has(cle)) { carte.set(cle, t); continue; }
      const u = carte.get(cle); if (u < 0) continue;
      carte.set(cle, -1);
      if (ME.V.dot(norm(t), norm(u)) < cosA) seg.push(v[a * 3], v[a * 3 + 1], v[a * 3 + 2], v[b * 3], v[b * 3 + 1], v[b * 3 + 2]);
    }
    return seg;
  };
})(globalThis.ME = globalThis.ME || {});
