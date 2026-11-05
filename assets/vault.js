/* Nivesh Sahayak data home (my.niveshsahayak.in/vault.html)
   Every document site (billing., quotation., ...) loads this page in a hidden frame and talks to it with
   postMessage, so customers, items and businesses typed once are there on every site.
   The data stays in this browser (IndexedDB). Only niveshsahayak.in pages (and localhost while testing) may ask. */
(function () {
  'use strict';
  /* bin = recycle bin (deleted records kept 30 days), log = edit history (who/when/what changed; only ever added to) */
  var STORES = ['biz', 'party', 'item', 'doc', 'meta', 'bin', 'log'];
  var ALLOWED = /^https:\/\/([a-z0-9-]+\.)*niveshsahayak\.in$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  var dbp;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('ns-vault', 2);
      r.onupgradeneeded = function () {
        STORES.forEach(function (s) { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' }); });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out;
        var s = t.objectStore(store);
        out = fn(s);
        t.oncomplete = function () { res(out && 'result' in out ? out.result : out); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  function check(store) { if (STORES.indexOf(store) < 0) throw new Error('Unknown store ' + store); }

  var OPS = {
    list: function (a) { check(a.store); return tx(a.store, 'readonly', function (s) { return s.getAll(); }); },
    get: function (a) { check(a.store); return tx(a.store, 'readonly', function (s) { return s.get(a.id); }); },
    put: function (a) {
      check(a.store);
      var list = Array.isArray(a.value) ? a.value : [a.value];
      return tx(a.store, 'readwrite', function (s) { list.forEach(function (v) { s.put(v); }); }).then(function () { return list.length; });
    },
    del: function (a) { check(a.store); return tx(a.store, 'readwrite', function (s) { s.delete(a.id); }); },
    clear: function (a) { check(a.store); return tx(a.store, 'readwrite', function (s) { s.clear(); }); },
    exportAll: function () {
      var out = {};
      return STORES.reduce(function (p, s) {
        return p.then(function () { return OPS.list({ store: s }).then(function (rows) { out[s] = rows; }); });
      }, Promise.resolve()).then(function () { return out; });
    },
    /* merge by id: the newer "updated" wins, so importing an old backup never overwrites newer work */
    importAll: function (a) {
      var data = a.data || {}, added = 0;
      return STORES.reduce(function (p, s) {
        var rows = Array.isArray(data[s]) ? data[s] : [];
        return p.then(function () {
          if (a.replace) return OPS.clear({ store: s });
        }).then(function () {
          return OPS.list({ store: s });
        }).then(function (have) {
          var map = {};
          have.forEach(function (h) { map[h.id] = h; });
          var put = rows.filter(function (r) {
            if (!r || !r.id) return false;
            var h = map[r.id];
            return !h || (r.updated || 0) > (h.updated || 0);
          });
          added += put.length;
          return put.length ? OPS.put({ store: s, value: put }) : 0;
        });
      }, Promise.resolve()).then(function () { return added; });
    },
    persist: function () {
      if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
      return navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); });
    },
    estimate: function () {
      if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
      return navigator.storage.estimate();
    }
  };
  window.NSVault = OPS; // used directly by my.niveshsahayak.in's own page

  if (window.parent === window) return;
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.ns !== 'vault' || !m.op) return;
    if (!ALLOWED.test(e.origin)) return;
    var fn = OPS[m.op];
    var reply = function (ok, val) { e.source.postMessage({ ns: 'vault', id: m.id, ok: ok, result: ok ? val : String(val && val.message || val) }, e.origin); };
    if (!fn) return reply(false, 'Unknown operation');
    Promise.resolve().then(function () { return fn(m.args || {}); }).then(function (v) { reply(true, v); }, function (err) { reply(false, err); });
  });
  db().then(function () { window.parent.postMessage({ ns: 'vault', ready: true }, '*'); },
    function () { window.parent.postMessage({ ns: 'vault', ready: false }, '*'); });
})();
