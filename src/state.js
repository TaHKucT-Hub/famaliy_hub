/* ============================================================
   Состояние приложения. Данные семьи живут на сервере (бэкенд +
   БД) — это лишь in-memory отражение последнего /api/bootstrap
   плюс горстка чисто локальных UI-настроек (тема/звук/онбординг).
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var PREF_KEY = "familyhub_prefs_v1";

  // Ранги (уровни). Каждые 300 XP — новый ранг/уровень.
  FH.RANKS = ["Зайчонок", "Бельчонок", "Хранитель Очага", "Легенда Семьи"];
  FH.rankFor = function (xp) {
    return FH.RANKS[Math.min(FH.RANKS.length - 1, Math.floor(xp / 300))];
  };
  FH.levelFor = function (xp) { return Math.floor(xp / 300) + 1; };
  FH.xpInLevel = function (xp) { return xp % 300; };

  FH.ACHIEVEMENTS = [
    { emo: "🌅", nm: "Ранняя пташка",       on: true },
    { emo: "👨‍🍳", nm: "Шеф-повар",          on: true },
    { emo: "🕊️", nm: "Миротворец",          on: true },
    { emo: "🏃", nm: "Спортсмен",           on: false },
    { emo: "💬", nm: "Мастер комплиментов", on: true },
    { emo: "🎨", nm: "Креативщик",          on: false },
    { emo: "🔥", nm: "Стрик 7 дней",         on: true },
    { emo: "👑", nm: "Легенда",             on: false }
  ];

  FH.state = { meId: null, family: null, users: [], tasks: [], posts: [], messages: [] };
  FH.SHOP = [];

  // ---- Локальные UI-настройки (per-device, не часть данных семьи) ----
  FH.prefs = (function () {
    var p = { theme: "light", sound: true, onboarded: false };
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) Object.assign(p, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return p;
  })();
  FH.savePrefs = function () {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(FH.prefs)); } catch (e) { /* ignore */ }
  };

  // ---- Заполнение состояния из /api/bootstrap ----
  FH.setBootstrap = function (data) {
    FH.state.meId = data.me.id;
    FH.state.family = data.family;
    FH.state.users = data.members;
    FH.state.tasks = data.tasks;
    FH.state.posts = data.posts;
    FH.state.messages = data.messages;
    FH.SHOP = data.shop;
  };

  // ---- Помощники ----
  FH.me = function () {
    var s = FH.state;
    for (var i = 0; i < s.users.length; i++) if (s.users[i].id === s.meId) return s.users[i];
    return s.users[0] || { id: null, name: "", hearts: 0, xp: 0, adult: false };
  };
  FH.roleCode = function (u) { return u.roleCode || (u.adult ? "adult" : "child"); };
  // HTML аватара: реальное фото (с сервера или из VK), если есть, иначе эмодзи
  FH.avatarHTML = function (u) {
    if (!u) return "";
    var photo = u.photo || "";
    if (!photo) return u.av || "🙂";
    var src = photo.indexOf("/api/files/") === 0 ? FH.fileUrl(photo) : photo;
    return '<img src="' + src + '" alt="">';
  };
  FH.userById = function (id) {
    var s = FH.state;
    for (var i = 0; i < s.users.length; i++) if (s.users[i].id === id) return s.users[i];
    return null;
  };
  // Относительное время для ленты/чата
  FH.timeAgo = function (ts) {
    var min = Math.floor(Math.max(0, Date.now() - ts) / 60000);
    if (min < 1) return "только что";
    if (min < 60) return min + " мин";
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + " ч";
    return Math.floor(hrs / 24) + " дн";
  };
})();
