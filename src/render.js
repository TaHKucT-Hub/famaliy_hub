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
    { id: "me",     g: "⭐", t: "Профиль" },
    { id: "admin",  g: "⚙️", t: "Админ" }
  ];
  FH.NAV = NAV;

  FH.renderNav = function (tab, isAdmin) {
    return NAV.filter(function (n) { return n.id !== "admin" || isAdmin; }).map(function (n) {
      return '<button class="navi ' + (tab === n.id ? "on" : "") + '" data-tab="' + n.id + '">' +
             '<span class="g">' + n.g + '</span>' + n.t + '</button>';
    }).join("");
  };

  function fmtDue(ms) {
    if (!ms) return "";
    var d = new Date(ms), now = new Date();
    var diffDays = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    var months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    var label = diffDays < 0 ? "просрочено" : diffDays === 0 ? "сегодня" : diffDays === 1 ? "завтра" : "до " + d.getDate() + " " + months[d.getMonth()];
    return '<span class="due ' + (diffDays < 0 ? "over" : "") + '">⏰ ' + label + '</span>';
  }
  function fmtRecur(r) {
    if (!r) return "";
    return '<span class="recur">🔁 ' + (r === "daily" ? "ежедневно" : "еженедельно") + '</span>';
  }

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
      '<p class="hero-sub">В семье «' + (s.family ? s.family.name : "") + '» ' + s.users.length + ' участников</p>' +
      '<h2 class="sec">Кто в топе?</h2>' +
      '<div class="card track"><h3>🏁 Гонка недели</h3>' + lanes + '</div>' +
      '<h2 class="sec">Твои квесты</h2>' + quests;
  };

  // ---- ЛЕНТА + ЧАТ ----
  function renderComment(c) {
    var cu = FH.userById(c.who) || {};
    return '<div class="comment" data-comment-row="' + c.id + '"><div class="mini-av" style="background:' + (cu.color || "#ccc") + '22">' + FH.avatarHTML(cu) + '</div>' +
      '<div style="flex:1"><b>' + (cu.name || "") + '</b> ' + c.text + '<div class="ctime">' + FH.timeAgo(c.ts) +
      (c.who === FH.state.meId ? ' · <a data-del-comment="' + c.id + '">удалить</a>' : '') + '</div></div></div>';
  }

  function renderPost(p, openPostId) {
    var u = FH.userById(p.who) || {};
    var liked = p.likes.indexOf(FH.state.meId) !== -1;
    var open = openPostId === p.id;
    var mine = p.who === FH.state.meId || FH.me().role === "admin";
    var commentsHTML = p.comments.map(renderComment).join("") ||
      '<p class="nocm">Комментариев пока нет</p>';
    var photos = (p.files || []).length
      ? '<div class="pgrid">' + p.files.map(function (f) { return '<img src="' + FH.fileUrl(f.url) + '" alt="">'; }).join("") + '</div>'
      : "";
    return '<div class="card post" data-post="' + p.id + '">' +
      '<div class="phead"><div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
      '<div style="flex:1"><div class="pname">' + (u.name || "") + '</div><div class="ptime">' + FH.timeAgo(p.ts) + '</div></div>' +
      (mine ? '<a class="del-x" data-del-post="' + p.id + '">✕</a>' : '') +
      '</div>' +
      (p.text ? '<div class="ptext">' + p.text + '</div>' : '') + photos +
      '<div class="pactions">' +
        '<button class="pbtn ' + (liked ? "on" : "") + '" data-like="' + p.id + '">' + (liked ? "❤️" : "🤍") + ' <span>' + p.likes.length + '</span></button>' +
        '<button class="pbtn" data-toggle-comments="' + p.id + '">💬 <span>' + p.comments.length + '</span></button>' +
      '</div>' +
      (open ? '<div class="comments">' + commentsHTML +
        '<div class="cinput"><input type="text" placeholder="Комментарий..." data-cinput="' + p.id + '">' +
        '<button data-csend="' + p.id + '">➤</button></div></div>' : '') +
    '</div>';
  }

  FH.viewWall = function (openPostId, pendingFiles) {
    var s = FH.state;
    var posts = s.posts.slice().sort(function (a, b) { return b.ts - a.ts; });
    var pendingHTML = (pendingFiles || []).length
      ? '<div class="pending-grid">' + pendingFiles.map(function (f, i) {
          return '<div class="pending-thumb"><img src="' + FH.fileUrl(f.url) + '"><a data-remove-pending="' + i + '">✕</a></div>';
        }).join("") + '</div>'
      : "";
    var composer = '<div class="card composer">' +
      '<textarea id="postInput" placeholder="Что у вас нового?" rows="2"></textarea>' + pendingHTML +
      '<div class="composer-row">' +
        '<label class="attachbtn">📷<input type="file" id="postPhotoInput" accept="image/*" multiple hidden></label>' +
        '<button class="postsend" id="postSend">Опубликовать</button>' +
      '</div></div>';
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
      var photo = m.file ? '<img class="bphoto" src="' + FH.fileUrl(m.file.url) + '" alt="">' : "";
      return '<div class="brow ' + (mine ? "mine" : "other") + '">' +
        (!mine ? '<div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' : '') +
        '<div class="bubble">' + (!mine ? '<div class="bname">' + (u.name || "") + '</div>' : '') +
        photo + (m.text ? '<div class="btext">' + m.text + '</div>' : '') + '<div class="btime">' + FH.timeAgo(m.ts) + '</div></div></div>';
    }).join("");
    return '<div class="chat-list" id="chatList">' + bubbles + '</div>' +
      '<div class="chat-input">' +
      '<label class="attachbtn small">📷<input type="file" id="chatPhotoInput" accept="image/*" hidden></label>' +
      '<input type="text" id="chatInput" placeholder="Сообщение..." autocomplete="off">' +
      '<button id="chatSend">➤</button></div>';
  };

  FH.viewFeed = function (sub, openPostId, pendingFiles) {
    var tabs = '<div class="feed-tabs">' +
      '<button class="ftab ' + (sub !== "chat" ? "on" : "") + '" data-feedsub="wall">📰 Лента</button>' +
      '<button class="ftab ' + (sub === "chat" ? "on" : "") + '" data-feedsub="chat">💬 Чат</button></div>';
    return tabs + (sub === "chat" ? FH.viewChat() : FH.viewWall(openPostId, pendingFiles));
  };

  // ---- ЗАДАЧИ ----
  FH.viewTasks = function () {
    var s = FH.state;
    var mine = s.tasks.filter(function (t) { return t.who === s.meId; });
    var others = s.tasks.filter(function (t) { return t.who !== s.meId; });

    function block(t) {
      var proof = t.proofFile
        ? '<img class="proof-thumb" src="' + FH.fileUrl(t.proofFile) + '" alt="">'
        : (!t.done ? '<label class="attachbtn small" title="Прикрепить фото-подтверждение">📎<input type="file" accept="image/*" hidden data-proof-input="' + t.id + '"></label>' : "");
      return '<div class="card quest ' + (t.done ? "done" : "") + '" data-q="' + t.id + '">' +
        '<div class="check" data-check="' + t.id + '">' + (t.done ? "✓" : "") + '</div>' +
        '<div style="flex:1"><div class="qtxt">' + t.txt + '</div>' +
        '<div class="qmeta">' + t.meta +
        (t.streak > 2 ? ' · <span class="streak">🔥 ' + t.streak + ' дней</span>' : '') +
        (t.dueDate ? ' · ' + fmtDue(t.dueDate) : '') + ' ' + fmtRecur(t.recurrence) +
        '</div></div>' + proof + '<div class="reward">+' + t.reward + '♥</div></div>';
    }

    var mineHTML = mine.length
      ? mine.map(block).join("")
      : '<div class="card qmini"><div class="ic">☕</div><div class="tt">На сегодня заданий нет</div></div>';

    var othersHTML = others.map(function (t) {
      var u = s.users.filter(function (x) { return x.id === t.who; })[0] || {};
      return '<div class="card quest ' + (t.done ? "done" : "") + '" style="opacity:.75">' +
        '<div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div style="flex:1"><div class="qtxt" style="font-size:14px">' + t.txt + '</div>' +
        '<div class="qmeta">' + (u.name || "") + (t.dueDate ? ' · ' + fmtDue(t.dueDate) : '') + '</div></div>' +
        '<div class="reward">+' + t.reward + '♥</div></div>';
    }).join("");

    var quickAdd = '<div class="card composer taskadd">' +
      '<input type="text" id="quickTaskInput" placeholder="Добавить дело для себя...">' +
      '<button class="postsend" id="quickTaskAdd">+</button></div>';

    return '<div class="hero-greet">Квесты дня</div>' +
      '<p class="hero-sub">Отметь выполнение — получи сердечки. Стрик 7 дней = ×2 бонус</p>' +
      quickAdd +
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
  FH.viewFamily = function (documents) {
    var s = FH.state;
    var members = s.users.map(function (u) {
      return '<div class="card member"><div class="av" style="background:' + u.color + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div><div class="nm">' + u.name + '</div>' +
        '<div class="rl">' + u.roleLabel + (u.age ? ' · ' + u.age : '') + ' · ' + FH.rankFor(u.xp) + '</div></div>' +
        '<div class="lvlpill"><div class="lv">Ур. ' + FH.levelFor(u.xp) + '</div>' +
        '<div class="hp">' + u.hearts + '♥</div></div></div>';
    }).join("");

    var docsHTML = (documents || []).map(function (d) {
      var owner = FH.userById(d.uploaded_by) || {};
      var canDel = d.uploaded_by === s.meId || FH.me().role === "admin";
      return '<div class="card docrow">' +
        '<div class="docic">📄</div>' +
        '<div style="flex:1"><a href="' + FH.fileUrl(d.url) + '" target="_blank" class="docname">' + (d.title || d.filename) + '</a>' +
        '<div class="qmeta">' + (owner.name || "") + ' · ' + FH.timeAgo(d.ts) + ' · ' + Math.round(d.size / 1024) + ' КБ</div></div>' +
        (canDel ? '<a class="del-x" data-del-doc="' + d.id + '">✕</a>' : '') +
      '</div>';
    }).join("") || '<p style="color:var(--muted);font-weight:700;font-size:13px">Пока нет документов</p>';

    return '<div class="hero-greet">Наша семья</div>' +
      '<p class="hero-sub">' + s.users.length + ' участников · код приглашения <b class="invite-code" id="inviteCode">' + (s.family ? s.family.invite_code : "") + '</b> <a id="copyInvite" class="del-x" style="color:var(--turq-deep)">копировать</a></p>' +
      '<h2 class="sec">Участники</h2>' + members +
      '<h2 class="sec">Документы семьи</h2>' +
      '<div class="card composer">' +
        '<input type="text" id="docTitleInput" placeholder="Название документа (необязательно)">' +
        '<div class="composer-row"><label class="attachbtn">📎<input type="file" id="docFileInput" hidden></label>' +
        '<span style="color:var(--muted);font-weight:700;font-size:12.5px;flex:1;align-self:center">Загрузить файл до 8 МБ</span></div>' +
      '</div>' + docsHTML;
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
        '<label class="big avatar-upload" style="background:' + u.color + '33">' + FH.avatarHTML(u) +
          '<span class="cam">📷</span><input type="file" id="avatarInput" accept="image/*" hidden></label>' +
        '<div class="nm">' + u.name + '</div>' +
        '<div class="rk">' + u.roleLabel + ' · ' + FH.rankFor(u.xp) + ' · Уровень ' + lvl + '</div>' +
        '<div class="xpwrap"><div class="xpbar"><div class="xpfill" style="width:' + prog + '%"></div></div>' +
        '<p style="font-size:12px;color:var(--muted);font-weight:800;margin:6px 0 0">' +
        FH.xpInLevel(u.xp) + ' / 300 XP до следующего ранга</p></div></div>' +
      '<div class="stats3">' +
        '<div class="card stat"><div class="v" style="color:var(--coral)">' + u.hearts + '♥</div><div class="l">Копилка</div></div>' +
        '<div class="card stat"><div class="v">' + doneCount + '</div><div class="l">Квестов</div></div>' +
        '<div class="card stat"><div class="v">' + (s.family ? s.family.name : "") + '</div><div class="l">Семья</div></div>' +
      '</div>' +
      '<h2 class="sec">Достижения</h2><div class="ach-grid">' + achs + '</div>';
  };

  // ---- ОНБОРДИНГ СЕМЬИ (создать / вступить) ----
  FH.viewFamilySetup = function (mode, error) {
    var err = error ? '<p class="fs-error">' + error + '</p>' : '';
    if (mode === "create") {
      return '<div class="oemo">👨‍👩‍👧‍👦</div><h1>Новая семья</h1><p>Придумайте название — его увидят все участники</p>' +
        '<input class="fs-input" id="fsFamilyName" placeholder="Например: Тонких" maxlength="40">' + err +
        '<button class="obtn" id="fsCreateGo">Создать семью</button>' +
        '<button class="skip" id="fsBack">Назад</button>';
    }
    if (mode === "join") {
      return '<div class="oemo">🔑</div><h1>Есть код приглашения?</h1><p>Спросите его у того, кто уже создал семью в Family Hub</p>' +
        '<input class="fs-input" id="fsCode" style="text-transform:uppercase" placeholder="Например: B5820F8E" maxlength="12">' + err +
        '<button class="obtn" id="fsJoinGo">Присоединиться</button>' +
        '<button class="skip" id="fsBack">Назад</button>';
    }
    return '<div class="oemo">🏡</div><h1>Добро пожаловать!</h1>' +
      '<p>Создайте семью в Family Hub или присоединитесь к уже существующей по коду приглашения</p>' + err +
      '<button class="obtn" id="fsCreate">Создать семью</button>' +
      '<button class="obtn" id="fsJoin" style="margin-top:10px;background:linear-gradient(135deg,var(--turq),var(--turq-deep))">Присоединиться по коду</button>';
  };

  // ---- АДМИНКА ----
  var ROLE_LABELS = { admin: "Админ", parent: "Родитель", teen: "Подросток", child: "Ребёнок" };

  function roleOptions(current) {
    return Object.keys(ROLE_LABELS).map(function (r) {
      return '<option value="' + r + '"' + (r === current ? " selected" : "") + '>' + ROLE_LABELS[r] + '</option>';
    }).join("");
  }

  function viewAdminMembers() {
    var s = FH.state;
    var rows = s.users.map(function (m) {
      return '<div class="card admember">' +
        '<div class="adm-head"><div class="mini-av" style="background:' + m.color + '22">' + FH.avatarHTML(m) + '</div><b>' + m.name + '</b>' +
        (m.id === s.meId ? ' <span class="youtag">это ты</span>' : '') + '</div>' +
        '<div class="adm-grid">' +
          '<label>Роль<select data-field="role" data-member="' + m.id + '">' + roleOptions(m.role) + '</select></label>' +
          '<label>Возраст<input type="text" data-field="age_label" data-member="' + m.id + '" value="' + m.age + '"></label>' +
          '<label>Эмодзи<input type="text" maxlength="4" data-field="avatar_emoji" data-member="' + m.id + '" value="' + m.av + '"></label>' +
          '<label>Цвет<input type="color" data-field="color" data-member="' + m.id + '" value="' + m.color + '"></label>' +
          '<label>Сердечки<input type="number" min="0" data-field="hearts" data-member="' + m.id + '" value="' + m.hearts + '"></label>' +
          '<label>XP<input type="number" min="0" data-field="xp" data-member="' + m.id + '" value="' + m.xp + '"></label>' +
        '</div>' +
        (m.id !== s.meId ? '<button class="linkbtn" data-remove-member="' + m.id + '" style="color:var(--coral)">Удалить из семьи</button>' : '') +
      '</div>';
    }).join("");
    return rows;
  }

  function viewAdminQuests() {
    var s = FH.state;
    var memberOptions = s.users.map(function (u) { return '<option value="' + u.id + '">' + u.name + '</option>'; }).join("");
    var form = '<div class="card composer">' +
      '<div class="adm-grid">' +
        '<label>Кому<select id="atWho">' + memberOptions + '</select></label>' +
        '<label>Награда ♥<input type="number" id="atReward" value="10" min="1"></label>' +
        '<label>Срок<input type="date" id="atDue"></label>' +
        '<label>Повтор<select id="atRecur"><option value="">Нет</option><option value="daily">Ежедневно</option><option value="weekly">Еженедельно</option></select></label>' +
      '</div>' +
      '<input type="text" id="atTxt" placeholder="Текст задачи" style="margin-top:8px">' +
      '<button class="postsend" id="atCreate" style="margin-top:8px">Создать задачу</button>' +
    '</div>';
    var list = s.tasks.map(function (t) {
      var u = FH.userById(t.who) || {};
      return '<div class="card quest" style="opacity:' + (t.done ? ".6" : "1") + '">' +
        '<div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div style="flex:1"><div class="qtxt" style="font-size:14px">' + t.txt + (t.done ? " ✓" : "") + '</div>' +
        '<div class="qmeta">' + (u.name || "") + (t.dueDate ? ' · ' + fmtDue(t.dueDate) : '') + '</div></div>' +
        '<a class="del-x" data-admin-del-task="' + t.id + '">✕</a></div>';
    }).join("") || '<p style="color:var(--muted);font-weight:700;font-size:13px">Задач пока нет</p>';
    return form + '<h2 class="sec">Все задачи семьи</h2>' + list;
  }

  function shopRoleChecks(prefix, checked) {
    return ["adult", "teen", "child"].map(function (r) {
      var label = { adult: "Взрослый", teen: "Подросток", child: "Ребёнок" }[r];
      return '<label class="chk"><input type="checkbox" data-role-chk="' + prefix + '-' + r + '"' + (checked.indexOf(r) !== -1 ? " checked" : "") + '> ' + label + '</label>';
    }).join("");
  }

  function viewAdminShop() {
    var items = FH.SHOP.map(function (it) {
      var p = "s" + it.id;
      return '<div class="card admember" data-shop-item="' + it.id + '">' +
        '<div class="adm-grid">' +
          '<label>Эмодзи<input type="text" maxlength="4" data-shop-field="emo" value="' + it.emo + '"></label>' +
          '<label>Название<input type="text" data-shop-field="nm" value="' + it.nm + '"></label>' +
          '<label>Цена ♥<input type="number" min="1" data-shop-field="cost" value="' + it.cost + '"></label>' +
        '</div>' +
        '<input type="text" data-shop-field="ds" value="' + it.ds + '" placeholder="Описание" style="margin-top:8px">' +
        '<div class="roles-row">' + shopRoleChecks(p, it.roles) + '</div>' +
        '<label class="chk"><input type="checkbox" data-shop-field="locked"' + (it.locked ? " checked" : "") + '> Заблокировано</label>' +
        '<div class="composer-row"><button class="postsend" data-save-shop="' + it.id + '">Сохранить</button>' +
        '<a class="del-x" data-del-shop="' + it.id + '">Удалить</a></div>' +
      '</div>';
    }).join("");

    var newForm = '<div class="card composer" data-shop-item="new">' +
      '<div class="adm-grid">' +
        '<label>Эмодзи<input type="text" maxlength="4" data-shop-field="emo" value="🎁"></label>' +
        '<label>Название<input type="text" data-shop-field="nm" placeholder="Новая награда"></label>' +
        '<label>Цена ♥<input type="number" min="1" data-shop-field="cost" value="10"></label>' +
      '</div>' +
      '<input type="text" data-shop-field="ds" placeholder="Описание" style="margin-top:8px">' +
      '<div class="roles-row">' + shopRoleChecks("new", ["adult", "teen", "child"]) + '</div>' +
      '<button class="postsend" id="addShopItem" style="margin-top:8px">+ Добавить в магазин</button>' +
    '</div>';

    return '<h2 class="sec">Каталог магазина</h2>' + items + '<h2 class="sec">Новый товар</h2>' + newForm;
  }

  function viewAdminModeration() {
    var s = FH.state;
    var posts = s.posts.map(function (p) {
      var u = FH.userById(p.who) || {};
      return '<div class="card qmini"><div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div style="flex:1"><div class="tt" style="font-size:13.5px">' + (p.text || "(фото)") + '</div><div class="mt">' + (u.name || "") + ' · ' + FH.timeAgo(p.ts) + '</div></div>' +
        '<a class="del-x" data-del-post="' + p.id + '">✕</a></div>';
    }).join("") || '<p style="color:var(--muted);font-weight:700;font-size:13px">Постов нет</p>';

    var msgs = s.messages.map(function (m) {
      var u = FH.userById(m.who) || {};
      return '<div class="card qmini"><div class="mini-av" style="background:' + (u.color || "#ccc") + '22">' + FH.avatarHTML(u) + '</div>' +
        '<div style="flex:1"><div class="tt" style="font-size:13.5px">' + (m.text || "(фото)") + '</div><div class="mt">' + (u.name || "") + ' · ' + FH.timeAgo(m.ts) + '</div></div>' +
        '<a class="del-x" data-del-message="' + m.id + '">✕</a></div>';
    }).join("") || '<p style="color:var(--muted);font-weight:700;font-size:13px">Сообщений нет</p>';

    return '<h2 class="sec">Посты ленты</h2>' + posts + '<h2 class="sec">Сообщения чата</h2>' + msgs;
  }

  function viewAdminStats(stats) {
    if (!stats) return '<p style="color:var(--muted);font-weight:700">Загрузка статистики…</p>';
    var rows = stats.perMember.map(function (m) {
      return '<div class="card qmini"><div style="flex:1"><div class="tt">' + m.name + '</div>' +
        '<div class="mt">Квестов выполнено: ' + m.tasksDone + ' · в процессе: ' + m.tasksPending + '</div></div>' +
        '<div class="reward">' + m.hearts + '♥</div></div>';
    }).join("");
    return '<div class="stats3">' +
        '<div class="card stat"><div class="v">' + stats.membersCount + '</div><div class="l">Участников</div></div>' +
        '<div class="card stat"><div class="v">' + stats.tasksDone + '</div><div class="l">Квестов выполнено</div></div>' +
        '<div class="card stat"><div class="v">' + stats.heartsTotal + '♥</div><div class="l">Всего сердечек</div></div>' +
      '</div>' +
      '<div class="stats3" style="margin-top:12px">' +
        '<div class="card stat"><div class="v">' + stats.tasksPending + '</div><div class="l">В процессе</div></div>' +
        '<div class="card stat"><div class="v">' + stats.postsCount + '</div><div class="l">Постов</div></div>' +
        '<div class="card stat"><div class="v">' + stats.messagesCount + '</div><div class="l">Сообщений</div></div>' +
      '</div>' +
      '<h2 class="sec">По участникам</h2>' + rows;
  }

  FH.viewAdmin = function (section, stats) {
    var tabs = [
      { id: "members", t: "Участники" },
      { id: "quests", t: "Квесты и Магазин" },
      { id: "moderation", t: "Модерация" },
      { id: "stats", t: "Статистика" }
    ];
    var nav = '<div class="admin-tabs">' + tabs.map(function (tb) {
      return '<button class="ftab ' + (section === tb.id ? "on" : "") + '" data-adminsec="' + tb.id + '">' + tb.t + '</button>';
    }).join("") + '</div>';

    var body = "";
    if (section === "quests") body = viewAdminQuests() + viewAdminShop();
    else if (section === "moderation") body = viewAdminModeration();
    else if (section === "stats") body = viewAdminStats(stats);
    else body = viewAdminMembers();

    return '<div class="hero-greet">Админка ⚙️</div><p class="hero-sub">Управление семьёй «' + (FH.state.family ? FH.state.family.name : "") + '»</p>' + nav + body;
  };
})();
