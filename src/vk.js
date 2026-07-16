/* ============================================================
   Интеграция с VK Bridge.
   Работает и внутри VK Mini App, и автономно (в обычном браузере) —
   во втором случае авторизация идёт в dev-режиме бэкенда (см. README).

   Важно: vkBridge.send(...) ждёт ответа от родительского окна VK.
   Если скрипт просто загрузился в обычном браузере (а не внутри
   настоящего VK-клиента), этот ответ никогда не придёт и промис
   зависнет навсегда. Поэтому каждый вызов моста обёрнут таймаутом —
   иначе всё приложение встанет колом на экране загрузки.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var bridge = window.vkBridge || null;
  var BRIDGE_TIMEOUT = 2500;

  function withTimeout(promise, fallback) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(fallback); } }, BRIDGE_TIMEOUT);
      promise.then(
        function (v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
        function () { if (!done) { done = true; clearTimeout(timer); resolve(fallback); } }
      );
    });
  }

  FH.vk = {
    available: !!bridge,

    // vk_* параметры запуска (+ sign) — сервер проверяет подпись VK по ним.
    getLaunchParams: function () {
      var out = {};
      new URLSearchParams(window.location.search).forEach(function (v, k) { out[k] = v; });
      if (!bridge) return Promise.resolve(out);
      return withTimeout(bridge.send("VKWebAppGetLaunchParams"), null)
        .then(function (p) { return Object.assign(out, p || {}); });
    },

    // Имя/фото реального пользователя VK — для профиля при первой авторизации.
    getUserInfoSafe: function () {
      if (!bridge) return Promise.resolve({});
      return withTimeout(bridge.send("VKWebAppGetUserInfo"), null).then(function (info) {
        if (!info) return {};
        var name = [info.first_name, info.last_name].filter(Boolean).join(" ");
        return { name: name, photo_url: info.photo_200 || info.photo_100 || "" };
      });
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
      return withTimeout(bridge.send("VKWebAppInit", {}), null).then(function (v) { return !!v; });
    },

    // Тактильная отдача при награде (если поддерживается устройством)
    tapHaptic: function () {
      if (!bridge) return;
      try { bridge.send("VKWebAppTapticNotificationOccurred", { type: "success" }); } catch (e) {}
    }
  };
})();
