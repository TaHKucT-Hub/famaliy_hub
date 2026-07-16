/* ============================================================
   WebSocket-клиент: живая синхронизация между устройствами семьи.
   Сервер шлёт {type:"changed", scope:"tasks"|"members"|"feed"|"chat"|"shop"},
   мы просто перезапрашиваем соответствующий кусок состояния.
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var socket = null;
  var onChanged = null;
  var reconnectDelay = 1000;
  var shouldRun = false;

  function url() {
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + location.host + "/api/ws?token=" + encodeURIComponent(FH.getToken());
  }

  function connect() {
    if (!shouldRun) return;
    try { socket = new WebSocket(url()); } catch (e) { scheduleReconnect(); return; }

    socket.onopen = function () { reconnectDelay = 1000; };
    socket.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === "changed" && onChanged) onChanged(msg.scope);
      } catch (e) { /* ignore malformed frame */ }
    };
    socket.onclose = function () { if (shouldRun) scheduleReconnect(); };
    socket.onerror = function () { try { socket.close(); } catch (e) {} };
  }

  function scheduleReconnect() {
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.6, 15000);
  }

  FH.ws = {
    connect: function (cb) {
      onChanged = cb;
      shouldRun = true;
      connect();
    },
    stop: function () {
      shouldRun = false;
      if (socket) try { socket.close(); } catch (e) {}
    },
  };

  // Переподключаемся, когда вкладка снова становится видимой (VK Mini App
  // сворачивается в фон и WS обычно рвётся) — плюс сразу дёргаем onChanged
  // на все разделы, чтобы подтянуть пропущенные события.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && shouldRun && (!socket || socket.readyState > 1)) {
      connect();
      ["tasks", "members", "feed", "chat", "shop", "documents", "invitations"].forEach(function (s) { if (onChanged) onChanged(s); });
    }
  });
})();
