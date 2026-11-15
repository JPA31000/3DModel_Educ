/* Model Educ — moteur d'affichage 3D (WebGL, sans bibliothèque).
   Repère de l'impression 3D : X et Y sur le plateau, Z vers le haut, unités en millimètres.
   Le moteur ne connaît rien des ateliers : il affiche un maillage, des traits, des poignées,
   gère la caméra (orbite, déplacement, zoom) et renvoie les clics sous forme de rayons. */
(function (ME) {
  'use strict';

  /* ---------- petites mathématiques ---------- */
  const V = ME.V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  };

  function perspective(fov, aspect, pres, loin) {
    const f = 1 / Math.tan(fov / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (loin + pres) / (pres - loin); m[11] = -1; m[14] = 2 * loin * pres / (pres - loin);
    return m;
  }
  function regarder(oeil, cible, haut) {
    const z = V.norm(V.sub(oeil, cible)), x = V.norm(V.cross(haut, z)), y = V.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -V.dot(x, oeil), -V.dot(y, oeil), -V.dot(z, oeil), 1]);
  }
  function produit(a, b) {
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let l = 0; l < 4; l++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + l] * b[c * 4 + k];
      m[c * 4 + l] = s;
    }
    return m;
  }


  /* ---------- programmes ---------- */
  const VS_MAILLE = `attribute vec3 aP; attribute vec3 aN; attribute vec3 aC;
uniform mat4 uM; varying vec3 vN; varying vec3 vC; varying vec3 vP;
void main(){ vN=aN; vC=aC; vP=aP; gl_Position=uM*vec4(aP,1.0); }`;
  const FS_MAILLE = `precision mediump float;
uniform float uCoupe; uniform vec4 uPlan; uniform vec3 uOeil; uniform float uPara; uniform vec3 uAvant;
varying vec3 vN; varying vec3 vC; varying vec3 vP;
void main(){
  if(vP.z>uCoupe) discard;
  if(dot(vP,uPlan.xyz)<uPlan.w) discard;
  vec3 n=normalize(vN);
  if(!gl_FrontFacing){
    /* l'intérieur de la pièce, visible quand on tranche ou qu'on coupe : hachures façon remplissage */
    float h=step(0.5,fract((vP.x+vP.y+vP.z)*0.25));
    gl_FragColor=vec4(mix(vec3(0.93,0.50,0.16),vec3(0.99,0.70,0.36),h),1.0); return;
  }
  vec3 L=normalize(vec3(0.35,-0.45,0.82));
  vec3 vue=uPara>0.5 ? -uAvant : normalize(uOeil-vP);
  float diff=max(dot(n,L),0.0);
  float ciel=0.5+0.5*n.z;
  float face=max(dot(n,vue),0.0);
  vec3 c=vC*(0.30+0.22*ciel+0.42*diff+0.16*face);
  gl_FragColor=vec4(c,1.0);
}`;
  const VS_TRAIT = `attribute vec3 aP; attribute vec4 aC; uniform mat4 uM; varying vec4 vC; varying vec3 vP;
void main(){ vC=aC; vP=aP; gl_Position=uM*vec4(aP,1.0); }`;
  const FS_TRAIT = `precision mediump float; uniform vec4 uPlan; varying vec4 vC; varying vec3 vP;
void main(){ if(dot(vP,uPlan.xyz)<uPlan.w) discard; gl_FragColor=vC; }`;
  const VS_POINT = `attribute vec3 aP; attribute vec4 aC; attribute float aT; uniform mat4 uM; varying vec4 vC;
void main(){ vC=aC; gl_Position=uM*vec4(aP,1.0); gl_PointSize=aT; }`;
  const FS_POINT = `precision mediump float; varying vec4 vC;
void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard;
  gl_FragColor = r>0.36 ? vec4(1.0,1.0,1.0,1.0) : vC; }`;

  function programme(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  /* ---------- la vue ---------- */
  ME.Vue = function (canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL indisponible');
    const pM = programme(gl, VS_MAILLE, FS_MAILLE), pT = programme(gl, VS_TRAIT, FS_TRAIT), pP = programme(gl, VS_POINT, FS_POINT);
    const tampon = () => ({ b: gl.createBuffer(), n: 0 });
    const T = { mP: tampon(), mN: tampon(), mC: tampon(), plP: tampon(), plC: tampon(), plqP: tampon(), plqC: tampon(),
      trP: tampon(), trC: tampon(), tfP: tampon(), tfC: tampon(), poP: tampon(), poC: tampon(), poT: tampon() };
    const charger = (t, donnees, pas) => { gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.bufferData(gl.ARRAY_BUFFER, donnees, gl.DYNAMIC_DRAW); t.n = donnees.length / pas; };

    /* Une fenêtre : r = [x, y, largeur, hauteur] en fractions du canevas ; ortho = null (perspective)
       ou { av, dr, ha } (regard, droite, haut) ; demi = demi-hauteur visible en mm (vues parallèles) ;
       plan = null ou [a, b, c, d] : tout ce qui vérifie a·x + b·y + c·z < d est coupé (section). */
    const nouvelle = () => ({ r: [0, 0, 1, 1], cam: { cible: [0, 0, 30], az: -0.9, el: 0.5, dist: 320, fov: 0.6 }, demi: 110, ortho: null, plan: null });
    const NEUTRE = [0, 0, 0, -1], LOIN = 4000;
    const vue = {
      fenetres: [nouvelle()], active: 0, nouvelleFenetre: nouvelle, coupe: null, poignees: [],
      surClic: null, surSurvol: null, surPoigneeDebut: null, surPoigneeGlisse: null, surPoigneeFin: null, surActive: null
    };
    Object.defineProperty(vue, 'cam', { get: () => vue.fenetres[0].cam });
    let sale = true;
    vue.demander = () => { sale = true; };

    /* place d'une fenêtre à l'écran (coordonnées client) et fenêtre sous un point */
    function cadre(f) {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + f.r[0] * r.width, y: r.top + f.r[1] * r.height, w: Math.max(1, f.r[2] * r.width), h: Math.max(1, f.r[3] * r.height), gx: r.left, gy: r.top };
    }
    function sous(cx, cy) {
      const r = canvas.getBoundingClientRect(), u = (cx - r.left) / Math.max(1, r.width), v = (cy - r.top) / Math.max(1, r.height);
      return vue.fenetres.find(f => u >= f.r[0] && u <= f.r[0] + f.r[2] && v >= f.r[1] && v <= f.r[1] + f.r[3]) || vue.fenetres[0];
    }
    vue.fenetreSous = sous;
    /* Dans une fenêtre plus haute que large, on règle l'échelle sur la largeur : la pièce cadrée reste entière. */
    const demiH = (f, asp) => f.demi / Math.min(1, asp), ouv = (f, asp) => Math.tan(f.cam.fov / 2) / Math.min(1, asp);
    /* matrice, œil et repère de la caméra d'une fenêtre */
    function repere(f, asp) {
      const c = f.cam;
      if (f.ortho) {
        const { av, dr, ha } = f.ortho, m = new Float32Array(16);
        const lig = (k, a, s) => { m[k] = a[0] / s; m[4 + k] = a[1] / s; m[8 + k] = a[2] / s; m[12 + k] = -V.dot(a, c.cible) / s; };
        const d = demiH(f, asp); lig(0, dr, d * asp); lig(1, ha, d); lig(2, av, LOIN); m[15] = 1;
        return { m, oeil: V.sub(c.cible, V.mul(av, LOIN)), av, dr, ha };
      }
      const ce = Math.cos(c.el), se = Math.sin(c.el);
      const oeil = [c.cible[0] + c.dist * ce * Math.cos(c.az), c.cible[1] + c.dist * ce * Math.sin(c.az), c.cible[2] + c.dist * se];
      const P = perspective(2 * Math.atan(ouv(f, asp)), asp, Math.max(0.5, c.dist / 200), c.dist * 20 + 2000);
      const av = V.norm(V.sub(c.cible, oeil)), dr = V.norm(V.cross(av, [0, 0, 1])), ha = V.cross(dr, av);
      return { m: produit(P, regarder(oeil, c.cible, [0, 0, 1])), oeil, av, dr, ha };
    }

    vue.maillage = (pos, nor, col) => { charger(T.mP, pos, 3); charger(T.mN, nor, 3); charger(T.mC, col, 3); sale = true; };
    /* traits « fantômes » : toujours visibles, même derrière la pièce (cage, points de contrôle, contour de couche) */
    vue.traits = (pos, col) => { charger(T.trP, pos, 3); charger(T.trC, col, 4); sale = true; };
    /* traits « fins » : cachés par la pièce (arêtes du maillage) */
    vue.traitsFins = (pos, col) => { charger(T.tfP, pos, 3); charger(T.tfC, col, 4); sale = true; };
    vue.definirPoignees = liste => {
      vue.poignees = liste;
      const p = new Float32Array(liste.length * 3), c = new Float32Array(liste.length * 4), t = new Float32Array(liste.length);
      liste.forEach((h, i) => { p.set(h.p, i * 3); c.set(h.c || [0.76, 0.25, 0.05, 1], i * 4); t[i] = (h.t || 13) * (window.devicePixelRatio || 1); });
      charger(T.poP, p, 3); charger(T.poC, c, 4); charger(T.poT, t, 1); sale = true;
    };

    vue.plateau = (lx, ly) => {
      const p = [], c = [], gris = [0.42, 0.47, 0.52, 0.28], fort = [0.30, 0.35, 0.40, 0.75];
      for (let x = -lx / 2; x <= lx / 2 + 1e-6; x += 10) { const k = Math.abs(Math.round(x)) % 50 === 0 ? [0.42, 0.47, 0.52, 0.5] : gris; p.push(x, -ly / 2, 0, x, ly / 2, 0); c.push(...k, ...k); }
      for (let y = -ly / 2; y <= ly / 2 + 1e-6; y += 10) { const k = Math.abs(Math.round(y)) % 50 === 0 ? [0.42, 0.47, 0.52, 0.5] : gris; p.push(-lx / 2, y, 0, lx / 2, y, 0); c.push(...k, ...k); }
      const b = [[-lx / 2, -ly / 2], [lx / 2, -ly / 2], [lx / 2, ly / 2], [-lx / 2, ly / 2]];
      for (let i = 0; i < 4; i++) { const a = b[i], d = b[(i + 1) % 4]; p.push(a[0], a[1], 0, d[0], d[1], 0); c.push(...fort, ...fort); }
      /* axes : X rouge, Y vert, Z bleu, depuis le coin avant gauche */
      const o = [-lx / 2, -ly / 2, 0];
      p.push(...o, o[0] + 30, o[1], 0, ...o, o[0], o[1] + 30, 0, ...o, o[0], o[1], 30);
      c.push(0.8, 0.2, 0.15, 1, 0.8, 0.2, 0.15, 1, 0.15, 0.55, 0.2, 1, 0.15, 0.55, 0.2, 1, 0.1, 0.35, 0.8, 1, 0.1, 0.35, 0.8, 1);
      charger(T.plP, new Float32Array(p), 3); charger(T.plC, new Float32Array(c), 4);
      const q = [-lx / 2, -ly / 2, -0.05, lx / 2, -ly / 2, -0.05, lx / 2, ly / 2, -0.05, -lx / 2, -ly / 2, -0.05, lx / 2, ly / 2, -0.05, -lx / 2, ly / 2, -0.05];
      const qc = []; for (let i = 0; i < 6; i++) qc.push(0.80, 0.83, 0.86, 1);
      charger(T.plqP, new Float32Array(q), 3); charger(T.plqC, new Float32Array(qc), 4);
      sale = true;
    };

    /* cadrer une boîte : dans une fenêtre donnée, ou dans toutes celles qui sont affichées */
    vue.cadrer = (min, max, f) => {
      const d = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 20);
      for (const g of f ? [f] : vue.fenetres) {
        g.cam.cible = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
        g.cam.dist = d * 2.2 + 80; g.demi = d * 0.62 + 18;
      }
      sale = true;
    };

    /* rayon passant par un point de l'écran (coordonnées client), dans la fenêtre f (par défaut : celle sous le point) */
    vue.rayon = (cx, cy, f) => {
      f = f || sous(cx, cy);
      const b = cadre(f), asp = b.w / b.h, nx = ((cx - b.x) / b.w) * 2 - 1, ny = 1 - ((cy - b.y) / b.h) * 2, R = repere(f, asp);
      if (f.ortho) return { o: V.add(R.oeil, V.add(V.mul(R.dr, nx * demiH(f, asp) * asp), V.mul(R.ha, ny * demiH(f, asp)))), d: R.av.slice(), avant: R.av.slice(), ortho: true, fenetre: f };
      const t = ouv(f, asp);
      return { o: R.oeil.slice(), d: V.norm(V.add(R.av, V.add(V.mul(R.dr, nx * t * asp), V.mul(R.ha, ny * t)))), avant: R.av, ortho: false, fenetre: f };
    };
    /* position écran (pixels CSS, relative au canevas) d'un point 3D, dans la fenêtre f (par défaut : l'active) */
    vue.projeter = (p, f) => {
      f = f || vue.fenetres[vue.active] || vue.fenetres[0];
      const b = cadre(f), m = repere(f, b.w / b.h).m, w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (w <= 0) return null;
      const x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
      return [(x + 1) / 2 * b.w + b.x - b.gx, (1 - y) / 2 * b.h + b.y - b.gy];
    };

    /* ---------- dessin ---------- */
    function attr(prog, nom, t, taille) {
      const loc = gl.getAttribLocation(prog, nom);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, taille, gl.FLOAT, false, 0, 0);
    }
    function dessinerTraits(tp, tc, mode, m, plan) {
      if (!tp.n) return;
      gl.useProgram(pT); gl.uniformMatrix4fv(gl.getUniformLocation(pT, 'uM'), false, m);
      gl.uniform4fv(gl.getUniformLocation(pT, 'uPlan'), plan || NEUTRE);
      attr(pT, 'aP', tp, 3); attr(pT, 'aC', tc, 4); gl.drawArrays(mode, 0, tp.n);
    }
    function dessinerFenetre(f, W, H) {
      const x = Math.round(f.r[0] * W), w = Math.round((f.r[0] + f.r[2]) * W) - x, haut = Math.round(f.r[1] * H), h = Math.round((f.r[1] + f.r[3]) * H) - haut;
      if (w < 2 || h < 2) return;
      gl.viewport(x, H - haut - h, w, h); gl.scissor(x, H - haut - h, w, h);
      const R = repere(f, w / h), m = R.m;
      if (f.ortho) gl.clearColor(0.965, 0.968, 0.972, 1); else gl.clearColor(0.925, 0.933, 0.94, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      /* plateau (vu de dessus seulement : on ne le dessine pas quand la caméra passe dessous ou le regarde par la tranche) */
      if (f.ortho ? f.ortho.av[2] < -0.5 : R.oeil[2] > 0) dessinerTraits(T.plqP, T.plqC, gl.TRIANGLES, m);
      dessinerTraits(T.plP, T.plC, gl.LINES, m);
      /* pièce */
      if (T.mP.n && vue.faces !== false) { // vue.faces = false : style filaire, seules les arêtes sont dessinées
        gl.useProgram(pM);
        gl.uniformMatrix4fv(gl.getUniformLocation(pM, 'uM'), false, m);
        gl.uniform1f(gl.getUniformLocation(pM, 'uCoupe'), vue.coupe == null ? 1e9 : vue.coupe);
        gl.uniform4fv(gl.getUniformLocation(pM, 'uPlan'), f.plan || NEUTRE);
        gl.uniform3fv(gl.getUniformLocation(pM, 'uOeil'), R.oeil);
        gl.uniform1f(gl.getUniformLocation(pM, 'uPara'), f.ortho ? 1 : 0);
        gl.uniform3fv(gl.getUniformLocation(pM, 'uAvant'), R.av);
        attr(pM, 'aP', T.mP, 3); attr(pM, 'aN', T.mN, 3); attr(pM, 'aC', T.mC, 3);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, T.mP.n);
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      dessinerTraits(T.tfP, T.tfC, gl.LINES, m, f.plan);
      gl.disable(gl.DEPTH_TEST);
      dessinerTraits(T.trP, T.trC, gl.LINES, m);
      if (T.poP.n) {
        gl.useProgram(pP); gl.uniformMatrix4fv(gl.getUniformLocation(pP, 'uM'), false, m);
        attr(pP, 'aP', T.poP, 3); attr(pP, 'aC', T.poC, 4); attr(pP, 'aT', T.poT, 1);
        gl.drawArrays(gl.POINTS, 0, T.poP.n);
        gl.disableVertexAttribArray(gl.getAttribLocation(pP, 'aT'));
      }
    }
    function dessiner() {
      const dpr = window.devicePixelRatio || 1, w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.disable(gl.CULL_FACE); gl.enable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const f of vue.fenetres) dessinerFenetre(f, canvas.width, canvas.height);
    }
    function boucle() { if (sale) { sale = false; dessiner(); } requestAnimationFrame(boucle); }
    requestAnimationFrame(boucle);
    if (window.ResizeObserver) new ResizeObserver(() => { sale = true; }).observe(canvas);
    window.addEventListener('resize', () => { sale = true; });

    /* ---------- souris et doigts ---------- */
    const doigts = new Map();
    let geste = null; // {type:'orbite'|'pan'|'poignee'|'pince', f: la fenêtre où le geste a commencé, ...}
    const zoomer = (f, k) => { if (f.ortho) f.demi = Math.min(2500, Math.max(4, f.demi * k)); else f.cam.dist = Math.min(3000, Math.max(15, f.cam.dist * k)); };
    function poigneeSous(ev, f) {
      const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      let mieux = null, dm = 15;
      for (const h of vue.poignees) {
        if (h.fixe) continue;
        const s = vue.projeter(h.p, f); if (!s) continue;
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (d < dm) { dm = d; mieux = h; }
      }
      return mieux;
    }
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', ev => {
      canvas.setPointerCapture(ev.pointerId);
      doigts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (doigts.size === 2 && geste) {
        const [a, b] = [...doigts.values()];
        geste = { type: 'pince', f: geste.f, d0: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
        return;
      }
      const f = sous(ev.clientX, ev.clientY), i = vue.fenetres.indexOf(f);
      if (i !== vue.active) { vue.active = i; if (vue.surActive) vue.surActive(i); }
      const h = ev.button === 0 ? poigneeSous(ev, f) : null;
      if (h) {
        geste = { type: 'poignee', f, id: h.id, x0: ev.clientX, y0: ev.clientY, bouge: false, p0: h.p.slice() };
        if (vue.surPoigneeDebut) vue.surPoigneeDebut(h.id);
      } else {
        /* dans une vue parallèle (plan, face, côté, section), glisser déplace la vue : on ne la fait pas tourner */
        geste = { type: (f.ortho || ev.button === 2 || ev.button === 1 || ev.shiftKey) ? 'pan' : 'orbite', f, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, bouge: false, bouton: ev.button };
      }
    });
    canvas.addEventListener('pointermove', ev => {
      if (doigts.has(ev.pointerId)) doigts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (!geste) {
        const f = sous(ev.clientX, ev.clientY);
        canvas.style.cursor = poigneeSous(ev, f) ? 'grab' : 'default';
        if (vue.surSurvol) vue.surSurvol(vue.rayon(ev.clientX, ev.clientY, f), ev);
        return;
      }
      const f = geste.f;
      if (geste.type === 'pince' && doigts.size === 2) {
        const [a, b] = [...doigts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomer(f, geste.d0 / Math.max(1, d)); geste.d0 = d;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        deplacer(f, mx - geste.mx, my - geste.my); geste.mx = mx; geste.my = my;
        sale = true; return;
      }
      if (Math.hypot(ev.clientX - geste.x0, ev.clientY - geste.y0) > 4) geste.bouge = true;
      if (geste.type === 'poignee') {
        if (geste.bouge && vue.surPoigneeGlisse) vue.surPoigneeGlisse(geste.id, vue.rayon(ev.clientX, ev.clientY, f), geste.p0);
        return;
      }
      if (geste.type === 'pince') return;
      const dx = ev.clientX - geste.x, dy = ev.clientY - geste.y; geste.x = ev.clientX; geste.y = ev.clientY;
      if (!geste.bouge) return;
      if (geste.type === 'orbite') { f.cam.az -= dx * 0.008; f.cam.el = Math.min(1.55, Math.max(-0.6, f.cam.el + dy * 0.008)); }
      else deplacer(f, dx, dy);
      sale = true;
    });
    function deplacer(f, dx, dy) {
      const b = cadre(f), R = repere(f, b.w / b.h);
      const k = (f.ortho ? 2 * demiH(f, b.w / b.h) : 2 * f.cam.dist * ouv(f, b.w / b.h)) / b.h;
      f.cam.cible = V.add(f.cam.cible, V.add(V.mul(R.dr, -dx * k), V.mul(R.ha, dy * k)));
    }
    function fin(ev) {
      doigts.delete(ev.pointerId);
      const g = geste; geste = null;
      if (!g) return;
      if (g.type === 'poignee') { if (vue.surPoigneeFin) vue.surPoigneeFin(g.id, g.bouge); return; }
      if (g.type !== 'pince' && !g.bouge && g.bouton === 0 && vue.surClic) vue.surClic(vue.rayon(ev.clientX, ev.clientY, g.f), ev);
    }
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    canvas.addEventListener('wheel', ev => {
      ev.preventDefault();
      zoomer(sous(ev.clientX, ev.clientY), Math.exp(ev.deltaY * 0.0012)); sale = true;
    }, { passive: false });

    return vue;
  };
})(globalThis.ME = globalThis.ME || {});
