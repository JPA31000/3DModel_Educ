/* Model Educ — maillage polygonal éditable (« cage ») et subdivision de Catmull-Clark.
   La cage est faite de sommets et de faces à 4 côtés (ou plus). Elle sert à deux ateliers :
   - maillage polygonal : la cage EST la pièce ;
   - subdivision : la cage pilote une surface lisse, obtenue en recoupant chaque face en 4
     et en adoucissant les sommets (Catmull et Clark, 1978).
   Données : { v: [[x,y,z],…], f: [[i,j,k,l],…], vifs: ["a_b",…] (arêtes gardées vives) } */
(function (ME) {
  'use strict';
  const G = ME.Cage = {};
  const V = ME.V;
  const cleA = (a, b) => a < b ? a + '_' + b : b + '_' + a;

  G.cube = function (c) {
    const h = c / 2;
    return {
      v: [[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0], [-h, -h, c], [h, -h, c], [h, h, c], [-h, h, c]],
      f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], vifs: []
    };
  };
  G.centre = (g, fi) => { const f = g.f[fi]; let c = [0, 0, 0]; for (const i of f) c = V.add(c, g.v[i]); return V.mul(c, 1 / f.length); };
  G.normale = (g, fi) => {
    const f = g.f[fi], n = [0, 0, 0];
    for (let i = 0; i < f.length; i++) {
      const a = g.v[f[i]], b = g.v[f[(i + 1) % f.length]];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return V.norm(n);
  };

  /* Extrusion : la face avance de d le long de sa normale, des faces de côté la relient à son ancien contour.
     Avec retrait > 0, la nouvelle face est aussi rétrécie vers son centre (« insérer une face »). */
  G.extruder = function (g, fi, d, retrait) {
    const f = g.f[fi], n = G.normale(g, fi), c = G.centre(g, fi), nouv = [];
    for (const i of f) {
      let p = g.v[i];
      if (retrait) p = V.lerp(p, c, retrait);
      nouv.push(g.v.length); g.v.push(V.add(p, V.mul(n, d)));
    }
    for (let i = 0; i < f.length; i++) { const j = (i + 1) % f.length; g.f.push([f[i], f[j], nouv[j], nouv[i]]); }
    g.f[fi] = nouv;
  };
  G.deplacerFace = (g, fi, d) => { for (const i of g.f[fi]) g.v[i] = V.add(g.v[i], d); };
  G.echelleFace = (g, fi, k) => { const c = G.centre(g, fi); for (const i of g.f[fi]) g.v[i] = V.add(c, V.mul(V.sub(g.v[i], c), k)); };
  /* Rend vives (ou adoucit) les arêtes du tour d'une face : la subdivision la gardera plane. */
  G.basculerVif = function (g, fi) {
    const f = g.f[fi], cles = f.map((a, i) => cleA(a, f[(i + 1) % f.length])), s = new Set(g.vifs);
    const tous = cles.every(k => s.has(k));
    for (const k of cles) { if (tous) s.delete(k); else s.add(k); }
    g.vifs = [...s];
    return !tous;
  };
  G.estVive = (g, fi) => { const f = g.f[fi], s = new Set(g.vifs); return f.every((a, i) => s.has(cleA(a, f[(i + 1) % f.length]))); };

  /* Une passe de Catmull-Clark. */
  G.subdiviser = function (g) {
    const v = g.v, f = g.f, vifs = new Set(g.vifs), nv = [], nf = [], nvifs = [];
    const ptF = f.map((_, i) => G.centre(g, i));
    const aretes = new Map(); // clé -> { a, b, faces, vive, idx }
    f.forEach((face, fi) => face.forEach((a, i) => {
      const b = face[(i + 1) % face.length], k = cleA(a, b);
      let e = aretes.get(k); if (!e) { e = { a, b, faces: [], vive: vifs.has(k) }; aretes.set(k, e); }
      e.faces.push(fi);
    }));
    const parSommet = v.map(() => ({ faces: [], aretes: [] }));
    f.forEach((face, fi) => face.forEach(a => parSommet[a].faces.push(fi)));
    for (const e of aretes.values()) { parSommet[e.a].aretes.push(e); parSommet[e.b].aretes.push(e); }
    /* nouveaux sommets : d'abord les anciens déplacés, puis un par arête, puis un par face */
    v.forEach((p, i) => {
      const s = parSommet[i], vives = s.aretes.filter(e => e.vive || e.faces.length < 2), n = s.aretes.length;
      if (vives.length > 2 || n < 3) nv.push(p.slice());
      else if (vives.length === 2) {
        const o = vives.map(e => v[e.a === i ? e.b : e.a]);
        nv.push(V.mul(V.add(V.mul(p, 6), V.add(o[0], o[1])), 1 / 8));
      } else {
        let F = [0, 0, 0], R = [0, 0, 0];
        for (const fi of s.faces) F = V.add(F, ptF[fi]);
        for (const e of s.aretes) R = V.add(R, V.mul(V.add(v[e.a], v[e.b]), 0.5));
        F = V.mul(F, 1 / s.faces.length); R = V.mul(R, 1 / n);
        nv.push(V.mul(V.add(V.add(F, V.mul(R, 2)), V.mul(p, n - 3)), 1 / n));
      }
    });
    for (const e of aretes.values()) {
      e.idx = nv.length;
      if (e.vive || e.faces.length < 2) nv.push(V.mul(V.add(v[e.a], v[e.b]), 0.5));
      else nv.push(V.mul(V.add(V.add(v[e.a], v[e.b]), V.add(ptF[e.faces[0]], ptF[e.faces[1]])), 0.25));
      if (e.vive) nvifs.push(cleA(e.a, e.idx), cleA(e.b, e.idx));
    }
    const baseF = nv.length; for (const p of ptF) nv.push(p);
    f.forEach((face, fi) => face.forEach((a, i) => {
      const suiv = face[(i + 1) % face.length], prec = face[(i + face.length - 1) % face.length];
      nf.push([a, aretes.get(cleA(a, suiv)).idx, baseF + fi, aretes.get(cleA(prec, a)).idx]);
    }));
    return { v: nv, f: nf, vifs: nvifs };
  };

  /* Cage → triangles. triFace[t] = numéro de la face d'origine (pour retrouver la face cliquée). */
  G.trianguler = function (g) {
    const v = [], f = [], triFace = [];
    for (const p of g.v) v.push(p[0], p[1], p[2]);
    g.f.forEach((face, fi) => { for (let i = 1; i < face.length - 1; i++) { f.push(face[0], face[i], face[i + 1]); triFace.push(fi); } });
    return { v, f, triFace };
  };
  G.aretes = function (g) {
    const vus = new Set(), s = [];
    for (const face of g.f) face.forEach((a, i) => {
      const b = face[(i + 1) % face.length], k = cleA(a, b);
      if (vus.has(k)) return; vus.add(k);
      s.push(...g.v[a], ...g.v[b]);
    });
    return s;
  };
  G.contourFace = (g, fi) => { const f = g.f[fi], s = []; f.forEach((a, i) => s.push(...g.v[a], ...g.v[f[(i + 1) % f.length]])); return s; };
  G.poser = function (g, zmin) { for (const p of g.v) p[2] -= zmin; };
})(globalThis.ME = globalThis.ME || {});
