/* ============================================================
   Интеграция с VK Bridge.
   Работает и внутри VK Mini App, и автономно (в обычном браузере) —
   во втором случае авторизация идёт в dev-режиме бэкенда (см. README).
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var bridge = window.vkBridge || null;

  FH.vk = {
    available: !!bridge,

    // vk_* параметры запуска (+ sign) — сервер проверяет подпись VK по ним.
    getLaunchParams: function () {
      var out = {};
      new URLSearchParams(window.location.search).forEach(function (v, k) { out[k] = v; });
      if (!bridge) return Promise.resolve(out);
      return bridge.send("VKWebAppGetLaunchParams")
        .then(function (p) { return Object.assign(out, p || {}); })
        .catch(function () { return out; });
    },

    // Имя/фото реального пользователя VK — для профиля при первой авторизации.
    getUserInfoSafe: function () {
      if (!bridge) return Promise.resolve({});
      return bridge.send("VKWebAppGetUserInfo")
        .then(function (info) {
          if (!info) return {};
          var name = [info.first_name, info.last_name].filter(Boolean).join(" ");
          return { name: name, photo_url: info.photo_200 || info.photo_100 || "" };
        })
        .catch(function () { return {}; });
    },

    // Инициализация моста + подписка на смену темы VK (light/dark)
    initTheme: function (onThemeChange) {
      if (!bridge) return Promise.resolve(false);
      try {
        bridge.subscribe(function (e) {
          if (e && e.detail && e.detail.type === "VKWebAppUpdateConfig") {
            var scheme = e.detail.data && (e.detail.data.scheme || e.detail.data.appearance);
            if (scheme && onThemeChange) onThemeChange(/dark|space_gray/.test(scheme) ? "dark" : "light");
          }
        });
      } catch (e) {}
      return bridge.send("VKWebAppInit", {}).then(function () { return true; }).catch(function () { return false; });
    },

    // Тактильная отдача при награде (если поддерживается устройством)
    tapHaptic: function () {
      if (!bridge) return;
      try { bridge.send("VKWebAppTapticNotificationOccurred", { type: "success" }); } catch (e) {}
    }
  };
})();
