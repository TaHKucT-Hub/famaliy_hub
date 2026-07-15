/* ============================================================
   Визуальные и звуковые эффекты + нижний шит (модалка).
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var toastEl = function () { return document.getElementById("toast"); };
  var toastTimer = null;

  FH.toast = function (msg) {
    var t = toastEl(); if (!t) return;
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("on"); }, 2200);
  };

  // Плавающие +N♥
  FH.floatHearts = function (x, y, n) {
    for (var i = 0; i < 6; i++) {
      var p = document.createElement("div");
      p.className = "particle";
      p.textContent = i % 2 ? "♥" : "+" + n;
      p.style.left = (x + (Math.random() * 40 - 20)) + "px";
      p.style.top = y + "px";
      p.style.fontSize = (14 + Math.random() * 12) + "px";
      p.style.animation = "floatUp " + (0.9 + Math.random() * 0.5) + "s ease-out forwards";
      document.body.appendChild(p);
      (function (el) { setTimeout(function () { el.remove(); }, 1500); })(p);
    }
  };

  // Конфетти-взрыв из точки
  FH.confetti = function (x, y) {
    var cols = ["#F5A623", "#4DD0E1", "#FF6B6B", "#9C6ADE", "#FFD166"];
    for (var i = 0; i < 26; i++) {
      var c = document.createElement("div");
      c.className = "confetti";
      c.style.background = cols[i % cols.length];
      c.style.left = x + "px"; c.style.top = y + "px";
      c.style.transform = "translateX(" + (Math.random() * 260 - 130) + "px)";
      c.style.animation = "fall " + (1 + Math.random() * 0.8) + "s ease-in forwards";
      c.style.animationDelay = (Math.random() * 0.15) + "s";
      document.body.appendChild(c);
      (function (el) { setTimeout(function () { el.remove(); }, 2000); })(c);
    }
  };

  FH.goldFlash = function () {
    var g = document.getElementById("goldflash"); if (!g) return;
    g.style.animation = "none"; void g.offsetWidth;
    g.style.animation = "gold 1.6s ease-out";
  };

  // ---- Звук (WebAudio, без файлов) ----
  var audioCtx = null;
  function ensureCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    return audioCtx;
  }
  FH.playCoin = function () {
    if (!FH.state.sound) return;
    var ctx = ensureCtx(); if (!ctx) return;
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    [880, 1320].forEach(function (freq, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      var t0 = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.2);
    });
  };
  FH.playChime = function () {
    if (!FH.state.sound) return;
    var ctx = ensureCtx(); if (!ctx) return;
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    [523, 659, 784, 1046].forEach(function (freq, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = freq;
      var t0 = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.4);
    });
  };

  // ---- Нижний шит (подтверждения / уведомления) ----
  FH.openSheet = function (opts) {
    var backdrop = document.getElementById("backdrop");
    var sheet = document.getElementById("sheet");
    sheet.innerHTML =
      '<div class="emo">' + opts.emo + '</div>' +
      '<h3>' + opts.title + '</h3>' +
      '<p>' + opts.text + '</p>' +
      '<div class="btns">' +
      (opts.single ? '' : '<button class="cancel" id="shCancel">Отмена</button>') +
      '<button class="ok" id="shOk">' + opts.okText + '</button>' +
      '</div>';
    backdrop.classList.add("on");
    document.getElementById("shOk").onclick = opts.onOk;
    var c = document.getElementById("shCancel");
    if (c) c.onclick = FH.closeSheet;
  };
  FH.closeSheet = function () {
    document.getElementById("backdrop").classList.remove("on");
  };

  FH.levelUp = function (rank) {
    FH.goldFlash();
    FH.confetti(window.innerWidth / 2, 120);
    FH.playChime();
    FH.openSheet({
      emo: "🎊", title: "Новый ранг!",
      text: "Ты достиг звания «" + rank + "» 👑",
      okText: "Ура!", onOk: FH.closeSheet, single: true
    });
  };
})();
