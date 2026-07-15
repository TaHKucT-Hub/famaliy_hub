/* ============================================================
   Точка входа: сборка UI, обработка событий, игровая логика.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var tab = "home";
  var screenEl = document.getElementById("screen");

  // ---- Применение темы ----
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#1E1A17" : "#FFF8F0");
    var btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    FH.state.theme = theme;
  }
  function applySoundBtn() {
    var b = document.getElementById("soundBtn");
    if (b) b.textContent = FH.state.sound ? "🔊" : "🔈";
  }

  // ---- Обновление чипа «я» ----
  function syncMe() {
    var me = FH.me();
    document.getElementById("meAv").innerHTML = FH.avatarHTML(me);
    document.getElementById("meHearts").textContent = me.hearts;
  }

  // ---- Полный рендер ----
  function render() {
    syncMe();
    document.getElementById("nav").innerHTML = FH.renderNav(tab);
    if (tab === "home")   screenEl.innerHTML = FH.viewHome();
    if (tab === "tasks")  screenEl.innerHTML = FH.viewTasks();
    if (tab === "shop")   screenEl.innerHTML = FH.viewShop();
    if (tab === "family") screenEl.innerHTML = FH.viewFamily();
    if (tab === "me")     screenEl.innerHTML = FH.viewProfile();
    screenEl.scrollTop = 0;
  }
  FH.render = render;

  // ---- Выполнение квеста ----
  function completeTask(id, el) {
    var t = null, s = FH.state;
    for (var i = 0; i < s.tasks.length; i++) if (s.tasks[i].id === id) t = s.tasks[i];
    if (!t || t.done) return;

    t.done = true;
    var u = FH.me();
    var gain = t.streak >= 7 ? t.reward * 2 : t.reward;
    var beforeLvl = Math.floor(u.xp / 300);
    u.hearts += gain; u.xp += gain;
    var afterLvl = Math.floor(u.xp / 300);
    FH.save();

    var r = el.getBoundingClientRect();
    FH.confetti(r.left + r.width / 2, r.top);
    FH.floatHearts(r.left + r.width / 2, r.top, gain);
    FH.playCoin();
    if (FH.vk && FH.vk.tapHaptic) FH.vk.tapHaptic();
    syncMe();
    FH.toast("+" + gain + "♥ за «" + t.txt + "»" + (gain > t.reward ? " ×2 стрик!" : ""));

    if (afterLvl > beforeLvl) {
      setTimeout(function () { FH.levelUp(FH.rankFor(u.xp)); }, 700);
    }
    setTimeout(function () { if (tab === "tasks") render(); }, 900);
  }

  // ---- Покупка привилегии ----
  function askBuy(itemId) {
    var it = null;
    for (var i = 0; i < FH.SHOP.length; i++) if (FH.SHOP[i].id === itemId) it = FH.SHOP[i];
    if (!it) return;
    var u = FH.me();
    if (u.hearts < it.cost) { FH.toast("Не хватает сердечек 🥲"); return; }

    FH.openSheet({
      emo: it.emo,
      title: "Купить «" + it.nm + "»?",
      text: it.adult18
        ? "Спишется " + it.cost + "♥. Придёт приватное уведомление партнёру."
        : "Спишется " + it.cost + "♥ из твоей копилки.",
      okText: "Купить за " + it.cost + "♥",
      onOk: function () {
        u.hearts -= it.cost; FH.save();
        FH.closeSheet();
        syncMe();
        FH.playCoin();
        FH.toast(it.adult18 ? "💝 Приватное уведомление отправлено" : "Готово! «" + it.nm + "» активировано ✨");
        if (tab === "shop") render();
      }
    });
  }

  // ---- Онбординг (3 экрана, показывается один раз) ----
  var ONB = [
    { emo: "🏡", h: "Добро пожаловать в Family Hub", p: "Быт становится игрой, а забота друг о друге — заметной. Всё в одном тёплом пространстве." },
    { emo: "♥", h: "Зарабатывай сердечки", p: "Выполняй квесты, помогай близким и получай ♥. Держи стрик 7 дней — награда удваивается." },
    { emo: "🛍️", h: "Трать на реальные бонусы", p: "Час планшета, выбор фильма, день без готовки, выходной на рыбалку. Магазин привилегий ждёт." }
  ];
  function showOnboarding() {
    var el = document.getElementById("onb");
    var step = 0;
    function draw() {
      var o = ONB[step];
      var dots = ONB.map(function (_, i) { return '<div class="dot ' + (i === step ? "on" : "") + '"></div>'; }).join("");
      el.innerHTML =
        '<div class="oemo">' + o.emo + '</div>' +
        '<h1>' + o.h + '</h1><p>' + o.p + '</p>' +
        '<div class="dots">' + dots + '</div>' +
        '<button class="obtn" id="onbNext">' + (step < ONB.length - 1 ? "Дальше" : "Поехали!") + '</button>' +
        (step < ONB.length - 1 ? '<button class="skip" id="onbSkip">Пропустить</button>' : '');
      document.getElementById("onbNext").onclick = function () {
        if (step < ONB.length - 1) { step++; draw(); } else finish();
      };
      var sk = document.getElementById("onbSkip");
      if (sk) sk.onclick = finish;
    }
    function finish() {
      el.hidden = true;
      FH.state.onboarded = true; FH.save();
    }
    el.hidden = false;
    draw();
  }

  // ---- События ----
  screenEl.addEventListener("click", function (e) {
    var chk = e.target.closest("[data-check]");
    if (chk) { completeTask(parseInt(chk.getAttribute("data-check"), 10), chk); return; }
    var buy = e.target.closest("[data-buy]");
    if (buy) { askBuy(buy.getAttribute("data-buy")); return; }
    var reset = e.target.closest("[data-reset]");
    if (reset) {
      FH.openSheet({
        emo: "↺", title: "Сбросить демо?",
        text: "Сердечки, квесты и покупки вернутся к начальным значениям.",
        okText: "Сбросить",
        onOk: function () { FH.reset(); FH.closeSheet(); applyTheme(FH.state.theme); applySoundBtn(); tab = "home"; render(); }
      });
    }
  });

  document.getElementById("nav").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (b) { tab = b.getAttribute("data-tab"); render(); }
  });

  // Смена участника — демонстрация ролевой модели
  document.getElementById("meChip").addEventListener("click", function () {
    var s = FH.state, i = 0;
    for (var k = 0; k < s.users.length; k++) if (s.users[k].id === s.meId) i = k;
    s.meId = s.users[(i + 1) % s.users.length].id;
    FH.save();
    FH.toast("Ты вошёл как " + FH.me().name + " · " + FH.me().role);
    render();
  });

  document.getElementById("themeBtn").addEventListener("click", function () {
    applyTheme(FH.state.theme === "dark" ? "light" : "dark");
    FH.save();
  });

  document.getElementById("soundBtn").addEventListener("click", function () {
    FH.state.sound = !FH.state.sound;
    applySoundBtn(); FH.save();
    if (FH.state.sound) FH.playCoin();
  });

  // ---- Запуск ----
  applyTheme(FH.state.theme);
  applySoundBtn();
  render();

  if (!FH.state.onboarded) showOnboarding();

  // VK Bridge (не блокирует запуск; при успехе персонализирует и перерисовывает)
  if (FH.vk && FH.vk.available) {
    FH.vk.init(function (theme) { applyTheme(theme); FH.save(); })
      .then(function (ok) { if (ok) render(); });
  }
})();
