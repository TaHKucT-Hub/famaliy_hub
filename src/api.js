/* ============================================================
   Клиент REST API бэкенда. Все данные семьи теперь на сервере —
   localStorage больше не источник истины (только UI-настройки).
   ============================================================ */
(function () {
  "use strict";
  window.FH = window.FH || {};

  var token = sessionStorage.getItem("fh_token") || "";

  FH.setToken = function (t) {
    token = t || "";
    if (token) sessionStorage.setItem("fh_token", token);
    else sessionStorage.removeItem("fh_token");
  };
  FH.getToken = function () { return token; };
  FH.fileUrl = function (path) {
    if (!path) return "";
    return path + (path.indexOf("?") === -1 ? "?" : "&") + "token=" + encodeURIComponent(token);
  };

  async function req(method, path, body) {
    var opts = { method: method, headers: {} };
    if (token) opts.headers.Authorization = "Bearer " + token;
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(path, opts);
    var data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      var msg = (data && data.detail) ? data.detail : ("Ошибка " + res.status);
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  async function upload(kind, file, title) {
    var fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (title) fd.append("title", title);
    var res = await fetch("/api/files", {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + token } : {},
      body: fd,
    });
    var data = await res.json();
    if (!res.ok) throw new Error((data && data.detail) || "Не удалось загрузить файл");
    return data;
  }

  FH.api = {
    authVk: function (params, name, photo_url) { return req("POST", "/api/auth", { params: params, name: name, photo_url: photo_url }); },
    whoami: function () { return req("GET", "/api/auth/me"); },

    createFamily: function (name) { return req("POST", "/api/family/create", { name: name }); },
    joinFamily: function (code) { return req("POST", "/api/family/join", { code: code }); },

    bootstrap: function () { return req("GET", "/api/bootstrap"); },
    members: function () { return req("GET", "/api/members"); },

    tasks: {
      list: function () { return req("GET", "/api/tasks"); },
      create: function (t) { return req("POST", "/api/tasks", t); },
      complete: function (id) { return req("POST", "/api/tasks/" + id + "/complete"); },
      remove: function (id) { return req("DELETE", "/api/tasks/" + id); },
      attachProof: function (id, fileId) { return req("POST", "/api/tasks/" + id + "/proof", { fileId: fileId }); },
    },

    shop: {
      list: function () { return req("GET", "/api/shop"); },
      buy: function (id) { return req("POST", "/api/shop/" + id + "/buy"); },
    },

    feed: {
      list: function () { return req("GET", "/api/feed"); },
      create: function (text, fileIds) { return req("POST", "/api/feed", { text: text, fileIds: fileIds || [] }); },
      remove: function (id) { return req("DELETE", "/api/feed/" + id); },
      like: function (id) { return req("POST", "/api/feed/" + id + "/like"); },
      comment: function (id, text) { return req("POST", "/api/feed/" + id + "/comments", { text: text }); },
      removeComment: function (id) { return req("DELETE", "/api/feed/comments/" + id); },
    },

    chat: {
      list: function () { return req("GET", "/api/chat"); },
      send: function (text, fileId) { return req("POST", "/api/chat", { text: text, fileId: fileId || null }); },
      remove: function (id) { return req("DELETE", "/api/chat/" + id); },
    },

    files: {
      upload: upload,
      listDocuments: function () { return req("GET", "/api/files"); },
      removeDocument: function (id) { return req("DELETE", "/api/files/" + id); },
    },

    me: {
      setAvatar: function (fileId) { return req("PATCH", "/api/me/avatar", { fileId: fileId }); },
    },

    admin: {
      patchMember: function (id, patch) { return req("PATCH", "/api/admin/members/" + id, patch); },
      removeMember: function (id) { return req("DELETE", "/api/admin/members/" + id); },
      createShopItem: function (item) { return req("POST", "/api/admin/shop", item); },
      updateShopItem: function (id, item) { return req("PATCH", "/api/admin/shop/" + id, item); },
      removeShopItem: function (id) { return req("DELETE", "/api/admin/shop/" + id); },
      stats: function () { return req("GET", "/api/admin/stats"); },
      invite: function (payload) { return req("POST", "/api/admin/invite", payload); },
      listInvitations: function () { return req("GET", "/api/admin/invitations"); },
      cancelInvitation: function (id) { return req("DELETE", "/api/admin/invitations/" + id); },
    },
  };
})();
