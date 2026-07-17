/* ============================================================
   Точка входа: авторизация через VK, загрузка состояния с сервера,
   сборка UI, обработка событий, живая синхронизация через WS.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var tab = "home";
  var feedSub = "wall";
  var openPostId = null;
  var pendingPostFiles = [];
  var adminSection = "members";
  var adminStats = null;
  var invitations = [];
  var documents = [];
  var screenEl = document.getElementById("screen");

  function isAdmin() { return FH.me().role === "admin"; }

  // ---- Тема / звук (чисто локальные, per-device настройки) ----
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#1E1A17" : "#FFF8F0");
    var btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    FH.prefs.theme = theme;
  }
  function applySoundBtn() {
    var b = document.getElementById("soundBtn");
    if (b) b.textContent = FH.prefs.sound ? "🔊" : "🔈";
  }
  function syncMe() {
    var me = FH.me();
    document.getElementById("meAv").innerHTML = FH.avatarHTML(me);
    document.getElementById("meHearts").textContent = me.hearts;
  }

  // ---- Полный рендер текущей вкладки ----
  function render() {
    syncMe();
    document.getElementById("nav").innerHTML = FH.renderNav(tab, isAdmin());
    if (tab === "home")   screenEl.innerHTML = FH.viewHome();
    if (tab === "feed")   screenEl.innerHTML = FH.viewFeed(feedSub, openPostId, pendingPostFiles);
    if (tab === "tasks")  screenEl.innerHTML = FH.viewTasks();
    if (tab === "shop")   screenEl.innerHTML = FH.viewShop();
    if (tab === "family") screenEl.innerHTML = FH.viewFamily(documents);
    if (tab === "me")     screenEl.innerHTML = FH.viewProfile();
    if (tab === "admin")  screenEl.innerHTML = isAdmin() ? FH.viewAdmin(adminSection, adminStats, invitations) : FH.viewHome();
    if (tab === "feed" && feedSub === "chat") screenEl.scrollTop = screenEl.scrollHeight;
    else screenEl.scrollTop = 0;
  }
  FH.render = render;

  // ---- Живая синхронизация: сервер сообщает, что изменилось ----
  async function refetch(scope) {
    try {
      if (scope === "tasks") {
        FH.state.tasks = await FH.api.tasks.list();
        if (tab === "tasks" || tab === "home" || (tab === "admin" && adminSection === "quests")) render();
      } else if (scope === "members") {
        FH.state.users = await FH.api.members();
        render();
      } else if (scope === "feed") {
        FH.state.posts = await FH.api.feed.list();
        if ((tab === "feed" && feedSub === "wall") || (tab === "admin" && adminSection === "moderation")) render();
      } else if (scope === "chat") {
        FH.state.messages = await FH.api.chat.list();
        if ((tab === "feed" && feedSub === "chat") || (tab === "admin" && adminSection === "moderation")) render();
      } else if (scope === "shop") {
        FH.SHOP = await FH.api.shop.list();
        if (tab === "shop" || (tab === "admin" && adminSection === "quests")) render();
      } else if (scope === "documents") {
        documents = await FH.api.files.listDocuments();
        if (tab === "family") render();
      } else if (scope === "invitations" && isAdmin()) {
        invitations = await FH.api.admin.listInvitations();
        if (tab === "admin" && adminSection === "members") render();
      }
    } catch (e) { /* транзитная ошибка сети — подтянется на следующем событии */ }
  }

  // ---- Задачи ----
  async function completeTask(id, el, txt) {
    var beforeLvl = FH.levelFor(FH.me().xp);
    try {
      var resp = await FH.api.tasks.complete(id);
      var r = el.getBoundingClientRect();
      FH.confetti(r.left + r.width / 2, r.top);
      FH.floatHearts(r.left + r.width / 2, r.top, resp.gain);
      FH.playCoin();
      if (FH.vk.tapHaptic) FH.vk.tapHaptic();
      FH.state.tasks = await FH.api.tasks.list();
      FH.state.users = await FH.api.members();
      syncMe();
      FH.toast("+" + resp.gain + "♥ за «" + txt + "»" + (resp.gain > 0 && el ? "" : ""));
      var afterLvl = FH.levelFor(FH.me().xp);
      if (afterLvl > beforeLvl) setTimeout(function () { FH.levelUp(FH.rankFor(FH.me().xp)); }, 700);
      render();
    } catch (e) { FH.toast(e.message); }
  }

  async function quickAddTask() {
    var input = document.getElementById("quickTaskInput");
    var txt = input.value.trim();
    if (!txt) return;
    try {
      await FH.api.tasks.create({ txt: txt, ic: "📝", meta: "Личное", reward: 5 });
      input.value = "";
      FH.state.tasks = await FH.api.tasks.list();
      render();
    } catch (e) { FH.toast(e.message); }
  }

  async function attachProof(taskId, file) {
    try {
      var up = await FH.api.files.upload("task_proof", file);
      await FH.api.tasks.attachProof(taskId, up.id);
      FH.state.tasks = await FH.api.tasks.list();
      render();
    } catch (e) { FH.toast(e.message); }
  }

  // ---- Магазин ----
  function askBuy(itemId) {
    var it = null;
    for (var i = 0; i < FH.SHOP.length; i++) if (FH.SHOP[i].id === itemId) it = FH.SHOP[i];
    if (!it) return;
    var me = FH.me();
    if (me.hearts < it.cost) { FH.toast("Не хватает сердечек 🥲"); return; }

    FH.openSheet({
      emo: it.emo, title: "Купить «" + it.nm + "»?",
      text: it.adult18 ? "Спишется " + it.cost + "♥. Приватная награда." : "Спишется " + it.cost + "♥ из твоей копилки.",
      okText: "Купить за " + it.cost + "♥",
      onOk: async function () {
        try {
          await FH.api.shop.buy(itemId);
          FH.state.users = await FH.api.members();
          FH.closeSheet(); syncMe(); FH.playCoin();
          FH.toast(it.adult18 ? "💝 Готово" : "Готово! «" + it.nm + "» активировано ✨");
          render();
        } catch (e) { FH.closeSheet(); FH.toast(e.message); }
      }
    });
  }

  // ---- Лента ----
  async function sendPost() {
    var input = document.getElementById("postInput");
    var text = input.value.trim();
    var fileIds = pendingPostFiles.map(function (f) { return f.id; });
    if (!text && !fileIds.length) return;
    try {
      await FH.api.feed.create(text, fileIds);
      pendingPostFiles = [];
      FH.state.posts = await FH.api.feed.list();
      render();
    } catch (e) { FH.toast(e.message); }
  }
  async function handlePostPhotoSelect(files) {
    for (var i = 0; i < files.length; i++) {
      try { pendingPostFiles.push(await FH.api.files.upload("post_photo", files[i])); }
      catch (e) { FH.toast(e.message); }
    }
    render();
  }
  async function toggleLike(id) {
    try { await FH.api.feed.like(id); FH.state.posts = await FH.api.feed.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }
  function toggleComments(id) { openPostId = openPostId === id ? null : id; render(); }
  async function sendComment(id) {
    var input = document.querySelector('[data-cinput="' + id + '"]');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    try { await FH.api.feed.comment(id, text); FH.state.posts = await FH.api.feed.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }
  async function deleteComment(id) {
    try { await FH.api.feed.removeComment(id); FH.state.posts = await FH.api.feed.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }
  async function deletePost(id) {
    try { await FH.api.feed.remove(id); FH.state.posts = await FH.api.feed.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }

  // ---- Чат ----
  async function sendChat() {
    var input = document.getElementById("chatInput");
    var text = input.value.trim();
    if (!text) return;
    try {
      input.value = "";
      await FH.api.chat.send(text);
      FH.state.messages = await FH.api.chat.list();
      render();
    } catch (e) { FH.toast(e.message); }
  }
  async function sendChatPhoto(file) {
    try {
      var up = await FH.api.files.upload("post_photo", file);
      await FH.api.chat.send("", up.id);
      FH.state.messages = await FH.api.chat.list();
      render();
    } catch (e) { FH.toast(e.message); }
  }
  async function deleteMessage(id) {
    try { await FH.api.chat.remove(id); FH.state.messages = await FH.api.chat.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }

  // ---- Профиль / аватар ----
  async function uploadAvatar(file) {
    try {
      var up = await FH.api.files.upload("avatar", file);
      await FH.api.me.setAvatar(up.id);
      FH.state.users = await FH.api.members();
      syncMe(); render();
      FH.toast("Аватар обновлён ✨");
    } catch (e) { FH.toast(e.message); }
  }

  // ---- Документы семьи ----
  async function loadDocuments() {
    try { documents = await FH.api.files.listDocuments(); if (tab === "family") render(); } catch (e) {}
  }
  async function uploadDocument(file, title) {
    try {
      await FH.api.files.upload("document", file, title);
      documents = await FH.api.files.listDocuments();
      render();
      FH.toast("Документ загружен");
    } catch (e) { FH.toast(e.message); }
  }
  async function deleteDocument(id) {
    try { await FH.api.files.removeDocument(id); documents = await FH.api.files.listDocuments(); render(); }
    catch (e) { FH.toast(e.message); }
  }

  // ---- Админка ----
  async function adminPatchMember(id, field, value) {
    var patch = {};
    patch[field] = (field === "hearts" || field === "xp") ? (parseInt(value, 10) || 0) : value;
    try {
      await FH.api.admin.patchMember(id, patch);
      FH.state.users = await FH.api.members();
      syncMe(); render();
    } catch (e) { FH.toast(e.message); render(); }
  }
  function adminRemoveMember(id) {
    FH.openSheet({
      emo: "🗑️", title: "Удалить участника?", text: "Он потеряет доступ к семье. Отменить нельзя.", okText: "Удалить",
      onOk: async function () {
        try { await FH.api.admin.removeMember(id); FH.state.users = await FH.api.members(); FH.closeSheet(); render(); }
        catch (e) { FH.closeSheet(); FH.toast(e.message); }
      }
    });
  }
  async function loadAdminStats() {
    try { adminStats = await FH.api.admin.stats(); if (tab === "admin" && adminSection === "stats") render(); }
    catch (e) { /* not admin or transient */ }
  }
  async function loadInvitations() {
    try { invitations = await FH.api.admin.listInvitations(); if (tab === "admin" && adminSection === "members") render(); }
    catch (e) { /* not admin or transient */ }
  }
  function currentInviteRole() {
    var roleSel = document.getElementById("inviteRole");
    return roleSel ? roleSel.value : "child";
  }

  // Пикер друзей (VKWebAppGetFriends) во многих версиях VK доступен только
  // из мобильного приложения — в браузерной версии он либо отклоняется,
  // либо просто недоступен. Тогда просто подсказываем воспользоваться
  // формой ручного ввода ниже, а не оставляем кнопку молча ничего не делающей.
  async function inviteFriend() {
    var role = currentInviteRole();

    if (!FH.vk.insideVK) {
      FH.toast("Список друзей доступен только внутри VK — впишите VK ID вручную ниже");
      return;
    }

    var friends = await FH.vk.getFriends();
    if (!friends) { FH.toast("Список друзей недоступен в этой версии VK — впишите VK ID вручную ниже"); return; }
    if (!friends.length) return; // пикер закрыли без выбора

    var ok = 0, failMsg = "";
    for (var i = 0; i < friends.length; i++) {
      try {
        await FH.api.admin.invite({ vkUserId: friends[i].id, name: friends[i].name, photoUrl: friends[i].photo, role: role });
        ok++;
      } catch (e) { failMsg = e.message; }
    }
    await loadInvitations();
    if (ok) FH.toast(ok > 1 ? "Приглашения отправлены" : "Приглашение отправлено");
    else if (failMsg) FH.toast(failMsg);
  }

  function parseVkId(raw) {
    var s = raw.trim();
    if (/^\d+$/.test(s)) return s;
    var m = s.match(/id(\d+)/i);
    if (m) return m[1];
    m = s.match(/[?&]user_id=(\d+)/i);
    if (m) return m[1];
    return null;
  }

  async function inviteManual() {
    var idInput = document.getElementById("inviteVkId");
    var nameInput = document.getElementById("inviteName");
    var vkId = parseVkId(idInput.value || "");
    if (!vkId) { FH.toast("Нужен числовой VK ID (например 123456789 или ссылка vk.com/id123456789)"); return; }
    var name = (nameInput.value || "").trim() || "Гость";
    try {
      await FH.api.admin.invite({ vkUserId: vkId, name: name, photoUrl: "", role: currentInviteRole() });
      idInput.value = ""; nameInput.value = "";
      await loadInvitations();
      FH.toast("Приглашение отправлено");
    } catch (e) { FH.toast(e.message); }
  }

  async function cancelInvitation(id) {
    try { await FH.api.admin.cancelInvitation(id); await loadInvitations(); }
    catch (e) { FH.toast(e.message); }
  }
  async function adminCreateTask() {
    var who = Number(document.getElementById("atWho").value);
    var txt = document.getElementById("atTxt").value.trim();
    var reward = parseInt(document.getElementById("atReward").value, 10) || 10;
    var dueStr = document.getElementById("atDue").value;
    var recur = document.getElementById("atRecur").value || null;
    if (!txt) { FH.toast("Введите текст задачи"); return; }
    var dueDate = dueStr ? new Date(dueStr + "T12:00:00").getTime() : null;
    try {
      await FH.api.tasks.create({ txt: txt, who: who, reward: reward, dueDate: dueDate, recurrence: recur, ic: "📌", meta: "От админа" });
      FH.state.tasks = await FH.api.tasks.list();
      render();
      FH.toast("Задача создана");
    } catch (e) { FH.toast(e.message); }
  }
  async function adminDeleteTask(id) {
    try { await FH.api.tasks.remove(id); FH.state.tasks = await FH.api.tasks.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }
  function collectShopRoles(prefix) {
    var roles = [];
    ["adult", "teen", "child"].forEach(function (r) {
      var chk = document.querySelector('[data-role-chk="' + prefix + '-' + r + '"]');
      if (chk && chk.checked) roles.push(r);
    });
    return roles;
  }
  async function adminSaveShopItem(id) {
    var card = document.querySelector('[data-shop-item="' + id + '"]');
    var get = function (f) { return card.querySelector('[data-shop-field="' + f + '"]'); };
    var item = {
      emo: get("emo").value, nm: get("nm").value, ds: get("ds").value,
      cost: parseInt(get("cost").value, 10) || 1, roles: collectShopRoles("s" + id),
      locked: get("locked") ? get("locked").checked : false, adult18: false
    };
    try { await FH.api.admin.updateShopItem(id, item); FH.SHOP = await FH.api.shop.list(); render(); FH.toast("Сохранено"); }
    catch (e) { FH.toast(e.message); }
  }
  async function adminAddShopItem() {
    var card = document.querySelector('[data-shop-item="new"]');
    var get = function (f) { return card.querySelector('[data-shop-field="' + f + '"]'); };
    var nm = get("nm").value.trim();
    if (!nm) { FH.toast("Введите название"); return; }
    var item = { emo: get("emo").value || "🎁", nm: nm, ds: get("ds").value, cost: parseInt(get("cost").value, 10) || 10, roles: collectShopRoles("new"), locked: false, adult18: false };
    try { await FH.api.admin.createShopItem(item); FH.SHOP = await FH.api.shop.list(); render(); FH.toast("Товар добавлен"); }
    catch (e) { FH.toast(e.message); }
  }
  async function adminDeleteShopItem(id) {
    try { await FH.api.admin.removeShopItem(id); FH.SHOP = await FH.api.shop.list(); render(); }
    catch (e) { FH.toast(e.message); }
  }

  // ---- Онбординг (обучающие экраны, показываются один раз на устройстве) ----
  var ONB = [
    { emo: "🏡", h: "Добро пожаловать в Family Hub", p: "Быт становится игрой, а забота друг о друге — заметной. Всё в одном тёплом пространстве." },
    { emo: "♥", h: "Зарабатывай сердечки", p: "Выполняй квесты, помогай близким и получай ♥. Держи стрик 7 дней — награда удваивается." },
    { emo: "🛍️", h: "Трать на реальные бонусы", p: "Час планшета, выбор фильма, день без готовки, выходной на рыбалку. Магазин привилегий ждёт." }
  ];
  function showOnboarding(afterClose) {
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
      FH.prefs.onboarded = true; FH.savePrefs();
      if (afterClose) afterClose();
    }
    el.hidden = false;
    draw();
  }

  // ---- Код приглашения крупно и надолго, а не тостом на 2 секунды ----
  function showInviteCodeSheet(code) {
    FH.openSheet({
      emo: "🔑",
      title: "Семья создана!",
      text: 'Код приглашения: <b style="font-size:22px;letter-spacing:.06em">' + code + '</b>' +
        '<br><br>Перешлите его остальным. На экране входа им нужно нажать «Присоединиться по коду», а не «Создать семью» — иначе каждый создаст свою отдельную семью и увидит только себя.',
      okText: "Скопировать код",
      single: true,
      onOk: function () {
        var done = function () { FH.toast("Код скопирован: " + code); };
        if (navigator.clipboard) navigator.clipboard.writeText(code).then(done).catch(function () { FH.toast("Код: " + code); });
        else FH.toast("Код: " + code);
        FH.closeSheet();
      }
    });
  }

  // ---- Онбординг семьи: создать новую / вступить по коду ----
  function showFamilySetup(mode, error) {
    var el = document.getElementById("familySetup");
    el.hidden = false;
    el.innerHTML = FH.viewFamilySetup(mode, error);

    if (mode === "create" || mode === "join") {
      document.getElementById("fsBack").onclick = function () { showFamilySetup("choice"); };
    }
    if (mode === "create") {
      var nameInput = document.getElementById("fsFamilyName");
      var go = function () {
        var name = nameInput.value.trim() || "Наша семья";
        FH.api.createFamily(name).then(function (resp) {
          FH.setToken(resp.token);
          el.hidden = true;
          enterApp(function () { showInviteCodeSheet(resp.family.invite_code); });
        }).catch(function (e) { showFamilySetup("create", e.message); });
      };
      document.getElementById("fsCreateGo").onclick = go;
      nameInput.addEventListener("keydown", function (ev) { if (ev.key === "Enter") go(); });
    } else if (mode === "join") {
      var codeInput = document.getElementById("fsCode");
      var goJoin = function () {
        var code = codeInput.value.trim();
        if (!code) return;
        FH.api.joinFamily(code).then(function (resp) {
          FH.setToken(resp.token);
          el.hidden = true;
          enterApp();
        }).catch(function (e) { showFamilySetup("join", e.message); });
      };
      document.getElementById("fsJoinGo").onclick = goJoin;
      codeInput.addEventListener("keydown", function (ev) { if (ev.key === "Enter") goJoin(); });
    } else {
      document.getElementById("fsCreate").onclick = function () { showFamilySetup("create"); };
      document.getElementById("fsJoin").onclick = function () { showFamilySetup("join"); };
    }
  }

  // ---- События внутри экрана (делегирование) ----
  screenEl.addEventListener("click", function (e) {
    var chk = e.target.closest("[data-check]");
    if (chk) {
      var tid = Number(chk.getAttribute("data-check"));
      var t = FH.state.tasks.filter(function (x) { return x.id === tid; })[0];
      if (t && !t.done) completeTask(tid, chk, t.txt);
      return;
    }
    var buy = e.target.closest("[data-buy]");
    if (buy) { askBuy(Number(buy.getAttribute("data-buy"))); return; }

    var feedsub = e.target.closest("[data-feedsub]");
    if (feedsub) { feedSub = feedsub.getAttribute("data-feedsub"); openPostId = null; render(); return; }

    var like = e.target.closest("[data-like]");
    if (like) { toggleLike(Number(like.getAttribute("data-like"))); return; }

    var togglec = e.target.closest("[data-toggle-comments]");
    if (togglec) { toggleComments(Number(togglec.getAttribute("data-toggle-comments"))); return; }

    var csend = e.target.closest("[data-csend]");
    if (csend) { sendComment(Number(csend.getAttribute("data-csend"))); return; }

    var delc = e.target.closest("[data-del-comment]");
    if (delc) { deleteComment(Number(delc.getAttribute("data-del-comment"))); return; }

    var delp = e.target.closest("[data-del-post]");
    if (delp) { deletePost(Number(delp.getAttribute("data-del-post"))); return; }

    var rmpend = e.target.closest("[data-remove-pending]");
    if (rmpend) { pendingPostFiles.splice(Number(rmpend.getAttribute("data-remove-pending")), 1); render(); return; }

    var postSend = e.target.closest("#postSend");
    if (postSend) { sendPost(); return; }

    var chatSend = e.target.closest("#chatSend");
    if (chatSend) { sendChat(); return; }

    var delmsg = e.target.closest("[data-del-message]");
    if (delmsg) { deleteMessage(Number(delmsg.getAttribute("data-del-message"))); return; }

    var quickAdd = e.target.closest("#quickTaskAdd");
    if (quickAdd) { quickAddTask(); return; }

    var copyInv = e.target.closest("#copyInvite");
    if (copyInv) { showInviteCodeSheet(FH.state.family ? FH.state.family.invite_code : ""); return; }

    var delDoc = e.target.closest("[data-del-doc]");
    if (delDoc) { deleteDocument(Number(delDoc.getAttribute("data-del-doc"))); return; }

    var adminsec = e.target.closest("[data-adminsec]");
    if (adminsec) {
      adminSection = adminsec.getAttribute("data-adminsec");
      if (adminSection === "stats") { adminStats = null; render(); loadAdminStats(); }
      else if (adminSection === "members") { render(); loadInvitations(); }
      else render();
      return;
    }

    var rmMember = e.target.closest("[data-remove-member]");
    if (rmMember) { adminRemoveMember(Number(rmMember.getAttribute("data-remove-member"))); return; }

    var atCreate = e.target.closest("#atCreate");
    if (atCreate) { adminCreateTask(); return; }

    var admDelTask = e.target.closest("[data-admin-del-task]");
    if (admDelTask) { adminDeleteTask(Number(admDelTask.getAttribute("data-admin-del-task"))); return; }

    var saveShop = e.target.closest("[data-save-shop]");
    if (saveShop) { adminSaveShopItem(Number(saveShop.getAttribute("data-save-shop"))); return; }

    var delShop = e.target.closest("[data-del-shop]");
    if (delShop) { adminDeleteShopItem(Number(delShop.getAttribute("data-del-shop"))); return; }

    var addShop = e.target.closest("#addShopItem");
    if (addShop) { adminAddShopItem(); return; }

    var inviteBtn = e.target.closest("#inviteFriendBtn");
    if (inviteBtn) { inviteFriend(); return; }

    var inviteManualBtn = e.target.closest("#inviteManualBtn");
    if (inviteManualBtn) { inviteManual(); return; }

    var cancelInv = e.target.closest("[data-cancel-invite]");
    if (cancelInv) { cancelInvitation(Number(cancelInv.getAttribute("data-cancel-invite"))); return; }
  });

  screenEl.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "postPhotoInput") { if (t.files && t.files.length) handlePostPhotoSelect(t.files); t.value = ""; return; }
    if (t.id === "avatarInput") { if (t.files && t.files[0]) uploadAvatar(t.files[0]); t.value = ""; return; }
    if (t.id === "chatPhotoInput") { if (t.files && t.files[0]) sendChatPhoto(t.files[0]); t.value = ""; return; }
    if (t.id === "docFileInput") {
      if (t.files && t.files[0]) uploadDocument(t.files[0], (document.getElementById("docTitleInput") || {}).value || "");
      t.value = ""; return;
    }
    if (t.hasAttribute && t.hasAttribute("data-proof-input")) {
      var tid = Number(t.getAttribute("data-proof-input"));
      if (t.files && t.files[0]) attachProof(tid, t.files[0]);
      t.value = ""; return;
    }
    var field = t.getAttribute && t.getAttribute("data-field");
    if (field) { adminPatchMember(Number(t.getAttribute("data-member")), field, t.value); return; }
  });

  screenEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.id === "chatInput") { e.preventDefault(); sendChat(); return; }
    if (e.target.id === "quickTaskInput") { e.preventDefault(); quickAddTask(); return; }
    if (e.target.id === "inviteVkId" || e.target.id === "inviteName") { e.preventDefault(); inviteManual(); return; }
    if (e.target.matches && e.target.matches("[data-cinput]")) {
      e.preventDefault();
      sendComment(Number(e.target.getAttribute("data-cinput")));
    }
  });

  document.getElementById("nav").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.getAttribute("data-tab");
    if (tab === "feed") openPostId = null;
    if (tab === "admin" && adminSection === "stats" && !adminStats) loadAdminStats();
    if (tab === "admin" && adminSection === "members") loadInvitations();
    render();
  });

  document.getElementById("meChip").addEventListener("click", function () { tab = "me"; render(); });

  document.getElementById("themeBtn").addEventListener("click", function () {
    applyTheme(FH.prefs.theme === "dark" ? "light" : "dark");
    FH.savePrefs();
  });

  document.getElementById("soundBtn").addEventListener("click", function () {
    FH.prefs.sound = !FH.prefs.sound;
    applySoundBtn(); FH.savePrefs();
    if (FH.prefs.sound) FH.playCoin();
  });

  // ---- Запуск ----
  async function enterApp(afterReady) {
    var data = await FH.api.bootstrap();
    FH.setBootstrap(data);
    render();
    loadDocuments();
    FH.ws.connect(refetch);
    if (!FH.prefs.onboarded) showOnboarding(afterReady);
    else if (afterReady) afterReady();
  }

  async function boot() {
    applyTheme(FH.prefs.theme);
    applySoundBtn();
    FH.vk.initTheme(function (theme) { applyTheme(theme); FH.savePrefs(); });

    var results = await Promise.all([FH.vk.getLaunchParams(), FH.vk.getUserInfoSafe()]);
    var launch = results[0], profile = results[1];

    var authResp;
    try {
      authResp = await FH.api.authVk(launch, profile.name, profile.photo_url);
    } catch (e) {
      screenEl.innerHTML = '<div class="card" style="margin-top:40px;padding:24px;text-align:center">' +
        '<div style="font-size:34px">📡</div><p style="font-weight:800;margin-top:10px">Не удалось подключиться к серверу</p>' +
        '<p style="color:var(--muted);font-size:13px">' + e.message + '</p></div>';
      return;
    }
    FH.setToken(authResp.token);

    if (authResp.needs_family) { showFamilySetup("choice"); return; }
    await enterApp();
  }

  boot();
})();
