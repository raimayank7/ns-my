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

  /* ---------- the browser database (IndexedDB): the old store, kept up to date as a safety copy (Stage 1) ---------- */
  function idbAll(s) { return tx(s, 'readonly', function (o) { return o.getAll(); }); }
  function idbGet(s, id) { return tx(s, 'readonly', function (o) { return o.get(id); }); }
  function idbPut(s, list) { return tx(s, 'readwrite', function (o) { list.forEach(function (v) { o.put(v); }); }).then(function () { return list.length; }); }
  function idbDel(s, id) { return tx(s, 'readwrite', function (o) { o.delete(id); }); }
  function idbClear(s) { return tx(s, 'readwrite', function (o) { o.clear(); }); }

  /* ---------- NSBiz data on SQLite, Stage 1 (owner 20 Nov 2026) ----------
     The data lives in SQLite files (sqlworker.js): Common.sqlite + one file per business per year (NSBiz01/2026-27.sqlite …).
     The pool file store lets one tab at a time hold the files, so the data-home frame that gets the 'nsbiz-sql' lock starts
     the worker and serves every other tab over BroadcastChannel 'nsbiz-sql'. A frozen or closing tab gives the lock away
     and the next tab takes over. Every save also goes into the old browser database, so nothing is lost if SQLite is not
     there (old browser, private window) or fails: that tab then works on the old database and marks it ('sqlBehind'), and the
     next SQLite start takes everything in again from it. Switch off for a test: ?nosql=1 or localStorage nsbiz-sql = off. */
  var SQL = (function () {
    var off = false;
    try { off = /[?&]nosql=1/.test(location.search) || localStorage.getItem('nsbiz-sql') === 'off'; } catch (e) {}
    /* the Windows program (Stage 2): its own SQLite files in Public Documents\NSBiz\Data, reached through its local server */
    if (window.NSD_SQL && !off) {
      var dk = { has: true, on: false, desk: true };
      dk.call = function (op, args) {
        /* the main PC's hidden data home window (office network) asks the program directly (ns-desktop vault-preload.js) */
        if (typeof window.nsdSql === 'function') return window.nsdSql(op, args || {}).then(function (m) { if (!m || !m.ok) throw new Error(m && m.error || 'failed'); return m.result; });
        return fetch(window.NSD_SQL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NSD': '1' }, body: JSON.stringify({ op: op, args: args || {} }) })
          .then(function (r) { return r.json(); }).then(function (m) { if (!m.ok) throw new Error(m.error || 'failed'); return m.result; });
      };
      dk.raw = dk.call;
      /* the first window to start takes in the old browser database once (several windows: one at a time) */
      dk.ready = dk.call('hello', {}).then(function () { return navigator.locks ? navigator.locks.request('nsbiz-sql-start', function () { return dk.catchUp(); }) : dk.catchUp(); })
        .then(function () { dk.on = true; return true; }, function (e) { dk.error = String(e && e.message || e); return false; });
      return dk;
    }
    var HAS =!off && typeof Worker === 'function' && typeof BroadcastChannel === 'function' && typeof WebAssembly === 'object' &&
      navigator.locks && navigator.locks.request && navigator.storage && navigator.storage.getDirectory;
    if (!HAS) return { has: false, ready: Promise.resolve(false), on: false, call: function () { return Promise.reject(new Error('no sqlite')); } };
    var me = Math.random().toString(36).slice(2), seq = 0, waitW = {}, waitB = {}, worker = null, owner = false, release = null, api = { has: true, on: false };
    var bc = new BroadcastChannel('nsbiz-sql');
    function wcall(op, args) {
      return new Promise(function (res, rej) { var id = ++seq; waitW[id] = [res, rej]; worker.postMessage({ id: id, op: op, args: args }); });
    }
    function onW(e) { var m = e.data, w = waitW[m.id]; if (!w) return; delete waitW[m.id]; if (m.ok) w[0](m.result); else w[1](new Error(m.result)); }
    /* the owner answers other tabs one request at a time, in order */
    var line = Promise.resolve();
    bc.onmessage = function (e) {
      var m = e.data || {};
      if (m.re && m.to === me) { var w = waitB[m.re]; if (w) { delete waitB[m.re]; clearTimeout(w[2]); if (m.ok) w[0](m.result); else w[1](new Error(m.result)); } return; }
      if (m.ack && m.to === me) { var k = waitB[m.ack]; if (k) { clearTimeout(k[2]); k[2] = setTimeout(k[3], 180000); } return; }   /* the owner has it: wait (big lists take seconds), only give up after 3 minutes */
      if (m.ask && owner) {
        bc.postMessage({ ack: m.ask, to: m.from });
        line = line.then(function () { return api.ready; }).then(function (ok) {
          if (!ok) throw new Error('sqlite unavailable');
          return wcall(m.op, m.args);
        }).then(function (r) { bc.postMessage({ re: m.ask, to: m.from, ok: true, result: r }); }, function (er) { bc.postMessage({ re: m.ask, to: m.from, ok: false, result: String(er && er.message || er) }); });
      }
      if (m.up && !owner && api.upFn) api.upFn(true);
      if (m.down && !owner && api.upFn) api.upFn(false);
    };
    function bcall(op, args, tries) {
      return new Promise(function (res, rej) {
        var id = me + ':' + (++seq), again = function () {
          delete waitB[id];
          if ((tries || 0) < 5) bcall(op, args, (tries || 0) + 1).then(res, rej); else rej(new Error('no answer'));
        }, t = setTimeout(again, 3000);   /* no "got it" from an owner in 3 s: the owner tab is changing; ask again */
        waitB[id] = [res, rej, t, again];
        bc.postMessage({ ask: id, from: me, op: op, args: args });
      });
    }
    api.call = function (op, args) { return owner ? api.ready.then(function () { return wcall(op, args); }) : bcall(op, args); };
    api.raw = function (op, args) { return wcall(op, args); };   /* the owner's start-up only (before 'ready') */
    function take() {
      navigator.locks.request('nsbiz-sql', function () {
        return new Promise(function (rel) {
          release = rel; owner = true;
          worker = new Worker('/assets/sqlworker.js?v=' + (window.NS_SQLV || ''), { type: 'module' });
          worker.onmessage = onW;
          worker.onerror = function () { Object.keys(waitW).forEach(function (k) { waitW[k][1](new Error('worker failed')); delete waitW[k]; }); };
          api.ready = wcall('hello', {}).then(function () { return api.catchUp(); }).then(function () { api.on = true; bc.postMessage({ up: 1 }); return true; },
            function (er) { api.on = false; api.error = String(er && er.message || er); bc.postMessage({ down: 1 }); return false; });
          readyRes(api.ready);
        });
      });
    }
    function give() {   /* this tab is being frozen or closed: let another tab take over */
      if (!owner) return;
      owner = false; api.on = false;
      var w = worker; worker = null;
      var done = function () { try { w && w.terminate(); } catch (e) {} if (release) { var r = release; release = null; r(); } };
      if (w) { try { w.postMessage({ id: -1, op: 'pause' }); } catch (e) {} setTimeout(done, 300); } else done();
    }
    var readyRes;
    api.ready = new Promise(function (res) { readyRes = res; });
    /* a tab that is not the owner: SQLite is "on" once the owner says hello */
    api.upFn = function (ok) { api.on = ok; readyRes(ok); };
    take();
    setTimeout(function () {   /* nobody answered: ask the owner directly once, else stay on the old database for now */
      if (owner) return;
      bcall('hello', {}, 4).then(function () { api.upFn(true); }, function () { api.upFn(false); });
    }, 400);
    document.addEventListener('freeze', give);
    window.addEventListener('pagehide', give);
    document.addEventListener('resume', function () { if (!owner) take(); });
    return api;
  })();
  window.NSSql = SQL;

  /* ---------- user logins (Stage 2) ----------
     The login lives in this tab only (sessionStorage of the data home); every SQLite command carries it and sqlauth.js checks the
     rights where the data is. Once logins are on: no fallback to the old browser database (it would bypass the rights) and no
     safety copy in it (the data there would be readable without a password): it is emptied, only the mark 'nsbizLogins' stays,
     so a browser that cannot run SQLite refuses instead of showing old data. */
  var AUTHERR = /^NSAUTH: /;
  /* the Windows program's office network: the main PC's hidden data home window does the work of every PC, one command at a
     time, each with the login of the PC that asked (window.__nsdTok, set by the program around the command) */
  function lanTok() { return typeof window.__nsdTok === 'string'; }
  function tok() { if (lanTok()) return window.__nsdTok; try { return sessionStorage.getItem('nsbiz-tok') || ''; } catch (e) { return ''; } }
  function setTok(t) { if (lanTok()) return; try { if (t) sessionStorage.setItem('nsbiz-tok', t); else sessionStorage.removeItem('nsbiz-tok'); } catch (e) {} }
  var LOGINS = false, ME = null;
  function withTok(a) { var o = {}; for (var k in a) o[k] = a[k]; o.tok = tok(); return o; }
  function idbLocked() { return idbGet('meta', 'nsbizLogins').then(function (r) { return !!r; }, function () { return false; }); }
  function lockedErr() { return Promise.reject(new Error('NSAUTH: this browser cannot open data protected by logins; use Chrome, Edge or the NSBiz program')); }
  /* logins just came on (or this tab logged in): the old browser database keeps no copy any more */
  function dropCopy() {
    LOGINS = true;
    return STORES.reduce(function (p, s) { return p.then(function () { return idbClear(s); }); }, Promise.resolve())
      .then(function () { return idbPut('meta', [{ id: 'nsbizLogins', v: Date.now(), updated: Date.now() }]); }).catch(function () {});
  }
  function sq(op, a) { return SQL.call(op, withTok(a)); }
  /* Stage 4: after a backup is brought back with logins off, the old browser copy gets the same data (it is the fall-back) */
  function mirror() {
    return STORES.reduce(function (p, s) {
      return p.then(function () { return sq('list', { store: s }).then(function (rows) { return idbClear(s).then(function () { return rows.length ? idbPut(s, rows) : 0; }); }); });
    }, Promise.resolve()).then(function () { return idbDel('meta', 'sqlBehind').catch(function () {}); }).catch(function () {});
  }
  /* after a backup came back: the login of this tab belonged to the replaced files; the old browser copy follows the new data */
  function afterRestore(r) {
    setTok(''); ME = null; LOGINS = false; areadyP = null;
    return SQL.call('authStatus', {}).then(function (st) {
      if (st && st.on) return dropCopy().then(function () { return r; });
      return mirror().then(function () { return r; });
    });
  }
  function b64(u) { var s = '', i, n = u.length; for (i = 0; i < n; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, Math.min(n, i + 32768))); return btoa(s); }
  function unb64(t) { var s = atob(t), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  var areadyP = null;
  function AREADY() {
    if (!areadyP) areadyP = SQL.ready.then(function () {
      if (!SQL.on) return null;
      return SQL.call('authStatus', withTok({})).then(function (st) { LOGINS = !!st.on; ME = st.me || null; if (LOGINS) return idbLocked().then(function (l) { return l ? null : dropCopy(); }); }, function () {});
    });
    return areadyP;
  }
  /* the engine every command below uses: SQLite when it is there, else the old database; every save goes into both until logins are on */
  function behind() { return idbPut('meta', [{ id: 'sqlBehind', v: Date.now(), updated: Date.now() }]); }
  function fallback(e, fn) { if (e && AUTHERR.test(e.message || '')) throw e; return fn(); }
  function plain(fn) { return function () { var args = arguments; return idbLocked().then(function (l) { return l ? lockedErr() : fn.apply(null, args); }); }; }
  var E = {
    all: function (s) { return AREADY().then(function () { return SQL.on ? sq('list', { store: s }).catch(function (e) { return fallback(e, function () { return plain(idbAll)(s); }); }) : plain(idbAll)(s); }); },
    get: function (s, id) { return AREADY().then(function () { return SQL.on ? sq('get', { store: s, id: id }).catch(function (e) { return fallback(e, function () { return plain(idbGet)(s, id); }); }) : plain(idbGet)(s, id); }); },
    put: function (s, list) {
      return AREADY().then(function () {
        if (!SQL.on) return plain(idbPut)(s, list).then(function (n) { return !SQL.has ? n : behind().then(function () { return n; }); });
        return sq('put', { store: s, rows: list }).then(function () { return LOGINS ? list.length : idbPut(s, list); },
          function (e) { return fallback(e, function () { return idbPut(s, list).then(function (n) { return behind().then(function () { return n; }); }); }); });
      });
    },
    del: function (s, id) {
      return AREADY().then(function () {
        if (!SQL.on) return plain(idbDel)(s, id).then(function () { return SQL.has ? behind() : null; });
        return sq('del', { store: s, id: id }).then(function () { return LOGINS ? null : idbDel(s, id); }, function (e) { return fallback(e, function () { return idbDel(s, id).then(behind); }); });
      });
    },
    clear: function (s) {
      return AREADY().then(function () {
        if (!SQL.on) return plain(idbClear)(s).then(function () { return SQL.has ? behind() : null; });
        return sq('clear', { store: s }).then(function () { return LOGINS ? null : idbClear(s); }, function (e) { return fallback(e, function () { return idbClear(s).then(behind); }); });
      });
    }
  };
  /* owner start: the first time (or after a tab worked without SQLite), take everything in from the old database.
     Never once logins are on: the old database is then empty on purpose. */
  SQL.catchUp = function () {
    return Promise.all([SQL.raw('authStatus', {}), SQL.raw('info', { k: 'migrated' }).catch(function () { return null; }), idbGet('meta', 'sqlBehind')]).then(function (r0) {
      if (r0[0] && r0[0].on) { LOGINS = true; return; }
      var r = [r0[1], r0[2]];
      if (r[0] && !r[1]) return;
      var data = {};
      return STORES.reduce(function (p, st) { return p.then(function () { return idbAll(st).then(function (rows) { data[st] = st === 'meta' ? rows.filter(function (x) { return x && x.id !== 'sqlBehind'; }) : rows; }); }); }, Promise.resolve())
        .then(function () { return SQL.raw('importRaw', { data: data, force: true }); })
        .then(function () { return r[1] ? idbDel('meta', 'sqlBehind') : null; });
    });
  };

  function kept(store) { var e = new Error('The edit history cannot be changed or removed'); e.kept = true; return Promise.reject(e); }
  function rawPut(store, list) { return E.put(store, list); }
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
  function getHead() { return E.get('meta', HEAD).then(function (r) { return r && r.v || ''; }); }
  function setHead(h) { return E.put('meta', [{ id: HEAD, v: h, updated: Date.now() }]); }
  /* entries in the order given: each is sealed onto the newest seal; an id already in the history is skipped */
  function logAdd(list) {
    return serial(function () {
      return OPS.list({ store: 'log' }).then(function (have) {
        var ids = {}; have.forEach(function (h) { ids[h.id] = 1; });
        var add = list.filter(function (r) { return r && r.id && !ids[r.id] && (ids[r.id] = 1); });
        if (!add.length) return 0;
        return getHead().then(function (head) {
          if (!head && CHAIN) head = CHAIN.newestSeal(have);
          var who = lanTok() ? sq('authStatus', {}).then(function (s) { return s && s.me; }, function () { return null; }) : Promise.resolve(ME);
          return who.then(function (me) { if (me) add.forEach(function (e) { if (!e.user) e.user = me.name; }); }).then(function () { return add.reduce(function (p, e) {   /* logins on: the user who made it, sealed with the entry */
            return p.then(function () { return CHAIN ? CHAIN.seal(e, head).then(function (x) { head = x.h || head; }) : null; });
          }, Promise.resolve()); }).then(function () { return rawPut('log', add); }).then(function (n) { return head ? setHead(head).then(function () { return n; }) : n; });
        });
      });
    });
  }
  var OPS = {
    list: function (a) { check(a.store); return E.all(a.store); },
    get: function (a) { check(a.store); return E.get(a.store, a.id); },
    put: function (a) {
      check(a.store);
      var list = Array.isArray(a.value) ? a.value : [a.value];
      if (a.store === 'log') return logAdd(list);
      if (a.store === 'ver') return addOnly('ver', list);
      if (a.store === 'meta' && list.some(function (v) { return v && v.id === HEAD; })) return kept('meta');   /* the newest seal is kept by this page only */
      return rawPut(a.store, list);
    },
    del: function (a) { check(a.store); if (KEEP[a.store] || a.store === 'meta' && a.id === HEAD) return kept(a.store); return E.del(a.store, a.id); },
    clear: function (a) { check(a.store); if (KEEP[a.store]) return kept(a.store); return E.clear(a.store); },
    /* Stage 1 extras: where the data is (SQLite or the old database) and its files; Stage 3 screens ask by business and year */
    /* ---------- user logins (Stage 2): the page asks, the data home keeps the login for this tab ---------- */
    authStatus: function () { return AREADY().then(function () { return SQL.on ? sq('authStatus', {}).then(function (st) { st.sqlite = true; return st; }) : idbLocked().then(function (l) { return { on: l, sqlite: false, users: [], me: null }; }); }); },
    login: function (a) { return SQL.ready.then(function () { return sq('login', a); }).then(function (r) { setTok(r.tok); if (!lanTok()) ME = r.me; return dropCopy().then(function () { return { me: r.me, tok: lanTok() ? r.tok : undefined }; }); }); },
    recover: function (a) { return SQL.ready.then(function () { return sq('recover', a); }).then(function (r) { setTok(r.tok); if (!lanTok()) ME = r.me; return dropCopy().then(function () { return { me: r.me, tok: lanTok() ? r.tok : undefined }; }); }); },
    setupOwner: function (a) { return SQL.ready.then(function () { return sq('setupOwner', a); }).then(function (r) { setTok(r.tok); if (!lanTok()) ME = r.me; return dropCopy().then(function () { return { me: r.me, recovery: r.recovery, tok: lanTok() ? r.tok : undefined }; }); }); },
    logout: function () { var t = tok(); setTok(''); if (!lanTok()) ME = null; return SQL.ready.then(function () { return SQL.on ? SQL.call('logout', { tok: t }) : true; }); },
    can: function (a) { return AREADY().then(function () { return LOGINS ? sq('can', a || {}) : true; }); },
    users: function (a) { return sq('users', a || {}); },
    addUser: function (a) { return sq('addUser', a || {}); },
    setUser: function (a) { return sq('setUser', a || {}); },
    changePw: function (a) { return sq('changePw', a || {}); },
    setRole: function (a) { return sq('setRole', a || {}); },
    engine: function () { return SQL.ready.then(function () { var on = SQL.on; return on ? sq('files', {}).then(function (f) { return { sqlite: true, files: f }; }) : { sqlite: false, error: SQL.error || '' }; }); },
    docsOf: function (a) { return SQL.ready.then(function () { var on = SQL.on; if (on) return sq('docsOf', a); return E.all('doc'); }); },
    /* Stage 3: count + oldest save time, and the documents with no business id, without reading every document (null = not on SQLite) */
    docStat: function () { return AREADY().then(function () { return SQL.on ? sq('docStat', {}).catch(function (e) { return fallback(e, function () { return null; }); }) : null; }); },
    noBiz: function () { return AREADY().then(function () { return SQL.on ? sq('noBiz', {}).catch(function (e) { return fallback(e, function () { return null; }); }) : null; }); },
    /* Stage 3: documents of the open years only (closed years stay in their files, see sqlcore docsFrom); without SQLite every document, no cut */
    docsFrom: function (a) {
      return AREADY().then(function () {
        if (!SQL.on) return E.all('doc').then(function (l) { return { docs: l, cut: {} }; });
        return sq('docsFrom', a || {}).catch(function (e) { return fallback(e, function () { return plain(idbAll)('doc').then(function (l) { return { docs: l, cut: {} }; }); }); });
      });
    },
    /* ---------- Stage 4: copies of the data files ----------
       snapshot({ have }) -> { at, logins, cipher, files: [{ name, stamp, size, bytes | same }] }; restoreFiles({ files }) replaces
       the data with a backup's files. The Windows program answers in JSON, so the bytes travel there as base64. */
    snapshot: function (a) {
      return AREADY().then(function () {
        if (!SQL.on) throw new Error('nosql');
        if (SQL.desk && a && a.auto) return { desk: true, files: [] };   /* the program makes its own daily copies (sqlhome.js) */
        return sq('snapshot', { have: a && a.have || {} }).then(function (r) {
          if (SQL.desk) (r.files || []).forEach(function (f) { if (f.b64 != null) { f.bytes = unb64(f.b64); delete f.b64; } });
          return r;
        });
      });
    },
    restoreFiles: function (a) {
      var files = (a && a.files || []).map(function (f) { return SQL.desk ? { name: f.name, b64: b64(f.bytes) } : { name: f.name, bytes: f.bytes }; });
      return SQL.ready.then(function () { if (!SQL.on) throw new Error('nosql'); return sq('restore', { files: files, note: a && a.note || '' }); }).then(afterRestore);
    },
    /* the Windows program's own daily copies: { op: 'bkDays' | 'bkRestoreDay' | 'bkNow', day } (null in a browser) */
    deskBackup: function (a) { return SQL.ready.then(function () { if (!SQL.desk || !SQL.on) return null; return sq(a.op, a).then(function (r) { return a.op === 'bkRestoreDay' ? afterRestore(r) : r; }); }); },
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
        if (LOGINS) return 'off';   /* logins on: no readable backup file; the locked .sqlite files are copied instead (Stage 4) */
        return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
          if (p !== 'granted') return 'ask';
          return OPS.exportAll().then(function (data) {
            var b = { app: 'Nivesh Sahayak', kind: 'backup', version: 1, saved: new Date().toISOString(), data: data };
            /* NSBiz/Data inside the chosen folder, as the App writes it (core.js) */
            return (h.name === 'NSBiz' ? Promise.resolve(h) : h.getDirectoryHandle('NSBiz', { create: true })).then(function (r) { return r.getDirectoryHandle('Data', { create: true }); })
              .then(function (dd) { return dd.getFileHandle(AF_FILE, { create: true }); }).then(function (fh) { return fh.createWritable(); })
              .then(function (w) { return w.write(JSON.stringify(b, null, 1)).then(function () { return w.close(); }); });
          }).then(function () {
            return E.put('meta', [{ id: 'lastBackup', v: Date.now(), updated: Date.now() }]);
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
  db().then(function () { return SQL.ready; }).then(function () { window.parent.postMessage({ ns: 'vault', ready: true }, '*'); },
    function () { window.parent.postMessage({ ns: 'vault', ready: false }, '*'); });
})();
