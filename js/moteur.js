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
uniform float uCoupe; uniform vec3 uOeil; varying vec3 vN; varying vec3 vC; varying vec3 vP;
void main(){
  if(vP.z>uCoupe) discard;
  vec3 n=normalize(vN);
  if(!gl_FrontFacing){
    /* l'intérieur de la pièce, visible quand on tranche : hachures façon remplissage */
    float h=step(0.5,fract((vP.x+vP.y)*0.25));
    gl_FragColor=vec4(mix(vec3(0.93,0.50,0.16),vec3(0.99,0.70,0.36),h),1.0); return;
  }
  vec3 L=normalize(vec3(0.35,-0.45,0.82));
  vec3 vue=normalize(uOeil-vP);
  float diff=max(dot(n,L),0.0);
  float ciel=0.5+0.5*n.z;
  float face=max(dot(n,vue),0.0);
  vec3 c=vC*(0.30+0.22*ciel+0.42*diff+0.16*face);
  gl_FragColor=vec4(c,1.0);
}`;
  const VS_TRAIT = `attribute vec3 aP; attribute vec4 aC; uniform mat4 uM; varying vec4 vC;
void main(){ vC=aC; gl_Position=uM*vec4(aP,1.0); }`;
  const FS_TRAIT = `precision mediump float; varying vec4 vC; void main(){ gl_FragColor=vC; }`;
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

    const cam = { cible: [0, 0, 30], az: -0.9, el: 0.5, dist: 320, fov: 0.6 };
    const vue = {
      cam, coupe: null, poignees: [],
      surClic: null, surSurvol: null, surPoigneeDebut: null, surPoigneeGlisse: null, surPoigneeFin: null
    };
    let sale = true, matrice = null, oeil = [0, 0, 0];
    vue.demander = () => { sale = true; };

    function calculer() {
      const ce = Math.cos(cam.el), se = Math.sin(cam.el);
      oeil = [cam.cible[0] + cam.dist * ce * Math.cos(cam.az), cam.cible[1] + cam.dist * ce * Math.sin(cam.az), cam.cible[2] + cam.dist * se];
      const P = perspective(cam.fov, canvas.width / Math.max(1, canvas.height), Math.max(0.5, cam.dist / 200), cam.dist * 20 + 2000);
      matrice = produit(P, regarder(oeil, cam.cible, [0, 0, 1]));
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

    vue.cadrer = (min, max) => {
      const d = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 20);
      cam.cible = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
      cam.dist = d * 2.2 + 80; sale = true;
    };
    vue.vuePredefinie = nom => {
      const v = { iso: [-0.9, 0.5], face: [-Math.PI / 2, 0.0001], dessus: [-Math.PI / 2, Math.PI / 2 - 0.001], droite: [0, 0.0001] }[nom];
      if (v) { cam.az = v[0]; cam.el = v[1]; sale = true; }
    };

    /* rayon passant par un point de l'écran (coordonnées client) */
    vue.rayon = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      const nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2;
      calculer();
      const av = V.norm(V.sub(cam.cible, oeil)), dr = V.norm(V.cross(av, [0, 0, 1])), ha = V.cross(dr, av);
      const t = Math.tan(cam.fov / 2), asp = r.width / Math.max(1, r.height);
      return { o: oeil.slice(), d: V.norm(V.add(av, V.add(V.mul(dr, nx * t * asp), V.mul(ha, ny * t)))), avant: av };
    };
    /* position écran (pixels CSS, relative au canevas) d'un point 3D */
    vue.projeter = p => {
      calculer();
      const m = matrice, w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (w <= 0) return null;
      const x = (m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, y = (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w;
      const r = canvas.getBoundingClientRect();
      return [(x + 1) / 2 * r.width, (1 - y) / 2 * r.height];
    };

    /* ---------- dessin ---------- */
    function attr(prog, nom, t, taille) {
      const loc = gl.getAttribLocation(prog, nom);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, taille, gl.FLOAT, false, 0, 0);
    }
    function dessinerTraits(tp, tc, mode) {
      if (!tp.n) return;
      gl.useProgram(pT); gl.uniformMatrix4fv(gl.getUniformLocation(pT, 'uM'), false, matrice);
      attr(pT, 'aP', tp, 3); attr(pT, 'aC', tc, 4); gl.drawArrays(mode, 0, tp.n);
    }
    function dessiner() {
      const dpr = window.devicePixelRatio || 1, w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      calculer();
      gl.clearColor(0.925, 0.933, 0.94, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      /* plateau (vu de dessus seulement : on ne le dessine pas quand la caméra passe dessous) */
      if (oeil[2] > 0) dessinerTraits(T.plqP, T.plqC, gl.TRIANGLES);
      dessinerTraits(T.plP, T.plC, gl.LINES);
      /* pièce */
      if (T.mP.n && vue.faces !== false) { // vue.faces = false : style filaire, seules les arêtes sont dessinées
        gl.useProgram(pM);
        gl.uniformMatrix4fv(gl.getUniformLocation(pM, 'uM'), false, matrice);
        gl.uniform1f(gl.getUniformLocation(pM, 'uCoupe'), vue.coupe == null ? 1e9 : vue.coupe);
        gl.uniform3fv(gl.getUniformLocation(pM, 'uOeil'), oeil);
        attr(pM, 'aP', T.mP, 3); attr(pM, 'aN', T.mN, 3); attr(pM, 'aC', T.mC, 3);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
        gl.drawArrays(gl.TRIANGLES, 0, T.mP.n);
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      dessinerTraits(T.tfP, T.tfC, gl.LINES);
      gl.disable(gl.DEPTH_TEST);
      dessinerTraits(T.trP, T.trC, gl.LINES);
      if (T.poP.n) {
        gl.useProgram(pP); gl.uniformMatrix4fv(gl.getUniformLocation(pP, 'uM'), false, matrice);
        attr(pP, 'aP', T.poP, 3); attr(pP, 'aC', T.poC, 4); attr(pP, 'aT', T.poT, 1);
        gl.drawArrays(gl.POINTS, 0, T.poP.n);
        gl.disableVertexAttribArray(gl.getAttribLocation(pP, 'aT'));
      }
    }
    function boucle() { if (sale) { sale = false; dessiner(); } requestAnimationFrame(boucle); }
    requestAnimationFrame(boucle);
    if (window.ResizeObserver) new ResizeObserver(() => { sale = true; }).observe(canvas);
    window.addEventListener('resize', () => { sale = true; });

    /* ---------- souris et doigts ---------- */
    const doigts = new Map();
    let geste = null; // {type:'orbite'|'pan'|'poignee'|'pince', ...}
    function poigneeSous(ev) {
      const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      let mieux = null, dm = 15;
      for (const h of vue.poignees) {
        if (h.fixe) continue;
        const s = vue.projeter(h.p); if (!s) continue;
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (d < dm) { dm = d; mieux = h; }
      }
      return mieux;
    }
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', ev => {
      canvas.setPointerCapture(ev.pointerId);
      doigts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (doigts.size === 2) {
        const [a, b] = [...doigts.values()];
        geste = { type: 'pince', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), dist0: cam.dist, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
        return;
      }
      const h = ev.button === 0 ? poigneeSous(ev) : null;
      if (h) {
        geste = { type: 'poignee', id: h.id, x0: ev.clientX, y0: ev.clientY, bouge: false, p0: h.p.slice() };
        if (vue.surPoigneeDebut) vue.surPoigneeDebut(h.id);
      } else {
        geste = { type: (ev.button === 2 || ev.button === 1 || ev.shiftKey) ? 'pan' : 'orbite', x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, bouge: false, bouton: ev.button };
      }
    });
    canvas.addEventListener('pointermove', ev => {
      if (doigts.has(ev.pointerId)) doigts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (!geste) {
        canvas.style.cursor = poigneeSous(ev) ? 'grab' : 'default';
        if (vue.surSurvol) vue.surSurvol(vue.rayon(ev.clientX, ev.clientY), ev);
        return;
      }
      if (geste.type === 'pince' && doigts.size === 2) {
        const [a, b] = [...doigts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        cam.dist = Math.min(3000, Math.max(15, geste.dist0 * geste.d0 / Math.max(1, d)));
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        deplacer(mx - geste.mx, my - geste.my); geste.mx = mx; geste.my = my;
        sale = true; return;
      }
      if (Math.hypot(ev.clientX - geste.x0, ev.clientY - geste.y0) > 4) geste.bouge = true;
      if (geste.type === 'poignee') {
        if (geste.bouge && vue.surPoigneeGlisse) vue.surPoigneeGlisse(geste.id, vue.rayon(ev.clientX, ev.clientY), geste.p0);
        return;
      }
      const dx = ev.clientX - geste.x, dy = ev.clientY - geste.y; geste.x = ev.clientX; geste.y = ev.clientY;
      if (!geste.bouge) return;
      if (geste.type === 'orbite') { cam.az -= dx * 0.008; cam.el = Math.min(1.55, Math.max(-0.6, cam.el + dy * 0.008)); }
      else deplacer(dx, dy);
      sale = true;
    });
    function deplacer(dx, dy) {
      const av = V.norm(V.sub(cam.cible, oeil)), dr = V.norm(V.cross(av, [0, 0, 1])), ha = V.cross(dr, av);
      const k = 2 * cam.dist * Math.tan(cam.fov / 2) / Math.max(1, canvas.clientHeight);
      cam.cible = V.add(cam.cible, V.add(V.mul(dr, -dx * k), V.mul(ha, dy * k)));
    }
    function fin(ev) {
      doigts.delete(ev.pointerId);
      const g = geste; geste = null;
      if (!g) return;
      if (g.type === 'poignee') { if (vue.surPoigneeFin) vue.surPoigneeFin(g.id, g.bouge); return; }
      if (g.type !== 'pince' && !g.bouge && g.bouton === 0 && vue.surClic) vue.surClic(vue.rayon(ev.clientX, ev.clientY), ev);
    }
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    canvas.addEventListener('wheel', ev => {
      ev.preventDefault();
      cam.dist = Math.min(3000, Math.max(15, cam.dist * Math.exp(ev.deltaY * 0.0012))); sale = true;
    }, { passive: false });

    return vue;
  };
})(globalThis.ME = globalThis.ME || {});
