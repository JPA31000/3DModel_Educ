/* Ateliers 2 et 6 — Subdivision de surface et maillage polygonal.
   Les deux partagent le même éditeur de cage (js/cage.js) : on choisit une face ou un sommet,
   on extrude, on pousse, on tire. Seule la suite change :
   - maillage polygonal : la cage est la pièce, à facettes ;
   - subdivision : la cage est adoucie par Catmull-Clark, 0 à 3 fois. */
(function (ME) {
  'use strict';
  const M = ME.M, G = ME.Cage, V = ME.V;

  function fabriquer(subdivision) {
    const A = subdivision
      ? { id: 'subdivision', nom: 'Subdivision de surface', court: 'Subdivision', accroche: 'Une cage grossière qui devient une forme lisse.' }
      : { id: 'polygone', nom: 'Maillage polygonal', court: 'Maillage', accroche: 'Des sommets, des arêtes, des faces qu’on pousse et qu’on tire.' };

    A.defaut = () => ({ cage: G.cube(40), niveau: 2, mode: 'face', selF: 1, selV: 0, pas: 10 });

    function surface(e, niveau) {
      let g = e.cage;
      for (let i = 0; i < niveau; i++) g = G.subdiviser(g);
      return G.trianguler(g);
    }
    A.construire = function (rapide) {
      const e = this.etat;
      this.tri = G.trianguler(e.cage);
      if (!subdivision) return { v: this.tri.v, f: this.tri.f, lissage: 0 };
      const m = surface(e, rapide ? Math.min(e.niveau, 2) : e.niveau);
      m.lissage = e.niveau === 0 ? 0 : 60;
      return m;
    };
    /* Après chaque geste : on repose la pièce sur le plateau. */
    function poser(e) {
      const m = subdivision ? surface(e, e.niveau) : G.trianguler(e.cage);
      let z = Infinity; for (let i = 2; i < m.v.length; i += 3) z = Math.min(z, m.v[i]);
      if (isFinite(z) && Math.abs(z) > 1e-6) G.poser(e.cage, z);
    }
    A.apresChargement = function () { const e = this.etat; e.selF = Math.min(e.selF, e.cage.f.length - 1); e.selV = Math.min(e.selV, e.cage.v.length - 1); };

    A.decor = function () {
      const e = this.etat, g = e.cage, d = { fantomes: [], fins: [], poignees: [] };
      if (subdivision) d.fantomes.push({ seg: G.aretes(g), c: [0.04, 0.42, 0.49, 0.9] });
      else d.fins.push({ seg: G.aretes(g), c: [0.1, 0.13, 0.16, 0.9] });
      if (e.mode === 'face') {
        d.fantomes.push({ seg: G.contourFace(g, e.selF), c: [0.85, 0.3, 0.05, 1] });
        d.poignees.push({ id: 'f', p: G.centre(g, e.selF), c: [0.85, 0.3, 0.05, 1], t: 12, fixe: true });
      } else {
        g.v.forEach((p, i) => d.poignees.push({ id: i, p: p.slice(), c: i === e.selV ? [0.85, 0.3, 0.05, 1] : [0.04, 0.42, 0.49, 1], t: i === e.selV ? 15 : 12 }));
      }
      return d;
    };

    A.clic = function (rayon) {
      const e = this.etat; if (e.mode !== 'face' || !this.tri) return;
      const h = M.rayon(this.tri, rayon.o, rayon.d); if (!h) return;
      e.selF = this.tri.triFace[h.tri]; ME.app.maj(); ME.app.panneau();
    };
    A.poigneeDebut = function (id) { if (typeof id === 'number') this.etat.selV = id; };
    A.poigneeGlisse = function (id, rayon, p0) {
      if (typeof id !== 'number') return;
      const p = M.rayonPlan(rayon, p0, rayon.avant); if (!p) return;
      this.etat.cage.v[id] = p.map(x => Math.round(x * 2) / 2); ME.app.maj(true);
    };
    A.poigneeFin = function () { poser(this.etat); ME.app.valider(); ME.app.panneau(); };

    A.panneau = function (el, ui) {
      const e = this.etat, g = e.cage;
      const agir = fn => () => { fn(); poser(e); ME.app.valider(); ME.app.panneau(); };
      ui.note(el, subdivision
        ? 'Le fil de fer bleu est la <b>cage</b> : c’est elle que tu modifies. La forme lisse la suit. Clique une face de la cage pour la choisir.'
        : 'Clique une <b>face</b> pour la choisir, puis extrude-la. En mode Sommets, tire les points un par un.');
      if (subdivision) ui.curseur(el, { nom: 'Niveau de subdivision', obj: e, cle: 'niveau', min: 0, max: 3, pas: 1, aide: 'À chaque niveau, chaque face est recoupée en 4 et les angles sont adoucis.', apres: () => poser(e) });
      ui.choix(el, { nom: 'Je modifie', obj: e, cle: 'mode', options: [['face', 'Les faces'], ['sommet', 'Les sommets']], refaire: true });
      if (e.mode === 'face') {
        ui.titre(el, 'Face choisie : n° ' + (e.selF + 1) + ' sur ' + g.f.length);
        ui.curseur(el, { nom: 'Distance', obj: e, cle: 'pas', min: 1, max: 40, pas: 1, unite: 'mm', sansMaj: true });
        const plein = g.f.length >= 220;
        ui.boutons(el, [
          ['Extruder', agir(() => G.extruder(g, e.selF, e.pas, 0)), { fort: true, inactif: plein }],
          ['Insérer une face', agir(() => G.extruder(g, e.selF, 0, 0.3)), { inactif: plein }]
        ]);
        ui.boutons(el, [
          ['Tirer', agir(() => G.deplacerFace(g, e.selF, V.mul(G.normale(g, e.selF), 2)))],
          ['Pousser', agir(() => G.deplacerFace(g, e.selF, V.mul(G.normale(g, e.selF), -2)))],
          ['Agrandir', agir(() => G.echelleFace(g, e.selF, 1.15))],
          ['Rétrécir', agir(() => G.echelleFace(g, e.selF, 0.85))]
        ]);
        ui.boutons(el, [
          ['← X', agir(() => G.deplacerFace(g, e.selF, [-2, 0, 0]))], ['X →', agir(() => G.deplacerFace(g, e.selF, [2, 0, 0]))],
          ['← Y', agir(() => G.deplacerFace(g, e.selF, [0, -2, 0]))], ['Y →', agir(() => G.deplacerFace(g, e.selF, [0, 2, 0]))]
        ]);
        if (subdivision) {
          const vive = G.estVive(g, e.selF);
          ui.boutons(el, [[vive ? 'Face plane : oui (arêtes vives)' : 'Garder cette face plane', agir(() => G.basculerVif(g, e.selF)), { actif: vive }]]);
          ui.aide(el, 'Une face « plane » garde ses arêtes vives : utile pour poser la pièce sur le plateau.');
        }
      } else {
        const p = g.v[e.selV];
        ui.titre(el, 'Sommet choisi : n° ' + (e.selV + 1) + ' sur ' + g.v.length);
        ui.info(el, 'X ' + ui.nb(p[0], 1) + ' · Y ' + ui.nb(p[1], 1) + ' · Z ' + ui.nb(p[2], 1) + ' mm');
        ui.aide(el, 'Tire un point dans la vue : il se déplace dans le plan de l’écran. Tourne la vue pour changer de direction.');
      }
    };

    A.comprendre = subdivision ? `
<p><b>Le principe.</b> On construit une <b>cage</b> grossière, faite de quelques faces à quatre côtés. Le logiciel la <b>subdivise</b> : chaque face est recoupée en quatre, puis les sommets sont déplacés vers une moyenne de leurs voisins. On recommence, et la forme devient lisse. La règle utilisée ici est celle de <b>Catmull et Clark</b> (1978).</p>
<p><b>Ce qu’on règle.</b> La cage (quelques dizaines de points) et le niveau de subdivision. Certaines arêtes peuvent rester <b>vives</b> pour garder un angle ou une face plane.</p>
<p><b>Points forts.</b> Formes organiques (personnages, poignées, objets arrondis) obtenues très vite, avec peu de points à gérer.</p>
<p><b>Limites.</b> Pas de cotes exactes : on sculpte « à l’œil ». Un perçage de 6 mm précis est difficile à obtenir.</p>
<p><b>Pour l’impression 3D.</b> Une forme toute ronde ne touche le plateau qu’en un point : il faut lui donner une <b>face plane</b> pour qu’elle accroche. Chaque niveau multiplie le nombre de triangles par 4 : le niveau 3 suffit presque toujours.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> Blender (modificateur Subdivision), Maya, 3ds Max, les « formes libres » de Fusion 360.</p>` : `
<p><b>Le principe.</b> La pièce est décrite directement par sa peau : des <b>sommets</b> (points), reliés par des <b>arêtes</b>, qui bordent des <b>faces</b>. On modèle en déplaçant ces éléments et en <b>extrudant</b> des faces.</p>
<p><b>Ce qu’on règle.</b> La position de chaque sommet, une face après l’autre. Rien n’est calculé à ta place : ce que tu vois est exactement ce qui sera exporté.</p>
<p><b>Points forts.</b> Liberté totale, résultat immédiat, fichiers légers. C’est aussi le langage de l’imprimante : un fichier STL n’est rien d’autre qu’un maillage de triangles.</p>
<p><b>Limites.</b> Les surfaces courbes sont des facettes. Les cotes ne sont pas pilotées : modifier une dimension oblige à déplacer les sommets à la main.</p>
<p><b>Pour l’impression 3D.</b> Le maillage doit être <b>étanche</b> : fermé, sans trou, chaque arête partagée par exactement deux faces. Sinon le trancheur ne sait pas où est la matière.</p>
<p class="logiciels"><b>Dans les vrais logiciels :</b> Blender, SketchUp, 3ds Max, Maya, Wings 3D.</p>`;

    A.defis = subdivision ? [
      { titre: 'De la cage à la forme lisse', texte: 'Extrude au moins une face, puis passe au niveau 3.', ok: (a, e) => e.niveau >= 3 && e.cage.f.length >= 10 && a.etanche },
      { titre: 'Bien posée', texte: 'Une forme ronde ne tient pas sur le plateau. Obtiens au moins 3 cm² de contact (pense à « Garder cette face plane »).', ok: (a, e) => a.contact >= 300 && a.etanche },
      { titre: 'Trois branches', texte: 'Fais partir trois branches du volume de départ (trois extrusions sur des faces différentes).', ok: (a, e) => e.cage.f.length >= 18 && a.etanche && a.pieces === 1 }
    ] : [
      { titre: 'Première extrusion', texte: 'Choisis une face et extrude-la : la pièce doit compter au moins 10 faces.', ok: (a, e) => e.cage.f.length >= 10 && a.etanche },
      { titre: 'Un toit en pente', texte: 'Obtiens au moins une face inclinée (ni verticale ni horizontale) : rétrécis une face ou tire un sommet.', ok: (a, e) => a.etanche && e.cage.f.some((_, i) => { const n = Math.abs(G.normale(e.cage, i)[2]); return n > 0.2 && n < 0.95; }) },
      { titre: 'Sans support', texte: 'Une pièce d’au moins 14 faces, sans aucune zone rouge.', ok: (a, e) => e.cage.f.length >= 14 && a.etanche && a.surplombAire < 20 }
    ];
    return A;
  }

  (ME.ateliers = ME.ateliers || []).push(fabriquer(true), fabriquer(false));
})(globalThis.ME = globalThis.ME || {});
