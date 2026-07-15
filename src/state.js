/* ============================================================
   Состояние приложения + сохранение в localStorage.
   Прототип работает без бэкенда: все данные живут в браузере.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var STORAGE_KEY = "familyhub_v1";

  // Ранги (уровни). Каждые 300 XP — новый ранг/уровень.
  FH.RANKS = ["Зайчонок", "Бельчонок", "Хранитель Очага", "Легенда Семьи"];
  FH.rankFor = function (xp) {
    return FH.RANKS[Math.min(FH.RANKS.length - 1, Math.floor(xp / 300))];
  };
  FH.levelFor = function (xp) { return Math.floor(xp / 300) + 1; };
  FH.xpInLevel = function (xp) { return xp % 300; };

  // ---- Значения по умолчанию (демо-семья) ----
  function defaults() {
    return {
      meId: "dad",
      theme: "light",
      sound: true,
      onboarded: false,
      users: [
        { id: "dad",   name: "Папа",  role: "Админ",     age: "18+", av: "👨", photo: "", color: "#4DD0E1", hearts: 240, xp: 820, adult: true },
        { id: "mom",   name: "Мама",  role: "Родитель",  age: "18+", av: "👩", photo: "", color: "#FF6B6B", hearts: 310, xp: 940, adult: true },
        { id: "anya",  name: "Аня",   role: "Подросток", age: "16",  av: "👧", photo: "", color: "#F5A623", hearts: 180, xp: 560, adult: false },
        { id: "misha", name: "Миша",  role: "Ребёнок",   age: "12",  av: "🧒", photo: "", color: "#9C6ADE", hearts: 95,  xp: 210, adult: false }
      ],
      tasks: [
        { id: 1, who: "misha", ic: "🛏️", txt: "Заправить кровать",        meta: "Каждый день · до 9:00", reward: 10, done: false, streak: 6 },
        { id: 2, who: "misha", ic: "📚", txt: "Сделать домашку",           meta: "Сегодня · до 18:00",    reward: 25, done: false, streak: 0 },
        { id: 3, who: "anya",  ic: "🐶", txt: "Выгулять собаку",           meta: "Вечер",                 reward: 15, done: false, streak: 3 },
        { id: 4, who: "dad",   ic: "🧾", txt: "Забрать куртку из химчистки", meta: "Пинг от Мамы 💬",      reward: 20, done: false, streak: 0 },
        { id: 5, who: "mom",   ic: "🥗", txt: "Меню на неделю",            meta: "Планировщик",           reward: 30, done: false, streak: 0 },
        { id: 6, who: "anya",  ic: "🗑️", txt: "Вынести мусор",             meta: "Пн / Ср / Пт",          reward: 10, done: false, streak: 0 }
      ]
    };
  }

  // Каталог Магазина (не меняется — не храним в localStorage)
  FH.SHOP = [
    { id: "tv",     emo: "📺", nm: "Час планшета",         ds: "+1 час экранного времени",         cost: 40,  roles: ["child", "teen"] },
    { id: "film",   emo: "🎬", nm: "Выбор фильма",          ds: "Ты решаешь, что смотрим вечером",   cost: 60,  roles: ["child", "teen"] },
    { id: "ice",    emo: "🍦", nm: "Мороженое",             ds: "Любое на твой выбор",               cost: 30,  roles: ["child", "teen"] },
    { id: "silence",emo: "🤫", nm: "Час тишины",            ds: "Никто не беспокоит 60 минут",       cost: 80,  roles: ["adult"] },
    { id: "nocook", emo: "🍕", nm: "День без готовки",       ds: "Сегодня готовит кто-то другой",     cost: 120, roles: ["adult"] },
    { id: "fish",   emo: "🎣", nm: "Выходной на рыбалку",    ds: "Законный день для себя",            cost: 200, roles: ["adult"] },
    { id: "secret", emo: "💝", nm: "Тайное желание",         ds: "Приватная награда для двоих",       cost: 150, roles: ["adult"], adult18: true, locked: true }
  ];

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

  // ---- Загрузка / сохранение ----
  FH.load = function () {
    var base = defaults();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        // Мягкое слияние: сохранённые поля поверх дефолтов
        if (saved && typeof saved === "object") {
          if (saved.meId) base.meId = saved.meId;
          if (saved.theme) base.theme = saved.theme;
          if (typeof saved.sound === "boolean") base.sound = saved.sound;
          if (typeof saved.onboarded === "boolean") base.onboarded = saved.onboarded;
          if (Array.isArray(saved.users)) base.users = saved.users;
          if (Array.isArray(saved.tasks)) base.tasks = saved.tasks;
        }
      }
    } catch (e) { /* повреждённое хранилище — берём дефолты */ }
    FH.state = base;
    return base;
  };

  FH.save = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(FH.state)); }
    catch (e) { /* приватный режим / переполнение — игнорируем */ }
  };

  FH.reset = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    FH.load();
  };

  // ---- Помощники ----
  FH.me = function () {
    var s = FH.state;
    for (var i = 0; i < s.users.length; i++) if (s.users[i].id === s.meId) return s.users[i];
    return s.users[0];
  };
  FH.roleCode = function (u) {
    return u.adult ? "adult" : (u.role === "Подросток" ? "teen" : "child");
  };
  // HTML аватара: реальное фото из VK, если есть, иначе эмодзи
  FH.avatarHTML = function (u) {
    return u.photo ? '<img src="' + u.photo + '" alt="">' : u.av;
  };

  FH.load();
})();
