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
      /* another tab still holds the older database (opened before an update): the upgrade waits until it closes; say so */
      r.onblocked = function () { window.parent.postMessage({ ns: 'vault', blocked: true }, '*'); };
      /* the browser reports "blocked" only to the first page that asks; a later page just waits, so after 4 s say it anyway */
      var slow = setTimeout(r.onblocked, 4000);
      r.onsuccess = function () {
        clearTimeout(slow);
        var d = r.result;
        d.onversionchange = function () { d.close(); dbp = null; };   /* a newer page needs to upgrade: let it */
        res(d);
      };
      r.onerror = function () { clearTimeout(slow); rej(r.error); };
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
  /* ---------- one auto save for every site ----------
     The folder is chosen once on my.niveshsahayak.in (core.js keeps the handle in this origin's 'ns-folder' database).
     This data home is open on every Nivesh Sahayak site (hidden frame), so any change, from any site or the App, marks the
     data "changed" and the full backup file (same as "Back up everything") is written here a moment later.
     The browser may ask for its OK again after a restart; a frame can't ask, so it tells the page ('af': 'ask') and the page
     shows "Auto save paused", which opens my.niveshsahayak.in to allow it. Changes made meanwhile wait ('dirty') and are written
     as soon as any page of this data home has the OK again. */
  var AF_FILE = 'nivesh-sahayak-backup.json', AF_SKIP = { lastBackup: 1 }, afT = 0;
  var afOk = 'showDirectoryPicker' in window;
  var fdbp;
  function fdb() {
    if (fdbp) return fdbp;
    fdbp = new Promise(function (res, rej) {
      var r = indexedDB.open('ns-folder', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('h'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { fdbp = null; rej(r.error); };
    });
    return fdbp;
  }
  function fget(k) { return fdb().then(function (d) { return new Promise(function (res) { var q = d.transaction('h').objectStore('h').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); }); }
  function fput(k, v) { return fdb().then(function (d) { return new Promise(function (res) { var t = d.transaction('h', 'readwrite'); v == null ? t.objectStore('h').delete(k) : t.objectStore('h').put(v, k); t.oncomplete = res; t.onerror = res; }); }); }
  function afTell(st) { if (window.parent !== window) window.parent.postMessage({ ns: 'vault', af: st }, '*'); }
  /* 'ok' written, 'ask' needs the browser's OK, 'off' no folder chosen, 'no' this browser can't */
  function afWrite() {
    if (!afOk) return Promise.resolve('no');
    var go = function () {
      var start = Date.now();
      return fget('dir').then(function (h) {
        if (!h) return 'off';
        return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
          if (p !== 'granted') return 'ask';
          return OPS.exportAll().then(function (data) {
            var b = { app: 'Nivesh Sahayak', kind: 'backup', version: 1, saved: new Date().toISOString(), data: data };
            return h.getFileHandle(AF_FILE, { create: true }).then(function (fh) { return fh.createWritable(); })
              .then(function (w) { return w.write(JSON.stringify(b, null, 1)).then(function () { return w.close(); }); });
          }).then(function () {
            return tx('meta', 'readwrite', function (s) { s.put({ id: 'lastBackup', v: Date.now(), updated: Date.now() }); });
          }).then(function () {
            return fget('dirty').then(function (d) { if (!d || d <= start) return fput('dirty', null); });   /* a change during the write: keep it for the next one */
          }).then(function () { return fput('last', Date.now()); }).then(function () { return 'ok'; });
        });
      }).catch(function () { return 'ask'; });
    };
    /* several tabs each have a data home frame: one writes at a time */
    return navigator.locks && navigator.locks.request ? navigator.locks.request('ns-autosave', go) : go();
  }
  function afSoon(ms) {
    clearTimeout(afT);
    afT = setTimeout(function () { afWrite().then(function (st) { if (st === 'ok' || st === 'ask') afTell(st); }); }, ms == null ? 1500 : ms);
  }
  function changed(store, value) {
    if (!afOk) return;
    if (store === 'meta' && value && [].concat(value).every(function (v) { return v && AF_SKIP[v.id]; })) return;
    fput('dirty', Date.now()).then(function () { afSoon(); }, function () {});
  }
  ['put', 'del', 'clear'].forEach(function (op) {
    var f = OPS[op];
    OPS[op] = function (a) { return f(a).then(function (r) { changed(a.store, a.value); return r; }); };
  });
  OPS.afStatus = function () {
    if (!afOk) return Promise.resolve({ supported: false });
    return Promise.all([fget('dir'), fget('dirty'), fget('last')]).then(function (r) {
      var h = r[0];
      if (!h) return { supported: true, on: false };
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        return { supported: true, on: true, name: h.name, file: AF_FILE, allowed: p === 'granted', waiting: !!r[1], last: r[2] || 0 };
      });
    });
  };
  /* now: write at once (after choosing or allowing the folder); otherwise in a moment, like any change */
  OPS.afWrite = function (a) {
    if (a && a.now) { clearTimeout(afT); return afWrite(); }
    return fget('dir').then(function (h) { if (h) afSoon(); return h ? 'soon' : 'off'; });
  };
  OPS.afOff = function () { return Promise.all([fput('dir', null), fput('dirty', null)]).then(function () { return 'off'; }); };

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
  if (afOk) fget('dirty').then(function (d) { if (d) afSoon(800); }, function () {});
  db().then(function () { window.parent.postMessage({ ns: 'vault', ready: true }, '*'); },
    function () { window.parent.postMessage({ ns: 'vault', ready: false }, '*'); });
})();
