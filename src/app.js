/* ============================================================
   Точка входа: сборка UI, обработка событий, игровая логика.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var tab = "home";
  var feedSub = "wall";
  var openPostId = null;
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
    if (tab === "feed")   screenEl.innerHTML = FH.viewFeed(feedSub, openPostId);
    if (tab === "tasks")  screenEl.innerHTML = FH.viewTasks();
    if (tab === "shop")   screenEl.innerHTML = FH.viewShop();
    if (tab === "family") screenEl.innerHTML = FH.viewFamily();
    if (tab === "me")     screenEl.innerHTML = FH.viewProfile();
    if (tab === "feed" && feedSub === "chat") screenEl.scrollTop = screenEl.scrollHeight;
    else screenEl.scrollTop = 0;
  }
  FH.render = render;

  // ---- Лента и чат: демо-симуляция активности семьи ----
  var CHAT_REPLIES = ["Ого, круто! 😄", "+1", "Само собой 👍", "Сделаю позже", "Ахах, супер!",
    "А во сколько?", "Я за 🙌", "Не забудьте про меня!", "😍😍", "Отлично, ждём!"];
  var POST_COMMENTS = ["Красота! 😍", "Молодец!", "Вот это да!", "Обязательно попробую", "👏👏👏", "Горжусь тобой!"];

  function randomOther(excludeId) {
    var others = FH.state.users.filter(function (u) { return u.id !== excludeId; });
    return others[Math.floor(Math.random() * others.length)].id;
  }
  function findPost(id) {
    var s = FH.state;
    for (var i = 0; i < s.posts.length; i++) if (s.posts[i].id === id) return s.posts[i];
    return null;
  }

  function scheduleChatReply() {
    if (Math.random() > 0.65) return;
    setTimeout(function () {
      var s = FH.state;
      var from = randomOther(s.meId);
      s.messages.push({ id: FH.uid(), who: from, text: CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)], ts: Date.now() });
      FH.save();
      if (tab === "feed" && feedSub === "chat") render();
    }, 1200 + Math.random() * 1800);
  }

  function scheduleWallEngagement(postId) {
    setTimeout(function () {
      var p = findPost(postId); if (!p) return;
      var from = randomOther(FH.state.meId);
      if (p.likes.indexOf(from) === -1) p.likes.push(from);
      FH.save();
      if (tab === "feed" && feedSub !== "chat") render();
    }, 1500 + Math.random() * 2000);
    if (Math.random() < 0.5) {
      setTimeout(function () {
        var p = findPost(postId); if (!p) return;
        var from = randomOther(FH.state.meId);
        p.comments.push({ id: FH.uid(), who: from, text: POST_COMMENTS[Math.floor(Math.random() * POST_COMMENTS.length)], ts: Date.now() });
        FH.save();
        if (tab === "feed" && feedSub !== "chat") render();
      }, 3500 + Math.random() * 2500);
    }
  }

  function sendPost() {
    var input = document.getElementById("postInput");
    var text = input.value.trim();
    if (!text) return;
    var s = FH.state;
    var id = FH.uid();
    s.posts.unshift({ id: id, who: s.meId, text: text, ts: Date.now(), likes: [], comments: [] });
    FH.save();
    render();
    scheduleWallEngagement(id);
  }

  function sendChat() {
    var input = document.getElementById("chatInput");
    var text = input.value.trim();
    if (!text) return;
    var s = FH.state;
    s.messages.push({ id: FH.uid(), who: s.meId, text: text, ts: Date.now() });
    FH.save();
    render();
    scheduleChatReply();
  }

  function toggleLike(id) {
    var p = findPost(id); if (!p) return;
    var s = FH.state;
    var idx = p.likes.indexOf(s.meId);
    if (idx === -1) p.likes.push(s.meId); else p.likes.splice(idx, 1);
    FH.save();
    render();
  }

  function sendComment(id) {
    var input = document.querySelector('[data-cinput="' + id + '"]');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    var p = findPost(id); if (!p) return;
    p.comments.push({ id: FH.uid(), who: FH.state.meId, text: text, ts: Date.now() });
    FH.save();
    render();
  }

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
    var feedsub = e.target.closest("[data-feedsub]");
    if (feedsub) { feedSub = feedsub.getAttribute("data-feedsub"); openPostId = null; render(); return; }
    var like = e.target.closest("[data-like]");
    if (like) { toggleLike(Number(like.getAttribute("data-like"))); return; }
    var togglec = e.target.closest("[data-toggle-comments]");
    if (togglec) {
      var pid = Number(togglec.getAttribute("data-toggle-comments"));
      openPostId = openPostId === pid ? null : pid;
      render();
      return;
    }
    var csend = e.target.closest("[data-csend]");
    if (csend) { sendComment(Number(csend.getAttribute("data-csend"))); return; }
    var postSend = e.target.closest("#postSend");
    if (postSend) { sendPost(); return; }
    var chatSend = e.target.closest("#chatSend");
    if (chatSend) { sendChat(); return; }
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

  screenEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.id === "chatInput") { e.preventDefault(); sendChat(); return; }
    if (e.target.matches && e.target.matches("[data-cinput]")) {
      e.preventDefault();
      sendComment(Number(e.target.getAttribute("data-cinput")));
    }
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
