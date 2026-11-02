/* Escape The Castle - versao para navegador (Quase Games)
   Refeito em Canvas a partir do jogo original em C++/OpenGL de 2020.
   As coordenadas logicas sao as mesmas do original: tela de 600x600. */
(function () {
  'use strict';

  var VERSION = '1.1.0';
  var SITE = 'https://quasegames.com.br';
  var N = 5;               // sala de 5x5 ladrilhos
  var STEP_MS = 320;       // tempo de um passo
  var DRAIN_MS = 1500;     // ficar parado no perigo tira mais uma vida
  var MAX_LIVES = 3;

  // Ladrilhos usados nos mapas (mesmos numeros do original)
  var T = { MEDAL: 0, MEDAL_ON: 1, FLOOR: 2, PLANT: 3, CRACK: 4, CORPSES: 6, SPIKES: 7, PILLAR: 8, MOV_A: 9, MOV_B: 10 };

  // Mapa em texto: cada linha e uma coordenada c, cada letra uma coordenada l.
  // . chao | M medalhao | T medalhao certo | S estacas | C cadaveres | P coluna | A e B estacas moveis
  function deco(c, l) { var n = (c * 7 + l * 11 + c * l * 3) % 9; return n === 0 ? T.PLANT : n === 4 ? T.CRACK : T.FLOOR; }
  function makeRoom(def) {
    var map = [], targets = def.targets ? def.targets.slice() : [];
    def.rows.forEach(function (row, c) {
      var line = [];
      for (var l = 0; l < N; l++) {
        var ch = row.charAt(l);
        if (ch === 'T') { targets.push({ c: c, l: l }); line.push(T.MEDAL); }
        else if (ch === 'M') line.push(T.MEDAL);
        else if (ch === 'S') line.push(T.SPIKES);
        else if (ch === 'C') line.push(T.CORPSES);
        else if (ch === 'P') line.push(T.PILLAR);
        else if (ch === 'A') line.push(T.MOV_A);
        else if (ch === 'B') line.push(T.MOV_B);
        else line.push(deco(c, l));
      }
      map.push(line);
    });
    return { map: map, targets: targets, player: def.player, totems: def.totems, hint: def.hint };
  }
  var ROOMS = [
    // As duas salas do jogo original, com os mesmos mapas
    { map: [[2, 2, 2, 4, 0], [4, 2, 2, 7, 3], [3, 2, 2, 3, 0], [4, 2, 2, 7, 3], [2, 4, 2, 3, 0]],
      targets: [{ c: 2, l: 4 }], player: { c: 0, l: 0 }, totems: [{ c: 1, l: 1 }],
      hint: 'Empurre o totem até o medalhão certo.' },
    { map: [[2, 2, 2, 4, 2], [4, 0, 2, 0, 3], [4, 3, 6, 3, 2], [4, 0, 2, 0, 3], [2, 2, 2, 3, 2]],
      targets: [{ c: 1, l: 1 }], player: { c: 4, l: 0 }, totems: [{ c: 2, l: 3 }],
      hint: 'Outra sala, outro medalhão certo. Qual será?' },
    makeRoom({ rows: ['.....', '.....', '..T..', '.S.S.', 'M...M'],
      player: { c: 4, l: 2 }, totems: [{ c: 0, l: 2 }],
      hint: 'O totem está contra a parede. Ligue o Puxar, encoste nele e ande para trás.' }),
    makeRoom({ rows: ['...PM', '.P...', '...P.', 'P....', 'M..PT'],
      player: { c: 0, l: 0 }, totems: [{ c: 1, l: 2 }],
      hint: 'Colunas bloqueiam o caminho do monge e do totem.' }),
    makeRoom({ rows: ['M...M', '.....', 'SSS.S', '.C..C', '.C.T.'],
      player: { c: 0, l: 2 }, totems: [{ c: 1, l: 1 }],
      hint: 'O totem não atravessa estacas. Procure a passagem.' }),
    makeRoom({ rows: ['..A.M', '..B..', '..A.T', '..B..', 'M.A..'],
      player: { c: 0, l: 0 }, totems: [{ c: 2, l: 1 }],
      hint: 'Estas estacas sobem e descem a cada 2 passos. Espere a hora certa.' }),
    makeRoom({ rows: ['..T..', '.....', 'P.S.P', '.....', 'M.T..'],
      player: { c: 2, l: 1 }, totems: [{ c: 1, l: 1 }, { c: 3, l: 3 }],
      hint: 'Agora são dois totens e dois medalhões certos.' }),
    makeRoom({ rows: ['.P...', '.....', 'SP.PM', 'C....', 'M...T'],
      player: { c: 0, l: 4 }, totems: [{ c: 0, l: 2 }],
      hint: 'A coluna não deixa empurrar. Pense em puxar.' }),
    makeRoom({ rows: ['..A.T', '..B..', 'M.P.M', '..A..', '..B.T'],
      player: { c: 2, l: 1 }, totems: [{ c: 1, l: 1 }, { c: 3, l: 1 }],
      hint: 'Dois totens e estacas em movimento. Conte os passos.' }),
    makeRoom({ rows: ['M.P.T', '.....', 'PA.B.', '.S.C.', 'T...M'],
      player: { c: 2, l: 2 }, totems: [{ c: 1, l: 1 }, { c: 3, l: 2 }],
      hint: 'Última sala do castelo. Use tudo o que aprendeu.' })
  ];
  ROOMS.forEach(function (r, i) {
    var alt = i % 2 === 1;
    r.bg = alt ? 'sala2' : 'sala1'; r.bgOpen = r.bg + '-aberta'; r.tiles = alt ? 'ladrilhos2' : 'ladrilhos1'; r.gate = alt;
  });

  var DIRS = {
    right: { dc: 1, dl: 0, frame: 7 },
    left: { dc: -1, dl: 0, frame: 3 },
    up: { dc: 0, dl: 1, frame: 5 },
    down: { dc: 0, dl: -1, frame: 1 }
  };
  // Centro de cada quadro do monge, para ele nao "pular" de lado ao virar
  var FRAME_CX = [38, 41.5, 42.5, 44, 37, 39, 40.5, 37];

  var BTN = {
    a: { x: 305, y: 385, w: 195, h: 60 },   // Start / Next
    b: { x: 305, y: 480, w: 195, h: 60 },   // Exit / Menu
    instrStart: { x: 350, y: 480, w: 200, h: 68 },
    creditsMenu: { x: 345, y: 478, w: 205, h: 70 },
    pull: { x: 200, y: 8, w: 200, h: 30 },
    selectInstr: { x: 200, y: 372, w: 200, h: 34 },
    credits: { x: 340, y: 543, w: 125, h: 30 },
    playMenu: { x: 0, y: 548, w: 135, h: 52 },
    playRestart: { x: 440, y: 548, w: 160, h: 52 }
  };

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var wrap = document.getElementById('wrap');
  var controls = document.getElementById('controls');
  var pad = document.getElementById('pad');
  var btnMenu = document.getElementById('btnMenu');
  var btnRestart = document.getElementById('btnRestart');
  var btnPull = document.getElementById('btnPull');
  var soundBtn = document.getElementById('sound');
  var DEBUG = /[?&]debug=1/.test(location.search);

  /* ---------- armazenamento (pode falhar em janela anonima) ---------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem('escapecastle.' + key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem('escapecastle.' + key, JSON.stringify(value)); } catch (e) { /* sem problema */ }
  }

  /* ---------- imagens ---------- */
  var IMG = {};
  var FILES = {
    menu: 'menu.jpg', gameover: 'gameover.jpg', instrucoes: 'instrucoes.jpg',
    'instrucoes-toque': 'instrucoes-toque.jpg', creditos: 'creditos.jpg',
    sala1: 'sala1.jpg', 'sala1-aberta': 'sala1-aberta.jpg', sala2: 'sala2.jpg', 'sala2-aberta': 'sala2-aberta.jpg',
    ladrilhos1: 'ladrilhos1.png', ladrilhos2: 'ladrilhos2.png', 'ladrilhos-destaque': 'ladrilhos-destaque.png',
    monge: 'monge.png', totem: 'totem.png', vidas: 'vidas.png', coluna: 'coluna.png',
    'venceu-sala': 'venceu-sala.png', 'venceu-final': 'venceu-final.png'
  };
  var total = 0, done = 0, ready = false;
  var logo = null;

  function loadAll() {
    Object.keys(FILES).forEach(function (k) {
      total++;
      var im = new Image();
      im.onload = im.onerror = function () { done++; if (done >= total) ready = true; };
      im.src = 'assets/img/' + FILES[k];
      IMG[k] = im;
    });
    // O logo e opcional: sem o arquivo, o jogo escreve o nome em texto
    var lg = new Image();
    lg.onload = function () { logo = lg; };
    lg.src = 'assets/img/logo-quase-games.png';
  }

  /* ---------- som (sintetizado, sem arquivos) ---------- */
  var audio = null;
  var soundOn = load('som', true);
  function unlockAudio() {
    if (!audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { audio = new AC(); } catch (e) { audio = null; } }
    }
    if (audio && audio.state === 'suspended' && audio.resume) { audio.resume(); }
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!audio || !soundOn) return;
    var t = audio.currentTime + (delay || 0);
    var o = audio.createOscillator();
    var g = audio.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var SFX = {
    step: function () { tone(150, 0.05, 'triangle', 0.05, 90); },
    push: function () { tone(85, 0.17, 'sawtooth', 0.07, 55); },
    bump: function () { tone(70, 0.08, 'square', 0.05); },
    hit: function () { tone(220, 0.22, 'sawtooth', 0.13, 70); },
    wrong: function () { tone(120, 0.12, 'square', 0.06, 95); },
    medal: function () { tone(520, 0.18, 'sine', 0.12, 780); tone(780, 0.28, 'sine', 0.08, 1040, 0.08); },
    door: function () { tone(70, 0.6, 'sawtooth', 0.09, 110); tone(392, 0.2, 'sine', 0.1, null, 0.45); tone(523, 0.32, 'sine', 0.1, null, 0.62); },
    lose: function () { tone(262, 0.25, 'triangle', 0.12); tone(196, 0.3, 'triangle', 0.12, null, 0.22); tone(131, 0.55, 'triangle', 0.12, null, 0.48); },
    near: function () { tone(180, 0.22, 'sine', 0.09, 240); },
    click: function () { tone(330, 0.06, 'triangle', 0.08); }
  };
  function refreshSoundLabel() { soundBtn.textContent = soundOn ? 'Som: ligado' : 'Som: desligado'; }
  function toggleSound() { soundOn = !soundOn; save('som', soundOn); refreshSoundLabel(); unlockAudio(); SFX.click(); }

  /* ---------- estado do jogo ---------- */
  var screen = 'loading';   // loading, menu, instr, play, gameover, roomwin, finalwin, credits
  var roomIndex = 0;
  var room = ROOMS[0];
  var g = null;             // estado da sala atual
  var best = load('recordes', {});
  var progress = Math.min(load('progresso', 0), ROOMS.length - 1);
  var pendingRoom = 0;
  var touchMode = false;
  var hover = null;
  var hoverBtn = false;

  function setScreen(s) {
    screen = s;
    document.body.classList.toggle('offplay', s !== 'play');
    clearInput();
    hover = null;
    canvas.style.cursor = 'default';
  }

  function startRoom(i) {
    roomIndex = i;
    room = ROOMS[i];
    var medals = [];
    var c, l;
    for (c = 0; c < N; c++) for (l = 0; l < N; l++) {
      if (room.map[c][l] === T.MEDAL) medals.push({ c: c, l: l, on: false, target: isTarget(c, l) });
    }
    g = {
      p: { c: room.player.c, l: room.player.l, fc: room.player.c, fl: room.player.l, t: 1 },
      totems: room.totems.map(function (o) { return { c: o.c, l: o.l, fc: o.c, fl: o.l, t: 1 }; }),
      moved: -1, pullOn: false,
      frame: 0, moving: false, moveAt: 0,
      lives: MAX_LIVES, steps: 0, medals: medals,
      drain: 0, flash: 0, shake: 0, wrongPulse: null, bump: 0,
      won: false, wonAt: 0, doorOpen: false, dead: false, deadAt: 0,
      hint: room.hint, hintAt: 0, stuck: false
    };
    refreshPull();
    setScreen('play');
  }

  function isTarget(c, l) { return room.targets.some(function (t) { return t.c === c && t.l === l; }); }
  function inBounds(c, l) { return c >= 0 && c < N && l >= 0 && l < N; }
  function medalAt(c, l) {
    for (var i = 0; i < g.medals.length; i++) if (g.medals[i].c === c && g.medals[i].l === l) return g.medals[i];
    return null;
  }
  function medalsOn() { var n = 0; g.medals.forEach(function (m) { if (m.on) n++; }); return n; }
  function totemAt(tots, c, l) {
    for (var i = 0; i < tots.length; i++) if (tots[i][0] === c && tots[i][1] === l) return i;
    return -1;
  }
  function totemList() { return g.totems.map(function (o) { return [o.c, o.l]; }); }

  // Estacas moveis: trocam a cada 2 passos do monge
  function movUp(id, steps) {
    var q = Math.floor(steps / 2) % 2;
    return id === T.MOV_A ? q === 0 : id === T.MOV_B ? q === 1 : false;
  }
  function hazardAt(r, c, l, steps) {
    var t = r.map[c][l];
    return t === T.SPIKES || t === T.CORPSES || movUp(t, steps);
  }
  function totemBlocked(r, c, l, tots, steps) {
    if (!inBounds(c, l)) return true;
    var t = r.map[c][l];
    return t === T.PILLAR || t === T.SPIKES || movUp(t, steps) || totemAt(tots, c, l) !== -1;
  }

  // Regra unica do movimento, usada pelo jogo e pela busca de solucao
  function ruleMove(r, pc, pl, tots, steps, name, pull) {
    var d = DIRS[name], nc = pc + d.dc, nl = pl + d.dl, after = steps + 1;
    if (!inBounds(nc, nl) || r.map[nc][nl] === T.PILLAR) return null;
    var next = tots.map(function (o) { return [o[0], o[1]]; });
    var idx = totemAt(tots, nc, nl);
    if (idx !== -1) {
      if (totemBlocked(r, nc + d.dc, nl + d.dl, tots, after)) return null;
      next[idx] = [nc + d.dc, nl + d.dl];
      return { c: nc, l: nl, tots: next, moved: idx, pulled: false };
    }
    if (pull) {
      var back = totemAt(tots, pc - d.dc, pl - d.dl);
      if (back !== -1 && !totemBlocked(r, pc, pl, tots, after)) {
        next[back] = [pc, pl];
        return { c: nc, l: nl, tots: next, moved: back, pulled: true };
      }
    }
    return { c: nc, l: nl, tots: next, moved: -1, pulled: false };
  }

  // Busca a solucao mais curta: leva todos os totens aos medalhoes certos
  function solve(r, pc, pl, tots, steps, opts) {
    opts = opts || {};
    var names = Object.keys(DIRS);
    function done(list) {
      return r.targets.every(function (t) { return totemAt(list, t.c, t.l) !== -1; });
    }
    function key(c, l, list, st) {
      return c + ',' + l + ',' + list.map(function (o) { return o[0] * 5 + o[1]; }).sort().join('.') + ',' + (st % 4);
    }
    if (done(tots)) return [];
    var q = [{ c: pc, l: pl, tots: tots, st: steps, prev: null, name: null, pull: false }];
    var seen = {};
    seen[key(pc, pl, tots, steps)] = 1;
    for (var h = 0; h < q.length; h++) {
      var s = q[h];
      for (var i = 0; i < 4; i++) {
        for (var w = 0; w < (opts.noPull ? 1 : 2); w++) {
          var m = ruleMove(r, s.c, s.l, s.tots, s.st, names[i], w === 1);
          if (!m || (w === 1 && !m.pulled)) continue;
          if (opts.avoidHazard && hazardAt(r, m.c, m.l, s.st + 1)) continue;
          var k = key(m.c, m.l, m.tots, s.st + 1);
          if (seen[k]) continue;
          seen[k] = 1;
          var node = { c: m.c, l: m.l, tots: m.tots, st: s.st + 1, prev: s, name: names[i], pull: m.pulled };
          if (done(m.tots)) {
            var path = [];
            for (var n = node; n.prev; n = n.prev) path.unshift({ dir: n.name, pull: n.pull });
            return path;
          }
          q.push(node);
        }
      }
    }
    return null;
  }

  var OPPOSITE = { right: 'left', left: 'right', up: 'down', down: 'up' };
  function tryStep(name, now) {
    if (!g || g.moving || g.won || g.dead) return;
    g.frame = DIRS[name].frame;
    var m = ruleMove(room, g.p.c, g.p.l, totemList(), g.steps, name, g.pullOn);
    if (!m) {
      var d = DIRS[name];
      if (totemAt(totemList(), g.p.c + d.dc, g.p.l + d.dl) !== -1) {
        say('Não dá para empurrar por aqui. Tente ' + (touchMode ? 'ligar o Puxar.' : 'puxar (Espaço).'), now);
      }
      bump(now);
      return;
    }
    if (m.moved !== -1) {
      var o = g.totems[m.moved];
      o.fc = o.c; o.fl = o.l; o.c = m.tots[m.moved][0]; o.l = m.tots[m.moved][1]; o.t = 0;
    }
    g.moved = m.moved;
    if (m.pulled) g.frame = DIRS[OPPOSITE[name]].frame;
    g.p.fc = g.p.c; g.p.fl = g.p.l; g.p.c = m.c; g.p.l = m.l; g.p.t = 0;
    g.moving = true; g.moveAt = now;
    g.steps++;
    if (m.moved !== -1) SFX.push(); else SFX.step();
  }
  function bump(now) {
    if (now - g.bump > 260) { g.bump = now; SFX.bump(); }
  }

  function arrive(now) {
    g.moving = false;
    g.p.t = 1;
    g.totems.forEach(function (o) { o.t = 1; });
    if (g.moved !== -1) {
      var moved = g.totems[g.moved];
      g.moved = -1;
      var tots = totemList();
      var covered = 0;
      var hadOn = medalsOn() > 0;
      var newly = false;
      g.medals.forEach(function (m) {
        if (!m.target) return;
        var has = totemAt(tots, m.c, m.l) !== -1;
        if (has && !m.on) newly = true;
        m.on = has;
        if (has) covered++;
      });
      var allCovered = covered === room.targets.length;
      if (!allCovered) g.medals.forEach(function (m) { if (!m.target) m.on = false; });
      if (newly) {
        SFX.medal();
        if (allCovered) say((room.targets.length > 1 ? 'Os totens encaixaram! ' : 'O totem encaixou! ') + 'Agora ' + (touchMode ? 'toque' : 'clique') + ' nos outros medalhões.', now);
        else say('Um totem encaixou. Falta o outro.', now);
      } else if (hadOn && medalsOn() === 0) {
        say('O totem saiu do lugar e os medalhões apagaram.', now);
      }
      if (!newly) {
        var wrong = medalAt(moved.c, moved.l);
        g.stuck = !solve(room, g.p.c, g.p.l, tots, g.steps);
        if (wrong && !wrong.target) {
          SFX.wrong();
          say('Esse não é o medalhão certo. Tente outro.', now);
        } else if (nearTarget(moved, tots)) {
          SFX.near();
          say('O totem vibra... um medalhão certo está perto.', now);
        }
        if (g.stuck) say('O totem ficou preso. Reinicie a sala.', now);
      } else {
        g.stuck = false;
      }
      checkWin(now);
    }
    g.drain = now;
    if (hazardAt(room, g.p.c, g.p.l, g.steps)) hurt(now);
  }
  function nearTarget(o, tots) {
    return room.targets.some(function (t) {
      return totemAt(tots, t.c, t.l) === -1 && Math.abs(t.c - o.c) + Math.abs(t.l - o.l) === 1;
    });
  }

  function hurt(now) {
    if (g.won || g.dead) return;
    g.lives--;
    g.flash = now; g.shake = now; g.drain = now;
    SFX.hit();
    if (g.lives <= 0) {
      g.dead = true; g.deadAt = now;
      setTimeout(SFX.lose, 250);
    } else {
      say(room.map[g.p.c][g.p.l] === T.CORPSES ? 'Os cadáveres tiram vida. Saia daí!' : 'Ai! As estacas machucam. Saia daí!', now);
    }
  }

  function say(text, now) { g.hint = text; g.hintAt = now; }

  function allTargetsCovered() {
    var tots = totemList();
    return room.targets.every(function (t) { return totemAt(tots, t.c, t.l) !== -1; });
  }

  function clickMedal(m, now) {
    if (g.won || g.dead) return;
    if (!allTargetsCovered()) {
      g.wrongPulse = { c: m.c, l: m.l, at: now };
      SFX.wrong();
      say(room.targets.length > 1
        ? 'Nada acontece. Os dois totens precisam estar nos medalhões certos.'
        : 'Nada acontece. O totem precisa estar sobre o medalhão certo.', now);
      return;
    }
    if (m.on) return;
    m.on = true;
    SFX.medal();
    var left = g.medals.length - medalsOn();
    if (left > 0) say(left === 1 ? 'Falta 1 medalhão.' : 'Faltam ' + left + ' medalhões.', now);
    checkWin(now);
  }

  function checkWin(now) {
    if (g.won || medalsOn() < g.medals.length) return;
    g.won = true; g.wonAt = now;
    clearInput();
    say(room.gate ? 'O portão abriu!' : 'A porta abriu!', now);
    var key = 'sala' + (roomIndex + 1);
    g.newBest = !best[key] || g.steps < best[key];
    if (g.newBest) { best[key] = g.steps; save('recordes', best); }
    if (roomIndex + 1 < ROOMS.length && roomIndex + 1 > progress) { progress = roomIndex + 1; save('progresso', progress); }
  }

  function togglePull() {
    if (!g) return;
    g.pullOn = !g.pullOn;
    SFX.click();
    refreshPull();
  }
  function refreshPull() {
    var on = !!(g && g.pullOn);
    btnPull.classList.toggle('on', on);
    btnPull.textContent = on ? 'Puxar: ligado' : 'Puxar';
  }

  /* ---------- entrada: direcao segurada e toque rapido guardado ---------- */
  var held = [];
  var queued = null;
  function pressDir(name) {
    if (held.indexOf(name) === -1) held.push(name);
    queued = name;
  }
  function releaseDir(name) {
    var i = held.indexOf(name);
    if (i !== -1) held.splice(i, 1);
  }
  function clearInput() {
    held.length = 0; queued = null;
    var on = pad.querySelectorAll('.dir.on');
    for (var i = 0; i < on.length; i++) on[i].classList.remove('on');
  }

  var KEYS = {
    ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down',
    d: 'right', a: 'left', w: 'up', s: 'down', D: 'right', A: 'left', W: 'up', S: 'down'
  };
  window.addEventListener('keydown', function (e) {
    unlockAudio();
    if (touchMode && !window.matchMedia('(pointer: coarse)').matches) setTouch(false);
    var dir = KEYS[e.key];
    if (dir) {
      e.preventDefault();
      if (screen === 'play' && !e.repeat) pressDir(dir);
      return;
    }
    if (e.repeat) return;
    if (e.key === 'r' || e.key === 'R') { if (screen === 'play') startRoom(roomIndex); }
    else if (e.key === 'm' || e.key === 'M') toggleSound();
    else if (e.key === ' ' && screen === 'play') { e.preventDefault(); togglePull(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); primaryAction(); }
  });
  window.addEventListener('keyup', function (e) { var d = KEYS[e.key]; if (d) releaseDir(d); });
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearInput(); });

  function openStart() {
    if (progress > 0) setScreen('select');
    else { pendingRoom = 0; setScreen('instr'); }
  }
  function primaryAction() {
    if (screen === 'menu') { SFX.click(); openStart(); }
    else if (screen === 'select') { SFX.click(); startRoom(progress); }
    else if (screen === 'instr') { SFX.click(); startRoom(pendingRoom); }
    else if (screen === 'gameover') { SFX.click(); startRoom(roomIndex); }
    else if (screen === 'roomwin') { SFX.click(); startRoom(roomIndex + 1); }
    else if (screen === 'finalwin') { SFX.click(); setScreen('credits'); }
    else if (screen === 'credits') { SFX.click(); setScreen('menu'); }
  }

  /* direcional de toque: cada botao acompanha o proprio dedo */
  Array.prototype.forEach.call(pad.querySelectorAll('.dir'), function (b) {
    var name = b.getAttribute('data-dir');
    function up() { b.classList.remove('on'); releaseDir(name); }
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); unlockAudio();
      if (b.setPointerCapture) { try { b.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } }
      b.classList.add('on'); pressDir(name);
    });
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  });
  btnMenu.addEventListener('click', function () { unlockAudio(); SFX.click(); setScreen('menu'); });
  btnRestart.addEventListener('click', function () { unlockAudio(); SFX.click(); startRoom(roomIndex); });
  btnPull.addEventListener('click', function () { unlockAudio(); togglePull(); });
  soundBtn.addEventListener('click', toggleSound);

  // Safari: bloqueia zoom por pinca e toque duplo
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); });
  });
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    var free = e.target.closest && e.target.closest('#bar, .side');
    if (now - lastTouchEnd < 350 && !free) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- mouse e toque na tela ---------- */
  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 600 / r.width, y: (e.clientY - r.top) * 600 / r.height };
  }
  function inRect(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }
  function pickTile(p) {
    var u = (p.x - 60) / 60, v = (p.y - 300) / 30;
    var c = Math.round((u + v) / 2), l = Math.round((u - v) / 2);
    return inBounds(c, l) ? { c: c, l: l } : null;
  }
  function selectRect(i) {
    return { x: 80 + (i % 5) * 90, y: 130 + Math.floor(i / 5) * 105, w: 80, h: 90 };
  }
  function buttonsFor(s) {
    if (s === 'menu') return [[BTN.a, 'start'], [BTN.b, 'exit'], [BTN.credits, 'credits']];
    if (s === 'instr') return [[BTN.instrStart, 'play']];
    if (s === 'gameover') return [[BTN.a, 'retry'], [BTN.b, 'menu']];
    if (s === 'roomwin') return [[BTN.a, 'next'], [BTN.b, 'menu']];
    if (s === 'finalwin') return [[BTN.a, 'credits'], [BTN.b, 'menu']];
    if (s === 'credits') return [[BTN.creditsMenu, 'menu'], [{ x: 150, y: 384, w: 300, h: 24 }, 'exit']];
    if (s === 'play') return [[BTN.playMenu, 'menu'], [BTN.playRestart, 'restart'], [BTN.pull, 'pull']];
    if (s === 'select') {
      var list = [[BTN.creditsMenu, 'menu'], [BTN.selectInstr, 'howto']];
      for (var i = 0; i <= progress; i++) list.push([selectRect(i), 'room' + i]);
      return list;
    }
    return [];
  }
  function act(a) {
    if (a === 'pull') { togglePull(); return; }
    SFX.click();
    if (a.indexOf('room') === 0) { startRoom(parseInt(a.slice(4), 10)); return; }
    if (a === 'start') openStart();
    else if (a === 'howto') { pendingRoom = progress; setScreen('instr'); }
    else if (a === 'exit') location.href = SITE;
    else if (a === 'credits') setScreen('credits');
    else if (a === 'play') startRoom(pendingRoom);
    else if (a === 'retry' || a === 'restart') startRoom(roomIndex);
    else if (a === 'next') startRoom(roomIndex + 1);
    else if (a === 'menu') setScreen('menu');
  }
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (e.pointerType === 'touch') setTouch(true);
    unlockAudio();
    if (!ready) return;
    var p = toLogical(e);
    var list = buttonsFor(screen);
    for (var i = 0; i < list.length; i++) {
      if (inRect(p, list[i][0])) { act(list[i][1]); return; }
    }
    if (screen === 'play') {
      var t = pickTile(p);
      if (t) {
        var m = medalAt(t.c, t.l);
        if (m) clickMedal(m, performance.now());
      }
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var p = toLogical(e);
    var overBtn = buttonsFor(screen).some(function (b) { return inRect(p, b[0]); });
    hover = null;
    if (screen === 'play' && !overBtn) {
      var t = pickTile(p);
      if (t && medalAt(t.c, t.l)) hover = t;
    }
    canvas.style.cursor = overBtn || hover ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', function () { hover = null; });

  /* ---------- layout da pagina ---------- */
  function setTouch(on) {
    if (touchMode === on) return;
    touchMode = on;
    document.body.classList.toggle('touch', on);
    layout();
  }
  var BAR = 40;
  function layout() {
    var vv = window.visualViewport;
    var W = vv ? vv.width : window.innerWidth;
    var H = vv ? vv.height : window.innerHeight;
    var availH = H - BAR;
    var side, x, y;
    if (!touchMode) {
      side = Math.floor(Math.min(W, availH));
      x = Math.floor((W - side) / 2); y = BAR + Math.floor((availH - side) / 2);
    } else if (H >= W) {
      // celular em pe: jogo em cima, controles embaixo
      var padSize = Math.min(176, Math.floor(W * 0.44));
      var areaH = padSize + 16;
      side = Math.floor(Math.min(W, availH - areaH));
      x = Math.floor((W - side) / 2); y = BAR;
      setBox(controls, 0, H - areaH - Math.max(0, availH - areaH - side) / 2, W, areaH);
      setBox(pad, Math.floor((W - padSize) / 2), 8, padSize, padSize);
      var rightX = Math.min(W - 90, Math.floor(W - (W - padSize) / 4 - 42));
      setBox(btnPull, Math.max(6, Math.floor((W - padSize) / 4 - 42)), areaH / 2 - 22);
      setBox(btnMenu, rightX, areaH / 2 - 50);
      setBox(btnRestart, rightX, areaH / 2 + 6);
    } else {
      // celular deitado: jogo no meio, direcional a esquerda e botoes a direita
      var ps = Math.min(170, Math.floor((W - Math.min(W, availH)) / 2) - 12, availH - 16);
      ps = Math.max(ps, 112);
      side = Math.floor(Math.min(availH, W - 2 * (ps + 16)));
      x = Math.floor((W - side) / 2); y = BAR + Math.floor((availH - side) / 2);
      setBox(controls, 0, BAR, W, availH);
      setBox(pad, 8, availH - ps - 8, ps, ps);
      setBox(btnPull, W - 92, availH - 164);
      setBox(btnMenu, W - 92, availH - 110);
      setBox(btnRestart, W - 92, availH - 56);
    }
    wrap.style.left = x + 'px'; wrap.style.top = y + 'px';
    wrap.style.width = side + 'px'; wrap.style.height = side + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.max(300, Math.round(side * dpr));
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
  }
  function setBox(el, x, y, w, h) {
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (w !== undefined) { el.style.width = w + 'px'; el.style.height = h + 'px'; }
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 150); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);

  /* ---------- desenho ---------- */
  function tileX(c, l) { return 60 + (c + l) * 60; }
  function tileY(c, l) { return 300 + (c - l) * 30; }
  function drawFull(name) { ctx.drawImage(IMG[name], 0, 0, 600, 600); }

  function drawTile(sheet, id, c, l) {
    var col = id % 6, row = Math.floor(id / 5);
    var x = tileX(c, l), y = tileY(c, l);
    ctx.drawImage(sheet, col * 200, row * 100, 200, 100, x - 60.5, y - 30.5, 121, 61);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawActors(now) {
    var list = [];
    var pc = lerp(g.p.fc, g.p.c, g.p.t), pl = lerp(g.p.fl, g.p.l, g.p.t);
    list.push({ d: pc - pl, draw: function () { drawMonk(pc, pl, now); } });
    g.totems.forEach(function (o) {
      var oc = lerp(o.fc, o.c, o.t), ol = lerp(o.fl, o.l, o.t);
      list.push({ d: oc - ol, draw: function () { drawTotem(oc, ol, now, o); } });
    });
    for (var c = 0; c < N; c++) for (var l = 0; l < N; l++) {
      if (room.map[c][l] === T.PILLAR) list.push({ d: c - l, draw: drawPillar.bind(null, c, l) });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    list.forEach(function (it) { it.draw(); });
  }

  function drawPillar(c, l) {
    ctx.drawImage(IMG.coluna, tileX(c, l) - 60, tileY(c, l) - 30 - 28, 120, 88);
  }

  function shadow(x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawTotem(c, l, now, o) {
    var x = tileX(c, l), y = tileY(c, l);
    shadow(x, y + 7, 28, 11);
    if (o.t >= 1 && isTarget(o.c, o.l)) {
      var a = 0.25 + 0.15 * Math.sin(now / 260);
      var gr = ctx.createRadialGradient(x, y - 18, 8, x, y - 18, 64);
      gr.addColorStop(0, 'rgba(120,230,255,' + a + ')'); gr.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 64, y - 82, 128, 128);
    }
    ctx.drawImage(IMG.totem, x - 30, y - 58, 60, 70);
  }

  function drawMonk(c, l, now) {
    var x = tileX(c, l), y = tileY(c, l);
    var f = g.frame;
    var bob = g.moving ? Math.abs(Math.sin(g.p.t * Math.PI)) * 5 : Math.sin(now / 480) * 0.7;
    if (g.pullOn) {
      ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(x, y + 5, 27, 13, 0, 0, Math.PI * 2); ctx.stroke();
    }
    shadow(x, y + 5, 20, 9);
    if (g.dead) ctx.globalAlpha = 0.5;
    var hurtBlink = now - g.flash < 400 && Math.floor(now / 70) % 2 === 0;
    if (hurtBlink) ctx.globalAlpha = 0.45;
    var s = 0.86;
    var cx = FRAME_CX[f] * s;
    ctx.drawImage(IMG.monge, f * 80, 0, 80, 130, x - cx, y + 8 - 130 * s - bob, 80 * s, 130 * s);
    ctx.globalAlpha = 1;
  }

  // Na primeira sala, mostra qual seta leva para cada ladrilho
  function drawKeyHints() {
    [['right', '\u2192'], ['left', '\u2190'], ['up', '\u2191'], ['down', '\u2193']].forEach(function (h) {
      var d = DIRS[h[0]], c = g.p.c + d.dc, l = g.p.l + d.dl;
      if (!inBounds(c, l)) return;
      var x = tileX(c, l), y = tileY(c, l) - 2;
      ctx.fillStyle = 'rgba(20,14,8,.82)';
      ctx.fillRect(x - 15, y - 15, 30, 30);
      ctx.strokeStyle = '#e9d9b0'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 15, y - 15, 30, 30);
      ctx.fillStyle = '#efe0b8'; ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(h[1], x, y + 1);
      ctx.textBaseline = 'alphabetic';
    });
  }

  function textShadow(str, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = '#efe0b8'; ctx.fillText(str, x, y);
  }

  function wrapLines(str, maxW) {
    var words = str.split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawRoom(now, overlay) {
    var sh = 0;
    if (g.shake && now - g.shake < 260) sh = Math.sin(now / 18) * 4 * (1 - (now - g.shake) / 260);
    ctx.save();
    ctx.translate(sh, 0);
    drawFull(g.doorOpen ? room.bgOpen : room.bg);
    var c, l;
    for (c = 0; c < N; c++) for (l = 0; l < N; l++) {
      var raw = room.map[c][l];
      var id = raw === T.PILLAR || raw === T.MOV_A || raw === T.MOV_B ? T.FLOOR : raw;
      var m = medalAt(c, l);
      if (m && m.on) id = T.MEDAL_ON;
      var isHover = hover && hover.c === c && hover.l === l;
      var isWrong = g.wrongPulse && g.wrongPulse.c === c && g.wrongPulse.l === l && now - g.wrongPulse.at < 260;
      drawTile(IMG[(isHover || isWrong) ? 'ladrilhos-destaque' : room.tiles], id, c, l);
      if (raw === T.MOV_A || raw === T.MOV_B) {
        ctx.globalAlpha = movUp(raw, g.steps) ? 1 : 0.22;
        drawTile(IMG[room.tiles], T.SPIKES, c, l);
        ctx.globalAlpha = 1;
      }
      if (m && m.on) {
        var a = 0.28 + 0.14 * Math.sin(now / 300 + c);
        var x = tileX(c, l), y = tileY(c, l);
        ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.5);
        var gr = ctx.createRadialGradient(0, 0, 4, 0, 0, 56);
        gr.addColorStop(0, 'rgba(90,220,255,' + a + ')'); gr.addColorStop(1, 'rgba(90,220,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    drawActors(now);
    if (roomIndex === 0 && !touchMode && g.steps < 4 && !g.moving) drawKeyHints();
    ctx.restore();

    // vermelho do dano
    if (now - g.flash < 300) {
      ctx.fillStyle = 'rgba(170,20,20,' + (0.35 * (1 - (now - g.flash) / 300)) + ')';
      ctx.fillRect(0, 0, 600, 600);
    }
    if (overlay) return;

    // vidas
    if (g.lives > 0) ctx.drawImage(IMG.vidas, (g.lives - 1) * 90, 0, 90, 30, 10, 10, 90, 30);

    // puxar
    ctx.fillStyle = g.pullOn ? '#d9a441' : 'rgba(15,10,6,.78)';
    ctx.fillRect(BTN.pull.x, BTN.pull.y, BTN.pull.w, BTN.pull.h);
    ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 1.5;
    ctx.strokeRect(BTN.pull.x, BTN.pull.y, BTN.pull.w, BTN.pull.h);
    ctx.fillStyle = g.pullOn ? '#20140a' : '#efe0b8';
    ctx.font = 'bold 15px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((g.pullOn ? 'Puxar: ligado' : 'Puxar: desligado') + (touchMode ? '' : ' (Espaço)'), BTN.pull.x + BTN.pull.w / 2, BTN.pull.y + BTN.pull.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    // sala e passos
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 16px Georgia, serif';
    textShadow('Sala ' + (roomIndex + 1) + ' de ' + ROOMS.length, 590, 26);
    ctx.font = '14px Georgia, serif';
    var rec = best['sala' + (roomIndex + 1)];
    textShadow('Passos: ' + g.steps + (rec ? '  (recorde: ' + rec + ')' : ''), 590, 46);

    // dica
    if (g.hint) {
      ctx.font = '15px Georgia, serif'; ctx.textAlign = 'center';
      var lines = wrapLines(g.hint, 285).slice(0, 2);
      ctx.fillStyle = 'rgba(15,10,6,.72)';
      ctx.fillRect(132, 553, 310, 42);
      var y0 = lines.length > 1 ? 570 : 579;
      lines.forEach(function (t, i) { textShadow(t, 287, y0 + i * 18); });
    }
  }

  function drawLogo(cx, cy, maxW, dark, maxH) {
    if (logo) {
      var k = Math.min(maxW / logo.width, (maxH || 100) / logo.height);
      var w = logo.width * k, h = logo.height * k;
      if (dark) {
        // O texto do logo e branco: um halo escuro atras garante a leitura no pergaminho
        var r = Math.max(w, h) * 0.72;
        var gr = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
        gr.addColorStop(0, 'rgba(35,22,12,.82)'); gr.addColorStop(1, 'rgba(35,22,12,0)');
        ctx.fillStyle = gr; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
      return;
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = dark ? '#3a2511' : '#efe0b8';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('QUASE GAMES', cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  function paragraph(lines, y, lh) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#3a2511';
    lines.forEach(function (t) {
      wrapLines(t, 440).forEach(function (s) { ctx.fillText(s, 300, y); y += lh; });
    });
    return y;
  }

  function tileAt(sheet, id, x, y, k) {
    var col = id % 6, row = Math.floor(id / 5);
    ctx.drawImage(sheet, col * 200, row * 100, 200, 100, x - 60 * k, y - 30 * k, 120 * k, 60 * k);
  }

  function instrRow(y, title, body) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#3a2511';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(title, 190, y);
    ctx.font = '16px Georgia, serif';
    wrapLines(body, 335).slice(0, 2).forEach(function (t, i) { ctx.fillText(t, 190, y + 21 + i * 19); });
  }

  function drawInstr() {
    drawFull('instrucoes-toque');
    var sheet = IMG.ladrilhos1;
    var k = 0.62;

    // 1: empurrar
    ctx.drawImage(IMG.monge, 7 * 80, 0, 80, 130, 62, 108, 44, 72);
    ctx.drawImage(IMG.totem, 110, 128, 42, 49);
    instrRow(128, '1. Empurre o totem', touchMode
      ? 'Ande contra o totem para empurrar. Para puxar, ligue o botão Puxar e ande para trás.'
      : 'Use as setas e ande contra o totem. Para puxar, aperte Espaço e ande para trás.');

    // 2: medalhao certo
    tileAt(sheet, T.MEDAL_ON, 110, 233, k + 0.2);
    ctx.drawImage(IMG.totem, 92, 191, 36, 42);
    instrRow(208, '2. Ache o medalhão certo', 'Leve o totem até um medalhão. O certo acende em azul e o totem vibra quando está perto.');

    // 3: ativar os outros
    tileAt(sheet, T.MEDAL, 80, 310, k);
    tileAt(sheet, T.MEDAL_ON, 140, 310, k);
    instrRow(288, '3. Ative os outros', (touchMode ? 'Toque' : 'Clique') + ' nos outros medalhões. Com todos acesos, a saída abre.');

    // cuidado
    tileAt(sheet, T.SPIKES, 80, 388, k);
    tileAt(sheet, T.CORPSES, 140, 388, k);
    instrRow(368, 'Cuidado', touchMode
      ? 'Estacas e cadáveres tiram vida. O totem não atravessa estacas nem colunas.'
      : 'Estacas e cadáveres tiram vida. O totem não atravessa estacas. R reinicia a sala.');
  }

  function drawSelect() {
    drawFull('creditos');
    ctx.textAlign = 'center'; ctx.fillStyle = '#3a2511';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('ESCOLHA A SALA', 300, 92);
    for (var i = 0; i < ROOMS.length; i++) {
      var b = selectRect(i), open = i <= progress;
      ctx.fillStyle = open ? '#6d5233' : 'rgba(80,62,40,.28)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = open ? '#3a2511' : 'rgba(58,37,17,.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = open ? '#f3e6c4' : 'rgba(58,37,17,.5)';
      ctx.font = 'bold 28px Georgia, serif';
      ctx.fillText(String(i + 1), b.x + b.w / 2, b.y + 44);
      var rec = best['sala' + (i + 1)];
      ctx.font = '13px Georgia, serif';
      ctx.fillText(rec ? rec + ' passos' : (open ? 'Nova' : 'Trancada'), b.x + b.w / 2, b.y + 72);
    }
    ctx.fillStyle = '#5b2c0c'; ctx.font = 'italic bold 17px Georgia, serif';
    ctx.fillText('Ver instruções', 300, 394);
  }

  function drawCredits() {
    drawFull('creditos');
    ctx.textAlign = 'center'; ctx.fillStyle = '#3a2511';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('CRÉDITOS', 300, 90);
    ctx.font = '16px Georgia, serif';
    paragraph([
      'Criado por Sander Gabriel dos Reis em 2020, em C++ e OpenGL, como trabalho da disciplina de Processamento Gráfico da UNISINOS, com o professor Leandro Tonietto.',
      '',
      'Versão para navegador: Quase Games, uma marca da Quase Studios.'
    ], 124, 22);
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = '#3a2511';
    ctx.fillText('Grandes ideias começam com um quase.', 300, 292);
    drawLogo(300, 342, 200, true, 70);
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillStyle = '#5b2c0c';
    ctx.fillText('quasegames.com.br', 300, 398);
    ctx.font = '12px Georgia, serif';
    ctx.fillStyle = '#3a2511';
    ctx.fillText('Versão ' + VERSION, 300, 416);
  }

  function drawStepsSummary(dark) {
    ctx.textAlign = 'center';
    ctx.font = '16px Georgia, serif';
    var txt = 'Passos: ' + g.steps + (g.newBest ? ' (novo recorde!)' : '  ·  recorde: ' + best['sala' + (roomIndex + 1)]);
    if (dark) { ctx.fillStyle = '#3a2511'; ctx.fillText(txt, 170, 450); }
    else textShadow(txt, 170, 450);
  }

  function update(now, dt) {
    if (screen !== 'play' || !g) return;
    if (g.moving) {
      var t = Math.min(1, (now - g.moveAt) / STEP_MS);
      g.p.t = t;
      if (g.moved !== -1) g.totems[g.moved].t = t;
      if (t >= 1) arrive(now);
    }
    if (!g.moving && !g.won && !g.dead) {
      var name = queued || (held.length ? held[held.length - 1] : null);
      queued = null;
      if (name) tryStep(name, now);
      else if (hazardAt(room, g.p.c, g.p.l, g.steps) && now - g.drain > DRAIN_MS) hurt(now);
    }
    if (g.won) {
      if (!g.doorOpen && now - g.wonAt > 450) { g.doorOpen = true; SFX.door(); }
      if (now - g.wonAt > 1800) setScreen(roomIndex + 1 < ROOMS.length ? 'roomwin' : 'finalwin');
    }
    if (g.dead && now - g.deadAt > 900) setScreen('gameover');
  }

  function render(now) {
    var k = canvas.width / 600;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (!ready) {
      ctx.fillStyle = '#14100c'; ctx.fillRect(0, 0, 600, 600);
      ctx.fillStyle = '#6d5233'; ctx.fillRect(150, 296, 300, 8);
      ctx.fillStyle = '#e9d9b0'; ctx.fillRect(150, 296, 300 * (total ? done / total : 0), 8);
      return;
    }
    if (screen === 'loading') setScreen('menu');
    if (screen === 'menu') {
      drawFull('menu');
      drawLogo(165, 480, 190, true);
      ctx.textAlign = 'center'; ctx.fillStyle = '#3a2511'; ctx.font = 'italic bold 17px Georgia, serif';
      ctx.fillText('Créditos', 402, 564);
    } else if (screen === 'select') {
      drawSelect();
    } else if (screen === 'instr') {
      drawInstr();
    } else if (screen === 'play') {
      drawRoom(now, false);
    } else if (screen === 'gameover') {
      drawFull('gameover');
      drawLogo(165, 480, 190, true);
    } else if (screen === 'roomwin') {
      drawRoom(now, true);
      ctx.fillStyle = 'rgba(8,6,4,.62)'; ctx.fillRect(0, 0, 600, 600);
      drawFull('venceu-sala');
      drawStepsSummary(false);
      drawLogo(170, 508, 190, false, 88);
    } else if (screen === 'finalwin') {
      drawRoom(now, true);
      drawFull('venceu-final');
      drawStepsSummary(true);
      drawLogo(170, 508, 190, true, 88);
    } else if (screen === 'credits') {
      drawCredits();
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(50, now - last); last = now;
    update(now, dt);
    render(now);
    requestAnimationFrame(frame);
  }

  if (DEBUG) {
    window.__etc = {
      rooms: ROOMS.length,
      solve: function (i, opts) {
        var r = ROOMS[i];
        return solve(r, r.player.c, r.player.l, r.totems.map(function (o) { return [o.c, o.l]; }), 0, opts);
      },
      go: function (i) { startRoom(i); },
      medals: function () { return g.medals.filter(function (m) { return !m.target; }).map(function (m) { return [m.c, m.l]; }); },
      state: function () {
        return g ? { screen: screen, room: roomIndex, p: [g.p.c, g.p.l], o: totemList(), lives: g.lives, steps: g.steps, pull: g.pullOn,
          medals: g.medals.map(function (m) { return m.on; }), hint: g.hint, stuck: g.stuck, moving: g.moving, won: g.won, frame: g.frame } : { screen: screen };
      }
    };
  }

  refreshSoundLabel();
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) setTouch(true);
  document.body.classList.add('offplay');
  layout();
  loadAll();
  requestAnimationFrame(frame);
})();
