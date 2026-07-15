/* ============================================================
   Рендер экранов. Каждая функция возвращает HTML-строку.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var NAV = [
    { id: "home",   g: "🏠", t: "Дом" },
    { id: "feed",   g: "💬", t: "Лента" },
    { id: "tasks",  g: "✅", t: "Задачи" },
    { id: "shop",   g: "🛍️", t: "Магазин" },
    { id: "family", g: "👨‍👩‍👧‍👦", t: "Семья" },
    { id: "me",     g: "⭐", t: "Профиль" }
  ];
  FH.NAV = NAV;

  FH.renderNav = function (tab) {
    return NAV.map(function (n) {
      return '<button class="navi ' + (tab === n.id ? "on" : "") + '" data-tab="' + n.id + '">' +
             '<span class="g">' + n.g + '</span>' + n.t + '</button>';
    }).join("");
  };

  // ---- ДОМ ----
  FH.viewHome = function () {
    var s = FH.state;
    var me = FH.me();
    var board = s.users.slice().sort(function (a, b) { return b.hearts - a.hearts; });
    var max = board[0].hearts || 1;
    var myTasks = s.tasks.filter(function (t) { return t.who === s.meId && !t.done; }).slice(0, 2);
    var hour = new Date().getHours();
    var hi = hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";

    var lanes = board.map(function (u, i) {
      var left = Math.max(10, (u.hearts / max) * 92);
      return '<div class="lane"><div class="rk">' + (i + 1) + '</div>' +
        '<div class="rail"><div class="racer" style="left:' + left + '%;background:' + u.color + '22;border:2px solid ' + u.color + '">' +
        (i === 0 ? '<span class="crown">👑</span>' : '') + FH.avatarHTML(u) + '</div></div>' +
        '<div class="sc">' + u.hearts + '♥</div></div>';
    }).join("");

    var quests = myTasks.length
      ? myTasks.map(function (t) {
          return '<div class="card qmini"><div class="ic">' + t.ic + '</div>' +
            '<div><div class="tt">' + t.txt + '</div><div class="mt">' + t.meta + '</div></div>' +
            '<div class="reward">+' + t.reward + '♥</div></div>';
        }).join("")
      : '<div class="card qmini"><div class="ic">🎉</div><div><div class="tt">Всё выполнено!</div><div class="mt">Ты сегодня герой</div></div></div>';

    return '' +
      '<div class="hero-greet">' + hi + ', ' + me.name + '! 👋</div>' +
      '<p class="hero-sub">Сегодня в семье 4 активных квеста и 1 рейд-босс</p>' +
      '<div class="row two" style="margin-top:14px">' +
        '<div class="card widget weather"><div class="label">Одеваемся</div><div class="t">+7°</div>' +
          '<div class="d">Возьми куртку 🧥</div><div class="emo">🌤️</div></div>' +
        '<div class="card widget countdown"><div class="label">До отпуска</div><div class="n">42</div>' +
          '<div class="d" style="color:var(--muted);font-weight:700">дня до моря 🏖️</div></div>' +
      '</div>' +
      '<h2 class="sec">Кто в топе?</h2>' +
      '<div class="card track"><h3>🏁 Гонка недели</h3>' + lanes + '</div>' +
      '<h2 class="sec">Рейд-босс 🐉</h2>' +
      '<div class="card widget">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<b style="font-size:15px">Собрать 1000♥ за 3 дня</b>' +
          '<span style="font-weight:900;color:var(--turq-deep)">825 / 1000</span></div>' +
        '<div class="xpbar" style="margin-top:10px"><div class="xpfill" style="width:82.5%"></div></div>' +
        '<p style="margin:10px 0 0;font-size:13px;color:var(--muted);font-weight:700">Награда всей семье: 🍕 пицца в пятницу</p>' +
      '</div>' +
      '<h2 class="sec">Твои квесты</h2>' + quests +
      '<h2 class="sec">Последнее фото</h2>' +
      '<div class="photo"><div class="cap">🎨 Рисунок Ани</div><div class="rx">🔥 4 · ❤️ 2</div></div>';
  };

  // ---- ЛЕНТА + ЧАТ ----
  function renderComment(c) {
    var cu = FH.userById(c.who) || {};
    return '<div class="comment"><div class="mini-av" style="background:' + (cu.color || "#ccc") + '22">' + FH.avatarHTML(cu) + '</div>' +
      '<div><b>' + (cu.name || "") + '</b> ' + c.text + '<div class="ctime">' + FH.timeAgo(c.ts) + '</div></div></div>';
  }

  function renderPost(p, openPostId) {
    var u = FH.userById(p.who) || {};
    var liked = p.likes.indexOf(FH.state.meId) !== -1;
    var open = openPostId === p.id;
    var commentsHTML = p.comments.map(renderComment).join("") ||
      '<p class="nocm">Комментариев пока нет</p>';
    return '<div class="card post" data-post="' + p.id + '">' +
      '<div class="phead"><div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
      '<div><div class="pname">' + (u.name || "") + '</div><div class="ptime">' + FH.timeAgo(p.ts) + '</div></div></div>' +
      '<div class="ptext">' + p.text + '</div>' +
      '<div class="pactions">' +
        '<button class="pbtn ' + (liked ? "on" : "") + '" data-like="' + p.id + '">' + (liked ? "❤️" : "🤍") + ' <span>' + p.likes.length + '</span></button>' +
        '<button class="pbtn" data-toggle-comments="' + p.id + '">💬 <span>' + p.comments.length + '</span></button>' +
      '</div>' +
      (open ? '<div class="comments">' + commentsHTML +
        '<div class="cinput"><input type="text" placeholder="Комментарий..." data-cinput="' + p.id + '">' +
        '<button data-csend="' + p.id + '">➤</button></div></div>' : '') +
    '</div>';
  }

  FH.viewWall = function (openPostId) {
    var s = FH.state;
    var posts = s.posts.slice().sort(function (a, b) { return b.ts - a.ts; });
    var composer = '<div class="card composer">' +
      '<textarea id="postInput" placeholder="Что у вас нового?" rows="2"></textarea>' +
      '<button class="postsend" id="postSend">Опубликовать</button></div>';
    var list = posts.length
      ? posts.map(function (p) { return renderPost(p, openPostId); }).join("")
      : '<div class="card qmini"><div class="ic">📰</div><div class="tt">Пока нет новостей</div></div>';
    return '<div class="hero-greet">Лента семьи</div>' +
      '<p class="hero-sub">Делитесь моментами дня друг с другом</p>' + composer + list;
  };

  FH.viewChat = function () {
    var s = FH.state;
    var msgs = s.messages.slice().sort(function (a, b) { return a.ts - b.ts; });
    var bubbles = msgs.map(function (m) {
      var mine = m.who === s.meId;
      var u = FH.userById(m.who) || {};
      return '<div class="brow ' + (mine ? "mine" : "other") + '">' +
        (!mine ? '<div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' : '') +
        '<div class="bubble">' + (!mine ? '<div class="bname">' + (u.name || "") + '</div>' : '') +
        '<div class="btext">' + m.text + '</div><div class="btime">' + FH.timeAgo(m.ts) + '</div></div></div>';
    }).join("");
    return '<div class="chat-list" id="chatList">' + bubbles + '</div>' +
      '<div class="chat-input"><input type="text" id="chatInput" placeholder="Сообщение..." autocomplete="off">' +
      '<button id="chatSend">➤</button></div>';
  };

  FH.viewFeed = function (sub, openPostId) {
    var tabs = '<div class="feed-tabs">' +
      '<button class="ftab ' + (sub !== "chat" ? "on" : "") + '" data-feedsub="wall">📰 Лента</button>' +
      '<button class="ftab ' + (sub === "chat" ? "on" : "") + '" data-feedsub="chat">💬 Чат</button></div>';
    return tabs + (sub === "chat" ? FH.viewChat() : FH.viewWall(openPostId));
  };

  // ---- ЗАДАЧИ ----
  FH.viewTasks = function () {
    var s = FH.state;
    var mine = s.tasks.filter(function (t) { return t.who === s.meId; });
    var others = s.tasks.filter(function (t) { return t.who !== s.meId; });

    function block(t) {
      return '<div class="card quest ' + (t.done ? "done" : "") + '" data-q="' + t.id + '">' +
        '<div class="check" data-check="' + t.id + '">' + (t.done ? "✓" : "") + '</div>' +
        '<div style="flex:1"><div class="qtxt">' + t.txt + '</div>' +
        '<div class="qmeta">' + t.meta +
        (t.streak > 2 ? ' · <span class="streak">🔥 ' + t.streak + ' дней</span>' : '') +
        '</div></div><div class="reward">+' + t.reward + '♥</div></div>';
    }

    var mineHTML = mine.length
      ? mine.map(block).join("")
      : '<div class="card qmini"><div class="ic">☕</div><div class="tt">На сегодня заданий нет</div></div>';

    var othersHTML = others.map(function (t) {
      var u = s.users.filter(function (x) { return x.id === t.who; })[0] || {};
      return '<div class="card quest ' + (t.done ? "done" : "") + '" style="opacity:.75">' +
        '<div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div style="flex:1"><div class="qtxt" style="font-size:14px">' + t.txt + '</div>' +
        '<div class="qmeta">' + (u.name || "") + '</div></div>' +
        '<div class="reward">+' + t.reward + '♥</div></div>';
    }).join("");

    return '<div class="hero-greet">Квесты дня</div>' +
      '<p class="hero-sub">Отметь выполнение — получи сердечки. Стрик 7 дней = ×2 бонус</p>' +
      '<h2 class="sec">Мои задания (' + mine.filter(function (t) { return !t.done; }).length + ')</h2>' +
      mineHTML +
      '<h2 class="sec">У остальных</h2>' + othersHTML;
  };

  // ---- МАГАЗИН ----
  FH.viewShop = function () {
    var me = FH.me();
    var rc = FH.roleCode(me);
    var visible = FH.SHOP.filter(function (it) { return it.roles.indexOf(rc) !== -1; });

    var grid = visible.map(function (it) {
      var afford = me.hearts >= it.cost;
      return '<div class="card item ' + (it.locked ? "locked" : "") + '">' +
        (it.adult18 ? '<span class="adult">18+</span>' : '') +
        '<div class="emo">' + it.emo + '</div>' +
        '<div class="nm">' + it.nm + '</div>' +
        '<div class="ds">' + it.ds + '</div>' +
        '<button class="buy" data-buy="' + it.id + '"' + (afford ? '' : ' style="opacity:.5"') + '>' +
        (it.locked ? "🔒 " : "") + it.cost + '♥</button></div>';
    }).join("");

    var note = me.adult ? "" :
      '<p style="text-align:center;color:var(--muted);font-weight:700;font-size:13px;margin-top:20px">🔒 Раздел для взрослых скрыт по твоей роли</p>';

    return '<div class="hero-greet">Магазин привилегий 🛍️</div>' +
      '<p class="hero-sub">Твой баланс: <b style="color:var(--coral)">' + me.hearts + '♥</b> — трать на реальные бонусы</p>' +
      '<div class="shop-grid" style="margin-top:14px">' + grid + '</div>' + note;
  };

  // ---- СЕМЬЯ ----
  FH.viewFamily = function () {
    var s = FH.state;
    var members = s.users.map(function (u) {
      return '<div class="card member"><div class="av" style="background:' + u.color + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div><div class="nm">' + u.name + '</div>' +
        '<div class="rl">' + u.role + ' · ' + u.age + ' · ' + FH.rankFor(u.xp) + '</div></div>' +
        '<div class="lvlpill"><div class="lv">Ур. ' + FH.levelFor(u.xp) + '</div>' +
        '<div class="hp">' + u.hearts + '♥</div></div></div>';
    }).join("");

    return '<div class="hero-greet">Наша семья</div>' +
      '<p class="hero-sub">4 участника · код приглашения <b>FAM-7X2K</b></p>' +
      '<h2 class="sec">Участники</h2>' + members +
      '<h2 class="sec">Семейное древо</h2>' +
      '<div class="card widget" style="text-align:center;padding:24px">' +
        '<div style="font-size:34px">👵👴</div>' +
        '<div style="font-size:26px;margin:6px 0">👨‍❤️‍👩</div>' +
        '<div style="font-size:30px">👧🧒</div>' +
        '<p style="color:var(--muted);font-weight:700;font-size:13px;margin:10px 0 0">3 поколения · 47 фото в архиве</p>' +
      '</div>';
  };

  // ---- ПРОФИЛЬ ----
  FH.viewProfile = function () {
    var s = FH.state;
    var u = FH.me();
    var lvl = FH.levelFor(u.xp);
    var prog = Math.round(FH.xpInLevel(u.xp) / 300 * 100);
    var doneCount = s.tasks.filter(function (t) { return t.who === u.id && t.done; }).length;

    var achs = FH.ACHIEVEMENTS.map(function (a) {
      return '<div class="ach ' + (a.on ? "" : "off") + '" title="' + a.nm + '">' + a.emo + '</div>';
    }).join("");

    return '<div class="card prof-head" style="background:linear-gradient(160deg,' + u.color + '22,transparent)">' +
        '<div class="big" style="background:' + u.color + '33">' + FH.avatarHTML(u) + '</div>' +
        '<div class="nm">' + u.name + '</div>' +
        '<div class="rk">' + FH.rankFor(u.xp) + ' · Уровень ' + lvl + '</div>' +
        '<div class="xpwrap"><div class="xpbar"><div class="xpfill" style="width:' + prog + '%"></div></div>' +
        '<p style="font-size:12px;color:var(--muted);font-weight:800;margin:6px 0 0">' +
        FH.xpInLevel(u.xp) + ' / 300 XP до следующего ранга</p></div></div>' +
      '<div class="stats3">' +
        '<div class="card stat"><div class="v" style="color:var(--coral)">' + u.hearts + '♥</div><div class="l">Копилка</div></div>' +
        '<div class="card stat"><div class="v">' + doneCount + '</div><div class="l">Квестов</div></div>' +
        '<div class="card stat"><div class="v">🔥6</div><div class="l">Стрик</div></div>' +
      '</div>' +
      '<h2 class="sec">Достижения</h2><div class="ach-grid">' + achs + '</div>' +
      '<button class="linkbtn" data-reset="1">↺ Сбросить демо-данные</button>';
  };
})();
