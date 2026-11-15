/* Model Educ — géométrie constructive de solides (CSG).
   Chaque solide est une liste de polygones plans convexes. Les opérations booléennes (unir,
   enlever, croiser) découpent ces polygones avec un arbre de partition binaire de l'espace
   (arbre BSP) : chaque nœud est un plan qui range les polygones « devant » ou « derrière ».
   Méthode classique (Naylor, Amanatides, Thibault, 1990), écrite ici pour être lue. */
(function (ME) {
  'use strict';
  const C = ME.CSG = {};
  const EPS = 1e-5;
  const V = ME.V;

  function Poly(pts) {
    this.pts = pts;
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { // normale de Newell : sûre même si trois points sont presque alignés
      const a = pts[i], b = pts[(i + 1) % pts.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    this.n = V.norm(n); this.w = V.dot(this.n, pts[0]);
  }
  Poly.prototype.retourner = function () { const p = Object.create(Poly.prototype); p.pts = this.pts.slice().reverse(); p.n = V.mul(this.n, -1); p.w = -this.w; return p; };
  C.Poly = Poly;

  /* Range un polygone par rapport au plan (n, w) : coplanaire devant / derrière, devant, derrière, ou coupé en deux. */
  function couper(n, w, poly, copD, copA, devant, arriere) {
    let type = 0; const types = [];
    for (const p of poly.pts) {
      const t = V.dot(n, p) - w, ty = t < -EPS ? 2 : t > EPS ? 1 : 0;
      type |= ty; types.push(ty);
    }
    if (type === 0) (V.dot(n, poly.n) > 0 ? copD : copA).push(poly);
    else if (type === 1) devant.push(poly);
    else if (type === 2) arriere.push(poly);
    else {
      const d = [], a = [];
      for (let i = 0; i < poly.pts.length; i++) {
        const j = (i + 1) % poly.pts.length, ti = types[i], tj = types[j], vi = poly.pts[i], vj = poly.pts[j];
        if (ti !== 2) d.push(vi);
        if (ti !== 1) a.push(vi);
        if ((ti | tj) === 3) {
          const t = (w - V.dot(n, vi)) / V.dot(n, V.sub(vj, vi)), v = V.lerp(vi, vj, t);
          d.push(v); a.push(v);
        }
      }
      if (d.length >= 3) { const p = new Poly(d); p.n = poly.n; p.w = poly.w; devant.push(p); }
      if (a.length >= 3) { const p = new Poly(a); p.n = poly.n; p.w = poly.w; arriere.push(p); }
    }
  }

  function Noeud(polys) { this.n = null; this.w = 0; this.devant = null; this.arriere = null; this.polys = []; if (polys && polys.length) this.construire(polys); }
  Noeud.prototype.construire = function (polys) {
    if (!polys.length) return;
    if (!this.n) { this.n = polys[0].n; this.w = polys[0].w; }
    const d = [], a = [];
    for (const p of polys) couper(this.n, this.w, p, this.polys, this.polys, d, a);
    if (d.length) { if (!this.devant) this.devant = new Noeud(); this.devant.construire(d); }
    if (a.length) { if (!this.arriere) this.arriere = new Noeud(); this.arriere.construire(a); }
  };
  Noeud.prototype.inverser = function () {
    this.polys = this.polys.map(p => p.retourner());
    if (this.n) { this.n = V.mul(this.n, -1); this.w = -this.w; }
    if (this.devant) this.devant.inverser();
    if (this.arriere) this.arriere.inverser();
    const t = this.devant; this.devant = this.arriere; this.arriere = t;
  };
  /* Retire de la liste tout ce qui est à l'intérieur du solide décrit par cet arbre. */
  Noeud.prototype.rogner = function (polys) {
    if (!this.n) return polys.slice();
    let d = [], a = [];
    for (const p of polys) couper(this.n, this.w, p, d, a, d, a);
    if (this.devant) d = this.devant.rogner(d);
    a = this.arriere ? this.arriere.rogner(a) : [];
    return d.concat(a);
  };
  Noeud.prototype.rognerPar = function (arbre) {
    this.polys = arbre.rogner(this.polys);
    if (this.devant) this.devant.rognerPar(arbre);
    if (this.arriere) this.arriere.rognerPar(arbre);
  };
  Noeud.prototype.tous = function () {
    let r = this.polys.slice();
    if (this.devant) r = r.concat(this.devant.tous());
    if (this.arriere) r = r.concat(this.arriere.tous());
    return r;
  };

  C.unir = function (A, B) {
    const a = new Noeud(A), b = new Noeud(B);
    a.rognerPar(b); b.rognerPar(a); b.inverser(); b.rognerPar(a); b.inverser();
    a.construire(b.tous()); return a.tous();
  };
  C.enlever = function (A, B) {
    const a = new Noeud(A), b = new Noeud(B);
    a.inverser(); a.rognerPar(b); b.rognerPar(a); b.inverser(); b.rognerPar(a); b.inverser();
    a.construire(b.tous()); a.inverser(); return a.tous();
  };
  C.croiser = function (A, B) {
    const a = new Noeud(A), b = new Noeud(B);
    a.inverser(); b.rognerPar(a); b.inverser(); a.rognerPar(b); b.rognerPar(a);
    a.construire(b.tous()); a.inverser(); return a.tous();
  };

  /* ---------- solides de base, centrés sur l'origine ---------- */
  C.pave = function (lx, ly, lz) {
    const x = lx / 2, y = ly / 2, z = lz / 2;
    const s = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    return [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].map(q => new Poly(q.map(i => s[i].slice())));
  };
  /* Tronc de cône d'axe Z : rayon r1 en bas, r2 en haut (r1 = r2 : cylindre ; r2 = 0 : cône ; peu de côtés : prisme). */
  C.cone = function (r1, r2, h, n) {
    const polys = [], z0 = -h / 2, z1 = h / 2, pt = (r, i, z) => [r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n), z];
    const bas = [], haut = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (r1 > EPS) bas.push(pt(r1, n - 1 - i, z0));
      if (r2 > EPS) haut.push(pt(r2, i, z1));
      if (r1 > EPS && r2 > EPS) polys.push(new Poly([pt(r1, i, z0), pt(r1, j, z0), pt(r2, j, z1), pt(r2, i, z1)]));
      else if (r1 > EPS) polys.push(new Poly([pt(r1, i, z0), pt(r1, j, z0), [0, 0, z1]]));
      else polys.push(new Poly([[0, 0, z0], pt(r2, j, z1), pt(r2, i, z1)]));
    }
    if (bas.length) polys.push(new Poly(bas));
    if (haut.length) polys.push(new Poly(haut));
    return polys;
  };
  C.cylindre = (r, h, n) => C.cone(r, r, h, n);
  C.sphere = function (r, n, m) {
    const polys = [], pt = (i, j) => { const a = 2 * Math.PI * i / n, b = Math.PI * j / m; return [r * Math.sin(b) * Math.cos(a), r * Math.sin(b) * Math.sin(a), -r * Math.cos(b)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const p = [];
      p.push(pt(i, j)); if (j > 0) p.push(pt(i + 1, j)); if (j < m - 1) p.push(pt(i + 1, j + 1)); p.push(pt(i, j + 1));
      polys.push(new Poly(p));
    }
    return polys;
  };
  /* Extrusion d'un contour plan (liste de [x,y], sens trigonométrique) entre z0 et z1. */
  C.extrusion = function (contour, z0, z1, morceaux) {
    const n = contour.length, polys = [];
    if (morceaux) { // contour non convexe déjà découpé en morceaux convexes (listes d'indices)
      for (const mc of morceaux) {
        polys.push(new Poly(mc.map(i => [contour[i][0], contour[i][1], z1])));
        polys.push(new Poly(mc.slice().reverse().map(i => [contour[i][0], contour[i][1], z0])));
      }
    }
    let convexe = true;
    for (let i = 0; i < n && convexe; i++) {
      const a = contour[i], b = contour[(i + 1) % n], c = contour[(i + 2) % n];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) convexe = false;
    }
    const tris = convexe || morceaux ? null : ME.M.trianguler2D(contour);
    if (morceaux) { /* fonds déjà posés */ } else if (convexe) {
      polys.push(new Poly(contour.map(p => [p[0], p[1], z1])));
      polys.push(new Poly(contour.slice().reverse().map(p => [p[0], p[1], z0])));
    } else for (let t = 0; t < tris.length; t += 3) {
      const a = contour[tris[t]], b = contour[tris[t + 1]], c = contour[tris[t + 2]];
      polys.push(new Poly([[a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1]]));
      polys.push(new Poly([[c[0], c[1], z0], [b[0], b[1], z0], [a[0], a[1], z0]]));
    }
    for (let i = 0; i < n; i++) {
      const a = contour[i], b = contour[(i + 1) % n];
      polys.push(new Poly([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]));
    }
    return polys;
  };

  /* Rotation (degrés, autour de X puis Y puis Z) puis translation. */
  C.placer = function (polys, pos, rot) {
    const [rx, ry, rz] = (rot || [0, 0, 0]).map(a => a * Math.PI / 180);
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const tr = p => {
      let x = p[0], y = p[1], z = p[2], t;
      t = y * cx - z * sx; z = y * sx + z * cx; y = t;
      t = x * cy + z * sy; z = -x * sy + z * cy; x = t;
      t = x * cz - y * sz; y = x * sz + y * cz; x = t;
      return [x + pos[0], y + pos[1], z + pos[2]];
    };
    return polys.map(p => new Poly(p.pts.map(tr)));
  };

  /* Polygones → maillage de triangles soudé, jonctions en T réparées. */
  C.maillage = function (polys) {
    const v = [], f = [];
    for (const p of polys) {
      const b = v.length / 3;
      for (const q of p.pts) v.push(q[0], q[1], q[2]);
      for (let i = 1; i < p.pts.length - 1; i++) f.push(b, b + i, b + i + 1);
    }
    return ME.M.reparerT(ME.M.souder(v, f, 1e-4));
  };
  /* Arêtes des polygones (pour montrer un solide « outil » en fil de fer). */
  C.contours = function (polys) {
    const s = [];
    for (const p of polys) for (let i = 0; i < p.pts.length; i++) { const a = p.pts[i], b = p.pts[(i + 1) % p.pts.length]; s.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    return s;
  };
})(globalThis.ME = globalThis.ME || {});
