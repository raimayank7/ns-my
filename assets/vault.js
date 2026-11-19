/* Edit history seal (ERP Round 1, A-1, 19 Nov 2026). Pure functions, also run by node (scripts/test_audit.js).
   Every edit-history entry gets prev = the seal of the entry written before it and h = SHA-256(prev + the entry without h,
   keys in a fixed order). The data home keeps the newest seal in meta 'logHead'. Changing, removing or inserting an entry
   afterwards breaks the chain, and "Check edit history" says where.
     NSLogChain.seal(entry, head)   -> Promise(entry with prev and h)
     NSLogChain.verify(rows, head)  -> Promise({ ok, total, sealed, unsealed, bad: [{ kind: 'changed'|'missing'|'tail', at, id, after }] })
   Entries from before the seal existed (no h) are counted as 'unsealed' and are not a break. */
(function (G) {
  'use strict';
  function canon(v) {
    if (v === null || v === undefined || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  function body(e) { var o = {}; Object.keys(e || {}).forEach(function (k) { if (k !== 'h') o[k] = e[k]; }); return o; }
  function subtle() { var c = G.crypto || (typeof require === 'function' ? require('crypto').webcrypto : null); return c && c.subtle; }
  function sha(s) {
    var su = subtle();
    if (!su) return Promise.resolve('');
    return su.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function hashOf(e) { return sha(String(e.prev || '') + canon(body(e))); }
  function seal(e, head) {
    e.prev = head || '';
    delete e.h;
    return hashOf(e).then(function (h) { if (h) e.h = h; return e; });
  }
  function verify(rows, head) {
    rows = (rows || []).filter(Boolean);
    var sealed = rows.filter(function (e) { return e.h; }), seen = {}, bad = [];
    sealed.forEach(function (e) { seen[e.h] = e; });
    var byAt = rows.slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    function before(e) { var p = null; byAt.forEach(function (x) { if ((x.at || 0) < (e.at || 0)) p = x; }); return p ? p.at : 0; }
    return Promise.all(sealed.map(function (e) { return hashOf(e).then(function (h) { return h === e.h; }); })).then(function (okList) {
      sealed.forEach(function (e, i) {
        if (!okList[i]) bad.push({ kind: 'changed', id: e.id, at: e.at });
        else if (e.prev && !seen[e.prev]) bad.push({ kind: 'missing', id: e.id, at: e.at, after: before(e) });
      });
      if (head && !seen[head]) {
        var last = byAt.length ? byAt[byAt.length - 1].at : 0;
        bad.push({ kind: 'tail', at: last, after: last });
      }
      bad.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      return { ok: !bad.length, total: rows.length, sealed: sealed.length, unsealed: rows.length - sealed.length, bad: bad };
    });
  }
  /* the newest sealed entry (a restore onto an empty data home continues its chain) */
  function newestSeal(rows) {
    var l = (rows || []).filter(function (e) { return e && e.h; }), heads = {};
    l.forEach(function (e) { heads[e.h] = 1; });
    l.forEach(function (e) { if (e.prev) delete heads[e.prev]; });
    var tips = l.filter(function (e) { return heads[e.h]; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return tips.length ? tips[0].h : '';
  }
  var API = { canon: canon, sha: sha, seal: seal, verify: verify, newestSeal: newestSeal };
  G.NSLogChain = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* Nivesh Sahayak data home (my.niveshsahayak.in/vault.html)
   Every document site (billing., quotation., ...) loads this page in a hidden frame and talks to it with
   postMessage, so customers, items and businesses typed once are there on every site.
   The data stays in this browser (IndexedDB). Only niveshsahayak.in pages (and localhost while testing) may ask. */
(function () {
  'use strict';
  /* bin = recycle bin (deleted records kept 30 days), log = edit history (who/when/what changed; only ever added to),
     ver = full earlier versions of changed and deleted records (ERP Round 1, A-2; only ever added to, never purged) */
  var STORES = ['biz', 'party', 'item', 'doc', 'meta', 'bin', 'log', 'ver'];
  var ALLOWED = /^https:\/\/([a-z0-9-]+\.)*niveshsahayak\.in$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  /* the edit history and the earlier versions can only be added to: never changed, removed or cleared, not even by a restore (A-1) */
  var KEEP = { log: 1, ver: 1 }, HEAD = 'logHead';
  var CHAIN = window.NSLogChain || null;
  var dbp;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('ns-vault', 3);
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

  function kept(store) { var e = new Error('The edit history cannot be changed or removed'); e.kept = true; return Promise.reject(e); }
  function rawPut(store, list) { return tx(store, 'readwrite', function (s) { list.forEach(function (v) { s.put(v); }); }).then(function () { return list.length; }); }
  /* add only: rows whose id is already there are left as they are */
  function addOnly(store, list) {
    return OPS.list({ store: store }).then(function (have) {
      var ids = {}; have.forEach(function (h) { ids[h.id] = 1; });
      var add = list.filter(function (r) { return r && r.id && !ids[r.id] && (ids[r.id] = 1); });
      return add.length ? rawPut(store, add) : 0;
    });
  }
  /* one entry at a time gets sealed onto the chain (several tabs each have a data home frame) */
  var logQ = Promise.resolve();
  function serial(fn) {
    var run = function () { return navigator.locks && navigator.locks.request ? navigator.locks.request('ns-log', fn) : fn(); };
    var p = logQ.then(run, run); logQ = p.catch(function () {}); return p;
  }
  function getHead() { return tx('meta', 'readonly', function (s) { return s.get(HEAD); }).then(function (r) { return r && r.v || ''; }); }
  function setHead(h) { return tx('meta', 'readwrite', function (s) { s.put({ id: HEAD, v: h, updated: Date.now() }); }); }
  /* entries in the order given: each is sealed onto the newest seal; an id already in the history is skipped */
  function logAdd(list) {
    return serial(function () {
      return OPS.list({ store: 'log' }).then(function (have) {
        var ids = {}; have.forEach(function (h) { ids[h.id] = 1; });
        var add = list.filter(function (r) { return r && r.id && !ids[r.id] && (ids[r.id] = 1); });
        if (!add.length) return 0;
        return getHead().then(function (head) {
          if (!head && CHAIN) head = CHAIN.newestSeal(have);
          return add.reduce(function (p, e) {
            return p.then(function () { return CHAIN ? CHAIN.seal(e, head).then(function (x) { head = x.h || head; }) : null; });
          }, Promise.resolve()).then(function () { return rawPut('log', add); }).then(function (n) { return head ? setHead(head).then(function () { return n; }) : n; });
        });
      });
    });
  }
  var OPS = {
    list: function (a) { check(a.store); return tx(a.store, 'readonly', function (s) { return s.getAll(); }); },
    get: function (a) { check(a.store); return tx(a.store, 'readonly', function (s) { return s.get(a.id); }); },
    put: function (a) {
      check(a.store);
      var list = Array.isArray(a.value) ? a.value : [a.value];
      if (a.store === 'log') return logAdd(list);
      if (a.store === 'ver') return addOnly('ver', list);
      if (a.store === 'meta' && list.some(function (v) { return v && v.id === HEAD; })) return kept('meta');   /* the newest seal is kept by this page only */
      return rawPut(a.store, list);
    },
    del: function (a) { check(a.store); if (KEEP[a.store] || a.store === 'meta' && a.id === HEAD) return kept(a.store); return tx(a.store, 'readwrite', function (s) { s.delete(a.id); }); },
    clear: function (a) { check(a.store); if (KEEP[a.store]) return kept(a.store); return tx(a.store, 'readwrite', function (s) { s.clear(); }); },
    /* ERP Round 1, A-1: an edit history entry, sealed onto the chain */
    logAdd: function (a) { return logAdd(Array.isArray(a.value) ? a.value : [a.value]); },
    /* "Check edit history": walks the chain and says where it breaks */
    logCheck: function () {
      return Promise.all([OPS.list({ store: 'log' }), getHead()]).then(function (r) {
        if (!CHAIN) return { ok: true, total: r[0].length, sealed: 0, unsealed: r[0].length, bad: [] };
        return CHAIN.verify(r[0], r[1]);
      });
    },
    exportAll: function () {
      var out = {};
      return STORES.reduce(function (p, s) {
        return p.then(function () { return OPS.list({ store: s }).then(function (rows) { out[s] = rows; }); });
      }, Promise.resolve()).then(function () { return out; });
    },
    /* merge by id: the newer "updated" wins, so importing an old backup never overwrites newer work.
       The edit history and earlier versions are never cleared or overwritten, not even by "Replace" (A-1): only entries this
       data home does not have yet are added (log entries without a seal, e.g. made offline, are sealed in time order). */
    importAll: function (a) {
      var data = a.data || {}, added = 0;
      return STORES.reduce(function (p, s) {
        var rows = Array.isArray(data[s]) ? data[s] : [];
        if (KEEP[s]) return p.then(function () {
          var l = rows.filter(function (r) { return r && r.id; });
          if (s === 'log') {
            var sealed = l.filter(function (r) { return r.h; }), open = l.filter(function (r) { return !r.h; }).sort(function (x, y) { return (x.at || 0) - (y.at || 0); });
            return addOnly('log', sealed).then(function (n) {
              added += n;
              return getHead().then(function (h) { if (!h && n && CHAIN) { var nh = CHAIN.newestSeal(sealed); if (nh) return setHead(nh); } });
            }).then(function () { return logAdd(open); }).then(function (n) { added += n; });
          }
          return addOnly(s, l).then(function (n) { added += n; });
        });
        if (s === 'meta') rows = rows.filter(function (r) { return !r || r.id !== HEAD; });
        var head;
        return p.then(function () {
          if (a.replace) return (s === 'meta' ? getHead().then(function (h) { head = h; }) : Promise.resolve()).then(function () { return OPS.clear({ store: s }); }).then(function () { if (head) return setHead(head); });
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
  var AF_FILE = 'nivesh-sahayak-backup.json', AF_SKIP = { lastBackup: 1, autosave: 1 }, afT = 0;
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
  function afTell(st) {
    if (window.parent !== window) window.parent.postMessage({ ns: 'vault', af: st }, '*');
    else document.dispatchEvent(new CustomEvent('ns-autosave', { detail: st }));   /* my.niveshsahayak.in's own page uses this file directly */
  }
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
  /* 15 Nov 2026: the file is written by the App or My data page itself (core.js); a frame inside another site never has the
     browser's OK for the folder. Here: mark the change and tell the page around this frame, and the frames of other tabs. */
  var afBc = null; try { afBc = new BroadcastChannel('ns-af'); afBc.onmessage = function () { afTell('chg'); }; } catch (e) {}
  function changed(store, value) {
    if (store === 'meta' && value && [].concat(value).every(function (v) { return v && AF_SKIP[v.id]; })) return;
    afTell('chg'); if (afBc) try { afBc.postMessage(1); } catch (e) {}
    if (afOk) fput('dirty', Date.now()).catch(function () {});
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
  db().then(function () { window.parent.postMessage({ ns: 'vault', ready: true }, '*'); },
    function () { window.parent.postMessage({ ns: 'vault', ready: false }, '*'); });
})();
