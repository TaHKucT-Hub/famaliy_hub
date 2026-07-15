/* ============================================================
   Интеграция с VK Bridge.
   Работает и внутри VK Mini App, и автономно (в обычном браузере
   или на Render-превью) — во втором случае просто остаётся демо.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var bridge = window.vkBridge || null;

  FH.vk = {
    available: !!bridge,

    // Инициализация + подтягивание данных пользователя и темы
    init: function (onThemeChange) {
      if (!bridge) return Promise.resolve(false);

      // Тема из VK (light / dark)
      try {
        bridge.subscribe(function (e) {
          if (e && e.detail && e.detail.type === "VKWebAppUpdateConfig") {
            var scheme = e.detail.data && (e.detail.data.scheme || e.detail.data.appearance);
            if (scheme && onThemeChange) {
              onThemeChange(/dark|space_gray/.test(scheme) ? "dark" : "light");
            }
          }
        });
      } catch (e) {}

      return bridge.send("VKWebAppInit", {})
        .then(function () {
          // Реальный пользователь VK становится текущим участником (Папа)
          return bridge.send("VKWebAppGetUserInfo").catch(function () { return null; });
        })
        .then(function (info) {
          if (info && (info.first_name || info.photo_100)) {
            var me = FH.state.users[0]; // "dad" — точка входа
            if (info.first_name) me.name = info.first_name;
            if (info.photo_100) me.photo = info.photo_100;
            FH.state.meId = me.id;
            FH.save();
          }
          return true;
        })
        .catch(function () { return false; });
    },

    // Тактильная отдача при награде (если поддерживается устройством)
    tapHaptic: function () {
      if (!bridge) return;
      try { bridge.send("VKWebAppTapticNotificationOccurred", { type: "success" }); } catch (e) {}
    }
  };
})();
